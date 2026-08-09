# 冻结演化功能 Version PRD

- App/Product Version: `0.2.0`（计划中，未发布）
- PRD Document Version: `1.0`
- Status: draft
- Created: 2026-08-09
- Updated: 2026-08-09
- Owner / Requester: ceasarXuu
- Source Request: 冻结当前的演化功能代码不生效，相关 UI 临时隐藏；第一步先做盘点
- Technical Design: `docs/releases/v0.2.0/topic-freeze-evolution/technical-design.md`
- Engineering Plan: `docs/releases/v0.2.0/topic-freeze-evolution/engineering-plan.md`
- Version Source: `package.json`（当前 0.1.13，v0.2.0 为下一迭代目标）

## PRD Document Version History

| Document Version | Updated | Change |
|---|---|---|
| 1.0 | 2026-08-09 | 创建 topic「冻结演化功能」，定义冻结范围与第一步盘点要求。 |

## Version Goal And Completion Definition

本主题 PRD 是「冻结演化功能」范围与完成定义的事实来源。技术设计与工程计划必须从本 PRD 派生。

### Topic Goal

将当前演化功能（基于 trace 的自动分析、优化、patch 生成、版本写入与部署）冻结为**不生效**状态：演化执行链路不再触发，相关 UI 入口临时隐藏；同时保留非演化能力（skill 索引、版本查看/停用、配置、项目工作台）的完整可用。冻结是**临时、可逆**的，恢复路径必须明确。

### Must Deliver

- 演化写链路（episode 分析 -> 优化 -> patch -> 版本 -> 部署）不再自动触发
- 演化相关 UI 入口临时隐藏（不可见、不可操作）
- 冻结与恢复的开关机制（配置驱动）
- 第一步盘点：演化代码范围、UI 入口、生效路径、配置现状

### Done Definition

- 自动优化在冻结状态下零触发（回归验证：构造 episode 就绪场景，确认不产生 patch / 新版本 / 决策事件）
- 冻结状态下 dashboard 无演化入口（活动流、优化按钮、演化摘要等）
- 配置项切换即可恢复冻结前行为，无需代码改动
- 盘点清单完整记录于技术设计文档

## 1. Background And Product Intent

v0.1.13 的演化能力是隐式副作用流水线：daemon 采集 trace 后，ShadowManager 自动串联 episode 探测、窗口分析、patch 生成、版本落盘与部署。该链路缺少显式产品状态（无 proposal / 审批 / 验证闭环），且 `auto_optimize` 等配置语义与主链路脱节（配置存在但不消费）。在 v0.2.0 重新设计演化闭环之前，先冻结现有演化功能，避免不可审计的自动变更继续发生。

## 2. Goals And Success Criteria

- 冻结期间零自动演化副作用（patch / 版本创建 / 部署）
- 用户无法从 dashboard 触发或看到演化入口
- 其余产品能力（索引、版本管理、配置、项目视图）不受影响
- 恢复路径清晰：单个配置项回切即可解除冻结

## 3. Users And Usage Context

- 维护者：需要在演化闭环重设计期间获得可控环境
- 现有用户：冻结期间不再收到自动优化变更，技能库与版本体系仍可正常查看与操作

## 4. Scope

### In Scope

- 冻结自动演化触发链（trace 采集可保留，但不得进入优化执行）
- **冻结影子 skills 机制（D5）**：新项目不物化影子（不扫描/不复制/不建索引/不创建初始版本）；已存在影子不更新；**技能库展示保留**
- 隐藏演化相关 UI 入口（D2）
- 冻结开关机制（配置驱动，可逆）
- 第一步盘点（本主题启动阶段）：代码 / UI / 配置 / 生效路径清单

### Out Of Scope

- 不删除演化代码（临时冻结，保留恢复能力）
- 不重设计演化闭环（另行规划）
- 不冻结 trace 采集、技能库展示、项目工作台、配置编辑、市场等非演化能力

## 5. Core User Journey

1. 冻结前：daemon 自动分析并优化 skill（现状）
2. 冻结后：trace 继续采集与索引，但任何 skill 不再被自动分析、patch、建版本、部署
3. dashboard：无任何演化入口可点击，配置页不再出现演化相关控件
4. 恢复：配置开关回切，演化链路按冻结前行为恢复

## 6. Interaction And Information Design

- 冻结期间 UI 隐藏而非禁用：演化相关按钮 / 标签 / 工作区不渲染
- 隐藏列表以盘点清单为准，任何新入口需先评估是否属演化能力

## 7. Product Rules And State Logic

- 冻结状态由配置决定：`tracking.evolution_frozen` 默认 `true`（默认关闭演化功能，2026-08-09 用户确认），`false` 解除冻结
- 冻结优先于一切演化门禁：冻结时不执行 eligibility / 分析 / patch / 版本 / 部署任何一步
- 冻结期间影子 skills 不物化、不更新（D5）；技能库展示保留（2026-08-09 用户纠正越界：仅冻结演化功能本体）；解冻后重启 daemon 自动补物化
- 历史演化数据（决策事件、版本历史）仍可读，仅写侧冻结

## 8. Edge Cases, Errors, And Recovery

- 冻结瞬间若有进行中的优化执行：应等待当前执行自然结束或标记中断，不留半成品版本（以技术设计为准）
- 冻结状态下用户手动操作（手动优化入口不存在，天然无此路径）
- 恢复后：无需重建任何状态，配置回切即恢复

## 9. Content And Terminology

- 演化（evolution）：指 trace -> episode -> 分析 -> 优化 -> patch -> 版本 -> 部署这条自动链路
- 冻结（freeze）：临时停用该链路且隐藏 UI，非删除

## 10. Acceptance Criteria

- 冻结开启后，构造已就绪 episode，24h 观察窗口内无新 patch / 新版本 / 新部署决策事件
- dashboard 界面无演化相关入口（对照盘点清单逐项验证）
- 配置页 / 配置文件可切换冻结开关，**切换并重启 daemon 后生效**（策略在 runtime 创建时读取）
- 恢复开关并重启 daemon 后，原演化行为（含既有门禁）恢复，无需额外操作

## 11. Review Checklist And Sign-off Questions

- 盘点清单是否覆盖全部演化写侧入口与 UI 入口？
- 冻结是否只影响演化，不影响 trace 采集与索引？
- 恢复路径是否真实可用（配置回切即恢复）？
- 是否存在绕过冻结的旁路（CLI 命令、API 路由）？

## 12. Decision Log

| Topic | Decision | Rationale | Source |
|---|---|---|---|
| 冻结方式 | 配置开关 + 主链路短路，不删代码 | 临时、可逆；保留恢复能力 | 2026-08-09 用户要求 |
| UI 处理 | 隐藏而非禁用 | 用户要求"临时隐藏" | 2026-08-09 用户要求 |
| 第一步 | 盘点（代码/UI/配置/生效路径） | 冻结前必须先明确边界 | 2026-08-09 用户要求 |
| 自动优化旁路 | `auto_optimize` 配置当前未被主链路消费（盘点确认） | 冻结实现不得依赖该失效配置，需新增真实门禁 | 盘点证据，见 technical-design §4 |
| 冻结默认值 | `tracking.evolution_frozen` 默认 `true`，默认关闭演化功能 | 用户明确"默认关指的是默认关闭演化功能" | 2026-08-09 用户确认（decisions.md D4） |
| 冻结范围边界（F2） | bootstrap 同步（origin→shadow 物化 + 版本记录，发生于项目注册/daemon 启动）属**索引同步**，不在 D1 冻结范围（D1 指 trace 驱动的自动演化写链路） | 对抗性审查发现 bootstrap 冻结时仍写版本；按 D1 定义与 §4 非目标（不冻结技能索引）归类为索引同步 | 2026-08-09 对抗性审查（vs_review F2），工程决策；**已被 D5 覆盖（superseded）** |
| 影子纳入冻结（D5） | 影子 skills 本身是演化能力的一部分：冻结期间不物化、不更新、技能库展示隐藏；解冻后自动补物化 | 用户明确"影子skills 也是为了做演化能力才加入的，本身也是演化能力的一部分，需要纳入冻结"；覆盖 F2 的索引同步豁免 | 2026-08-09 用户确认（decisions.md D5） |
| 冻结生效时机（R3） | 开关切换**重启 daemon 后生效**（策略在 runtime 创建时读取），非即时热切换 | 实现事实；§10 验收措辞已校准 | 2026-08-09 对抗性审查 closure（vs_review R3） |
