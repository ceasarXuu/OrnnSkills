import { Fragment, useEffect, useMemo, useState } from 'react'
import { Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import {
  getVisiblePaginationPages,
  paginateSkills,
} from '@/lib/skills-workspace'
import { cn } from '@/lib/utils'
import type { DashboardSkill } from '@/types/dashboard'

const PAGE_SIZE = 12

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
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [query])

  const pagination = useMemo(() => paginateSkills(skills, page, PAGE_SIZE), [page, skills])
  const visiblePages = useMemo(
    () => getVisiblePaginationPages(pagination.currentPage, pagination.totalPages),
    [pagination.currentPage, pagination.totalPages],
  )

  useEffect(() => {
    if (pagination.currentPage !== page) {
      setPage(pagination.currentPage)
    }
  }, [page, pagination.currentPage])

  return (
    <Card className="border-border/70 bg-card/92 shadow-[0_20px_60px_-42px_color-mix(in_oklab,var(--foreground)_28%,transparent)] backdrop-blur">
      <CardHeader className="gap-5 border-b border-border/70">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">技能列表</CardTitle>
            <div className="text-sm text-muted-foreground">
              {formatCompactNumber(pagination.totalItems)} skills
            </div>
          </div>
          <div className="w-full xl:max-w-sm">
            <label className="relative block">
              <HugeiconsIcon
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                icon={Search01Icon}
                size={16}
                strokeWidth={1.8}
              />
              <Input
                className="h-11 rounded-xl border-border/80 bg-background/70 pl-10"
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="搜索 skill id / runtime / status"
                value={query}
              />
            </label>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-0">
        {isLoading && skills.length === 0 ? (
          <div className="space-y-3 px-6 py-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : skills.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border px-4 py-10 text-sm text-muted-foreground">
              当前项目没有匹配的技能。
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[min(68vh,820px)]">
              <Table className="min-w-[860px]">
                <TableHeader className="sticky top-0 z-10 bg-card/96 backdrop-blur supports-[backdrop-filter]:bg-card/88">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-6">Skill</TableHead>
                    <TableHead>Runtime</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">Traces</TableHead>
                    <TableHead className="text-right">版本</TableHead>
                    <TableHead className="pr-6 text-right">最近更新</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.pageItems.map((skill) => {
                    const skillKey = `${skill.skillId}:${skill.runtime ?? 'unknown'}`
                    return (
                      <TableRow
                        className={cn(
                          'cursor-pointer border-border/70 transition-colors hover:bg-muted/35',
                          selectedSkillKey === skillKey && 'bg-primary/8',
                        )}
                        data-state={selectedSkillKey === skillKey ? 'selected' : undefined}
                        key={skillKey}
                        onClick={() => onSelectSkill(skill)}
                      >
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{skill.skillId}</span>
                            <span className="text-xs text-muted-foreground">
                              effective v{skill.effectiveVersion ?? '--'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">{skill.runtime ?? 'unknown'}</TableCell>
                        <TableCell className="py-4">
                          <Badge variant={getSkillStatusBadgeVariant(skill.status)}>
                            {skill.status ?? 'pending'}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 text-right">
                          {formatCompactNumber(skill.traceCount)}
                        </TableCell>
                        <TableCell className="py-4 text-right">
                          {formatCompactNumber(skill.versionsAvailable?.length ?? 0)}
                        </TableCell>
                        <TableCell className="pr-6 py-4 text-right text-muted-foreground">
                          {formatRelativeTime(skill.updatedAt)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex flex-col gap-4 border-t border-border/70 px-6 py-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="text-sm text-muted-foreground">
                显示第 {(pagination.currentPage - 1) * pagination.pageSize + 1}-
                {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)} 条，共{' '}
                {pagination.totalItems} 条
              </div>
              <Pagination className="mx-0 w-auto justify-start xl:justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault()
                        if (pagination.hasPreviousPage) {
                          setPage(pagination.currentPage - 1)
                        }
                      }}
                      text="上一页"
                    />
                  </PaginationItem>

                  {visiblePages.map((pageNumber, index) => {
                    const previousPage = visiblePages[index - 1]
                    const shouldShowEllipsis = previousPage && pageNumber - previousPage > 1

                    return (
                      <Fragment key={pageNumber}>
                        {shouldShowEllipsis ? (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : null}
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            isActive={pagination.currentPage === pageNumber}
                            onClick={(event) => {
                              event.preventDefault()
                              setPage(pageNumber)
                            }}
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      </Fragment>
                    )
                  })}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault()
                        if (pagination.hasNextPage) {
                          setPage(pagination.currentPage + 1)
                        }
                      }}
                      text="下一页"
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
