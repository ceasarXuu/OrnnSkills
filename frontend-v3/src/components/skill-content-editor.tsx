import { LinkCircle02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import type {
  DashboardSkillApplyPreview,
  DashboardSkillInstance,
  SkillDomainRuntime,
} from '@/types/dashboard'

interface SkillContentEditorProps {
  actionMessage: string | null
  applyPreview: DashboardSkillApplyPreview | null
  detailError: string | null
  draftContent: string
  isApplying: boolean
  isSaving: boolean
  onApplyToFamily: () => void
  onDraftChange: (value: string) => void
  onLoadApplyPreview: () => void
  onSave: () => void
  preferredRuntime: SkillDomainRuntime
  selectedInstance: DashboardSkillInstance | null
}

export function SkillContentEditor({
  actionMessage,
  applyPreview,
  detailError,
  draftContent,
  isApplying,
  isSaving,
  onApplyToFamily,
  onDraftChange,
  onLoadApplyPreview,
  onSave,
  preferredRuntime,
  selectedInstance,
}: SkillContentEditorProps) {
  return (
    <Card className="border-border/70 bg-card/92">
      <CardHeader className="gap-4 border-b border-border/70">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle>正文</CardTitle>
            <div className="truncate text-sm text-muted-foreground">
              {selectedInstance?.projectPath ?? '暂无实例'} · {selectedInstance?.runtime ?? preferredRuntime}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button onClick={() => void onLoadApplyPreview()} size="sm" variant="outline">
              预览传播
            </Button>
            <Button disabled={isSaving} onClick={() => void onSave()} size="sm">
              {isSaving ? '保存中' : '保存正文'}
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

        <Textarea
          aria-label="Skill 正文"
          className="min-h-[420px] rounded-xl border-border/80 bg-background/60 font-mono text-sm"
          onChange={(event) => onDraftChange(event.target.value)}
          value={draftContent}
        />

        {actionMessage ? <div className="text-sm text-muted-foreground">{actionMessage}</div> : null}

        {applyPreview ? (
          <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <HugeiconsIcon icon={LinkCircle02Icon} size={16} strokeWidth={1.8} />
              将影响 {applyPreview.totalTargets} 个同族实例
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
                {isApplying ? '应用中' : '应用到同族实例'}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
