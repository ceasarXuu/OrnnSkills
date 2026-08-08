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
import { formatCompactNumberForLocale, formatDateTime, formatRelativeTime, getSkillStatusBadgeVariant } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
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
  const { locale, t } = useI18n()

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Layers01Icon} size={18} strokeWidth={1.8} />
            <DialogTitle>{skill?.skillId ?? 'Skill Detail'}</DialogTitle>
          </div>
          <DialogDescription className="text-foreground/72">
            {t('readOnlySkillDetail')}
          </DialogDescription>
        </DialogHeader>

        {skill ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{skill.runtime ?? 'unknown'}</Badge>
              <Badge variant={getSkillStatusBadgeVariant(skill.status)}>{skill.status ?? 'pending'}</Badge>
              <Badge variant="outline">
                {formatCompactNumberForLocale(skill.versionsAvailable?.length ?? 0, locale)} {t('revisions')}
              </Badge>
            </div>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('effectiveVersion')} value={`v${skill.effectiveVersion ?? '--'}`} />
              <Field label={t('traceCount')} value={formatCompactNumberForLocale(skill.traceCount, locale)} />
              <Field label={t('lastUpdated')} value={formatRelativeTime(skill.updatedAt, locale, t('invalidDate'))} />
              <Field label={t('lastUpdated')} value={formatDateTime(skill.updatedAt, locale, t('invalidDate'))} />
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
