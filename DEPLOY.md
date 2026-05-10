# 部署到 Vercel — 操作指引

整个过程大概 5~10 分钟,只需要你在浏览器里点几下,不写代码。

## 准备

仓库已配置好:
- `vercel.json` — Vercel 构建/路由配置
- `api/index.ts` — Serverless Function 入口(包了 Express + tRPC)
- 前端走 `vite build`,产物落在 `dist/public/`,Vercel 当静态站点托管

## 步骤

### 1. 把项目推到 GitHub

如果还没建仓库:

```bash
cd /Users/macbook/Desktop/AI学习/ai-diary
git init
git add .
git commit -m "ready for vercel deploy"
# 在 github.com 新建一个空仓库,然后:
git remote add origin git@github.com:<你的用户名>/ai-diary.git
git branch -M main
git push -u origin main
```

如果已经在 GitHub 了,正常 push 就行。

### 2. 连接 Vercel

1. 打开 https://vercel.com/ → 用 GitHub 账号登录
2. 点 **Add New → Project**
3. 选刚才那个 `ai-diary` 仓库,点 **Import**
4. 进入配置页:
   - **Framework Preset**: 选 `Other`(因为我们自己配了 `vercel.json`,Vercel 会读它)
   - **Build Command / Output Directory**: 留空(`vercel.json` 里已经写了)
   - **Install Command**: 留空(同上)

### 3. 配置环境变量(关键)

在 Vercel 项目设置里点 **Environment Variables**,加一个:

| Key | Value | Environment |
|---|---|---|
| `SILICONFLOW_API_KEY` | `sk-...`(你的 SiliconFlow key) | Production / Preview / Development 都勾上 |

> **不要**把 key 提交到 git,本地的 `.env` 已经在 `.gitignore` 里。

### 4. 点 Deploy

等 1~2 分钟构建完成,Vercel 会给你一个公网 URL,例如:
`https://ai-diary-xxx.vercel.app`

### 5. 验证

打开 URL,试着写一条日记看 AI 是否能整理。
- ✅ 能整理 → 部署成功
- ❌ 卡住或报错 → 99% 是 `SILICONFLOW_API_KEY` 没加 / 加错环境

## 之后怎么更新?

每次 `git push` 到 main 分支,Vercel 自动重新部署,无需手动操作。

## 关于数据

部署后,**所有日记仍然只存在你访问 URL 时用的那个浏览器**。手机和电脑的数据不互通。

防丢方法:
- 在 复盘 页右上角点 **导出/备份** → 「完整备份(JSON)」,定期保存到云盘/本地
- 换设备时:打开 URL → 点「从备份恢复」→ 选 JSON 文件

要做真正的跨设备同步,需要后端数据库 + 登录(或用 6 位日记码方案),告诉我再做。
