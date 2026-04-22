import { Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  formatCompactNumber,
  formatRelativeTime,
  getSkillStatusBadgeVariant,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DashboardSkill } from '@/types/dashboard'

interface SkillsTableProps {
  isLoading: boolean
  onQueryChange: (value: string) => void
  onSelectSkill: (skill: DashboardSkill) => void
  query: string
  selectedSkillKey: string
  skills: DashboardSkill[]
}

export function SkillsTable({
  isLoading,
  onQueryChange,
  onSelectSkill,
  query,
  selectedSkillKey,
  skills,
}: SkillsTableProps) {
  return (
    <Card className="border-border/70">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle>技能目录</CardTitle>
            <CardDescription>完全从新入口读取，不复用旧前端组件和样式层。</CardDescription>
          </div>
          <div className="relative w-full xl:max-w-sm">
            <HugeiconsIcon
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              icon={Search01Icon}
              size={16}
              strokeWidth={1.8}
            />
            <Input
              className="pl-10"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="搜索 skill id / runtime / status"
              value={query}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && skills.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : skills.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            当前项目没有匹配的技能。
          </div>
        ) : (
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Skill</TableHead>
                <TableHead>Runtime</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">Traces</TableHead>
                <TableHead className="text-right">版本</TableHead>
                <TableHead className="text-right">最近更新</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skills.map((skill) => {
                const skillKey = `${skill.skillId}:${skill.runtime ?? 'unknown'}`
                return (
                  <TableRow
                    key={skillKey}
                    className={cn('cursor-pointer', selectedSkillKey === skillKey && 'bg-muted')}
                    data-state={selectedSkillKey === skillKey ? 'selected' : undefined}
                    onClick={() => onSelectSkill(skill)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <span>{skill.skillId}</span>
                        <span className="text-xs text-muted-foreground">
                          effective v{skill.effectiveVersion ?? '--'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{skill.runtime ?? 'unknown'}</TableCell>
                    <TableCell>
                      <Badge variant={getSkillStatusBadgeVariant(skill.status)}>{skill.status ?? 'pending'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCompactNumber(skill.traceCount)}</TableCell>
                    <TableCell className="text-right">
                      {formatCompactNumber(skill.versionsAvailable?.length ?? 0)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatRelativeTime(skill.updatedAt)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
