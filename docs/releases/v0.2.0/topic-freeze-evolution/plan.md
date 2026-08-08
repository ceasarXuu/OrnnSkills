# 冻结演化功能 Engineering Plan

- Product Authority: `./decisions.md`
- Applicable Decisions: D1, D2, D3, D4
- Release Version: v0.2.0（计划中，未发布）
- Topic PRD: `./prd.md`
- Topic Technical Design: `./technical-design.md`
- Created: 2026-08-09
- Updated: 2026-08-09

## 1. Execution Contract

- 产品权威来源为 `./decisions.md`，其中 active 决策（D1-D3）是用户权威；修改 active 产品决策必须经用户明确批准，禁止 Agent 自批。
- 已验证的工程证据可以修订本 `plan.md`，不得静默改写产品权威；证据与权威冲突时暂停并向用户直接复核。
- 新的 material 产品选择（见 §4 Pending Product Decisions）一律 defer、provisional 或用户确认，不得通过实现获得权威。
- 每个 material 阶段完成后，只审计该阶段的产品决策增量（§7 Product Decision Delta），并分类为 covered / engineering-only / provisional / conflict；存在 material provisional 或 conflict 时，依赖它的下游工作不得继续。

## 2. 背景与现状

v0.1.13 的演化功能是隐式副作用流水线：`Observer -> Daemon -> ShadowManager.processTrace() -> ShadowTraceIngestService -> ShadowEpisodeProbeService -> ShadowOptimizationRunner`（analyzer -> eligibility -> patch -> 版本 -> 部署）。该链路缺少显式产品状态，`tracking.auto_optimize` 配置存在但主链路不消费。在 v0.2.0 重新设计演化闭环之前，按 D1-D3 冻结现有演化功能。

盘点（D3）已完成，证据见 `technical-design.md` §3：

- 写链路：单条自动链，`ShadowManualOptimizeService` 无外部调用方（死代码）
- UI 入口：仅配置页「演进策略」子 tab（`config-workspace.tsx:81`）需隐藏；活动流/演化工作区已随 v0.1.13 回滚不存在，手动优化 API 不存在
- 配置现状：`tracking.auto_optimize`（默认 true）主链路不消费，冻结不得依赖该失效配置

## 3. 目标 / 非目标 / 假设

### 目标

- 冻结开启后自动演化写链路零触发（D1）
- 演化 UI 入口临时隐藏（D2）
- 冻结可逆：配置驱动，回切即恢复，不删代码（D1 推论）

### 非目标

- 不删除/重写演化代码
- 不重设计演化闭环
- 不冻结 trace 采集、技能索引、版本读取/停用、配置编辑

### 假设

- A1：冻结判定放执行链最前即可覆盖全部自动触发路径（盘点确认只有单条链，风险低）
- A2：进行中的优化执行可自然结束，不产生半成品版本（执行链无并发挂起路径）
- A3：`config-workspace` 隐藏「演进策略」tab 不破坏配置自动保存与模型 tab 行为

## 4. Pending Product Decisions

| ID | Decision Surface | Current / Proposed Behavior | Why Material | Evidence | Impact If Changed |
|---|---|---|---|---|---|
| P2 | 解冻入口 | 建议仅配置文件维护，不暴露 UI（defer：当前工作可保持） | 影响用户控制/可逆性（D1 相关） | 配置页无 tracking 开关先例 | 若需 UI，增加配置页开关控件与契约测试 |
| P3 | 冻结期间进行中执行 | 不中断已开始执行（判定在执行链最前，defer） | 影响状态一致性 | 执行链无挂起路径（A2） | 若改为强制中断，需中断协议与半成品清理 |
| P4 | 历史演化数据展示 | 读侧保留（决策事件/版本历史仍可读），仅写侧冻结（defer） | 影响可见性边界 | PRD §7 草案 | 若隐藏读侧，影响技能详情/项目视图 |

已确认决策：P1（冻结开关命名与默认值）于 2026-08-09 由用户确认，落为 `decisions.md` D4：`tracking.evolution_frozen` 默认 `true`（默认关闭演化功能），命名由维护者确定。

## 5. 最小构造技术设计

摘要（完整设计与盘点见 `technical-design.md`）：

- 冻结开关：`~/.ornn/config/settings.toml` 新增 `[tracking] evolution_frozen`（默认 `true`，即默认关闭演化功能，D4），经 dashboard-config schema 读入
- 写侧短路（双保险）：`ShadowEpisodeProbeService` episode 就绪后、调用 runner 前检查冻结开关，跳过并记录 `evolution_frozen` 决策事件；`ShadowOptimizationRunner` 入口同样检查防御旁路
- UI 隐藏：`config-workspace.tsx` 不渲染「演进策略」TabsTrigger（TabsList 只保留「模型」）
- 恢复：`evolution_frozen = false` 即恢复，无状态迁移

构造原则：沿既有配置读取链（configManager -> policy）与既有服务入口修改，不新增抽象、不新增依赖、不引入新状态机。

## 6. Work Units

| ID | Objective | Change Axis | Change Location | Target Object | Concrete Action | Resulting Behavior | Benefit | Side Effects | Verification | Safe Stop / Rollback | Plan Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| W1 | 完成冻结前盘点（D3） | 文档 | `docs/releases/v0.2.0/topic-freeze-evolution/technical-design.md` §3 | 盘点清单 | 记录演化代码/UI/生效路径/配置现状 | 冻结边界明确 | 冻结实现有据可依 | 无 | 已核对源码与路由（盘点证据） | 已完成，不需要回滚 | verified |
| W2 | 冻结开关配置落地（D4） | 配置 schema | `src/config/dashboard-config-types.ts` / `dashboard-config.ts` / `generator.ts` / `defaults.ts` | `evolution_frozen` 字段 | 新增字段（默认 `true`），写入/读取 settings.toml，旧配置缺失按默认 | 配置可声明冻结状态，默认冻结演化 | D4 落地：默认关闭演化 | 复杂度：+1 配置字段；config 单测需覆盖默认与读写 | 配置读写单测 + 现有 config 测试回归 | 回滚：撤销字段改动，无迁移 | planned |
| W3 | 主触发链冻结短路（D1） | 行为短路 | `src/core/shadow-manager/episode-probe-service.ts` | 就绪判定后的 runner 调用点 | 冻结检查：冻结则跳过 runner，记录决策事件 | 冻结时自动分析/优化不再触发 | D1 核心达成 | 复杂度：+1 分支 + 1 事件类型；决策事件读侧兼容无需改 | 单测：就绪 episode + 冻结=true 不触发 runner；冻结=false 行为不变 | 回滚：删除短路分支 | planned |
| W4 | runner 入口防御短路（D1） | 行为短路 | `src/core/shadow-manager/optimization-runner.ts` | run 入口 | 入口冻结检查，冻结直接 skip | 旁路路径也无法执行优化 | 双保险，防未来旁路 | 复杂度：+1 分支 | 单测：直接调用 runner 冻结时 skip | 回滚：删除短路分支 | planned |
| W5 | 演化 UI 隐藏（D2） | 渲染分支 | `frontend-v3/src/components/config-workspace.tsx` | 「演进策略」TabsTrigger | 不渲染演化 tab | 配置页只显示「模型」tab | D2 核心达成 | 复杂度：-1 tab；契约测试需同步 | 契约测试：演化 tab 文案不出现；配置模型 tab 与自动保存回归 | 回滚：恢复 TabsTrigger | planned |
| W6 | 冻结态零副作用验证 | 回归验证 | 测试 + 运行时 | 冻结行为 | 构造 episode 就绪场景，验证无 patch/新版本/部署事件；开关回切验证恢复 | 冻结与恢复均被验证 | 完成定义达成 | 无 | vitest 回归 + `npm run test:smoke` | 不适用 | planned |

## 7. 阶段与 Product Decision Delta

| Phase | 内容 | 进入条件 | 适用决策 | 退出条件 |
|---|---|---|---|---|
| A | 盘点 | D3 | D3 | 盘点清单经源码核对（已完成，W1） |
| B | 配置 + 写侧短路 | A 完成（P2-P4 按 defer 默认执行） | D1, D4 | W2-W4 单测通过 |
| C | UI 隐藏 | B 完成 | D2 | W5 契约测试通过 |
| D | 验证与恢复 | C 完成 | D1, D2 | W6 通过，完成定义达成 |

### Product Decision Delta 审计（每个阶段完成后填写）

| Phase | Decision Surface | Implemented / Observed Semantics | Authority Coverage | Classification | Required Action |
|---|---|---|---|---|---|
| A | 盘点范围 = 冻结边界 | 单条写链路 + 1 个 UI tab（technical-design §3） | D1, D2 | covered | 无 |
| B | 冻结开关默认值（默认关闭演化） | 已确认 `evolution_frozen` 默认 `true`（待实现后更新 Observed） | D4 | covered | 无 |
| C | UI 隐藏范围 | （待实现后填写） | D2 | （待填写） | （待填写） |
| D | 冻结/恢复行为 | （待实现后填写） | D1, D2, D4 | （待填写） | （待填写） |

## 8. 验证策略

- 最小预投资验证：冻结实现范围小、可逆，不需要额外预验证；假设 A1-A3 由盘点证据与既有测试覆盖
- 单元级验证：W2-W4 单测、W5 契约测试（见各工作单元 Verification 列）
- 阶段门禁：`npm run test:smoke`（typecheck + 契约测试 + runtime smoke）
- 冻结态验证（W6）：构造 episode 就绪场景，观察窗口内无新 patch/版本/部署决策事件；恢复开关后行为即时恢复

## 9. 风险与应对

| 风险 | 应对 | 证据 |
|---|---|---|
| 遗漏旁路导致冻结不彻底 | W3+W4 双保险短路；盘点清单回归核对 | technical-design §3 |
| 冻结误伤 trace 采集/索引 | 冻结点严格限定 runner 触发处 | A1 |
| 失效配置 `auto_optimize` 误导 | 文档显式标注，冻结实现用新配置 | technical-design §3.5 |
| 进行中执行残留 | 判定在执行链最前，不中断已开始执行 | A2 |

## 10. 计划状态

- Plan validity: `valid`（A 阶段证据充分；P2-P4 以 defer 默认执行，不阻塞）
- Execution Tracking: A `verified`；B-D `not-started`
- Plan Authoring: `planned`
