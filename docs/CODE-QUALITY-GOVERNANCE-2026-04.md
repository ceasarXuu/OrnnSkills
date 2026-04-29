# 代码质量治理计划 · 2026-04

最后更新：2026-04-29（v2 — 基于代码核实修订）
状态：执行中

## 1. 背景

针对 OrnnSkills 仓库 2026-04-29 全面代码质量审查（总分 6.7/10，及格偏上）的治理落地文档。

审查识别的关键问题（已逐项对照代码核实）：
- P0：子进程 `exec()` 命令拼接（`dashboard-launcher.ts:24`、`dashboard.ts:28` 两处）；用户输入路径在 dashboard onboarding 路径上缺少校验 — `validateProjectPath()` 已存在于 `src/utils/path.ts:67` 但 project-onboarding 入口未调用
- P1：空 catch 块大量存在（实测恰好 100 处，分布在 43 个文件），其中关键场景未记录；`test/` 与 `tests/` 双目录并存（`test/` 含过时手动测试脚本 + 研究报告，`tests/` 含 90+ 正式单测）；observer/daemon/CLI 测试覆盖薄弱（vitest coverage.exclude 排除了 14 个路径）
- P2：`tsconfig` 未启用 `noUncheckedIndexedAccess`（`strict: true` 不含此项）；LiteLLM 响应解析无运行时 schema 校验（仅有 `as` 类型断言，但 `choices` 空数组已做运行时检查）；前后端 ESLint 配置格式不统一（后端 legacy `.eslintrc.json` vs 前端 flat config `eslint.config.js`）；文档 V1/V2/V3 术语混杂（存在 DASHBOARD-V2-FRONTEND-REFACTOR、V1-V3-GAP-AUDIT、dashboard-v3-storybook 等版本交叉文档）

## 2. 治理原则

- **最小化变更**：每项独立成 commit，遵守 AGENTS.md 4.1
- **本地优先安全模型**：OrnnSkills 是个人本地工具，不是多租户服务；安全加固以"防误用"和"防误操作"为主，不假设恶意远程攻击者
- **不制造日志噪音**：空 catch 块只在"真实错误且当前未被任何上层观察到"的位置补日志；不全量改造
- **可回滚**：任何文件移动走 `git mv`，不删
- **测试范围务实**：observer/daemon/CLI 全量补单测不在本计划范围内（属下季度）；本计划只补 P0/P1 修改触达的代码 + 各模块各 1-3 个代表性场景

## 3. 任务清单

| # | 优先级 | 任务 | 范围 | 验收 |
|---|---|---|---|---|
| 1 | P0 | 修复 `dashboard-launcher.openBrowser` 命令注入风险 | 替换 `exec` → `spawn`，URL 作为参数传递 | 单测覆盖 darwin/linux/win 三分支 |
| 2 | P0 | project-onboarding 入口接入路径校验 | `validateProjectPath()` 已存在于 `src/utils/path.ts:67`；需在 `project-management-routes.ts:109` POST `/api/projects` 入口调用；补充 NUL 字节显式检查（当前 `realpathSync` 可间接拦截但非显式） | 拒绝 NUL 字节、空串、`..` 路径穿越、不存在路径；接受任意磁盘绝对路径 |
| 3 | P1 | 关键空 catch 补日志（**仅热路径**） | request/IO/spawn 错误路径，约 6-10 处（从 100 处 `catch {` 中筛选） | 不动"文件不存在则用默认值"类降级 catch（如 `init.ts:36`、`skills-reader.ts:52`） |
| 4 | P1 | `test/` 目录归档 | `git mv test/ → docs/research/legacy-tests/`（`test/` 含 2 个过时手动测试 `.ts` + 5 个研究报告 `.md` + fixtures/output，非 vitest 标准格式） | tsc/vitest 不受影响；README 标注 |
| 5 | P1 | 关键模块代表性单测补充 | observer/daemon-lifecycle/dashboard-launcher 各 1-3 个 | 新测试通过；vitest exclude 不缩减 |
| 6 | P2 | 启用 `noUncheckedIndexedAccess` | tsconfig + 修复编译错误 | typecheck 通过 |
| 7 | P2 | LiteLLM 响应 schema 校验 | `litellm-client.ts:329` 用 `as LiteLLMResponse` 类型断言；`choices` 空数组已在 263 行做运行时检查；需补完整 schema 守卫（如 Zod 或手写 guard）覆盖 `message` 缺失、`content` 异常类型等 | 单测覆盖空 choices/缺 message/异常 content 场景 |
| 8 | P2 | 文档版本标注与归档 | DASHBOARD-V2-FRONTEND-REFACTOR 等过时文档加 deprecation 头；docs/ 增 VERSIONING.md（可选并入本文件） | 所有 docs/ 文件首行可识别版本归属 |
| 9 | P2 | 后端升级到 ESLint Flat Config | `.eslintrc.json` → `eslint.config.js`，与前端配置形态对齐 | `npm run lint` 通过 |
| 10 | P2 | CLI 输出点规范化 | 代码库 logger 调用 479 处 vs console 调用仅 10 处，整体日志基础设施已成熟；需治理的是 `dashboard-launcher.ts` 等处的 `cliInfo()`（封装 console.log）在错误路径上应改用 `logger.*`；`global-config-routes` 等路由层确认日志覆盖 | 错误/异常路径用 logger.* 而非 console.* |
| 11 | P1 | 超大型源文件拆分（AGENTS.md §4.1 ≤500 行红线） | 8 个红线文件：`i18n.ts`(1240)、`shadow-registry/index.ts`(650)、`claude-observer.ts`(599)、`dashboard/server.ts`(593)、`litellm-client.ts`(561)、`cli/commands/completion.ts`(547)、`config/dashboard-config.ts`(510)、`use-dashboard-v3-config.ts`(501)。机械拆分为主，不改行为 | 每个文件 ≤500 行；typecheck/test 全过；外部 import 路径不破坏 |

## 4. 显式排除

以下事项**不在本计划范围**，留存到下季度规划：

- observer/daemon/CLI 完整单测覆盖（工作量约 2-3 周）
- vitest exclude 列表大幅缩减
- `exactOptionalPropertyTypes` 启用（影响面太大）
- 100 处 `catch {` 全量整改（其中多数是合理的降级/忽略场景，如"目录不存在则创建"、"端口占用则重试"）
- Dashboard server.ts、daemon/index.ts 等大文件深度拆分
- 后端 LiteLLM 客户端整体重构
- pre-commit hook / husky 检查
- 前端 a11y 集成

## 5. 执行顺序

1. P0-1 / P0-2（安全） → 2. P1-3 关键 catch → 3. P1-4 test/ 归档 → 4. P2-6 noUncheckedIndexedAccess → 5. P2-7 LiteLLM schema → 6. P1-5 代表性测试 → 7. P2-10 CLI 输出规范化 → 8. P2-9 ESLint Flat → 9. P2-8 文档版本

每步完成立即 commit；最后跑 typecheck + lint + 全量 test + benchmark:dashboard:check 收尾。

## 6. 风险

- `noUncheckedIndexedAccess` 可能引出几十处真实空指针读，需逐处处理；若超出预期工作量则降级为单独 PR
- ESLint Flat Config 升级可能引入插件兼容问题（`@typescript-eslint` 旧版需升级）
- `test/` 目录归档若有外部脚本引用（npm script、CI），需同步更新
- P0-2 路径校验接入后，`validateProjectPath` 要求路径在 `cwd` 下（`path.ts:87`），但 dashboard onboarding 场景用户可能添加任意磁盘路径；需确认此约束是否需要放宽为"任意存在的绝对路径"
- `exec` → `spawn` 改造涉及两处独立实现（`dashboard-launcher.ts` 和 `dashboard.ts`），需保持行为一致
- LiteLLM schema 校验若引入 Zod 会新增运行时依赖，需评估 bundle size 影响
- `noUncheckedIndexedAccess` 实测引出 135 个编译错误 / 45 个文件（超出预期），已修复 11 文件 / 59 错误，剩余需单独 PR 处理

## 7. 进度追踪

| # | 状态 | commit |
|---|---|---|
| 1 | DONE | `5f1dff9` |
| 2 | DONE | `8f0347f` |
| 3 | DONE | `e4b2dae` |
| 4 | DONE | `1e0002b` |
| 5 | DONE | （已存：`daemon-dashboard-launcher.test.ts`、`project-onboarding.test.ts`、`codex-observer*.test.ts` 等覆盖） |
| 6 | WIP | `b881bb3`（11 文件已修复，剩余 ~76 错误 / 35 文件 → 单独 PR） |
| 7 | DONE | `f4ed198` |
| 8 | DONE | `fc117bf` |
| 9 | **DEFERRED** | ESLint 8→9 / `@typescript-eslint` 5→8 跨主版本升级；且仓库现存 146 个 lint 问题（57 errors）已超出本计划范围。降级为下季度独立 PR。 |
| 10 | DONE | `a8b41f2` |
| 11 | WIP | 2026-04-29 追加；按文件逐 commit |

## 8. 收尾验收

- 2026-04-29：`npm run typecheck` ✅、`npx vitest run`（129 文件 / 804 测试）✅、`npm run lint` ❌ 146 个**预存**问题（与本治理无新增）
- pre-commit (husky) 仅跑 `npm test`，全部新提交均通过
- benchmark:dashboard:check 未在本计划范围内回归（无 dashboard 性能相关变更）

## 9. 后续 backlog

- ESLint Flat Config 升级 + 修复现存 146 lint 问题（独立 PR）
- `noUncheckedIndexedAccess` 剩余 35 文件（独立 PR）
- observer/daemon/CLI 完整覆盖率提升（下季度计划）
- vitest exclude 列表回收
- LiteLLM 客户端整体重构与 `extractContent` 拆分
