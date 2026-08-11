# Product Decision Baseline

> PROTECTED USER-AUTHORITY ARTIFACT
> Decisions in this file MUST NOT be created, modified, deleted, reinterpreted,
> or superseded without explicit user approval for that specific decision change.
> Agent inference, implementation, tests, reviews, existing documents, or lack
> of user objection are not approval.

- Authority: User
- Write Gate: Explicit user approval required
- Agent Self-Approval: Forbidden
- Release Version: v0.2.0
- Topic: 冻结演化功能
- Plan: ./plan.md

| ID | Confirmed Decision | Must Do | Must Not Do | Rationale | Violation Signal | Confirmation | Status |
|---|---|---|---|---|---|---|---|
| D1 | 冻结当前的演化功能：代码不生效 | 冻结自动演化写链路（episode 分析 -> 优化 -> patch -> 版本 -> 部署均不触发）；trace 采集与 skill 索引保持可用 | 不得删除演化代码；不得冻结 trace 采集、技能索引、版本读取/停用 | 在演化闭环重设计前暂停自动变更，保留可逆恢复能力 | 冻结后仍出现自动 patch / 新版本 / 部署决策事件 | user-confirmed-direct: 2026-08-09 用户要求"冻结当前的演化功能代码不生效" | active |
| D2 | 演化相关 UI 临时隐藏 | 隐藏演化相关 UI 入口（不可见、不可操作），保留非演化 UI（技能库、版本管理、配置、项目视图） | 不得删除 UI 代码；不得把冻结误伤到版本停用/恢复等非演化操作 | 用户要求"相关的UI 也临时隐藏起来" | 冻结后 dashboard 仍可见可操作演化入口 | user-confirmed-direct: 2026-08-09 用户要求"相关的UI 也临时隐藏起来" | active |
| D3 | 第一步先做盘点 | 冻结实施前完成盘点并记录：演化代码范围、UI 入口、生效路径、配置现状 | 不得跳过盘点直接改代码 | 用户要求"第一步先做盘点" | 冻结实现未基于盘点清单实施 | user-confirmed-direct: 2026-08-09 用户要求"第一步先做盘点" | active |
| D4 | 默认关闭演化功能 | 冻结开关默认处于冻结状态：`tracking.evolution_frozen` 默认 `true`（配置命名由维护者确定）；未显式开启前演化功能不生效 | 不得默认开启演化；不得改变配置默认值而不经用户确认 | 用户明确"默认关指的是默认关闭演化功能" | 新安装/默认配置下仍发生自动演化 | user-confirmed-direct: 2026-08-09 用户确认"默认关闭演化功能"，命名委托维护者 | active |
| D5 | 影子 skills 机制纳入冻结（演化本体） | 影子 skills 本身是演化能力的一部分：冻结期间**不物化**（新项目不扫描/不复制/不建索引）、**不更新**；**技能库展示保留**（已存在的影子数据照常展示，冻结只作用于演化功能本身）；解冻后重启 daemon 自动补物化 | 不得在冻结期间物化或更新影子 skills；不得隐藏技能库展示（技能库是核心产品能力，不在冻结范围） | 用户明确"影子skills 也是为了做演化能力才加入的，本身也是演化能力的一部分，需要纳入冻结"；后纠正"冻结越界了，只是冻结演化功能，怎么把skills 库都隐藏了"——展示层恢复，仅保留不物化/不更新 | 冻结期间仍产生或更新影子内容；或技能库展示被隐藏 | user-confirmed-direct: 2026-08-09 用户确认纳入冻结；2026-08-09 用户纠正越界（展示恢复） | active |
| D6 | 技能库数据源改为直读宿主 skills 目录 | 技能库展示直接扫描宿主 skills 目录（项目内 `.codex/.claude/.opencode/skills`、`skills`、`.skills`、`.agents/skills` + 全局 `origin_paths`、`~/.agents/skills`、`~/.codex/skills`），**实时反映增删改**；shadow 降级为纯演化工作副本，不再作为技能库展示数据源；**冻结期照常展示**（读侧直扫，不写 shadow）；详情正文编辑**写宿主 SKILL.md**；版本历史/停用/恢复/传播等 shadow 演化操作**不再展示**（宿主直读模式） | 不得再以 shadow 索引为技能库数据源；不得在冻结期因展示而物化 shadow；版本操作 UI 不得保留在宿主直读模式 | 用户明确"真正重要的是盯着skills的变化"（V2.0 核心价值：扫描所有项目、所有宿主的 skills）；确认直读宿主、冻结期照常、编辑写宿主、隐藏版本操作 | 宿主 skills 增删改后 dashboard 技能库不变化；或冻结期展示触发 shadow 写入 | user-confirmed-direct: 2026-08-09 用户确认直读宿主目录、冻结期照常展示、编辑写宿主、隐藏版本操作 | active |
