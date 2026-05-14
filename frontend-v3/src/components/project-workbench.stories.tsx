import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { ProjectWorkbench } from '@/components/project-workbench'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'
import {
  storyAgentUsage,
  storyProjectSkills,
  storyProjects,
  storyProviderCatalog,
} from '@/stories/dashboard-v3-fixtures'

const meta = {
  title: 'Dashboard V3/Project/ProjectWorkbench',
  component: ProjectWorkbench,
  tags: ['stable', 'screen'],
  parameters: dashboardStoryParameters({
    width: '1180px',
  }),
  args: {
    agentUsage: storyAgentUsage,
    catalogError: null,
    evolutionLifecycle: {
      summary: {
        activeEpisodes: 4,
        pendingProposals: 2,
        appliedRevisions: 3,
        failedRuns: 1,
        regressions: 1,
        verifiedImprovements: 1,
      },
      runs: [
        {
          runId: 'episode-1:systematic-debugging',
          episodeId: 'episode-1',
          skillId: 'systematic-debugging',
          runtime: 'codex',
          status: 'proposed',
          createdAt: '2026-05-13T00:00:00.000Z',
          updatedAt: '2026-05-13T00:04:00.000Z',
          proposal: {
            proposalId: 'proposal-1',
            changeType: 'tighten_trigger',
            reason: '缩窄触发条件，避免部署任务误用调试技能。',
            confidence: 0.82,
            riskLevel: 'low',
            status: 'ready',
            evidence: ['trace-1', 'trace-2'],
          },
        },
        {
          runId: 'episode-2:frontend-design',
          episodeId: 'episode-2',
          skillId: 'frontend-design',
          runtime: 'claude',
          status: 'applied',
          createdAt: '2026-05-13T00:00:00.000Z',
          updatedAt: '2026-05-13T00:08:00.000Z',
          application: {
            proposalId: 'proposal-2',
            appliedAt: '2026-05-13T00:07:00.000Z',
            revision: 3,
            previousRevision: 2,
          },
          verification: {
            verifiedAt: '2026-05-13T00:08:00.000Z',
            revision: 3,
            outcome: 'improved',
            reason: 'negative signals decreased by 4',
            evidence: ['after.failure=0'],
          },
        },
      ],
    },
    isCatalogLoading: false,
    isLoadingEvolution: false,
    isLoading: false,
    onQueryChange: fn(),
    onSelectSkill: fn(),
    projectName: storyProjects[0].name,
    projectPath: storyProjects[0].path,
    providerCatalog: storyProviderCatalog,
    query: '',
    selectedSkillKey: '',
    skills: storyProjectSkills,
  },
} satisfies Meta<typeof ProjectWorkbench>

export default meta

type Story = StoryObj<typeof meta>

export const SkillsDefault: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('tab', { name: '技能' })).toBeInTheDocument()
    await expect(canvas.getByText('技能列表')).toBeInTheDocument()
  },
}

export const CostSelected: Story = {
  args: {
    defaultTab: 'cost',
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('tab', { name: '成本' })).toBeInTheDocument()
    await expect(canvas.getByText('模型成本拆分')).toBeInTheDocument()
  },
}

export const CostEmpty: Story = {
  args: {
    agentUsage: null,
    defaultTab: 'cost',
  },
}

export const EvolutionSelected: Story = {
  args: {
    defaultTab: 'evolution',
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('tab', { name: '演化' })).toBeInTheDocument()
    await expect(canvas.getByText('演化运行')).toBeInTheDocument()
  },
}
