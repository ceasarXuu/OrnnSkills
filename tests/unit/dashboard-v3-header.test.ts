import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspaceHeaderSource = readFileSync(
  new URL('../../frontend-v3/src/components/workspace-header.tsx', import.meta.url),
  'utf8',
)

describe('dashboard v3 workspace header', () => {
  it('does not expose a manual refresh command in the global header', () => {
    expect(workspaceHeaderSource).not.toContain('刷新快照')
    expect(workspaceHeaderSource).not.toContain('RefreshIcon')
  })

  it('does not expose runtime status badges in the global header', () => {
    expect(workspaceHeaderSource).not.toContain('SSE 已连接')
    expect(workspaceHeaderSource).not.toContain('SSE 重连中')
    expect(workspaceHeaderSource).not.toContain('SSE 失败')
    expect(workspaceHeaderSource).not.toContain('Projects')
    expect(workspaceHeaderSource).not.toContain('formatRelativeTime')
    expect(workspaceHeaderSource).not.toContain('getConnectionBadgeVariant')
  })
})
