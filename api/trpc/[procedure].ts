// ===== Vercel Serverless: tRPC 兼容端点 =====
// 文件名 [procedure].ts → 自动匹配 /api/trpc/<任何过程名>
// Prompt 共享自 api/_shared/prompts.ts(同 api/ 目录,Vercel 能正确打包)

import {
  ORGANIZE_SYSTEM_PROMPT,
  ORGANIZE_USER_PROMPT_PREFIX,
  REVIEW_SYSTEM_PROMPT,
  REVIEW_USER_PROMPT_PREFIX,
} from '../_shared/prompts';

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

async function organizeDiary(userInput: string) {
  const content = await callSiliconFlow([
    { role: 'system', content: ORGANIZE_SYSTEM_PROMPT },
    { role: 'user', content: `${ORGANIZE_USER_PROMPT_PREFIX}${userInput}` },
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
    { role: 'user', content: `${REVIEW_USER_PROMPT_PREFIX}${diaryText}` },
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
