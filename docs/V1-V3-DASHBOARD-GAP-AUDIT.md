# V1 vs V3 Dashboard Gap Audit

Status note: this audit targets the now-retired `frontend-v3/` React rewrite attempt. Current runtime `/v3` has already been pulled back to the real v1 dashboard shell for strict parity, so the findings below are historical evidence for why that rollback was necessary.

Purpose: extract the real V1 dashboard contract from code, then compare it against the current V3 implementation.

Scope of truth:
- V1 shell and IA: `src/dashboard/web/main-panel/source.ts`, `src/dashboard/web/state.ts`
- V1 skills workspace: `src/dashboard/web/skills/source.ts`
- V1 project/config subpanels: `src/dashboard/web/panels/*.ts`, `src/dashboard/web/config/subtabs.ts`
- V1 backend routes: `src/dashboard/routes/project-skill-routes.ts`, `src/dashboard/routes/project-skill-instance-routes.ts`, `src/dashboard/routes/project-version-routes.ts`, `src/dashboard/routes/skill-family-routes.ts`
- Domain model: `src/types/skill-domain.ts`, `src/core/skill-domain/projector.ts`
- Current V3: `frontend-v3/src/App.tsx`, `frontend-v3/src/types/dashboard.ts`, `frontend-v3/src/components/*.tsx`, `frontend-v3/src/lib/dashboard-api.ts`

## 1. V1 Real Information Architecture

### 1.1 V1 top-level tabs

V1 main tabs are:
- `skills`
- `project`
- `config`

Evidence:
- `normalizeMainTab()` only normalizes to `skills | project | config`: `src/dashboard/web/main-panel/source.ts:2-7`
- `renderWorkspaceTabs()` only renders those three tabs: `src/dashboard/web/main-panel/source.ts:38-47`
- `renderMainPanel()` only switches between those three workspaces: `src/dashboard/web/main-panel/source.ts:262-343`

This means:
- V1 does **not** have a standalone `projects` page
- V1 does **not** have a standalone `activity` page
- `activity / cost / logs / overview` are folded into the `project` workspace, not split into top-level tabs

### 1.2 V1 skills workspace is skill-first, not project-first

V1 `skills` tab is a global skill library:
- loads cross-project `Skill Family` data from `/api/skills/families`
- shows family list on the left
- shows selected family detail on the right
- resolves a concrete `Skill Instance` inside the family
- opens the instance content, version history, runtime switch, and edit actions inline

Evidence:
- skill library active state: `src/dashboard/web/skills/source.ts:159-165`
- family list source: `src/dashboard/web/skills/source.ts:222-245`, `src/dashboard/web/skills/source.ts:531-567`
- family detail + inline editor layout: `src/dashboard/web/skills/source.ts:407-499`
- family detail fetches:
  - `/api/skills/families/:familyId`: `src/dashboard/web/skills/source.ts:581-585`
  - `/api/skills/families/:familyId/instances`: `src/dashboard/web/skills/source.ts:581-585`

### 1.3 V1 project workspace is project-first, but still skill-aware

V1 `project` tab is not a simple project status page. It is a project workbench composed from:
- project-local grouped skill workbench
- overview metrics
- activity panel
- cost panel
- logs panel

Evidence:
- project workbench composition: `src/dashboard/web/main-panel/source.ts:140-196`
- project tab render path: `src/dashboard/web/main-panel/source.ts:304-318`

This means the project view must still expose skills, not drop them.

### 1.4 V1 config workspace stays inside the selected project context

V1 `config` tab:
- requires selected project context in the workspace shell
- renders provider alerts
- has `model` and `evolution` subtabs

Evidence:
- config page render path: `src/dashboard/web/main-panel/source.ts:253-259`, `src/dashboard/web/main-panel/source.ts:319-341`
- config subtabs and autosave boundary rules: `src/dashboard/web/config/subtabs.ts:1-127`

## 2. V1 Core Data Model

V1 is already using the V2-oriented three-layer model.

### 2.1 Skill Family

Fields include:
- `familyId`
- `familyName`
- `projectCount`
- `instanceCount`
- `runtimeCount`
- `revisionCount`
- `projectPaths`
- `runtimes`
- `installedAt / firstSeenAt / lastSeenAt / lastUsedAt`
- `status`
- `identityMethod / identityConfidence`
- `hasDivergedContent`
- `usage`

Evidence: `src/types/skill-domain.ts:104-124`

### 2.2 Skill Instance

Fields include:
- `instanceId`
- `familyId / familyName`
- `projectPath`
- `skillId`
- `runtime`
- `installPath / shadowPath`
- `status`
- `createdAt / updatedAt / installedAt / firstSeenAt / lastSeenAt / lastUsedAt`
- `effectiveVersion`
- `effectiveRevisionId`
- `versionCount`
- `contentDigest`
- `usage`

Evidence: `src/types/skill-domain.ts:63-87`

### 2.3 Skill Revision

Fields include:
- `revisionId`
- `instanceId`
- `familyId`
- `projectPath`
- `skillId`
- `runtime`
- `version`
- `previousVersion`
- `createdAt`
- `reason`
- `traceIds`
- `isDisabled`
- `isEffective`
- `contentDigest`

Evidence: `src/types/skill-domain.ts:44-61`

### 2.4 Project projection

Per-project domain projection includes:
- `families`
- `skillGroups`
- `instances`
- `revisions`
- `identityLinks`
- `usageFacts`

Evidence:
- `ProjectSkillDomainProjection`: `src/types/skill-domain.ts:126-137`
- projection builder: `src/core/skill-domain/projector.ts:34-84`

## 3. V1 Skills Workspace Contract

V1 `skills` page has these core modules and interactions:

1. family list
2. family search
3. family sort
4. runtime filter tab
5. family summary card
6. instance strip within selected family
7. runtime switch for the selected family/instance
8. inline skill content editor
9. save current skill
10. version history list
11. load a specific version into the editor
12. invalidate / restore a version
13. apply-preview before bulk propagation
14. apply current instance to the whole family
15. jump from project context into the family view
16. preserve inline draft during rerender / bootstrap refresh

Evidence:
- list and filters: `src/dashboard/web/skills/source.ts:645-756`
- family card: `src/dashboard/web/skills/source.ts:374-405`
- inline detail shell: `src/dashboard/web/skills/source.ts:407-499`
- draft preservation and surface sync: `src/dashboard/web/skills/source.ts:905-955`
- skill load: `src/dashboard/web/skills/source.ts:1027-1124`
- runtime switch: `src/dashboard/web/skills/source.ts:1126-1172`
- version history and version actions: `src/dashboard/web/skills/source.ts:870-903`, `src/dashboard/web/skills/source.ts:1174-1298`
- apply preview and apply to family: `src/dashboard/web/skills/source.ts:1300-1544`

Supporting backend routes:
- list/read/save project skill: `src/dashboard/routes/project-skill-routes.ts:53-141`
- bulk apply same-named skill: `src/dashboard/routes/project-skill-routes.ts:143-265`
- list skill instances and apply-to-family: `src/dashboard/routes/project-skill-instance-routes.ts:37-101`
- read/save instance and instance version state: `src/dashboard/routes/project-skill-instance-routes.ts:103-205`
- read/toggle plain skill versions: `src/dashboard/routes/project-version-routes.ts:20-80`
- family aggregate routes: `src/dashboard/routes/skill-family-routes.ts:37-64`

## 4. V1 Project Workspace Contract

V1 `project` page contains these major modules:

1. project sidebar with selection
2. pause/resume monitoring action per project
3. project-local grouped skill workbench
4. skill modal entry from project skills
5. family jump from project-selected skill
6. overview metrics and daemon status
7. decision summary blocks
8. activity panel with `business / raw` switch
9. cost panel
10. logs panel

Evidence:
- project sidebar + monitoring mutation: `src/dashboard/web/sidebar/source.ts:1-112`
- grouped skill list on project page: `src/dashboard/web/main-panel/source.ts:140-153`
- overview panel: `src/dashboard/web/panels/overview-panel.ts:83-245`
- activity panel: `src/dashboard/web/panels/activity-panel.ts:19-45`
- logs panel: `src/dashboard/web/panels/logs-panel.ts:8-24`
- project page composition: `src/dashboard/web/main-panel/source.ts:140-196`

## 5. V1 Config Workspace Contract

V1 `config` page contains these major modules:

1. provider warning banner in workspace
2. `model` subtab
3. `evolution` subtab
4. provider rows editor
5. connectivity checks/results
6. LLM safety controls
7. prompt source toggle: built-in vs custom
8. prompt override editors
9. autosave / save hint behavior across subtab switches

Evidence:
- config page shell: `src/dashboard/web/main-panel/source.ts:253-259`
- config subtabs behavior: `src/dashboard/web/config/subtabs.ts:1-127`
- config panel rendering: `src/dashboard/web/panels/config-panel.ts:111-256`

## 6. Current V3 Contract

Current V3 top-level pages are:
- `skills`
- `projects`
- `activity`
- `config`

Evidence:
- route enum: `frontend-v3/src/types/dashboard.ts:3`
- router: `frontend-v3/src/App.tsx:24-40`

Current V3 data model is flattened to project snapshot reads:
- projects list from `/api/projects`
- selected project snapshot from `/api/projects/:projectPath/snapshot`
- config reads from `/api/config`

Evidence:
- API surface: `frontend-v3/src/lib/dashboard-api.ts:84-121`
- workspace state always picks one selected project and one selected snapshot: `frontend-v3/src/features/dashboard/use-dashboard-v3-workspace.ts:24-156`
- skills view reads `snapshot?.skills ?? []`: `frontend-v3/src/components/skills-workspace.tsx:33-34`
- top-level filtering also reads `selectedSnapshot?.skills ?? []`: `frontend-v3/src/App.tsx:74-86`

Current V3 skill detail is only a read-only dialog with:
- runtime
- status
- revision count
- effective version
- trace count
- update time

Evidence: `frontend-v3/src/components/skill-detail-dialog.tsx:21-57`

## 7. V3 Gap Matrix

### 7.1 Skills page

V1 contract:
- global skill-family workspace
- family list on the left
- instance resolution inside family
- inline editor
- version history
- version load / invalidate / restore
- apply-preview / apply-to-family

Current V3:
- source is `selectedSnapshot.skills`
- left side is still project scope selector
- center is a flat per-project skill table
- detail is read-only dialog

Result:
- wrong primary object
- wrong source of truth
- wrong left rail semantics
- missing all edit/history/revision/family actions

Rough module count:
- V1 core modules: 16
- V3 preserved materially: 3 (`search`, `table`, `basic read-only detail`)
- missing or wrong: at least 13

Key regressions:
- V3 dropped `Skill Family` as the main list unit
- V3 dropped `Skill Instance` selection inside family
- V3 dropped `Skill Revision` workflow entirely

### 7.2 Project page

V1 contract:
- project view is a full project workbench and still exposes skills
- activity/cost/logs stay inside the project workspace

Current V3:
- `projects` page is mostly a slim status panel
- it does not carry the project-local skill workbench
- it does not carry cost/logs
- activity was split into another top-level page

Result:
- project view lost the skill workbench entirely
- project view lost operational depth
- IA is no longer aligned with V1

Rough module count:
- V1 core modules: 10
- V3 preserved materially: 2 to 3
- missing or wrong: at least 7

### 7.3 Activity page

V1 contract:
- activity is a module inside project workspace
- supports `business / raw` switch
- raw view shows runtime/status bars and recent traces table

Current V3:
- activity is promoted to its own top-level page
- shows two paged card streams only
- no `business / raw` switch
- no trace distribution bars
- no raw trace table surface equivalent

Result:
- this is not a preservation of V1
- this is a new page with a reduced subset of V1 activity data

### 7.4 Config page

V1 contract:
- two subtabs: `model` and `evolution`
- provider rows, connectivity, LLM safety, prompt-source editors
- project-context shell behavior

Current V3:
- keeps provider and governance editing
- but flattens the IA into one workspace
- loses V1 subtab structure and V1 autosave boundary behavior

Result:
- config is the least regressed page
- but it is still not a faithful carry-over of V1 interaction design

## 8. Root Cause

The main failure is not styling. It is contract drift.

V1 contract:
- `skills` page == global skill library, family-first
- `project` page == project workbench, still skill-aware
- object model == `Skill Family -> Skill Instance -> Skill Revision`

Current V3 contract:
- `skills` page == selected-project snapshot skill table
- `projects` page == stripped project status view
- object model == flattened `snapshot.skills[]`

That is why V3 feels "completely wrong": it is built on the wrong information model, not just the wrong layout.

## 9. What Must Change Before More UI Polish

1. Restore V1 information architecture before visual work:
   - `skills`
   - `project`
   - `config`

2. Restore the object model in V3 types and API layer:
   - `SkillFamily`
   - `SkillInstance`
   - `SkillRevision`

3. Rebuild `skills` page around:
   - family list
   - family detail
   - instance strip
   - content editor
   - revision history/actions

4. Rebuild `project` page around:
   - project-local skill workbench
   - overview
   - activity
   - cost
   - logs

5. Only after the above, revisit visual structure and shadcn composition.

## 10. Immediate Correction Direction

If V3 continues, the next step should not be another visual patch.

The next step should be:
- change V3 route contract from `skills/projects/activity/config` to `skills/project/config`
- add family/instance/revision types and API clients first
- then rebuild the `skills` workspace from V1 behavior upward
