import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState, type ComponentProps } from 'react'
import { expect, fn, within } from 'storybook/test'
import { SkillFamilyDetail } from '@/components/skill-family-detail'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'
import {
  storyProjects,
  storySkillDetail,
  storySkillFamilies,
  storySkillInstances,
} from '@/stories/dashboard-v3-fixtures'
import type { DashboardSkillInstance } from '@/types/dashboard'

type SkillFamilyDetailStoryArgs = ComponentProps<typeof SkillFamilyDetail> & {
  instances: DashboardSkillInstance[]
}

function InteractiveSkillFamilyDetail(args: SkillFamilyDetailStoryArgs) {
  const { instances, ...componentArgs } = args
  const [draftContent, setDraftContent] = useState(args.draftContent)
  const [preferredProjectPath, setPreferredProjectPath] = useState(args.preferredProjectPath)

  const selectedInstance = useMemo(() => {
    return instances.find((instance) => instance.projectPath === preferredProjectPath) ?? null
  }, [instances, preferredProjectPath])

  return (
    <SkillFamilyDetail
      {...componentArgs}
      draftContent={draftContent}
      onDraftChange={(value) => {
        setDraftContent(value)
        args.onDraftChange(value)
      }}
      onPreferredProjectChange={(projectPath) => {
        setPreferredProjectPath(projectPath)
        args.onPreferredProjectChange(projectPath)
      }}
      preferredProjectPath={preferredProjectPath}
      selectedInstance={selectedInstance}
    />
  )
}

const meta = {
  title: 'Dashboard V3/Skills/SkillFamilyDetail',
  component: SkillFamilyDetail,
  tags: ['stable', 'screen'],
  parameters: dashboardStoryParameters({
    width: '1280px',
  }),
  args: {
    actionMessage: null,
    detailError: null,
    draftContent: storySkillDetail.content ?? '',
    family: storySkillFamilies[0],
    instances: storySkillInstances,
    isCheckingMarketplace: false,
    isLoading: false,
    isSaving: false,
    marketplaceReview: null,
    onApplyMarketplaceChanges: fn(),
    onCheckMarketplace: fn(),
    onCloseMarketplaceReview: fn(),
    onDraftChange: fn(),
    onPreferredProjectChange: fn(),
    onSave: fn(),
    preferredProjectPath: storyProjects[0].path,
    projects: storyProjects,
    selectedInstance: storySkillInstances[0],
  },
} satisfies Meta<SkillFamilyDetailStoryArgs>

export default meta

type Story = StoryObj<SkillFamilyDetailStoryArgs>

export const Default: Story = {
  render: (args) => <InteractiveSkillFamilyDetail {...args} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText('astartes-coding-custodes')).toBeInTheDocument()
    await expect(canvas.getByRole('combobox', { name: '选择优先项目' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: '保存正文' })).toBeInTheDocument()
    await expect(canvas.queryByRole('combobox', { name: '切换 runtime' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: '预览传播' })).not.toBeInTheDocument()
  },
}

export const FilteredBySelectors: Story = {
  render: (args) => <InteractiveSkillFamilyDetail {...args} />,
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const documentScope = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByRole('combobox', { name: '选择优先项目' }))
    await userEvent.click(documentScope.getByRole('option', { name: 'mili' }))
    await expect(args.onPreferredProjectChange).toHaveBeenCalledWith(storyProjects[1].path)

    await expect(canvas.getByRole('combobox', { name: '选择优先项目' })).toHaveTextContent('mili')
  },
}

export const EmptySelection: Story = {
  args: {
    actionMessage: null,
    detailError: null,
    draftContent: '',
    family: null,
    instances: [],
    isCheckingMarketplace: false,
    marketplaceReview: null,
    onApplyMarketplaceChanges: fn(),
    onCheckMarketplace: fn(),
    onCloseMarketplaceReview: fn(),
    preferredProjectPath: storyProjects[0].path,
    projects: storyProjects,
    selectedInstance: null,
  },
  render: (args) => <InteractiveSkillFamilyDetail {...args} />,
}

export const Loading: Story = {
  args: {
    actionMessage: null,
    detailError: null,
    draftContent: '',
    family: null,
    instances: [],
    isLoading: true,
    isCheckingMarketplace: false,
    marketplaceReview: null,
    onApplyMarketplaceChanges: fn(),
    onCheckMarketplace: fn(),
    onCloseMarketplaceReview: fn(),
    selectedInstance: null,
  },
  render: (args) => <InteractiveSkillFamilyDetail {...args} />,
}
