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
