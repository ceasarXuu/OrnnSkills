import { FolderLibraryIcon, Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { formatCompactNumber } from '@/lib/format'
import type { DashboardProject } from '@/types/dashboard'
import type { SkillsOverview } from '@/lib/skills-workspace'

interface SkillsHeroBandProps {
  filteredSkillCount: number
  overview: SkillsOverview
  projectCount: number
  query: string
  selectedProject: DashboardProject | null
}

export function SkillsHeroBand({
  filteredSkillCount,
  overview,
  projectCount,
  query,
  selectedProject,
}: SkillsHeroBandProps) {
  return (
    <section className="relative overflow-hidden border-b border-border/70">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background)_84%,transparent),color-mix(in_oklab,var(--background)_92%,transparent)),linear-gradient(120deg,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_55%),linear-gradient(0deg,color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklab,var(--foreground)_4%,transparent)_1px,transparent_1px)] bg-[size:auto,auto,28px_28px,28px_28px]" />
      <div className="relative mx-auto grid max-w-[1680px] gap-10 px-4 py-10 xl:grid-cols-[minmax(0,1.2fr)_520px] xl:px-6">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.32em] text-muted-foreground">
              Skills Workbench
            </div>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                先看技能，再决定项目上下文要不要继续下钻
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                这页应该先给你技能库、使用证据和问题分布，再把项目当作范围过滤，而不是把项目摘要推到主位。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              <HugeiconsIcon icon={FolderLibraryIcon} size={12} strokeWidth={1.8} />
              {selectedProject?.name ?? '未选项目'}
            </Badge>
            <Badge variant="outline">{projectCount} 个项目范围</Badge>
            <Badge variant="outline">{formatCompactNumber(overview.totalTraces)} 条 trace 证据</Badge>
            <Badge variant={query ? 'secondary' : 'outline'}>
              {query ? `${filteredSkillCount} 条匹配结果` : '未启用搜索筛选'}
            </Badge>
            {query ? (
              <Badge variant="outline">
                <HugeiconsIcon icon={Search01Icon} size={12} strokeWidth={1.8} />
                {query}
              </Badge>
            ) : null}
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
