import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SkillDetailDialog } from '@/components/skill-detail-dialog'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'
import { storyProjectSkills } from '@/stories/dashboard-v3-fixtures'

const meta = {
  title: 'Dashboard V3/Overlay/SkillDetailDialog',
  component: SkillDetailDialog,
  tags: ['stable', 'pattern'],
  parameters: dashboardStoryParameters({
    layout: 'centered',
    width: '720px',
  }),
  args: {
    onOpenChange: fn(),
  },
} satisfies Meta<typeof SkillDetailDialog>

export default meta

type Story = StoryObj<typeof meta>

export const Open: Story = {
  args: {
    open: true,
    skill: storyProjectSkills[0],
  },
}

export const WithEvolution: Story = {
  args: {
    evolutionLifecycle: {
      summary: {
        activeEpisodes: 1,
        pendingProposals: 1,
        appliedRevisions: 0,
        failedRuns: 0,
        regressions: 0,
        verifiedImprovements: 0,
      },
      runs: [
        {
          runId: 'episode-1:systematic-debugging',
          episodeId: 'episode-1',
          skillId: storyProjectSkills[0].skillId,
          runtime: storyProjectSkills[0].runtime ?? 'codex',
          status: 'proposed',
          createdAt: '2026-05-13T00:00:00.000Z',
          updatedAt: '2026-05-13T00:03:00.000Z',
          proposal: {
            proposalId: 'proposal-1',
            changeType: 'tighten_trigger',
            reason: '缩窄触发条件，避免非调试任务误用。',
            confidence: 0.81,
            riskLevel: 'low',
            status: 'ready',
            evidence: ['trace-1', 'trace-2'],
          },
        },
      ],
    },
    open: true,
    skill: storyProjectSkills[0],
  },
}

export const Empty: Story = {
  args: {
    open: true,
    skill: null,
  },
}
