# OrnnSkills V2.0 PRD

**版本**: 2.0  
**日期**: 2026-04-19  
**状态**: Draft / Ready for product and engineering breakdown

## 1. 背景

OrnnSkills 1.0 的核心定义是 `Skill Evolution Agent`：监听宿主 trace，围绕项目级 shadow skill 做自动优化、版本记录和回滚。这套能力验证了一个重要前提:

- 用户确实需要 skill 演进，而不是只会“下载 skill”
- 项目级隔离、版本历史、回滚、trace 证据链是刚需
- 仅强调“自动优化”仍然过窄，用户还缺少对 skill 全生命周期的可视化理解和管理能力

1.0 的主要短板不是“不会优化”，而是“不会管理”:

- 用户不知道自己本机到底有多少 skills
- 用户不知道 skills 分布在哪些宿主、哪些项目
- 用户不知道哪些 skills 真正被使用、哪些长期闲置
- 用户不知道一个 skill 到底带来了多少价值，是否值得继续维护
- 用户缺少一个围绕 skill 的集中入口来安装、备份、迁移、演进和创建
- 用户缺少一个足够可见、足够易用的 dashboard，导致能力虽然存在，却仍然像“开发者工具箱”而不是“普通人可管理的产品”

因此，V2.0 的产品方向从“只做 skill 演进”升级为:

**一个开源、本地优先、跨宿主、可视化的 Skill 生命周期与演进管理器。**

## 2. 一句话定位

OrnnSkills V2.0 是一个把 `skill` 当作一等公民的本地管理工具。它帮助个人用户扫描、理解、管理、评估和演进分散在多个 AI 宿主与项目中的 skills，让 skills 不只是“装上去”，而是“用得省心、用得明白、持续变好”。

## 3. 产品边界

### 3.1 我们是什么

- 开源、本地优先的个人 SkillOps 工具
- 面向 Codex、Claude Code、OpenCode 等宿主的跨宿主 skill 管理层
- 以可视化方式提供 inventory、usage、evaluation、evolution、backup、migration、creation

### 3.2 我们不是什么

- 不是另一个通用 AI 聊天平台
- 不是以团队协作、审批、权限、云端治理为核心的企业产品
- 不是 prompt、MCP、plugin 的全能资产平台
- 不是只负责下载与安装 skill 的 marketplace 壳

## 4. 目标用户

### 4.1 核心用户

- 高强度使用 AI coding tools 的个人开发者
- 同时使用两个及以上宿主的用户，例如 Codex + Claude Code
- 本机维护较多 skills，希望减少失控和重复维护的用户

### 4.2 次级用户

- 重度试验新 skill 的独立开发者
- 维护个人 skill 库、需要迁移与备份的用户
- 想要量化 skill 真实使用价值的高级用户

### 4.3 非目标用户

- 以团队协作、审批流、权限分级为核心诉求的组织用户
- 只需要简单下载几个 skill、不关心管理和演进的轻度用户

## 5. 核心用户问题

V2.0 必须优先回答用户的 6 个问题:

1. 我本机到底有多少 skills，分别在哪里？
2. 它们被哪些宿主、哪些项目使用？
3. 哪些 skills 真正有用，哪些几乎没被触发？
4. 哪些 skills 值得继续优化，为什么？
5. 如果我要安装、卸载、迁移、备份一个 skill，最安全的路径是什么？
6. 我改动一个 skill 之后，它到底变好了还是变差了？

## 6. 产品目标

### 6.1 V2.0 北极星目标

让用户第一次可以清晰、持续、低成本地管理自己本机的 skill 生命周期，并对 skill 的真实使用价值与演进效果建立可验证认知。

### 6.2 业务目标

- 把 OrnnSkills 从“后台优化器”升级为“用户愿意每天打开的本地 skill 控制台”
- 建立 `scan -> understand -> manage -> evolve -> verify` 的完整闭环
- 用开源和本地优先建立信任，用可视化和证据链建立可用性

### 6.3 用户价值目标

- 降低 skill 管理成本
- 降低 skill 冗余与失效风险
- 提升 skill 使用透明度
- 提升产品的可见性与易用性，让普通用户不依赖命令行也能完成主要任务
- 提升 skill 演进的质量和可解释性

## 7. 产品原则

### 7.1 Skills Are First-Class

所有核心导航、数据模型、指标、操作入口都围绕 `skill` 展开，skill 不是附属对象。

### 7.2 Local-First

- 默认本地运行、本地索引、本地存储
- 默认不依赖云端账号和远程控制面
- 数据导入导出、备份、恢复都要在本地可完成

### 7.3 Open Source as Trust Infrastructure

开源不是营销标签，而是信任机制。用户应能看见:

- 扫描逻辑
- 指标计算逻辑
- 演进依据
- 数据落盘位置

### 7.4 Evidence Over Guessing

所有“这个 skill 有价值”或“这个 skill 该优化”的结论，必须能回溯到具体证据:

- 调用记录
- 项目分布
- 失败/绕开/重试信号
- 版本前后变化

### 7.5 Visual First

CLI 仍然保留，但 V2.0 的核心使用现场必须是 dashboard。用户应该通过界面完成绝大多数关键动作，而不是通过命令行、配置文件或读代码来理解产品。

### 7.6 Dashboard-First, Not CLI-First

- dashboard 是产品主入口，而不是“给 CLI 打辅助的展示层”
- skill 管理、状态理解、价值判断、生命周期操作都应优先在 dashboard 内完成
- CLI 主要承担补充、调试、自动化和高级用法，不应成为核心产品体验前提

### 7.7 Usable Beyond Power Users

- 不能把产品设计成“一杆子买卖”的典型开源工具
- 不能默认用户会读文档、改配置、跑命令、看源码
- 主要任务路径必须对普通用户友好，文案和交互要先解释“这是什么、为什么重要、下一步做什么”

### 7.8 Safe Change

所有高影响操作都必须可预览、可备份、可回滚，包括:

- 演进应用
- 批量迁移
- 卸载
- 平移到其他宿主

## 8. V2.0 范围

### 8.1 P0 核心价值

V2.0 的 P0 核心价值不是单一“演进器”，而是一个以 dashboard 为中心的 skill 管理闭环:

- 看清楚: 用户能一眼看见自己有哪些 skill、在哪、有没有被用
- 管明白: 用户能安全完成安装、卸载、备份、迁移、启停等核心操作
- 优起来: 用户能识别哪些 skill 值得优化，并在证据支持下进行演进

其中，`演进管理` 是 P0 里的关键能力之一，但不是唯一主角。

### 8.2 V2.0 P0 能力范围

以下能力均属于 V2.0 发布范围内的 P0:

- dashboard 作为主使用现场的整体信息架构与关键交互
- 全局扫描与统一索引
- 多宿主、多项目 skill inventory
- 可视化 usage 与最近活跃情况
- 可解释的 skill 效果评估
- 基于 trace 的演进建议与演进执行
- 版本、diff、快照、回滚
- 安装、卸载、启停、备份、恢复、迁移、平移
- 本地创建 skill 的辅助流程

### 8.3 明确不在 V2.0 的范围

- 团队权限、审批、协作评论
- 云端同步账户体系
- 在线 marketplace 运营体系
- 通用 prompt/MCP/plugin 的一等治理能力
- 黑盒式“自动重写一切”优化器

## 9. 关键使用场景

### 场景 A: 盘点本机 Skill 资产

用户打开 dashboard 后，第一屏就能看到:

- 本机总 skill 数
- 活跃 / 非活跃 / 未知状态占比
- 宿主分布
- 项目分布
- 最近 7/30 天最常用 skills

### 场景 B: 发现低价值或失效 Skill

用户可以快速识别:

- 安装了但从未调用的 skill
- 曾活跃但近期消失的 skill
- 多个近似重复 skill
- 调用频率高但效果差的 skill

### 场景 C: 针对单个 Skill 做演进决策

在单个 skill 详情页中，用户能够看到:

- 来源和安装位置
- 被哪些宿主和项目使用
- 调用频率趋势
- 典型触发场景
- 绕开、重试、人工修正等负向信号
- 版本历史与演进记录
- 当前建议的优化方向

### 场景 D: 生命周期管理

用户可以在一个界面里完成:

- 安装到指定宿主
- 从某宿主卸载
- 暂停 / 恢复某 skill
- 备份到本地包
- 恢复或导入
- 从一个宿主平移到另一个宿主

### 场景 E: 普通用户完成首次管理闭环

第一次使用的用户不需要会命令行，也不需要先理解底层目录结构。系统需要通过 dashboard 引导其完成:

- 首次扫描
- 理解 skill 总量与状态
- 找到 1 个高价值或低价值 skill
- 完成一次安全操作，例如备份、禁用或迁移
- 理解“演进”在整个产品中的位置和作用

### 场景 F: 创建新 Skill

用户可以通过 guided flow 创建 skill:

- 选择目标宿主
- 选择模板或从现有 skill 派生
- 填写用途、触发方式、步骤、边界
- 本地预览与保存

## 10. 信息架构

V2.0 的主界面采用 3 个一级页面，不再保留单独“主页”，而是把 skill 与项目两个工作现场并列成一级入口，统一收口到围绕 skill 生命周期管理的主工作流中:

### 10.1 一级页面

1. `技能`
   - 面向全局 skill 资产的主入口
   - 默认展示 `Skill Family` 级别的技能库
   - 承担 skill 管理、使用判断、实例分布查看、修订历史和演进入口
2. `项目`
   - 面向单项目实例治理的主工作台
   - 带项目侧边导航
   - 进入某个项目后查看该项目里的 `Skill Instance`、活动、成本与日志
3. `配置`
   - 平台级配置能力
   - 宿主扫描、模型服务、默认策略、路径与兼容选项

### 10.2 技能页与项目页的职责拆分

`技能` 与 `项目` 不再共享同一个一级页内的子视图，而是各自承担清晰职责:

1. `技能`
   - 不显示项目侧边导航
   - 列表单位是 `Skill Family`
   - 用户先看“这个 skill 整体有没有价值、分布在哪、值不值得继续维护”
2. `项目`
   - 显示项目侧边导航
   - 进入某个项目后再看该项目里的 `Skill Instance`
   - 用户先看“这个项目里有哪些技能实例、哪个实例需要处理”

### 10.3 两个一级工作区下的职责分工

`技能` 页负责回答:

- 这个 skill 整体是否活跃
- 它横跨多少项目和宿主
- 有没有内容分叉或宿主漂移
- 值不值得继续优化、保留或清理

`项目` 页负责回答:

- 这个项目里有哪些技能实例
- 每个实例部署在哪个宿主
- 当前实例是否启用、漂移、失效
- 应该对哪个实例执行启停、迁移、回滚或演进操作

### 10.4 导航与层级规则

- 一级 tab 顺序固定为 `技能 -> 项目 -> 配置`
- 项目侧边导航只出现在 `项目`
- `技能` 和 `配置` 不带项目侧边导航
- `技能库` 的主列表单位是 `Skill Family`，不是实例，也不是 shadow
- `项目` 的主列表单位是“项目内的 skill family 组”，组内再展示宿主实例
- 任一详情页都必须支持 `Skill Family -> Skill Instance` 的下钻，以及从实例返回 family 视图
- 默认不把 `shadow skill` 作为面向普通用户的核心术语

## 11. 功能需求

### 11.1 Skill Identity & Domain Modeling

系统需要先把“一个 skill 到底是什么”定义清楚，不能继续用单一 `skill_id` 同时表达 family、实例、修订和内容版本。

功能要求:

- 默认把 `Skill Family` 作为 UI 与产品语义中的“skill”
- 把 `Skill Instance` 作为安装、启停、迁移、卸载、平移等操作的目标对象
- 把 `Skill Revision` 作为单实例的演进历史对象
- 把 `Skill Release` 作为跨实例可复用的内容基线对象，V2.0 P0 可先内部使用
- 把 `Usage Facts / Usage Summary` 作为使用观察对象，不能再直接拿 `traceCount` 代替“被使用次数”
- 所有指标都要明确说明是 `family 级` 还是 `instance 级`
- 对 identity 无法 100% 确定的 skill 归并结果，允许保留置信度与归并依据

### 11.2 Skill Discovery & Indexing

系统需要:

- 扫描本机已支持宿主中的 skills
- 识别 skill 来源、路径、宿主、项目归属
- 对同名 skill、多副本 skill、派生 skill 建立统一索引
- 支持定时扫描与手动重扫

功能要求:

- 首次扫描后生成本地索引
- 每个 `Skill Family`、`Skill Instance` 都具备稳定 ID，而不是只靠文件名
- 支持显示 `origin`, `shadow`, `derived`, `imported` 等来源标签

### 11.3 Usage Observability

系统需要为每个 skill 提供最基础、最可信的使用观察能力:

- 调用次数
- 最近使用时间
- 被哪些宿主调用
- 被哪些项目调用
- 调用趋势
- 典型触发上下文

功能要求:

- 区分“安装存在”和“实际使用”
- 区分“被使用”“被观察到”“被分析”“被优化”四类不同事实
- 支持 7 天、30 天、全周期时间窗
- 支持按宿主、项目、来源筛选

### 11.4 Effect Evaluation

V2.0 不追求一开始给出绝对准确的“收益金额”，而是先建立可信代理指标。

系统需要为每个 skill 计算以下信号:

- `Reach`: 覆盖项目数、宿主数、总调用数
- `Recency`: 最近活跃时间、活跃周期
- `Stickiness`: 连续复用程度
- `Effectiveness`: 调用后任务是否推进，是否伴随大量 retry / bypass / manual fix
- `Cost`: 维护频率、上下文负担、重复度、噪音度

功能要求:

- 输出可解释的 `Skill Value Score`
- Score 必须能下钻到明细证据
- 所有判定保留“估计值”标签，避免制造虚假精度

### 11.5 Evolution Management

这是 V2.0 的核心模块。

系统需要:

- 基于 trace 和负向信号识别演进机会
- 生成可预览的演进建议
- 展示变更原因、证据和预期影响
- 应用到目标 skill 或 project shadow
- 记录版本、diff、审计日志
- 跟踪演进后效果变化

功能要求:

- 演进建议必须包含证据摘要
- 支持只读预览，不强制自动应用
- 支持 compare before/after
- 支持一键回滚到任一稳定版本

### 11.6 Lifecycle Operations

V2.0 需要把“技能资产管理”的基础动作做完整。

系统需要支持:

- 安装
- 卸载
- 启用 / 禁用
- 备份
- 恢复
- 导入 / 导出
- 宿主间迁移
- 项目间平移

功能要求:

- 每个操作都要先校验目标路径与冲突
- 卸载前提示影响范围
- 平移操作需保留来源记录
- 备份格式需稳定、可重复恢复

### 11.7 Skill Creation

V2.0 将 skill 创建视为辅助能力，而非独立平台功能。

系统需要:

- 提供模板化新建
- 支持从现有 skill fork
- 支持创建后立即安装到指定宿主
- 支持创建后纳入 OrnnSkills 的观测与演进体系

### 11.8 Visualization & UX

可视化不是装饰层，而是重要价值本身。

V2.0 需要重点保证:

- 首屏 10 秒内看懂自己的 skill 全貌
- dashboard 内可以直接完成核心管理动作，而不需要跳到命令行
- 单个 skill 详情页能回答“有没有用”和“值不值得改”
- 所有高风险操作都有清晰确认与回退路径
- 不要求用户理解底层目录结构即可完成主要动作
- 不把界面做成面向少数开发者的控制台堆叠，而是要让普通用户也能顺畅使用
- 默认视角要优先让用户看到 `Skill Family`，只有在需要操作某个安装副本时再下钻到 `Skill Instance`
- 允许同时存在 `Skill 视角` 和 `项目视角`，但两者职责必须清晰，不能混成一个模糊列表

## 12. 宿主与平台策略

### 12.1 宿主优先级

V2.0 首批优先支持:

- Codex
- Claude Code
- OpenCode

第二批适配候选:

- Continue
- Cursor 相关 skill/rules 体系

### 12.2 跨平台原则

产品方向必须坚持跨平台，本阶段要求:

- 路径解析、扫描器、索引格式不能绑定单一平台
- 备份与导入导出格式必须跨平台可恢复
- UI 与 CLI 行为不依赖特定平台特性

工程优先级上，V2.0 应保证 macOS 和 Linux 可用，并为 Windows 路径与宿主差异预留清晰适配层。

## 13. 数据模型

### 13.1 Skill Family

`Skill Family` 是用户认知中的“同一个 skill 家族”，也是 Skills 页默认列表单位。

至少需要具备:

- `family_id`
- `skill_key`
- `display_name`
- `publisher` 或等价来源命名空间
- `source_kind`
- `first_seen_at / last_seen_at`
- `identity_confidence`

### 13.2 Skill Instance

`Skill Instance` 表示某个 skill 在某个项目、某个宿主、某个安装路径里的一个安装副本。

至少需要具备:

- `instance_id`
- `family_id`
- `project_id`
- `runtime`
- `install_path`
- `managed_by_ornn`
- `status`
- `installed_at`
- `first_seen_at / last_seen_at`
- `current_content_digest`

### 13.3 Skill Revision

`Skill Revision` 表示某个 instance 的本地修订历史，不再与 family 级版本混用。

至少需要具备:

- `revision_id`
- `instance_id`
- `revision_no`
- `content_digest`
- `created_at`
- `created_by`
- `is_effective`
- `is_disabled`
- `based_on_release_id` 或等价基线引用

### 13.4 Skill Release

`Skill Release` 是跨实例可共享的内容基线，用于表达“多个实例其实源于同一份内容”。

V2.0 P0 可以先内部使用，但模型上需要预留:

- `release_id`
- `family_id`
- `content_digest`
- `source_ref`
- `source_version`
- `created_at`

### 13.5 Usage Facts 与 Usage Summary

使用监控不能再只依赖 `traceCount` 这类内部统计值，需要把“使用事实”和“汇总结论”拆开。

`Usage Facts` 至少需要具备:

- `timestamp`
- `family_id`
- `instance_id`，允许为空
- `runtime`
- `project_id`
- `evidence_type`
- `confidence`
- `trace_id / session_id / scope_id`

`Usage Summary` 至少需要具备:

- `total_calls`
- `calls_7d`
- `calls_30d`
- `last_used_at`
- `projects_using_count`
- `runtimes_using_count`
- `negative_signal_count`
- `active_state`

### 13.6 唯一性与身份规则

V2.0 不再用一个 `skill_id` 解决所有唯一性问题，而是至少区分三类唯一性:

1. `family_id / skill_key`
   - 解决“这是不是同一个 skill 家族”
2. `content_digest`
   - 解决“这是不是同一份内容”
3. `instance_id`
   - 解决“这是不是同一个安装实例”

### 13.7 Variant 策略

`Variant` 只用于表达同一 family 下较稳定、长期存在的分支形态，例如:

- 面向不同宿主的稳定版本
- `lite / strict` 一类长期维护的功能变体

V2.0 P0 不强制把 `Variant` 作为一等公开对象，但需要在模型中预留:

- `variant_label`
- `target_runtime`
- `family_role`

## 14. 成功指标

### 14.1 产品使用指标

- 用户首次扫描成功率
- 首次扫描后看到结果页的时间
- 每周打开 dashboard 的活跃用户占比
- 用户在不使用 CLI 的情况下完成首次关键任务的比例
- 被实际使用过的 skill 占总 skill 数的比例

### 14.2 核心价值指标

- 被识别为“长期未使用”的 skill 数量
- 被识别为“高价值”的 skill 数量
- 被应用演进建议的 skill 数量
- 演进后 value score 或效果信号改善的 skill 占比

### 14.3 体验指标

- 用户完成安装 / 卸载 / 备份 / 恢复 / 迁移的成功率
- dashboard 内直接完成关键操作的占比
- 因误操作导致的回滚次数
- 单次关键操作的平均完成时间

## 15. 风险与对策

### 风险 1: “价值评估”过度主观

对策:

- 先采用透明代理指标，不直接承诺绝对收益
- 每个评分都可展开证据
- 保留用户校正入口

### 风险 2: 宿主差异导致扫描和统计不稳定

对策:

- 建立宿主适配层
- 所有证据和指标都标注来源宿主
- 未知或不完整数据明确标成 `partial`

### 风险 3: 演进建议不可信

对策:

- 默认预览优先
- 强化 diff、证据和回滚能力
- 演进效果必须在后续使用中继续验证

### 风险 4: 功能过宽，失去焦点

对策:

- 所有功能以 `skill lifecycle + evolution` 为中心判断取舍
- 不扩展成通用 AI 平台
- 不优先建设团队协作能力

## 16. 发布策略

### 16.1 V2.0 MVP

第一阶段需要交付一个最小但完整的闭环:

- 以 dashboard 为主入口的核心管理流程
- 扫描并统一展示 skills
- Skills 页具备 `技能库` 与 `项目工作台` 两种视角
- 能按 `Skill Family` 看全局资产，也能按 `Skill Instance` 处理项目内副本
- 展示调用频率和活跃信息
- 提供单 skill 详情页
- 提供基础演进建议与版本回滚
- 支持备份、恢复、迁移

### 16.2 V2.0 完整版

在 MVP 基础上补齐:

- 更完整的价值评估
- 更好的差异比较与演进前后验证
- 引导式新建 skill
- 更强的宿主兼容与数据修复能力

## 17. Open Questions

- Skill Value Score 的默认权重是否应允许用户调整？
- “平移”在不同宿主语义差异较大时，是否需要显式转换器而不只是复制？
- 新建 skill 的模板系统是否需要兼容 Agent Skills 标准格式？
- 是否需要把 prompt/rules/MCP 作为 skill 的关联资产展示，而不是一等对象？
- `Variant` 何时从内部字段升级为用户可见的一等对象？

## 18. 结论

OrnnSkills V2.0 的目标不是再做一个平台型 AI 客户端，而是成为个人用户管理本地 skills 的首选入口。它的核心不是“帮你下载更多 skill”，而是“帮你知道哪些 skill 真有用，如何安全管理它们，并让高价值 skill 持续演进”。
