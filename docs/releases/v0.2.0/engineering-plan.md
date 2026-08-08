# OrnnSkills v0.2.0 Engineering Plan

- App/Product Version: `0.2.0`（计划中，未发布）
- Status: draft
- Version PRD: `docs/releases/v0.2.0/prd.md`
- PRD Document Version: `1.0`
- Technical Design: `docs/releases/v0.2.0/technical-design.md`
- Version Source: `package.json`（当前 0.1.13，v0.2.0 为下一迭代目标）
- Created: 2026-08-09

## 1. Plan Goal

本工程计划派生自 `docs/releases/v0.2.0/prd.md` 与 `docs/releases/v0.2.0/technical-design.md`，组织 v0.2.0 的工作分解与执行顺序；不得重定义 v0.2.0 产品范围。范围与优先级以用户决策为准，本计划随决策更新。

## 2. Document Links

| Document | Path | Responsibility | Update Trigger |
|---|---|---|---|
| Version PRD | `docs/releases/v0.2.0/prd.md` | 产品范围、需求清单、完成定义 | 需求收纳或用户决策变化 |
| Technical Design | `docs/releases/v0.2.0/technical-design.md` | 架构、模块边界、接入顺序、风险 | 设计决策变化 |
| Engineering Plan | `docs/releases/v0.2.0/engineering-plan.md` | 工作分解、排序、状态追踪 | 执行进度变化 |

## 3. Engineering Principles

- 最小充分设计：根因正确、行为正确、架构一致，不扩大批准范围
- 原子提交：每个可独立验证的改动独立提交并推送
- 先恢复门禁，再扩大改动：任何重构前 CI 必须全绿
- 高风险操作（rollback / freeze / 自动部署）必须有预览、备份、确认、审计

## 4. Work Breakdown

### Status Overview

| Workstream | Status | Next Step |
|---|---|---|
| CI Lint 硬错误修复 | pending | 修 `evolution-lifecycle-reader.ts:53` Unsafe any，恢复 CI 绿 |
| 本地验证基线 | pending | `npm install` + `npm run test:smoke`（需用户批准安装依赖） |
| 演化写侧接入范围决策 | pending | 用户决策：全部 Phase 2-6 / 仅 P0 部分 |
| Phase 2-6 写侧接入 | pending | 按 technical-design §3.1 六步接入顺序实施 |
| 演化动作 API | pending | preview / backup / rollback / freeze 接真实 API |
| vs_review 分批处置 | pending | 按技术设计 §3.4 优先级分批，每批独立提交 |
| 自动同步机制 | pending | 决策是否纳入 v0.2.0 |
| v0.2.0 发布 | pending | standard-version + 三件套转 released |

### 工作分解

**W1 CI 恢复（P0，无依赖）：**

1. 修复 `src/dashboard/evolution-lifecycle-reader.ts:53` 的 Unsafe any
2. `npm run lint` / `npm run typecheck` / 全量单测通过
3. 推送后 CI 全绿（lint / typecheck / build / test / storybook）

**W2 本地基线（P0，需用户批准）：**

1. `npm install`
2. `npm run test:smoke` 通过（含 runtime smoke + storybook）

**W3 演化写侧接入（P0/P1，依赖 W1）：**

1. ShadowManager 主链路接入 `EvolutionWorkflow`（Phase 2）
2. Proposal-first：analyzer 结果落 proposal + 门禁执行（Phase 3）
3. `EvolutionChangePlan` 迁移 PatchGenerator（Phase 4）
4. 部署策略 `runtime_sync` 接入（Phase 5）
5. 验证窗口与 outcome 写入（Phase 6）
6. 每步：合同层测试保持通过 + 新增集成测试 + 独立提交

**W4 演化动作 API（P1，依赖 W3 中至少 Phase 2-4 完成）：**

1. preview / backup / rollback / freeze 路由 + 审计事件
2. 前端动作入口真实化 + Storybook 确认流 stories

**W5 vs_review 处置（P2，穿插）：**

1. 循环依赖（task-episode ↔ task-episode-policy）
2. SQLite 事务内 save()
3. core 反向依赖 dashboard
4. NDJSON spinlock busy-wait
5. 其余低风险项分批

**W6 发布 v0.2.0：**

1. `npm run release`（生成 0.2.0 + CHANGELOG）
2. 三件套状态转 released，docs/README.md 版本表更新
3. `npm publish`（如需）

## 5. Milestones

| 里程碑 | 时间 | 状态 |
|---|---|---|
| CI 恢复全绿 | 待定 | pending |
| 写侧接入范围决策 | 待定 | pending（用户决策） |
| Phase 2-6 接入完成 | 待定 | pending |
| 动作 API 上线 | 待定 | pending |
| v0.2.0 发布 | 待定 | pending |

## 6. Blocking And Non-blocking Inputs

- 阻塞：CI 修复（W1）、用户对写侧接入范围的决策（W3）、本地依赖安装批准（W2）
- 非阻塞：vs_review 处置（W5）、自动同步机制决策

## 7. Status Tracking Rules

- 本计划随执行更新；每完成一个 W，状态置为完成并记录证据（CI 链接 / 测试输出 / 提交号）
- 范围变更必须回到 `docs/releases/v0.2.0/prd.md` 决策日志登记

## 8. Done Definition Reference

v0.2.0 完成定义维护于 `docs/releases/v0.2.0/prd.md`（当前 draft，决策后转正式）。
