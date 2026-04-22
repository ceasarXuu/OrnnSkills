import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const files = [
  '../../frontend-v3/src/components/skills-hero-band.tsx',
  '../../frontend-v3/src/components/skills-scope-sidebar.tsx',
  '../../frontend-v3/src/components/skills-table.tsx',
  '../../frontend-v3/src/components/skills-insight-rail.tsx',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'))

const combinedSource = files.join('\n')

describe('dashboard v3 skills workspace copy', () => {
  it('does not ship self-referential layout narration', () => {
    expect(combinedSource).not.toContain('先看技能，再决定项目上下文要不要继续下钻')
    expect(combinedSource).not.toContain('这页应该先给你技能库、使用证据和问题分布')
    expect(combinedSource).not.toContain('项目在这里是过滤范围，不是这页的主叙事对象')
    expect(combinedSource).not.toContain('中央区域只负责技能表本身')
    expect(combinedSource).not.toContain('把右侧信息收成一个 rail')
  })
})
