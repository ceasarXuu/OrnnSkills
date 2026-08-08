# OrnnSkills v0.2.0 Version PRD

- App/Product Version: `0.2.0`（计划中，未发布）
- PRD Document Version: `1.0`
- Status: draft
- Created: 2026-08-09
- Updated: 2026-08-09
- Owner / Requester: ceasarXuu
- Source Request: 收纳 v0.1.13 之后的 feature 与 debug 需求
- Technical Design: `docs/releases/v0.2.0/technical-design.md`
- Engineering Plan: `docs/releases/v0.2.0/engineering-plan.md`
- Version Source: `package.json`（当前 0.1.13，v0.2.0 为下一迭代目标）

## PRD Document Version History

| Document Version | Updated | Change |
|---|---|---|
| 1.0 | 2026-08-09 | 创建 v0.2.0 版本 PRD，建立需求收纳清单。 |

## Version Goal And Completion Definition

本版本 PRD 是 v0.2.0 产品范围、版本目标与完成定义的事实来源。技术设计与工程计划必须从本 PRD 派生。

### Version Goal

v0.2.0 是 V2.0 主线的下一迭代工作区，目标：把演化能力从"合同层 + 读模型"推进到生产写侧闭环（proposal-first -> change plan -> 部署 -> 验证），同时清空 v0.1.13 之后积累的工程债务（CI 门禁、架构发现），恢复可验证、可发布的工程基线。

### Must Deliver（候选，待确认）

- 恢复 CI 全绿（Lint 硬错误清零）
- 演化写侧闭环接入 ShadowManager 主链路（范围待决策）
- dashboard 演化动作（preview / backup / rollback / freeze）接入真实 action API
- vs_review 架构发现分批处置（范围待决策）

### Done Definition

- 本版本完成定义由需求清单决策后更新；当前为 draft，不具约束力。

## 1. Background And Product Intent

v0.1.13 发布后，main 分支积累了以下事实：

- 2026-05-13/14 提交了演化架构升级的合同层与 dashboard 读侧（EVOLUTION-ARCHITECTURE-UPGRADE-PLAN Phase 0-7 的合同/读侧部分），但 ShadowManager 主链路未接入
- 2026-05-14 起最后 4 次 CI 失败（Lint 阶段，`evolution-lifecycle-reader.ts:53` Unsafe any）
- 2026-06-04 对抗性架构审查（`vs_review/`，17 项发现）通过验证但未处置
- 2026-05-14 后仓库无提交，本地 `node_modules` 缺失导致测试基线不可运行

## 2. Goals And Success Criteria

- main 分支 CI 全绿（lint / typecheck / build / test / storybook）
- 演化能力符合 `docs/EVOLUTION-ARCHITECTURE-UPGRADE-PLAN.md` §8 完成定义（或用户明确缩小范围）
- 高风险演化动作（rollback / freeze）具备预览、备份、回滚路径
- 架构债务有处置结论（修复、标注、或移除）

## 3. Users And Usage Context

与 v0.1.13 一致：个人开发者、本地优先、多宿主重度用户。v0.2.0 面向的用户价值主要是"演化结果可解释、可审计、可回滚"。

## 4. Scope

### In Scope（候选需求清单）

**Feature：**

1. 演化写侧接入：`EvolutionWorkflow` 接管 ShadowManager 主链路（Phase 2）
2. Proposal-first：analyzer 结果先落 `EvolutionProposal`，策略门禁（user_confirm / autoOptimize / 证据 / 风险）真实控制主链路（Phase 3）
3. 结构化 Change Plan：PatchGenerator 迁移为 `EvolutionChangePlan`，幂等 + section 定位失败不写 shadow（Phase 4）
4. 部署语义：`runtime_sync` 真实控制部署，backup 前置、失败标记 partial（Phase 5）
5. 后验验证：revision 后置验证窗口，产出 improved / neutral / regressed / insufficient_data（Phase 6）
6. 演化动作 API：preview / backup / rollback / freeze 接真实 API，含确认门禁与审计事件（Phase 7 遗留）
7. 自动同步机制决策（TODO.md P1：symbolic link / 路径拦截 / 自动 sync / hook）

**Debug：**

8. CI Lint 硬错误：`src/dashboard/evolution-lifecycle-reader.ts:53` Unsafe any 清零
9. vs_review 架构发现分批处置，优先项：循环依赖（task-episode ↔ task-episode-policy）、SQLite `save()` 事务内调用、core 层反向依赖 dashboard、NDJSON spinlock busy-wait、前端 God hooks
10. 本地验证基线恢复：`npm install` + `test:smoke` 通过

### Out Of Scope

- 团队协作、权限、审批（同 v0.1.13）
- 云端账号体系、marketplace 运营
- 未列入需求清单的新产品方向

## 5. Core User Journey

1. 打开技能详情 -> 看到演化摘要：待处理 proposal、已应用 revision、验证结果、风险建议
2. 高风险变更前先看 preview diff -> 确认 backup -> 执行 rollback / freeze
3. 自动优化路径：trace -> episode -> proposal -> 门禁 -> apply -> deploy -> verify，全程可审计
4. 开发者视角：main 分支 CI 全绿，改动可回归

## 6. Interaction And Information Design

- 沿用 v0.1.13 dashboard V3 信息架构；演化工作区与动作入口已存在于读侧，v0.2.0 补齐动作真实执行
- high-risk 操作必须预览、备份、确认三步齐全

## 7. Product Rules And State Logic

- 演化 run 状态机：collecting -> analyzing -> proposed -> applying -> applied -> deploying -> deployed -> verifying -> verified / regressed / failed / rolled_back
- proposal 状态：draft / ready / needs_review / applied / rejected / expired / skipped / needs_more_context
- 部署状态：applied_to_shadow / version_created / deployed_to_runtime / runtime_sync_skipped / runtime_sync_failed
- 验证结论：improved / neutral / regressed / insufficient_data；数据不足不得虚构改善

## 8. Edge Cases, Errors, And Recovery

- proposal 不得绕过门禁直接写 shadow
- section 定位失败不得写入 shadow，proposal 转 needs_review
- 部署失败不自动回滚 shadow，application 标记 partial
- 相同 proposal 重复 apply 由 idempotency key 拦截，不产生重复段落

## 9. Content And Terminology

- 面向普通用户的主术语仍是 Skill Family / Instance / Revision；proposal / verification 等演化术语在 dashboard 内以业务文案呈现（"待处理建议 / 已应用 / 验证结果"）

## 10. Acceptance Criteria

- main 分支 CI 全绿（lint / typecheck / build / vitest --run / storybook）
- 演化写侧接入后，自动分析与手动分析共用同一 workflow 协议
- dashboard 可展示 proposal、部署状态、验证结果；rollback / freeze 动作有预览、备份、审计
- `runtime_sync`、`user_confirm` 等配置真实控制主链路（contract test 覆盖）
- 无重复段落、无 section 定位失败写 shadow（回归测试覆盖）

## 11. Review Checklist And Sign-off Questions

- 写侧接入范围是否与用户确认？（全部 Phase 2-6 vs 仅 P0 部分）
- 是否引入新配置项？每个配置项是否有 contract test？
- 高风险动作是否满足预览、备份、确认、审计四要素？
- vs_review 17 项发现哪些修复、哪些标注、哪些移除？

## 12. Decision Log

| Topic | Decision | Rationale | Source |
|---|---|---|---|
| 需求收纳方式 | v0.2.0 三件套作为工作区，draft 状态 | 用户指定：建 v0.2.0 收纳后续 feature/debug | 2026-08-09 用户要求 |
| 演化写侧范围 | 待决策（P0/P1 或全部） | 需用户确认实施范围 | EVOLUTION-ARCHITECTURE-UPGRADE-PLAN §5 |
| 自动同步机制 | 待决策 | TODO.md P1 遗留 | TODO.md P1-1 |
| vs_review 处置 | 待决策 | 17 项发现待分批处置 | vs_review/2026-06-04-architecture-quality-review.md |
