# OrnnSkills v0.2.0 Technical Design

- App/Product Version: `0.2.0`（计划中，未发布）
- Status: draft
- Version PRD: `docs/releases/v0.2.0/prd.md`
- Version Source: `package.json`（当前 0.1.13，v0.2.0 为下一迭代目标）
- Created: 2026-08-09

## 1. Design Goal

本技术设计派生自 `docs/releases/v0.2.0/prd.md`，为 v0.2.0 候选需求提供设计草案，不得重定义 v0.2.0 产品范围。draft 状态：具体决策以用户确认为准。

## 2. Non-goals

- 不设计新的前端工程结构（沿用 frontend-v3）
- 不设计团队/云端能力

## 3. Architecture

### 3.1 演化写侧接入（对应 EVOLUTION 计划 Phase 2-6）

设计事实来源：`docs/EVOLUTION-ARCHITECTURE-UPGRADE-PLAN.md`（Phase 2-6 已含完整合同与接入顺序）。接入顺序：

1. `EvolutionWorkflow` 成为 ShadowManager 之上的编排层；`ShadowManager.processTrace()` 只保留 trace 入口与 runtime lifecycle
2. episode readiness 结果映射为 `collecting -> analyzing/skipped`
3. analyzer 结果先落 `EvolutionProposal`（proposal-first），`evaluateEvolutionProposalPolicy()` 在调用 patch 前执行
4. `PatchGenerator` 产出 `EvolutionChangePlan`（idempotency key + section 操作），adapter 生成 unified diff；section 定位失败 -> proposal `needs_review`
5. `decideEvolutionDeployment()`：`runtime_sync=true` 自动部署（先 backup，失败标记 partial），`false` 只建 revision
6. revision applied 后创建 verification window，`evaluateEvolutionVerification()` 写 outcome

约束：接入前必须先跑通现有合同层单测（evolution-workflow / proposal-policy / change-plan / deployment-policy / verification 测试已在仓库），保证行为契约不回退。

### 3.2 演化动作 API（对应 EVOLUTION 计划 Phase 7 遗留）

新增 dashboard 写侧路由（挂在既有 `src/dashboard/routes/` 体系下）：

```text
POST /api/projects/:id/evolution/actions/preview    <- 生成 preview diff（只读）
POST /api/projects/:id/evolution/actions/backup     <- 备份当前 shadow/version
POST /api/projects/:id/evolution/actions/rollback   <- 回滚到指定 revision（确认门禁）
POST /api/projects/:id/evolution/actions/freeze     <- 冻结演进（冷却，确认门禁）
```

- 每个动作执行前生成审计事件（decision-event 语义），失败不落半成品状态
- rollback/freeze 为 high-risk：执行前必须预览 + 备份 + 确认（复用 v1 的 user-confirmation 语义）
- 前端 `evolution-workspace.tsx` / `skill-detail-dialog.tsx` 现有动作入口从"读模型展示"切换为"真实 API 调用"

### 3.3 CI 修复

`src/dashboard/evolution-lifecycle-reader.ts:53` 的 `Unsafe any` 硬错误：为 episode 投影输入补充显式类型（`Partial<TaskEpisodeSnapshot>` 由调用方保证），并在该文件恢复 lint 通过后跑全量 `npm run lint` 确认无新错误。

### 3.4 vs_review 发现处置（分批）

优先级排序（依据发现严重度，最终以用户决策为准）：

1. 循环依赖：`task-episode` ↔ `task-episode-policy` —— 收敛依赖方向（policy 只依赖 contract 类型）
2. SQLite `save()` 事务内调用 —— 改为事务提交后落盘或事务内统一排队
3. core 层反向依赖 dashboard —— 明确依赖边界或移动类型声明
4. NDJSON spinlock busy-wait —— 增加退避或事件驱动
5. 前端 God hooks 拆分、episode-probe-service 去重、配置路由去重、i18n 比较收口等

每批独立提交、独立回归，标注修复来源（`vs_review/2026-06-04-architecture-quality-review.md`）。

## 4. Data And State Model

- `EvolutionRun`（投影读模型已存在）：由 task episode / decision event / version metadata 投影
- `EvolutionProposal`：新增持久化（NDJSON 或 SQLite，决策后定），状态机含 needs_review / skipped / needs_more_context
- `EvolutionApplication` / `EvolutionVerification`：写侧新增，verification window 从后续相关 episode 聚合信号

## 5. Core Flows

见 §3.1 六步接入顺序；核心不变量：

- proposal 不绕过门禁
- section 定位失败不写 shadow
- 部署失败不伪装成功
- 验证数据不足标记 insufficient_data

## 6. Platform Or Integration Integration

- 沿用现有 LiteLLM analyzer / local filesystem skill store / SQLite / NDJSON / dashboard projection
- 部署 adapter 复用 `skill-deployer`

## 7. UI Or Interface Modules

- `evolution-workspace.tsx`：proposal 列表与动作按钮（preview / backup / rollback / freeze）真实化
- `skill-detail-dialog.tsx`：演化摘要 + 推荐动作入口真实化
- 新增 Storybook stories 覆盖动作确认流

## 8. Version And Release Integration

- v0.2.0 发布时：`npm run release`（standard-version 生成 0.2.0）+ 三件套状态转 released + CHANGELOG 对照
- 发布前必须：CI 全绿 + test:smoke 通过

## 9. Privacy, Permissions, And Logging

- 动作 API 一律落审计事件（谁、何时、对哪个 revision、结果）
- 备份产物路径随 shadow 版本目录组织，可回滚

## 10. Test Strategy

- 合同层测试已存在：evolution-domain / workflow / proposal-policy / change-plan / deployment-policy / verification
- 新增：写侧接入后 ShadowManager 集成测试（episode -> proposal -> apply -> version 全链路）、动作 API route 测试、audit 事件断言
- 门禁：`npm run test:smoke` + `npm run test:regression`

## 11. Implementation Order

1. 修复 CI Lint（`evolution-lifecycle-reader.ts:53`）——无依赖，先行
2. 用户决策演化写侧范围
3. Phase 2-6 按接入顺序实施（每步独立提交 + 回归）
4. 演化动作 API
5. vs_review 分批处置（穿插于以上之间，按优先级）

## 12. Risks

| 风险 | 对策 |
|---|---|
| 写侧接入范围过大 | 先决策范围；合同层测试作为行为基线 |
| 动作 API 高风险操作误执行 | 预览 + 备份 + 确认 + 审计四要素 |
| CI 红期间无回归保障 | 第 1 步先恢复 CI |
| 本地 node_modules 缺失 | `npm install` 后恢复 test:smoke 基线 |

## 13. Open Questions

- 演化写侧接入范围（全部 Phase 2-6 或仅 P0 部分）？
- `EvolutionProposal` 持久化介质（NDJSON vs SQLite）？
- vs_review 各发现项的处置优先级？
- 自动同步机制（TODO.md P1）是否纳入 v0.2.0？
