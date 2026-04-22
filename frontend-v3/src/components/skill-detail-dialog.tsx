import { Layers01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatCompactNumber, formatDateTime, formatRelativeTime, getSkillStatusBadgeVariant } from '@/lib/format'
import type { DashboardSkill } from '@/types/dashboard'

interface SkillDetailDialogProps {
  onOpenChange: (open: boolean) => void
  open: boolean
  skill: DashboardSkill | null
}

export function SkillDetailDialog({
  onOpenChange,
  open,
  skill,
}: SkillDetailDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Layers01Icon} size={18} strokeWidth={1.8} />
            <DialogTitle>{skill?.skillId ?? 'Skill Detail'}</DialogTitle>
          </div>
          <DialogDescription>只读详情，确认版本、状态和最近更新时间。</DialogDescription>
        </DialogHeader>

        {skill ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{skill.runtime ?? 'unknown'}</Badge>
              <Badge variant={getSkillStatusBadgeVariant(skill.status)}>{skill.status ?? 'pending'}</Badge>
              <Badge variant="outline">
                {formatCompactNumber(skill.versionsAvailable?.length ?? 0)} revisions
              </Badge>
            </div>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Effective Version" value={`v${skill.effectiveVersion ?? '--'}`} />
              <Field label="Trace Count" value={formatCompactNumber(skill.traceCount)} />
              <Field label="最近更新" value={formatRelativeTime(skill.updatedAt)} />
              <Field label="更新时间" value={formatDateTime(skill.updatedAt)} />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/35 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  )
}
