# 冻结演化功能 Engineering Plan

- App/Product Version: `0.2.0`（计划中，未发布）
- Status: draft
- Version PRD: `docs/releases/v0.2.0/topic-freeze-evolution/prd.md`
- PRD Document Version: `1.0`
- Technical Design: `docs/releases/v0.2.0/topic-freeze-evolution/technical-design.md`
- Version Source: `package.json`（当前 0.1.13）
- Created: 2026-08-09

## 1. Plan Goal

本工程计划派生自「冻结演化功能」PRD 与技术设计：先完成盘点（第一步），再实施代码冻结与 UI 隐藏，最后验证冻结生效与恢复路径。

## 2. Document Links

| Document | Path | Responsibility | Update Trigger |
|---|---|---|---|
| Topic PRD | `docs/releases/v0.2.0/topic-freeze-evolution/prd.md` | 范围、完成定义、验收标准 | 范围或决策变化 |
| Technical Design | `docs/releases/v0.2.0/topic-freeze-evolution/technical-design.md` | 冻结设计、盘点清单、风险 | 设计决策变化 |
| Engineering Plan | `docs/releases/v0.2.0/topic-freeze-evolution/engineering-plan.md` | 工作分解、状态追踪 | 执行进度变化 |

## 3. Engineering Principles

- 冻结可逆：不删代码，配置驱动
- 最小范围：只动演化执行链路与演化 UI，不触碰 trace 采集 / 索引 / 版本读取
- 验证优先：每个工作包完成后运行最小相关测试

## 4. Work Breakdown

### Status Overview

| Workstream | Status | Next Step |
|---|---|---|
| W1 盘点（第一步） | **完成**（2026-08-09） | 无（结果见 technical-design §3） |
| W2 冻结开关配置 | pending | 实现 `tracking.evolution_frozen` 配置与兼容默认 |
| W3 写侧短路 | pending | episode-probe / runner 双保险冻结检查 + 单测 |
| W4 UI 隐藏 | pending | config-workspace「演进策略」tab 隐藏 + 契约测试 |
| W5 验证与恢复 | pending | 冻结态回归 + 恢复开关验证 |

### W1 盘点（已完成）

产出：`technical-design.md` §3 盘点清单，覆盖：

- **写链路**：ShadowManager 触发链（processTrace -> traceIngest -> episodeProbe -> runner，shadow-manager/index.ts:135）；`ShadowManualOptimizeService` 无外部调用方（死代码）
- **支撑模块**：analyzer / patch-generator / optimization-eligibility / skill-version / skill-deployer / decision-events 等 17 个演化消费模块
- **生效路径**：Observer -> Daemon -> ShadowManager.processTrace() 自动触发链确认
- **UI 入口**：仅配置页「演进策略」子 tab 需隐藏（config-workspace.tsx:81）；activityScopes/decisionEvents 无组件消费，手动优化 API 不存在，无需动作
- **配置现状**：`tracking.auto_optimize` 默认 true 但**主链路不消费**（冻结不得依赖该失效配置），需新增真实门禁

### 关键盘点结论（驱动后续设计）

1. 冻结范围收敛为**单点链路 + 单个 UI tab**，比预期小：手动优化无入口、演化工作区已随 v0.1.13 回滚不存在
2. `auto_optimize` 已失效 → 新配置 `tracking.evolution_frozen`（草案），待用户确认命名
3. 版本停用/恢复（skill-version-history）属于版本管理，**不在冻结范围**

## 5. Milestones

| 里程碑 | 状态 | 说明 |
|---|---|---|
| W1 盘点完成 | ✅ 2026-08-09 | 本主题第一步 |
| W2-W4 实现完成 | pending | 配置 + 短路 + UI 隐藏 |
| W5 验证通过 | pending | 冻结态零副作用 + 恢复即时生效 |

## 6. Blocking And Non-blocking Inputs

- 阻塞：用户确认冻结开关命名与默认值（`evolution_frozen` vs 其他）
- 非阻塞：v0.2.0 其他 topic（暂无）

## 7. Status Tracking Rules

- 每个 W 完成时更新本表并附证据（提交号 / 测试输出）
- 范围变化先回 PRD 决策日志登记

## 8. Done Definition Reference

「冻结演化功能」完成定义维护于 `docs/releases/v0.2.0/topic-freeze-evolution/prd.md`。
