# OrnnSkills 演化能力架构升级计划

> 最后更新：2026-05-13

## 1. 目标

演化能力是 OrnnSkills V2.0 的一等公民。本计划的目标不是重写现有系统，而是在保留当前 shadow、trace、journal、snapshot、version 和 dashboard 读模型基础上，把演化能力从一条隐式副作用流水线升级为清晰、可审计、可暂停、可回滚、可验证的产品级 workflow。

目标链路:

```text
Trace
  -> EvolutionEpisode
  -> EvolutionAnalysis
  -> EvolutionProposal
  -> Apply
  -> Deploy
  -> Verify
  -> Revision Outcome
```

升级后的系统必须回答以下问题:

- 为什么这个 skill 值得演化？
- 证据来自哪些 trace、session、episode？
- 系统建议改哪里、怎么改、风险是什么？
- 变更是否已经写入 shadow、创建版本、部署到宿主？
- 后续调用是否证明这次演化变好了？
- 如果变差，如何安全回滚或冻结？

## 2. 当前架构判断

当前生产主链路实际是:

```text
Observer
  -> Daemon
  -> ProjectRuntimeRegistry
  -> ShadowManager
  -> TaskEpisode
  -> SkillCallAnalyzer
  -> OptimizationRunner
  -> PatchGenerator
  -> Journal / Version / Decision Events
```

当前混合使用了以下架构风格:

- 事件驱动: trace 进入系统后触发窗口聚合、分析、patch、事件落盘。
- Shadow copy: 对项目级 shadow skill 演进，避免直接污染 origin skill。
- Strategy pattern: patch 根据 `change_type` 选择不同生成策略。
- CQRS 雏形: 写侧落 decision events、journal、versions；dashboard 读侧再聚合展示。
- 手写 workflow: `ShadowManager` 串联分析、准入、patch、版本、事件、checkpoint。

这些方向基本正确，但还没有形成以演化为核心的明确领域边界。

### 2.1 当前优点

- 本地优先和可回滚方向正确，shadow / journal / snapshot / version 构成了安全基线。
- 证据链意识较强，trace window、decision event、agent usage、version metadata 都在沉淀。
- `ShadowManager` 已从巨型类收敛为 facade，并拆出 trace ingest、episode probe、manual optimize、optimization runner。
- 有基本准入保护，包括 confidence、cooldown、daily limit、frozen。
- 使用 episode window 而不是单 trace 判断，能降低一次性失败导致误优化的概率。

### 2.2 当前问题

- 演化领域模型不够一等公民。核心概念仍散落在 `shadowId`、`task-episodes.json`、`decision-events.ndjson`、journal、version metadata 中。
- 主链路和遗留链路并存。`ShadowManager` 是真实主链路，但 `SkillEvolutionManager`、`OptimizationPipeline`、部分 readiness probe 代码仍保留，容易误导后续设计。
- workflow 状态机不显式。系统缺少 `proposed`、`approved`、`deployed`、`verified`、`regressed` 等产品状态。
- 配置语义和主链路不完全一致。`auto_optimize`、`user_confirm`、`runtime_sync`、`min_signal_count`、`min_source_sessions` 等配置需要成为真实门禁，而不是只存在于配置文件或 UI。
- patch 层偏字符串模板。长期演化容易出现重复段落、错误 section 定位、上下文污染。
- 缺少后验验证闭环。当前能记录 patch 已应用，但还不能把后续调用效果明确归因到某个 revision。

## 3. 目标架构风格

建议目标架构采用:

**Hexagonal Architecture + DDD Aggregate + Event-sourced Workflow/Saga + CQRS Projection**

### 3.1 领域对象

新增或显式化以下领域对象:

| 对象 | 含义 |
|---|---|
| `SkillFamily` | 用户认知中的同一个 skill |
| `SkillInstance` | 某项目、某宿主、某安装路径中的 skill 副本 |
| `SkillRevision` | 某个实例的修订历史 |
| `EvolutionEpisode` | 围绕某个 skill 的观察窗口 |
| `EvolutionRun` | 一次完整分析或执行尝试 |
| `EvolutionProposal` | 分析产生的可执行演化建议 |
| `EvolutionApplication` | proposal 被应用后的结果 |
| `EvolutionVerification` | 后续 trace 对某次 revision 的效果验证 |

### 3.2 应用服务

目标服务边界:

| 服务 | 职责 |
|---|---|
| `TraceIngestionService` | 接收 trace，标准化并归属到项目和宿主 |
| `EvolutionWindowService` | 维护 episode、窗口、触发条件 |
| `EvolutionAnalysisService` | 调用 analyzer，产出结构化分析结果 |
| `EvolutionProposalService` | 校验分析结果并生成 proposal |
| `EvolutionApplyService` | 生成 change plan、diff、写入 shadow、创建 revision |
| `EvolutionDeploymentService` | 按 `runtime_sync` 策略部署到宿主目录 |
| `EvolutionVerificationService` | 从后续窗口验证 revision 效果 |
| `EvolutionProjectionService` | 为 dashboard 生成稳定读模型 |

### 3.3 Ports 与 Adapters

核心 ports:

- `TraceSourcePort`
- `SkillStorePort`
- `AnalyzerPort`
- `PatchPlannerPort`
- `PatchApplierPort`
- `VersionStorePort`
- `DeploymentPort`
- `EventStorePort`
- `ProjectionStorePort`

当前实现可作为 adapters 继续复用:

- Codex / Claude / OpenCode observer
- LiteLLM analyzer
- local filesystem skill store
- SQLite / NDJSON event store
- dashboard projection readers

## 4. 分阶段升级计划

### Phase 0: 架构盘点与边界冻结

目标: 确认唯一生产主链路，停止继续扩张遗留演化入口。

工作项:

- 明确 `ShadowManager` 是当前唯一在线演化入口。
- 为 `src/core/skill-evolution/*`、`src/core/pipeline/index.ts`、未接入主链路的 readiness probe 代码建立状态标注: `legacy`、`to_migrate` 或 `to_remove`。
- 梳理 daemon 到 shadow 演化的真实调用链，形成架构图。
- 增加架构守护测试，确保 daemon 主链路只通过统一 facade 进入演化系统。

验收标准:

- 文档能明确回答 trace 进入后由哪个模块负责演化。
- 不再有两个并行模块都被称为主 evolution engine。
- 遗留模块有迁移或删除计划。

执行状态:

| 模块 | 状态 | 当前决策 |
|---|---|---|
| `src/core/shadow-manager/index.ts` | `production` | 当前唯一在线演化入口。daemon 通过 `ProjectRuntimeRegistry` 创建 `ShadowManager`，trace 处理继续由该 facade 串联 episode、analysis、patch、version 和 decision event。 |
| `src/core/skill-evolution/index.ts` | `legacy` | 作为历史演化管理器和迁移参考保留，禁止继续扩张为第二条生产主链路。后续只迁移可复用 contract。 |
| `src/core/pipeline/index.ts` | `to_migrate` | 抽取仍有价值的 workflow/pipeline 概念后，避免与 `ShadowManager` 形成并行编排。 |
| `src/core/readiness-probe/index.ts` | `to_remove` | 未接入当前 daemon 生产链路。确认 dashboard 和迁移流程无依赖后移除。 |

守护机制:

- `src/core/evolution/architecture-status.ts` 声明生产入口、真实调用链和遗留模块状态。
- `tests/unit/evolution-architecture.test.ts` 锁定 daemon 生产代码不得导入遗留演化引擎，并验证项目运行时必须通过 `ShadowManager` facade 创建。

建议提交:

```text
docs(evolution): document current and target architecture
test(evolution): guard daemon evolution entrypoint
```

### Phase 1: 建立一等领域模型

目标: 把演化从分散副作用升级为明确 domain contract。

新增建议路径:

```text
src/core/evolution/domain.ts
src/core/evolution/events.ts
src/core/evolution/state-machine.ts
src/core/evolution/projection.ts
```

核心模型草案:

```ts
type EvolutionRunStatus =
  | 'collecting'
  | 'analyzing'
  | 'proposed'
  | 'skipped'
  | 'applying'
  | 'applied'
  | 'deploying'
  | 'deployed'
  | 'verifying'
  | 'verified'
  | 'regressed'
  | 'failed'
  | 'rolled_back';

interface EvolutionProposal {
  proposalId: string;
  episodeId: string;
  skillId: string;
  runtime: 'codex' | 'claude' | 'opencode';
  changeType: string;
  targetSection?: string | null;
  reason: string;
  evidence: string[];
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  previewDiff?: string | null;
  status: 'draft' | 'ready' | 'needs_review' | 'applied' | 'rejected' | 'expired';
}
```

验收标准:

- 当前 `task-episode`、`decision-events`、journal、version metadata 能映射到新模型。
- 新模型先作为 contract/projection 层引入，不强制迁移全部存储。
- 单测覆盖合法状态迁移和非法状态拒绝。

执行状态:

| 文件 | 职责 |
|---|---|
| `src/core/evolution/domain.ts` | 定义 `EvolutionEpisode`、`EvolutionRun`、`EvolutionProposal`、`EvolutionApplication`、`EvolutionVerification` 等一等领域 contract。 |
| `src/core/evolution/events.ts` | 定义后续 event-sourced workflow 可复用的领域事件类型。 |
| `src/core/evolution/state-machine.ts` | 显式声明 run 生命周期状态迁移，拒绝非法跳转。 |
| `src/core/evolution/projection.ts` | 先把现有 `TaskEpisode`、`DecisionEventRecord`、`VersionMetadata` 映射为 `EvolutionRun` 读模型，不迁移现有存储。 |

守护机制:

- `tests/unit/evolution-domain.test.ts` 覆盖合法状态流、非法跳转拒绝，以及从现有 episode/event/version 投影到一等演化模型。

建议提交:

```text
refactor(evolution): add domain model contracts
test(evolution): cover run state transitions
```

### Phase 2: 收敛 Workflow / Saga

目标: 把 `ShadowManager` 的隐式编排改为显式 workflow。

目标接口:

```ts
interface EvolutionWorkflow {
  ingestTrace(trace: Trace): Promise<void>;
  analyzeEpisode(input: AnalyzeEpisodeInput): Promise<EvolutionRunResult>;
  createProposal(input: CreateProposalInput): Promise<EvolutionProposal>;
  applyProposal(input: ApplyProposalInput): Promise<EvolutionApplication>;
  deployRevision(input: DeployRevisionInput): Promise<DeploymentResult>;
  verifyRevision(input: VerifyRevisionInput): Promise<EvolutionVerification>;
}
```

工作项:

- 新增 `EvolutionWorkflow` facade。
- `ShadowManager.processTrace()` 改为委托 workflow。
- `ShadowEpisodeProbeService`、`ShadowOptimizationRunner` 逐步收敛为 workflow steps。
- 所有 workflow step 统一写入 evolution event。

验收标准:

- `ShadowManager` 不直接知道 patch、journal、checkpoint 的具体细节。
- 自动分析、手动分析共用同一套 workflow result 协议。
- 失败事件明确区分 `analysis_failed`、`proposal_failed`、`apply_failed`、`deploy_failed`、`verification_failed`。

执行状态:

| 文件 | 职责 |
|---|---|
| `src/core/evolution/workflow.ts` | 新增最小 `EvolutionWorkflow` coordinator，负责合法状态推进并生成 `evolution.run_status_changed` 领域事件。 |
| `tests/unit/evolution-workflow.test.ts` | 覆盖 workflow 推进、事件生成、非法跳转拒绝。 |

后续接入顺序:

1. 先把 `ShadowEpisodeProbeService` 的 episode readiness 结果映射为 `collecting -> analyzing/skipped`。
2. 再把 `ShadowOptimizationRunner` 的 analyzer / patch / version 结果映射为 `proposed -> applying -> applied`。
3. 最后让 `ShadowManager.processTrace()` 只负责 trace 入口和 runtime lifecycle，把演化步骤委托给 workflow。

建议提交:

```text
refactor(evolution): introduce workflow facade
refactor(evolution): route shadow manager through workflow
```

### Phase 3: Proposal-first 演化

目标: 分析不再直接等于写回；先生成 proposal，再根据策略 apply。

流程:

```text
analyzer result
  -> proposal draft
  -> policy validation
  -> preview diff
  -> proposal record
  -> auto apply / user confirm / skip / wait
```

proposal 必须包含:

- `proposalId`
- `skillId`
- `runtime`
- `episodeId`
- `changeType`
- `targetSection`
- `reason`
- `evidence`
- `confidence`
- `riskLevel`
- `previewDiff`
- `status`

策略:

- `user_confirm=true`: proposal 进入 `needs_review`，等待 dashboard 手动 apply。
- `user_confirm=false` 且风险低、门禁通过: 自动 apply。
- 门禁不通过: proposal 标记 `skipped` 或 `needs_more_context`。

验收标准:

- 即使系统不自动 apply，dashboard 也能看到 proposal。
- `user_confirm` 真实控制主链路。
- proposal 支持 apply、reject、expire。
- proposal 与后续 revision 有稳定关联。

执行状态:

| 文件 | 职责 |
|---|---|
| `src/core/evolution/proposal-policy.ts` | 把 proposal apply 决策显式化，统一处理 `autoOptimize`、`userConfirm`、证据数量、来源 session、confidence 和风险等级。 |
| `src/core/evolution/domain.ts` | 补齐 proposal 的 `skipped`、`needs_more_context` 状态，匹配 proposal-first 门禁结果。 |
| `tests/unit/evolution-proposal-policy.test.ts` | 覆盖手动确认、自动 apply、高风险 review、证据不足、关闭自动优化五类策略分支。 |

后续接入顺序:

1. 将 analyzer 结果先写为 `EvolutionProposal`，不要直接进入 patch apply。
2. 在 `ShadowOptimizationRunner` 调用 patch 前执行 `evaluateEvolutionProposalPolicy()`。
3. 将 `needs_review`、`skipped`、`needs_more_context` 投影到 dashboard proposal 列表。

建议提交:

```text
feat(evolution): persist proposal records
feat(evolution): add proposal-first apply flow
```

### Phase 4: Patch 层升级为结构化 Change Plan

目标: 从字符串模板 patch 升级为结构化 Markdown 编辑，降低长期污染。

建议模型:

```ts
type ChangePlanOperation =
  | { type: 'append_section'; heading: string; content: string }
  | { type: 'append_to_section'; section: string; content: string }
  | { type: 'replace_section'; section: string; content: string }
  | { type: 'remove_section'; section: string }
  | { type: 'tighten_trigger'; section: string; exclusions: string[] };

interface ChangePlan {
  operations: ChangePlanOperation[];
  idempotencyKey: string;
}
```

工作项:

- 引入 Markdown section tree parser。
- 将 `append_context`、`tighten_trigger`、`prune_noise`、`rewrite_section` 迁移为 change plan operations。
- 所有 apply 先生成 preview diff，再执行。
- 定位失败时 proposal 进入 `needs_review`，不要硬改。

验收标准:

- 相同 proposal 重复 apply 不产生重复段落。
- `rewrite_section` 和 `prune_noise` 必须明确 section。
- AST 定位失败不会写入 shadow。
- 增加 Markdown fixtures 回归测试。

执行状态:

| 文件 | 职责 |
|---|---|
| `src/core/evolution/change-plan.ts` | 新增结构化 `EvolutionChangePlan` 和操作类型，先表达 append/replace/remove/tighten 等 Markdown 编辑意图。 |
| `tests/unit/evolution-change-plan.test.ts` | 覆盖稳定 idempotency key、section 定位必填、空操作拒绝。 |

后续接入顺序:

1. 将现有 `PatchGenerator` 先产出 `EvolutionChangePlan`，再由 adapter 生成当前 unified diff。
2. 引入 Markdown section parser 后，把 section 定位失败映射为 proposal `needs_review`。
3. 在 apply 前用 `idempotencyKey` 检查重复应用，避免重复段落。

建议提交:

```text
refactor(patch): introduce structured change plan
test(patch): cover markdown section edits
```

### Phase 5: 部署语义收敛

目标: 明确区分写入 shadow、创建 revision、部署到宿主。

状态:

- `applied_to_shadow`
- `version_created`
- `deployed_to_runtime`
- `runtime_sync_skipped`
- `runtime_sync_failed`

策略:

- `runtime_sync=true`: apply 成功后自动部署到对应宿主目录。
- `runtime_sync=false`: 只创建 revision，dashboard 标注未部署。
- 部署前自动 backup。
- 部署失败不直接回滚 shadow，但 application 标记为 `partial`。

验收标准:

- dashboard 能显示 revision 是否已部署。
- 部署失败有明确事件和错误信息。
- `runtime_sync` 配置真实控制主链路。

执行状态:

| 文件 | 职责 |
|---|---|
| `src/core/evolution/deployment-policy.ts` | 新增部署决策 contract，区分 revision 创建、跳过宿主同步、同步失败和 partial 标记。 |
| `tests/unit/evolution-deployment-policy.test.ts` | 覆盖 `runtimeSync=true`、`runtimeSync=false`、部署失败三类状态。 |

后续接入顺序:

1. 在 `EvolutionApplication` 之后执行 `decideEvolutionDeployment()`。
2. 部署 adapter 先创建 backup，再写入宿主 skill 目录。
3. 部署失败只标记 partial 和事件，不自动回滚 shadow revision。

建议提交:

```text
feat(evolution): track runtime deployment status
feat(evolution): honor runtime sync policy
```

### Phase 6: 后验验证闭环

目标: 回答这次演化是否真的变好。

新增 `VerificationWindow`:

- revision applied 后，后续 N 个相关 episode 自动进入验证窗口。
- 比较前后信号:
  - failure / retry 变化
  - `need_more_context` 次数
  - manual correction 次数
  - analyzer confidence
  - rollback / disable / reject 信号

输出:

- `improved`
- `neutral`
- `regressed`
- `insufficient_data`

验收标准:

- 每个 applied revision 有验证状态。
- dashboard 能展示演化后观察结果。
- 如果 `regressed`，系统建议 rollback 或 freeze，但高风险操作仍需用户确认。

执行状态:

| 文件 | 职责 |
|---|---|
| `src/core/evolution/verification.ts` | 新增后验验证 contract，基于前后 failure、need_more_context、manual correction 信号判断 `improved`、`neutral`、`regressed`、`inconclusive`。 |
| `tests/unit/evolution-verification.test.ts` | 覆盖负面信号下降、上升、样本不足三类结果。 |

后续接入顺序:

1. revision applied 后创建 verification window，收集后续相关 episode。
2. 用 `evaluateEvolutionVerification()` 写入 verification outcome。
3. dashboard 展示 outcome，并在 `regressed` 时提供 rollback/freeze 建议但保留用户确认。

建议提交:

```text
feat(evolution): add revision verification windows
feat(dashboard): expose verification outcomes
```

### Phase 7: Dashboard 演化工作台

目标: 让演化成为 dashboard 主能力，而不是隐藏在日志里的副产物。

Skill detail 增加 `Evolution` 区域:

- active episodes
- pending proposals
- applied revisions
- deployment status
- verification status
- rollback entry

Project view 增加:

- pending proposals
- failed evolution runs
- recently verified improvements
- regressions requiring attention

验收标准:

- 用户能在 UI 中看懂为什么建议改、改哪里、有什么风险、改后如何。
- 不需要读取 `.ornn` 文件即可理解演化状态。
- high-risk 操作保留预览、备份、回滚路径。

执行状态:

| 文件 | 职责 |
|---|---|
| `src/dashboard/evolution-lifecycle-reader.ts` | 新增 dashboard 只读 lifecycle reader，将 task episode、decision event、version metadata 投影为 `EvolutionRun` 列表和汇总。 |
| `src/dashboard/routes/project-read-routes.ts` | 新增 `GET /api/projects/:id/evolution`，让前端无需读取 `.ornn` 文件即可拿到演化状态。 |
| `frontend-v3/src/components/evolution-workspace.tsx` | 新增项目演化工作区，展示 active episodes、pending proposals、failed runs、verified improvements、regressions。 |
| `frontend-v3/src/features/dashboard/use-dashboard-v3-workspace.ts` | 选择项目时同时加载 snapshot 与 evolution lifecycle。 |
| `frontend-v3/src/components/project-workbench.tsx` | Project view 新增 `演化` tab。 |
| `tests/unit/dashboard-evolution-lifecycle-reader.test.ts` | 覆盖 active episodes、pending proposals、applied revisions 的读模型投影。 |
| `tests/unit/dashboard-project-read-routes.test.ts` | 覆盖 evolution API route 合同。 |
| `tests/unit/dashboard-v3-evolution-workspace.test.ts` | 覆盖前端 API、hook 和项目演化状态分组合同。 |

后续接入顺序:

1. 在 Skill detail 增加 Evolution 区域，展示 proposal、deployment、verification 与 rollback 入口。
2. 为 high-risk proposal 增加 preview/backup/rollback 操作入口。
3. 将 `regressed` verification outcome 显式接到 rollback/freeze 建议。

建议提交:

```text
feat(dashboard): add evolution lifecycle workspace
```

## 5. 迁移顺序

推荐执行顺序:

1. `docs(evolution): document current and target architecture`
2. `refactor(evolution): add domain model contracts`
3. `refactor(evolution): introduce workflow facade`
4. `refactor(evolution): route shadow manager through workflow`
5. `feat(evolution): persist proposal records`
6. `feat(evolution): add proposal-first apply flow`
7. `refactor(patch): introduce structured change plan`
8. `feat(evolution): track runtime deployment status`
9. `feat(evolution): add revision verification windows`
10. `feat(dashboard): expose evolution lifecycle workspace`

优先级:

- P0: Phase 0 到 Phase 3。先解决主链路、领域模型和 proposal-first 问题。
- P1: Phase 4 到 Phase 5。提升 patch 质量和部署语义。
- P2: Phase 6 到 Phase 7。完成验证闭环和 dashboard 工作台。

## 6. 测试与验证策略

每个阶段都必须有对应测试。

基础验证:

- `npm run test:smoke`
- `npm run test:regression`
- 相关 targeted Vitest
- `git diff --check`

涉及 dashboard / API 时增加:

- dashboard runtime smoke
- Storybook 或组件测试
- 关键读模型快照测试

真实链路验证:

```text
创建测试 skill
  -> 采集 trace
  -> 形成 episode
  -> 生成 proposal
  -> apply
  -> 创建 revision
  -> 部署或标记 skip
  -> 后续 trace 进入 verification
  -> dashboard 可读
```

禁止用当前输出反推测试。测试必须围绕预期行为设计，尤其是:

- proposal 不应绕过门禁直接写 shadow。
- section 定位失败不应写入 shadow。
- runtime deploy 失败不应伪装成完整成功。
- verification 数据不足时必须标记 `insufficient_data`，不能虚构改善。

## 7. 风险与约束

| 风险 | 对策 |
|---|---|
| 演化链路过度抽象 | 先以当前 ShadowManager 主链路为事实源，逐步抽象，不一次性重写 |
| proposal 增加流程复杂度 | 自动 apply 策略保持默认路径顺畅，但所有结果必须可解释 |
| patch 质量不足 | 引入 Markdown section tree 和幂等 change plan |
| dashboard 读模型漂移 | 统一 evolution projection，减少直接拼底层事件 |
| 配置和行为不一致 | 每个配置项都要有主链路 contract test |
| 自动部署风险 | 部署前 backup，部署失败标记 partial，高风险操作需要确认 |

## 8. 完成定义

本升级计划完成时，OrnnSkills 的演化能力应满足:

- 演化有明确领域对象，而不是散落在 shadow、journal、event 里的副作用。
- 每次演化有稳定生命周期: collect、analyze、propose、apply、deploy、verify。
- 自动化建议先形成 proposal，用户和系统都能看到证据、diff、风险。
- 所有写入都有 version、snapshot、rollback 路径。
- dashboard 能展示演化状态和后验结果。
- 旧演化入口被清理、迁移或明确标注为 legacy。
