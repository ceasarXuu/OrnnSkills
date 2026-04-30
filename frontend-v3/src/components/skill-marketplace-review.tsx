import { useCallback, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import {
  buildSkillVersionDiff,
  type SkillVersionDiffLine,
} from '@/lib/skill-version-diff'

interface SkillMarketplaceReviewProps {
  localContent: string
  marketplaceContent: string
  source: { repo: string; skill: string; url: string }
  onApply: (mergedContent: string) => void
  onCancel: () => void
}

type GroupDecision = 'accepted' | 'rejected'

interface ChangeGroup {
  id: string
  startIndex: number
  endIndex: number
}

/**
 * Scan diff rows and group consecutive added/removed lines into change groups.
 * Context lines between change groups are left ungrouped.
 */
function buildChangeGroups(rows: SkillVersionDiffLine[]): ChangeGroup[] {
  const groups: ChangeGroup[] = []
  let i = 0
  while (i < rows.length) {
    if (rows[i].kind !== 'context') {
      const start = i
      while (i < rows.length && rows[i].kind !== 'context') i++
      groups.push({ id: `group-${groups.length}`, startIndex: start, endIndex: i - 1 })
    } else {
      i++
    }
  }
  return groups
}

export function SkillMarketplaceReview({
  localContent,
  marketplaceContent,
  source,
  onApply,
  onCancel,
}: SkillMarketplaceReviewProps) {
  const { t } = useI18n()
  const rows = useMemo(
    () => buildSkillVersionDiff(localContent, marketplaceContent),
    [localContent, marketplaceContent],
  )
  const changeGroups = useMemo(() => buildChangeGroups(rows), [rows])

  // No default — user must explicitly choose per group
  const [decisions, setDecisions] = useState<Record<string, GroupDecision>>({})

  const setGroupDecision = useCallback((groupId: string, decision: GroupDecision) => {
    setDecisions((prev) => ({ ...prev, [groupId]: decision }))
  }, [])

  const acceptAll = useCallback(() => {
    const next: Record<string, GroupDecision> = {}
    for (const group of changeGroups) {
      next[group.id] = 'accepted'
    }
    setDecisions(next)
  }, [changeGroups])

  const rejectAll = useCallback(() => {
    const next: Record<string, GroupDecision> = {}
    for (const group of changeGroups) {
      next[group.id] = 'rejected'
    }
    setDecisions(next)
  }, [changeGroups])

  const decidedCount = useMemo(
    () => changeGroups.filter((g) => decisions[g.id] != null).length,
    [changeGroups, decisions],
  )

  // Build a lookup: row index → change group (if any)
  const rowGroupMap = useMemo(() => {
    const map = new Map<number, ChangeGroup>()
    for (const group of changeGroups) {
      for (let i = group.startIndex; i <= group.endIndex; i++) {
        map.set(i, group)
      }
    }
    return map
  }, [changeGroups])

  const handleApply = useCallback(() => {
    const mergedLines: string[] = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const group = rowGroupMap.get(i)
      // Undecided groups default to 'rejected' (keep local)
      const decision = group ? (decisions[group.id] ?? 'rejected') : 'rejected'

      if (row.kind === 'context') {
        mergedLines.push(row.content)
      } else if (row.kind === 'removed') {
        // rejected = keep local (include removed line); accepted = drop local line
        if (decision === 'rejected') mergedLines.push(row.content)
      } else {
        // added: accepted = include new line; rejected = skip
        if (decision === 'accepted') mergedLines.push(row.content)
      }
    }
    onApply(mergedLines.join('\n'))
  }, [rows, rowGroupMap, decisions, onApply])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/45 px-4 py-3">
        <div className="space-y-1">
          <div className="text-sm font-medium">{t('marketplaceReview')}</div>
          <div className="text-xs text-muted-foreground">
            {t('marketplaceSource')}: {source.repo}/{source.skill}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={acceptAll}>
            {t('acceptAll')}
          </Button>
          <Button size="sm" variant="ghost" onClick={rejectAll}>
            {t('rejectAll')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {decidedCount}/{changeGroups.length}
          </span>
        </div>
      </div>

      {/* Full diff */}
      <div
        aria-label="Marketplace skill diff"
        className="max-h-[620px] overflow-auto rounded-xl border border-border/80 bg-background/70 font-mono text-xs leading-6"
        tabIndex={0}
      >
        {rows.map((row, i) => {
            const group = rowGroupMap.get(i)
            const decision = group ? decisions[group.id] : undefined
            const isGroupStart = group && i === group.startIndex

            const bgClass =
              row.kind === 'added'
                ? decision === 'accepted'
                  ? 'bg-emerald-500/12 text-emerald-100'
                  : 'bg-emerald-500/10 text-emerald-200/70'
                : row.kind === 'removed'
                  ? decision === 'rejected'
                    ? 'bg-red-500/12 text-red-100'
                    : 'bg-red-500/10 text-red-200/70 line-through'
                  : 'text-muted-foreground'

            const prefix = row.kind === 'added' ? '+' : row.kind === 'removed' ? '-' : ' '

            return (
              <div key={i}>
                {/* Group header bar — rendered before the first line of each change group */}
                {isGroupStart && group && (
                  <div className="flex items-center justify-between border-b border-border/40 bg-background/60 px-3 py-1.5">
                    <span className="text-muted-foreground">
                      @@ -{row.oldLineNumber ?? '?'} +{row.newLineNumber ?? '?'} @@
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        className={`h-6 rounded-md px-2.5 text-xs ${
                          decision === 'accepted'
                            ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                            : 'bg-transparent text-muted-foreground hover:bg-muted/60'
                        }`}
                        onClick={() => setGroupDecision(group.id, 'accepted')}
                        size="sm"
                      >
                        {t('acceptChange')}
                      </Button>
                      <Button
                        className={`h-6 rounded-md px-2.5 text-xs ${
                          decision === 'rejected'
                            ? 'bg-red-700 text-white hover:bg-red-800'
                            : 'bg-transparent text-muted-foreground hover:bg-muted/60'
                        }`}
                        onClick={() => setGroupDecision(group.id, 'rejected')}
                        size="sm"
                      >
                        {t('rejectChange')}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Diff line */}
                <div
                  className={`grid grid-cols-[56px_56px_24px_minmax(0,1fr)] border-b border-border/25 ${bgClass}`}
                >
                  <span className="select-none border-r border-border/35 px-2 text-right text-muted-foreground">
                    {row.oldLineNumber ?? ''}
                  </span>
                  <span className="select-none border-r border-border/35 px-2 text-right text-muted-foreground">
                    {row.newLineNumber ?? ''}
                  </span>
                  <span className="select-none px-2">{prefix}</span>
                  <span className="whitespace-pre px-2">{row.content || ' '}</span>
                </div>
              </div>
            )
          })}
        </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button onClick={handleApply}>
          {t('applyToDraft')}
        </Button>
      </div>
    </div>
  )
}
