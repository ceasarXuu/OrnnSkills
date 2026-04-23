import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState, type ComponentProps } from 'react'
import { fn } from 'storybook/test'
import { SkillFamilyDetail } from '@/components/skill-family-detail'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'
import {
  storyApplyPreview,
  storyProjects,
  storySkillDetail,
  storySkillFamilies,
  storySkillInstances,
  storySkillVersions,
} from '@/stories/dashboard-v3-fixtures'
import type { SkillDomainRuntime } from '@/types/dashboard'

type SkillFamilyDetailStoryArgs = ComponentProps<typeof SkillFamilyDetail>

function InteractiveSkillFamilyDetail(args: SkillFamilyDetailStoryArgs) {
  const [draftContent, setDraftContent] = useState(args.draftContent)
  const [preferredProjectPath, setPreferredProjectPath] = useState(args.preferredProjectPath)
  const [preferredRuntime, setPreferredRuntime] = useState<SkillDomainRuntime>(args.preferredRuntime)
  const [selectedInstanceId, setSelectedInstanceId] = useState(args.selectedInstance?.instanceId ?? '')
  const [selectedVersion, setSelectedVersion] = useState<number | null>(args.selectedVersion)

  const selectedInstance = useMemo(() => {
    if (!selectedInstanceId) {
      return null
    }

    return args.instances.find((instance) => instance.instanceId === selectedInstanceId) ?? null
  }, [args.instances, selectedInstanceId])

  return (
    <SkillFamilyDetail
      {...args}
      draftContent={draftContent}
      onDraftChange={(value) => {
        setDraftContent(value)
        args.onDraftChange(value)
      }}
      onPreferredProjectChange={(projectPath) => {
        setPreferredProjectPath(projectPath)
        args.onPreferredProjectChange(projectPath)
      }}
      onSelectInstance={(instanceId) => {
        setSelectedInstanceId(instanceId)
        args.onSelectInstance(instanceId)
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
    applyPreview: storyApplyPreview,
    detail: storySkillDetail,
    detailError: null,
    draftContent: storySkillDetail.content,
    family: storySkillFamilies[0],
    instances: storySkillInstances,
    isApplying: false,
    isLoading: false,
    isSaving: false,
    onApplyToFamily: fn(),
    onDraftChange: fn(),
    onLoadApplyPreview: fn(),
    onPreferredProjectChange: fn(),
    onSave: fn(),
    onSelectInstance: fn(),
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
} satisfies Meta<typeof SkillFamilyDetail>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => <InteractiveSkillFamilyDetail {...args} />,
}

export const EmptySelection: Story = {
  args: {
    actionMessage: null,
    applyPreview: null,
    detail: null,
    detailError: null,
    draftContent: '',
    family: null,
    instances: [],
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
    draftContent: '',
    family: null,
    instances: [],
    isLoading: true,
    selectedInstance: null,
    selectedVersion: null,
    versionMetadataByNumber: {},
  },
  render: (args) => <InteractiveSkillFamilyDetail {...args} />,
}
