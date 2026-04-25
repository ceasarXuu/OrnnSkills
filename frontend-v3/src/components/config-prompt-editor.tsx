import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { getConfigText } from '@/lib/config-workspace'
import { useI18n } from '@/lib/i18n'
import type { DashboardPromptKey, DashboardPromptSource } from '@/types/config'

interface ConfigPromptEditorProps {
  defaultPrompt: string
  label: string
  onSetPromptOverride: (key: DashboardPromptKey, value: string) => void
  onSetPromptSource: (key: DashboardPromptKey, value: DashboardPromptSource) => void
  placeholder: string
  promptKey: DashboardPromptKey
  source: DashboardPromptSource
  value: string
}

export function ConfigPromptEditor({
  defaultPrompt,
  label,
  onSetPromptOverride,
  onSetPromptSource,
  placeholder,
  promptKey,
  source,
  value,
}: ConfigPromptEditorProps) {
  const { lang } = useI18n()
  const configText = getConfigText(lang)

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-card/70 p-4">
      <p className="text-sm font-medium text-foreground">{label}</p>

      <RadioGroup
        className="grid gap-4 xl:grid-cols-2"
        onValueChange={(nextSource) =>
          onSetPromptSource(promptKey, nextSource === 'custom' ? 'custom' : 'built_in')
        }
        value={source === 'custom' ? 'custom' : 'built_in'}
      >
        <label className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <RadioGroupItem
              id={`cfg_prompt_${promptKey}_source_built_in`}
              value="built_in"
            />
            <span>{configText.builtInPrompt}</span>
          </div>
          <pre
            aria-label={`${label} ${configText.builtInPrompt}`}
            className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-border/70 bg-muted/20 px-4 py-3 text-xs leading-6 text-muted-foreground"
            tabIndex={0}
          >
            {defaultPrompt}
          </pre>
        </label>

        <label className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <RadioGroupItem
              id={`cfg_prompt_${promptKey}_source_custom`}
              value="custom"
            />
            <span>{configText.customPrompt}</span>
          </div>
          <Textarea
            aria-label={`${label} ${configText.customPrompt}`}
            className="min-h-64"
            disabled={source !== 'custom'}
            onChange={(event) => onSetPromptOverride(promptKey, event.target.value)}
            placeholder={placeholder}
            value={value}
          />
        </label>
      </RadioGroup>
    </div>
  )
}
