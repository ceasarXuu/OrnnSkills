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
import type { DashboardEvolutionLifecycle, DashboardEvolutionRun, DashboardSkill } from '@/types/dashboard'

interface SkillDetailDialogProps {
  evolutionLifecycle?: DashboardEvolutionLifecycle | null
  onOpenChange: (open: boolean) => void
  open: boolean
  skill: DashboardSkill | null
}

export function SkillDetailDialog({
  evolutionLifecycle,
  onOpenChange,
  open,
  skill,
}: SkillDetailDialogProps) {
  const { locale, t } = useI18n()
  const matchingEvolutionRuns = skill
    ? (evolutionLifecycle?.runs ?? []).filter((run) => {
        return run.skillId === skill.skillId && (!skill.runtime || run.runtime === skill.runtime)
      })
    : []

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
            <SkillEvolutionSummary runs={matchingEvolutionRuns} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function SkillEvolutionSummary({ runs }: { runs: DashboardEvolutionRun[] }) {
  const latestRun = runs[0]
  const pendingCount = runs.filter((run) => run.status === 'proposed').length
  const appliedCount = runs.filter((run) => !!run.application).length
  const regressionCount = runs.filter((run) => run.verification?.outcome === 'regressed').length

  return (
    <div className="rounded-lg border border-border/70 bg-muted/25 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">演化</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {latestRun?.proposal?.reason ?? latestRun?.verification?.reason ?? '暂无演化上下文'}
          </div>
        </div>
        <Badge variant={regressionCount > 0 ? 'destructive' : 'outline'}>
          {runs.length} runs
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <MiniMetric label="待处理" value={pendingCount} />
        <MiniMetric label="已应用" value={appliedCount} />
        <MiniMetric label="回退风险" value={regressionCount} />
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/30 px-2 py-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
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
