import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sources = {
  configGovernancePanel: readFileSync(
    new URL('../../frontend-v3/src/components/config-governance-panel.tsx', import.meta.url),
    'utf8',
  ),
  configProviderStack: readFileSync(
    new URL('../../frontend-v3/src/components/config-provider-stack.tsx', import.meta.url),
    'utf8',
  ),
  configWorkspace: readFileSync(
    new URL('../../frontend-v3/src/components/config-workspace.tsx', import.meta.url),
    'utf8',
  ),
  projectRail: readFileSync(
    new URL('../../frontend-v3/src/components/project-rail.tsx', import.meta.url),
    'utf8',
  ),
  projectWorkbench: readFileSync(
    new URL('../../frontend-v3/src/components/project-workbench.tsx', import.meta.url),
    'utf8',
  ),
  workspaceApp: readFileSync(
    new URL('../../frontend-v3/src/App.tsx', import.meta.url),
    'utf8',
  ),
}

describe('dashboard v3 shell cleanup', () => {
  it('removes self-referential narration from non-skills workspaces', () => {
    const combinedSource = Object.values(sources).join('\n')

    expect(combinedSource).not.toContain('切换当前工作上下文')
    expect(combinedSource).not.toContain('围绕单个项目看监控状态')
    expect(combinedSource).not.toContain('保留项目视角，只展示这个项目自己的')
    expect(combinedSource).not.toContain('按照最近 trace 时间倒序查看原始活动')
    expect(combinedSource).not.toContain('聚合 decision event，方便判断哪里需要继续跟踪')
    expect(combinedSource).not.toContain('帮助快速判断当前窗口偏向哪类行为')
    expect(combinedSource).not.toContain('这页只负责全局配置')
    expect(combinedSource).not.toContain('把默认 provider、模型和密钥都集中放在一个工作面里管理')
    expect(combinedSource).not.toContain('把运行策略、安全阈值和日志级别放在统一治理面板里')
    expect(combinedSource).not.toContain('内置 prompt 仍然是默认路径')
  })

  it('does not expose a generic reload action in config', () => {
    expect(sources.configWorkspace).not.toContain('重新加载')
    expect(sources.configWorkspace).not.toContain('ArrowReloadHorizontalIcon')
  })

  it('keeps stable rail scrolling in the remaining long-running navigation list', () => {
    expect(sources.projectRail).toContain('ScrollArea')
  })
})
