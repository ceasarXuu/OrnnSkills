import { TimeQuarterPassIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDateTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import type {
  DashboardSkillDetail,
  DashboardSkillInstance,
  DashboardSkillVersionMetadata,
} from '@/types/dashboard'

interface SkillVersionHistoryProps {
  detail: DashboardSkillDetail | null
  diffVersion: number | null
  onSelectDiffVersion: (version: number | null) => void
  onSelectVersion: (version: number) => void
  onToggleVersionDisabled: (version: number, disabled: boolean) => void
  selectedInstance: DashboardSkillInstance | null
  selectedVersion: number | null
  versionMetadataByNumber: Record<number, DashboardSkillVersionMetadata>
}

const NO_DIFF_VALUE = '__no_diff__'

export function SkillVersionHistory({
  detail,
  diffVersion,
  onSelectDiffVersion,
  onSelectVersion,
  onToggleVersionDisabled,
  selectedInstance,
  selectedVersion,
  versionMetadataByNumber,
}: SkillVersionHistoryProps) {
  const { locale, t } = useI18n()
  const versions = detail?.versions ?? []
  const currentVersion =
    selectedVersion ?? detail?.effectiveVersion ?? selectedInstance?.effectiveVersion ?? versions[versions.length - 1] ?? null
  const currentMetadata = currentVersion ? versionMetadataByNumber[currentVersion] : null
  const isCurrentDisabled = Boolean(currentMetadata?.isDisabled)

  return (
    <Card className="border-border/70 bg-card/92">
      <CardHeader className="gap-2 border-b border-border/70">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <HugeiconsIcon icon={TimeQuarterPassIcon} size={18} strokeWidth={1.8} />
            <CardTitle>{t('versionHistory')}</CardTitle>
          </div>
          <Badge variant="outline">
            {t('effective')} v{detail?.effectiveVersion ?? selectedInstance?.effectiveVersion ?? '--'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {versions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            {t('noVersions')}
          </div>
        ) : (
          <>
            <VersionSelect
              ariaLabel={t('selectVersionToView')}
              label={t('viewVersion')}
              onChange={(version) => {
                if (version !== null) onSelectVersion(version)
              }}
              value={currentVersion}
              versions={versions}
            />
            <VersionSelect
              ariaLabel={t('selectVersionToDiff')}
              excludeVersion={currentVersion}
              label={t('diffAgainst')}
              onChange={(version) => onSelectDiffVersion(version)}
              optionalLabel={t('noDiff')}
              value={diffVersion}
              versions={versions}
            />
            <div className="rounded-xl border border-border/70 bg-background/35 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">v{currentVersion ?? '--'}</span>
                    {isCurrentDisabled ? <Badge variant="destructive">{t('disabled')}</Badge> : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {currentMetadata?.reason ?? t('noReason')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(currentMetadata?.createdAt, locale, t('invalidDate'))}
                  </div>
                </div>
                {currentVersion ? (
                  <Button
                    onClick={() => void onToggleVersionDisabled(currentVersion, !isCurrentDisabled)}
                    size="xs"
                    variant="outline"
                  >
                    {isCurrentDisabled ? t('restore') : t('deactivate')}
                  </Button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function VersionSelect({
  ariaLabel,
  excludeVersion,
  label,
  onChange,
  optionalLabel,
  value,
  versions,
}: {
  ariaLabel: string
  excludeVersion?: number | null
  label: string
  onChange: (version: number | null) => void
  optionalLabel?: string
  value: number | null
  versions: number[]
}) {
  const selectableVersions = [...versions].reverse().filter((version) => version !== excludeVersion)
  const selectValue = value === null ? NO_DIFF_VALUE : String(value)

  return (
    <label className="block space-y-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Select
        onValueChange={(nextValue) => onChange(nextValue === NO_DIFF_VALUE ? null : Number(nextValue))}
        value={selectValue}
      >
        <SelectTrigger aria-label={ariaLabel} className="w-full rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {optionalLabel ? <SelectItem value={NO_DIFF_VALUE}>{optionalLabel}</SelectItem> : null}
          {selectableVersions.map((version) => (
            <SelectItem key={version} value={String(version)}>
              v{version}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}
