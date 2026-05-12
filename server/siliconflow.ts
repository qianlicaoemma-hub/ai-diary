/**
 * SiliconFlow API 服务模块
 * 用于本地 dev 跑 tRPC 路由(server/_core/index.ts)
 * Prompt 与 Vercel 生产共用 api/_shared/prompts.ts
 */

import {
  ORGANIZE_SYSTEM_PROMPT,
  ORGANIZE_USER_PROMPT_PREFIX,
  REVIEW_SYSTEM_PROMPT,
  REVIEW_USER_PROMPT_PREFIX,
} from "../api/_shared/prompts";

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
      { role: "system", content: ORGANIZE_SYSTEM_PROMPT },
      { role: "user", content: `${ORGANIZE_USER_PROMPT_PREFIX}${userInput}` },
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
      { role: "system", content: REVIEW_SYSTEM_PROMPT },
      { role: "user", content: `${REVIEW_USER_PROMPT_PREFIX}${diaryText}` },
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
