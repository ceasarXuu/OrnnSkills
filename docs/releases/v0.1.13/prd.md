# OrnnSkills v0.1.13 Version PRD

- App/Product Version: `0.1.13`
- PRD Document Version: `1.0`
- Status: released
- Created: 2026-08-09
- Updated: 2026-08-09
- Owner / Requester: ceasarXuu
- Source Request: 锁定当前已发布版本的产品范围
- Technical Design: `docs/releases/v0.1.13/technical-design.md`
- Engineering Plan: `docs/releases/v0.1.13/engineering-plan.md`
- Version Source: `package.json`（version: 0.1.13）、git tag `v0.1.13`（2026-05-01 发布）

## PRD Document Version History

| Document Version | Updated | Change |
|---|---|---|
| 1.0 | 2026-08-09 | 创建 v0.1.13 版本 PRD，固化已发布版本的产品范围。 |

## Version Goal And Completion Definition

本版本 PRD 是 v0.1.13 产品范围、版本目标与完成定义的事实来源。技术设计与工程计划必须从本 PRD 派生。

### Version Goal

v0.1.13 是 V2.0 主线在 2026-05-01 的发布快照：以 dashboard V3 为主使用现场，围绕 `Skill Family / Skill Instance / Skill Revision` 三层模型，提供本机 skill 生命周期与演进管理闭环。

### Must Deliver

- dashboard V3 作为默认入口（`/` 重定向到 `/v3/`），技能 / 项目 / 配置三个一级工作区
- Skill Family 列表、实例详情、正文编辑、版本历史、版本停用/恢复、diff 对比、preview 传播与 apply-to-family
- 项目工作台：项目状态、项目内 skill 实例、活动流
- 配置工作台：模型服务商、LLM 安全闸门、提示词配置，自动保存
- 全局 daemon：多项目监控、trace 采集、episode 分析、优化执行、版本落盘、决策事件
- 版本体系：shadow 版本快照、`latest` / effective version 分离、mute/restore、回滚入口
- 空注册表可启动、全局配置迁移、跨会话日志流、SSE 增量协议

### Done Definition

- 以上能力以 0.1.13 发布（2026-05-01）时的实现与测试状态为准。
- 发布时 CI（lint / typecheck / build / test / storybook）通过，相关运行经验沉淀于 `docs/PROGRESS.md`。
- v0.1.13 发布后提交到 main 但尚未发布的变更（演化合同层、dashboard 演化工作台等）不属于本版本范围，归入 v0.2.0。

## 1. Background And Product Intent

V2.0 定位为"开源、本地优先、跨宿主、可视化的 Skill 生命周期与演进管理器"。v0.1.13 是该方向的已发布基线：早期 V1（Skill Evolution Agent）与 V2 中间产物（`/v2` 路由、`frontend/` 目录）均已下线，dashboard V3 是唯一生效的前端实现。

## 2. Goals And Success Criteria

- 用户在 dashboard 中能"看清楚、管明白、优起来"自己的 skill 资产
- 技能库以 `Skill Family -> Skill Instance -> Skill Revision` 为数据链，不再以项目快照为主源
- 本地优先：所有状态落本地，无云端账号依赖

## 3. Users And Usage Context

- 个人开发者：多宿主（Codex / Claude / OpenCode）重度用户
- 本地优先用户：关心数据归属与可回滚
- 非目标：团队协作、审批流、云端治理

## 4. Scope

### In Scope

- dashboard V3 主路径（技能 / 项目 / 配置）与 i18n
- 全局 skill inventory、搜索、筛选、分页
- 版本历史、diff、停用/恢复、preview 传播、apply-to-family
- daemon 多项目接管、trace 采集与 episode 分析、自动/手动优化
- 全局配置（`~/.ornn/config/settings.toml`）与旧配置迁移
- 可观测性：决策事件、逻辑日志流、SSE 增量推送

### Out Of Scope

- 团队协作、权限、审批
- 云端账号体系与 marketplace 运营
- 通用 prompt / MCP / plugin 平台化
- 演化闭环的写侧接入（proposal-first、部署策略、后验验证）——本版本只含演化读模型与合同层雏形

## 5. Core User Journey

1. 打开 dashboard（`/v3/`）→ 技能库看到全部 Skill Family
2. 进入 family 详情 → 查看实例、调用信号、版本历史
3. 编辑正文 / 停用版本 / 对比 diff / preview 传播到同族实例
4. 切到项目工作台 → 查看项目状态与项目内 skill 实例、活动流
5. 切到配置 → 管理模型服务商与提示词，自动保存
6. daemon 后台持续采集 trace 并生成 episode 分析、决策事件与版本

## 6. Interaction And Information Design

- 顶层导航固定为 `技能 / 项目 / 配置`；`活动` 并回项目工作台
- 技能页为 `sticky header + 侧栏 + 详情主卡 + 正文/版本区` 单栏主工作区
- 项目导航只出现在技能页的项目工作区中
- 版本历史收敛为正文卡片 header 内的"查看版本 / 对比版本"下拉控件
- 模块级缓存：tab 切换走 stale-while-revalidate

## 7. Product Rules And State Logic

- "编号最新版本"与"当前有效版本"（effective）分离建模；`latest` symlink 指向最新有效版本
- 停用（mute）版本保留编号占位，退出生效链路；恢复（restore）重新进入生效链路
- 传播 preview 必须先弹显式确认，确认后才 apply 到同族实例
- 空注册表（无已初始化项目）不阻断 daemon / dashboard 启动

## 8. Edge Cases, Errors, And Recovery

- 项目已注册但 runtime 未同步：daemon 以注册表为事实来源核验
- 长会话 / 大文件：observer 按偏移增量读取，避免 bootstrap OOM
- SSE 大包：推送变更信号，按需拉取快照；decisionEvents / recentTraces 有窗口预算
- 浏览器历史缓存与自定义 ETag 冲突：GET 统一 `cache: 'no-store'`，应用层维护轻量 revalidate
- 版本 mute/restore 后，部署、评估、读取回退到最新有效版本

## 9. Content And Terminology

- 一等对象术语：`Skill Family` / `Skill Instance` / `Skill Revision`；`shadow skill` 不作为面向普通用户的主术语
- 活动表状态映射为业务语义（分析中 / 继续观察 / 无需优化 / 已应用 / 已中断），不裸露内部枚举

## 10. Acceptance Criteria

- 技能库默认以 Family 为列表单位，详情以 Instance / Revision 为操作目标
- 版本历史支持查看、对比、停用、恢复，与正文区状态同步
- 配置自动保存不因 tab 切换丢失未落盘编辑
- daemon 在空注册表、新增项目、项目移除场景下行为符合 v0.1.13 验收（见 PROGRESS.md）
- 中英文界面主路径文案齐全

## 11. Review Checklist And Sign-off Questions

- 是否仍以 dashboard V3 为唯一前端入口？
- 技能页是否仍以 family / instance / revision 三层为主模型？
- 是否存在 v0.1.13 之后才提交、却在本版本范围内描述的变更？
- 高风险操作（版本停用、传播 apply）是否都有预览与可回滚路径？

## 12. Decision Log

| Topic | Decision | Rationale | Source |
|---|---|---|---|
| 前端入口 | v3 为服务默认入口，v2 下线 | V2 中间产物已完成历史使命 | docs/PROGRESS.md 2026-04-24 |
| 技能页对象模型 | family / instance / revision 三层，项目快照降级为项目视角数据源 | 单一 skill_id 无法同时表达家族、副本与修订 | docs/PROGRESS.md 2026-04-23 |
| 版本语义 | 编号最新 与 有效版本 分开建模 | mute/restore 需要退出生效链路 | docs/PROGRESS.md 2026-04-17 |
| 导航 IA | 一级导航固定 技能 / 项目 / 配置，活动并回项目 | 活动是项目工作现场的子视图 | docs/PROGRESS.md 2026-04-23 |
| 配置存储 | 项目级配置迁移到全局 `~/.ornn/config/` | 全局 daemon 需要跨项目共享配置 | docs/PROGRESS.md 2026-04-16 |
| 演化链路 | 本版本只交付合同层与读模型，写侧接入推迟 | 避免在无验收保障下重构 ShadowManager 主链路 | docs/EVOLUTION-ARCHITECTURE-UPGRADE-PLAN.md |
