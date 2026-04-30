import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, fn } from 'storybook/test'
import { SkillMarketplaceReview } from '@/components/skill-marketplace-review'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'
import { storySkillDetail } from '@/stories/dashboard-v3-fixtures'

const marketplaceContent =
  '---\nname: astartes-coding-custodes\ndescription: Use this skill when iterative AI-assisted coding starts to degrade code quality or maintainability.\n---\n\n# Astartes Coding Custodes\n\nKeep implementation staged, scoped, and reviewable.\n\n## New Section\n\nThis is a new section added in the marketplace version.'

const marketplaceSource = {
  repo: 'vercel-labs/agent-skills',
  skill: 'astartes-coding-custodes',
  url: 'https://github.com/vercel-labs/agent-skills/tree/HEAD/skills/astartes-coding-custodes',
}

type SkillMarketplaceReviewStoryArgs = ComponentProps<typeof SkillMarketplaceReview>

function InteractiveSkillMarketplaceReview(args: SkillMarketplaceReviewStoryArgs) {
  const [localContent, setLocalContent] = useState(args.localContent)

  return (
    <SkillMarketplaceReview
      {...args}
      localContent={localContent}
      onApply={(mergedContent) => {
        setLocalContent(mergedContent)
        args.onApply(mergedContent)
      }}
    />
  )
}

const meta = {
  title: 'Dashboard V3/Skills/SkillMarketplaceReview',
  component: SkillMarketplaceReview,
  tags: ['stable', 'pattern'],
  parameters: dashboardStoryParameters({
    width: '960px',
  }),
  args: {
    localContent: storySkillDetail.content,
    marketplaceContent,
    onCancel: fn(),
    onApply: fn(),
    source: marketplaceSource,
  },
} satisfies Meta<SkillMarketplaceReviewStoryArgs>

export default meta

type Story = StoryObj<SkillMarketplaceReviewStoryArgs>

export const Default: Story = {
  render: (args) => <InteractiveSkillMarketplaceReview {...args} />,
  play: async ({ canvas }) => {
    // Header
    await expect(canvas.getByText('市场版本审阅')).toBeInTheDocument()
    await expect(canvas.getByText(/vercel-labs\/agent-skills/)).toBeInTheDocument()

    // Batch buttons
    await expect(canvas.getByRole('button', { name: '全部接受' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: '全部拒绝' })).toBeInTheDocument()

    // Footer
    await expect(canvas.getByRole('button', { name: '取消' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: '应用到草稿' })).toBeInTheDocument()

    // Each change group shows both buttons; initially none is highlighted
    const acceptButtons = canvas.getAllByRole('button', { name: '接受' })
    const rejectButtons = canvas.getAllByRole('button', { name: '拒绝' })
    await expect(acceptButtons.length).toBeGreaterThan(0)
    await expect(acceptButtons.length).toBe(rejectButtons.length)
  },
}

export const AcceptOneGroup: Story = {
  render: (args) => <InteractiveSkillMarketplaceReview {...args} />,
  play: async ({ canvas }) => {
    // Click the first "接受" button
    const acceptButtons = canvas.getAllByRole('button', { name: '接受' })
    await acceptButtons[0].click()

    // Counter should show 1 decided
    await expect(canvas.getByText(/1\//)).toBeInTheDocument()
  },
}

export const AcceptAll: Story = {
  render: (args) => <InteractiveSkillMarketplaceReview {...args} />,
  play: async ({ canvas }) => {
    await canvas.getByRole('button', { name: '全部接受' }).click()

    // All groups decided
    const totalGroups = canvas.getAllByRole('button', { name: '接受' }).length
    await expect(canvas.getByText(new RegExp(`${totalGroups}/`))).toBeInTheDocument()
  },
}

export const NoChanges: Story = {
  args: {
    marketplaceContent: storySkillDetail.content,
  },
  render: (args) => <InteractiveSkillMarketplaceReview {...args} />,
  play: async ({ canvas }) => {
    // Full diff container renders (all context rows)
    await expect(canvas.getByLabelText('Marketplace skill diff')).toBeInTheDocument()
    // No change groups — no per-group buttons
    const acceptButtons = canvas.queryAllByRole('button', { name: '接受' })
    await expect(acceptButtons).toHaveLength(0)
  },
}
