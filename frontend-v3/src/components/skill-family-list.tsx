import { Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompactNumber, formatRelativeTime } from '@/lib/format'
import type { DashboardSkillFamily } from '@/types/dashboard'

interface SkillFamilyListProps {
  families: DashboardSkillFamily[]
  isLoading: boolean
  onQueryChange: (value: string) => void
  onSelectFamily: (familyId: string) => void
  query: string
  selectedFamilyId: string
}

export function SkillFamilyList({
  families,
  isLoading,
  onQueryChange,
  onSelectFamily,
  query,
  selectedFamilyId,
}: SkillFamilyListProps) {
  return (
    <Card className="border-border/70 bg-card/92">
      <CardHeader className="gap-4 border-b border-border/70">
        <div className="space-y-1">
          <CardTitle className="text-xl">技能库</CardTitle>
          <div className="text-sm text-muted-foreground">
            {formatCompactNumber(families.length)} 个 skill families
          </div>
        </div>

        <label className="relative block">
          <HugeiconsIcon
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            icon={Search01Icon}
            size={16}
            strokeWidth={1.8}
          />
          <Input
            className="h-10 rounded-xl border-border/80 bg-background/60 pl-10"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索 family / runtime / status"
            value={query}
          />
        </label>
      </CardHeader>

      <CardContent className="px-0">
        {isLoading && families.length === 0 ? (
          <div className="space-y-3 px-6 py-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton className="h-16 w-full" key={index} />
            ))}
          </div>
        ) : families.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">当前没有匹配的技能族。</div>
        ) : (
          <ScrollArea className="h-[min(72vh,920px)]">
            <div className="space-y-2 px-4 py-4">
              {families.map((family) => {
                const isActive = family.familyId === selectedFamilyId
                return (
                  <button
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      isActive
                        ? 'border-primary/50 bg-primary/8'
                        : 'border-border/70 bg-background/30 hover:border-primary/30 hover:bg-muted/40'
                    }`}
                    key={family.familyId}
                    onClick={() => onSelectFamily(family.familyId)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium">{family.familyName}</div>
                        <div className="text-xs text-muted-foreground">{family.familyId}</div>
                      </div>
                      <Badge variant="outline">{family.instanceCount}</Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{family.runtimes.join(' · ')}</span>
                      <span>{family.projectCount} projects</span>
                      <span>{formatCompactNumber(family.usage.observedCalls)} calls</span>
                      <span>{formatRelativeTime(family.usage.lastUsedAt ?? family.lastUsedAt)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
