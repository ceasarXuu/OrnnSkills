import { Layers01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { SkillContentEditor } from '@/components/skill-content-editor'
import { SkillVersionHistory } from '@/components/skill-version-history'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  formatCompactNumberForLocale,
  formatRelativeTime,
  getSkillStatusBadgeVariant,
} from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import type {
  DashboardSkillApplyPreview,
  DashboardSkillDetail,
  DashboardSkillFamily,
  DashboardSkillInstance,
  DashboardSkillVersionMetadata,
  DashboardProject,
  SkillDomainRuntime,
} from '@/types/dashboard'

interface SkillFamilyDetailProps {
  actionMessage: string | null
  applyPreview: DashboardSkillApplyPreview | null
  detail: DashboardSkillDetail | null
  detailError: string | null
  diffContent: string | null
  diffVersion: number | null
  draftContent: string
  family: DashboardSkillFamily | null
  isApplying: boolean
  isLoading: boolean
  isSaving: boolean
  onApplyToFamily: () => void
  onDraftChange: (value: string) => void
  onLoadApplyPreview: () => void
  onSelectDiffVersion: (version: number | null) => void
  onPreferredProjectChange: (projectPath: string) => void
  onSelectVersion: (version: number) => void
  onSave: () => void
  onSwitchRuntime: (runtime: SkillDomainRuntime) => void
  onToggleVersionDisabled: (version: number, disabled: boolean) => void
  preferredProjectPath: string
  preferredRuntime: SkillDomainRuntime
  projects: DashboardProject[]
  selectedInstance: DashboardSkillInstance | null
  selectedVersion: number | null
  versionMetadataByNumber: Record<number, DashboardSkillVersionMetadata>
}

export function SkillFamilyDetail({
  actionMessage,
  applyPreview,
  detail,
  detailError,
  diffContent,
  diffVersion,
  draftContent,
  family,
  isApplying,
  isLoading,
  isSaving,
  onApplyToFamily,
  onDraftChange,
  onLoadApplyPreview,
  onSelectDiffVersion,
  onPreferredProjectChange,
  onSelectVersion,
  onSave,
  onSwitchRuntime,
  onToggleVersionDisabled,
  preferredProjectPath,
  preferredRuntime,
  projects,
  selectedInstance,
  selectedVersion,
  versionMetadataByNumber,
}: SkillFamilyDetailProps) {
  const { locale, t } = useI18n()

  if (isLoading && !family) {
    return <SkillFamilyDetailSkeleton />
  }

  if (!family) {
    return (
      <Card className="border-border/70">
        <CardHeader className="gap-4 border-b border-border/70">
          <div className="flex w-full justify-end">
            <DetailSelectors
              onPreferredProjectChange={onPreferredProjectChange}
              onSwitchRuntime={onSwitchRuntime}
              preferredProjectPath={preferredProjectPath}
              preferredRuntime={preferredRuntime}
              projects={projects}
              runtimeOptions={[preferredRuntime]}
              selectedRuntime={preferredRuntime}
            />
          </div>
        </CardHeader>
        <CardContent className="py-20 text-center text-sm text-muted-foreground">
          {t('noSkillFamilySelected')}
        </CardContent>
      </Card>
    )
  }

  const runtimeOptions = family.runtimes.length > 0 ? family.runtimes : [preferredRuntime]

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/92">
        <CardHeader className="gap-4 border-b border-border/70">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={Layers01Icon} size={18} strokeWidth={1.8} />
                <CardTitle className="text-2xl">{family.familyName}</CardTitle>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{formatCompactNumberForLocale(family.instanceCount, locale)} {t('instances')}</Badge>
                <Badge variant="outline">{formatCompactNumberForLocale(family.projectCount, locale)} {t('projects')}</Badge>
                <Badge variant="outline">{formatCompactNumberForLocale(family.revisionCount, locale)} {t('revisions')}</Badge>
                <Badge variant={getSkillStatusBadgeVariant(family.status)}>{family.status ?? 'partial'}</Badge>
              </div>
            </div>

            <div className="flex w-[560px] shrink-0 flex-col gap-3">
              <DetailSelectors
                onPreferredProjectChange={onPreferredProjectChange}
                onSwitchRuntime={onSwitchRuntime}
                preferredProjectPath={preferredProjectPath}
                preferredRuntime={preferredRuntime}
                projects={projects}
                runtimeOptions={runtimeOptions}
                selectedRuntime={selectedInstance?.runtime ?? preferredRuntime}
              />
              <div className="text-sm text-muted-foreground">
                {t('lastCalled')} {formatRelativeTime(family.usage.lastUsedAt ?? family.lastUsedAt, locale, t('invalidDate'))}
              </div>
            </div>
          </div>
        </CardHeader>

      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-6">
        <SkillContentEditor
          actionMessage={actionMessage}
          applyPreview={applyPreview}
          detailError={detailError}
          diffContent={diffContent}
          diffVersion={diffVersion}
          draftContent={draftContent}
          isApplying={isApplying}
          isSaving={isSaving}
          onApplyToFamily={onApplyToFamily}
          onDraftChange={onDraftChange}
          onLoadApplyPreview={onLoadApplyPreview}
          onSave={onSave}
          preferredRuntime={preferredRuntime}
          selectedInstance={selectedInstance}
          selectedVersion={selectedVersion}
        />

        <SkillVersionHistory
          detail={detail}
          diffVersion={diffVersion}
          onSelectDiffVersion={onSelectDiffVersion}
          onSelectVersion={onSelectVersion}
          onToggleVersionDisabled={onToggleVersionDisabled}
          selectedInstance={selectedInstance}
          selectedVersion={selectedVersion}
          versionMetadataByNumber={versionMetadataByNumber}
        />
      </div>
    </div>
  )
}

function DetailSelectors({
  onPreferredProjectChange,
  onSwitchRuntime,
  preferredProjectPath,
  preferredRuntime,
  projects,
  runtimeOptions,
  selectedRuntime,
}: {
  onPreferredProjectChange: (projectPath: string) => void
  onSwitchRuntime: (runtime: SkillDomainRuntime) => void
  preferredProjectPath: string
  preferredRuntime: SkillDomainRuntime
  projects: DashboardProject[]
  runtimeOptions: SkillDomainRuntime[]
  selectedRuntime: SkillDomainRuntime
}) {
  const { t } = useI18n()

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_200px] gap-3">
      <Select onValueChange={onPreferredProjectChange} value={preferredProjectPath || undefined}>
        <SelectTrigger aria-label={t('selectPreferredProject')} className="w-full rounded-xl">
          <SelectValue placeholder={t('selectPreferredProject')} />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.path} value={project.path}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(value) => onSwitchRuntime(value as SkillDomainRuntime)}
        value={selectedRuntime ?? preferredRuntime}
      >
        <SelectTrigger aria-label={t('switchRuntime')} className="w-full rounded-xl">
          <SelectValue placeholder={t('switchRuntime')} />
        </SelectTrigger>
        <SelectContent>
          {runtimeOptions.map((runtime) => (
            <SelectItem key={runtime} value={runtime}>
              {runtime}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function SkillFamilyDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="border-border/70">
        <CardContent className="space-y-4 py-6">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-6">
        <Skeleton className="h-[560px] w-full" />
        <Skeleton className="h-[560px] w-full" />
      </div>
    </div>
  )
}
