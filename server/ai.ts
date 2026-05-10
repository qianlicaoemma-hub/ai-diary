// ===== 后端 AI 服务层 =====
// 通过 invokeLLM 调用 LLM 模型

import { invokeLLM } from "./_core/llm";

export interface DiaryCardResult {
  mainEvent: string;
  memories: string;
  energy: number;
  gains: string;
  nextDayPlans: string[];
  wantToDo: string[];
  longTermPlans: string[];
}

/**
 * 整理日记内容为结构化卡片
 */
export async function organizeDiaryEntry(
  rawInput: string,
  date: string
): Promise<DiaryCardResult> {
  const prompt = `你是一个温暖、细心的日记整理助手。请将用户的日记内容整理成结构化的日记卡片。

用户日期：${date}
用户输入：
${rawInput}

请以 JSON 格式返回以下字段：
{
  "mainEvent": "今天最重要的一件事（一句话，简洁有力）",
  "memories": "记忆片段（2-4条，每条用•开头，捕捉有趣细节和情感）",
  "energy": 7.5,  // 能量值 1-10，支持1位小数，根据内容情绪判断
  "gains": "今天最重要的收获或感悟（1-2句话）",
  "nextDayPlans": ["明天要做的事1", "明天要做的事2"],  // 从内容中提取或合理推断
  "wantToDo": ["想做的事或种草的东西"],  // 从内容中提取
  "longTermPlans": ["长期计划或目标"]  // 从内容中提取
}

注意：
- mainEvent 要抓住最核心的事，有画面感
- memories 要有温度，像在回忆珍贵瞬间
- energy 要根据用户描述的情绪状态客观评估
- 如果内容中没有明确的计划/种草/长期目标，返回空数组
- 只返回 JSON，不要有其他文字`;

  try {
    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "diary_card",
          strict: true,
          schema: {
            type: "object",
            properties: {
              mainEvent: { type: "string" },
              memories: { type: "string" },
              energy: { type: "number" },
              gains: { type: "string" },
              nextDayPlans: { type: "array", items: { type: "string" } },
              wantToDo: { type: "array", items: { type: "string" } },
              longTermPlans: { type: "array", items: { type: "string" } },
            },
            required: ["mainEvent", "memories", "energy", "gains", "nextDayPlans", "wantToDo", "longTermPlans"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('Invalid response format');
    return JSON.parse(content) as DiaryCardResult;
  } catch (error) {
    console.error("AI organize error:", error);
    // 降级：返回基础结构
    return {
      mainEvent: rawInput.slice(0, 50) + (rawInput.length > 50 ? "..." : ""),
      memories: `• ${rawInput}`,
      energy: 7,
      gains: "今天也是充实的一天。",
      nextDayPlans: [],
      wantToDo: [],
      longTermPlans: [],
    };
  }
}

/**
 * 生成月度复盘总结
 */
export async function generateMonthlyReview(
  entries: Array<{
    date: string;
    mainEvent: string;
    energy: number;
    gains: string;
    nextDayPlans: Array<{ text: string; done: boolean }>;
    wantToDo: Array<{ text: string; done: boolean }>;
    longTermPlans: Array<{ text: string; done: boolean }>;
  }>,
  year: number,
  month: number
): Promise<string> {
  if (entries.length === 0) {
    return "本月暂无日记记录，无法生成复盘。";
  }

  const avgEnergy = entries.reduce((sum, e) => sum + e.energy, 0) / entries.length;
  const maxEnergy = Math.max(...entries.map(e => e.energy));
  const minEnergy = Math.min(...entries.map(e => e.energy));

  const entriesSummary = entries.map(e => `
日期：${e.date}（能量：${e.energy}）
今日重点：${e.mainEvent}
重要收获：${e.gains}
`).join("\n");

  const prompt = `你是一个理性、深刻的个人成长顾问。请基于用户 ${year}年${month}月 的日记数据，生成一份理性复盘风格的月度总结。

月度数据概览：
- 记录天数：${entries.length} 天
- 平均能量值：${avgEnergy.toFixed(1)}
- 最高能量：${maxEnergy}，最低能量：${minEnergy}

日记摘要：
${entriesSummary}

请生成包含以下部分的复盘报告（Markdown 格式）：

## 🌟 本月亮点
（3-4条具体的成就或高光时刻，有数据支撑）

## 📉 低谷分析
（能量低谷期的规律分析，客观理性，不要过度安慰）

## 🌱 成长建议
（基于本月模式，给出 2-3 条具体可执行的建议）

## 💬 月度寄语
（一句有力量的话，总结这个月）

要求：
- 理性分析，避免空洞的鼓励
- 基于实际数据，有具体细节
- 语气温暖但不矫情
- 总字数控制在 400-600 字`;

  try {
    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : "生成失败，请重试。";
  } catch (error) {
    console.error("Monthly review error:", error);
    return `## 🌟 本月亮点\n本月共记录 ${entries.length} 天，平均能量值 ${avgEnergy.toFixed(1)}，坚持记录本身就是一种成就。\n\n## 📉 低谷分析\n能量最低点为 ${minEnergy}，注意在低能量时期保持基本的生活节律。\n\n## 🌱 成长建议\n继续保持记录习惯，关注能量变化规律，在高能量时期做重要决策。\n\n## 💬 月度寄语\n每一天的记录，都是对自己最好的交代。`;
  }
}
