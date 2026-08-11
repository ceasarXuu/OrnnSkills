import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, fn } from 'storybook/test'
import { SkillContentEditor } from '@/components/skill-content-editor'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'
import { storySkillDetail } from '@/stories/dashboard-v3-fixtures'

type SkillContentEditorStoryArgs = ComponentProps<typeof SkillContentEditor>

function InteractiveSkillContentEditor(args: SkillContentEditorStoryArgs) {
  const [draftContent, setDraftContent] = useState(args.draftContent)

  return (
    <SkillContentEditor
      {...args}
      draftContent={draftContent}
      onDraftChange={(value) => {
        setDraftContent(value)
        args.onDraftChange(value)
      }}
    />
  )
}

const meta = {
  title: 'Dashboard V3/Skills/SkillContentEditor',
  component: SkillContentEditor,
  tags: ['stable', 'pattern'],
  parameters: dashboardStoryParameters({
    width: '840px',
  }),
  args: {
    actionMessage: null,
    detailError: null,
    draftContent: storySkillDetail.content ?? '',
    onDraftChange: fn(),
  },
} satisfies Meta<typeof SkillContentEditor>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => <InteractiveSkillContentEditor {...args} />,
  play: async ({ args, canvas, userEvent }) => {
    const editor = canvas.getByRole('textbox', { name: /正文/ })

    await userEvent.clear(editor)
    await userEvent.type(editor, '# Updated skill body')
    await expect(args.onDraftChange).toHaveBeenCalled()
  },
}

export const WithActionMessage: Story = {
  args: {
    actionMessage: '已保存到宿主 skills 目录。',
  },
  render: (args) => <InteractiveSkillContentEditor {...args} />,
}

export const Error: Story = {
  args: {
    detailError: '正文读取失败，请稍后重试。',
  },
  render: (args) => <InteractiveSkillContentEditor {...args} />,
}
