EVO Skills 设计文档 v2
0. 一句话定义

EVO Skills 是一个后台常驻的元 Agent。它不会替代主 Agent 执行任务，而是持续观察主 Agent 的真实执行，并为每个项目维护一份来自全局 Skill 的影子副本（Shadow Skill），再基于 trace 对这份影子副本做小步、自动、可回滚的持续优化。

1. 设计目标
1.1 产品目标

让用户几乎无感地获得这样一种效果：

我本机安装的通用 skill，在不同项目里会自动长成更适合这个项目的版本，而且这个过程是后台持续发生的，不需要我手动管理复杂的 skills 分支体系。

1.2 关键设计原则
A. 用户无感

产品应尽量不要求用户理解：

branch

merge

draft

active

deprecated

skill tree 管理

用户只需要知道：

自己本机有原始 skill

每个项目里系统会自动维护更适配本项目的影子 skill

如果优化出问题，可以回滚

B. 单实体演化，不做多分支管理

对于同一个 origin skill A，在某个项目里只维护一个 shadow skill A'，以及它的演化日志。
不默认创建多个 branch。

C. 本地隔离

所有自动优化优先作用于项目级 shadow skill，不污染全局 origin skill。

D. 小步修改、持续积累

系统不追求大改，而是通过大量小步 patch 持续提升 shadow skill 的项目适配性。

E. 可回滚

所有自动修改都必须有演化记录、revision、checkpoint，保证可回退。

2. 核心模型

这套设计的核心不是 Skill Tree，而是：

Origin Skill + Project Shadow Skill + Evolution Journal
2.1 Origin Skill

Origin Skill 是用户本机已有的、全局安装的 skill。
它可能来自：

用户自己写的 skill

官方 / 第三方 skill 市场安装的 skill

从 git / repo 拷贝来的通用 skill

它的特点是：

面向全局

默认不被自动修改

作为各项目影子 skill 的“源头版本”

示意：

~/.skills/
  A/
  B/
  C/
2.2 Project Shadow Skill

当某个项目第一次实际使用到全局 skill A 时，EVO Skills 会自动在该项目下创建一个影子副本：

repo-x/.evo/skills/A/

这个项目内副本就是 A'。

它的特点是：

只属于当前项目

是主 Agent 在这个项目中的实际消费版本

可被后台自动优化

与 origin A 保持来源关系，但不共享运行时状态

2.3 Evolution Journal

每次对 A' 的修改，不创建新 branch，而是直接：

对当前 A' 做 patch

记录一条 append-only 的演化日志

周期性生成 checkpoint

所以版本关系不是树，而是一条线：

A (origin)
  └── A' rev1 -> rev2 -> rev3 -> rev4 ...

这个模型更像：

文档修订历史

本地长期学习副本

单实体演进体

而不是复杂知识图谱。

3. 用户体验设计
3.1 默认行为

用户启动主 Agent 后，EVO Skills 在后台运行。
默认情况下用户不需要主动操作。

它会自动完成：

观察主 Agent 的任务执行

识别项目中被使用到的全局 skill

创建对应 shadow skill

持续收集 trace

判断 shadow skill 是否需要优化

小步 patch

写入 journal

必要时生成 checkpoint

3.2 用户感知的最小界面

V1 不需要复杂 UI。
只需要最小的几个交互：

查看当前项目有哪些 shadow skills
evo skills status
查看某个 shadow skill 的最近优化记录
evo skills log A
回滚某个 shadow skill 到某个 revision / checkpoint
evo skills rollback A --to rev_12
暂停某个 skill 的自动优化
evo skills freeze A
恢复自动优化
evo skills unfreeze A
4. 系统职责划分
4.1 主 Agent 负责什么

主 Agent 继续负责原本的事情：

接收用户任务

调工具

修改代码 / 文件

输出回答

完成业务工作

4.2 EVO Skills 负责什么

EVO Skills 只负责 skill 本身：

观察 trace

检查 skill 命中与实际执行的偏差

从失败 / retry / manual fix 中提取优化信号

修改 shadow skill

记录 revision / journal / checkpoint

在必要时提示用户是否需要同步或回滚

5. 系统运行循环

新版本不再采用复杂的 branch lifecycle，而采用一个更轻的循环：

Observe → Evaluate → Patch A' → Journal
5.1 Observe

持续观察主 Agent 的外显执行过程，包括：

用户输入

assistant 输出

tool calls

tool results

file changes

retry / interruption

用户人工修正

当前命中的 skill 文件

这一步的目标不是理解内部思维，而是建立“这次执行到底怎么走的”的外显轨迹。

5.2 Evaluate

基于 trace 判断当前项目中的 shadow skill A' 是否存在优化机会。
重点判断：

skill 是否频繁被绕开

skill 中某段说明是否总被忽略

某种 fallback 是否被反复手动使用

某段规则是否已不适合当前项目

某些步骤是否冗余

某种项目上下文是否值得写入 skill

这一步不做“树分叉判断”，而只做：

当前这个 A' 是否应该再往前修一步

5.3 Patch A'

如果满足条件，则直接对 A' 做局部修改。
V1 只支持小步 patch，不做大规模重写。

修改类型建议限制为 5 类：

append_context：补充项目特定上下文

tighten_trigger：收紧适用条件

add_fallback：补写高频 fallback

prune_noise：删除低价值噪音描述

rewrite_section：局部重写某一小段

5.4 Journal

每次 patch 后，系统必须：

revision +1

记录 patch 原因

记录来源 session

记录 before/after hash

写入 journal

按策略生成 checkpoint

这样就形成一条单实体演化链。

6. 核心对象设计
6.1 OriginSkill

表示全局原始 skill。

{
  "skill_id": "A",
  "origin_path": "~/.skills/A",
  "origin_version": "hash_or_semver",
  "source": "local|marketplace|git",
  "installed_at": "",
  "last_seen_at": ""
}

说明：

origin_version 可以先用 hash，不必强依赖 semver

origin 默认只读，不自动修改

6.2 ProjectSkillShadow

表示某个项目中的影子 skill。

{
  "project_id": "repo-x",
  "skill_id": "A",
  "shadow_id": "A@repo-x",
  "origin_skill_id": "A",
  "origin_version_at_fork": "hash_001",
  "shadow_path": "repo-x/.evo/skills/A/current.md",
  "current_revision": 12,
  "status": "active|frozen",
  "created_at": "",
  "last_optimized_at": ""
}

说明：

一个项目里同一个 origin skill 只对应一个 shadow skill

status=frozen 表示暂停自动优化，但仍可被主 Agent 消费

6.3 EvolutionRecord

表示一次演化记录。

{
  "revision": 12,
  "shadow_id": "A@repo-x",
  "timestamp": "",
  "reason": "Repeated manual fallback after root lint failure",
  "source_sessions": ["s1", "s2", "s3"],
  "change_type": "append_context|tighten_trigger|add_fallback|prune_noise|rewrite_section",
  "patch": "...",
  "before_hash": "",
  "after_hash": "",
  "applied_by": "auto|manual"
}

说明：

patch 推荐保存 unified diff 或结构化 patch

这是 append-only 的，不修改历史

6.4 ShadowSkillState

表示当前运行状态。

{
  "shadow_id": "A@repo-x",
  "current_content_hash": "",
  "current_revision": 12,
  "last_hit_at": "",
  "last_optimized_at": "",
  "hit_count": 0,
  "success_count": 0,
  "manual_override_count": 0,
  "health_score": 0.0
}

说明：

health_score 不是绝对准确值，只是一个粗健康度指标

先用于内部判断和 CLI 提示

7. 项目目录结构

建议每个项目内维护一个 .evo/ 目录：

repo-x/
  .evo/
    skills/
      A/
        current.md
        meta.json
        journal.ndjson
        snapshots/
          rev_0005.md
          rev_0010.md
      B/
        current.md
        meta.json
        journal.ndjson
        snapshots/
    state/
      sessions.db
      traces.ndjson
      runtime_state.json
    config/
      settings.toml
7.1 current.md

当前项目生效中的 shadow skill 内容。

7.2 meta.json

保存 ProjectSkillShadow + ShadowSkillState 的当前状态。

7.3 journal.ndjson

append-only 演化记录。

7.4 snapshots/

少量检查点文件。
建议每隔 N 次 revision 或重大 patch 生成一次。

7.5 state/

本地 trace、session 状态、运行态缓存。

8. 技术架构
Main Agent Runtime
  ├─ Codex
  ├─ OpenCode
  └─ Claude Code
        ↓
Observer Layer
        ↓
Trace Store
        ↓
Shadow Skill Manager
  ├─ Origin Registry
  ├─ Shadow Registry
  ├─ Evolution Evaluator
  ├─ Patch Generator
  └─ Journal Manager
        ↓
Project Shadow Skills (.evo/skills/*)
9. 模块设计
9.1 Origin Registry

职责：

扫描用户本机已安装 skills

维护 OriginSkill 列表

识别 origin 是否更新

来源目录可配置，例如：

~/.skills/
~/.claude/skills/
~/.opencode/skills/

V1 先做简单版：

配置型路径扫描

基于文件 hash 识别版本

9.2 Shadow Registry

职责：

管理项目中的 shadow skills

首次命中 origin skill 时自动 fork 为 A'

维护 shadow 与 origin 的映射关系

逻辑：

主 Agent 在项目中命中 A

若项目中不存在 A'

从 origin 复制到 .sea/skills/A/current.md

初始化 meta.json

开始后续演化

9.3 Observer Layer

职责：

从主 Agent CLI 获取足够做演化判断的 trace

不追求 CoT，只追求外显执行证据

输入信号包括：

prompt / response

tool call / result

files changed

retry / failure

session id

命中的 skill 文件（若可获得）

V1 继续支持三个 observer：

CodexObserver

OpenCodeObserver

ClaudeObserver

但在这版架构里，它们只是“感知层”，不是产品核心。

9.4 Evolution Evaluator

职责：

给定某个 shadow skill A' 及近期 trace，判断是否需要优化。

不再输出复杂 branch plan，而输出：

{
  "should_patch": true,
  "change_type": "add_fallback",
  "reason": "...",
  "source_sessions": ["..."],
  "confidence": 0.78
}

V1 先支持以下判断规则：

A. Repeated Manual Fix

同类任务里，主 Agent 输出后用户总补同一个步骤
→ add_fallback 或 append_context

B. Repeated Drift

skill 被命中，但执行反复绕过某一段
→ rewrite_section 或 prune_noise

C. Overly Broad Trigger

skill 在这个项目里经常在不合适的场景被触发
→ tighten_trigger

D. Noisy Redundancy

某些说明长期不影响执行或被新上下文覆盖
→ prune_noise

9.5 Patch Generator

职责：

把评估结果变成对 A' 的具体 patch。

输出不是“新 branch”，而是对 current.md 的局部 diff。

支持的 patch 类型：

append 段落

修改 frontmatter

替换某一小节

重排步骤顺序

删除冗余说明

建议 first pass 不做 LLM 自由重写全文，而采用：

定位要改的 section

做局部 patch

保留原始结构

这样更稳。

9.6 Journal Manager

职责：

生成 revision

写 journal.ndjson

维护 snapshot

提供 rollback

规则建议：

每次 patch 都写 journal

每 5 次 revision 自动 snapshot 一次

rewrite_section 类型 patch 完成后立即 snapshot

rollback 默认回到：

指定 revision

上一个 snapshot

fork 初始版本

9.7 Shadow Skill Manager

这是本系统的核心编排模块。

职责：

确保 origin 和 shadow 的映射关系

收到 trace 后调用 evaluator

决定是否 patch

调用 patch generator

调用 journal manager

更新 meta.json

它是整个产品里最像“Agent 控制器”的地方。

10. 自动优化策略
10.1 默认自动修改的范围

为了保证“无感”，但又防止失控，V1 只自动做低风险修改：

自动允许

增加项目上下文说明

增加高频 fallback

收紧 trigger 条件

删除明显重复的说明

重排步骤顺序

增加局部 caution / note

默认不自动做

大段重写整个 skill

删除大量核心步骤

改变 skill 的总体目标

回写到全局 origin

跨项目同步优化结果

10.2 自动 patch 的触发条件

建议至少满足：

同类信号出现 >= N 次

来源 session 不少于 2 或 3 个

置信度高于阈值

最近没有对该 shadow skill 做过同类 patch

当前 shadow skill 未被冻结

这可以防止系统过于躁动。

11. Origin 更新策略

这个问题在 shadow 模型里非常关键。

11.1 三态策略
情况 A：origin 未更新

继续正常迭代 A'

情况 B：origin 更新，但 A' 与 origin 差异较小

系统尝试自动 rebase：

读取新 origin A

读取当前 shadow A'

将 shadow 的局部 patch 重放到新 origin 上

若成功，则更新：

origin_version_at_fork

current.md

情况 C：origin 更新，但 A' 已偏离较多

系统不自动 rebase，只记录状态：

origin 已更新

当前 shadow 分化较深

用户可手动触发 rebase

11.2 为什么不一开始做复杂 merge

因为你当前目标是“后台无感优化”，不是“分布式版本控制系统”。

先实现：

检测 origin 变化

简单重放 patch

失败则提示人工处理

就够了。

12. 状态机设计

对于每个 shadow skill，只需要一个很轻的状态机：

not_created
  → active
  → frozen
  → active
  → rebasing
  → active

可选辅助状态：

needs_attention

rollback_ready

状态说明
not_created

项目还未命中该 origin skill，尚未 fork

active

shadow skill 正常被消费，并允许自动优化

frozen

停止自动优化，但仍然可以继续被主 Agent 使用

rebasing

正在尝试从新 origin 重新套用本地 patch

needs_attention

自动 rebase 失败，或近期 patch 质量异常，需要用户处理

13. 观察与存储设计
13.1 最小 Trace Schema
{
  "trace_id": "",
  "runtime": "codex|opencode|claude",
  "session_id": "",
  "turn_id": "",
  "event_type": "user_input|assistant_output|tool_call|tool_result|file_change|retry|status",
  "timestamp": "",
  "user_input": "",
  "assistant_output": "",
  "tool_name": "",
  "tool_args": {},
  "tool_result": {},
  "files_changed": [],
  "status": "success|failure|retry|interrupted",
  "metadata": {}
}

够用就行。
这版不追求复杂病例模型。

13.2 本地状态存储

建议 V1 使用：

SQLite：session / shadow meta / small indexes

NDJSON：raw trace 与 journal

Markdown：shadow skill 当前内容

snapshot files：回滚检查点

这样足够轻。

14. 三个 CLI 的接入策略

保持之前调研结论，但产品接口简化。

14.1 Codex
适合作为第一接入源

原因：

有 codex exec --json

事件流结构明确

本地 transcript / session log 较友好

接法

优先消费 JSONL 事件流

补充读取本地 session 日志

抽取 tool calls / file changes / final outputs

在本架构中的作用

只负责给 Evaluator 提供：

本次任务如何走

是否反复 fallback

用户是否手动补救

14.2 OpenCode
适合作为第二接入源

原因：

插件与事件系统适合长期后台采集

本地存储清晰

可做更主动的 observability

接法

优先用 plugin 事件写入 trace

辅助用 session/export 或 server API 补数

在本架构中的作用

适合做“后台长期运行”的稳定观察器。

14.3 Claude Code
适合作为第三接入源

原因：

hooks 强

transcript_path / subagent transcript 明确

但更适合走主动 hooks 采集，而不是纯文件解析

接法

用 hooks 捕捉关键生命周期

transcript 作为补充

合并主会话与 subagent 轨迹

15. CLI 设计

V1 的 CLI 不要太多，保留最必要的命令：

查看当前项目影子 skill 状态
evo skills status
查看某个 skill 的演化日志
evo skills log A
查看当前内容与 origin 的 diff
evo skills diff A
回滚
evo skills rollback A --to rev_8
冻结 / 解冻自动优化
evo skills freeze A
evo skills unfreeze A
手动触发一次优化评估
evo optimize A
重新同步 origin
evo skills rebase A
16. MVP 范围
MVP 必须具备
1. 能识别 origin skill 并创建项目 shadow

这是产品成立的基础。

2. 能接一个 runtime 的 trace

建议先接 Codex。

3. 能自动做 3 类 patch

append_context

add_fallback

tighten_trigger

4. 能写 journal 与 snapshot

这是安全底线。

5. 能 rollback

没有 rollback，就不适合默认无感自动优化。

MVP 不做

不做多分支 skill tree

不做可视化管理台

不做跨项目经验合并

不做全局 origin 自动回写

不做复杂 router

不做复杂 merge engine

17. 成功指标
用户体验层

用户无需理解复杂版本概念

自动优化默认可运行

绝大多数优化无需人工介入

技术层

shadow 创建成功率

trace 完整率

auto patch 成功率

rollback 成功率

origin rebase 成功率

效果层

项目内 skill 命中后绕路次数下降

同类任务人工补救次数下降

主 Agent 在该项目中的稳定性提升

18. 风险与应对
风险 1：自动 patch 把 skill 改坏

应对：

仅允许小步 patch

journal + snapshot

一键 rollback

风险 2：origin 更新后 shadow 漂移严重

应对：

先检测

差异小时自动 rebase

差异大时只告警不自动合并

风险 3：trace 不足导致误判

应对：

先定义最小证据集

patch 需要重复证据

低置信不动

风险 4：后台太频繁修改，引发抖动

应对：

每个 shadow skill 设置冷却窗口

同类 patch 设最短间隔

近期刚回滚过则暂停自动优化

19. 最终产品定义

这版产品最准确的定义应该是：

EVO Skills 是一个后台常驻的本地元 Agent。它不管理复杂的 skill 分支树，而是为每个项目维护全局 skills 的影子副本，并基于真实 trace 对影子副本做持续的小步自动优化，同时用演化日志和 checkpoint 保证整个过程可追踪、可回滚。


