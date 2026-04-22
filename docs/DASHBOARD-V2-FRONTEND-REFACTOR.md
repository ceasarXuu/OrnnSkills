# Dashboard V2 Frontend Refactor

## 0. Status Update

- 原计划里的 `v2` 隔离层已经证明“入口隔离”不等于“表示层隔离”
- 这次在真实视觉迭代里再次出现了业务层私有样式回流，因此当前结论已经升级为：
  - **不再继续把 `frontend/` 当成默认新前端主线**
  - **新主线切到完全独立的 `frontend-v3/` + `/v3`**
- `v2` 保留为前一轮实验产物和对照入口，不再承担“彻底摆脱旧视觉包袱”的目标
- `v3` 的隔离标准更严格：
  - 独立子工程：`frontend-v3/`
  - 独立入口：`/v3`
  - 独立产物：`dist/dashboard-v3`
  - 只复用 API / SSE 契约，不复用 `frontend/` 里的业务 UI 文件
- `v3` 当前信息架构规则：
  - `skills` 页首屏必须先进入 `技能工作台`，不允许再把项目 hero / metric cards 放在技能表之前
  - `skills` 页必须保持稳定框架：`sticky header -> hero band -> scope/table/insight grid`
  - `skills` 页的分页、滚动、搜索和行选择必须收敛在中心 table workbench 内，不再散落到多个碎片卡片
  - `projects` 页才承载项目摘要、daemon 状态和 summary-heavy chrome
  - `activity` 页聚焦 trace / decision event，不复用项目总览 chrome
  - `config` 页必须作为一级工作区长期保留，不能再因为布局清理被隐式并回默认视图
  - `config` 页只承载全局 provider / safety / prompt 治理，不混入项目摘要 chrome
  - 项目在 `skills` 页里只作为 scope/filter，不作为主叙事对象

结论：**这份文档保留 V2 迁移记录，但当前真正的 clean-slate 前端重写已经进入 V3。**

## 1. Refactor Boundary

- 本次边界是 **dashboard 的独立 v2 入口**，不是整站一次性重写
- 旧入口继续保留：
  - HTML: `/`
  - 静态资源: `/assets/dashboard.*`
- 新入口独立存在：
  - HTML: `/v2`
  - 静态资源: `/v2/assets/*`
- 数据层暂时复用现有能力：
  - `GET /api/projects`
  - `GET /api/projects/:id/snapshot`
  - `GET /events`

## 2. Legacy Contamination Map

### 2.1 旧前端的污染源

- `src/dashboard/ui.ts`
  - 把 HTML shell、CSS、运行时脚本、各子模块源码都拼在一条字符串链里
- `src/dashboard/web/styles.ts`
  - 全局样式集中堆叠，类名大量复用 `card / modal / btn / project-* / skill-*`
- `src/dashboard/web/main-panel/source.ts`
  - 主面板通过 `innerHTML` 全量重绘，DOM 结构和视觉表达紧耦合
- `src/dashboard/web/skills/source.ts`
  - 单文件过大，既管数据加载、状态恢复，又直接拼 UI 片段

### 2.2 旧结构带来的迁移阻力

- 旧 UI 没有可靠的组件边界，只有字符串片段边界
- 旧样式不是 scoped styles，而是整个 dashboard 的共享污染域
- 旧视图依赖 `innerHTML` 重建，不适合直接接入 shadcn 组件树
- 旧构建产物来自 Node 侧内联拼装，不是独立前端资产管线

## 3. Recommended Isolation Strategy

### 3.1 选择

- **主隔离层**：独立子工程 `frontend/`
- **入口隔离**：独立路由 `/v2`
- **资产隔离**：独立构建输出 `dist/dashboard-v2`
- **组件隔离**：React 组件树 + `@/components/ui/*`

### 3.2 为什么这样足够

- 旧 UI 与新 UI 不再共享 HTML 模板
- 旧 UI 与新 UI 不再共享 CSS 文件
- 旧 UI 与新 UI 不再共享 JS 运行时和 DOM 重绘策略
- 新 UI 只复用 API 契约，不复用旧展示实现

### 3.3 这层隔离还没有解决什么

- API contract 仍然沿用旧 snapshot 结构，字段粒度偏粗
- `Skill 视角 / 项目视角 / 活动视角` 已拆成独立 route，但还只是只读工作台
- 成本、配置、编辑器等高交互页面尚未迁入 v2

## 4. View Rewrite Decision

- **复用**
  - 项目列表 API
  - snapshot API
  - SSE 变更通知
  - 现有日志/错误上报接口
- **重写**
  - 页面结构
  - 视觉系统
  - 组件层
  - 导航与布局
  - 状态组织方式

结论：**保留数据事实来源，重建表示层。**

## 5. V2 Structure And Naming Plan

## 5.1 当前目录

```text
frontend/
  components.json
  src/
    components/
      ui/
        badge.tsx
        button.tsx
        card.tsx
        dialog.tsx
        table.tsx
        tabs.tsx
      activity-feed.tsx
      dashboard-view-panels.tsx
      model-usage-panel.tsx
      project-overview-hero.tsx
      project-sidebar.tsx
      skill-detail-dialog.tsx
      skill-inventory.tsx
    features/
      dashboard/
        use-dashboard-workspace.ts
        workspace-state.ts
    lib/
      dashboard-client.ts
      formatters.ts
      utils.ts
    styles/
      globals.css
    types/
      dashboard.ts
```

## 5.2 当前设计系统底座

- 技术栈
  - React
  - Vite
  - Tailwind CSS v4
  - `@radix-ui/react-slot`
  - `class-variance-authority`
  - `clsx`
  - `tailwind-merge`
  - `lucide-react`
- 已落地核心件
  - `Button`
  - `Badge`
  - `Card`
- 已落地项目配置
  - `components.json`
  - Tailwind v4 样式入口 `src/styles/globals.css`
  - `@/` alias
  - 当前 preset: `b4NKaHect`
  - 当前 style: `radix-vega`
  - 当前 icon library: `hugeicons`

## 5.2.1 新增实现约束

- **90% 以上的可见 UI 必须直接复用 shadcn 的成熟组件或其标准组合方式**
- 默认优先级：
  1. 现成 shadcn 组件
  2. shadcn 组件组合
  3. 仅在缺失明确领域能力时，才允许少量自定义壳层
- 允许自定义的范围应尽量收敛在：
  - OrnnSkills 领域容器，例如 `ProjectOverviewHero` 这类业务编排层
  - 后端数据适配层
  - 少量主题 token 与布局容器
- 不允许继续扩张的方向：
  - 为了视觉差异重新手写一套 Button / Badge / Card / Table / Dialog
  - 用纯自定义 div 结构替代 shadcn 已有的成熟交互组件
  - 把“设计感”建立在脱离 shadcn 体系的私有组件库上

结论：**v2 的设计表达可以有 OrnnSkills 自己的产品感，但主要通过 preset、token、布局和组件编排实现，而不是绕开 shadcn 另起炉灶。**

## 5.3 后续 shadcn 迁移顺序

1. `table`
2. `tabs`
3. `dialog`
4. `sheet`
5. `select`
6. `tooltip`

优先迁移原因：

- 这 6 类是 `技能 / 项目 / 活动 / 配置` 四大页面的共用骨架
- 先统一基础件，后面迁页面时不会再回头改一遍视觉契约

## 6. Tool Readiness

### 6.1 shadcn MCP

- 本机 Codex 配置已存在 `shadcn` MCP
- 本次核验结果：
  - `codex mcp list` -> `shadcn enabled`
  - `codex mcp get shadcn` -> 条目可读
  - `npx shadcn@latest mcp --help` -> 可执行

### 6.2 shadcn skill

- 本机磁盘上存在 `~/.agents/skills/shadcn/SKILL.md`
- 但它 **不在当前会话显式暴露的 skill inventory 中**
- 结论：
  - 可以确认本机有 shadcn 相关 skill 文件
  - 但本轮实现不依赖它作为“当前会话保证可用的 skill”
  - 当前已通过 shadcn CLI 自检补足可用性验证

### 6.3 frontend 项目当前自检

- `npx shadcn@latest info --json --cwd frontend` 已成功输出：
  - framework: `Vite`
  - tailwindVersion: `v4`
  - importAlias: `@`
  - components: `button / badge / card`

## 7. Migration And Cutover Sequence

### Phase 0: Boundary

- 完成 `frontend/` 子工程
- 完成 `/v2` 独立入口
- 完成独立静态资源输出

### Phase 1: Read-Only Workbench

- 先迁只读主看板
  - 项目列表
  - 总览 hero
  - skill inventory
  - activity feed
  - model usage
- 拆出 `/v2/projects`、`/v2/skills`、`/v2/activity`
- 建立前端状态层，避免继续把 SSE、路由、快照缓存堆进单个 `App.tsx`

### Phase 2: Shared Controls

- 引入并稳定：
  - `table` ✅
  - `tabs` ✅
  - `dialog` ✅
  - `sheet`
  - `select`
- 目标：让 v2 的大部分可见交互先落入 shadcn 的成熟组件覆盖面，再继续迁页面

### Phase 3: High-Interaction Pages

- 迁移 `技能` 详情和版本历史
- 迁移 `活动` 详情
- 迁移 `配置` 子页

### Phase 4: Default Route Switch

- 当 v2 覆盖主工作流后，再评估是否把 `/` 默认切到 v2
- 切换前必须保留 v1 fallback 窗口

## 8. Verification And Deletion Gates

### 8.1 当前已完成验证

- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`
- `npm run typecheck`
- `npx vitest run tests/unit/dashboard-v2-assets.test.ts tests/unit/dashboard-server.test.ts`
- `npx vitest run tests/unit/dashboard-v2-workspace-state.test.ts tests/unit/dashboard-server.test.ts`
- 实际 HTTP 冒烟：
  - `/v2` -> `200`
  - `/v2/skills` -> `200`
  - `X-Dashboard-V2: built`
  - `/v2/assets/*` -> `200`

### 8.2 删除旧代码前必须满足

- v2 覆盖 `技能 / 项目 / 活动 / 配置` 主路径
- v2 不再依赖旧 DOM 或旧 CSS 类名
- v2 的页面状态恢复、SSE 更新、自定义编辑器交互都完成回归
- 有明确的旧依赖清单：
  - 哪些 `renderDashboard*Source()` 不再需要
  - 哪些 `styles.ts` 规则已无消费者
  - 哪些 `innerHTML` 视图块可以删

### 8.3 本阶段禁止做的事

- 禁止把新 UI 再塞回 `src/dashboard/ui.ts` 的字符串拼装链
- 禁止新增依赖旧 `card / modal / btn` 类名的 v2 样式
- 禁止默认切换 `/` 到 v2
- 禁止先删 v1 再补 v2
