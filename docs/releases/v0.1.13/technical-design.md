# OrnnSkills v0.1.13 Technical Design

- App/Product Version: `0.1.13`
- Status: released
- Version PRD: `docs/releases/v0.1.13/prd.md`
- Version Source: `package.json`（version: 0.1.13）、git tag `v0.1.13`
- Created: 2026-08-09

## 1. Design Goal

本技术设计派生自 `docs/releases/v0.1.13/prd.md`，描述 v0.1.13 发布时的实际实现架构，不得重定义 v0.1.13 产品范围或完成定义。v0.1.13 发布后新增的代码（演化合同层、dashboard 演化工作台）不在此描述，归 v0.2.0 技术设计。

## 2. Non-goals

- 不描述演化写侧闭环（proposal-first、change plan、部署策略、后验验证）的实现——本版本仅含合同层雏形
- 不描述多 Agent / 云端架构
- 不描述已下线的 V1 / V2 dashboard 结构

## 3. Architecture

整体为本地守护进程 + dashboard 读模型 + 独立前端子工程：

```text
CLI (src/cli/)               <- ornn 命令入口（status/diff/freeze/rollback/sync/daemon/config/logs...）
Daemon (src/daemon/)         <- 生命周期与运行时接管
  ├── ProjectRuntimeRegistry  <- 注册表事实来源（1s 轮询同步）
  ├── RetryQueue              <- 失败重试
  ├── CheckpointService       <- trace 处理进度持久化
  └── DaemonLifecycle         <- daemon 启动/停止/空注册表兜底

Observer (src/core/observer/) <- 各宿主 session 文件监听（Codex/Claude/OpenCode）
  └── 增量读取 + 启动回放 + reconciliation，产出标准化 trace

ShadowManager (src/core/shadow-manager/)  <- 演化主链路 facade
  ├── TraceIngestService       <- trace 归属与窗口维护
  ├── EpisodeProbeService      <- episode 就绪探测（task-episode）
  ├── OptimizationRunner       <- 分析 -> patch -> 版本落盘
  └── ManualOptimizeService    <- dashboard 手动优化入口

支撑模块 (src/core/)
  ├── analyze-skill-window / skill-call-analyzer / window-analysis-coordinator
  ├── task-episode / task-episode-policy
  ├── patch-generator / optimization-executor / optimization-eligibility
  ├── skill-version            <- 版本快照、latest symlink、effective version、mute/restore
  ├── skill-deployer           <- 部署到宿主目录
  ├── journal / decision-events / activity-event-builder
  ├── trace-store / trace-skill-mapper / trace-summary
  ├── evolution                <- 演化合同层（domain/events/state-machine/projection/workflow/policy/verification）
  └── legacy：skill-evolution / pipeline / readiness-probe（标注 legacy/to_migrate/to_remove）

存储 (src/storage/)
  ├── sqlite/                  <- 共享 DB adapter + 各 repo（session/shadow/origin/trace-mapping）
  ├── ndjson.ts / markdown.ts
  └── config (src/config/)     <- 全局 settings.toml、env-file、provider-connectivity、prompt-overrides

Dashboard (src/dashboard/)     <- daemon 内嵌服务
  ├── server.ts + routes/*     <- 项目读路由、版本路由、配置路由、演化 lifecycle API
  ├── readers/*                <- 各读模型（skills/trace/decision-events/agent-usage/daemon-status）
  ├── sse/hub                  <- 事件流：推变更信号，按需拉快照
  ├── services/*               <- onboarding、skill-version、日志流
  └── web/ (v1 字符串式，已下线) / v2/ / v3/

前端 (frontend-v3/)            <- 唯一生效前端，构建产物 dist/dashboard-v3
  ├── React + Vite + Tailwind v4 + shadcn（radix-vega seed）
  ├── 路由：/v3/skills | /v3/project | /v3/config
  ├── 状态层：features/dashboard/*  hooks + 模块级缓存（stale-while-revalidate）
  └── Storybook + addon-vitest + Chromatic 质量门
```

## 4. Data And State Model

- `SkillFamily / SkillInstance / SkillRevision`：family 列表、实例（项目+宿主+路径）、版本历史（编号 + effective 分离）
- `TaskEpisode`：观察窗口（`task-episodes.json`：累计计数 + 有界热窗口，不做全量持久化）
- `DecisionEventRecord`：canonical 业务语义事件（businessCategory / judgment / nextAction），NDJSON 落盘
- `VersionMetadata`：版本号、时间戳、activityScopeId、muted 状态；`latest` symlink 指向最新有效版本
- 全局配置：`~/.ornn/config/settings.toml`，兼容项目级旧路径自动迁移
- SQLite：session / shadow / origin / trace-mapping；journal（trace-journal、shadow-history）

## 5. Core Flows

1. **trace 采集**：observer 按字节偏移增量读 session 文件，启动时回放尾部 + reconciliation 补偿；跳过 transport/维护型事件
2. **episode 分析**：recent batch -> full session timeline -> session-backed window candidate；`session-window-candidates` 只对 recentTraces 命中 trace 建候选
3. **优化执行**：analyzer（LiteLLM）-> evaluation（严格校验 should_patch + change_type）-> patch-generator 按 change_type 策略生成 -> optimization-runner 写 shadow、创建版本快照、落决策事件
4. **版本操作**：创建快照更新 `latest`；mute 后 `findLatestEnabledVersionNumber()` 重算 effective 并更新 symlink；restore 重新进入生效链路
5. **dashboard 读侧**：SSE 推送 projects/logs/changedProjects 变更信号；前端按需拉 `/snapshot` 与详情；模块级缓存避免 tab 切换回首屏
6. **配置**：自动保存、bootstrap cache 写入 localStorage；子 tab 隐藏分区从 state 回退，避免清空离屏字段

## 6. Platform Or Integration Design

- 宿主集成：Codex / Claude / OpenCode session 文件观察，统一 trace 协议
- LLM：LiteLLM 网关 + provider catalog + 连通性检查 + request-guard / token-tracker
- 全局 daemon 以注册表为事实来源，dashboard 内嵌于 daemon 进程

## 7. UI Or Interface Modules

- `frontend-v3`：WorkspaceHeader / ProjectRail / SkillFamilyList / SkillFamilyDetail / SkillsTable / SkillContentEditor / SkillVersionHistory / SkillVersionDiffViewer / SkillDetailDialog / ProjectWorkbench / ConfigProviderStack / ConfigGovernancePanel / EvolutionWorkspace
- Storybook 故事状态导向，play 交互覆盖关键 Pattern

## 8. Version And Release Integration

- 版本号由 standard-version 从 conventional commits 自动生成（0.1.12 -> 0.1.13）
- 发布物：`npm run build`（tsc + frontend-v3 build）-> `npm install -g .` -> daemon 重启
- 版本文档三件套：见 `docs/releases/README.md`

## 9. Privacy, Permissions, And Logging

- 全局日志统一走 Winston 轮转（combined.log* / error.log*），读侧按"逻辑日志流"聚合
- 日志不记录 API Key；LLM 请求经 request-guard 约束
- dashboard 不暴露 build/pid 等运行时元数据给主界面

## 10. Test Strategy

- Vitest 单测（unit）+ Storybook component/a11y 测试（addon-vitest）+ Chromatic 视觉基线
- 契约测试：dashboard-v3-*-contract 系列（layout/skills/project/config/cost/market）锁定可见合同
- 读模型快照测试（dashboard-skill-evaluation-count 等）
- 基准：scripts/benchmarks/dashboard-readers.ts（smoke/assert/soak/stress）
- 运行时冒烟：tests/runtime/dashboard-v3-runtime-smoke.ts
- 发布门禁：`npm run test:smoke`、`npm run test:regression`、`git diff --check`

## 11. Implementation Order

v0.1.13 为已发布版本，本节约束维护期行为：不得在本版本文档中新增未发布变更的描述；新增功能进入 v0.2.0 三件套。

## 12. Risks

| 风险 | 现状 |
|---|---|
| 演化主链路与合同层脱节 | 已确认：ShadowManager 未引用 evolution 模块，v0.2.0 需决策写侧接入 |
| CI 状态 | v0.1.13 发布时 CI 绿；2026-05-14 起的演化 dashboard 提交在 Lint 阶段失败，main 分支当前 CI 红（见 v0.2.0 需求清单） |
| 本地验证 | 当前工作区 `node_modules` 缺失，需 `npm install` 后恢复测试基线 |

## 13. Open Questions

- v0.2.0 是否接入演化写侧（proposal-first / change plan / 部署策略 / 验证闭环）？
- vs_review 记录的 17 项架构发现如何处理？
