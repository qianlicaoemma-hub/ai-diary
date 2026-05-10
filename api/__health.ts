// 健康检查 — 用于诊断部署是否成功
// 访问 /api/__health 应返回 { ok: true, ... }

export const config = { runtime: 'nodejs' };

export default async function handler(_req: unknown, res: any) {
  res.status(200).json({
    ok: true,
    runtime: 'vercel-serverless',
    hasSiliconFlowKey: Boolean(process.env.SILICONFLOW_API_KEY),
    nodeVersion: process.version,
    time: new Date().toISOString(),
  });
}
