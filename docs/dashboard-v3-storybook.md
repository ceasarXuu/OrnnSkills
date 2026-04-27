# Dashboard V3 Storybook

## Purpose

`frontend-v3` 的 Storybook 不是零散 demo 集合，而是 dashboard v3 的隔离开发、交互验证、文档评审和回归基线。

执行原则：

- story 直接复用业务组件，不接真实后端
- `preview` 统一承接路由、Frame、a11y、controls、actions 和排序
- stories 只表达用户可见状态和关键交互
- 关键 Pattern story 必须有 `play`

## Story Map

| Sidebar | Layer | Stories | Notes |
|---|---|---|---|
| `Dashboard V3/Shell/WorkspaceHeader` | Pattern | `Skills`, `Project`, `Config` | 顶部导航壳层 |
| `Dashboard V3/Skills/SkillFamilyList` | Pattern | `Default`, `SearchAndSelect`, `Loading`, `Empty` | 技能库左侧 rail，含搜索与选中 |
| `Dashboard V3/Skills/SkillFamilyDetail` | Screen | `Default`, `FilteredBySelectors`, `VersionDiff`, `EmptySelection`, `Loading` | 技能视角主工作区 |
| `Dashboard V3/Skills/SkillContentEditor` | Pattern | `Default`, `WithApplyPreview`, `DiffMode`, `Error` | 正文编辑、传播预览与版本 diff |
| `Dashboard V3/Skills/SkillVersionHistory` | Pattern | `Default`, `Comparing`, `Empty` | 版本选择与 diff 入口 |
| `Dashboard V3/Project/ProjectRail` | Pattern | `Default`, `SearchAndSelect`, `Loading`, `Empty` | 项目 rail，内部自带搜索 |
| `Dashboard V3/Project/SkillsTable` | Pattern | `Default`, `SearchAndSelect`, `Paginate`, `Loading`, `Empty` | 项目视角技能表格 |
| `Dashboard V3/Config/ConfigProviderRow` | Primitive | `Default`, `ApiKeyVisible`, `Checking` | 单 provider 行 |
| `Dashboard V3/Config/ConfigProviderStack` | Pattern | `Default`, `LoadingCatalog`, `EmptyProviders` | provider 列表与安全配置 |
| `Dashboard V3/Config/ConfigPromptEditor` | Pattern | `BuiltIn`, `Custom`, `SwitchToCustom` | 单 prompt 段落编辑 |
| `Dashboard V3/Config/ConfigGovernancePanel` | Pattern | `Default`, `AllCustom` | prompt 配置组合面板 |
| `Dashboard V3/Overlay/SkillDetailDialog` | Pattern | `Open`, `Empty` | 浮层详情 |

## Global Strategy

- 全局样式：`frontend-v3/.storybook/preview.tsx` 引入 `globals.css`
- 全局路由：所有 story 默认包裹 `MemoryRouter`
- 全局画布：所有 story 默认包裹 `DashboardStoryFrame`
- a11y：统一 `a11y.test = error`
- 测试执行：`@storybook/addon-vitest` + Vitest browser mode + Playwright Chromium
- 视觉基线：Chromatic workflow 负责 PR / main 分支视觉回归
- Actions：统一匹配 `^on[A-Z].*`
- Controls：默认展开，优先 required args
- 排序：`Shell -> Skills -> Project -> Config -> Overlay`

## Quality Gates

每次 Storybook 结构变更至少执行：

```bash
npx vitest run tests/unit/dashboard-v3-storybook.test.ts
npm --prefix frontend-v3 run typecheck
npm run test:storybook:dashboard-v3
npm run build:storybook:dashboard-v3
```

回到业务完整性时再补：

```bash
npm run build
```

CI 中对应两条自动门禁：

- `.github/workflows/ci.yml` 运行 Storybook component + a11y tests
- `.github/workflows/chromatic.yml` 运行 Chromatic visual baseline

## Visual Baseline

- 视觉基线接入方式：`chromaui/action`
- 工作目录：`frontend-v3`
- 认证方式：GitHub Actions secret `CHROMATIC_PROJECT_TOKEN`
- 本地手动触发命令：`npm run chromatic:dashboard-v3`

首次启用前，需要在仓库 Actions secrets 中配置：

```text
CHROMATIC_PROJECT_TOKEN
```

未配置 token 时，Chromatic workflow 会跳过，不会阻塞普通 CI。

## Definition Of Done

- 用户可见组件变化必须带 story 变更
- 新增交互型 Pattern 组件时，优先补 `play`
- 稳定 story 必须保持 `stable` tag，进入 Storybook test 与视觉基线
- 不为纯路由 wrapper 或 pass-through shell 单独建 story
- 不在 story 中接真实 API、真实登录态、真实本地数据
