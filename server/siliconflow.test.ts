import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMonthlyReviewWithSiliconFlow } from './siliconflow';

// Mock fetch
global.fetch = vi.fn();

describe('generateMonthlyReviewWithSiliconFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse JSON response with markdown code block', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: `\`\`\`json
{
  "highlights": "本月成功完成了项目",
  "challenges": "需要加强技术积累",
  "suggestions": "建议制定学习计划"
}
\`\`\``,
            },
          },
        ],
      }),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const diaryEntries = [
      {
        date: '2026-02-01',
        mainEvent: '完成项目规划',
        memories: [],
        energyLevel: 8,
        insights: '学到了新知识',
      },
    ];

    const result = await generateMonthlyReviewWithSiliconFlow(diaryEntries);

    expect(result).toEqual({
      highlights: '本月成功完成了项目',
      challenges: '需要加强技术积累',
      suggestions: '建议制定学习计划',
    });
  });

  it('should parse JSON response without markdown code block', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: `{
  "highlights": "本月成功完成了项目",
  "challenges": "需要加强技术积累",
  "suggestions": "建议制定学习计划"
}`,
            },
          },
        ],
      }),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const diaryEntries = [
      {
        date: '2026-02-01',
        mainEvent: '完成项目规划',
        memories: [],
        energyLevel: 8,
        insights: '学到了新知识',
      },
    ];

    const result = await generateMonthlyReviewWithSiliconFlow(diaryEntries);

    expect(result).toEqual({
      highlights: '本月成功完成了项目',
      challenges: '需要加强技术积累',
      suggestions: '建议制定学习计划',
    });
  });

  it('should handle missing fields with defaults', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: `{
  "highlights": "本月成功完成了项目"
}`,
            },
          },
        ],
      }),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const diaryEntries = [
      {
        date: '2026-02-01',
        mainEvent: '完成项目规划',
        memories: [],
        energyLevel: 8,
        insights: '学到了新知识',
      },
    ];

    const result = await generateMonthlyReviewWithSiliconFlow(diaryEntries);

    expect(result.highlights).toBe('本月成功完成了项目');
    expect(result.challenges).toBe('继续加油');
    expect(result.suggestions).toBe('保持前进的步伐');
  });

  it('should construct correct API request with diary entries', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: `{
  "highlights": "本月成功完成了项目",
  "challenges": "需要加强技术积累",
  "suggestions": "建议制定学习计划"
}`,
            },
          },
        ],
      }),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const diaryEntries = [
      {
        date: '2026-02-01',
        mainEvent: '完成项目规划',
        memories: [],
        energyLevel: 8,
        insights: '学到了新知识',
      },
      {
        date: '2026-02-05',
        mainEvent: '完成代码审查',
        memories: [],
        energyLevel: 7.5,
        insights: '代码质量很重要',
      },
    ];

    await generateMonthlyReviewWithSiliconFlow(diaryEntries);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.siliconflow.cn/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: expect.stringContaining('Bearer'),
        }),
      })
    );

    // Verify the request body contains the diary entries
    const callArgs = (global.fetch as any).mock.calls[0][1];
    const body = JSON.parse(callArgs.body);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1].content).toContain('【2026-02-01】');
    expect(body.messages[1].content).toContain('完成项目规划');
    expect(body.messages[1].content).toContain('【2026-02-05】');
    expect(body.messages[1].content).toContain('完成代码审查');
  });

  it('should throw error when API response is not ok', async () => {
    const mockResponse = {
      ok: false,
      text: async () => 'API Error',
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const diaryEntries = [
      {
        date: '2026-02-01',
        mainEvent: '完成项目规划',
        memories: [],
        energyLevel: 8,
        insights: '学到了新知识',
      },
    ];

    await expect(generateMonthlyReviewWithSiliconFlow(diaryEntries)).rejects.toThrow();
  });

  it('should throw error when API key is not set', async () => {
    const originalEnv = process.env.SILICONFLOW_API_KEY;
    delete process.env.SILICONFLOW_API_KEY;

    const diaryEntries = [
      {
        date: '2026-02-01',
        mainEvent: '完成项目规划',
        memories: [],
        energyLevel: 8,
        insights: '学到了新知识',
      },
    ];

    await expect(generateMonthlyReviewWithSiliconFlow(diaryEntries)).rejects.toThrow(
      'SILICONFLOW_API_KEY environment variable is not set'
    );

    process.env.SILICONFLOW_API_KEY = originalEnv;
  });

  it('should handle empty diary entries', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: `{
  "highlights": "暂无数据",
  "challenges": "暂无数据",
  "suggestions": "暂无数据"
}`,
            },
          },
        ],
      }),
    };

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const diaryEntries: Array<{
      date: string;
      mainEvent: string;
      memories: string[];
      energyLevel: number;
      insights: string;
    }> = [];

    const result = await generateMonthlyReviewWithSiliconFlow(diaryEntries);

    expect(result).toBeDefined();
    expect(result.highlights).toBeDefined();
  });
});
