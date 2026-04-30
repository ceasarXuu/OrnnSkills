import { LinkCircle02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { SkillVersionDiffViewer } from '@/components/skill-version-diff-viewer'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/lib/i18n'
import type {
  DashboardSkillApplyPreview,
} from '@/types/dashboard'

interface SkillContentEditorProps {
  actionMessage: string | null
  applyPreview: DashboardSkillApplyPreview | null
  detailError: string | null
  diffContent: string | null
  diffVersion: number | null
  draftContent: string
  isApplying: boolean
  onApplyToFamily: () => void
  onCloseApplyPreview: () => void
  onDraftChange: (value: string) => void
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
  onApplyToFamily,
  onCloseApplyPreview,
  onDraftChange,
  selectedVersion,
}: SkillContentEditorProps) {
  const { locale, t } = useI18n()
  const isDiffMode = diffVersion !== null && diffContent !== null
  const editorBody = (
    <div className="space-y-4">
      {detailError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {detailError}
        </div>
      ) : null}

      {actionMessage ? (
        <div className="text-sm text-muted-foreground">
          {translateActionMessage(actionMessage, locale, t)}
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
    </div>
  )

  return (
    <>
      {editorBody}

      <Dialog onOpenChange={(open) => { if (!open) onCloseApplyPreview() }} open={Boolean(applyPreview)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={LinkCircle02Icon} size={16} strokeWidth={1.8} />
              {locale.startsWith('zh')
                ? `将影响 ${applyPreview?.totalTargets ?? 0} 个同族实例`
                : `Affects ${applyPreview?.totalTargets ?? 0} family instances`}
            </DialogTitle>
            <DialogDescription>
              {locale.startsWith('zh') ? '确认后会把当前正文应用到下列同族实例。' : 'Confirm to apply the current content to these family instances.'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[360px] space-y-2 overflow-auto rounded-xl border border-border/70 bg-background/45 p-3" tabIndex={0}>
            {(applyPreview?.targets ?? []).map((target) => (
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground" key={`${target.projectPath}:${target.runtime}`}>
                  <span>{target.projectPath}</span>
                  <span>{target.runtime}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={onCloseApplyPreview} type="button" variant="outline">
              {locale.startsWith('zh') ? '取消' : 'Cancel'}
            </Button>
            <Button disabled={isApplying} onClick={() => void onApplyToFamily()} type="button">
              {isApplying ? t('applying') : t('applyToFamily')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
  if (message === '未在市场找到该技能') return 'Skill not found in marketplace'
  if (message === '本地内容与市场版本一致') return 'Local content matches marketplace'
  return message
}
