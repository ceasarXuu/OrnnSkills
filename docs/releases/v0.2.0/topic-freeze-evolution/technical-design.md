# 冻结演化功能 Technical Design

- App/Product Version: `0.2.0`（计划中，未发布）
- Status: draft
- Version PRD: `docs/releases/v0.2.0/topic-freeze-evolution/prd.md`
- Version Source: `package.json`（当前 0.1.13）
- Created: 2026-08-09

## 1. Design Goal

本技术设计派生自 `docs/releases/v0.2.0/topic-freeze-evolution/prd.md`：冻结演化功能（自动分析/优化/patch/版本/部署不再生效，相关 UI 隐藏），并沉淀第一步盘点结果。不得重定义主题范围。

## 2. Non-goals

- 不删除或重写演化代码（临时冻结，可逆）
- 不冻结 trace 采集、技能索引、版本读取/停用、配置编辑
- 不设计演化闭环的替代方案

## 3. 盘点：演化功能现状（第一步交付物）

### 3.1 演化写链路（生产主链路，src/core/shadow-manager/）

| 模块 | 职责 | 冻结相关 |
|---|---|---|
| `ShadowManager`（index.ts） | 主链路 facade，`processTrace()` 入口（:135）；`init()`（:122）内执行 bootstrap 物化 | 触发链起点；**D5：init 冻结时跳过 bootstrap** |
| `ShadowTraceIngestService`（trace-ingest-service.ts） | trace 归属、窗口维护、episode 构建 | 只采集不执行，可保留 |
| `ShadowEpisodeProbeService`（episode-probe-service.ts） | episode 就绪探测，就绪后调用 runner | **冻结点候选** |
| `ShadowOptimizationRunner`（optimization-runner.ts） | analyzer -> eligibility(:57) -> patch -> 版本 -> 事件 | **冻结点候选** |
| `ShadowManualOptimizeService`（manual-optimize-service.ts） | 手动优化服务 | **无外部调用方**（死代码，盘点确认：仅 shadow-manager 内部构造，无 CLI/dashboard 入口） |

### 3.2 支撑模块（src/core/，被写链路消费）

| 模块 | 作用 |
|---|---|
| `analyzer/`、`analyze-skill-window/`、`skill-call-analyzer/`、`skill-call-window/` | 窗口分析与 LLM 分析 |
| `window-analysis-coordinator/`、`session-window-candidates/` | 窗口恢复与协调 |
| `patch-generator/`、`optimization-executor/`、`optimization-eligibility/` | patch 生成 / 执行 / 门禁（min_confidence、cooldown 等） |
| `evaluator/`、`decision-explainer/` | 评估与解释 |
| `task-episode/`、`task-episode-policy/` | episode 状态机 |
| `journal/`、`decision-events/`、`activity-event-builder/` | 事件与历史落盘 |
| `skill-version/`、`skill-deployer/`、`shadow-registry/` | 版本、部署、shadow 存储（版本写入/部署为演化副作用） |
| 遗留：`skill-evolution/`、`pipeline/`、`readiness-probe/`、`phase2/4-integration.ts` | 未接入主链路的遗留代码 |

### 3.3 生效路径（daemon -> 演化）

```text
Observer（src/core/observer/）采集 trace
  -> Daemon（src/daemon/）ProjectRuntimeRegistry.ensureProjectRuntime()
  -> ShadowManager.processTrace()（shadow-manager/index.ts:135）
  -> ShadowTraceIngestService
  -> ShadowEpisodeProbeService（episode 就绪判定）
  -> ShadowOptimizationRunner（eligibility 门禁 -> analyzer -> patch -> 版本 -> 部署）
```

自动触发链确认：`processTrace -> traceIngest -> episodeProbe -> optimizationRunner`（index.ts:42-103 构造、:135 processTrace）。

### 3.4 UI 入口盘点（frontend-v3，v0.1.13 状态）

| 位置 | 现状 | 冻结动作 |
|---|---|---|
| 配置页「演进策略」子 tab（config-workspace.tsx:81） | 仅提示词配置（prompt source/override，config-prompt-editor.tsx） | **隐藏整个子 tab** |
| 技能库展示（/v3/skills，family/instance 数据源为影子投影） | 影子数据展示（SkillsWorkspace） | **D5：冻结时渲染冻结空态**（`/api/skills/families` 返回 `{families:[], frozen:true}`，前端不渲染技能内容） |
| `activityScopes` / `decisionEvents` 快照字段（types/dashboard.ts） | 仅类型定义，无组件消费（演化工作区此前已随升级回滚移除） | 无需动作（无渲染入口），读路由保留 |
| 技能详情 / 项目工作台 | 无演化入口（project-workbench 无演化 tab） | 无需动作 |
| 手动优化 API | **不存在**（project-skill-routes.ts 等无 optimize POST） | 无需动作 |
| 版本停用/恢复（skill-version-history.tsx） | 属于版本管理而非演化执行 | **保留**（非冻结范围） |

### 3.5 配置现状（冻结相关）

| 配置 | 位置 | 现状 |
|---|---|---|
| `tracking.auto_optimize`（默认 true） | src/config/dashboard-config.ts:87 等 | **主链路不消费**（shadow-manager / eligibility / runner 均未读取）——冻结不能依赖此失效配置 |
| `tracking.user_confirm` / `runtime_sync` | dashboard-config.ts | 同样仅配置层存在 |
| 配置 UI | use-dashboard-v3-config.ts:149 处理三字段 | 组件未渲染这些开关（v0.1.13 配置页只有模型 + 提示词） |

## 4. 冻结设计（草案）

### 4.1 冻结开关

新增真实门禁配置 `tracking.evolution_frozen`，**默认 `true`（默认关闭演化功能，D4，2026-08-09 用户确认）**，写入 `~/.ornn/config/settings.toml`：

```toml
[tracking]
evolution_frozen = true   # 默认 true：演化功能默认关闭；置 false 解除冻结
```

### 4.2 写侧冻结点

单点短路，选 **ShadowEpisodeProbeService 触发 runner 前** 与 **ShadowOptimizationRunner 入口** 双保险：

- `episode-probe-service`：episode 就绪判定通过后、调用 runner 前，读取冻结开关，冻结则记录 `evolution_frozen` 决策事件并跳过
- `optimization-runner`：入口处同样检查，冻结则直接返回 skip（防御未来旁路）

冻结时**不中断**已开始的执行（避免半成品版本）：判定放执行链最前，天然不产生新执行。

### 4.3 UI 隐藏

- config-workspace「演进策略」tab 隐藏（TabsTrigger 不渲染，TabsList 只保留「模型」）
- 技能库展示隐藏（D5）：`/api/skills/families` 冻结时返回 `{ families: [], frozen: true }`；前端 SkillsWorkspace 渲染冻结空态（`readEvolutionFrozenSync` 同步读 `~/.ornn/config/settings.toml`，缺省冻结）
- 冻结开关本身不暴露 UI（由配置文件维护，避免用户在 dashboard 误操作解冻；如需 UI 需另行决策）
- 未来新增演化入口的评审规则：属于演化能力则默认不渲染

### 4.5 影子物化冻结（D5）

- `ShadowManager.init()` 冻结时跳过 `bootstrapSkillsForMonitoring`（不扫描、不复制、不建 index 条目、不创建初始版本）
- 解冻后重启 daemon → init 重新执行 bootstrap → 自动补物化（幂等，无状态迁移）

### 4.4 恢复

`evolution_frozen = false` 即恢复冻结前行为；无状态迁移。

## 5. Data And State Model

无新增持久化；冻结期间仅可能产生 `evolution_frozen` 决策事件（写侧观测），不产生 patch / 版本 / 部署。

## 6. Core Flows

- 冻结：trace -> ingest -> episode 就绪 -> **冻结检查（跳过）** -> 结束
- 恢复：配置回切 -> 原链路恢复

## 7. UI Or Interface Modules

- `frontend-v3/src/components/config-workspace.tsx`：隐藏「演进策略」tab
- 其余组件零改动

## 8. Version And Release Integration

- 冻结作为 v0.2.0 首批变更，随 v0.2.0 发布
- 涉及配置 schema 变更时，保持旧配置兼容（缺失字段按默认 false 处理）

## 9. Privacy, Permissions, And Logging

- 冻结/解冻动作记录日志与决策事件（可审计）
- 冻结后 skip 路径以 debug 级日志记录，避免噪音

## 10. Test Strategy

- 单测：冻结开关开启时 episode 就绪不触发 runner；runner 入口冻结短路；恢复后行为不变
- 回归：现有 shadow-manager 测试在冻结关闭（默认）下全部保持通过
- 契约测试：config-workspace 冻结态不渲染「演进策略」tab
- 门禁：`npm run test:smoke`

## 11. Implementation Order

1. 盘点（本设计 §3，已完成）
2. 冻结开关配置（settings.toml + dashboard-config schema + 兼容默认）
3. episode-probe / runner 短路 + 单测
4. config-workspace tab 隐藏 + 契约测试
5. 回归验证（冻结态 24h 零副作用 / 恢复即时生效）

## 12. Risks

| 风险 | 对策 |
|---|---|
| 遗漏旁路导致冻结不彻底 | 双保险短路 + 盘点清单回归验证 |
| 冻结误伤 trace 采集/索引 | 冻结点严格限定在 runner 触发处，采集链路不动 |
| `auto_optimize` 误导（已失效配置） | 文档显式标注，冻结实现用新配置，不依赖旧字段 |
| 进行中执行残留 | 冻结判定在执行链最前，不中断已开始执行 |

## 13. Open Questions

- 是否暴露解冻 UI（当前建议仅配置文件维护，plan.md P2 挂起）
- 冻结期间进行中执行的处理（当前建议不中断，plan.md P3 挂起）
- 历史演化数据展示（当前建议读侧保留，plan.md P4 挂起）
