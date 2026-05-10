import fetch from 'node-fetch';

const SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1/chat/completions";
const MODEL = "Pro/MiniMaxAI/MiniMax-M2.5";
const API_KEY = process.env.SILICONFLOW_API_KEY;

if (!API_KEY) {
  console.error("SILICONFLOW_API_KEY not set");
  process.exit(1);
}

// 测试数据
const testEntries = [
  {
    date: "2026-02-20",
    mainEvent: "完成了项目报告并获得了团队认可",
    energyLevel: 8.5,
    insights: "学会了如何更有效地与团队沟通"
  },
  {
    date: "2026-02-21",
    mainEvent: "参加了技术分享会，学到了新的架构设计思路",
    energyLevel: 7.0,
    insights: "意识到持续学习的重要性"
  },
  {
    date: "2026-02-22",
    mainEvent: "完成了代码审查并提出了改进建议",
    energyLevel: 7.5,
    insights: "代码质量意识有所提升"
  }
];

// 构建日记摘要文本
const diaryText = testEntries
  .map(entry => `【${entry.date}】\n主要事件：${entry.mainEvent}\n能量值：${entry.energyLevel}/10\n收获：${entry.insights}`)
  .join("\n\n");

console.log("📝 日记摘要：\n", diaryText);
console.log("\n🔄 正在调用 SiliconFlow API...\n");

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

console.log("✅ API 响应：\n", content);

// 尝试解析 JSON
try {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    console.log("\n✅ 解析后的 JSON：\n", JSON.stringify(parsed, null, 2));
  } else {
    console.log("\n⚠️ 未找到 JSON 格式");
  }
} catch (e) {
  console.error("\n❌ JSON 解析失败：", e.message);
}
