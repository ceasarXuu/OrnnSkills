# OrnnSkills 工程计划 v1.0

> 说明：本文件后续大部分章节仍保留 V1 时代以 `origin skill / project shadow` 为核心的历史设计。以下 `0. V2.0 Skill Domain Refactor Addendum` 为当前优先级更高的补充方案，后续 V2.0 的对象模型、读模型和 Skills 页信息架构应优先遵循本节，而不是继续沿用“一个 skill_id 代表一切”的旧假设。

## 0. V2.0 Skill Domain Refactor Addendum

### 0.1 重构目标

本轮重构的目标不是简单改列表样式，而是把 OrnnSkills 从“项目内 shadow 管理器”升级为“skill-first 的本地管理器”。核心要解决 4 个问题:

1. 明确区分 `Skill Family`、`Skill Instance`、`Skill Revision`
2. 让 `Skills` 页既支持全局 skill 视角，也支持项目内实例视角
3. 让活跃监控、版本、迁移、演进基于同一套对象模型表达
4. 在不打断现有 daemon / shadow 演进链路的前提下，逐步迁移到新模型

### 0.2 目标对象模型

V2.0 默认采用以下对象层级:

- `SkillFamily`
  - 用户认知中的“同一个 skill”
  - Skills 页默认列表单位
- `SkillInstance`
  - 某个项目、某个宿主、某个安装路径中的一个安装副本
  - 启停、迁移、卸载、平移等操作目标
- `SkillRevision`
  - 某个实例内部的修订历史
  - 对应当前 effective revision / disabled / rollback 语义
- `SkillRelease`
  - 跨实例可共享的内容基线
  - V2.0 P0 可先不直接暴露到 UI
- `SkillUsageFacts / SkillUsageSummary`
  - 使用观察事实与聚合结果
  - 不能继续只依赖 `traceCount`

### 0.3 唯一键与身份规则

V2.0 需要同时维护三类唯一性:

1. `family_id`
   - 解决“这是不是同一个 skill 家族”
   - 推荐基于 `skill_key = publisher/name` 或规范化 skill 名生成
2. `instance_id`
   - 解决“这是不是同一个安装实例”
   - 推荐基于 `project_id + runtime + install_path` 生成稳定自然键，并保留内部 UUID
3. `content_digest`
   - 解决“这是不是同一份内容”
   - 推荐对规范化 skill 内容做 hash

不再允许单一 `skill_id` 同时承担 family、instance、content 三种语义。

### 0.4 兼容策略

第一阶段不直接重写 daemon 主链路，而是采用“旧写入链路 + 新投影读模型”的兼容策略:

- `.ornn/shadows`
- `.ornn/skills/*/versions`
- `trace_skill_mappings`
- `agent-usage.ndjson`

以上数据源继续按现有方式生产。

新增一个 `skill domain projector` 负责:

- 从旧数据结构投影出 `families / instances / revisions / usage summaries`
- 补全 UI 所需的 family 级与 instance 级聚合结果
- 让 dashboard 先切换到新读模型，而不是先动优化闭环

### 0.5 存储层重构

建议在现有 SQLite / state 文件之上新增以下读模型表:

- `skill_families`
- `skill_instances`
- `skill_revisions`
- `skill_releases`
- `skill_usage_facts`
- `skill_usage_rollups`
- `skill_identity_links`

旧表到新表的映射建议如下:

- `origin_skills`
  - 迁入 `skill_families` + `skill_releases` 的来源基线语义
  - 不能再只按 `skill_id` 作为唯一主键理解整个 skill
- `shadow_skills`
  - 迁入 `skill_instances` + 当前有效 `skill_revisions`
  - 现有 `UNIQUE(project_id, skill_id)` 需要废弃或降级，因为它无法表达同项目多宿主实例
- `snapshots` / `evolution_records_index`
  - 迁入 `skill_revisions` 的时间线视图
- `trace_skill_mappings`
  - 先归并到 family usage，再尽量回填到 instance usage
- `agent-usage`
  - 作为 usage rollup 的补充来源
  - 只表示分析链路消耗，不等于“用户理解的技能使用次数”

### 0.6 API 与读模型设计

Dashboard 后端建议补充两套面向视角的 API:

1. `Skill 视角`
   - `GET /api/skills/families`
   - `GET /api/skills/families/:familyId`
   - `GET /api/skills/families/:familyId/instances`
2. `项目视角`
   - `GET /api/projects/:projectId/skill-groups`
   - `GET /api/projects/:projectId/skill-instances`
   - `GET /api/projects/:projectId/skill-instances/:instanceId`

原则:

- `Skills` 页默认读 family 级 API
- 项目工作台读 project + instance 级 API
- 操作型接口尽量面向 `instance_id`，不要继续只靠 `skill_id`

### 0.7 前端信息架构重构

V2.0 的 `Skills` 页需要明确分成两个工作区:

1. `技能库`
   - 默认页
   - 无项目侧边导航
   - 列表单位是 `Skill Family`
   - 回答“这个 skill 整体有没有价值、分布在哪、值不值得继续维护”
2. `项目工作台`
   - 带项目侧边导航
   - 页面单位是项目内的 `skill family 组`
   - 组内再展示不同宿主的 `Skill Instance`
   - 回答“这个项目里到底哪个实例该处理”

页面规则:

- 项目导航仅出现在 `Skills -> 项目工作台`
- `主页` 与 `配置` 不显示项目导航
- 默认详情入口优先进入 family 详情，再下钻到实例详情
- `shadow skill` 不再作为普通用户的主术语，改用 `技能 / 技能实例 / 修订`

### 0.8 当前 UI 到目标 UI 的映射

当前实现:

- `项目 -> 同名卡片 -> 不同宿主实例`

这套结构可以保留，但只能作为 `项目工作台` 的一种展示方式，不能继续充当全局 skill 管理模型。

目标实现:

- `技能库`
  - `Skill Family 列表 -> Family 详情 -> Instances / Revisions / Usage`
- `项目工作台`
  - `项目 -> 项目内 Skill Family 组 -> 宿主实例`

### 0.9 分阶段实施计划

#### Phase 0: 术语与契约冻结

- 明确 `family / instance / revision / release / usage` 语义
- 在文档和 AGENTS 中同步默认术语
- 所有新 UI/接口命名优先采用新术语

验收:

- 设计文档、PRD、AGENTS 不再把 `shadow skill` 当成用户主语义

#### Phase 1: 新 schema 与 projector

- 新增 domain tables 或等价 state 文件
- 实现 `skill domain projector`
- 从旧 `.ornn` 结构投影出 families / instances / revisions / usage rollups

验收:

- 能在不改 daemon 写入逻辑的前提下读出 family 与 instance 两层数据

#### Phase 2: Usage 与 identity 回填

- 增加 family 归并规则与置信度字段
- 回填安装时间、首次发现、最近发现、最近使用、活跃状态
- 区分 observed / analyzed / optimized 等不同事实

验收:

- 任意 skill 都能同时回答“有几个实例”和“最近有没有被使用”

#### Phase 3: Skills 页切换到双视角

- 新建 `技能库` 视图，默认展示全局 family 列表
- 保留项目工作台，承接现有项目内同名分组逻辑
- 项目导航只在项目工作台显示

验收:

- 用户不选项目也能在 Skills 页直接管理全局 skill 资产

#### Phase 4: 详情页重构

- 支持 family 详情
- 支持 instance drill-down
- 支持从项目实例回跳到 family 详情

验收:

- 同一个 skill 能顺着看到“整体价值 -> 各项目实例 -> 实例修订历史”

#### Phase 5: 写路径迁移

- 安装、卸载、启停、迁移、回滚等 mutation API 面向 `instance_id`
- 新写入链路开始优先写新模型
- 保留旧数据导出/兼容层

验收:

- 核心管理动作不再依赖“只传 skill_id + project_id”的旧假设

#### Phase 6: 清理旧语义

- 逐步收缩 `origin skill / project shadow` 对 UI 的直接暴露
- 把 legacy 兼容层收口到内部模块
- 最后再评估是否需要把 `variant` 升级为公开对象

验收:

- 普通用户主界面中不再直接出现旧模型的内部术语

### 0.10 关键风险

- `family` 归并可能误判，因此必须存储 `identity_method + confidence`
- `traceCount` 与真实“技能被使用次数”语义不同，迁移期必须并行展示或严格更名
- 如果一开始就把 `variant` 升格为强对象，复杂度会显著增加，建议后置
- 如果直接重写 daemon 写路径而不先做 projector，回归面会过大，不适合作为第一步

## 1. 技术栈选型

### 1.1 核心技术栈

| 组件 | 技术选型 | 理由 |
|------|---------|------|
| **语言** | TypeScript | 类型安全、生态丰富、与 Node.js 原生集成 |
| **运行时** | Node.js 18+ | 跨平台、异步 I/O 优秀、CLI 工具成熟 |
| **CLI 框架** | Commander.js | 轻量、灵活、广泛使用 |
| **数据库** | SQLite (better-sqlite3) | 轻量、无需服务、单文件存储 |
| **文件监控** | chokidar | 跨平台文件监听、性能优秀 |
| **Diff/Patch** | diff (npm) | 生成和应用 unified diff |
| **Hash** | crypto (Node.js 内置) | 文件版本标识 |
| **日志** | winston | 灵活的日志级别和输出配置 |
| **配置管理** | cosmiconfig | 支持多种配置文件格式 |

### 1.2 开发工具链

| 工具 | 用途 |
|------|------|
| **TypeScript Compiler** | 类型检查和编译 |
| **ESLint** | 代码规范检查 |
| **Prettier** | 代码格式化 |
| **Vitest** | 单元测试框架 |
| **tsx** | TypeScript 直接执行（开发用） |
| **pkg / esbuild** | 打包为可执行文件 |

---

## 2. 项目结构

```
OrnnSkills/
├── src/
│   ├── cli/                    # CLI 命令入口
│   │   ├── index.ts           # 主入口
│   │   ├── commands/          # 各命令实现
│   │   │   ├── status.ts
│   │   │   ├── log.ts
│   │   │   ├── diff.ts
│   │   │   ├── rollback.ts
│   │   │   ├── freeze.ts
│   │   │   ├── unfreeze.ts
│   │   │   ├── optimize.ts
│   │   │   └── rebase.ts
│   │   └── utils/
│   │       ├── formatter.ts   # 输出格式化
│   │       └── prompt.ts      # 交互提示
│   │
│   ├── core/                   # 核心业务逻辑
│   │   ├── origin-registry/   # Origin Skill 注册表
│   │   │   ├── index.ts
│   │   │   ├── scanner.ts     # 扫描本机 skills
│   │   │   └── types.ts
│   │   │
│   │   ├── shadow-registry/   # Shadow Skill 注册表
│   │   │   ├── index.ts
│   │   │   ├── manager.ts     # Shadow 生命周期管理
│   │   │   └── types.ts
│   │   │
│   │   ├── observer/          # 观察层
│   │   │   ├── index.ts
│   │   │   ├── base-observer.ts
│   │   │   ├── codex-observer.ts
│   │   │   ├── opencode-observer.ts
│   │   │   ├── claude-observer.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── evaluator/         # 演化评估器
│   │   │   ├── index.ts
│   │   │   ├── rules/         # 评估规则
│   │   │   │   ├── repeated-manual-fix.ts
│   │   │   │   ├── repeated-drift.ts
│   │   │   │   ├── overly-broad-trigger.ts
│   │   │   │   └── noisy-redundancy.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── patch-generator/   # Patch 生成器
│   │   │   ├── index.ts
│   │   │   ├── strategies/    # 各类 patch 策略
│   │   │   │   ├── append-context.ts
│   │   │   │   ├── tighten-trigger.ts
│   │   │   │   ├── add-fallback.ts
│   │   │   │   ├── prune-noise.ts
│   │   │   │   └── rewrite-section.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── journal/           # 日志管理
│   │   │   ├── index.ts
│   │   │   ├── writer.ts      # 写入 journal
│   │   │   ├── reader.ts      # 读取 journal
│   │   │   ├── snapshot.ts    # 快照管理
│   │   │   └── rollback.ts    # 回滚逻辑
│   │   │
│   │   └── shadow-manager/    # Shadow Skill 主控制器
│   │       ├── index.ts
│   │       ├── orchestrator.ts # 编排器
│   │       └── types.ts
│   │
│   ├── storage/                # 存储层
│   │   ├── sqlite.ts          # SQLite 封装
│   │   ├── ndjson.ts          # NDJSON 读写
│   │   ├── markdown.ts        # Markdown skill 文件操作
│   │   └── types.ts
│   │
│   ├── daemon/                 # 后台服务
│   │   ├── index.ts           # 守护进程入口
│   │   ├── watcher.ts         # 文件/事件监听
│   │   └── scheduler.ts       # 定时任务调度
│   │
│   ├── types/                  # 全局类型定义
│   │   ├── origin-skill.ts
│   │   ├── shadow-skill.ts
│   │   ├── evolution-record.ts
│   │   ├── trace.ts
│   │   └── index.ts
│   │
│   ├── config/                 # 配置管理
│   │   ├── index.ts
│   │   ├── defaults.ts
│   │   └── schema.ts
│   │
│   └── utils/                  # 工具函数
│       ├── hash.ts
│       ├── diff.ts
│       ├── path.ts
│       ├── logger.ts
│       └── validation.ts
│
├── tests/                      # 测试文件
│   ├── unit/
│   │   ├── origin-registry.test.ts
│   │   ├── shadow-registry.test.ts
│   │   ├── evaluator.test.ts
│   │   ├── patch-generator.test.ts
│   │   ├── journal.test.ts
│   │   └── shadow-manager.test.ts
│   ├── integration/
│   │   ├── observer-integration.test.ts
│   │   ├── full-evolution-cycle.test.ts
│   │   └── rollback.test.ts
│   └── fixtures/               # 测试数据
│       ├── skills/
│       ├── traces/
│       └── projects/
│
├── docs/                       # 文档
│   ├── PRD.md
│   ├── ENGINEERING_PLAN.md
│   ├── API.md
│   └── ARCHITECTURE.md
│
├── scripts/                    # 构建/工具脚本
│   ├── build.ts
│   ├── dev.ts
│   └── test.ts
│
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
├── vitest.config.ts
└── README.md
```

---

## 3. 核心模块详细设计

### 3.1 Origin Registry（Origin Skill 注册表）

**职责**：
- 扫描用户本机已安装的 skills 目录
- 维护 OriginSkill 元数据列表
- 检测 origin 版本变化
- 提供 origin skill 查询接口

**关键接口**：
```typescript
interface IOriginRegistry {
  // 扫描所有配置的 skill 目录
  scan(): Promise<OriginSkill[]>;
  
  // 获取指定 skill
  get(skillId: string): OriginSkill | null;
  
  // 获取所有 skills
  list(): OriginSkill[];
  
  // 检测 skill 是否有更新
  checkUpdate(skillId: string): Promise<boolean>;
  
  // 读取 origin skill 内容
  readContent(skillId: string): Promise<string>;
}

interface OriginSkill {
  skill_id: string;
  origin_path: string;
  origin_version: string;  // file hash
  source: 'local' | 'marketplace' | 'git';
  installed_at: string;
  last_seen_at: string;
}
```

**配置**：
```toml
# ~/.ornn/settings.toml
[origin_paths]
paths = [
  "~/.skills",
  "~/.claude/skills",
  "~/.opencode/skills"
]

[scan]
auto_scan_interval = 3600  # 秒
```

---

### 3.2 Shadow Registry（Shadow Skill 注册表）

**职责**：
- 管理项目内的 shadow skills
- 首次命中 origin skill 时自动 fork
- 维护 shadow 与 origin 的映射关系
- 管理 shadow 生命周期状态

**关键接口**：
```typescript
interface IShadowRegistry {
  // 获取项目的 shadow skill
  get(projectId: string, skillId: string): ProjectSkillShadow | null;
  
  // 列出项目的所有 shadow skills
  listByProject(projectId: string): ProjectSkillShadow[];
  
  // 从 origin 创建 shadow
  fork(projectId: string, skillId: string): Promise<ProjectSkillShadow>;
  
  // 更新 shadow 状态
  updateStatus(shadowId: string, status: ShadowStatus): void;
  
  // 检查 shadow 是否存在
  exists(projectId: string, skillId: string): boolean;
}

type ShadowStatus = 'active' | 'frozen' | 'rebasing' | 'needs_attention';

interface ProjectSkillShadow {
  project_id: string;
  skill_id: string;
  shadow_id: string;  // "A@repo-x"
  origin_skill_id: string;
  origin_version_at_fork: string;
  shadow_path: string;
  current_revision: number;
  status: ShadowStatus;
  created_at: string;
  last_optimized_at: string;
}
```

**项目目录结构初始化**：
```
project/
└── .ornn/
    ├── skills/
    │   └── {skill_id}/
    │       ├── current.md      # 当前内容
    │       ├── meta.json       # 元数据
    │       ├── journal.ndjson  # 演化日志
    │       └── snapshots/      # 快照
    │           ├── rev_0005.md
    │           └── rev_0010.md
    ├── state/
    │   ├── sessions.db         # SQLite 数据库
    │   ├── traces.ndjson       # 原始 trace
    │   └── runtime_state.json  # 宿主状态
    └── config/
        └── settings.toml       # 项目配置
```

---

### 3.3 Observer Layer（观察层）

**职责**：
- 从不同 runtime 获取执行 trace
- 标准化 trace 格式
- 持久化 trace 到本地存储

**架构**：
```typescript
interface IObserver {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  onTrace(callback: (trace: Trace) => void): void;
}

interface Trace {
  trace_id: string;
  runtime: 'codex' | 'opencode' | 'claude';
  session_id: string;
  turn_id: string;
  event_type: 'user_input' | 'assistant_output' | 'tool_call' | 
              'tool_result' | 'file_change' | 'retry' | 'status';
  timestamp: string;
  user_input?: string;
  assistant_output?: string;
  tool_name?: string;
  tool_args?: Record<string, any>;
  tool_result?: Record<string, any>;
  files_changed?: string[];
  status: 'success' | 'failure' | 'retry' | 'interrupted';
  metadata?: Record<string, any>;
}
```

**Observer 实现优先级**：
1. **Codex Observer**（Phase 1）
   - 监听 `codex exec --json` 输出
   - 解析 JSONL 事件流
   - 读取本地 session 日志

2. **OpenCode Observer**（Phase 2）
   - 通过插件事件系统采集
   - 使用 session/export API

3. **Claude Observer**（Phase 3）
   - 使用 hooks 捕捉生命周期
   - 解析 transcript 文件

---

### 3.4 Evolution Evaluator（演化评估器）

**职责**：
- 分析 trace 数据
- 判断 shadow skill 是否需要优化
- 输出评估结果

**评估规则**：

#### 规则 1：Repeated Manual Fix（重复人工修复）
```
触发条件：
- 同类任务中，主 Agent 输出后用户总是补充相同步骤
- 出现次数 >= 3 次
- 来源 session >= 2 个

输出：
- change_type: "add_fallback" | "append_context"
- reason: "用户在 {N} 个 session 中重复手动补充 {步骤描述}"
```

#### 规则 2：Repeated Drift（重复绕过）
```
触发条件：
- skill 被命中但执行反复绕过某一段
- 绕过次数 >= 3 次

输出：
- change_type: "rewrite_section" | "prune_noise"
- reason: "skill 中 {section} 在 {N} 次执行中被绕过"
```

#### 规则 3：Overly Broad Trigger（触发过宽）
```
触发条件：
- skill 在不合适的场景被频繁触发
- 误触发率 > 30%

输出：
- change_type: "tighten_trigger"
- reason: "skill 在 {场景} 中被误触发 {N} 次"
```

#### 规则 4：Noisy Redundancy（冗余噪音）
```
触发条件：
- 某些说明长期不影响执行
- 被忽略次数 >= 5 次

输出：
- change_type: "prune_noise"
- reason: "{section} 在最近 {N} 次执行中未被使用"
```

**关键接口**：
```typescript
interface IEvaluator {
  evaluate(shadow: ProjectSkillShadow, traces: Trace[]): EvaluationResult;
}

interface EvaluationResult {
  should_patch: boolean;
  change_type?: ChangeType;
  reason?: string;
  source_sessions: string[];
  confidence: number;  // 0-1
  target_section?: string;  // 要修改的 section
}

type ChangeType = 'append_context' | 'tighten_trigger' | 
                  'add_fallback' | 'prune_noise' | 'rewrite_section';
```

---

### 3.5 Patch Generator（Patch 生成器）

**职责**：
- 根据评估结果生成具体 patch
- 应用 patch 到 shadow skill
- 生成 unified diff

**Patch 策略**：

```typescript
interface IPatchGenerator {
  generate(
    shadow: ProjectSkillShadow,
    evaluation: EvaluationResult,
    currentContent: string
  ): PatchResult;
  
  apply(content: string, patch: string): string;
}

interface PatchResult {
  success: boolean;
  patch: string;           // unified diff
  newContent: string;
  changeType: ChangeType;
  error?: string;
}
```

**各策略实现**：

1. **AppendContextStrategy**
   - 在适当位置追加上下文说明
   - 识别 skill 结构，找到最佳插入点

2. **TightenTriggerStrategy**
   - 修改 frontmatter 中的 triggers
   - 添加更具体的条件

3. **AddFallbackStrategy**
   - 在相关步骤后添加 fallback 说明
   - 保持格式一致

4. **PruneNoiseStrategy**
   - 删除被忽略的冗余说明
   - 保留核心逻辑

5. **RewriteSectionStrategy**
   - 局部重写某个 section
   - 保留原始结构框架

---

### 3.6 Journal Manager（日志管理器）

**职责**：
- 管理 evolution journal（append-only）
- 生成和管理 snapshots
- 提供 rollback 能力

**关键接口**：
```typescript
interface IJournalManager {
  // 记录一次演化
  record(shadowId: string, record: Omit<EvolutionRecord, 'revision'>): number;
  
  // 获取 journal
  getJournal(shadowId: string, options?: {
    fromRevision?: number;
    toRevision?: number;
    limit?: number;
  }): EvolutionRecord[];
  
  // 生成 snapshot
  createSnapshot(shadowId: string, revision: number): Promise<void>;
  
  // 回滚到指定 revision
  rollback(shadowId: string, targetRevision: number): Promise<void>;
  
  // 回滚到上一个 snapshot
  rollbackToSnapshot(shadowId: string): Promise<void>;
  
  // 获取所有 snapshots
  listSnapshots(shadowId: string): SnapshotInfo[];
}

interface EvolutionRecord {
  revision: number;
  shadow_id: string;
  timestamp: string;
  reason: string;
  source_sessions: string[];
  change_type: ChangeType;
  patch: string;
  before_hash: string;
  after_hash: string;
  applied_by: 'auto' | 'manual';
}

interface SnapshotInfo {
  revision: number;
  timestamp: string;
  file_path: string;
  content_hash: string;
}
```

**Snapshot 策略**：
- 每 5 次 revision 自动 snapshot 一次
- `rewrite_section` 类型 patch 完成后立即 snapshot
- 用户手动 rollback 时自动创建 snapshot

---

### 3.7 Shadow Skill Manager（主控制器）

**职责**：
- 编排整个演化流程
- 接收 trace 并分发处理
- 协调各子模块
- 管理自动优化策略

**核心流程**：
```typescript
interface IShadowManager {
  // 处理新的 trace
  processTrace(trace: Trace): Promise<void>;
  
  // 手动触发优化
  triggerOptimize(shadowId: string): Promise<EvaluationResult>;
  
  // 获取 shadow 状态
  getShadowState(shadowId: string): ShadowSkillState;
}

interface ShadowSkillState {
  shadow_id: string;
  current_content_hash: string;
  current_revision: number;
  last_hit_at: string;
  last_optimized_at: string;
  hit_count: number;
  success_count: number;
  manual_override_count: number;
  health_score: number;  // 0-100
}
```

**自动优化策略配置**：
```typescript
interface AutoOptimizePolicy {
  min_signal_count: number;        // 最少信号次数，默认 3
  min_source_sessions: number;     // 最少来源 session，默认 2
  min_confidence: number;          // 最小置信度，默认 0.7
  cooldown_hours: number;          // 冷却时间（小时），默认 24
  max_patches_per_day: number;     // 每日最大 patch 数，默认 3
  pause_after_rollback_hours: number; // 回滚后暂停时间，默认 48
}
```

---

## 4. 数据库设计

### 4.1 SQLite 表结构

```sql
-- Shadow Skills 表
CREATE TABLE shadow_skills (
  shadow_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  origin_skill_id TEXT NOT NULL,
  origin_version_at_fork TEXT NOT NULL,
  shadow_path TEXT NOT NULL,
  current_revision INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  last_optimized_at TEXT,
  hit_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  manual_override_count INTEGER DEFAULT 0,
  health_score REAL DEFAULT 100.0,
  UNIQUE(project_id, skill_id)
);

-- Evolution Records 表（索引用，完整记录在 ndjson）
CREATE TABLE evolution_records_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shadow_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  change_type TEXT NOT NULL,
  source_sessions TEXT,  -- JSON array
  confidence REAL,
  FOREIGN KEY (shadow_id) REFERENCES shadow_skills(shadow_id)
);

-- Snapshots 表
CREATE TABLE snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shadow_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  FOREIGN KEY (shadow_id) REFERENCES shadow_skills(shadow_id)
);

-- Sessions 表
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  runtime TEXT NOT NULL,
  project_id TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  trace_count INTEGER DEFAULT 0
);

-- Traces 索引表
CREATE TABLE traces_index (
  trace_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  runtime TEXT NOT NULL,
  event_type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  status TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

-- 创建索引
CREATE INDEX idx_shadow_project ON shadow_skills(project_id);
CREATE INDEX idx_evolution_shadow ON evolution_records_index(shadow_id);
CREATE INDEX idx_traces_session ON traces_index(session_id);
CREATE INDEX idx_traces_timestamp ON traces_index(timestamp);
```

---

## 5. 实现阶段规划

### Phase 1: 基础框架（2 周）

**目标**：搭建项目骨架，实现核心数据结构

**任务清单**：
- [x] 项目初始化（package.json, tsconfig, eslint）
- [x] 全局类型定义
- [x] 配置管理系统
- [x] 工具函数库（hash, diff, path, logger）
- [x] SQLite 存储层
- [x] NDJSON 读写器
- [x] Markdown 文件操作器

**交付物**：
- 可运行的空项目框架
- 存储层单元测试通过

---

### Phase 2: Origin & Shadow Registry（2 周）

**目标**：实现 skill 发现和 shadow 管理

**任务清单**：
- [x] Origin Registry
  - [x] 目录扫描器
  - [x] 版本 hash 计算
  - [x] Origin 列表管理
- [x] Shadow Registry
  - [x] Shadow 创建（fork）
  - [x] Shadow 状态管理
  - [x] 项目目录结构初始化
- [x] Journal Manager 基础版
  - [x] Journal 写入
  - [x] Journal 读取
  - [x] Revision 管理

**交付物**：
- `ornn skills status` 命令可用
- 能自动发现 origin skills
- 能创建 shadow skills

---

### Phase 3: Observer Layer（2 周）

**目标**：实现 trace 采集

**任务清单**：
- [x] Observer 基类
- [x] Trace 数据模型
- [x] Trace 存储（NDJSON + SQLite 索引）
- [x] Codex Observer
  - [x] JSONL 事件流解析
  - [x] Session 日志读取
- [x] 文件变化检测

**交付物**：
- 能从 Codex 采集 trace
- Trace 数据正确存储

---

### Phase 4: Evaluator & Patch Generator（3 周）

**目标**：实现自动优化核心逻辑

**任务清单**：
- [x] Evaluator 框架
  - [x] Repeated Manual Fix 规则
  - [x] Repeated Drift 规则
  - [x] Overly Broad Trigger 规则
  - [x] Noisy Redundancy 规则
- [x] Patch Generator 框架
  - [x] AppendContext 策略
  - [x] AddFallback 策略
  - [x] TightenTrigger 策略
  - [x] PruneNoise 策略
  - [x] RewriteSection 策略
- [x] Patch 应用器
- [x] Unified Diff 生成器

**交付物**：
- 能自动评估是否需要优化
- 能生成和应用 patch

---

### Phase 5: Shadow Manager & 自动循环（2 周）

**目标**：实现完整的自动演化循环

**任务清单**：
- [x] Shadow Manager 编排器
  - [x] Trace 处理流程
  - [x] 评估触发逻辑
  - [x] Patch 执行流程
- [x] 自动优化策略
  - [x] 信号计数
  - [x] 冷却窗口
  - [x] 置信度阈值
- [x] Snapshot 管理
  - [x] 自动 snapshot
  - [x] Snapshot 创建
- [x] 后台守护进程
  - [x] 文件监听
  - [x] 定时任务

**交付物**：
- 完整的 Observe → Evaluate → Patch → Journal 循环
- 后台自动运行

---

### Phase 6: Rollback & Rebase（1.5 周）

**目标**：实现回滚和 origin 同步

**任务清单**：
- [x] Rollback 功能
  - [x] 回滚到指定 revision
  - [x] 回滚到 snapshot
  - [x] 回滚到初始版本
- [x] Origin 更新检测
- [x] Rebase 策略
  - [x] 差异检测
  - [x] Patch 重放
  - [x] 冲突处理
- [x] `ornn skills rollback` 命令
- [x] `ornn skills rebase` 命令

**交付物**：
- 完整的回滚能力
- Origin 更新同步

---

### Phase 7: CLI 完善 & 集成（1.5 周）

**目标**：完善所有 CLI 命令

**任务清单**：
- [x] `ornn skills status` 完善
- [x] `ornn skills log` 命令
- [x] `ornn skills diff` 命令
- [x] `ornn skills freeze/unfreeze` 命令
- [x] `ornn optimize` 命令
- [x] 输出格式化
- [x] 交互式提示
- [x] 错误处理和用户友好提示

**交付物**：
- 所有 CLI 命令可用
- 用户体验优化

---

### Phase 8: 测试 & 打包（2 周）

**目标**：全面测试和发布准备

**任务清单**：
- [x] 单元测试补全
  - [x] 所有核心模块 >= 80% 覆盖率
- [x] 集成测试
  - [x] 完整演化周期测试
  - [x] Rollback 测试
  - [x] 并发场景测试
- [x] E2E 测试
  - [x] 真实项目场景测试
- [x] 性能测试
  - [x] 大量 trace 处理
  - [x] 长时间运行稳定性
- [x] 打包和分发
  - [x] npm 包配置
  - [x] 二进制打包（可选）
  - [x] 安装脚本
- [x] 文档完善
  - [x] 用户使用手册
  - [x] API 文档
  - [x] 开发者指南

**交付物**：
- 可发布的 npm 包
- 完整文档

---

## 6. 关键技术决策

### 6.1 为什么选择 TypeScript + Node.js

1. **生态匹配**：主 Agent（Codex/OpenCode/Claude）都是 Node.js 生态
2. **CLI 友好**：Node.js 的 CLI 工具开发成熟
3. **异步模型**：适合事件驱动的 observer 架构
4. **类型安全**：复杂的状态管理需要类型保障

### 6.2 为什么选择 SQLite

1. **轻量**：单文件数据库，无需服务
2. **可靠**：ACID 事务，数据安全
3. **性能**：对于本场景足够快
4. **跨平台**：Node.js 原生支持好

### 6.3 为什么用 NDJSON 存储 Trace 和 Journal

1. **Append-only 友好**：天然支持追加写入
2. **可读性**：文本格式，便于调试
3. **流式处理**：可以逐行处理大文件
4. **简单**：无需复杂查询时，比 SQLite 更简单

### 6.4 Shadow Skill 用 Markdown 而非 JSON

1. **Skill 本身是 Markdown**：保持格式一致
2. **人类可读**：便于用户理解和手动编辑
3. **Diff 友好**：Git diff 天然支持
4. **灵活**：支持各种 skill 格式变体

---

## 7. 配置系统设计

### 7.1 全局配置（~/.ornn/settings.toml）

```toml
[origin_paths]
paths = ["~/.skills", "~/.claude/skills"]

[observer]
enabled_runtimes = ["codex", "opencode", "claude"]
trace_retention_days = 30

[evaluator]
min_signal_count = 3
min_source_sessions = 2
min_confidence = 0.7

[patch]
allowed_types = ["append_context", "tighten_trigger", "add_fallback", "prune_noise"]
cooldown_hours = 24
max_patches_per_day = 3

[journal]
snapshot_interval = 5
max_snapshots = 20

[daemon]
auto_start = true
log_level = "info"
```

### 7.2 项目配置（.ornn/config/settings.toml）

```toml
[project]
name = "my-project"
auto_optimize = true

[skills]
# 特定 skill 的配置覆盖
[skills.A]
auto_optimize = false  # 冻结此 skill

[skills.B]
allowed_patch_types = ["append_context"]  # 只允许追加上下文
```

---

## 8. 错误处理策略

### 8.1 错误分级

| 级别 | 处理方式 | 示例 |
|------|---------|------|
| **Fatal** | 终止运行，提示用户 | 数据库损坏、配置文件格式错误 |
| **Error** | 记录日志，跳过当前操作 | Patch 失败、Shadow 创建失败 |
| **Warning** | 记录日志，继续运行 | Trace 解析部分失败、Origin 路径不存在 |
| **Info** | 仅记录日志 | 优化评估结果、Snapshot 创建 |

### 8.2 Patch 失败处理

```typescript
interface PatchFailureStrategy {
  // 重试次数
  maxRetries: number;  // 默认 2
  
  // 失败后行为
  onFailure: 'skip' | 'pause_skill' | 'notify_user';
  
  // 记录失败
  logFailure: boolean;
}
```

---

## 9. 测试策略

### 9.1 单元测试

**覆盖目标**：核心模块 >= 80%

**重点测试**：
- Evaluator 规则逻辑
- Patch Generator 各策略
- Journal 读写和回滚
- Hash 计算和 Diff 生成

### 9.2 集成测试

**场景**：
1. 完整演化周期：Trace → Evaluate → Patch → Journal
2. Rollback 流程：Patch → Snapshot → Rollback → 验证
3. Origin Rebase：Origin 更新 → 差异检测 → Patch 重放

### 9.3 E2E 测试

**场景**：
1. 模拟 Codex 执行 → 自动创建 shadow → 自动优化
2. 多 session 并发 → 信号累积 → 触发优化
3. 回滚后恢复 → 验证内容正确

---

## 10. 依赖清单

### 10.1 生产依赖

```json
{
  "commander": "^11.0.0",
  "better-sqlite3": "^9.0.0",
  "chokidar": "^3.5.3",
  "diff": "^5.1.0",
  "cosmiconfig": "^8.3.0",
  "winston": "^3.11.0",
  "glob": "^10.3.0",
  "toml": "^3.0.0",
  "chalk": "^5.3.0",
  "ora": "^7.0.0"
}
```

### 10.2 开发依赖

```json
{
  "typescript": "^5.3.0",
  "tsx": "^4.7.0",
  "vitest": "^1.0.0",
  "eslint": "^8.50.0",
  "@typescript-eslint/eslint-plugin": "^6.0.0",
  "@typescript-eslint/parser": "^6.0.0",
  "prettier": "^3.0.0",
  "@types/better-sqlite3": "^7.6.0",
  "@types/diff": "^5.0.0",
  "@types/node": "^20.0.0"
}
```

---

## 11. 时间估算

| 阶段 | 时间 | 累计 |
|------|------|------|
| Phase 1: 基础框架 | 2 周 | 2 周 |
| Phase 2: Registry | 2 周 | 4 周 |
| Phase 3: Observer | 2 周 | 6 周 |
| Phase 4: Evaluator & Patch | 3 周 | 9 周 |
| Phase 5: 自动循环 | 2 周 | 11 周 |
| Phase 6: Rollback & Rebase | 1.5 周 | 12.5 周 |
| Phase 7: CLI | 1.5 周 | 14 周 |
| Phase 8: 测试 & 打包 | 2 周 | 16 周 |

**预计总工期**：16 周（约 4 个月）

---

## 12. 风险和缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Patch 质量不稳定 | 中 | 高 | 严格的置信度阈值 + 快速回滚 |
| Trace 采集不完整 | 中 | 中 | 多信号源冗余 + 手动补充机制 |
| 性能问题 | 低 | 中 | 异步处理 + 批量操作 |
| Origin 兼容性 | 低 | 中 | 版本检测 + 差异告警 |

---

## 13. MVP 验收标准

MVP 完成后应满足：

1. ✅ 能自动发现本机 origin skills
2. ✅ 能在项目中创建 shadow skills
3. ✅ 能从 Codex 采集 trace
4. ✅ 能自动执行 3 类 patch（append_context, add_fallback, tighten_trigger）
5. ✅ 能写入 journal 和创建 snapshot
6. ✅ 能回滚到指定 revision
7. ✅ 所有 CLI 命令可用
8. ✅ 单元测试覆盖率 >= 70%

---

*文档版本：v1.0*
*最后更新：2026-03-21*
*作者：OrnnSkills Team*
