// ===== Vercel Serverless: tRPC 兼容端点 =====
// 文件名 [procedure].ts → 自动匹配 /api/trpc/<任何过程名>
// SiliconFlow 调用逻辑直接内联在这里,避免跨目录 import 在 Vercel 上的打包问题。

export const config = {
  runtime: 'nodejs',
  maxDuration: 90,
};

const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const MODEL = 'Qwen/Qwen2.5-72B-Instruct';
const REQUEST_TIMEOUT_MS = 60_000;

async function callSiliconFlow(messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    throw new Error('SILICONFLOW_API_KEY 未配置');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 4000,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      throw new Error(`SiliconFlow 请求超时(${REQUEST_TIMEOUT_MS / 1000}s)`);
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SiliconFlow API ${response.status}: ${text}`);
  }
  const data = await response.json();
  return data?.choices?.[0]?.message?.content as string | undefined;
}

const ORGANIZE_SYSTEM_PROMPT = `你是一个精致的个人日记助手。用户会输入一些关于今天的记录,你需要帮助他们整理成一张结构化的日记卡片。

请按照以下 JSON 格式返回结果(必须是有效的 JSON):
{
  "mainEvent": "今日重点:今天最值得被记住的一个瞬间或亮点(情感锚点,不是事实总结)",
  "memories": ["记忆片段1", "记忆片段2", "记忆片段3"],
  "energyLevel": 7.5,
  "insights": "重要收获:用一句话总结今天学到的或感悟到的(可以为空字符串)",
  "nextDayPlans": ["明日计划1", "明日计划2"],
  "seedsToPlant": ["想做的事1", "想做的事2"],
  "longTermGoals": ["长期目标1", "长期目标2"]
}

字段角色(务必区分清楚,不要重复):
- mainEvent「今日重点」是【高光时刻 / 情感锚点】:用一句话提炼今天最值得记住、最特别、最打动人的那一刻或那个细节,让未来翻回来看的自己一眼就被勾起回忆。
  - 不要复述用户原话,要从原话里抽出一个具体的画面、感受、或转折点。
  - 偏好"……的那一刻"、"……的瞬间"、"从 X 到 Y 的转折"这类表达。
  ✅ 好例子:"在异国吃到一口完美的酱蟹"、"OKR 从模糊到清晰的那一下"
  ❌ 不好的例子(事实总结/复述原话):"在韩国旅行,人很多但玩得开心,还吃了酱蟹"
- memories「记忆片段」是【完整事实流水】:今天发生了哪些事,每条独立成行,客观陈述。
- insights「重要收获」是【用户自己说出来的理性启发】,必须严格遵守:
  - 只有当用户在原话里明确出现「意识到 / 学到 / 明白了 / 想通了 / 发现 / 让我觉得 / 原来 / 才知道」等表示自我反思的词时才填写
  - 用户没有明确反思 → 必须返回空字符串 "",绝对不要 AI 自己总结道理或鸡汤式启发
  ❌ 不允许的套话:"明确目标才能更高效地工作"、"沟通很重要"、"坚持就是胜利"等任何 AI 自己悟出来的大道理
- mainEvent 与 memories 必须分工:mainEvent 抓画面/瞬间/转折,memories 罗列事实,绝不重复同一句话的不同写法。

其他规则:
1. memories 中每条独立、简洁,最好不超过 20 字
2. energyLevel 是 0-10 之间的数字,可以有一位小数
3. nextDayPlans / seedsToPlant / longTermGoals 三个数组,仅在用户明确提到时才填,否则返回空数组,不要瞎编
4. 所有文本都应该是中文

输出风格要求(非常重要):
- 直接以日记主人的口吻输出最终内容,不要出现任何"基于用户输入推断"、"根据你说的"等元描述
- 不要在 JSON 字段值里包含括号注释、推断说明、引用原文等内容
- 不要在 JSON 之外输出任何思考过程、解释、前言或后记
- 只输出一个合法的 JSON 对象,不要包裹在 markdown 代码块里`;

async function organizeDiary(userInput: string) {
  const content = await callSiliconFlow([
    { role: 'system', content: ORGANIZE_SYSTEM_PROMPT },
    { role: 'user', content: `请帮我整理今天的日记:${userInput}` },
  ]);
  if (!content) throw new Error('AI 返回为空');

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('未在 AI 响应中找到 JSON');
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    mainEvent: parsed.mainEvent || '今天有所收获',
    memories: Array.isArray(parsed.memories) ? parsed.memories : [userInput],
    energyLevel: typeof parsed.energyLevel === 'number' ? parsed.energyLevel : 5,
    insights: parsed.insights || '',
    nextDayPlans: Array.isArray(parsed.nextDayPlans) ? parsed.nextDayPlans : [],
    seedsToPlant: Array.isArray(parsed.seedsToPlant) ? parsed.seedsToPlant : [],
    longTermGoals: Array.isArray(parsed.longTermGoals) ? parsed.longTermGoals : [],
  };
}

const REVIEW_SYSTEM_PROMPT = `你是一个专业的个人成长顾问。用户会提供一个月的日记记录,你需要生成一份理性、深入的月度复盘总结。

请按照以下 JSON 格式返回结果(必须是有效的 JSON):
{
  "highlights": "本月亮点:用 2-3 句话总结本月最值得庆祝的成就和亮点",
  "challenges": "低谷分析:用 2-3 句话分析本月遇到的挑战、低谷或需要改进的地方",
  "suggestions": "成长建议:用 2-3 句话提出针对性的建议,帮助用户在下个月做得更好"
}

关键要求:
1. 所有内容都应该是中文
2. 语气应该是鼓励和建设性的,但也要诚实
3. 避免空洞的陈词滥调,要基于用户提供的具体日记内容
4. 每个字段都应该是 2-3 句完整的段落`;

interface DiaryEntryInput {
  date: string;
  mainEvent: string;
  energy: number;
  gains: string;
}

async function generateReview(entries: DiaryEntryInput[]) {
  const diaryText = entries
    .map(e => `【${e.date}】\n主要事件:${e.mainEvent}\n能量值:${e.energy}/10\n收获:${e.gains || '无'}`)
    .join('\n\n');

  const content = await callSiliconFlow([
    { role: 'system', content: REVIEW_SYSTEM_PROMPT },
    { role: 'user', content: `请为我生成本月的复盘总结:\n\n${diaryText}` },
  ]);
  if (!content) throw new Error('AI 返回为空');

  let jsonStr = content;
  const md = content.match(/```json\s*([\s\S]*?)```/);
  if (md) {
    jsonStr = md[1];
  } else {
    const jm = content.match(/\{[\s\S]*\}/);
    if (!jm) throw new Error('未在 AI 响应中找到 JSON');
    jsonStr = jm[0];
  }
  const parsed = JSON.parse(jsonStr.trim());

  return {
    highlights: String(parsed.highlights || '本月收获满满'),
    challenges: String(parsed.challenges || '继续加油'),
    suggestions: String(parsed.suggestions || '保持前进的步伐'),
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: { message: 'Method not allowed', code: 'METHOD_NOT_SUPPORTED' },
    });
  }

  const procedure = String(req.query?.procedure ?? '');
  const body = req.body ?? {};
  const input = body?.json ?? body;

  try {
    let result: unknown;

    switch (procedure) {
      case 'diary.organize': {
        if (!input || typeof input.rawInput !== 'string' || !input.rawInput.trim()) {
          return res.status(400).json({
            error: { message: 'rawInput 不能为空', code: 'BAD_REQUEST' },
          });
        }
        result = await organizeDiary(input.rawInput);
        break;
      }

      case 'diary.generateReview': {
        if (!input || !Array.isArray(input.entries)) {
          return res.status(400).json({
            error: { message: 'entries 必须是数组', code: 'BAD_REQUEST' },
          });
        }
        result = await generateReview(input.entries);
        break;
      }

      default:
        return res.status(404).json({
          error: { message: `Unknown procedure: ${procedure}`, code: 'NOT_FOUND' },
        });
    }

    // tRPC 响应格式: { result: { data: { json: ... } } }
    return res.status(200).json({ result: { data: { json: result } } });
  } catch (err: any) {
    console.error(`[api/trpc/${procedure}] error:`, err);
    return res.status(500).json({
      error: {
        message: err?.message || '服务端错误',
        code: 'INTERNAL_SERVER_ERROR',
      },
    });
  }
}
