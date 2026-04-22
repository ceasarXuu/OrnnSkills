import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const appSource = readFileSync(
  new URL('../../frontend-v3/src/App.tsx', import.meta.url),
  'utf8',
)

const projectWorkbenchSource = readFileSync(
  new URL('../../frontend-v3/src/components/project-workbench.tsx', import.meta.url),
  'utf8',
)

const combinedSource = [appSource, projectWorkbenchSource].join('\n')

describe('dashboard v3 project workspace contract', () => {
  it('does not keep non-v1 project chrome in the project workspace', () => {
    expect(combinedSource).not.toContain('DashboardHero')
    expect(combinedSource).not.toContain('MetricGrid')
    expect(combinedSource).not.toContain('ProjectStatusPanel')
    expect(combinedSource).not.toContain('InsightStack')
    expect(combinedSource).not.toContain('ActivityStream')
  })

  it('does not expose non-v1 project card titles', () => {
    expect(combinedSource).not.toContain('运行摘要')
    expect(combinedSource).not.toContain('项目运行状态')
    expect(combinedSource).not.toContain('Runtime 分布')
    expect(combinedSource).not.toContain('Snapshot 新鲜度')
    expect(combinedSource).not.toContain('模型用量')
    expect(combinedSource).not.toContain('高频技能')
    expect(combinedSource).not.toContain('事件分布')
    expect(combinedSource).not.toContain('当前优化状态')
    expect(combinedSource).not.toContain('待处理队列')
    expect(combinedSource).not.toContain('已处理 traces')
    expect(combinedSource).not.toContain('Recent Traces')
    expect(combinedSource).not.toContain('Decision Events')
  })
})
