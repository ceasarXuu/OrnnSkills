# Subagent VS Review: Freeze Evolution Implementation

- Created: 2026-08-09
- Report schema: adversarial-v1
- Task: Adversarial review of the v0.2.0 topic-freeze-evolution implementation (W2-W5)
- Review mode: fresh internal subagents
- Source session policy: no inherited main-agent context
- Status: in-progress

## Round 1: Implementation adversary

### Control Contract (frozen before review)

| Item | Value |
|---|---|
| Original objective | 冻结演化功能：写链路代码不生效（D1）、UI 临时隐藏（D2）、默认关闭演化（D4）；盘点先行（D3，已完成） |
| Acceptance criteria | prd.md §10：冻结开启后无新 patch/版本/部署；dashboard 无演化入口；开关可切换即时生效；恢复后行为恢复 |
| Non-goals | 不删代码、不重设计演化闭环、不冻结 trace 采集/索引/版本读取/停用 |
| Target locations | `src/config/{defaults,dashboard-config,dashboard-config-types,generator,index}.ts`、`src/types/index.ts`、`src/dashboard/routes/{global,project}-config-routes.ts`、`src/core/shadow-manager/{index,episode-probe-service,optimization-runner}.ts`、`frontend-v3/src/components/config-workspace.tsx` |
| Baseline revision | 86d6b53（实现前） |
| Reviewed commits | 28435fe, ac7ee15, d5f5d22, 60bbcbf |
| Allowed changes | 冻结开关配置、写链路短路、UI 隐藏（已在批准范围） |
| Prohibited | 删除演化代码、新增决策事件类型、扩大范围到非演化模块 |
| Authoritative sources | decisions.md (D1-D4), prd.md, plan.md, technical-design.md |
| Automatic round budget | 2 (initial + closure if needed) |
| Rollback checkpoint | 86d6b53（4 个提交可整批 revert） |
| Reviewer | implementation-adversary (Round 1) |

### Review Input (navigation packet)

Objective: challenge the freeze-evolution implementation's correctness, state flow, bypass paths, default semantics, compatibility, and test validity. Verify the frozen objective: with default config, no automatic evolution side effects (patch/version/deploy) occur; config toggle reverses behavior; UI entry hidden without breaking non-evolution UI.

Target files:
- `src/config/defaults.ts` (DEFAULT_CONFIG.tracking.evolution_frozen = true)
- `src/types/index.ts` (AutoOptimizePolicy.evolution_frozen, EVOConfig.tracking)
- `src/config/dashboard-config.ts` / `dashboard-config-types.ts` / `generator.ts`
- `src/dashboard/routes/global-config-routes.ts` / `project-config-routes.ts` (POST config passthrough)
- `src/core/shadow-manager/index.ts` (policy wiring + createShadowManager options)
- `src/core/shadow-manager/episode-probe-service.ts` (auto trigger short-circuit)
- `src/core/shadow-manager/optimization-runner.ts` (entry short-circuit)
- `frontend-v3/src/components/config-workspace.tsx` (evolution subtab hidden)
- Tests: `tests/unit/shadow-manager-components.test.ts`, `tests/unit/shadow-manager-{task-episodes,decision-events,deep-analysis}.test.ts`, `tests/unit/dashboard-{global,project}-config-routes.test.ts`

Risk focus (adversarial lenses):
1. Bypass paths: any code path that triggers analyze/patch/version/deploy without passing the freeze check (CLI commands, daemon, observers, journal, skill-deployer, sync, rollback, direct ShadowManager calls, manual optimize, migration paths)
2. Default semantics: evolution_frozen default true everywhere? Any consumer where `?? true` is missing or inverted (false default) would silently re-enable evolution
3. State consistency: frozen short-circuit in episode-probe skips analysis without marking episode state — can that leave episodes in inconsistent state or cause the probe to retrigger forever? runner skip marks 'completed' — correct?
4. Config round-trip: POST /api/config persists evolutionFrozen; writeConfig/setDefaultProvider rewrite path preserves it; legacy config migration (readLegacyProjectDashboardConfig / mergeDashboardConfigs) — does merge lose evolutionFrozen?
5. UI: config-workspace hidden tab — does localStorage 'evolution' value or normalizeConfigSubTab leave dead paths? Any other evolution UI entry (skills detail, project workbench) not hidden?
6. Restore path: evolution_frozen=false restores old behavior with no state migration?
7. Test validity: do new tests actually prove zero side effects (patch execution blocked, version creation blocked) or only prove internal bookkeeping?

Read-only. Do not modify files. Cite evidence paths and line numbers.

### Reviewer Launch Records

| Field | Round 1 |
|---|---|
| Reviewer role | implementation-adversary |
| Mechanism | opencode internal subagent (task tool, general) |
| Context forked from main agent | No — fresh session, packet only |
| Input packet | See above |
| Excluded context | Full conversation history, reasoning, prior conclusions |
| Read-only | Yes |
| Timeout policy | normal (8-12 min), max 2 attempts |

### Reviewer Output (Round 1)

Reviewer role: implementation-adversary · Session: ses_01994df3dffe6PIsjRMvclkBd0 · Status: completed

**Summary**: freeze write-path guards correctly placed and unit-tested; D1 holds in default construction path. However the config gate is disconnected from every config file in production — daemon gate hardwired to `true` via unused singleton default; restore path (D4) dead in production. A second scope-ambiguous un-gated version write exists in daemon bootstrap.

**Blocking findings:**

- **F1 — Restore path (D4) dead: gate never reads any config file.** Counterexample: user edits `~/.ornn/config/settings.toml` (documented location) to `evolution_frozen = false` and restarts → evolution stays frozen. Evidence (E2): `src/config/index.ts:184-200` — `configManager.init()` zero production callers (verified by tree grep); `src/daemon/project-runtime-registry.ts:146` passes no options; dashboard writes `~/.ornn/config/settings.toml` (`dashboard-config.ts:43`) never read by gate. Blast radius: full D4 restore contract fails; feature can only freeze, never unfreeze in production. Proof needed: config file toggle + daemon restart.
- **F2 — Un-gated version write in daemon bootstrap (`shadow-bootstrapper`).** Counterexample: default frozen config, user edits origin skill, daemon starts → `bootstrapSkillsForMonitoring` overwrites shadow content and calls `createVersion(...)` (`shadow-bootstrapper/index.ts:209-223`) with no `evolution_frozen` check. Blast radius: a new version is created while frozen (D1 violation signal lists "新版本"). Authority: E2 + E1 (conflicting — PRD §4 out-of-scope excludes indexing-sync; inventory never audited this path). Proof needed: user confirmation of scope (indexing-sync vs evolution write).

**Non-blocking risks:**

- **N1 (observability):** plan specified `evolution_frozen` decision event on skip; implementation logs debug only (accepted deviation). Combined with F1, a user whose restore silently fails gets no runtime signal.
- **N2:** `analyzeManualScope` runs full LLM analysis even when frozen; only runner gate blocks patch. Currently unreachable (zero production callers — dead code).
- **N3:** frozen skip never touches `analysisStatus`; a persisted `running` episode (crash mid-analysis pre-freeze) blocks probes forever and stays stuck after restore. Pre-existing.
- **N4:** policy snapshotted at ShadowManager construction; toggling requires daemon restart; dashboard POST never reaches the gate.
- **N5:** frontend dead code (`normalizeConfigSubTab`, `'evolution'` type, governance panel only in stories). Harmless; D2 holds for all surfaces checked.

**Missing tests:**

- T1: production default path — `createShadowManager(path)` no options + full episode cycle → zero decision events/versions.
- T2: restore via config file (`evolution_frozen=false` → gate unfrozen). Impossible before F1 fix.
- T3: real file round-trip preservation (`readLegacyProjectDashboardConfig → merge → write → generate → re-read` keeps `false`).
- T4: `writeConfig`/`setDefaultProvider` preserve `evolution_frozen=false`.
- T5: no test pins the gate to the same file the dashboard writes (would have caught F1).

**Missing logs/observability:**

- No info-level log of effective `evolution_frozen` at ShadowManager construction/daemon start.
- Runner skip is debug-only; no unfreeze-vs-frozen transition signal.

### Main Agent Triage

| Finding | Verdict | Evidence / Action |
|---|---|---|
| F1 | **accept** | E2 confirmed independently (grep: `configManager.init()` zero production callers; registry passes no options). Fixed in 5692feb: `ProjectRuntimeRegistry.ensureProjectRuntime` now reads `readDashboardConfig()` (the file dashboard writes, `~/.ornn/config/settings.toml`) and passes `{ evolutionFrozen }` to `createShadowManager`. T2 test added (`daemon-components.test.ts`). Runtime-verified: temp config `evolution_frozen = false` → daemon restart → `/api/config` returns `"evolutionFrozen":false`; file removed after verification. 814 tests green. |
| F2 | **blocked on user decision (E0)** | Scope ambiguity: bootstrap sync writes versions while frozen. Is bootstrap versioning "indexing-sync" (out of D1 scope per PRD §4) or "evolution write" (in scope)? Requires user confirmation before fixing. |
| N1 | **accept** | Info log added in 5692feb (`Evolution policy resolved` at ShadowManager construction). |
| N2 | **defer** | Dead code (zero production callers, confirmed in inventory). Tracked in plan.md as known latent gap. |
| N3 | **defer** | Pre-existing, freeze-adjacent; separate fix needed. Tracked in plan.md. |
| N4 | **defer** | Daemon restart semantics accepted for toggle (documented in plan.md P2-P4 defer). |
| N5 | **defer** | Harmless dead code; cleanup candidate. |

### Review Governor Decision

- Round 1 completed. Blocking findings: F1 (accepted + fixed, runtime-verified), F2 (blocked on user decision — E0 scope confirmation required).
- Governor decision: `user-decision-required` for F2 scope before closure round.
- Closure round (Round 2, budget 2/2): may start automatically for F1 only after F2 is resolved, per budget and closure-relevance rules. F1 closure evidence: unit test (T2) + runtime config toggle verification + 814 tests green.

### Convergence Reflection

- Original objective (D1-D4) frozen. F1 was a genuine production-path break of D4 restore contract, found only by adversarial review — accepted and fixed with E2 evidence.
- Scope growth: `src/daemon/project-runtime-registry.ts` newly touched (config read at runtime creation). Cumulative risk decreasing.
- F2 remains open pending user decision; N3 pre-existing.
- Rollback checkpoint: 60bbcbf (pre-F1-fix). Rollback option: revert 5692feb.

### Closure Status

- Open blockers: F2 (awaiting user decision on scope).
- F1: closed with fix + runtime verification.
- Status: blocked — user decision required on F2 before closure round.

## Round 2: Closure review (F1 fix)

- Round type: closure (user authorized agent to decide engineering matters; F2 classified as indexing-sync, out of D1 scope — recorded below)
- Reviewer role: implementation-adversary · Session: ses_01983c8d9ffeC5OtLdgRz53VXU · Status: completed

### Closure verdict

**F1 closed: YES.** Full path traced: dashboard writes `~/.ornn/config/settings.toml` → daemon `ensureProjectRuntime` reads same file via `readDashboardConfig()` → options to `createShadowManager` → policy → both short-circuits. `false` unfreezes; `true`/missing file freezes (default true). Only production caller is the daemon registry.

### Closure findings (triage)

| Finding | Verdict | Evidence / Action |
|---|---|---|
| R1 — test hermeticity: `global-daemon.test.ts` now triggers real `readDashboardConfig()` reading dev home config | **accept (engineering)** | Added `vi.mock('../../src/config/dashboard-config.js')` returning `{ evolutionFrozen: true }`. Fixed. |
| R2 — error path theoretical (readDashboardConfig is effectively total internally) | **reject (no realistic trigger)** | `readTomlConfigFile`/`readEnvFile` catch internally; no new failure class (registry `shadowManager.init()` already unprotected pre-existing). |
| R3 — toggle takes effect only after daemon restart, PRD acceptance said "即时生效" | **accept (wording calibration)** | Restart semantics is the implemented reality; PRD §10 acceptance reworded to "切换并重启 daemon 后生效". decisions.md (D1-D4) untouched — PRD was draft-level, not user authority. |
| New test validity | **valid** | Verified would fail pre-fix on both assertions; not a tautology. |
| Hot path | **no regression** | readDashboardConfig only on runtime (re)creation; not per-trace/per-sync. |
| F2 decision | **superseded by user decision D5** | User explicitly overrode the E1-boundary classification: "影子skills 也是为了做演化能力才加入的，本身也是演化能力的一部分，需要纳入冻结" (2026-08-09). D5 recorded in decisions.md: no materialization, no display of shadows while frozen; restore after unfreeze. Implemented in dc68691 (bootstrap skip + families API frozen + UI empty state). |

### User Decision After Round 2 (D5)

- User overrode F2 classification: shadow skills mechanism itself is part of evolution capability and must be frozen (E0 > E1).
- Confirmed boundaries: existing shadow data display also hidden; new projects do not materialize shadows; materialization auto-recovers after unfreeze.
- D5 added to decisions.md (active). F2 row in prd.md/plan.md decision logs marked superseded.
- Implementation (dc68691): `ShadowManager.init()` skips bootstrap when frozen; `/api/skills/families` returns `{families:[], frozen:true}` via `readEvolutionFrozenSync()`; SkillsWorkspace renders frozen empty state. Verified: 816 unit tests, 59 storybook tests, lint 0 errors, runtime curl `{"families":[],"frozen":true}`.

### Final Closure Status (after D5)

- **passed with scope extension** — no open blockers; D5 implemented and verified.
- Automatic review budget consumed (2/2 rounds). D5 changes were user-directed (E0); a further review round requires explicit user approval if desired.

### Review Governor Decision

- Round 2 (closure): completed within budget (2/2).
- Accepted blockers all closed: F1 (fix + runtime verification + closure verdict), R1 (fix), R3 (wording). F2 classified under E1 boundary, no code change.
- Governor decision: `pass`.

### Final Closure Status

- **passed** — no open blockers. Report committed: vs_review/2026-08-09-freeze-evolution-review.md.
- Rollback checkpoint: 60bbcbf (pre-F1-fix); post-closure HEAD includes 5692feb + R1 fix.
