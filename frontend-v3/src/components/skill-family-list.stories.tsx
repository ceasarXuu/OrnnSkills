import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState, type ComponentProps } from 'react'
import { expect, fn } from 'storybook/test'
import { SkillFamilyList } from '@/components/skill-family-list'
import { filterSkillFamilies, sortSkillFamilies } from '@/lib/skill-library'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'
import { storySkillFamilies } from '@/stories/dashboard-v3-fixtures'

type SkillFamilyListStoryArgs = ComponentProps<typeof SkillFamilyList>

function InteractiveSkillFamilyList(args: SkillFamilyListStoryArgs) {
  const [query, setQuery] = useState(args.query)
  const [selectedFamilyId, setSelectedFamilyId] = useState(args.selectedFamilyId)
  const visibleFamilies = useMemo(
    () => sortSkillFamilies(filterSkillFamilies(args.families, query)),
    [args.families, query],
  )

  return (
    <SkillFamilyList
      {...args}
      families={visibleFamilies}
      onQueryChange={(value) => {
        setQuery(value)
        args.onQueryChange(value)
      }}
      onSelectFamily={(familyId) => {
        setSelectedFamilyId(familyId)
        args.onSelectFamily(familyId)
      }}
      query={query}
      selectedFamilyId={selectedFamilyId}
    />
  )
}

const meta = {
  title: 'Dashboard V3/Skills/SkillFamilyList',
  component: SkillFamilyList,
  tags: ['stable', 'pattern'],
  parameters: dashboardStoryParameters({
    width: '360px',
  }),
  args: {
    families: storySkillFamilies,
    isLoading: false,
    onQueryChange: fn(),
    onSelectFamily: fn(),
    query: '',
    selectedFamilyId: storySkillFamilies[0]?.familyId ?? '',
  },
} satisfies Meta<typeof SkillFamilyList>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => <InteractiveSkillFamilyList {...args} />,
}

export const SearchAndSelect: Story = {
  render: (args) => <InteractiveSkillFamilyList {...args} />,
  play: async ({ args, canvas, userEvent }) => {
    const search = canvas.getByPlaceholderText('搜索 family / runtime / status')
    await userEvent.clear(search)
    await userEvent.type(search, 'systematic')
    await expect(args.onQueryChange).toHaveBeenCalled()

    const familyCard = canvas.getByText('systematic-debugging').closest('button')
    expect(familyCard).not.toBeNull()
    if (!familyCard) {
      return
    }

    await userEvent.click(familyCard)
    await expect(args.onSelectFamily).toHaveBeenCalledWith('family_453475360991ce06')
  },
}

export const Loading: Story = {
  args: {
    families: [],
    isLoading: true,
    query: '',
    selectedFamilyId: '',
  },
}

export const Empty: Story = {
  args: {
    families: [],
    query: '',
    selectedFamilyId: '',
  },
}
