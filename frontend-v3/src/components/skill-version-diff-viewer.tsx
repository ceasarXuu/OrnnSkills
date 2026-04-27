import { useMemo } from 'react'
import { buildSkillVersionDiff } from '@/lib/skill-version-diff'

interface SkillVersionDiffViewerProps {
  newContent: string
  newVersion: number | null
  oldContent: string
  oldVersion: number | null
}

export function SkillVersionDiffViewer({
  newContent,
  newVersion,
  oldContent,
  oldVersion,
}: SkillVersionDiffViewerProps) {
  const rows = useMemo(() => buildSkillVersionDiff(oldContent, newContent), [newContent, oldContent])

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-background/70">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-2 font-mono text-xs text-muted-foreground">
        <span>v{oldVersion ?? '--'}</span>
        <span>v{newVersion ?? '--'}</span>
      </div>
      <div
        aria-label="Skill version diff"
        className="max-h-[620px] overflow-auto font-mono text-xs leading-6"
        tabIndex={0}
      >
        {rows.map((row, index) => {
          const prefix = row.kind === 'added' ? '+' : row.kind === 'removed' ? '-' : ' '
          return (
            <div
              className={`grid grid-cols-[56px_56px_24px_minmax(0,1fr)] border-b border-border/25 ${
                row.kind === 'added'
                  ? 'bg-emerald-500/12 text-emerald-100'
                  : row.kind === 'removed'
                    ? 'bg-red-500/12 text-red-100'
                    : 'text-muted-foreground'
              }`}
              key={`${index}:${row.kind}`}
            >
              <span className="select-none border-r border-border/35 px-2 text-right text-muted-foreground">
                {row.oldLineNumber ?? ''}
              </span>
              <span className="select-none border-r border-border/35 px-2 text-right text-muted-foreground">
                {row.newLineNumber ?? ''}
              </span>
              <span className="select-none px-2">{prefix}</span>
              <span className="whitespace-pre px-2 text-foreground">{row.content || ' '}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
