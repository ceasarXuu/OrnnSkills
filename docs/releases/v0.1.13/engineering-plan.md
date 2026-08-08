# OrnnSkills v0.1.13 Engineering Plan

- App/Product Version: `0.1.13`
- Status: released
- Version PRD: `docs/releases/v0.1.13/prd.md`
- PRD Document Version: `1.0`
- Technical Design: `docs/releases/v0.1.13/technical-design.md`
- Version Source: `package.json`（version: 0.1.13）、git tag `v0.1.13`
- Created: 2026-08-09

## 1. Plan Goal

本工程计划派生自 `docs/releases/v0.1.13/prd.md` 与 `docs/releases/v0.1.13/technical-design.md`，记录 v0.1.13 的交付内容与验证状态，不得重定义 v0.1.13 产品范围或完成定义。

## 2. Document Links

| Document | Path | Responsibility | Update Trigger |
|---|---|---|---|
| Version PRD | `docs/releases/v0.1.13/prd.md` | 产品范围、目标、完成定义、验收标准 | v0.1.13 已锁定，不再更新（除非归档） |
| Technical Design | `docs/releases/v0.1.13/technical-design.md` | 架构与实现描述 | v0.1.13 已锁定，不再更新 |
| Engineering Plan | `docs/releases/v0.1.13/engineering-plan.md` | 交付记录与验证状态 | v0.1.13 已锁定，不再更新 |

## 3. Engineering Principles

- 本地优先、可回滚优先：所有写操作都有 shadow / version / journal 安全基线
- dashboard-first：核心路径以 dashboard V3 为现场，CLI 为补充
- 证据优先：优化建议必须携带 trace / episode 证据，指标明确 partial 状态

## 4. Work Breakdown

### Status Overview

| Workstream | Status | Note |
|---|---|---|
| dashboard V3 三工作区（技能/项目/配置） | 完成 | 含 i18n、模块级缓存、结构锁定 |
| 技能页 family/instance/revision 数据链 | 完成 | 版本查看/对比/diff/停用/恢复/传播 preview |
| daemon 多项目接管 | 完成 | 注册表、retry queue、checkpoint、空注册表兜底 |
| 观察与 trace 采集 | 完成 | 增量读取、启动回放、reconciliation、OOM 防护 |
| episode 分析与优化执行 | 完成 | session-backed 窗口、evaluation 协议硬校验 |
| 版本体系 | 完成 | 编号/effective 分离、mute/restore、latest symlink |
| 全局配置与迁移 | 完成 | `~/.ornn/config/`、旧路径自动迁移 |
| 可观测性 | 完成 | 决策事件、逻辑日志流、SSE 增量协议、ETag 缓存 |
| 性能与基准 | 完成 | dashboard 读侧基准、SSE 快照预算 |
| 演化合同层与 dashboard 演化读模型 | 部分 | 合同层 + 读侧已提交，写侧未接入（归 v0.2.0） |
| CI / 测试门禁 | 0.1.13 发布时通过 | 2026-05-14 后 main 分支 CI 红（归 v0.2.0） |

### v0.1.13 发布内容（CHANGELOG 0.1.13）

- docs: refresh product readme（98c4b19）
- fix: allow daemon start without projects（9e79646）
- fix(ci): clear root lint errors（491263c）
- fix: improve dashboard toast visibility（0efba98）
- fix: show marketplace miss as toast（fddafcb）

## 5. Milestones

| 里程碑 | 时间 | 状态 |
|---|---|---|
| v0.1.12 发布 | 2026-04-30 | 完成（前序版本） |
| v0.1.13 发布 | 2026-05-01 | 完成（git tag v0.1.13） |
| 版本文档三件套建立 | 2026-08-09 | 完成（本目录） |

## 6. Blocking And Non-blocking Inputs

- 阻塞：无（版本已发布）
- 非阻塞：v0.2.0 需求决策（演化写侧接入范围）、vs_review 架构发现处置

## 7. Status Tracking Rules

- 本版本已锁定：三件套只描述 v0.1.13 发布时的真实状态，后续变更一律进入 v0.2.0 三件套
- 验收证据以 CHANGELOG、git tag、PROGRESS.md 与 CI 记录为准

## 8. Done Definition Reference

v0.1.13 完成定义维护于 `docs/releases/v0.1.13/prd.md`。
