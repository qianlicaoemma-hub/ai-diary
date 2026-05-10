// ===== Vercel Serverless: tRPC 兼容端点 =====
// 文件名 [procedure].ts → 自动匹配 /api/trpc/<任何过程名>
// 直接调用 server/siliconflow 里的纯函数,绕开 Express + tRPC + @shared 别名链
// 响应格式包装成 tRPC shape,前端 fetch('/api/trpc/diary.organize') 无需改动

import {
  organizeDiaryWithSiliconFlow,
  generateMonthlyReviewWithSiliconFlow,
} from '../../server/siliconflow';

export const config = {
  runtime: 'nodejs',
  maxDuration: 90,
};

interface DiaryEntryInput {
  date: string;
  mainEvent: string;
  energy: number;
  gains: string;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: { message: 'Method not allowed', code: 'METHOD_NOT_SUPPORTED' },
    });
  }

  const procedure = String(req.query?.procedure ?? '');
  // tRPC 客户端 / 我们前端 fetch 用的 body 格式: { json: <真实 input> }
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
        result = await organizeDiaryWithSiliconFlow(input.rawInput);
        break;
      }

      case 'diary.generateReview': {
        if (!input || !Array.isArray(input.entries)) {
          return res.status(400).json({
            error: { message: 'entries 必须是数组', code: 'BAD_REQUEST' },
          });
        }
        const diaryEntries = input.entries.map((entry: DiaryEntryInput) => ({
          date: entry.date,
          mainEvent: entry.mainEvent,
          memories: [],
          energyLevel: entry.energy,
          insights: entry.gains,
        }));
        result = await generateMonthlyReviewWithSiliconFlow(diaryEntries);
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
