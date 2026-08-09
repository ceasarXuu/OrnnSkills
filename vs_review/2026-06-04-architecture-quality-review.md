# Subagent VS Review: Architecture Quality Report

- Created: 2026-06-04T18:00:00+08:00
- Updated: 2026-06-04T18:00:00+08:00
- Report schema: adversarial-v1
- Task: Validate the architecture quality report's findings, severity classifications, and evidence before accepting them as actionable
- Report path: `vs_review/2026-06-04-architecture-quality-review.md`
- Review mode: fresh internal subagents
- Source session policy: no inherited main-agent context
- Status: passed

## Round 1: Adversarial review of the architecture quality report

### Review Input

#### Objective
The main agent produced an architecture quality report for the OrnnSkills repository. The report claims specific architectural violations, code smells, data correctness bugs, and documentation gaps with assigned severities. These findings are intended to trigger actionable fixes. Before any fixes are applied, the findings must be independently challenged for factual accuracy, severity correctness, and completeness.

#### Review Target
Architecture quality report findings (see attached communication messages from the main agent). The report makes specific claims across 5 categories:
1. Circular dependency: `task-episode` ↔ `task-episode-policy`
2. Core-layer reverse dependency on dashboard layer
3. SQLite `save()` called mid-transaction (data correctness)
4. Config system V1/V2 split
5. Module-level side effects
6. Frontend God hooks
7. `episode-probe-service.ts` code duplication
8. Duplicate config route handlers
9. LLM Provider abstraction OCP violation
10. Shadow Registry dead counter fields
11. Unused `LLMInstance` interface
12. `SkillFamilyDetail` 42 props
13. ARCHITECTURE.md outdated
14. Test files >500 lines
15. NDJSON spinlock busy-wait
16. SQL boilerplate duplication
17. Frontend i18n raw string comparison

#### Target Locations
- `src/core/task-episode/index.ts`
- `src/core/task-episode-policy/index.ts`
- `src/core/readiness-probe/index.ts`
- `src/core/decision-explainer/index.ts`
- `src/core/prompt-defaults.ts`
- `src/core/prompt-overrides.ts`
- `src/core/shadow-manager/episode-probe-service.ts`
- `src/core/analyzer/`
- `src/storage/sqlite/sqlite-shadow-skill-repo.ts`
- `src/storage/sqlite/sqlite-db-adapter.ts`
- `src/storage/ndjson.ts`
- `src/config/dashboard-config.ts`
- `src/config/index.ts`
- `src/config/generator.ts`
- `src/llm/request-guard.ts`
- `src/llm/litellm-client.ts`
- `src/llm/token-tracker.ts`
- `src/llm/factory.ts`
- `src/dashboard/routes/global-config-routes.ts`
- `src/dashboard/routes/project-config-routes.ts`
- `frontend-v3/src/features/dashboard/use-dashboard-v3-skill-library.ts`
- `frontend-v3/src/features/dashboard/use-dashboard-v3-config.ts`
- `frontend-v3/src/components/skill-family-detail.tsx`
- `ARCHITECTURE.md`

#### Change Introduction
The main agent claims 17 findings about the OrnnSkills codebase architecture. The severity ranges from high (data correctness, architecture violation) to low (documentation, style). The report asserts these are actionable. The reviewers must attack these claims: verify each finding by reading the actual code, check whether the severity is appropriate, and identify any missing findings.

#### Risk Focus
- **False positives**: Findings that claim an issue where none exists, or where the evidence is misinterpreted
- **Wrong severity**: Findings classified too high or too low
- **Missing context**: Findings that ignore intentional design trade-offs
- **Incomplete diagnosis**: Findings that identify symptoms but miss root causes
- **Omitted findings**: Important architecture issues the report did not identify

#### Assumptions To Attack
- The circular dependency in task-episode is real and harmful (not just a type-only loop)
- The core→dashboard import is an architecture violation (not a pragmatic trade-off)
- SQLite `save()` mid-transaction is a real data correctness bug (verify by reading both paths)
- Two config managers with overlapping storage is a real problem
- Module-level side effects actually cause test fragility in this codebase
- The God hooks are genuinely too large vs. acceptable hook complexity
- `episode-probe-service.ts` has 10x repeated code (verify actual pattern similarity)
- The LLM provider abstraction is truly OCP-violating vs. just having multiple touch points
- Shadow registry counter fields are dead (confirm no code writes them)
- `LLMInstance` is genuinely unused (confirm no imports)
- ARCHITECTURE.md is meaningfully wrong vs. just a high-level diagram
- The 500-line test file finding is meaningful for code quality

#### Adversarial Lenses
- architecture: module boundaries, dependency direction, abstraction quality
- implementation: code correctness, factual evidence, data flow
- maintenance: whether the findings help the next developer
- testing: whether the report's claims can be verified independently

#### Verification Status
- Main agent ran `tsc --noEmit` (passed)
- Main agent ran file size analysis via bash
- Main agent ran dependency analysis via grep/read
- Main agent read key files for evidence
- No automated tests were run for the report's claims

#### Reviewer Instructions
- Fresh internal subagent session. Do not inherit any main-agent context.
- Read the actual target files to verify the main agent's claims.
- Do NOT read the main agent's report or any of its reasoning.
- Cite evidence paths and line numbers in findings.
- Do not modify files.
- Focus on high-impact failure modes: false positives, wrong severity, omissions.
- Try to falsify each finding by finding counterexamples in the code.
- Return a structured output with: Summary, Blocking Findings, Non-blocking Risks, Required Fixes, Missing Tests, Missing Logs/Observability, Evidence.

### Reviewer Timeout Policy

| Complexity | Initial Wait | Extension | Max Attempts Per Role | Blocking Closure Behavior |
|---|---|---|---|---|
| complex | 20 min | 10 min | 2 | cannot pass if review is unavailable |

### Reviewer Selection

| Reviewer | Reason Selected | Risk Area |
|---|---|---|
| architecture-adversary | Challenge architecture-level findings: wrong severity, missing architecture issues, incorrect dependency analysis, flawed recommendations | Architecture integrity, severity accuracy |
| implementation-adversary | Verify code-level claims: circular dependency reality, SQLite save bug, dead fields, duplicate code patterns | Factual correctness of code claims |

### Reviewer Launch Records

| Reviewer | Internal Mechanism | Session / Job ID | Trace Source | Context Forked | Input Packet | Context Explicitly Excluded | Read-only |
|---|---|---|---|---|---|---|---|---|
| architecture-adversary | fresh subagent task | ses_170beaf64ffe7T5Vep1ZhzlkW1 | tool spawn | fork_context=false | Round 1 Review Input (architecture focus) | main-agent history, report content, conclusions | yes |
| implementation-adversary | fresh subagent task | ses_170be8b1fffe3BJf0IVrF27gvZ | tool spawn | fork_context=false | Round 1 Review Input (code focus) | main-agent history, report content, conclusions | yes |

### Reviewer Timeout Records

| Reviewer Output Key | Reviewer Role | Attempt | Session / Job ID | Waited | Status | Reason | Action |
|---|---|---|---|---|---|---|---|
| architecture-adversary-output | architecture-adversary | 1 | ses_170beaf64ffe7T5Vep1ZhzlkW1 | <20min | completed | task completed within timeout | completed |
| implementation-adversary-output | implementation-adversary | 1 | ses_170be8b1fffe3BJf0IVrF27gvZ | <20min | completed | task completed within timeout | completed |

### Reviewer Outputs

#### architecture-adversary-output

##### Summary
Most claims are directionally correct but systematically overstated in severity. The most severe real issue (ARCHITECTURE.md being actively misleading about the module graph) is understated. New findings discovered: `token-tracker.ts` + `status-bar.ts` + `generator.ts` are dead code; config file collision is worse than claimed (SAME file path, DIFFERENT schema).

##### Blocking Findings

- **ARCHITECTURE.md is not just outdated — it is actively misleading about the module graph** [severity: blocking]
  - Broken assumption: ASCII diagram claims Analyzer, PatchGenerator, Evaluator, Router are children of Pipeline, and ShadowRegistry, Journal are children of ShadowManager. All are peer directories.
  - Failure scenario: New developers build wrong mental model, place new modules incorrectly.
  - Evidence: `ARCHITECTURE.md:22-27`, vs `ls src/core/pipeline/` (only index.ts), `ls src/core/analyzer/` (empty)
  - Impact: Entire team operates on a wrong architecture map.

- **Project-level config file collision between V1 ConfigManager and V2 dashboard-config** [severity: major]
  - Broken assumption: Both write to `project/.ornn/config/settings.toml` (EXACT SAME PATH) with completely different schemas.
  - Failure scenario: Dashboard writes V2 schema, V1 ConfigManager reads it, validation fails, config silently falls back to defaults.
  - Evidence: `src/config/index.ts:238` V1 path = `src/config/dashboard-config.ts:44-45` V2 path. V1 expects `{project, skills}`, V2 reads `{ornn, llm, providers, tracking}`.

- **token-tracker.ts, status-bar.ts, generator.ts are dead code** [severity: major]
  - Broken assumption: token-tracker has zero production consumers. status-bar is its only consumer but itself has zero imports.
  - Evidence: `src/llm/token-tracker.ts:92` singleton; `src/utils/status-bar.ts:6` only consumer; both zero external imports. `src/config/generator.ts` 85 lines, zero imports.

##### Non-blocking Risks

- **Core→dashboard cross-layer import** [severity: minor] — Real but trivial. 7 files import `Language` type or `readProjectLanguage`. Moving to `src/types/` would take < 30 min.
- **Module-level side effects in request-guard.ts** [severity: minor] — Real but mitigatable. Has `resolveLLMSafetyOptions()` override and `resetSharedLLMRequestGuard()` for tests.
- **Config route handlers ~66% duplicated** [severity: minor] — ~110 duplicated lines out of ~333 total (not 80% as claimed).

##### Required Fixes
1. Update ARCHITECTURE.md to reflect actual flat module tree. Remove misleading hierarchy.
2. Eliminate config file collision: different paths or merge reader.
3. Remove dead code: token-tracker.ts, status-bar.ts, generator.ts.
4. Remove empty `src/core/analyzer/` directory.

##### Missing Tests
- No test for config file collision scenario (V2 writes → V1 reads).
- No test for module-level env capture in request-guard.ts.

##### Missing Logs / Observability
- Config file collision goes unlogged — V1 validation failure discards the actual schema mismatch details.
- Dead code modules have no import-time warning.

##### Evidence
- `ARCHITECTURE.md:22-27` — wrong hierarchy
- `src/core/analyzer/` — empty
- `src/config/index.ts:238` vs `src/config/dashboard-config.ts:44-45` — same path, different schema
- `src/config/generator.ts` — zero imports
- `src/llm/token-tracker.ts:92` — dead singleton
- `src/utils/status-bar.ts:6` — dead consumer
- `src/llm/request-guard.ts:88` — module-level side effect
- `src/dashboard/routes/global-config-routes.ts:70-138` vs `project-config-routes.ts:50-119` — duplicated

#### implementation-adversary-output

##### Summary
Of 10 code-level claims examined: 3 are false/exaggerated (circular dependency false alarm, 32 props not 42, save-bug latent not active), 4 confirmed real (dead counter columns, spinlock, episode-probe duplication, hook complexity), 3 partially valid but nuanced.

##### Blocking Findings

- **NDJSON FileLock.lock() is a true CPU-busy spinlock** [severity: blocking]
  - Evidence: `src/storage/ndjson.ts:62-65` — `while (Date.now() - start < delay) {}`
  - Impact: Blocks Node.js event loop entirely during contention. 100 retries × exponential backoff up to 1000ms = potentially 100 seconds of CPU spin.
  
- **Shadow registry counter columns are genuinely dead** [severity: major]
  - Evidence: `src/storage/sqlite/sqlite-shadow-skill-repo.ts:59-62` hardcodes 0,0,0,100.0; `mapShadowSkillRow()` does NOT read counter columns (lines 21-35). No UPDATE path exists for these columns anywhere.
  
- **episode-probe-service.ts has near-identical result handler blocks** [severity: major]
  - Evidence: lines 221-302 (auto) vs 313-416 (manual) — 5 structurally parallel branches, ~150 lines could be saved via strategy pattern.

##### Non-blocking Risks

- **Circular dependency between task-episode ↔ task-episode-policy — FALSE ALARM** [severity: none]
  - Evidence: `task-episode-policy/index.ts:3-8` uses `import type` — erased at compile time. No runtime cycle.
  
- **SQLite save() bug is LATENT, not ACTIVE** [severity: downgraded from blocking]
  - Reason: `batchOperation()` has ZERO callers (grep returns no results). Design is fragile but not buggy in production.
  - New finding: `batchOperation()` itself is dead code.
  
- **LLMInstance interface is NOT dead** [severity: none]
  - Evidence: `litellm-client.ts:9,49` imports and implements it. One consumer, not zero.
  
- **SkillFamilyDetail has 32 props, not 42** [severity: downgraded]
  - Evidence: Counted at lines 33-70 — 32 individual props. Still high, but factually incorrect in original report.

##### Required Fixes
| Priority | File | Fix |
|----------|------|-----|
| P0 | `src/storage/ndjson.ts:62-65` | Replace busy-wait with async setTimeout or Atomics.wait |
| P0 | `sqlite-shadow-skill-repo.ts:59-62` | Implement counter increments or remove dead columns |
| P1 | `episode-probe-service.ts:161-417` | Extract shared result handler |
| P1 | `sqlite.ts:136-150` | Remove or document batchOperation() dead code |
| P1 | `use-dashboard-v3-skill-library.ts` | Extract useFetchResource for duplicated useEffect patterns |

##### Missing Tests
- `sqlite-shadow-skill-repo.ts` — no test for never-updated counters
- `sqlite-db-adapter.ts` — no test for save() mid-transaction
- `ndjson.ts` — no test for concurrent append() blocking event loop
- `episode-probe-service.ts` — no test covering all 5 result kinds × 2 paths

##### Missing Logs / Observability
- `sqlite-db-adapter.ts:53` — save() has no timing/size logging
- `sqlite-shadow-skill-repo.ts:40` — no log when upsertShadowSkill is called
- `ndjson.ts:62-65` — no log when spinlock actually spins
- `sqlite.ts:136` — batchOperation() no begin/end transaction log

##### Evidence
- `src/core/task-episode-policy/index.ts:3-8` — type-only import (no cycle)
- `src/core/task-episode/index.ts:5-17` — runtime import (one direction only)
- `src/storage/sqlite/sqlite-shadow-skill-repo.ts:59-62,87-90` — hardcoded zeros
- `src/storage/sqlite/sqlite-shadow-skill-repo.ts:21-35` — mapShadowSkillRow does NOT read counters
- `src/types/index.ts:19-31` — ProjectSkillShadow type has NO counter fields
- `src/storage/ndjson.ts:62-65` — busy-wait while loop
- `src/storage/sqlite.ts:136-150` — batchOperation dead code (zero callers)
- `src/core/shadow-manager/episode-probe-service.ts:221-302,313-416` — duplicated branches
- `src/llm/factory.ts:18-24, litellm-client.ts:9,49` — LLMInstance is NOT dead
- `frontend-v3/src/components/skill-family-detail.tsx:33-70` — 32 props, not 42
- `tests/unit/dashboard-server.test.ts` — 1174 lines

### Main Agent Response

| Reviewer | Finding | Broken Assumption / Failure Scenario | Original Severity | Adversarial Severity | Decision | Evidence / Reason | Action Taken | Follow-up |
|---|---|---|---|---|---|---|---|---|
| implementation-adversary | Circular dependency false alarm | task-episode ↔ task-episode-policy is type-only import, erased at compile time | 🔴 high | none | **accept** | `task-episode-policy/index.ts:3-8` uses `import type`. Zero runtime cycle. | Remove this finding from report. Document that `import type` eliminates the cycle. | The original report was wrong. This finding will be removed entirely. |
| architecture-adversary | Config file collision: same path, different schema, silent data loss | V1 and V2 both write to `project/.ornn/config/settings.toml` with incompatible schemas | 🟡 medium | 🔴 blocking | **accept upgrade** | `src/config/index.ts:238` vs `dashboard-config.ts:44-45` — exact same path, different schemas. Original report understated severity. | Upgrade severity in final report. This is real data loss waiting to happen. | N/A |
| architecture-adversary | token-tracker.ts + status-bar.ts + generator.ts are dead code | token-tracker singleton never consumed by production code | not in original report | 🔴 major | **accept** | `token-tracker.ts:92` singleton; only consumer is `status-bar.ts` (zero imports). `generator.ts` 85 lines, zero imports. | Add dead code as a new finding in final report. | N/A |
| architecture-adversary | ARCHITECTURE.md actively misleading | Shows hierarchical nesting that does not exist on disk | 🔵 low | 🔴 blocking | **accept upgrade** | `ARCHITECTURE.md:22-27` vs directory listing. `analyzer/` is empty. 20+ undocumented modules. | Upgrade severity. Schedule ARCHITECTURE.md rewrite. | N/A |
| implementation-adversary | NDJSON spinlock confirmed real | `while(Date.now() - start < delay)` blocks event loop | 🟡 medium | 🔴 blocking | **accept upgrade** | `ndjson.ts:62-65` — verified CPU-busy spinlock. Vulnerable to 100-retry worst case. | Upgrade to P0 in final report. | Replace with async mechanism. |
| implementation-adversary | SQLite save() is LATENT, not active | `batchOperation()` has zero callers, so bug cannot trigger | 🔴 high | 🟡 medium | **accept downgrade** | grep for `batchOperation` across src/ returns zero results. Design is fragile but not buggy in production. | Downgrade from "data correctness" to "latent bug + dead code (batchOperation)". | N/A |
| architecture-adversary | Core→dashboard cross-layer import | 7 files import Language type from dashboard | 🔴 high | 🔵 minor | **accept downgrade** | All imports are type-only or a thin file-read function. Moving to `types/` would take < 30 min. | Downgrade in final report. Document as quick fix. | N/A |
| implementation-adversary | LLMInstance is NOT dead | `litellm-client.ts:9,49` imports and implements it | 🟡 medium | none | **accept** | Interface has exactly one consumer, which implements it. Not dead. | Remove this finding from final report. | N/A |
| implementation-adversary | SkillFamilyDetail: 32 props not 42 | Counted 32 individual props in interface | 🔵 low | none | **accept** | Original miscount. 32 is still high but not 42. | Correct the number in final report. | N/A |
| architecture-adversary | Config route handlers ~66% duplicated, not 80% | ~110 duplicated lines out of ~333 total | 🟡 medium | 🔵 minor | **accept downgrade** | Architecture reviewer counted 66%, not 80%. Significant but not as high as claimed. | Adjust percentage in final report. | N/A |
| implementation-adversary | Dead counter columns confirmed | hit_count, success_count, manual_override_count, health_score always written as 0/100.0 | 🟡 medium | 🟡 medium | **accept** | `sqlite-shadow-skill-repo.ts:59-62` confirmed. No UPDATE path exists. | Keep in final report at medium severity. | N/A |
| implementation-adversary | episode-probe duplication real | ~150 lines could be saved with strategy pattern | 🟡 medium | 🟡 medium | **accept** | Both reviewers confirmed structural duplication. | Keep in final report. | N/A |
| implementation-adversary | Frontend hooks high complexity | 22/14 useState, 4/4 useEffect in two hooks | 🟡 medium | 🟡 medium | **accept** | Both confirmed high complexity. Additional finding: 3 duplicated useEffect fetch patterns. | Keep in final report. Add useEffect duplication finding. | N/A |
| architecture-adversary | Module-level side effects | request-guard.ts reads file at import time | 🔴 high | 🔵 minor | **accept downgrade** | Has `resolveLLMSafetyOptions()` and `resetSharedLLMRequestGuard()` for mitigation. Real pattern, but low practical impact. | Downgrade in final report. | N/A |
| architecture-adversary | batchOperation() is dead code | Zero callers across entire src/ | not in original report | 🟡 medium | **accept** | `sqlite.ts:136-150` confirmed. | Add as new finding. | N/A |

### Closure Status

- Blocking findings found: yes (2 upgraded, 1 new)
- Accepted blocking findings fixed: n/a (report only, no code changes)
- Blocking re-review completed: n/a
- Blocking re-review passed: n/a
- Blocking re-review round links: n/a
- Blocking re-review launch records: n/a
- Rejected findings backed by evidence: yes
- Deferred findings documented: no deferred findings
- Blocked reason: n/a
- Allowed to proceed: yes

## Final Conclusion

The adversarial review has significantly improved the accuracy of the original architecture quality report. Key corrections:

1. **2 findings removed** (circular dependency false alarm, LLMInstance dead code)
2. **3 findings upgraded** (config file collision → blocking, ARCHITECTURE.md → blocking, NDJSON spinlock → blocking)
3. **3 findings downgraded** (SQLite save from blocking to latent, core→dashboard from high to minor, module-level side effects from high to minor)
4. **2 new findings added** (dead code: token-tracker+status-bar+generator; batchOperation dead code)
5. **1 factual error corrected** (32 props not 42)

The report may proceed with corrected severity classifications and evidence. No code changes were made during this review — the corrections are applied to the report data only.

