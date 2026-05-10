/**
 * 测试月度复盘生成功能的完整流程
 */

// 模拟日记条目数据
const mockDiaryEntries = [
  {
    date: "2026-02-01",
    mainEvent: "完成了项目初期规划",
    memories: [],
    energyLevel: 7.5,
    insights: "学到了如何更好地与团队沟通"
  },
  {
    date: "2026-02-05",
    mainEvent: "完成了核心功能开发",
    memories: [],
    energyLevel: 8.5,
    insights: "代码质量意识有所提升"
  },
  {
    date: "2026-02-10",
    mainEvent: "参加了技术分享会",
    memories: [],
    energyLevel: 7.0,
    insights: "意识到持续学习的重要性"
  },
  {
    date: "2026-02-15",
    mainEvent: "完成了项目测试和优化",
    memories: [],
    energyLevel: 8.0,
    insights: "产品质量有了显著提升"
  },
  {
    date: "2026-02-20",
    mainEvent: "项目成功上线",
    memories: [],
    energyLevel: 9.0,
    insights: "团队协作的力量真的很大"
  }
];

// 构建日记摘要文本
const diaryText = mockDiaryEntries
  .map(entry => `【${entry.date}】\n主要事件：${entry.mainEvent}\n能量值：${entry.energyLevel}/10\n收获：${entry.insights}`)
  .join("\n\n");

console.log("📝 构建的日记摘要：\n");
console.log(diaryText);
console.log("\n" + "=".repeat(60) + "\n");

// 模拟 tRPC 请求数据格式
const trpcRequestData = {
  json: {
    entries: mockDiaryEntries.map(e => ({
      date: e.date,
      mainEvent: e.mainEvent,
      energy: e.energyLevel,
      gains: e.insights,
      nextDayPlans: [],
      wantToDo: [],
      longTermPlans: [],
    })),
    year: 2026,
    month: 2,
  },
};

console.log("📤 tRPC 请求格式：\n");
console.log(JSON.stringify(trpcRequestData, null, 2));
console.log("\n" + "=".repeat(60) + "\n");

// 测试 SiliconFlow API
const SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1/chat/completions";
const MODEL = "Pro/MiniMaxAI/MiniMax-M2.5";
const API_KEY = process.env.SILICONFLOW_API_KEY;

if (!API_KEY) {
  console.error("❌ SILICONFLOW_API_KEY not set");
  process.exit(1);
}

console.log("🔄 正在调用 SiliconFlow API...\n");

try {
  const response = await fetch(SILICONFLOW_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
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
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("❌ API Error:", error);
    process.exit(1);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  console.log("✅ API 原始响应：\n");
  console.log(content);
  console.log("\n" + "=".repeat(60) + "\n");

  // 解析 JSON - 处理 Markdown 代码块
  let jsonStr = content;
  
  // 首先尝试从 Markdown 代码块中提取
  const markdownMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (markdownMatch) {
    jsonStr = markdownMatch[1];
    console.log("✅ 从 Markdown 代码块中提取 JSON\n");
  } else {
    // 如果没有 Markdown 代码块，尝试直接提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("❌ Failed to extract JSON from response");
      process.exit(1);
    }
    jsonStr = jsonMatch[0];
    console.log("✅ 直接提取 JSON\n");
  }

  const parsed = JSON.parse(jsonStr.trim());

  console.log("✅ 解析后的 JSON：\n");
  console.log(JSON.stringify(parsed, null, 2));
  console.log("\n" + "=".repeat(60) + "\n");

  // 模拟前端显示格式
  const reviewText = `🌟 本月亮点\n${parsed.highlights}\n\n💪 低谷分析\n${parsed.challenges}\n\n🚀 成长建议\n${parsed.suggestions}`;
  
  console.log("📱 前端显示格式：\n");
  console.log(reviewText);
  console.log("\n✅ 测试完成！");

} catch (error) {
  console.error("❌ 测试失败：", error.message);
  process.exit(1);
}
