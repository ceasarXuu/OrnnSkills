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
  storySkillVersions,
} from '@/stories/dashboard-v3-fixtures'
import type { DashboardSkillInstance, SkillDomainRuntime } from '@/types/dashboard'

type SkillFamilyDetailStoryArgs = ComponentProps<typeof SkillFamilyDetail> & {
  instances: DashboardSkillInstance[]
}

function InteractiveSkillFamilyDetail(args: SkillFamilyDetailStoryArgs) {
  const { instances, ...componentArgs } = args
  const [draftContent, setDraftContent] = useState(args.draftContent)
  const [preferredProjectPath, setPreferredProjectPath] = useState(args.preferredProjectPath)
  const [preferredRuntime, setPreferredRuntime] = useState<SkillDomainRuntime>(args.preferredRuntime)
  const [diffVersion, setDiffVersion] = useState<number | null>(args.diffVersion)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(args.selectedVersion)

  const selectedInstance = useMemo(() => {
    return (
      instances.find((instance) => {
        return instance.projectPath === preferredProjectPath && instance.runtime === preferredRuntime
      }) ?? null
    )
  }, [instances, preferredProjectPath, preferredRuntime])

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
      onSelectDiffVersion={(version) => {
        setDiffVersion(version)
        args.onSelectDiffVersion(version)
      }}
      onSelectVersion={(version) => {
        setSelectedVersion(version)
        args.onSelectVersion(version)
      }}
      onSwitchRuntime={(runtime) => {
        setPreferredRuntime(runtime)
        args.onSwitchRuntime(runtime)
      }}
      preferredProjectPath={preferredProjectPath}
      preferredRuntime={preferredRuntime}
      diffVersion={diffVersion}
      selectedInstance={selectedInstance}
      selectedVersion={selectedVersion}
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
    applyPreview: null,
    detail: storySkillDetail,
    detailError: null,
    diffContent: null,
    diffVersion: null,
    draftContent: storySkillDetail.content,
    family: storySkillFamilies[0],
    instances: storySkillInstances,
    isApplying: false,
    isCheckingMarketplace: false,
    isLoading: false,
    isSaving: false,
    marketplaceReview: null,
    onApplyMarketplaceChanges: fn(),
    onApplyToFamily: fn(),
    onCheckMarketplace: fn(),
    onCloseApplyPreview: fn(),
    onCloseMarketplaceReview: fn(),
    onDraftChange: fn(),
    onLoadApplyPreview: fn(),
    onPreferredProjectChange: fn(),
    onSave: fn(),
    onSelectDiffVersion: fn(),
    onSelectVersion: fn(),
    onSwitchRuntime: fn(),
    onToggleVersionDisabled: fn(),
    preferredProjectPath: storyProjects[0].path,
    preferredRuntime: 'claude',
    projects: storyProjects,
    selectedInstance: storySkillInstances[0],
    selectedVersion: 6,
    versionMetadataByNumber: storySkillVersions,
  },
} satisfies Meta<SkillFamilyDetailStoryArgs>

export default meta

type Story = StoryObj<SkillFamilyDetailStoryArgs>

export const Default: Story = {
  render: (args) => <InteractiveSkillFamilyDetail {...args} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText('astartes-coding-custodes')).toBeInTheDocument()
    await expect(canvas.queryByText('/Users/xuzhang/OrnnSkills · claude')).not.toBeInTheDocument()
    await expect(canvas.getByRole('combobox', { name: '选择优先项目' })).toBeInTheDocument()
    await expect(canvas.getByRole('combobox', { name: '切换 runtime' })).toBeInTheDocument()
    await expect(canvas.getByRole('combobox', { name: '选择查看版本' })).toBeInTheDocument()
    await expect(canvas.getByRole('combobox', { name: '选择对比版本' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: '预览传播' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: '保存正文' })).toBeInTheDocument()
  },
}

export const FilteredBySelectors: Story = {
  render: (args) => <InteractiveSkillFamilyDetail {...args} />,
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const documentScope = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByRole('combobox', { name: '选择优先项目' }))
    await userEvent.click(documentScope.getByRole('option', { name: 'mili' }))
    await expect(args.onPreferredProjectChange).toHaveBeenCalledWith(storyProjects[1].path)

    await userEvent.click(canvas.getByRole('combobox', { name: '切换 runtime' }))
    await userEvent.click(documentScope.getByRole('option', { name: 'codex' }))
    await expect(args.onSwitchRuntime).toHaveBeenCalledWith('codex')

    await expect(canvas.getByRole('combobox', { name: '选择优先项目' })).toHaveTextContent('mili')
    await expect(canvas.getByRole('combobox', { name: '切换 runtime' })).toHaveTextContent('codex')
  },
}

export const VersionDiff: Story = {
  args: {
    diffContent:
      '---\nname: astartes-coding-custodes\n---\n\n# Astartes Coding Custodes\n\nKeep implementation staged.',
    diffVersion: 5,
  },
  render: (args) => <InteractiveSkillFamilyDetail {...args} />,
}

export const EmptySelection: Story = {
  args: {
    actionMessage: null,
    applyPreview: null,
    detail: null,
    detailError: null,
    diffContent: null,
    diffVersion: null,
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
    selectedVersion: null,
    versionMetadataByNumber: {},
  },
  render: (args) => <InteractiveSkillFamilyDetail {...args} />,
}

export const Loading: Story = {
  args: {
    applyPreview: null,
    detail: null,
    diffContent: null,
    diffVersion: null,
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
    selectedVersion: null,
    versionMetadataByNumber: {},
  },
  render: (args) => <InteractiveSkillFamilyDetail {...args} />,
}
