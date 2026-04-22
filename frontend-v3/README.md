# OrnnSkills Dashboard V3

这个子工程是 dashboard 的全新隔离前端入口。

目标：

- 不复用 `frontend/` 里的旧 UI 组件和样式层
- 保持与主服务端 API / SSE 协议兼容
- 以 shadcn preset `b4NKaHect` 为主视觉基础

常用命令：

- `npm run dev:dashboard-v3`
- `npm run build:dashboard-v3`
- `npm --prefix frontend-v3 run typecheck`
