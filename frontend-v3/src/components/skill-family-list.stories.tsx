import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { SkillFamilyList } from '@/components/skill-family-list'
import type { DashboardSkillFamily } from '@/types/dashboard'

const families: DashboardSkillFamily[] = [
  {
    familyId: 'family_f272dc983b621999',
    familyName: 'astartes-coding-custodes',
    instanceCount: 9,
    projectCount: 3,
    revisionCount: 6,
    runtimeCount: 3,
    runtimes: ['claude', 'codex', 'opencode'],
    status: 'active',
    usage: {
      analyzedTouches: 10,
      firstSeenAt: '2026-04-20T03:00:00.000Z',
      lastSeenAt: '2026-04-23T05:00:00.000Z',
      lastUsedAt: '2026-04-22T16:00:00.000Z',
      observedCalls: 14,
      optimizedCount: 5,
      status: 'active',
    },
  },
  {
    familyId: 'family_00ee6585a4141e9a',
    familyName: 'test-driven-development',
    instanceCount: 9,
    projectCount: 3,
    revisionCount: 4,
    runtimeCount: 3,
    runtimes: ['claude', 'codex', 'opencode'],
    status: 'active',
    usage: {
      analyzedTouches: 72,
      firstSeenAt: '2026-04-18T10:00:00.000Z',
      lastSeenAt: '2026-04-23T06:00:00.000Z',
      lastUsedAt: '2026-04-22T12:00:00.000Z',
      observedCalls: 123,
      optimizedCount: 8,
      status: 'active',
    },
  },
  {
    familyId: 'family_453475360991ce06',
    familyName: 'systematic-debugging',
    instanceCount: 9,
    projectCount: 3,
    revisionCount: 5,
    runtimeCount: 3,
    runtimes: ['claude', 'codex', 'opencode'],
    status: 'active',
    usage: {
      analyzedTouches: 31,
      firstSeenAt: '2026-04-18T08:00:00.000Z',
      lastSeenAt: '2026-04-23T05:30:00.000Z',
      lastUsedAt: '2026-04-22T15:00:00.000Z',
      observedCalls: 62,
      optimizedCount: 6,
      status: 'active',
    },
  },
]

function InteractiveSkillFamilyList() {
  const [query, setQuery] = useState('')
  const [selectedFamilyId, setSelectedFamilyId] = useState(families[0]?.familyId ?? '')

  return (
    <SkillFamilyList
      families={families}
      isLoading={false}
      onQueryChange={setQuery}
      onSelectFamily={setSelectedFamilyId}
      query={query}
      selectedFamilyId={selectedFamilyId}
    />
  )
}

const meta = {
  title: 'Dashboard V3/SkillFamilyList',
  component: SkillFamilyList,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="dark min-h-screen w-[360px] bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SkillFamilyList>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    families,
    isLoading: false,
    onQueryChange: () => undefined,
    onSelectFamily: () => undefined,
    query: '',
    selectedFamilyId: families[0]?.familyId ?? '',
  },
  render: () => <InteractiveSkillFamilyList />,
}

export const Loading: Story = {
  args: {
    families: [],
    isLoading: true,
    onQueryChange: () => undefined,
    onSelectFamily: () => undefined,
    query: '',
    selectedFamilyId: '',
  },
}

export const Empty: Story = {
  args: {
    families: [],
    isLoading: false,
    onQueryChange: () => undefined,
    onSelectFamily: () => undefined,
    query: '',
    selectedFamilyId: '',
  },
}
