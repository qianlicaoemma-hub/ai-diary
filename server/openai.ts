import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 使用 OpenAI API 整理日记内容
 * @param userInput 用户输入的日记内容
 * @returns 整理后的日记卡片数据
 */
export async function organizeDiaryWithOpenAI(userInput: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `你是一个精致的个人日记助手。用户会输入一些关于今天的记录，你需要帮助他们整理成一张结构化的日记卡片。

请按照以下 JSON 格式返回结果（必须是有效的 JSON）：
{
  "mainEvent": "今日重点：用一句话精简表达今天达成了什么核心成果，基于记忆片段提炼，不丢失重要信息",
  "memories": ["记忆片段1", "记忆片段2", "记忆片段3"],
  "energyLevel": 7.5,
  "insights": "重要收获：用一句话总结今天学到的或感悟到的（可以为空字符串）",
  "nextDayPlans": ["明日计划1", "明日计划2"],
  "seedsToPlant": ["想做的事1", "想做的事2"],
  "longTermGoals": ["长期目标1", "长期目标2"]
}

关键要求：
1. mainEvent 是「今日重点」，必须：
   - 基于 memories 中的具体事件提炼核心成果
   - 用一句完整的句子表达（不能中间截断）
   - 精简表达，突出「达成了什么」而非「做了什么」
   - 例如：用户记录了「参加了会议、完成了报告、学到了新技能」，应该提炼为「完成了项目报告并获得了团队认可"
   - 不丢失重要信息，确保核心成果清晰可见
2. memories 应该是流水账式的记录，每条独立成行
3. energyLevel 是 0-10 之间的数字，可以有一位小数，根据用户的语气和成就感推断
4. insights 应该有启发性，如果用户没有提到收获就返回空字符串
5. 其他三个字段都是数组，根据用户的输入推断相关的计划和目标
6. 所有文本都应该是中文`,
        },
        {
          role: "user",
          content: `请帮我整理今天的日记：${userInput}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
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
    console.error("[OpenAI] Error organizing diary:", error);
    throw error;
  }
}

/**
 * 使用 OpenAI API 生成月度复盘
 * @param diaryEntries 该月所有日记条目
 * @returns 月度复盘总结
 */
export async function generateMonthlyReviewWithOpenAI(
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
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
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    // 解析 JSON 响应
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      highlights: parsed.highlights || "本月收获满满",
      challenges: parsed.challenges || "继续加油",
      suggestions: parsed.suggestions || "保持前进的步伐",
    };
  } catch (error) {
    console.error("[OpenAI] Error generating monthly review:", error);
    throw error;
  }
}
