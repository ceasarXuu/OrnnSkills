# 版本发布文档体系

> 最后更新：2026-08-09

本目录按语义化版本号，为每个发布版本建立一个子目录，收纳该版本的完整文档三件套。与 `CHANGELOG.md`（standard-version 自动生成的变更流水）互补：CHANGELOG 负责"改了什么"的提交级记录，本目录负责"这个版本是什么、怎么设计、怎么交付"的文档级固化物。

## 目录结构

```text
docs/releases/
  README.md              <- 本文件（版本管理规则）
  v<version>/
    prd.md               <- 该版本产品范围、目标、完成定义、验收标准
    technical-design.md  <- 该版本架构与实现设计
    engineering-plan.md  <- 该版本工作分解、里程碑、状态追踪
```

## 版本目录规则

- 目录命名固定为 `v<version>`，`<version>` 与 `package.json` / git tag 一致，例如 `v0.1.13`。
- 每个版本目录必须且只包含三个文档：`prd.md`、`technical-design.md`、`engineering-plan.md`。
- 文档职责链：`prd.md` 定义产品范围与完成定义；`technical-design.md` 从 PRD 派生，不得重定义产品范围；`engineering-plan.md` 从 PRD 与设计派生，不得重定义产品范围。
- `prd.md` 必须携带独立的 PRD 文档版本号与版本历史表，与产品版本号解耦。
- 版本发布（`npm run release`）后，如该版本尚未建立文档目录，应在发布记录完成后补齐三件套；未发布的进行中版本（如 `v0.2.0`）作为需求收纳与计划工作区，状态标注 `draft`。
- 历史版本不回填；需要追溯时以 `CHANGELOG.md` 与 git tag 为准。

## 当前版本

| 版本 | 状态 | 说明 |
|---|---|---|
| [v0.1.13](v0.1.13/prd.md) | released（已发布 2026-05-01） | 当前已发布版本锁定 |
| [v0.2.0](v0.2.0/prd.md) | draft | 后续 feature / debug 需求收纳与计划工作区 |

## 文档版本约束

- `prd.md` 的 `PRD 文档版本` 与 `PRD 文档版本历史` 必须存在。
- 三件套中的链接必须指向本目录内路径，不得指向其他版本的归档文档。
- 状态取值：`draft`（起草中）、`released`（随版本发布）、`archived`（已被更高版本取代）。
