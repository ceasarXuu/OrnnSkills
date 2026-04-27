import { LinkCircle02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { SkillVersionDiffViewer } from '@/components/skill-version-diff-viewer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/lib/i18n'
import type {
  DashboardSkillApplyPreview,
  DashboardSkillInstance,
  SkillDomainRuntime,
} from '@/types/dashboard'

interface SkillContentEditorProps {
  actionMessage: string | null
  applyPreview: DashboardSkillApplyPreview | null
  detailError: string | null
  diffContent: string | null
  diffVersion: number | null
  draftContent: string
  isApplying: boolean
  isSaving: boolean
  onApplyToFamily: () => void
  onDraftChange: (value: string) => void
  onLoadApplyPreview: () => void
  onSave: () => void
  preferredRuntime: SkillDomainRuntime
  selectedInstance: DashboardSkillInstance | null
  selectedVersion: number | null
}

export function SkillContentEditor({
  actionMessage,
  applyPreview,
  detailError,
  diffContent,
  diffVersion,
  draftContent,
  isApplying,
  isSaving,
  onApplyToFamily,
  onDraftChange,
  onLoadApplyPreview,
  onSave,
  preferredRuntime,
  selectedInstance,
  selectedVersion,
}: SkillContentEditorProps) {
  const { locale, t } = useI18n()
  const isDiffMode = diffVersion !== null && diffContent !== null

  return (
    <Card className="border-border/70 bg-card/92">
      <CardHeader className="gap-4 border-b border-border/70">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle>{t('skillContent')}</CardTitle>
            <div className="truncate text-sm text-muted-foreground">
              {selectedInstance?.projectPath ?? t('noSkillInstance')} · {selectedInstance?.runtime ?? preferredRuntime}
            </div>
            {isDiffMode ? (
              <div className="text-xs text-muted-foreground">
                {t('diffView')} v{diffVersion} {'->'} v{selectedVersion ?? '--'}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button onClick={() => void onLoadApplyPreview()} size="sm" variant="outline">
              {t('previewPropagation')}
            </Button>
            <Button disabled={isSaving || isDiffMode} onClick={() => void onSave()} size="sm">
              {isSaving ? t('saving') : t('saveSkillContent')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {detailError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {detailError}
          </div>
        ) : null}

        {isDiffMode ? (
          <SkillVersionDiffViewer
            newContent={draftContent}
            newVersion={selectedVersion}
            oldContent={diffContent}
            oldVersion={diffVersion}
          />
        ) : (
          <Textarea
            aria-label={t('skillContentAria')}
            className="min-h-[420px] rounded-xl border-border/80 bg-background/60 font-mono text-sm"
            onChange={(event) => onDraftChange(event.target.value)}
            value={draftContent}
          />
        )}

        {actionMessage ? (
          <div className="text-sm text-muted-foreground">
            {translateActionMessage(actionMessage, locale, t)}
          </div>
        ) : null}

        {applyPreview ? (
          <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <HugeiconsIcon icon={LinkCircle02Icon} size={16} strokeWidth={1.8} />
              {locale.startsWith('zh')
                ? `将影响 ${applyPreview.totalTargets} 个同族实例`
                : `Affects ${applyPreview.totalTargets} family instances`}
            </div>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              {applyPreview.targets.slice(0, 6).map((target) => (
                <div className="flex items-center justify-between gap-3" key={`${target.projectPath}:${target.runtime}`}>
                  <span>{target.projectPath}</span>
                  <span>{target.runtime}</span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button disabled={isApplying} onClick={() => void onApplyToFamily()} size="sm">
                {isApplying ? t('applying') : t('applyToFamily')}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function translateActionMessage(
  message: string,
  locale: string,
  t: ReturnType<typeof useI18n>['t'],
) {
  if (locale.startsWith('zh')) return message
  if (message === '保存中') return t('saving')
  if (message === '没有正文变更') return 'No content changes'
  if (message.startsWith('已保存 v')) return message.replace('已保存', 'Saved')
  if (message.startsWith('已停用 v')) return message.replace('已停用', 'Disabled')
  if (message.startsWith('已恢复 v')) return message.replace('已恢复', 'Restored')
  return message
}
