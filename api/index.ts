// ===== Vercel Serverless 入口 =====
// 把 Express + tRPC 整体作为一个 Serverless Function 部署。
// vercel.json 把 /api/* 全部 rewrite 到这里,Express 内部按 /api/trpc/... 自己路由。

import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from '../server/routers';
import { createContext } from '../server/_core/context';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(
  '/api/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// 兜底 404,避免 Express 默认 HTML 错误页面
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

export default app;
