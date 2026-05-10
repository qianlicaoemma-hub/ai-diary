// 本地 AI 模拟服务 - 用于演示日记功能
// 实际应用中应替换为真实的 AI API 调用

export interface OrganizedDiary {
  mainEvent: string;
  memories: string;
  energy: number;
  gains: string;
  nextDayPlans: string[];
  wantToDo: string[];
  longTermPlans: string[];
}

export async function organizeDiaryWithAI(userInput: string, date: string): Promise<OrganizedDiary> {
  // 模拟 AI 处理延迟
  await new Promise(resolve => setTimeout(resolve, 600));

  // 简单的文本分析和提取逻辑
  const lines = userInput.split('\n').filter(l => l.trim());
  
  // 从记忆片段中提炼「今日重点」：识别核心成果
  let mainEvent = '';
  const achievementKeywords = ['完成', '做了', '实现', '达成', '完成了', '成功', '学到', '掌握', '解决', '突破', '获得', '赢得', '开发', '设计', '创建', '建立', '推进'];
  
  // 策略 1：寻找包含成就动词的句子（优先级最高）
  for (const line of lines) {
    if (achievementKeywords.some(kw => line.includes(kw))) {
      mainEvent = line.trim();
      break;
    }
  }
  
  // 策略 2：如果没找到成就动词，寻找最长的有意义的句子（通常是重点）
  if (!mainEvent) {
    const meaningfulLines = lines.filter(l => l.length > 8);
    if (meaningfulLines.length > 0) {
      // 倾向于选择中间的句子（通常是核心内容），而不是最后一行（通常是反思）
      const midIndex = Math.floor(meaningfulLines.length / 2);
      mainEvent = meaningfulLines[midIndex].trim();
    }
  }
  
  // 策略 3：如果还是没有，使用第一行
  if (!mainEvent) {
    mainEvent = lines[0] || '今天有所收获';
  }
  
  // 确保主事件不超过 200 字符（保留完整句子）
  if (mainEvent.length > 200) {
    // 尝试在句号处截断
    const periodIndex = mainEvent.indexOf('。');
    if (periodIndex > 0 && periodIndex < 200) {
      mainEvent = mainEvent.substring(0, periodIndex + 1);
    } else {
      // 否则在 200 字符处截断，但确保不会中断词语
      mainEvent = mainEvent.substring(0, 200).trim();
      if (!mainEvent.endsWith('。')) {
        mainEvent += '...';
      }
    }
  }
  
  // 记忆片段：保留原始输入
  let memories = lines.join('\n') || '记录了今天的点滴';
  
  // 优化记忆片段排版：识别有序号并分行处理（支持 1. 2. 3. 和 ① ② ③ 等格式）
  const numberedPattern = /^\s*([0-9]+\.|[①②③④⑤⑥⑦⑧⑨⑩]|[a-z]\.|[-•*])\s+/gm;
  if (numberedPattern.test(memories)) {
    // 如果检测到有序号，确保每个项目单独成行
    memories = memories
      .split('\n')
      .map(line => {
        const match = line.match(/^\s*([0-9]+\.|[①②③④⑤⑥⑦⑧⑨⑩]|[a-z]\.|[-•*])\s+(.*)/);
        if (match) {
          return `${match[1]} ${match[2].trim()}`;
        }
        return line;
      })
      .join('\n');
  }
  
  // 从文本中推断能量值 (1-10)
  const energyKeywords = {
    high: ['充实', '开心', '满足', '成就', '快乐', '顺利', '完成', '成功', '有趣', '美好', '兴奋', '激动', '骄傲'],
    low: ['累', '疲惫', '困难', '失败', '沮丧', '无聊', '烦恼', '压力', '焦虑', '失望'],
  };
  
  let energy = 5;
  const lowerInput = userInput.toLowerCase();
  
  if (energyKeywords.high.some(kw => lowerInput.includes(kw))) {
    energy = 7.5 + Math.random() * 2.5; // 7.5-10
  } else if (energyKeywords.low.some(kw => lowerInput.includes(kw))) {
    energy = 3 + Math.random() * 2; // 3-5
  } else {
    energy = 5.5 + Math.random() * 2; // 5.5-7.5
  }
  
  // 提取 TODO 项目
  // 注：简化 TODO 提取，主要依赖用户在 UI 中的直接输入
  
  const nextDayPlans: string[] = [];
  const wantToDo: string[] = [];
  const longTermPlans: string[] = [];
  
  // TODO 分类逻辑保留为空，让用户在 UI 中直接添加
  // 这样可以让用户更灵活地规划下一步行动
  
  // 提取收获（可选）：从记忆片段中寻找学习或洞察
  let gains = '';
  const gainsMatch = userInput.match(/(?:学到|收获|明白|发现|意识到|认识到|感受到|体会到)[\s：:]*([^。\n]+)/);
  if (gainsMatch) {
    gains = gainsMatch[1].trim();
  } else {
    // 如果没有显式的收获表达，尝试从最后一行提取（通常是反思）
    const lastLine = lines[lines.length - 1];
    if (lastLine && lastLine.length > 5 && !achievementKeywords.some(kw => lastLine.includes(kw))) {
      gains = lastLine.trim();
    }
  }
  
  return {
    mainEvent: mainEvent.trim(),
    memories: memories.trim(),
    energy: Math.round(energy * 10) / 10,
    gains: gains.trim(),
    nextDayPlans,
    wantToDo,
    longTermPlans,
  };
}

export async function generateMonthlyReviewWithAI(
  entries: Array<{ mainEvent: string; energy: number; gains: string }>,
  year: number,
  month: number
): Promise<string> {
  // 模拟 AI 处理延迟
  await new Promise(resolve => setTimeout(resolve, 800));

  if (entries.length === 0) {
    return `${year}年${month}月，还没有记录任何日记。\n\n开始记录吧，让每一天都有意义！🌟`;
  }

  const avgEnergy = entries.reduce((sum, e) => sum + e.energy, 0) / entries.length;
  const highEnergyDays = entries.filter(e => e.energy >= 7.5).length;
  const lowEnergyDays = entries.filter(e => e.energy <= 4).length;
  
  const gainsText = entries
    .filter(e => e.gains)
    .map(e => e.gains)
    .slice(0, 3)
    .join('；');

  let review = `## ${year}年${month}月 月度复盘\n\n`;
  review += `**记录天数：** ${entries.length}天\n`;
  review += `**平均能量值：** ${avgEnergy.toFixed(1)}/10\n\n`;
  
  review += `### 📊 本月亮点\n`;
  review += `- 共有${highEnergyDays}天保持高能量状态（≥7.5分）\n`;
  if (highEnergyDays > 0) {
    review += `- 完成了多项重要事务，展现了出色的执行力\n`;
    review += `- 获得了宝贵的生活经验和成长机会\n\n`;
  } else {
    review += `- 坚持记录，为成长积累经验\n\n`;
  }
  
  review += `### 📉 低谷分析\n`;
  if (lowEnergyDays > 0) {
    review += `- ${lowEnergyDays}天能量较低，可能需要调整节奏\n`;
    review += `- 建议在这些日子里增加自我照顾和休息\n`;
    review += `- 可以尝试新的兴趣爱好或运动来提升状态\n\n`;
  } else {
    review += `- 本月能量状态稳定且积极，继续保持这种势头\n\n`;
  }
  
  review += `### 💡 成长建议\n`;
  if (gainsText) {
    review += `本月的主要收获：${gainsText}\n\n`;
  }
  review += `- 继续保持记录习惯，让每一天都有意义\n`;
  review += `- 在高能量的日子里总结经验，在低谷时期寻求支持\n`;
  review += `- 设定明确的目标，为下个月的成长做准备\n`;
  review += `- 记录是最好的反思，坚持下去，你会看到自己的成长\n`;
  review += `\n祝你下个月继续进步！🌟`;

  return review;
}
