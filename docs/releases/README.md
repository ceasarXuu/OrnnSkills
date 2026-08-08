# 版本发布文档体系

> 最后更新：2026-08-09

本目录按语义化版本号，为每个发布版本建立一个子目录，收纳该版本的文档。与 `CHANGELOG.md`（standard-version 自动生成的变更流水）互补：CHANGELOG 负责"改了什么"的提交级记录，本目录负责"这个版本要做什么、怎么设计、怎么交付"的文档级固化物。

## 目录结构

```text
docs/releases/
  README.md              <- 本文件（版本管理规则）
  v<version>/
    topic-<主题>/         <- 一个可独立交付的工作单元（feature / bug 修复 / 工程维护）
      prd.md              <- 该 topic 的产品范围、目标、完成定义、验收标准
      technical-design.md <- 该 topic 的架构与实现设计
      engineering-plan.md <- 该 topic 的工作分解、里程碑、状态追踪
```

## 版本目录规则

- 目录命名固定为 `v<version>`，`<version>` 与 `package.json` / git tag 一致，例如 `v0.1.13`。
- **v0.2.0 起**：版本目录下不直接放文档，只放 `topic-<主题>` 子文件夹；版本级不设独立汇总文档。版本目标、完成定义、验收标准分散由各 topic 的 `prd.md` 承担。
- **v0.1.x（已发布历史）**：沿用版本级三件套模式（`prd.md` / `technical-design.md` / `engineering-plan.md` 直接位于版本目录下），不回改。
- topic 命名：`topic-<kebab-case 主题>`，如 `topic-freeze-evolution`、`topic-ci-fix`。一个 feature 或一个 bug 修复对应一个 topic；一个版本内有多个工作单元时，按单元数量建立多个 topic 子文件夹。
- 每个 topic 目录必须且只包含三个文档：`prd.md`、`technical-design.md`、`engineering-plan.md`。
- 文档职责链：topic `prd.md` 定义该 topic 的范围与完成定义；`technical-design.md` 从 PRD 派生，不得重定义范围；`engineering-plan.md` 从 PRD 与设计派生，不得重定义范围。
- topic `prd.md` 必须携带独立的 PRD 文档版本号与版本历史表，与产品版本号解耦。
- 需求尚未确定的版本（如当前 v0.2.0）只保留空目录，待需求确定后再按 topic 结构补齐。
- 版本发布（`npm run release`）后，已发布版本对应 topic 状态标注 `released`；未发布 topic 状态标注 `draft`。
- 历史版本不回填；需要追溯时以 `CHANGELOG.md` 与 git tag 为准。

## 当前版本

| 版本 | 状态 | 说明 |
|---|---|---|
| v0.1.13 | released（已发布 2026-05-01） | 当前已发布版本；其版本文档此前已按用户要求撤销，追溯以 `CHANGELOG.md` 与 git tag 为准 |
| [v0.2.0](v0.2.0) | draft | 需求逐步确定中，按 topic 建立文档 |

### v0.2.0 Topic 清单

| Topic | 状态 | 说明 |
|---|---|---|
| [topic-freeze-evolution](v0.2.0/topic-freeze-evolution/prd.md) | draft | 冻结演化功能（盘点已完成，冻结实现待执行） |

## 文档版本约束

- `prd.md` 的 `PRD 文档版本` 与 `PRD 文档版本历史` 必须存在。
- 三件套中的链接必须指向本目录内路径，不得指向其他版本的归档文档。
- 状态取值：`draft`（起草中）、`released`（随版本发布）、`archived`（已被更高版本取代）。
