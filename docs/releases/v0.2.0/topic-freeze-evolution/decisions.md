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
