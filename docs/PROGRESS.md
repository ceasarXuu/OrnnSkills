# OrnnSkills 项目进度

## 📊 总体进度：Phase 1 ✅ 完成

### 2026-04-15
- ✅ 收紧 dashboard 首屏启动负载：初始化阶段不再预取配置页专属依赖，`provider catalog / provider health / project config` 改为进入配置 tab 后按需加载；避免总览首屏还没打开配置，就先拉取近 1MB 的模型目录和连通性数据
- ✅ 重构 dashboard SSE 首次握手协议：`/events` 初始连接不再给每个客户端推全量 `projectData`，并把“已见快照版本”从服务端全局状态改成按客户端维护；新客户端不会再触发一次全量快照解析，也不会污染其他客户端的增量版本基线
- 📝 记录性能经验：dashboard 首屏的事实来源应该是“最小可见面板需要的数据”，不是“所有 tab 未来可能用到的数据”；像配置 catalog、provider health、全量 project snapshot 这种重对象，必须延迟到对应交互时再拉
- 📝 记录架构经验：SSE 的增量游标如果做成全局共享状态，新客户端接入时很容易错误重置或跳过旧客户端还没消费的更新。正确抽象是把版本基线绑定到客户端连接本身，广播时按客户端计算增量，而不是偷懒维护一个全局 `lastVersion`

### 2026-04-13
- ✅ 抽出共享分析协调层：新增 `window-analysis-coordinator`，统一负责 `analyzeWindow()` 调用、超时控制以及 `evaluation / nextWindowHint` 的 fallback 归一；`OptimizationPipeline`、`ShadowManager` 的自动窗口分析和手动窗口分析现在共用同一套 analyzer 协议
- 📝 记录架构经验：只共享 window 对象还不够，如果不同入口继续各自包装 `analyzeWindow()`，fallback 评估、超时语义、失败处理很快又会分叉。长期主义的做法是把“分析调用协议”本身也抽成共享协调层，让 orchestrator 只处理业务状态流转
- ✅ 抽出共享窗口恢复层：新增 `session-window-candidates` 负责从 `recent sessions -> full session timelines` 恢复真实分析窗口候选，新增 `createSkillCallWindow()` 负责统一标准化窗口对象；`OptimizationPipeline` 与 `ShadowManager` 不再各自内联维护一套 window 构造规则
- 📝 记录架构经验：只修某一条分析入口还不够，只要“窗口恢复”和“窗口对象规范化”散落在多个 orchestrator 里，系统就迟早再次分叉。长期主义的做法是把“窗口如何被恢复、如何被标准化”抽成共享能力，再让上层编排模块只关心何时分析、如何处理结果
- ✅ 重构 legacy `OptimizationPipeline` 的窗口恢复模型：pipeline 现在不再走 `recent batch -> skill group -> mapped-only traces` 的伪窗口拼装，而是统一改成 `recent sessions -> full session timeline -> session-backed window candidate`；拿不到完整 session timeline 时宁可跳过，也不再把 mapped trace 伪装成真实分析窗口
- 📝 记录架构经验：只要分析器依赖“上下文窗口”的语义，就不能从按 skill 聚合的 recent batch 直接合成窗口；正确抽象必须先恢复真实 session 时间线，再在时间线上派生 skill candidate。否则即使接口上叫 `window`，本质仍然是伪时间线，迟早会产出高置信度的错误结论
- ✅ 收紧实时追踪的业务事件契约：`DecisionEventRecord` 现在由后端直接写出 `businessCategory / businessTag / inputSummary / judgment / nextAction` 等 canonical 业务语义字段，dashboard 不再需要仅靠原始 tag 和状态去猜测“这是不是核心流程节点”
- ✅ 重构分析链路的业务产出：`ShadowManager` 在 `analysis_requested / evaluation_result / skill_feedback / patch_applied / analysis_failed` 各生产点统一写出业务层语义，明确区分 `core_flow / supporting_detail / stability_feedback`，并把“下一步动作”一并沉淀到事件里
- ✅ 收紧实时追踪消费层：活动表现在优先消费后端给出的 canonical 字段，只保留旧 tag 归一作为兼容兜底；同 scope 的 supporting detail 会并入主结论行，避免 UI 再重复维护一套独立的业务判断规则
- 📝 记录恢复经验：业务可观测性不能建立在 dashboard 的二次推断上；只要“业务语义定义”和“展示逻辑”分散在后端与前端两边，时间一长就一定出现看板漂移。正确做法是让生产侧直接产出 canonical 业务事件，前端只做展示和轻量兼容
- 📝 记录工程经验：给 dashboard 这种用户核心界面做重构时，测试不能只盯 HTML 片段；还要在生产侧断言事件 schema 自身的业务语义字段，否则很容易出现“界面暂时对了，但持久化链路里根本没有稳定事实来源”的假修复

### 2026-04-12
- ✅ 补齐实时追踪技能跳转：活动表的技能列现在支持直接点击打开现有技能编辑弹窗，优先按事件宿主匹配 skill，匹配不到时回退到同名 skill，避免排查活动后还得手动切回技能列表再搜索
- 📝 记录恢复经验：dashboard 的“横向跳转”不该只存在于主列表页面；像实时追踪这种排障高频入口，如果技能名只是纯文本，用户会在“看到问题 -> 定位技能 -> 打开编辑”之间多做一次上下文切换，排查效率会明显下降
- ✅ 修复实时追踪时间列时区偏差：活动表时间戳不再直接截取 ISO 字符串中的 `HH:mm:ss`，现在统一按宿主本地时区格式化，避免看板时间与系统本地时间相差整时区
- 📝 记录恢复经验：界面里展示时间时不要偷懒切字符串，尤其 trace / event 这类后端常用 UTC ISO 落盘的场景；列表时间一旦不做本地时区转换，用户第一直觉就是“时间不对”而不是“数据是 UTC”
- ✅ 收紧 dashboard 初始化容错：项目 snapshot 已拿到但某个 tab/字段渲染异常时，不再把整个页面打回“初始化失败”；现在会降级为项目级错误面板，并把客户端错误加入上报队列，避免单点渲染异常阻断整站可用性
- 📝 记录恢复经验：dashboard 初始化不要把“项目数据获取”和“项目面板渲染”绑定成同一个致命步骤；前者成功、后者失败时应该保留页面骨架并展示局部降级结果，否则用户看到的会是“服务起不来”，而不是“某个渲染分支炸了”
- ✅ 补齐实时追踪决策事件兼容层：活动表现在会把历史 `skill_evaluation` 事件归一到 `evaluation_result`，并为 `patch_applied` 提供中英文标签与摘要，避免旧事件或补丁事件在看板上直接裸露成 `skill_evaluation / patch_applied` 这类原始工程 tag
- 📝 记录恢复经验：决策事件 schema 演进后，dashboard 不能假设 tag 永远只会有“最新命名”；活动表这种用户一眼可见的界面至少要做旧别名归一和关键事件本地化，否则后端链路虽然恢复了，前端仍会给人“功能没恢复”的错觉
- ✅ 修复 daemon `Traces processed` 状态滞后：trace 成功处理后现在会快速刷新 checkpoint；同时 dashboard 读侧在 checkpoint 仍为 0 时会从 trace 文件集合回填已处理 trace 数，不再出现“实时追踪已有事件，但状态栏长期显示 0”的错觉
- 📝 记录恢复经验：daemon 的统计指标如果只靠低频 checkpoint 定时落盘，UI 很容易出现“核心链路已恢复，但状态值还停在旧快照”的假故障；这类指标至少要做到“写侧快速刷新 + 读侧必要时回填”双保险
- ✅ 补齐实时追踪 Raw Traces 子层交互：原始 trace 表现在支持 `scope` 回填、详情预览、复制/查看详情动作，并与业务事件层共享列宽拖拽记忆；排查底层 trace 时不再只能看 `event_type + session/trace id` 的极简表格
- 📝 记录恢复经验：实时追踪如果分成“业务事件 / 原始 Trace”两层，就不能只把交互能力堆在业务层；否则一旦要排查 observer、trace store 或 provider 原始返回，用户还是得回到日志里，tab 切换本身就失去价值
- ✅ 修复实时追踪“长期无事件统计”的链路断层：`CodexObserver` 启动时现在会回放最近活跃的 session 文件尾部，不再只依赖新文件创建或偶发文件变更；daemon 重启后也能立刻重新接上正在进行中的 Codex 会话
- ✅ 补齐 dashboard trace 读侧兼容：实时追踪与项目快照版本现在会同时纳入 `default.ndjson` 和会话级 `*.ndjson` trace 文件，避免未来 trace store 切到按 session 分文件时，看板再次因为只盯旧文件名而显示“0 事件”
- 📝 记录恢复经验：实时追踪不能把“事件发现”完全押在文件系统实时通知上；daemon 重启时，活跃会话文件通常已经存在，如果 observer 又启了 `ignoreInitial`，就必须有启动回放或持久化 offset，否则只能等“新文件创建”才恢复，旧会话会整段失联
- 📝 记录恢复经验：dashboard 的 trace 读侧不要写死单个 `default.ndjson` 文件名，trace store 的落盘策略天然可能从“单文件”演进到“按 session 分文件”；快照版本和活动读取都应该以“trace 文件集合”而不是“某一个约定文件名”为事实来源
- ✅ 修复配置页“内置模型被误判成自定义模型”的回归：dashboard 现在会在同一 provider 内把 `deepseek-reasoner` 与 `deepseek/deepseek-reasoner` 视为同一个内置模型，避免旧配置或不同来源的 model id 格式不一致时，页面错误回退到“自定义”输入框
- 📝 记录恢复经验：provider catalog 与已保存配置之间必须定义“模型 ID 等价规则”，不能只做精确字符串匹配；像 LiteLLM registry 常带 `provider/` 前缀，而项目历史配置可能只存裸 model 名，不做归一化就会把内置模型误判成自定义模型，并在自动保存后继续放大配置漂移

### 2026-04-11
- ✅ 修复本地 link 后 `ornn` CLI 可能报 `permission denied` 的问题：构建和 prepare 阶段统一补齐 `dist/cli/index.js` 的可执行权限
- 📝 记录环境经验：`npm link` 只负责创建全局软链，不会保证 `tsc` 产物自动带可执行位；如果 `which ornn` 能找到命令但执行报权限错误，优先检查 `dist/cli/index.js` 是否缺少 `+x`
- ✅ 恢复 dashboard 的成本 tab 与实时追踪增强：活动表格改为直接基于 `decisionEvents + recentTraces` 归一化生成，不再依赖前端内存 diff 推导，避免长时间无新增、scope 缺失和重复结论
- ✅ 恢复 agent usage 的 `ndjson -> dashboard` 聚合链路：snapshot 不再只依赖 `agent-usage-summary.json`，已重新支持按 `model / scope / skill` 聚合，并补回 `durationMsTotal / avgDurationMs / lastCallAt`
- ✅ 恢复总览页第二层统计：补回 `映射数 / 跳过数 / 变更行数 / 宿主漂移` 概览卡，以及 `映射策略 / 评估规则 / 跳过原因 / Patch 类型 / 调用范围` 指标块
- ✅ 恢复成本页增强版：补回 `平均时延 / 单次平均 Token / 最近调用 / 模型成本拆分 / Scope 拆分 / Skill Token 消耗 Top 5 / LiteLLM 信号`，并统一补齐中英文文案
- ✅ 校正配置页到当前最新交互：移除已废弃的 `default provider + log level` 独立控件，provider 行内不再展示 `apiKeyEnvVar` 输入，而是改为“单选启用”互斥开关，并把 `defaultProvider` 的渲染 / 保存 / 连通性检查链路统一切到行内选中态
- ✅ 继续校正配置页默认策略：移除 `tracking.auto_optimize / tracking.user_confirm / tracking.runtime_sync` 三个可编辑开关，dashboard 保存配置时固定写入默认策略，避免页面残留“可改但实际不该改”的假入口
- ✅ 继续校正配置页交互：移除“保存配置”按钮，provider 编辑器改为防抖自动保存；选择 provider/model、输入自定义值、切换默认启用项、增删 provider 后都会自动落盘，不再要求用户手工点保存
- ✅ 继续校正配置页 API Key 行为：dashboard 现已读取并回填 `.env.local` 中的真实 `apiKey`，输入框改为明文展示和持久化保存；自动保存、连通性检查和重渲染后不再把已录入 key 清空或退回占位提示
- ✅ 修复模型服务连通性检查误报：`checkProvidersConnectivity` 不再用普通 `completion("ping")` 验活，而是统一改走 LiteLLM client 的 `probeConnectivity()`；对 `deepseek-reasoner` 这类 reasoning 模型现在会按探测协议正确判活，不再误报 `Empty content in LLM response`
- ✅ 调整配置页 provider 行操作布局：移除底部全局“检查连通性”按钮，改为每个 provider 行尾统一展示 `启用 / 检查连通性 / 删除` 三连动作；单行检查只请求当前 provider，但不会覆盖其他行的编辑态或配置状态
- ✅ 修复配置页远端依赖脆弱性：LiteLLM catalog 现在有服务端超时和本地 fallback，远端 GitHub registry 拉取失败时会自动退回仓库内置 provider 列表；前端超时错误也改成明确的 timeout 文案，不再直接暴露 `AbortError`
- ✅ 优化 dashboard 运行期性能：SSE 广播现在按项目快照版本增量推送，项目无变化时不再每 3 秒重建全量 `projectData`；同时对 `agent-usage.ndjson / agent-usage-summary.json` 读取增加签名缓存，避免空转期反复全量解析 usage 文件导致页面卡顿
- ✅ 继续恢复 dashboard 多语言收尾：补齐技能页筛选/搜索/排序文案、provider 告警、provider 编辑器占位文案、trace 表头与 modal 保存提示的中英文切换，避免中文页面继续混入英文控件词
- ✅ 继续收敛 dashboard 术语残留：活动详情复制文本中的 `Skill / Session ID` 已改为多语言标签，`runtime_sync` 帮助文案中的“runtime”已统一改为“宿主”
- ✅ 收敛 activity 文案实现：`daemon_state` 事件描述已从内联语言分支改为统一走 i18n，避免后续再出现“行为正常但字典不完整”的分叉实现
- ✅ 清理回归测试脆弱点：`skill-call-analyzer` 测试中的嵌套 `vi.mock` 已改为 `vi.hoisted()` 顶层 mock，去掉 Vitest hoist 警告，避免未来版本直接升级为错误
- ✅ 恢复 JSON 分析协议链路：LiteLLM client 已支持 `response_format: { type: "json_object" }`，`skill-call-analyzer / readiness-probe / decision-explainer` 三条 JSON 解析链路已显式开启；同时对 DeepSeek JSON Output 的空 `content` 做了一次重试，避免瞬时空响应直接打成分析失败
- ✅ 恢复实时追踪决策事件生产链路：`ShadowManager` 已重新写出 `evaluation_result / analysis_requested / analysis_failed / patch_applied` 事件，并补上稳定 scope id、trace/session 关联和用户可读状态，避免 dashboard 出现“有读取、无新增、scope 为空”的假死感
- ✅ 恢复 task episode 与时机探测落盘链路：`ShadowManager` 现在会真实维护 `.ornn/state/task-episodes.json`，并写出 `episode_probe_requested / episode_probe_result` 事件；实时追踪与 daemon 状态回填不再依赖手工伪造快照
- ✅ 恢复深度分析闭环：当 readiness probe 判断窗口已具备分析条件时，`ShadowManager` 现在会真实调用 `skill-call-analyzer`，并把 `analysis_requested / analysis_failed / skill_feedback / patch_applied` 串成单条生产链路；不再只有 probe 结果，没有后续分析动作
- ✅ 恢复决策解释与宿主状态同步：`decision-explainer` 已按项目语言输出中英文解释，`skill_feedback` 事件重新落盘；同时 `ShadowManager` 会把分析中的 / 成功 / 失败状态写回 `daemon-checkpoint.json`，降低 dashboard 对读侧 backfill 的依赖
- ✅ 清理未接线的旧分析壳层：删除仓库内完全未被调用的 `Phase5Integration` 旧路径，避免继续保留“老 analyzer 架构看起来存在、实际生产根本不走”的误导性代码
- ✅ 恢复 journal 兼容能力：`getLatestRevision / getJournalRecords / getRecordByRevision / getSnapshots / createSnapshot / rollback` 已从 placeholder 恢复为真实 sqlite + snapshot 文件实现，CLI 的 `status / log / diff / rollback / preview` 基础链路重新可用
- ✅ 补齐 patch 前基线快照：`ShadowManager` 在写入新 shadow 内容前会先保留当前 revision 的 snapshot，确保从第一次自动优化开始就具备回滚基线，而不是等到第 5 次后才有历史版本
- ✅ 收敛分析失败可读性：`skill-call-analyzer` 现在会返回结构化失败类型、用户可读原因和技术细节；dashboard 的实时追踪则优先展示本地化失败说明，把 `provider_not_configured / invalid_analysis_json / Empty content in LLM response` 这类底层词汇降到“原始技术信息”
- ✅ 继续清理 dashboard 术语混杂：中文界面里遗留的 `Shadow 技能 / Provider / Scope / Patch 类型 / Skill` 已进一步收敛为 `影子技能 / 模型服务 / 范围 / 修改类型 / 技能`，并移除了活动表头里的硬编码 `Skill`
- ✅ 继续清理配置/成本页中文术语：补齐 `默认模型服务 / 模型服务列表 / 模型服务连通性 / 自定义模型服务 ID / LiteLLM 模型注册表` 等表述，避免中文页继续混入 `provider / model registry / model-scope-skill`
- 📝 记录恢复经验：`src/dashboard/ui.ts` 是“外层 HTML 模板 + 内嵌 JS”双层字符串，给内嵌脚本补函数时要避免直接写未转义模板字面量和 `'\n'`，否则 TypeScript 可能通过，但浏览器侧 `<script>` 会在运行时变成非法 JS；恢复后优先用 VM harness 抽取最终 script 做语法检查
- 📝 记录恢复经验：给 dashboard 内嵌脚本写正则时，反斜杠要按双层字符串处理；例如想让最终浏览器脚本保留 `/\\.0$/`，源码里必须写成 `replace(/\\\\.0$/, '')`，否则运行时会退化成 `/.0$/`，把 `540千` 错裁成 `5千`
- 📝 记录恢复经验：涉及 dashboard 多语言时，优先先在 `tests/unit/dashboard-ui.test.ts` 的 VM harness 里补 `zh + en` 双语言断言，再回填 `src/dashboard/i18n.ts`；这样可以尽早发现“中文恢复了但英文仍缺字段”的半恢复状态
- 📝 记录恢复经验：配置页不是纯前端问题；凡是出现“表单字段存在于 i18n 但页面没渲染”的情况，要顺着 `readDashboardConfig / writeDashboardConfig / server POST body / saveProjectConfig` 整条链路一起查，否则很容易只补 UI 造成保存无效
- 📝 记录恢复经验：dashboard 的“静态 HTML 模板”和“运行时拼接字符串”是两层不同的可见文案来源；只扫模板很容易漏掉 `renderMainPanel / renderProviderRow / buildActivityDetail / saveCurrentSkill` 这类运行期文本，恢复多语言时要同时覆盖 `renderMainPanel` 结果和行为函数产物
- 📝 记录恢复经验：术语统一不能只搜按钮和标题，复制文本、弹窗详情、help 文案同样会成为用户的第一视角；像 `buildActivityDetail` 这种“只在交互后出现”的路径，需要单独补行为测试，否则很容易漏掉
- 📝 记录恢复经验：Vitest 的 `vi.mock` 工厂会被提升到 import 之前执行；如果要在工厂里复用可变 mock，必须用 `vi.hoisted()` 提前创建引用，否则即使测试偶尔能过，也会在升级后变成初始化时序错误
- 📝 记录恢复经验：需要“结构化输出”的链路不能只靠 prompt 约束；如果底层 provider 支持协议级 JSON mode，就应该把 `response_format` 下沉到 client 层统一处理，并在上层 analyzer 显式声明使用，否则一旦模型回了说明文字、代码块或空字符串，整个分析链路都会变脆
- 📝 记录恢复经验：dashboard 读到了 `decision-events.ndjson` 并不代表实时链路已经恢复；追查“看板长期无新增”时，要同时检查“reader 是否存在”和“生产路径是否真的调用 recorder”。这次根因就是 reader/tests 都在，但 `ShadowManager` 活链路完全没写事件
- 📝 记录恢复经验：凡是 dashboard 会消费的状态文件，都要反向确认生产侧是否存在“唯一事实来源”。像这次 `task-episodes.json` 的问题，本质不是 UI 没显示，而是 reader/backfill 已写好，但核心链路根本没人持续维护这个文件，最终形成“测试数据可读、线上数据永远不变”的假恢复
- 📝 记录恢复经验：只把 readiness probe 接回生产链路还不够；如果 probe 通过后没有真正进入 analyzer/explainer，用户看到的就仍然是“已提交分析”但永远没有后续结论。恢复这类链路时，必须按 `probe -> analyzer -> explanation -> patch/status` 整体检查，而不是分模块自证“我这里能跑”
- 📝 记录恢复经验：对于已经完全脱离生产调用、且还保留旧职责叙述的模块，继续留在仓库里本身就是噪音源。恢复架构时，不能只补新链路，还要主动删除这类“看起来能用、其实永远不会跑”的旧壳，否则后续排查会再次被误导
- 📝 记录恢复经验：兼容层方法不能只在“初始化完成后”才可读；旧 CLI 和脚本里存在 `journal.init()` 未 `await` 就直接查询默认值的历史调用方式，因此 `getLatestRevision / getSnapshots / getJournalRecords` 这类兼容方法在未初始化时也要返回安全默认值，而不是直接抛错
- 📝 记录恢复经验：只恢复 journal 查询接口还不够，生产侧也要保留“改动前”的版本；如果 snapshot 只在改动后按间隔创建，第一次自动优化之前的基线会永久丢失，导致 rollback 语义残缺。正确做法是在写入新 shadow 前先对当前 revision 建立 snapshot
- 📝 记录恢复经验：分析失败信息不要直接把错误码或异常串抛给 dashboard；正确做法是保留两层信息：一层是按当前语言生成的“失败原因 / 影响 / 建议动作”，另一层才是 `technicalDetail` 原文。否则中文界面很容易再次混入 `invalid_analysis_json`、`Empty content in LLM response` 这类底层词汇
- 📝 记录恢复经验：任何 evaluator / analyzer 产出的 `change_type`，都必须和 patch generator 的必填上下文字段一起校验；像 `prune_noise`、`rewrite_section` 这类策略如果没有 `target_section`，继续往下走只会稳定地产生“优化状态=error”的假故障，正确做法是先降级为继续收集证据或分析不完整
- 📝 记录恢复经验：dashboard 术语统一不能只改字典，不少可见词是直接硬编码在内嵌脚本模板里的；这次 `Skill` 列头就是漏网点。做这类清理时要同时扫 `i18n.ts` 和 `ui.ts` 模板字符串，否则会出现“字典已改、页面仍混英”的假完成
- 📝 记录恢复经验：中文术语清理要按页面分层扫。活动页、配置页、成本页对同一个概念往往用了不同叫法；只在一个 tab 内局部替换，很容易留下 `provider / scope / model registry` 这类跨页面残留
- 📝 记录恢复经验：配置页如果把 `defaultProvider` 从独立下拉改成 provider 行内互斥开关，不能只改 UI；`renderConfigPanel / saveProjectConfig / checkProvidersConnectivity / addProviderRow / removeProviderRow` 必须一起切换，否则一做“检查连通性”或重新渲染，启用态就会悄悄回退
- 📝 记录恢复经验：对“默认不可变”的配置项，正确做法不是把控件禁用或隐藏后继续从 DOM 取值，而是直接从保存链路移除并在 payload 中写死默认值；否则后续重构或测试桩很容易把这些控件偷偷接回来
- 📝 记录恢复经验：配置页改自动保存时，不能沿用“保存成功后整页重渲染”的旧逻辑；否则用户在请求尚未返回时继续输入，成功回包会把最新未提交内容覆盖掉。正确做法是自动保存场景只更新 hint/state，不主动重绘当前编辑表单
- 📝 记录恢复经验：如果 UI 需要展示“已保存的 API Key”，根因通常不在输入框类型，而在读配置接口是否只返回 `hasApiKey` 这种布尔摘要。要让页面刷新后仍保留值，必须同时打通 `readDashboardConfig -> dashboard state -> renderProviderRow -> sanitizeProvidersForState` 整条链
- 📝 记录恢复经验：模型服务“连通性检查”不能复用普通文本生成路径。连通性验证的目标是确认“鉴权 + 模型可访问”，而不是验证“该模型一定会返回最终 content”；对于 reasoning 模型或 provider 特化模型，应该优先走专用 probe 路径，否则极易把协议差异误判成连通失败
- 📝 记录恢复经验：配置页里凡是“针对单行资源的动作”，都应尽量下沉到行级按钮，而不是做全局入口再在实现里猜当前目标。否则 UI 意图和请求范围容易脱节，后续一旦引入自动保存或多行编辑态，就很容易误把整表数据一起提交或覆盖
- 📝 记录恢复经验：配置页不应该把可用性建立在远端模型注册表实时可达之上。像 LiteLLM catalog 这类“增强体验”的远端数据源，必须天然支持“超时 + cache + 本地 fallback”，否则网络抖动或代理问题会把整个配置入口一起拖死
- 📝 记录恢复经验：dashboard 的实时感不能靠固定周期“全量重算 + 全量推送”硬顶。像 `agent-usage.ndjson` 这类会持续增长的文件，一旦被放进定时快照链路里反复全量解析，性能会随使用时长线性变差。正确做法是给读侧加文件签名缓存，再在 SSE 层只推有版本变化的项目

| 阶段 | 状态 | 进度 | 预计时间 |
|------|------|------|---------|
| Phase 1: 基础框架 | ✅ 完成 | 100% | 2 周 |
| Phase 2: Registry | 🔄 进行中 | 0% | 2 周 |
| Phase 3: Observer Layer | ⏳ 待开始 | 0% | 2 周 |
| Phase 4: Evaluator & Patch | ⏳ 待开始 | 0% | 3 周 |
| Phase 5: 自动循环 | ⏳ 待开始 | 0% | 2 周 |
| Phase 6: Rollback & Rebase | ⏳ 待开始 | 0% | 1.5 周 |
| Phase 7: CLI 完善 | ⏳ 待开始 | 0% | 1.5 周 |
| Phase 8: 测试 & 打包 | ⏳ 待开始 | 0% | 2 周 |

---

## Phase 1: 基础框架 ✅ 完成

### 已完成的任务

#### 1. 项目初始化 ✅
- [x] package.json 配置
- [x] TypeScript 配置 (tsconfig.json)
- [x] ESLint 配置
- [x] Prettier 配置
- [x] Vitest 测试框架配置
- [x] 项目目录结构搭建

#### 2. 全局类型定义 ✅
- [x] `src/types/index.ts` - 核心类型定义
  - ✅ `OriginSkill` - 原始 skill 类型
  - ✅ `ProjectSkillShadow` - 影子 skill 类型
  - ✅ `EvolutionRecord` - 演化记录类型
  - ✅ `Trace` - 执行轨迹类型
  - ✅ `EvaluationResult` - 评估结果类型
  - ✅ `ShadowStatus` - 状态枚举
  - ✅ `ChangeType` - 修改类型枚举
  - ✅ 其他辅助类型

#### 3. 工具函数库 ✅
- [x] `src/utils/hash.ts` - 哈希计算工具
  - ✅ `hashContent()` - 内容哈希
  - ✅ `hashFile()` - 文件哈希
  - ✅ `shortHash()` - 短哈希
  - ✅ `compareHash()` - 哈希比较
- [x] `src/utils/diff.ts` - Diff 工具
  - ✅ `generateDiff()` - 生成 unified diff
  - ✅ `applyDiff()` - 应用 diff
  - ✅ `parseDiff()` - 解析 diff
  - ✅ `hasChanges()` - 检测变化
- [x] `src/utils/path.ts` - 路径工具
  - ✅ `expandHome()` - 展开 home 目录
  - ✅ `getEvoDir()` - 获取 .ornn 目录
  - ✅ `getSkillsDir()` - 获取 skills 目录
  - ✅ `getStateDir()` - 获取 state 目录
  - ✅ `getConfigDir()` - 获取 config 目录
  - ✅ 其他路径工具函数
- [x] `src/utils/logger.ts` - 日志工具
  - ✅ Winston 日志配置
  - ✅ 文件和控制台输出
  - ✅ 日志级别管理
  - ✅ 子 logger 创建
- [x] `src/utils/index.ts` - 工具函数导出

#### 4. 配置管理系统 ✅
- [x] `src/config/defaults.ts` - 默认配置
  - ✅ Origin paths 配置
  - ✅ Observer 配置
  - ✅ Evaluator 配置
  - ✅ Patch 配置
  - ✅ Journal 配置
  - ✅ Daemon 配置
- [x] `src/config/index.ts` - 配置管理器
  - ✅ `ConfigManager` 类
  - ✅ 全局配置加载
  - ✅ 项目配置加载
  - ✅ 配置合并逻辑
  - ✅ 配置验证

#### 5. 存储层 ✅
- [x] `src/storage/sqlite.ts` - SQLite 存储
  - ✅ 数据库初始化
  - ✅ Shadow skills 表操作
  - ✅ Sessions 表操作
  - ✅ Traces 索引表操作
  - ✅ Snapshots 表操作
  - ✅ Evolution records 索引表操作
- [x] `src/storage/ndjson.ts` - NDJSON 存储
  - ✅ `NDJSONWriter` - 写入器
  - ✅ `NDJSONReader` - 读取器
  - ✅ `TraceStore` - Trace 存储
  - ✅ `JournalStore` - Journal 存储
- [x] `src/storage/markdown.ts` - Markdown 操作
  - ✅ `MarkdownSkill` 类
  - ✅ 读取/写入 skill
  - ✅ 从 origin 复制
  - ✅ Frontmatter 解析
- [x] `src/storage/index.ts` - 存储层导出

---

## Phase 2: Registry 🔄 进行中

### 计划任务

#### 1. Origin Registry
- [ ] `src/core/origin-registry/scanner.ts` - 目录扫描器
- [ ] `src/core/origin-registry/index.ts` - Origin Registry 主类
- [ ] `src/core/origin-registry/types.ts` - 类型定义

#### 2. Shadow Registry
- [ ] `src/core/shadow-registry/manager.ts` - Shadow 管理器
- [ ] `src/core/shadow-registry/index.ts` - Shadow Registry 主类
- [ ] `src/core/shadow-registry/types.ts` - 类型定义

#### 3. Journal Manager
- [ ] `src/core/journal/writer.ts` - Journal 写入器
- [ ] `src/core/journal/reader.ts` - Journal 读取器
- [ ] `src/core/journal/snapshot.ts` - Snapshot 管理
- [ ] `src/core/journal/rollback.ts` - 回滚逻辑
- [ ] `src/core/journal/index.ts` - Journal Manager 主类

---

## 测试进度

### 单元测试
- [x] `tests/unit/path.test.ts` - 路径工具测试 ✅
- [ ] `tests/unit/hash.test.ts` - 哈希工具测试
- [ ] `tests/unit/diff.test.ts` - Diff 工具测试
- [ ] `tests/unit/config.test.ts` - 配置管理测试
- [ ] `tests/unit/storage.test.ts` - 存储层测试

### 集成测试
- [ ] `tests/integration/observer-integration.test.ts`
- [ ] `tests/integration/full-evolution-cycle.test.ts`
- [ ] `tests/integration/rollback.test.ts`

---

## 下一步行动

### 立即执行（Phase 2）
1. 实现 Origin Registry
   - 扫描本机 skills 目录
   - 读取 skill 元数据
   - 计算文件 hash
2. 实现 Shadow Registry
   - 创建 shadow skill
   - 管理 shadow 状态
   - 初始化项目目录结构
3. 实现 Journal Manager
   - 写入演化记录
   - 读取 journal
   - 管理 revision

### 验收标准
- [ ] `ornn skills status` 命令可用
- [ ] 能自动发现本机 origin skills
- [ ] 能在项目中创建 shadow skills
- [ ] 能记录演化日志

---

## 技术债务

暂无

---

## 问题和风险

暂无

---

## 更新日志

### 2026-04-12
- ✅ 修复成本看板长期无数据的 episode 统计口径问题：probe 现在按 session 窗口累计 trace，而不是只看映射命中的少量 trace
- ✅ 新增 `shadow-manager-task-episodes` 回归测试，覆盖“session 已达阈值但仅部分 trace 映射到 skill”时仍应触发 probe
- 📝 补充调试经验：当成本看板为空时，先核对 `.ornn/state/agent-usage.ndjson` 是否存在，再对照 `task-episodes.json` 的 `totalTraceCount` 与 `mappedTraceCount` 是否失衡
- ✅ 重做成本页布局：改成 `hero + summary grid + main table + side rail` 的层次结构，弱化“堆表格”观感
- 📝 记录前端经验：成本页这类信息密度高的看板，优先把“主结论”放到 hero，再把拆解放到侧栏，避免所有卡片权重一致
- ✅ 抽出共享的窗口分析结果分类层：`window-analysis-outcome` 统一归一化 `analysis_failed / need_more_context / no_optimization / incomplete_patch_context / apply_optimization`
- ✅ `OptimizationPipeline` 与 `ShadowManager` 统一改为消费共享 outcome，避免两条链路各自解释 analyzer 返回值
- ✅ 抽出共享的 patch 上下文缺失判定，锁定“缺少 target_section 不能生成可执行 patch”的一致语义
- ✅ 补充回归测试：覆盖 outcome 分类与 pipeline 在不可执行 patch 场景下不得生成优化任务
- ✅ 抽出 `activity-event-builder`：把实时看板业务事件的上下文拼装、业务标签映射与 `skill_feedback` 事件构建从 `ShadowManager` 中移出
- ✅ 抽出 `daemon-status-store`：把 `.ornn/state/daemon-checkpoint.json` 的运行状态写入从 `ShadowManager` 中移出
- ✅ `ShadowManager` 改为消费 builder/store，删除大段事件文案与 checkpoint IO 逻辑，为后续拆 `AnalyzeSkillWindowUseCase` 做准备
- ✅ 新增模块级单测：覆盖 activity event builder 与 daemon status store 的稳定输出契约
- ✅ 抽出 `analyze-skill-window`：统一自动/手动窗口分析的 skill-content 校验、LLM 调用、outcome 归一化与用户可读 detail
- ✅ 抽出 `optimization-eligibility`：统一冷却期、日限、冻结、置信度不足四类准入判定
- ✅ 抽出 `optimization-executor`：统一 patch 生成、shadow 写回、journal 记录、snapshot 管理与 patch 统计
- ✅ `ShadowManager` 改为消费分析/准入/执行三层模块，主链路只保留编排职责
- ✅ 新增模块级单测：覆盖 analyze-skill-window、optimization-eligibility、optimization-executor 的稳定契约
- ✅ 抽出 `task-episode-policy`：把 episode 开窗、trace 合并、probe 触发、probe 结果应用、分析状态迁移从 `TaskEpisodeStore` 中移出
- ✅ `TaskEpisodeStore` 收敛为 snapshot 读写与 policy 委托层，避免状态机规则和持久化耦合
- ✅ 新增模块级单测：覆盖 task-episode-policy 的 probe 触发、probe 结果应用与分析状态迁移
- ✅ 抽出 `shadow-bootstrapper`：把 skill 扫描、来源优先级、shadow 注册、mapper 注册、项目物化从 `ShadowManager.init()` 链中移出
- ✅ `ShadowManager` 初始化链现在只负责组装依赖并调用 bootstrapper，删除大段 origin/shadow 启动同步逻辑
- ✅ 新增模块级单测：覆盖“项目 skill 优先于全局重复项”和“全局 skill 物化到项目”的 bootstrap 契约

---

### 2026-03-21
- ✅ 完成 Phase 1 所有任务
- ✅ 项目基础框架搭建完成
- ✅ 存储层实现完成
- ✅ 工具函数库完成
- ✅ 配置系统完成
- 🔄 开始 Phase 2 开发

---

*最后更新：2026-04-13*
*更新人：OrnnSkills Team*
