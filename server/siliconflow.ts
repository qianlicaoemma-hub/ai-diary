/**
 * SiliconFlow API 服务模块
 * 使用 MiniMax 模型进行日记整理和月度复盘
 */

const SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1/chat/completions";
// 非推理模型,响应快(1~3s),JSON 输出稳定,中文表达自然
const MODEL = "Qwen/Qwen2.5-72B-Instruct";

// 单次请求超时(MiniMax-M2.5 是推理模型,reasoning 会消耗较多时间,留足 60s)
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * 调用 SiliconFlow API
 */
async function callSiliconFlowAPI(messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    throw new Error("SILICONFLOW_API_KEY environment variable is not set");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(SILICONFLOW_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        // 推理模型 reasoning_tokens 消耗很大,留足空间避免被截断或服务端挂死
        max_tokens: 4000,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`SiliconFlow 请求超时(${REQUEST_TIMEOUT_MS / 1000}s),请稍后重试`);
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const error = await response.text();
    console.error("[SiliconFlow] API Error:", error);
    throw new Error(`SiliconFlow API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content;
}

/**
 * 使用 SiliconFlow API 整理日记内容
 * @param userInput 用户输入的日记内容
 * @returns 整理后的日记卡片数据
 */
export async function organizeDiaryWithSiliconFlow(userInput: string) {
  try {
    const content = await callSiliconFlowAPI([
      {
        role: "system",
        content: `你是一个精致的个人日记助手。用户会输入一些关于今天的记录，你需要帮助他们整理成一张结构化的日记卡片。

请按照以下 JSON 格式返回结果（必须是有效的 JSON）：
{
  "mainEvent": "今日重点：今天最值得被记住的一个瞬间或亮点（情感锚点，不是事实总结）",
  "memories": ["记忆片段1", "记忆片段2", "记忆片段3"],
  "energyLevel": 7.5,
  "insights": "重要收获：用一句话总结今天学到的或感悟到的（可以为空字符串）",
  "nextDayPlans": ["明日计划1", "明日计划2"],
  "seedsToPlant": ["想做的事1", "想做的事2"],
  "longTermGoals": ["长期目标1", "长期目标2"]
}

字段角色（务必区分清楚，不要重复）：
- mainEvent「今日重点」是【高光时刻 / 情感锚点】：用一句话提炼今天最值得记住、最特别、最打动人的那一刻或那个细节，让未来翻回来看的自己一眼就被勾起回忆。
  - **不要复述用户原话**，要从原话里抽出一个具体的画面、感受、或转折点。
  - 偏好"……的那一刻"、"……的瞬间"、"从 X 到 Y 的转折"这类表达。
  ✅ 好例子（高光视角，有画面/转折/情绪）：
    "在异国吃到一口完美的酱蟹"
    "拥挤街头里偶然遇见的小巷比景点更治愈"
    "终于把卡了一周的报告写完那一刻的轻松"
    "OKR 从模糊到清晰的那一下"
  ❌ 不好的例子（事实总结 / 复述原话）：
    "在韩国旅行，人很多但玩得开心，还吃了酱蟹"
    "完成了项目报告并获得了团队认可"
    "被老板指出 OKR 问题后，下午重写目标变得清晰"  ← 这是事实流水，不是高光
  - 如果用户输入实在太短没有可挖的细节，宁可写得短而具体（如"目标突然清晰的瞬间"），也不要回去复述事实。

- memories「记忆片段」是【完整事实流水】：今天发生了哪些事，每条独立成行，客观陈述。

- insights「重要收获」是【用户自己说出来的理性启发】，必须严格遵守：
  - **只有当用户在原话里明确出现「意识到 / 学到 / 明白了 / 想通了 / 发现 / 让我觉得 / 原来 / 才知道」等表示自我反思的词时才填写**
  - 用户没有明确反思 → 必须返回空字符串 ""，**绝对不要 AI 自己总结道理或鸡汤式启发**
  ❌ 不允许的套话："明确目标才能更高效地工作"、"沟通很重要"、"坚持就是胜利"、"过程比结果重要"等任何 AI 自己悟出来的大道理
  ✅ 允许：用户原话说"今天意识到具体可衡量比写得多更重要" → insights: "具体可衡量比写得多更重要"

- mainEvent 与 memories 必须分工：mainEvent 抓画面/瞬间/转折，memories 罗列事实，绝不重复同一句话的不同写法。

其他规则：
1. memories 中每条独立、简洁，最好不超过 20 字
2. energyLevel 是 0-10 之间的数字，可以有一位小数，根据用户的语气和成就感推断
3. nextDayPlans / seedsToPlant / longTermGoals 三个数组，仅在用户明确提到时才填，否则返回空数组，不要瞎编
4. 所有文本都应该是中文

输出风格要求（非常重要）：
- 直接以日记主人的口吻输出最终内容，不要出现任何"基于用户输入推断"、"根据你说的"、"由于信息不足"等元描述
- 不要在 JSON 字段值里包含括号注释、推断说明、引用原文等内容
- 不要在 JSON 之外输出任何思考过程、解释、前言或后记
- 只输出一个合法的 JSON 对象，不要包裹在 markdown 代码块里`,
      },
      {
        role: "user",
        content: `请帮我整理今天的日记：${userInput}`,
      },
    ]);

    if (!content) {
      throw new Error("Empty response from SiliconFlow");
    }

    // 解析 JSON 响应
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      mainEvent: parsed.mainEvent || "今天有所收获",
      memories: Array.isArray(parsed.memories) ? parsed.memories : [userInput],
      energyLevel: typeof parsed.energyLevel === "number" ? parsed.energyLevel : 5,
      insights: parsed.insights || "",
      nextDayPlans: Array.isArray(parsed.nextDayPlans) ? parsed.nextDayPlans : [],
      seedsToPlant: Array.isArray(parsed.seedsToPlant) ? parsed.seedsToPlant : [],
      longTermGoals: Array.isArray(parsed.longTermGoals) ? parsed.longTermGoals : [],
    };
  } catch (error) {
    console.error("[SiliconFlow] Error organizing diary:", error);
    throw error;
  }
}

/**
 * 使用 SiliconFlow API 生成月度复盘
 * @param diaryEntries 该月所有日记条目
 * @returns 月度复盘总结
 */
export async function generateMonthlyReviewWithSiliconFlow(
  diaryEntries: Array<{
    date: string;
    mainEvent: string;
    memories: string[];
    energyLevel: number;
    insights: string;
  }>
) {
  try {
    // 构建日记摘要文本（排除记忆片段）
    const diaryText = diaryEntries
      .map(
        (entry) =>
          `【${entry.date}】\n主要事件：${entry.mainEvent}\n能量值：${entry.energyLevel}/10\n收获：${entry.insights || "无"}`
      )
      .join("\n\n");

    const content = await callSiliconFlowAPI([
      {
        role: "system",
        content: `你是一个专业的个人成长顾问。用户会提供一个月的日记记录，你需要生成一份理性、深入的月度复盘总结。

请按照以下 JSON 格式返回结果（必须是有效的 JSON）：
{
  "highlights": "本月亮点：用 2-3 句话总结本月最值得庆祝的成就和亮点",
  "challenges": "低谷分析：用 2-3 句话分析本月遇到的挑战、低谷或需要改进的地方",
  "suggestions": "成长建议：用 2-3 句话提出针对性的建议，帮助用户在下个月做得更好"
}

关键要求：
1. 所有内容都应该是中文
2. 语气应该是鼓励和建设性的，但也要诚实
3. 避免空洞的陈词滥调，要基于用户提供的具体日记内容
4. 每个字段都应该是 2-3 句完整的段落`,
      },
      {
        role: "user",
        content: `请为我生成本月的复盘总结：\n\n${diaryText}`,
      },
    ]);

    if (!content) {
      throw new Error("Empty response from SiliconFlow");
    }

    // 解析 JSON 响应 - 处理 Markdown 代码块和直接 JSON
    let jsonStr = content;
    
    // 首先尝试从 Markdown 代码块中提取
    const markdownMatch = content.match(/```json\s*([\s\S]*?)```/);
    if (markdownMatch) {
      jsonStr = markdownMatch[1];
    } else {
      // 如果没有 Markdown 代码块，尝试直接提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to extract JSON from response");
      }
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr.trim());

    return {
      highlights: String(parsed.highlights || "本月收获满满"),
      challenges: String(parsed.challenges || "继续加油"),
      suggestions: String(parsed.suggestions || "保持前进的步伐"),
    };
  } catch (error) {
    console.error("[SiliconFlow] Error generating monthly review:", error);
    throw error;
  }
}
