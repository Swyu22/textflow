# TextFlow Frontend

TextFlow 是一个公开可访问的文本存储与复制站点，前端部署在 GitHub Pages，后端使用 Supabase Edge Function 和数据库。

当前仓库中的前端真源目录是 `textflow-fe`。后端真源文件是 `../后端/supabase/functions/flow-api/index.ts`。

## 主要功能

- 文本卡片的创建、编辑、复制、分类和回收站
- AI 文字助手与流式聊天
- 匿名临时聊天室 `FlowChat.一阅即散`

## 开发命令

```bash
npm install
npm run dev
npm test
npm run build
```

## 关键环境变量

- `VITE_SUPABASE_FUNC_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BASE_PATH`

聊天室和回收站依赖 Supabase；如果本地未配置，会回落到当前项目默认的线上地址。

## 部署

### 前端

- GitHub Pages 工作流位于 `.github/workflows/deploy.yml`
- 默认从 `main` 分支构建
- 线上地址：`https://textflow.art/`

### 后端

- Supabase project ref：`bktkvzvylkqvlucoixay`
- Edge Function 真源：`../后端/supabase/functions/flow-api/index.ts`
- 聊天室和回收站相关数据库变更位于 `supabase/migrations/`

部署后端前，至少确认这些 secrets 已配置：

- `CATEGORY_DELETE_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- 实际使用的 AI provider API keys

## 当前聊天室约束

- 房间销毁后不保留消息和事件日志
- 仅允许 `chat_join_attempts` 保留 1-2 分钟的最小限流痕迹
- 页面关闭、刷新、跳转和组件卸载时，前端都会 best-effort 触发退房
