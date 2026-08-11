import { Textarea } from '@/components/ui/textarea'
import { translateDashboardActionMessage } from '@/lib/dashboard-action-message'
import { useI18n } from '@/lib/i18n'

interface SkillContentEditorProps {
  actionMessage: string | null
  detailError: string | null
  draftContent: string
  onDraftChange: (value: string) => void
}

export function SkillContentEditor({
  actionMessage,
  detailError,
  draftContent,
  onDraftChange,
}: SkillContentEditorProps) {
  const { locale, t } = useI18n()

  return (
    <div className="space-y-4">
      {detailError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {detailError}
        </div>
      ) : null}

      {actionMessage ? (
        <div className="text-sm text-muted-foreground">
          {translateDashboardActionMessage(actionMessage, locale, t)}
        </div>
      ) : null}

      <Textarea
        aria-label={t('skillContentAria')}
        className="min-h-[420px] rounded-xl border-border/80 bg-background/60 font-mono text-sm"
        onChange={(event) => onDraftChange(event.target.value)}
        value={draftContent}
      />
    </div>
  )
}
