import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const projectRailSource = readFileSync(
  new URL('../../frontend-v3/src/components/project-rail.tsx', import.meta.url),
  'utf8',
)

describe('dashboard v3 project rail contract', () => {
  it('uses the same shell form as the skills library list', () => {
    expect(projectRailSource).toContain("Card className=\"border-border/70 bg-card/92\"")
    expect(projectRailSource).toContain("CardHeader className=\"gap-4 border-b border-border/70\"")
    expect(projectRailSource).toContain('<CardTitle className="text-xl">项目</CardTitle>')
    expect(projectRailSource).toContain('formatCompactNumber(projects.length)')
    expect(projectRailSource).toContain('ScrollArea className="h-[min(72vh,920px)]"')
    expect(projectRailSource).toContain('className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${')
  })

  it('does not render each project row as a nested Card anymore', () => {
    expect(projectRailSource).not.toContain('<Card\n')
    expect(projectRailSource).not.toContain('<CardDescription')
    expect(projectRailSource).not.toContain('size="sm"')
  })
})
