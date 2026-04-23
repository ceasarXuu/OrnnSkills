import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { SkillFamilyDetail } from '@/components/skill-family-detail'
import {
  storyApplyPreview,
  storyProjects,
  storySkillDetail,
  storySkillFamilies,
  storySkillInstances,
  storySkillVersions,
} from '@/stories/dashboard-v3-fixtures'
import type { SkillDomainRuntime } from '@/types/dashboard'

function InteractiveSkillFamilyDetail() {
  const [draftContent, setDraftContent] = useState(storySkillDetail.content)
  const [preferredProjectPath, setPreferredProjectPath] = useState(storyProjects[0].path)
  const [preferredRuntime, setPreferredRuntime] = useState<SkillDomainRuntime>('claude')
  const [selectedInstanceId, setSelectedInstanceId] = useState(storySkillInstances[0].instanceId)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(6)
  const selectedInstance =
    storySkillInstances.find((instance) => instance.instanceId === selectedInstanceId) ??
    storySkillInstances[0]

  return (
    <SkillFamilyDetail
      actionMessage="已自动保存草稿。"
      applyPreview={storyApplyPreview}
      detail={storySkillDetail}
      detailError={null}
      draftContent={draftContent}
      family={storySkillFamilies[0]}
      instances={storySkillInstances}
      isApplying={false}
      isLoading={false}
      isSaving={false}
      onApplyToFamily={() => undefined}
      onDraftChange={setDraftContent}
      onLoadApplyPreview={() => undefined}
      onPreferredProjectChange={setPreferredProjectPath}
      onSave={() => undefined}
      onSelectInstance={setSelectedInstanceId}
      onSelectVersion={setSelectedVersion}
      onSwitchRuntime={setPreferredRuntime}
      onToggleVersionDisabled={() => undefined}
      preferredProjectPath={preferredProjectPath}
      preferredRuntime={preferredRuntime}
      projects={storyProjects}
      selectedInstance={selectedInstance}
      selectedVersion={selectedVersion}
      versionMetadataByNumber={storySkillVersions}
    />
  )
}

const meta = {
  title: 'Dashboard V3/SkillFamilyDetail',
  component: SkillFamilyDetail,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="dark min-h-screen w-[1280px] bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SkillFamilyDetail>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
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
    onApplyToFamily: () => undefined,
    onDraftChange: () => undefined,
    onLoadApplyPreview: () => undefined,
    onPreferredProjectChange: () => undefined,
    onSave: () => undefined,
    onSelectInstance: () => undefined,
    onSelectVersion: () => undefined,
    onSwitchRuntime: () => undefined,
    onToggleVersionDisabled: () => undefined,
    preferredProjectPath: storyProjects[0].path,
    preferredRuntime: 'claude',
    projects: storyProjects,
    selectedInstance: storySkillInstances[0],
    selectedVersion: 6,
    versionMetadataByNumber: storySkillVersions,
  },
  render: () => <InteractiveSkillFamilyDetail />,
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
    isApplying: false,
    isLoading: false,
    isSaving: false,
    onApplyToFamily: () => undefined,
    onDraftChange: () => undefined,
    onLoadApplyPreview: () => undefined,
    onPreferredProjectChange: () => undefined,
    onSave: () => undefined,
    onSelectInstance: () => undefined,
    onSelectVersion: () => undefined,
    onSwitchRuntime: () => undefined,
    onToggleVersionDisabled: () => undefined,
    preferredProjectPath: storyProjects[0].path,
    preferredRuntime: 'claude',
    projects: storyProjects,
    selectedInstance: null,
    selectedVersion: null,
    versionMetadataByNumber: {},
  },
}

export const Loading: Story = {
  args: {
    ...EmptySelection.args,
    isLoading: true,
  },
}
