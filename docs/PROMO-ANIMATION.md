# OrnnSkills Promotional Animation

This document records the reproducible Remotion workflow for the V2 promotional
animation.

## Source

- Remotion entrypoint: `remotion/index.ts`
- Composition id: `OrnnSkillsPromo`
- Rendered artifact: `artifacts/promo/ornnskills-v2-promo.mp4`
- Render script: `scripts/render-promo-animation.mjs`

## Commands

```bash
npm run remotion:studio
npm run render:promo
```

The render script writes command output to `logs/remotion-promo-render-*.log`.
The `logs/` directory is intentionally ignored by git, so the log is local
operational evidence rather than a committed artifact.

## Positioning Notes

The animation follows the V2.0 product direction in `docs/PRD.md`:

- open source and local-first
- skill as the first-class object
- cross-host visibility across Codex, Claude Code and OpenCode
- lifecycle management from scan to verification
- evidence-backed evolution rather than opaque automation

## Operational Notes

- Keep all Remotion packages on the same exact version to avoid bundle/runtime
  drift. Remotion 4.0.451 also expects the root `zod` package to resolve to
  `4.3.6`.
- Render from the repository root so the entrypoint and output paths resolve
  consistently.
- Run still checks and full renders serially in the same checkout. Parallel
  Remotion CLI runs can contend on the webpack cache even when the resulting
  still renders succeed.
- If rendering fails, inspect the newest `logs/remotion-promo-render-*.log`
  before changing the animation source.
