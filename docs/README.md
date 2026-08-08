# OrnnSkills 文档索引

> 最后更新：2026-04-29

OrnnSkills 当前主线版本为 **V2.0**（围绕 `Skill Family / Instance / Revision` 模型，dashboard V3 为主使用现场）。

历史 V1（"Skill Evolution Agent" + 旧 dashboard）已归档；V2 中间产物（`/v2` 路由、`frontend/` 目录）已下线。

本目录文档按用途分类：

## 1. 当前主线（持续更新）

| 文档 | 内容 | 适用版本 |
|---|---|---|
| [PRD.md](PRD.md) | 产品需求与定位 | V2.0 |
| [PROGRESS.md](PROGRESS.md) | 实时迭代进度 | V2.0 / V3 dashboard |
| [TESTING-STRATEGY.md](TESTING-STRATEGY.md) | 测试与覆盖策略 | V2.0 |
| [PERFORMANCE-BENCHMARKS.md](PERFORMANCE-BENCHMARKS.md) | dashboard 基准 | V2.0 |
| [ARCHITECTURE_CONSTRAINTS.md](ARCHITECTURE_CONSTRAINTS.md) | 架构约束 | V2.0 |
| [DESIGN.md](DESIGN.md) | UI/UX 设计 | V3 dashboard |
| [dashboard-v3-storybook.md](dashboard-v3-storybook.md) | Storybook 规范 | V3 dashboard |
| [SKILL-DOMAIN-REFACTOR-PLAN.md](SKILL-DOMAIN-REFACTOR-PLAN.md) | Skill 领域重构计划 | V2.0 |
| [DASHBOARD-CACHE-PLAN.md](DASHBOARD-CACHE-PLAN.md) | dashboard 缓存方案 | V3 dashboard |
| [TRACE-SKILL-MAPPING.md](TRACE-SKILL-MAPPING.md) | trace→skill 映射 | V2.0 |
| [PROMO-ANIMATION.md](PROMO-ANIMATION.md) | Remotion promo | 通用 |
| [CODE-QUALITY-GOVERNANCE-2026-04.md](CODE-QUALITY-GOVERNANCE-2026-04.md) | 当前治理计划 | V2.0 |

## 2. 历史/归档（仅追溯背景）

| 文档 | 状态 |
|---|---|
| [DASHBOARD-V2-FRONTEND-REFACTOR.md](DASHBOARD-V2-FRONTEND-REFACTOR.md) | 已归档（V2 已下线） |
| [V1-V3-DASHBOARD-GAP-AUDIT.md](V1-V3-DASHBOARD-GAP-AUDIT.md) | 已归档（V1 已下线） |
| [AGENT-MIGRATION-PLAN.md](AGENT-MIGRATION-PLAN.md) | 历史迁移记录（2026-03） |
| [research/legacy-tests/](research/legacy-tests/) | 早期 trace 研究脚本 |

## 3. 调研/参考

| 文档 | 内容 |
|---|---|
| [LITELLM-RESEARCH.md](LITELLM-RESEARCH.md) | LiteLLM 调研 |
| [CODEX-TRACE-RESEARCH.md](CODEX-TRACE-RESEARCH.md) | Codex trace 调研 |
| [CLAUDE-OPENCODE-TRACE-RESEARCH.md](CLAUDE-OPENCODE-TRACE-RESEARCH.md) | Claude/OpenCode trace 调研 |
| [DARWIN-SKILL-COMPARISON.md](DARWIN-SKILL-COMPARISON.md) | macOS skill 对照 |
| [SESSION-STORAGE-RESEARCH.md](SESSION-STORAGE-RESEARCH.md) | 会话存储方案 |

## 版本术语约定

- **V1**：早期 "Skill Evolution Agent"，含旧 dashboard，整体已下线
- **V2**：中间过渡产物，含 `frontend/` + `/v2` 路由，已下线
- **V2.0（当前主线）**：本地优先、跨宿主、可视化的 Skill 生命周期与演进管理器；dashboard 主入口为 V3
- **V3 dashboard**：当前唯一生效的前端实现（`frontend-v3/` + `/v3`）

新增文档建议在文件首行后第二行加 `> 最后更新：YYYY-MM-DD` 标注。
