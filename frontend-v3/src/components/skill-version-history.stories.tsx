import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SkillVersionHistory } from '@/components/skill-version-history'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'
import {
  storySkillDetail,
  storySkillInstances,
  storySkillVersions,
} from '@/stories/dashboard-v3-fixtures'

const meta = {
  title: 'Dashboard V3/Skills/SkillVersionHistory',
  component: SkillVersionHistory,
  tags: ['stable', 'pattern'],
  parameters: dashboardStoryParameters({
    width: '420px',
  }),
  args: {
    diffVersion: null,
    onSelectDiffVersion: fn(),
    onSelectVersion: fn(),
    onToggleVersionDisabled: fn(),
  },
} satisfies Meta<typeof SkillVersionHistory>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    detail: storySkillDetail,
    selectedInstance: storySkillInstances[0],
    selectedVersion: 6,
    versionMetadataByNumber: storySkillVersions,
  },
}

export const Comparing: Story = {
  args: {
    detail: storySkillDetail,
    diffVersion: 5,
    selectedInstance: storySkillInstances[0],
    selectedVersion: 6,
    versionMetadataByNumber: storySkillVersions,
  },
}

export const Empty: Story = {
  args: {
    detail: {
      ...storySkillDetail,
      versions: [],
    },
    selectedInstance: storySkillInstances[0],
    selectedVersion: null,
    versionMetadataByNumber: {},
  },
}
