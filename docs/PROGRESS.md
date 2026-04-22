# OrnnSkills 项目进度

## 📊 总体进度：Phase 1 ✅ 完成

### 2026-04-23

- ✅ 纠正 v3 顶层路由契约：`frontend-v3` 已从错误的 `skills / projects / activity / config` 收回到与 v1 对齐的 `skills / project / config`；旧 `/v3/projects`、`/v3/activity` 现在都由前端路由兼容回退到 `/v3/project`
- ✅ 重建 v3 的技能页主模型：`/v3/skills` 已不再消费 `selectedProject.snapshot.skills[]`，而是改走 `Skill Family -> Skill Instance -> Skill Revision` 数据链；v3 前端现已补齐 `/api/skills/families`、`/api/skills/families/:id/instances`、`/api/projects/:id/skills/:skillId`、版本读取/停用、apply preview、apply-to-family` 等 client 与状态层
- ✅ 恢复技能页核心交互闭环：当前 skills 工作台已重新具备 family 列表、实例条、runtime 切换、正文编辑、版本历史、版本停用/恢复、传播预览与 apply-to-family；旧的 `skills-hero-band / skills-scope-sidebar / skills-insight-rail` 三块错误页面结构已从 v3 删除
- ✅ 收回活动页到项目工作台：`activity` 不再作为 v3 顶层 tab 单独存在，当前活动流已并回 `project workbench`，和项目状态、项目内技能列表一起回到项目视角
- 📝 记录 IA 经验：dashboard 的错不在“卡片太碎”，而在“对象模型错位”。只要 skills 页继续以 `selectedProject.snapshot.skills[]` 为主源，页面再漂亮也还是项目视角；必须先恢复 `family / instance / revision` 三层语义，UI 才有正确骨架

- ✅ 重做 v3 技能页框架层：`/v3/skills` 已从“多张大卡竖堆”改成 `sticky workspace header + hero band + scope / table / insight` 的稳定工作台结构；header 现在只负责全局导航和运行状态，页面标题与主视觉已下沉到独立 hero
- ✅ 补齐技能页页面级交互底板：技能表已接入受控分页、内滚动容器和统一 footer；全局滚动条也已按暗色主题收口，不再依赖浏览器默认样式
- 📝 记录前端经验：用了 shadcn 组件，不等于页面就自动符合 shadcn 的组织原则。真正决定观感的是页面级骨架是否稳定，例如 header 是否只做全局层、hero 是否独立、内容区是否有固定网格、分页和滚动是否收在主表面里
- 📝 记录响应式经验：技能工作台在 `xl` 就必须形成至少两栏结构，不能等到 `2xl` 才建立 scope + main 的页面骨架，否则 1280 一类常见桌面宽度仍会退化成纵向卡片堆栈

- ✅ 恢复 v3 的一级 `配置` 工作区：`/v3/config` 已重新回到顶层导航，`config` 现在和 `技能 / 项目` 一样是显式一级视图，不再通过默认 fallback 间接兜底
- ✅ 接回真实配置工作台：v3 已补齐 `GET/POST /api/config`、`/api/providers/catalog`、`/api/provider-health`、`/api/config/providers/connectivity` 的前端 client 和独立状态层；当前可直接查看 provider stack、默认 provider、LLM safety、prompt source/override，并保存配置
- ✅ 补齐 shadcn 表单基件：v3 新增 `select / switch / textarea / label / alert`，配置页继续沿用 `Card / Button / Badge / Tabs / Input` 组合，不再为表单场景手写私有控件
- ✅ 收回 v3 配置页到 v1 可见合同：`/v3/config` 现已改回 `模型 / 演进策略` 两个子页签，provider 行内重新具备 `启用 / 检查连通性 / 删除 / API Key 显示隐藏`，并恢复底部自动保存提示；此前自造的 `配置控制台 / Provider Health / Runtime Policy / 保存配置` 等非 v1 可见模块已从页面删除
- ✅ 补齐配置页对照测试：新增 `dashboard-v3-config-contract` 与 `dashboard-v3-config-workspace` 两组测试，约束 v3 配置页只能出现 v1 的可见文案和交互入口，避免后续再次混入自解释文案或额外控制台模块
- ✅ 删除 v3 项目页的非 v1 模块：`DashboardHero / MetricGrid / ProjectStatusPanel / InsightStack / ActivityStream` 已从 `project` 视图和代码库移除，`/v3/project` 不再渲染 `运行摘要 / 项目运行状态 / Runtime 分布 / Snapshot 新鲜度 / 模型用量 / 高频技能 / 事件分布 / Recent Traces / Decision Events` 这批越界模块
- ✅ 补齐项目页对照测试：新增 `dashboard-v3-project-contract`，并更新 `dashboard-v3-layout`，明确约束 `project` 视图只允许保留 v1 合同内的页面骨架，不再允许 hero/metric 级项目 chrome 混入
- 📝 记录复刻经验：`100% 功能性复刻` 的边界是“对象、入口、按钮、提示、保存行为都和 v1 一致”，不是把旧样式整页搬回来；因此 v3 配置页这次只复用 v1 的可见合同和交互语义，样式层仍保持独立实现
- 📝 记录 IA 经验：对 dashboard 这种多工作区产品，`config` 不能只算“将来会补”的附属页；只要它是主路径之一，就必须在 `DashboardView`、header tabs、view copy、layout rule 这四层同时显式存在，否则后续清理布局时很容易被静默删掉
- 📝 记录浏览器验证经验：v3 页面常驻 SSE，做 Playwright/浏览器脚本冒烟时不要等 `networkidle`，否则很容易被长连接拖到超时；更稳的做法是 `domcontentloaded + 固定等待 + 抓取 body 文本/控制台`

### 2026-04-22

- ✅ 启动完全隔离的 dashboard v3：新增 `frontend-v3/` 子工程和 `/v3` 独立入口，服务端已支持 `/v3`、`/v3/*`、`/v3/assets/*`，构建产物输出到 `dist/dashboard-v3`；这次不再复用 `frontend/` 里的业务 UI 文件，只保留 API / SSE 合同
- ✅ 用 seed `b4NKaHect` 重写 v3 工作台骨架：v3 已直接基于 `radix-vega + olive + DM Sans + hugeicons` 落地项目侧栏、技能总览、项目视角、活动视图和技能详情弹层，页面视觉不再叠加 v2 那套私有蓝青皮肤
- ✅ 收紧 v3 信息架构：顶层 `技能 / 项目 / 配置` 导航已提升到首屏头部；`/v3/skills` 不再渲染项目 hero 和 metric cards，首屏直接进入技能主工作区；项目摘要 chrome 只保留在 `/v3/project`
- 📝 记录隔离经验：独立路由和独立构建产物只能隔离“资源入口”，并不能自动隔离“业务层自带的视觉判断”；如果新页面继续复用上一轮业务组件文件，最终仍会把旧视觉习惯带回来。真正想切干净，就必须连业务展示层一起从新目录重建
- 📝 记录信息架构经验：对于 `skills are first-class citizens` 的产品，技能页不能再把项目总览模块摆在技能列表之前；一旦首屏先展示 daemon、queue、trace 摘要，用户看到的就是“项目监控台”，不是“技能工作台”
- 📝 记录清理经验：新前端从 Vite 脚手架起步时，默认 `README / favicon / icons.svg / App.css / src/assets/*` 很容易跟着进仓库；这类模板残留要在第一次成型前就收掉，否则后续即使页面能跑，仓库里仍然会混着与产品无关的脚手架噪音
- 📝 记录环境经验：当前机器的非交互 shell 在某些 exec 场景下拿不到 `mv` 的 PATH，做“移入回收站”这类安全清理时，直接用 `/bin/mv` 更稳

- ✅ 收口 preset 风格漂移：`b4NKaHect` 虽然已经把 `radix-vega` 主题变量落进项目，但业务层页面之前仍带着大量手写 `text-white / border-white / cyan / slate / radial-gradient` 类，实际视觉被私有配色重新覆盖；现已把工作台主层收回到 `background / card / muted / primary / border` 语义 token
- 📝 记录 preset 对齐经验：shadcn preset 只会提供 token 和基础件，不会自动替你修正业务层的私有样式；如果页面继续堆硬编码颜色类，最终效果一定更像“套着 shadcn 按钮的自定义皮肤”，而不是 seed 本身。为避免再次漂移，已补 `dashboard-v2-preset-alignment` 测试约束主工作台不得再写这套私有配色词

- ✅ 把 v2 preview 拆成真正的多视图工作台：`frontend/src/App.tsx` 不再直接承载全部状态和视图，现已拆成 `/v2/projects`、`/v2/skills`、`/v2/activity` 三个路由视图，并由独立的 `use-dashboard-workspace` 管理项目列表、快照缓存、SSE 刷新和手动刷新
- ✅ 补齐第一批 shadcn 核心件并接入业务层：已通过 CLI 引入 `table / tabs / dialog`，技能列表改为 shadcn `Table`，主工作台导航改为 `Tabs`，技能详情入口改为 `Dialog`，不再继续在 v2 里手搓新的列表/切页/弹层基础件
- ✅ 打通 `/v2/*` 前端路由的服务端回退：dashboard server 现在会把 `/v2/skills` 这类无扩展名子路径回退到 v2 `index.html`，刷新多视图路由不再 404
- 📝 记录工作台路由经验：当 v2 开始使用真正的前端路由时，只完成 React 侧 `BrowserRouter` 还不够；服务端必须同步区分“构建资源请求”和“无扩展名应用路由”，否则本地点击能用，但浏览器刷新会直接掉回 404
- 📝 记录组件迁移经验：从 shadcn 覆盖主题继续往前推进时，优先补 `table / tabs / dialog` 这类结构型基础件，比继续打磨 hero 样式更值；因为只要列表、路由和弹层还在自定义壳层里，后续高交互页面就无法稳定复用

- ✅ 对 `frontend/` 执行 shadcn preset overwrite：已直接应用 `b4NKaHect`，当前前端风格切到 `radix-vega`，并把基础配置同步成 `olive` base color 与 `hugeicons` icon library
- ✅ 收口 overwrite 后的组件契约漂移：preset 覆盖把 `badge/button/card` 直接替换成 shadcn 标准实现后，业务层已从自定义 `tone` 语义切回标准 `variant` 契约，`frontend build` 与根仓 `build` 均恢复通过
- 📝 记录 preset 迁移经验：shadcn 的 overwrite 不只是换主题变量，它会连同现有基础件源码一起覆盖；如果业务层提前包了非标准 props（例如自定义 `tone`），覆盖后最先炸的通常不是样式，而是编译期接口漂移。正确做法是把业务层语义尽量贴近 shadcn 标准 API，减少 overwrite 的适配面

- ✅ 建立 dashboard v2 独立前端隔离层：新增 `frontend/` 子工程，使用 `React + Vite + Tailwind v4 + shadcn core libs` 构建新 UI，构建产物输出到 `dist/dashboard-v2`，现有字符串式 dashboard 不再与 v2 共用 DOM、类名或静态资源入口
- ✅ 打通独立入口 `/v2`：dashboard server 现在会优先服务 `dist/dashboard-v2/index.html` 与 `/v2/assets/*`，构建缺失时返回明确 fallback shell；旧入口 `/` 和旧 `/assets/dashboard.*` 保持不变，具备双入口并存的安全切换条件
- ✅ 完成 shadcn 可用性校验：本机 `shadcn` MCP 已处于 enabled 状态，`npx shadcn@latest mcp --help` 可执行；`frontend/` 已补齐 `components.json`、Tailwind v4 样式入口和 `@/` alias，`npx shadcn@latest info --json --cwd frontend` 已能识别项目并列出 `button / badge / card`
- 📝 记录前端迁移经验：当旧 UI 的 HTML shell、样式和运行时代码都耦合在一条字符串拼装链里时，问题已经不是“局部样式污染”，而是“表示层边界不存在”；这类场景必须先切独立入口和独立资产管线，再谈组件迁移，否则任何 shadcn 改造都会被旧结构反向绑死
- 📝 记录静态资源经验：如果新前端走文件系统静态资源而旧前端走内存拼装资源，路径规范化要单独做校验；这次 `/v2/assets/*` 首轮 404 的根因不是路由没接上，而是 `fileURLToPath()` 尾斜杠导致安全前缀校验误判，说明“可访问”与“可安全访问”要分别验证

### 2026-04-21

- ✅ 拆分 dashboard 配置页二级子 tab：`模型` 子 tab 只承载模型服务商列表与 LLM 安全闸门，`演进策略` 子 tab 承载提示词配置；当前子 tab 会写入 bootstrap cache，刷新后继续回到用户正在编辑的配置分区
- 📝 记录配置页经验：把一个自动保存表单拆成多个子 tab 时，不能继续无条件从 DOM 收集所有字段；隐藏或未渲染的分区必须从当前 state 回退，否则用户在“演进策略”里改提示词时会把模型服务商、安全闸门等离屏配置清空
- ✅ 完成 dashboard 浏览器侧缓存三阶段收口：首屏 bootstrap cache 已接入 `localStorage`，HTML shell 已拆出内容哈希静态资源，`/snapshot` 与 skill family 相关 JSON 路由已支持 `ETag/304`
- 📝 记录缓存经验：浏览器刷新性能不能只靠后端 reader cache；真正影响体感的是“首屏是否能立刻复用上次状态”和“静态资源 URL 是否只在内容变化时失效”。如果资源路径直接绑定运行时 `buildId`，daemon 每次重启都会把浏览器缓存打穿
- 📝 记录验证经验：排查 dashboard 缓存是否真的生效时，不能只看页面“好像变快了”；至少要同时检查 HTML 是否引用 `/assets/dashboard.<hash>.*`、资源路由是否返回 `immutable` header，以及 JSON 路由在 `If-None-Match` 命中时是否真正返回 `304`
- ✅ 修复 dashboard 启动期 `HTTP 431`：浏览器此前缓存过的超长旧 `ETag` 仍可能被默认 `fetch` 自动带回 `If-None-Match`，导致请求在进入业务路由前就被 Node 的 header 限制拦下；现在 dashboard 的 `GET` JSON 请求统一显式走 `cache: 'no-store'`，只保留应用层自己维护的轻量 `ETag` 重验证
- 📝 记录缓存经验：当应用自己实现 `ETag`/内存 revalidate 时，不能再把浏览器默认 HTTP cache 也留在链路里一起工作；否则旧缓存里的 validator 会跨版本残留，最终形成“服务端逻辑已修好，但浏览器启动仍直接带着历史巨型头请求”的隐性故障
- ✅ 修复 skills 页内联详情在实时刷新后卡死为“加载中”：技能库 live update 以前会先整面板重绘，再为了省请求跳过当前实例的重新拉取，结果把已加载的 editor/history 重建成占位态后就再也没人回填；现在当前技能内容、版本列表与选中版本都会落在浏览器状态里，面板重绘前先捕获草稿，重绘后按状态恢复详情，不再因为 SSE/手动刷新而丢失已打开内容
- 📝 记录前端恢复经验：像 dashboard 这种“长驻页面 + SSE 增量刷新 + 局部编辑器”场景，不能只做“避免重复请求”的优化，还必须保证重绘后的可见 DOM 能从状态恢复；否则省掉的那次请求反而会把用户停在永久 `loading`，形成典型的 UI 状态机断层
- ✅ 移除 skills 页顶部废弃宿主过滤条：技能库主路径不再展示 `全部 / Codex / Claude / OpenCode` 过滤模块和顶部计数，也不再让历史缓存里的 `selectedRuntimeTab` 继续影响 family 列表；宿主切换只保留在右侧具体 skill 实例详情里，避免一个已经废弃的全局过滤状态把列表筛成 `0 个技能`
- 📝 记录产品经验：当信息架构从“按宿主过滤列表”转成“family 列表 + 详情内选宿主”后，不能只删可见按钮；任何旧 UI 状态、bootstrap cache 字段和列表过滤函数都要同步降级，否则用户看不到过滤控件，却仍会被隐藏状态影响结果

### 2026-04-20

- ✅ 从设计层收紧长时间运行的性能退化：`task-episodes.json` 不再把全量 trace id / turn id 当成持久化真相，而是改为“累计计数 + 有界热窗口”模型；活跃 episode 与已关闭 episode 分别应用不同保留上限，运行时间再长也不会让该文件线性膨胀
- ✅ 把 episode 上下文恢复从 “traceRefs 精确枚举” 改成 “按 session + 时间窗重建”：activity detail、自动 probe、手动 optimize 现在都能直接从 session trace 里恢复完整窗口，不再要求 `task-episodes.json` 永久保存全部 trace 引用
- ✅ 收紧 dashboard SSE 广播的版本探测放大效应：同一轮 broadcast 现在按项目只计算一次 snapshot version，不再随着连接客户端数量线性重复做版本读取
- ✅ 修复 trace 热路径的 session 读取设计：`TraceManager` 不再把“当前活动 session 的 trace store”当成所有查询的事实来源；现在按 session 文件持久化，并在内存中维护 session timeline cache 与 recent trace buffer，避免每条 trace 都整文件反序列化长会话
- ✅ 给 dashboard 项目状态轮询拆出轻量 `skillCount` 读侧：项目列表和 SSE 心跳现在直接读取 `.ornn/shadows/index.json` 的数量，不再为了 sidebar 的一个计数去扫描每个 skill 的版本目录和 `latest` 链接
- 📝 记录性能经验：像 `task-episodes.json` 这种既在热路径写入、又会被 dashboard 周期读取的状态文件，绝不能把“完整历史明细”直接当作在线事实来源；正确边界应该是“热窗口 + 可重建上下文 + 累计统计”，否则运行时长最终一定会转换成持续卡顿
- 📝 记录性能经验：任何出现在“每条 trace 都会触发”或“固定心跳轮询”的路径，都不能复用面向详情页的重读侧。热路径应该有自己受控的轻量事实来源，否则当前数据量乘以运行时长，最终一定变成体感卡顿

### 2026-04-19

- ✅ 调整 dashboard 一级导航：移除“主页” tab，并将原 `技能 -> 项目总览` 拆成独立一级 `项目` tab；当前固定顺序为 `技能 -> 项目 -> 配置`
- 📝 记录信息架构经验：如果一个子视图已经承载独立工作现场和专属导航，就不应该继续塞在另一个一级页里；把“技能库”和“项目工作台”拆成并列一级入口，比分别依赖“主页 + 子 tab”更直接，也更符合 users 的心智模型
- 📝 记录规划经验：涉及对象模型重构的工作，不能只写“目标状态”，还必须把实施顺序、阶段门槛、验证矩阵和回滚策略写进工程计划；否则后续很容易跳过 projector / 双 API 并存这些真正决定风险的步骤
- 📝 记录产品建模经验：跨宿主 skill 管理不能再让单一 `skill_id` 同时表达 skill 家族、安装实例和修订历史；V2.0 需要至少拆出 `Skill Family / Skill Instance / Skill Revision` 三层对象，并在 UI 中同时提供 `Skill 视角` 与 `项目视角`
- ✅ 移除 dashboard header 中的 `build #...` / `pid:...` 运行时信息展示，顶部只保留品牌、一级导航、语言与连接状态，不再把面向排障的内部元数据暴露在主界面
- 📝 记录信息边界经验：像 build 号、进程 pid 这类信息属于诊断上下文，不应该长期占据 dashboard 的主视觉层；默认界面要优先服务“看懂和操作”，而不是把内部实现细节当成常驻信息展示
- ✅ 删除 dashboard 一级页面的重复头部模块：主页、技能工作台、配置页不再渲染独立 `page-hero` 区块，页面内容直接从统计卡、子 tab 或配置卡开始，避免与 header 里的一级 tab 重复表达同一层标题
- 📝 记录信息架构经验：当 header 已经承担主导航和当前语义时，页面内部再放一层大标题模块只会制造“同一概念被说两遍”的噪音；这类模块要么承载真实上下文差异，要么就应该整体删除，而不是只删副标题
- ✅ 收紧 dashboard 一级页面头部：主页、技能工作台、配置页已移除 `OrnnSkills/ORNNSKILLS` kicker、解释性段落和项目路径宣言，只保留标题与必要 badge，避免页头重复表达概念却不提供新信息
- 📝 记录交互经验：dashboard 页头不应该承担“宣讲产品定位”的任务；当导航层级已经表达清楚上下文时，再叠加品牌词、路径和解释性段落只会制造视觉噪音，真正有价值的信息应该留给标题、状态和可操作内容
- 📝 记录环境验证经验：dashboard 是由运行中的 daemon 进程内嵌输出完整 HTML/CSS/JS；排查“源码已改但页面还是旧样式”时，不能只看仓库文件和单测，必须直接 `curl http://127.0.0.1:<port>/` 检查实际返回的标记和样式是否仍包含旧 `workspace-bar`、旧 `main-tab` 规则
- 📝 记录启动经验：全局 `ornn` 实际执行的是 `/opt/homebrew/lib/node_modules/ornn-skills/dist/cli/index.js`；要让当前仓库的 dashboard 改动真正落到正在使用的界面，需要先 `npm run build`、再 `npm install -g .`，最后重启 daemon，否则很容易出现“仓库代码和浏览器界面不是同一个版本”的假象

### 2026-04-18

- ✅ 修复 daemon stale runtime 路由回归：项目已从全局注册表移除但 runtime 尚未被下一轮 sync 清理时，daemon 现在会先核验注册表事实来源，不再继续处理该项目的新 trace
- 📝 记录一致性经验：只要某个运行时对象的生命周期受全局注册表驱动，trace 路由就不能把“内存里还留着 runtime”当成项目仍然有效的事实来源；否则注册表与运行时缓存之间的短暂不同步就会直接变成行为回归
- ✅ 完成 `src/daemon/index.ts` 拆分收口：将 project runtime 注册/同步、retry queue、checkpoint 持久化、daemon 生命周期管理拆到独立模块，`Daemon` 保留 facade 与旧测试入口，`src/daemon/index.ts` 已降到 346 行
- 📝 记录测试经验：Vitest 的模块 mock 只要缺了某个 export，即使用 namespace import，也可能在读属性时由代理直接抛错；这类兼容层不要依赖“先判断 export 是否存在”，而应在真正读取注册表能力时显式 `try/catch` 并回退到安全默认值
- 📝 记录重构经验：给旧代码外面再包一层“看起来无害”的 `async` facade，会改变微任务层级并悄悄打破依赖时序的历史测试；重构时如果目标是行为保持，就要优先复用原有 await 边界，而不是机械增加中转 async 方法
- ✅ 完成 `src/core/shadow-manager/index.ts` 拆分收口：将 trace ingest、episode probe、optimization runner、manual optimize 四块职责拆到独立服务，`ShadowManager` 保留 facade，主入口已降到 196 行
- 📝 记录架构经验：自动窗口分析和手动窗口分析虽然共用同一 analyzer，但事件语义并不相同；自动路径会补 `skill_feedback` 支撑信息，手动路径不能机械复用同一后处理，否则 dashboard 会出现重复或漂移的反馈事件
- 📝 记录测试经验：凡是生产链路通过 callback 回写副作用（例如 `executeOptimizationPatch` 里的 `onPatchApplied` 用来更新冷却/计数状态），测试桩也必须显式兑现同一个 contract；只 mock 一个 “ok=true” 返回值，会把真实状态迁移路径测丢

### 2026-04-16

- ✅ 降低 Codex observer 的误报噪音：reconciliation 补偿到小幅 session 文件增长时改记为 debug，仅在缺口较大时保留 warn，避免把 watcher 的正常补偿路径误读为故障
- ✅ 收紧 dashboard SSE 快照体积：项目 snapshot 中的 `decisionEvents` 上限改为 150，减少多客户端同时推送时的大包告警和浏览器端解析负担
- 📝 记录运行经验：文件监听系统对活跃日志文件的 append 事件并不提供强一致交付，observer 用 reconciliation 补偿是正常设计；只要补偿增量很小且数据能正确追平，就不该长期以 warn 级别刷屏
- 📝 记录性能经验：dashboard 的 SSE 快照不能把“活动页未来可能用到的全部事件”都塞进常规广播；像 `decisionEvents` 这类可增长对象必须给快照单独设体积预算，否则连接数一上来就会把同一份大 payload 成倍放大
- ✅ 补齐 dashboard 全局配置迁移兼容：当 `~/.ornn/config/settings.toml` 尚不存在时，dashboard/后端现在会优先接住当前项目历史上的 `.ornn/config/settings.toml` 与 `.env.local`，并自动迁移到全局配置目录，避免架构升级后用户原有模型配置“看起来消失”
- 📝 记录迁移经验：把项目级配置改成全局配置时，不能只改“新路径写到哪里”，还必须补上“旧路径第一次如何被发现和迁移”。否则代码虽然语义上已经全局化，用户体验上却会直接表现为“之前配好的模型没了”
- 📝 记录环境经验：本地源码变更后如果需要让全局 `ornn` 立即生效，稳定做法是先执行 `npm run build`，再执行 `npm install -g .`；这样会把当前仓库最新 `dist` 产物重新安装到全局包目录，而不依赖旧的 `npm link` 软链状态
- 📝 记录环境经验：验证“是否真的装上了新 CLI”时，不要只看构建成功；至少同时检查 `which ornn`、软链目标以及 `ornn --version`。否则很容易出现仓库已编译成功，但终端实际还在跑旧全局包的错觉

### 2026-04-17

- ✅ 恢复 GitHub Actions CI 全链路：先清掉 `Lint` 阶段的 16 个 hard error，再补齐 `dashboard/ui.ts` 的浏览器状态注入链路，并把 `shadow-manager` 单测里的 `decision-explainer` 收回到 mock 边界；`lint`、`typecheck`、`build`、`vitest --run` 现已全部通过
- 📝 记录 CI 排障经验：当 GitHub 页面表面上显示“每次提交 test 都失败”时，先看 workflow 的实际失败步骤，而不是直接盯测试日志；像这次就是 `Lint` 先失败把后续 `typecheck/build/test` 全部短路。修完第一层 gate 后，再本地跑完整链路，才能把被前置步骤掩盖的真实问题一起暴露出来
- ✅ 补齐 rotating global log stream 的兼容和追平：共享日志读取层恢复旧 `[timestamp] ERROR: message` 格式解析；dashboard 增量读取现在会顺序追平轮询间产生的多个轮转分片；`ornn logs` 在 `--level/--skill` 稀疏匹配场景下会自动扩大回看窗口，不再因为尾部噪音过多而误报“没有匹配日志”
- 📝 记录可观测性经验：把多处日志读侧收口成共享能力时，不能只修“当前最新文件”这一种 happy path；旧格式兼容、连续轮转追平和稀疏过滤回溯都必须一起纳入契约，否则 dashboard 和 CLI 只是表面统一，换一种流量形态仍会悄悄漏数
- ✅ 把全局日志读取提升为共享“逻辑日志流”能力：dashboard 日志看板与 `ornn logs` 现在统一按 `combined.log*` / `error.log*` 聚合读取，不再因为 Winston 轮转后只盯单个物理文件而出现“宿主仍在运行、日志面板却长时间不更新”的假死
- 📝 记录可观测性经验：只要日志落盘启用了轮转，消费侧就不能把某个物理文件名当成稳定事实来源。正确边界应该是“读取一个逻辑日志流”，由共享层负责发现最新分片、处理 offset 切换；否则 dashboard、CLI 等各自实现时迟早会再次分叉
- ✅ 打通 dashboard 技能版本卡片到优化 scope 的跳转：自动优化生成的新版本现在会把 `activityScopeId` 落进版本元数据，版本历史中的蓝色原因标签会升级成可点击按钮，直接打开对应 scope 的时间线弹窗
- 📝 记录交互经验：版本历史卡片上的跨面板跳转不能依赖“用户之前是否已经打开过活动列表”这种隐式前置条件；像 scope 详情这类深链入口，必须直接基于 canonical `scopeId` 拉详情，而不是复用某个页面的行缓存
- 📝 记录测试经验：这类“UI 标签可点开后端实体”的功能不能只测渲染；还要同时覆盖写侧元数据落盘和读侧按钮生成，否则很容易出现按钮在 mock 数据里能显示、真实自动优化版本却没有可跳转 scope 的假完成
- ✅ 降低 observer / decision-explainer 告警噪音：`CodexObserver` 现在会对同一路径的连续 reconciliation 大增量恢复做冷却节流，避免同一活跃 session 每隔几秒重复刷 warn；`decision-explainer` 在第一次拿不到有效 JSON 时会自动带强约束再重试一次，并把最终失败日志补上原始响应摘要，减少无信息量 warn
- 📝 记录调试经验：实时监听链路里的恢复告警不能只看“有没有补偿”，还要看“同一问题是否在短时间内重复刷屏”；对于这类连续恢复，warn 更应该表达“进入异常状态”，而不是把每次补偿都单独记成新的故障
- 📝 记录协议经验：要求模型输出 JSON 的链路，第一次解析失败时不要立刻放弃；先用更严格的“只返回 JSON 对象”约束重试一次，通常能显著降低 reasoning 模型偶发吐出 prose / markdown 的概率
- ✅ 从协议层根治 dashboard SSE 大包：steady-state `/events` 广播不再内嵌 `projectData`，只发送 `projects / logs / changedProjects`；前端改成按需刷新当前选中项目的 `/snapshot`，非当前项目只标记为 stale，等真正切换过去时再拉详情
- 📝 记录架构经验：SSE 最怕把“全量详情”当成实时协议本体。正确边界应该是“推变更信号，拉详细快照”；只要把重对象放回按需 HTTP 读取，连接数增长时成本才会近似保持常数级，而不是被 `客户端数 × 项目数 × 快照体积` 成倍放大
- ✅ 二次收紧 dashboard SSE 快照预算：项目 snapshot 的 `decisionEvents` 窗口从 150 收到 35，`recentTraces` 窗口收紧到 30，并把 snapshot 内 `skills` 条目瘦身为 UI 真正使用的字段；当前双项目合并 `projectData` 体积已从约 291KB 降回约 128KB 内
- 📝 记录性能经验：SSE 快照预算不能只盯单个大字段；`decisionEvents`、`recentTraces` 和 `skills` 这类“每项不算大、但会按项目数和连接数同步放大”的集合字段，必须一起做窗口和 schema 瘦身，否则单项优化后总包体积仍会卡在告警线附近
- ✅ 补齐 dashboard 技能版本 mute/restore：版本历史卡片现在支持直接“无效 / 恢复”指定版本；被无效的版本会保留编号占位，但退出生效链路，实际部署、评估与后续读取都会自动回退到最新有效版本
- 📝 记录版本管理经验：技能版本体系里“编号最新版本”和“当前有效版本”不是同一个概念；一旦支持 mute/restore，就必须把两者拆开建模。编号递增负责历史连续性，`latest`/runtime/shadow 则必须指向“最新有效版本”，否则 UI、部署和评估链路一定会出现状态漂移
- ✅ 修复 dashboard “添加项目”只登记不生效：现在无论是原生目录选择器还是手动输入路径，都会先补齐 `.ornn` 初始化，再确保全局 daemon 已启动，新增项目不再只是写入注册表
- ✅ 缩短 daemon 对新增项目的接管延迟：注册表同步轮询从 5 秒收紧到 1 秒，已经运行中的 daemon 会更快把新项目纳入监控
- 📝 记录接入经验：把项目加入 dashboard 不等于项目已经开始被监控；真正生效至少要满足三件事同时成立：项目存在 `.ornn`、项目路径已注册、全局 daemon 正在运行。任何一环缺失，用户看到的都只是“列表里多了一项”
- ✅ 修复 dashboard 技能编辑弹窗的版本历史选中态：点击旧版本后，右侧历史卡片的高亮边框与“当前”标签现在会同步切到实际选中版本，不再一直停留在最新版本
- 📝 记录前端经验：同一块 UI 里如果“内容区”和“选中态装饰”分别读不同状态源，就很容易出现内容已经切换、动画却停在旧卡片的假故障；像版本历史这种交互组件，列表高亮、标题标签和详情内容必须由同一份选中版本状态统一驱动
- ✅ 修复 dashboard 左下角“添加项目”入口：点击后会直接调用宿主原生目录选择器，选中文件夹后立即注册项目并切换到该项目，不再先要求用户手输路径
- 📝 记录交互经验：浏览器侧通用文件选择 API 拿不到可直接注册到后端的绝对项目路径；这类“要把本地目录交给 Node 服务端继续处理”的场景，正确事实来源应是宿主原生目录选择器，而不是前端自己猜路径
- ✅ 收紧 npm 发布清单：`package.json` 新增 `files` 白名单，并在 `prepack` 阶段强制执行 `npm run build`，避免把仓库里的本地技能副本、运行时状态和分析产物一起打进 npm 包
- 📝 记录打包经验：发布 CLI/工具包时，不能只看“能不能 `npm publish`”；必须先跑 `npm pack --dry-run` 检查 tarball 实际内容。像 `.ornn/`、`.agents/`、`.codex/`、`.claude/`、`show-my-repo/` 这类本地运行或分析目录，默认很容易被带进包里，正确做法是用 `files` 白名单显式收口

### 2026-04-15

- ✅ 修正实时追踪的业务语义分层：`analysis_failed` 仍保留为 `stability_feedback` 根因事件，但 dashboard 会额外合成一个 `analysis_interrupted` 核心流程终态，避免“核心流程”过滤下只剩“开始分析”，让每个 scope 都能看见本轮是否真正形成业务结论
- ✅ 去工程化实时追踪状态列：活动表不再直接展示 `episode_ready / continue_collecting / no_patch_needed` 这类内部枚举，而是统一映射为 `分析中 / 继续观察 / 无需优化 / 已应用 / 已中断` 等业务状态
- ✅ 收紧 daemon 状态回填语义：dashboard 读侧不再把“最近一次分析失败”回填成 daemon 的当前 `error` 状态，而是仅保留 `lastError`；当前状态继续以 checkpoint 和活跃 episode 为准，避免守护进程明明空闲却长期显示错误
- 📝 记录可观测性经验：`analysis_failed` 这类稳定性反馈不是核心业务节点，但它又确实会截断一条业务链路。正确做法不是把失败事件硬塞进核心流程，而是额外产出一个面向用户的“业务终态”节点，再把技术根因留在稳定性层
- 📝 记录可观测性经验：daemon 的“当前状态”和“上次错误”必须拆开建模；只要把历史失败直接提升成当前状态，用户就会把“曾经失败过”误读成“现在仍然故障”，进而削弱对看板的信任
- ✅ 修复 session-backed pipeline 的候选漂移：`session-window-candidates` 现在只会为 `recentTraces` 实际命中的 trace 建立 skill candidate，full session timeline 仅用于补上下文，不再因为长会话里更早的历史 skill 被重新映射而重复打开陈旧优化窗口
- ✅ 收紧 analyzer 协议校验：`apply_optimization` 结果现在必须携带完整结构化 `evaluation`，且至少满足 `should_patch=true + change_type`；缺失执行字段时会直接归类为 `analysis_failed`，不再伪装成可执行 patch 建议
- 📝 记录架构经验：恢复真实 session 时间线是为了补上下文，不是为了重跑整段历史上的所有 skill 候选；candidate 选择权仍然必须留在触发本轮分析的 recent batch 手里，否则长会话会持续复活陈旧窗口，破坏增量分析语义
- 📝 记录架构经验：共享分析协调层可以做“无害归一化”，但不能替 analyzer 脑补执行必需字段；凡是会进入 patch 链路的字段都必须被当作协议硬约束校验，缺失时宁可失败，也不能静默伪造一个看起来可执行的结论
- ✅ 修复 daemon/dashboard 启动 OOM：`CodexObserver` 不再在 bootstrap 和 change 事件中整文件重读 session JSONL，而是改成“启动时 priming 文件末尾偏移 + 最近 1 个 session 的 10 行安全尾部回放 + 后续按字节偏移增量读取”；同时跳过 `compacted / event_msg / turn_context` 这类 transport 或维护型事件，并对结构化 payload 做轻量摘要，避免长会话把 observer/daemon 直接压爆
- 📝 记录运行经验：Codex 的真实 session 日志里会出现多 MB 级的 `compacted` 行和几十万字符的历史消息包。只要 observer 继续“整文件 read + split + 全 payload 保留”，daemon 重启时就会在 bootstrap 阶段稳定 OOM；正确做法必须是“按偏移增量读取 + 只保留进入业务链路的最小语义片段”
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
- 📝 记录恢复经验：dashboard 成本页依赖异步 catalog 时，不能只在进入 `cost/config` tab 后才启动请求，更不能只给 `config` 页做完成态重绘；否则用户会看到“已进 tab 但一直暂无定价”，直到 SSE 或其他事件偶然触发刷新。正确做法是项目选中后后台预热 catalog，并在 `cost` 页请求完成后立即重绘
- 📝 记录前端经验：像成本 hero 这类中英文混排说明文案，不要偷懒用 `max-width: 30ch` 一类英文字符宽度去硬控换行；`ch` 对中文并不等价，会在视觉上出现“明明还有空位却提前折行”的假拥挤，应优先让文案跟随真实容器宽度换行
- 📝 记录前端经验：dashboard hero 区要克制信息密度；如果右侧 summary cards 已经给出模型数、调用数和拆分摘要，左侧 hero 就只保留主数字和一句说明，别再追加一排重复 pills，否则会同时制造视觉噪音和信息重复
- 📝 记录恢复经验：dashboard 的实时感不能靠固定周期“全量重算 + 全量推送”硬顶。像 `agent-usage.ndjson` 这类会持续增长的文件，一旦被放进定时快照链路里反复全量解析，性能会随使用时长线性变差。正确做法是给读侧加文件签名缓存，再在 SSE 层只推有版本变化的项目

| 阶段                       | 状态      | 进度 | 预计时间 |
| -------------------------- | --------- | ---- | -------- |
| Phase 1: 基础框架          | ✅ 完成   | 100% | 2 周     |
| Phase 2: Registry          | 🔄 进行中 | 0%   | 2 周     |
| Phase 3: Observer Layer    | ⏳ 待开始 | 0%   | 2 周     |
| Phase 4: Evaluator & Patch | ⏳ 待开始 | 0%   | 3 周     |
| Phase 5: 自动循环          | ⏳ 待开始 | 0%   | 2 周     |
| Phase 6: Rollback & Rebase | ⏳ 待开始 | 0%   | 1.5 周   |
| Phase 7: CLI 完善          | ⏳ 待开始 | 0%   | 1.5 周   |
| Phase 8: 测试 & 打包       | ⏳ 待开始 | 0%   | 2 周     |

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

### 2026-04-17

- ✅ Dashboard 项目列表新增开始/暂停按钮：可以逐项目暂停或恢复监听，不再只能依赖全局 daemon 开关
- ✅ 项目注册表新增 `monitoringState` / `pausedAt` 持久状态；dashboard server 与 snapshot 会把暂停态直接返回给 sidebar 和总览面板
- ✅ Global daemon 现在会在路由每一条 trace 前检查项目暂停态；暂停项目的 trace 会被即时跳过，不需要等下一轮 registry sync 才生效
- ✅ 暂停时会移除对应项目 runtime 并清空该项目 retry queue，避免 pause 期间继续消耗 LM 分析与重试链路
- ✅ 恢复后继续使用 observer 的实时增量流；暂停期间被跳过的 trace 不做补回，和“从恢复时刻开始继续监控”的语义保持一致
- ✅ 新增回归测试：覆盖 dashboard monitoring API、sidebar 开始/暂停交互，以及 daemon 在 pause/resume 间的 trace 路由切换
- 📝 运维经验：排查“为什么某段时间没有 trace / 分析事件”时，先看项目注册表里的 `monitoringState` 与 `pausedAt`。若项目在该时间窗处于 paused，缺失数据属于预期行为，不应再去追查 observer 丢事件或 LLM 链路异常

### 2026-04-15

- ✅ 修复实时追踪“看起来几小时没更新”的快照取数缺陷：dashboard 快照现在会在最新 trace 之外，额外回填一小批最近带 `skill_refs` 的 trace，避免大量空 `skill_refs` 工具事件把真正的技能调用完全冲出业务看板
- ✅ 修复 `CodexObserver` 实时增量读取对 partial line 的脆弱性：新增按文件缓存的残片缓冲，允许 watcher 在 JSONL 行尚未完整写完时先记住残片，待下一次 change 再拼成完整事件，避免实时链路吞 trace
- ✅ 去掉 `CodexObserver` 对 `awaitWriteFinish` 的依赖，改为由 observer 自己处理增量拼接，降低持续 append 的长会话文件被 watcher 延迟甚至漏掉的概率
- ✅ 新增回归测试：覆盖“很多更新后的空 `skill_refs` trace 不应把最近技能调用从快照中挤掉”与“partial append 不得导致 observer 吞 trace”
- 📝 调试经验：如果实时追踪长时间看起来不动，先区分两类假死。`default.ndjson` 在增长、但业务看板没有新行，优先检查最近快照里是否仍保留带 `skill_refs` 的 trace；如果 daemon 日志持续出现 `Recovered missed session file growth during reconciliation`，说明 watcher 正在退化为补偿扫描模式，需要重点检查 observer 的增量读取和文件监听策略
- ✅ 修复 `CodexObserver` 的会话恢复断流问题：新增“最近活跃 session 增长补偿轮询”，即使 watcher 漏掉 `change` 事件，也会按字节偏移补读新增 trace
- ✅ 修复重复 `add` 事件被直接短路的问题：同一路径再次出现时，会先比较文件大小和已处理偏移，必要时补读增量，而不是无条件跳过
- ✅ 修复“episode 只增长上下文但 probe 永不触发”的业务链断点：`ShadowManager.processTrace()` 现在会在 `recordContextTrace()` 之后重新评估 probe 触发条件
- ✅ 新增回归测试：覆盖 observer 重复 `add` 恢复、漏掉 `change` 后的 recent-growth 补偿，以及“先命中一次 skill、后续仅 context trace 增长也必须触发 probe”
- 📝 调试经验：实时追踪“完全没新增”时，先同时核对三层文件：`~/.codex/sessions/**/*.jsonl` 的最新 mtime、`.ornn/state/default.ndjson` 的尾时间、`.ornn/state/task-episodes.json` 的 open episode。若第一层在增长、第二层停住，断点在 observer；若第二层在增长、episode 的 `totalTraceCount` 在涨但 `probeCount` 仍为 0，断点在 episode -> probe 触发链

### 2026-04-12

- ✅ 修复成本看板长期无数据的 episode 统计口径问题：probe 现在按 session 窗口累计 trace，而不是只看映射命中的少量 trace
- ✅ 新增 `shadow-manager-task-episodes` 回归测试，覆盖“session 已达阈值但仅部分 trace 映射到 skill”时仍应触发 probe
- 📝 补充调试经验：当成本看板为空时，先核对 `.ornn/state/agent-usage.ndjson` 是否存在，再对照 `task-episodes.json` 的 `totalTraceCount` 与 `mappedTraceCount` 是否失衡
- ✅ 重做成本页布局：改成 `hero + summary grid + main table + side rail` 的层次结构，弱化“堆表格”观感
- 📝 记录前端经验：成本页这类信息密度高的看板，优先把“主结论”放到 hero，再把拆解放到侧栏，避免所有卡片权重一致
- ✅ 统一 dashboard token 紧凑单位为 `K` / `M`，不再按中文环境显示 `千` / `百万`
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
- ✅ 切换 daemon 进程架构：`ornn init` 负责把项目注册进全局注册表，`ornn start`/`ornn restart` 改为单个全局进程，统一监控所有已登记项目
- ✅ `CodexObserver` 现在会保留 session `cwd` 到 trace `metadata.projectPath`，供全局 daemon 把 trace 路由到正确项目
- 📝 运维经验：全局 daemon 的监控范围只依赖注册表，不再依赖当前 shell 所在目录；排查“为什么某项目没被监控”时，先确认该项目是否执行过 `ornn init`

---

### 2026-03-21

- ✅ 完成 Phase 1 所有任务
- ✅ 项目基础框架搭建完成
- ✅ 存储层实现完成
- ✅ 工具函数库完成
- ✅ 配置系统完成
- 🔄 开始 Phase 2 开发

---

_最后更新：2026-04-17_
_更新人：OrnnSkills Team_
