# OrnnSkills

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![npm version](https://img.shields.io/npm/v/ornn-skills.svg)](https://www.npmjs.com/package/ornn-skills)

[English](README.md) | [中文](README.zh-CN.md)

OrnnSkills 是一个本地优先的 AI Agent Skill 管理仪表盘，用来管理分散在不同项目和宿主里的 skills。

它帮助你看清楚本机有哪些 skills、它们分布在哪些项目和宿主、最近是否还在使用、版本如何变化，以及哪些 skills 值得继续维护或优化。它面向同时使用 Codex、Claude Code、OpenCode 等工具的个人用户，目标是把本地 skill 库管理清楚，而不是做成云端账号系统或团队治理平台。

## OrnnSkills 能做什么

OrnnSkills 把 skill 当作一等对象来管理。它不会只展示一堆文件路径，而是把 skill 拆成更贴近使用场景的视角：

- **Skill Family**：用户认知里的“同一个 skill”，跨项目、跨宿主聚合展示。
- **Skill Instance**：某个 skill 在某个项目、某个宿主里的安装副本。
- **Skill Version**：某个 skill 实例的本地版本历史，包括当前生效版本、停用版本和 diff。
- **使用证据**：观察到的调用次数、分析触达次数、优化次数、覆盖项目数、覆盖宿主数和最近使用时间。

最终呈现的是一个本地 SkillOps 工作台：你可以扫描本地项目、浏览 skills、查看真实使用信号、审阅版本历史、比较内容差异、安全编辑，并同时关注模型用量和配置状态。

## 主仪表盘

启动仪表盘：

```bash
ornn dashboard
```

默认会在浏览器里打开本地 dashboard。也可以指定端口或语言：

```bash
ornn dashboard --port 47432
ornn dashboard --lang zh
ornn dashboard --no-open
```

dashboard 包含四个一级页面：**技能**、**市场**、**项目**、**配置**。

### 技能

技能页是理解全局 skill 库的主工作区。

它以 Skill Family 为列表单位，而不是以零散文件为单位，帮助你回答：

- 这个 skill 覆盖了多少项目？
- 哪些宿主里有它的实例？
- 它有多少个修订版本？
- 它现在是 active、idle、unused，还是 partial？
- 它最近一次调用是什么时候？

进入某个 skill family 后，可以选择具体项目和宿主实例，查看并编辑 skill 正文。当前支持：

- 查看当前生效版本
- 在不同版本之间切换
- 选择一个版本做 diff 对比
- 停用或恢复某个版本
- 保存正文改动并生成新版本
- 在应用到同族实例前预览影响范围
- 检查市场中是否存在同名 skill
- 市场版本有差异时先审阅 diff，再决定是否应用到草稿

当市场版本和本地内容不一致时，OrnnSkills 会展示差异审阅界面。你可以逐组接受或拒绝改动，也可以全部接受、全部拒绝，或直接取消，避免未审阅的远端内容直接覆盖本地草稿。

### 市场

市场页是外部 skill 来源的轻量入口。

它把外部资源分成两类：

- skill 目录和索引站点
- GitHub 资源库和公开集合

每个入口都是直接打开外部页面的链接，展示来源名称、站点、可信度标签、支持宿主标签和简短说明。市场页只是发现入口：它不会抓取远端内容，不会自动安装 skill，也不会在没有用户动作的情况下把外部资源混入本地技能库。

### 项目

项目页聚焦单个项目。

左侧是已注册项目列表，也可以通过项目选择入口添加新的本地文件夹。选择项目后，可以查看：

- 当前项目中观察到的 skills
- 按宿主区分的 skill 实例
- 状态、生效版本、评估次数和最近更新时间
- 搜索和宿主筛选
- 适合大型项目的分页列表

项目页还包含成本视图。当本地已有用量数据时，可以汇总：

- 可估算时的模型花费
- 按模型拆分的用量
- 调用次数
- 输入、输出和总 token
- 平均延迟
- 单次调用平均 token
- 按 scope 和 skill 拆分的用量
- 模型价格和能力目录的匹配状态

成本数据来自本地观察到的用量和可用的模型价格目录。价格未知时，界面会保持空值，而不是给出虚假的精确数字。

### 配置

配置页管理影响 skill 分析和模型使用的设置。

模型配置支持：

- 添加模型服务
- 选择 provider 和 model
- 自定义 provider ID 和 model 名称
- 填写 API Key，并支持显示/隐藏
- 设置一个默认启用的模型服务
- 检查模型服务连通性
- 在可用时加载 LiteLLM 模型目录
- 设置本地安全闸门，包括请求数、并发数和预计 token 上限

演进配置支持三个分析阶段的提示词控制：

- Skill Call Analyzer
- Decision Explainer
- Readiness Probe

每个阶段都可以使用内置系统提示词，也可以切换到用户自定义提示词。这样可以调整分析行为，而不需要直接改 skill 文件。

## CLI 使用流程

dashboard 是主要产品入口；CLI 适合初始化、自动化和精确的本地操作。

### 安装

```bash
npm install -g ornn-skills
```

OrnnSkills 需要 Node.js 18 或更高版本。

### 初始化项目

在每个希望纳入 OrnnSkills 的项目中执行一次：

```bash
cd /path/to/project
ornn init
```

初始化会创建本地 OrnnSkills 项目状态，并把该项目注册到 dashboard 和 daemon 可识别的项目列表中。

### 运行后台守护进程

```bash
ornn start
ornn status
ornn stop
```

`ornn start` 会为已注册项目启动一个统一的后台守护进程，不需要每个项目各启动一个。

### 查看和管理 Skills

```bash
ornn skills status
ornn skills status --interactive
ornn skills log <skill-id>
ornn skills diff <skill-id>
ornn skills rollback <skill-id> --to <revision>
ornn skills freeze <skill-id>
ornn skills unfreeze <skill-id>
ornn skills sync <skill-id>
ornn skills preview <skill-id>
```

这些命令可以查看本地 skill 状态、浏览历史、比较内容、暂停某个 skill 的自动优化、恢复自动优化、重新同步或预览建议变更。

常用选项：

- `--project <path>`：指定项目
- `--runtime codex|claude|opencode`：限定到某个宿主
- `--interactive`：进入交互式选择
- `--dry-run`：在 freeze / unfreeze 操作前预览影响

### 日志和配置

```bash
ornn logs
ornn config
ornn completion
```

`ornn logs` 用于查看最近的本地 OrnnSkills 日志。`ornn config` 用于进入配置流程。`ornn completion` 用于生成 shell completion。

## 支持的宿主

OrnnSkills 0.1.12 重点支持：

- Codex
- Claude Code
- OpenCode

dashboard 会在数据可用时展示宿主级实例，并支持按宿主筛选或操作。

## 本地优先的数据方式

OrnnSkills 围绕本地所有权设计：

- 项目状态保存在项目本地的 `.ornn` 目录
- 全局日志和项目注册信息保存在本机用户环境中
- dashboard 运行在本地 HTTP 服务上
- 模型服务配置保存在本地
- 市场页只是外部链接入口，不会自动导入远端内容

这适合希望掌控自己 skill 库、不想把本地 skill 管理交给托管工作台的用户。

## 典型使用场景

你可以用 OrnnSkills 来：

- 查看多个本地项目里正在使用哪些 skills
- 识别活跃、闲置或长期未使用的 skills
- 在恢复或停用版本前先做版本对比
- 编辑项目 skill，并保留清晰的版本记录
- 在预览影响范围后，把一个有效改动应用到同族实例
- 检查市场中是否存在不同版本的同名 skill
- 查看项目级模型用量和估算成本
- 在浏览器里配置模型服务和安全闸门
- 把 Codex、Claude Code、OpenCode 的 skill 使用情况放在一个地方观察

## License

MIT License.
