# OrnnSkills 项目进度

## 📊 总体进度：Phase 1 ✅ 完成

### 2026-04-11
- ✅ 修复本地 link 后 `ornn` CLI 可能报 `permission denied` 的问题：构建和 prepare 阶段统一补齐 `dist/cli/index.js` 的可执行权限
- 📝 记录环境经验：`npm link` 只负责创建全局软链，不会保证 `tsc` 产物自动带可执行位；如果 `which ornn` 能找到命令但执行报权限错误，优先检查 `dist/cli/index.js` 是否缺少 `+x`
- ✅ 恢复 dashboard 的成本 tab 与实时追踪增强：活动表格改为直接基于 `decisionEvents + recentTraces` 归一化生成，不再依赖前端内存 diff 推导，避免长时间无新增、scope 缺失和重复结论
- ✅ 恢复 agent usage 的 `ndjson -> dashboard` 聚合链路：snapshot 不再只依赖 `agent-usage-summary.json`，已重新支持按 `model / scope / skill` 聚合，并补回 `durationMsTotal / avgDurationMs / lastCallAt`
- ✅ 恢复总览页第二层统计：补回 `映射数 / 跳过数 / 变更行数 / 宿主漂移` 概览卡，以及 `映射策略 / 评估规则 / 跳过原因 / Patch 类型 / 调用范围` 指标块
- ✅ 恢复成本页增强版：补回 `平均时延 / 单次平均 Token / 最近调用 / 模型成本拆分 / Scope 拆分 / Skill Token 消耗 Top 5 / LiteLLM 信号`，并统一补齐中英文文案
- ✅ 恢复配置页被删薄的控制项：重新接回 `default provider + log level` 配置链路，打通 `config manager -> server API -> dashboard UI`，并把配置页多处硬编码提示收敛进 i18n
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
- 📝 记录恢复经验：dashboard 术语统一不能只改字典，不少可见词是直接硬编码在内嵌脚本模板里的；这次 `Skill` 列头就是漏网点。做这类清理时要同时扫 `i18n.ts` 和 `ui.ts` 模板字符串，否则会出现“字典已改、页面仍混英”的假完成
- 📝 记录恢复经验：中文术语清理要按页面分层扫。活动页、配置页、成本页对同一个概念往往用了不同叫法；只在一个 tab 内局部替换，很容易留下 `provider / scope / model registry` 这类跨页面残留

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

### 2026-03-21
- ✅ 完成 Phase 1 所有任务
- ✅ 项目基础框架搭建完成
- ✅ 存储层实现完成
- ✅ 工具函数库完成
- ✅ 配置系统完成
- 🔄 开始 Phase 2 开发

---

*最后更新：2026-03-21*
*更新人：OrnnSkills Team*
