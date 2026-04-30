export type SkillVersionDiffLineKind = 'context' | 'added' | 'removed'

export interface SkillVersionDiffLine {
  content: string
  kind: SkillVersionDiffLineKind
  newLineNumber: number | null
  oldLineNumber: number | null
}

export function buildSkillVersionDiff(oldContent: string, newContent: string) {
  const oldLines = splitLines(oldContent)
  const newLines = splitLines(newContent)
  const lengths = buildLcsLengths(oldLines, newLines)
  const rows: SkillVersionDiffLine[] = []
  let oldIndex = 0
  let newIndex = 0
  let oldLineNumber = 1
  let newLineNumber = 1

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex >= oldLines.length) {
      rows.push({
        content: newLines[newIndex],
        kind: 'added',
        newLineNumber,
        oldLineNumber: null,
      })
      newIndex += 1
      newLineNumber += 1
    } else if (newIndex >= newLines.length) {
      rows.push({
        content: oldLines[oldIndex],
        kind: 'removed',
        newLineNumber: null,
        oldLineNumber,
      })
      oldIndex += 1
      oldLineNumber += 1
    } else if (oldLines[oldIndex] === newLines[newIndex]) {
      rows.push({
        content: oldLines[oldIndex],
        kind: 'context',
        newLineNumber,
        oldLineNumber,
      })
      oldIndex += 1
      newIndex += 1
      oldLineNumber += 1
      newLineNumber += 1
    } else if (newIndex < newLines.length && lengths[oldIndex][newIndex + 1] >= lengths[oldIndex + 1][newIndex]) {
      rows.push({
        content: newLines[newIndex],
        kind: 'added',
        newLineNumber,
        oldLineNumber: null,
      })
      newIndex += 1
      newLineNumber += 1
    } else {
      rows.push({
        content: oldLines[oldIndex],
        kind: 'removed',
        newLineNumber: null,
        oldLineNumber,
      })
      oldIndex += 1
      oldLineNumber += 1
    }
  }

  return rows
}

function splitLines(content: string) {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  return lines.length > 1 && lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines
}

function buildLcsLengths(oldLines: string[], newLines: string[]) {
  const lengths = Array.from({ length: oldLines.length + 1 }, () => Array(newLines.length + 1).fill(0))
  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      lengths[oldIndex][newIndex] =
        oldLines[oldIndex] === newLines[newIndex]
          ? lengths[oldIndex + 1][newIndex + 1] + 1
          : Math.max(lengths[oldIndex + 1][newIndex], lengths[oldIndex][newIndex + 1])
    }
  }
  return lengths
}

const CONTEXT_LINES = 2

export interface SkillDiffHunk {
  id: string
  lines: SkillVersionDiffLine[]
  oldRange: { start: number; end: number }
  newRange: { start: number; end: number }
  hasChanges: boolean
}

/**
 * Group diff lines into hunks. Each hunk contains a contiguous block of
 * added/removed lines surrounded by CONTEXT_LINES of context on each side.
 */
export function buildSkillDiffHunks(
  oldContent: string,
  newContent: string,
): SkillDiffHunk[] {
  const rows = buildSkillVersionDiff(oldContent, newContent)
  if (rows.length === 0) return []

  // Find indices of rows that are actual changes (added/removed)
  const changeIndices: number[] = []
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].kind !== 'context') {
      changeIndices.push(i)
    }
  }

  if (changeIndices.length === 0) {
    // No changes — return a single context-only hunk
    return [
      {
        id: 'hunk-0',
        lines: rows,
        oldRange: {
          start: rows[0].oldLineNumber ?? 1,
          end: rows[rows.length - 1].oldLineNumber ?? rows[0].oldLineNumber ?? 1,
        },
        newRange: {
          start: rows[0].newLineNumber ?? 1,
          end: rows[rows.length - 1].newLineNumber ?? rows[0].newLineNumber ?? 1,
        },
        hasChanges: false,
      },
    ]
  }

  // Group change indices into clusters (consecutive or separated by <= CONTEXT_LINES*2 context lines)
  const clusters: Array<{ start: number; end: number }> = []
  let clusterStart = changeIndices[0]
  let clusterEnd = changeIndices[0]

  for (let i = 1; i < changeIndices.length; i++) {
    const gap = changeIndices[i] - clusterEnd
    if (gap <= CONTEXT_LINES * 2 + 2) {
      // Merge into current cluster
      clusterEnd = changeIndices[i]
    } else {
      clusters.push({ start: clusterStart, end: clusterEnd })
      clusterStart = changeIndices[i]
      clusterEnd = changeIndices[i]
    }
  }
  clusters.push({ start: clusterStart, end: clusterEnd })

  // Build hunks with context padding
  const hunks: SkillDiffHunk[] = []
  for (let ci = 0; ci < clusters.length; ci++) {
    const { start, end } = clusters[ci]
    const hunkStart = Math.max(0, start - CONTEXT_LINES)
    const hunkEnd = Math.min(rows.length - 1, end + CONTEXT_LINES)
    const lines = rows.slice(hunkStart, hunkEnd + 1)

    const firstOld = lines.find((l) => l.oldLineNumber !== null)
    const lastOld = [...lines].reverse().find((l) => l.oldLineNumber !== null)
    const firstNew = lines.find((l) => l.newLineNumber !== null)
    const lastNew = [...lines].reverse().find((l) => l.newLineNumber !== null)

    hunks.push({
      id: `hunk-${ci}`,
      lines,
      oldRange: {
        start: firstOld?.oldLineNumber ?? 1,
        end: lastOld?.oldLineNumber ?? firstOld?.oldLineNumber ?? 1,
      },
      newRange: {
        start: firstNew?.newLineNumber ?? 1,
        end: lastNew?.newLineNumber ?? firstNew?.newLineNumber ?? 1,
      },
      hasChanges: true,
    })
  }

  return hunks
}
