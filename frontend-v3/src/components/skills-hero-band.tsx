import { formatCompactNumber } from '@/lib/format'
import type { SkillsOverview } from '@/lib/skills-workspace'

interface SkillsHeroBandProps {
  overview: SkillsOverview
}

export function SkillsHeroBand({ overview }: SkillsHeroBandProps) {
  return (
    <section className="relative overflow-hidden border-b border-border/70">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background)_84%,transparent),color-mix(in_oklab,var(--background)_92%,transparent)),linear-gradient(120deg,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_55%),linear-gradient(0deg,color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklab,var(--foreground)_4%,transparent)_1px,transparent_1px)] bg-[size:auto,auto,28px_28px,28px_28px]" />
      <div className="relative mx-auto grid max-w-[1680px] gap-10 px-4 py-10 xl:grid-cols-[minmax(0,1.2fr)_520px] xl:px-6">
        <div className="space-y-6">
          <div className="space-y-4">
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              技能
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground">
              查看 skill family、运行时状态、版本和最近活跃度。
            </p>
          </div>

          <div className="text-sm text-muted-foreground">
            共 {formatCompactNumber(overview.totalSkills)} 个 skill family，累计{' '}
            {formatCompactNumber(overview.totalTraces)} 条 trace。
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/60">
          <MetricCell label="Skill Families" value={formatCompactNumber(overview.totalSkills)} />
          <MetricCell label="Usage Evidence" value={formatCompactNumber(overview.evidenceSkillCount)} />
          <MetricCell label="Runtime Coverage" value={formatCompactNumber(overview.runtimeCount)} />
          <MetricCell
            emphasis={overview.errorSkillCount > 0}
            label="Needs Attention"
            value={formatCompactNumber(overview.errorSkillCount)}
          />
        </div>
      </div>
    </section>
  )
}

function MetricCell({
  emphasis = false,
  label,
  value,
}: {
  emphasis?: boolean
  label: string
  value: string
}) {
  return (
    <div className="bg-background/78 px-5 py-5 backdrop-blur-sm">
      <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
        {label}
      </div>
      <div className={emphasis ? 'mt-3 text-2xl font-semibold text-destructive' : 'mt-3 text-2xl font-semibold'}>
        {value}
      </div>
    </div>
  )
}
