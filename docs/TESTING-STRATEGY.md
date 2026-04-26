# Testing Strategy

本项目的测试目标不是堆更多命令，而是在每次变更后先用较短路径暴露严重问题，再按风险升级到完整回归。

## 核心功能面

### Dashboard V3 Skills

覆盖技能一等公民主路径: 技能库列表、搜索、分页、左侧固定布局、正文加载缓存、正文编辑、版本历史、项目/宿主筛选。

关键测试:

- `tests/unit/dashboard-v3-layout.test.ts`
- `tests/unit/dashboard-v3-skills-workspace.test.ts`
- `tests/unit/dashboard-v3-skills-layout-contract.test.ts`
- `tests/unit/dashboard-v3-skills-cache.test.ts`
- `tests/unit/dashboard-v3-skill-library.test.ts`
- `tests/unit/dashboard-v3-skill-detail-load.test.ts`
- `tests/unit/dashboard-skill-evaluation-count.test.ts`
- `npm run test:storybook:dashboard-v3`

### Dashboard V3 Project

覆盖项目视角: 项目 rail、项目选择入口、项目内 skill 表格、host 筛选、项目成本合并视图和项目 API 合同。

关键测试:

- `tests/unit/dashboard-v3-project-contract.test.ts`
- `tests/unit/dashboard-v3-project-rail-contract.test.ts`
- `tests/unit/dashboard-v3-project-rail-search.test.ts`
- `tests/unit/dashboard-project-read-routes.test.ts`
- `tests/unit/dashboard-project-management-routes.test.ts`
- `tests/unit/dashboard-project-skill-routes.test.ts`
- `tests/unit/dashboard-project-skill-instance-routes.test.ts`
- `npm run test:storybook:dashboard-v3`

### Dashboard V3 Config

覆盖配置页: 模型服务列表、provider row、连通性检查、安全闸门、prompt override、V3 缓存和多语言文案。

关键测试:

- `tests/unit/dashboard-v3-config-contract.test.ts`
- `tests/unit/dashboard-v3-config-workspace.test.ts`
- `tests/unit/dashboard-v3-config-cache.test.ts`
- `tests/unit/config-dashboard-config.test.ts`
- `tests/unit/config-provider-connectivity.test.ts`
- `tests/unit/config-prompt-overrides.test.ts`
- `tests/unit/dashboard-v3-i18n.test.ts`
- `npm run test:storybook:dashboard-v3`

### Cost Visibility

覆盖成本统计: agent usage 读取、LiteLLM catalog、模型成本拆分、scope/token 拆分，以及项目页成本 tab 的压缩展示。

关键测试:

- `tests/unit/dashboard-agent-usage-reader.test.ts`
- `tests/unit/agent-usage-summary.test.ts`
- `tests/unit/dashboard-cost-panel.test.ts`
- `tests/unit/dashboard-v3-cost-contract.test.ts`
- `tests/unit/dashboard-v3-cost-logic.test.ts`
- `tests/unit/dashboard-cost-render.test.ts`
- `npm run test:storybook:dashboard-v3`

### Daemon / SSE / Dashboard Read Path

覆盖本地服务主路径: daemon 状态、dashboard 静态资源、SSE、project snapshot 读取、trace reader 缓存和读侧性能。

关键测试:

- `tests/runtime/dashboard-v3-runtime-smoke.ts`
- `tests/unit/dashboard-server.test.ts`
- `tests/unit/dashboard-sse-hub.test.ts`
- `tests/unit/dashboard-data-reader.test.ts`
- `tests/unit/dashboard-trace-reader.test.ts`
- `tests/unit/dashboard-trace-reader-cache.test.ts`
- `tests/unit/daemon-status-reader.test.ts`
- `tests/unit/daemon-process-manager.test.ts`
- `npm run benchmark:dashboard:smoke`
- `npm run benchmark:check`

`tests/runtime/dashboard-v3-runtime-smoke.ts` 会启动真实 dashboard server，并用临时 HOME / 临时项目夹覆盖以下运行时路径:

- `/` 默认入口重定向到 `/v3/`
- `/v3/project` 返回已构建的 dashboard v3 bundle
- `/v3/assets/*` 静态资源可访问且非空
- `/api/projects` 返回注册项目和 skill count
- `/api/projects/:project/snapshot` 返回项目 snapshot
- `/api/skills/families` 返回 skill family 聚合结果
- `/events` 能打开 SSE 并收到首个 update
- `/api/dashboard/client-errors` 能接收浏览器运行时错误

### Skill Lifecycle Core

覆盖 skill 生命周期: shadow registry、bootstrap、task episode、trace mapping、analysis window、版本树、patch generation。

关键测试:

- `tests/unit/shadow-registry.test.ts`
- `tests/unit/shadow-manager.test.ts`
- `tests/unit/shadow-bootstrapper.test.ts`
- `tests/unit/task-episode-store.test.ts`
- `tests/unit/task-episode-policy.test.ts`
- `tests/unit/trace-skill-mapper.test.ts`
- `tests/unit/window-analysis-coordinator.test.ts`
- `tests/unit/dashboard-skill-version-service.test.ts`
- `tests/unit/patch-generator.test.ts`

## Smoke Gate

每次普通代码变更后先跑:

```bash
npm run test:smoke
```

`test:smoke` 的职责是快速暴露会浪费人工验证时间的问题:

- TypeScript 编译错误
- V3 页面布局/合同回归
- 技能/项目/配置/成本主路径破坏
- Storybook 组件交互和 a11y 破坏
- dashboard 读侧明显性能退化

当前命令:

```bash
npm run typecheck
npm --prefix frontend-v3 run typecheck
vitest run tests/unit/dashboard-v3-layout.test.ts tests/unit/dashboard-v3-skills-workspace.test.ts tests/unit/dashboard-v3-project-contract.test.ts tests/unit/dashboard-v3-config-contract.test.ts tests/unit/dashboard-v3-cost-contract.test.ts tests/unit/dashboard-v3-storybook.test.ts tests/unit/dashboard-skill-evaluation-count.test.ts
npm run test:runtime
npm run test:storybook:dashboard-v3
npm run benchmark:dashboard:smoke
```

## Regression Gate

合并前、提交前，或者涉及读侧/daemon/核心生命周期时跑:

```bash
npm run test:regression
```

`test:regression` 在 smoke 之上增加:

- 全量 Vitest
- dashboard benchmark assert
- 完整构建，包括 dashboard v2/v3 静态产物和 CLI 可执行权限

当前命令:

```bash
npm run test:smoke
npm test -- --run
npm run benchmark:check
npm run build
```

## 变更类型与最低门禁

| 变更类型 | 最低执行 |
| --- | --- |
| V3 组件样式、布局、文案 | `npm run test:smoke` |
| V3 Storybook stories 或 shadcn 组件替换 | `npm run test:smoke` |
| Dashboard API、reader、SSE、daemon 状态 | `npm run test:regression` |
| trace、task episode、shadow、skill version | `npm run test:regression` |
| package、构建、静态资源路由 | `npm run test:regression` |
| 文档-only | `npx vitest run tests/unit/testing-gates.test.ts`，如文档改到测试/Storybook 规范也跑 `npm run test:smoke` |

## 新增测试规则

- 行为变更先写失败测试，再改实现。
- V3 可见 UI 变更优先补 Storybook story 或 play 断言。
- 页面结构、tab、入口、文案合同用 source-level contract test 锁住，避免 V1 功能再次丢失。
- dashboard 读侧、SSE、trace reader 变更必须补性能或缓存相关测试，必要时跑 benchmark。
- 对真实浏览器容易暴露的问题，测试后再用 Playwright 或 in-app browser 做一次 DOM/截图抽检。
