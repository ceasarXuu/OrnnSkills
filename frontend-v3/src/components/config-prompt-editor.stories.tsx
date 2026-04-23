import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, fn } from 'storybook/test'
import { ConfigPromptEditor } from '@/components/config-prompt-editor'
import { CONFIG_TEXT, getPromptDefaults } from '@/lib/config-workspace'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'

const defaults = getPromptDefaults()

type ConfigPromptEditorStoryArgs = ComponentProps<typeof ConfigPromptEditor>

function InteractivePromptEditor(args: ConfigPromptEditorStoryArgs) {
  const [source, setSource] = useState(args.source)
  const [value, setValue] = useState(args.value)

  return (
    <ConfigPromptEditor
      {...args}
      onSetPromptOverride={(key, nextValue) => {
        setValue(nextValue)
        args.onSetPromptOverride(key, nextValue)
      }}
      onSetPromptSource={(key, nextSource) => {
        setSource(nextSource)
        args.onSetPromptSource(key, nextSource)
      }}
      source={source}
      value={value}
    />
  )
}

const meta = {
  title: 'Dashboard V3/Config/ConfigPromptEditor',
  component: ConfigPromptEditor,
  tags: ['stable', 'pattern'],
  parameters: dashboardStoryParameters({
    width: '1120px',
  }),
  args: {
    defaultPrompt: defaults.skillCallAnalyzer,
    label: CONFIG_TEXT.promptSkillCallAnalyzerLabel,
    onSetPromptOverride: fn(),
    onSetPromptSource: fn(),
    placeholder: CONFIG_TEXT.promptSkillCallAnalyzerPlaceholder,
    promptKey: 'skillCallAnalyzer',
    source: 'built_in',
    value: '',
  },
} satisfies Meta<typeof ConfigPromptEditor>

export default meta

type Story = StoryObj<typeof meta>

export const BuiltIn: Story = {
  render: (args) => <InteractivePromptEditor {...args} />,
}

export const Custom: Story = {
  args: {
    source: 'custom',
    value: 'Classify calls by family, runtime, and evidence.',
  },
  render: (args) => <InteractivePromptEditor {...args} />,
}

export const SwitchToCustom: Story = {
  render: (args) => <InteractivePromptEditor {...args} />,
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByLabelText(CONFIG_TEXT.customPrompt))

    const textarea = canvas.getByPlaceholderText(CONFIG_TEXT.promptSkillCallAnalyzerPlaceholder)
    await expect(textarea).toBeEnabled()
    await userEvent.type(textarea, 'Explain runtime decisions with trace evidence.')

    await expect(args.onSetPromptSource).toHaveBeenCalledWith('skillCallAnalyzer', 'custom')
    await expect(args.onSetPromptOverride).toHaveBeenCalled()
  },
}
