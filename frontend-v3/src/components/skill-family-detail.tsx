import { Layers01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { SkillContentEditor } from '@/components/skill-content-editor'
import { SkillMarketplaceReview } from '@/components/skill-marketplace-review'
import { SkillVersionHistory } from '@/components/skill-version-history'
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
  isCheckingMarketplace: boolean
  isLoading: boolean
  isSaving: boolean
  marketplaceReview: {
    source: { repo: string; skill: string; url: string }
    content: string
    localContent: string
  } | null
  onApplyMarketplaceChanges: (mergedContent: string) => void
  onApplyToFamily: () => void
  onCheckMarketplace: () => void
  onCloseApplyPreview: () => void
  onCloseMarketplaceReview: () => void
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
  isCheckingMarketplace,
  isLoading,
  isSaving,
  marketplaceReview,
  onApplyMarketplaceChanges,
  onApplyToFamily,
  onCheckMarketplace,
  onCloseApplyPreview,
  onCloseMarketplaceReview,
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
  const selectedRuntime = selectedInstance?.runtime ?? preferredRuntime
  const isDiffMode = diffVersion !== null && diffContent !== null

  return (
    <Card className="border-border/70 bg-card/92">
      <CardHeader className="gap-5 border-b border-border/70">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Layers01Icon} size={18} strokeWidth={1.8} />
            <CardTitle className="truncate text-2xl">{family.familyName}</CardTitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{formatCompactNumberForLocale(family.instanceCount, locale)} {t('instances')}</Badge>
            <Badge variant="outline">{formatCompactNumberForLocale(family.projectCount, locale)} {t('projects')}</Badge>
            <Badge variant="outline">{formatCompactNumberForLocale(family.revisionCount, locale)} {t('revisions')}</Badge>
            <Badge variant={getSkillStatusBadgeVariant(family.status)}>{family.status ?? 'partial'}</Badge>
            <Badge variant="outline">{t('lastCalled')} {formatRelativeTime(family.usage.lastUsedAt ?? family.lastUsedAt, locale, t('invalidDate'))}</Badge>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-5">
          <DetailSelectors
            onPreferredProjectChange={onPreferredProjectChange}
            onSwitchRuntime={onSwitchRuntime}
            preferredProjectPath={preferredProjectPath}
            preferredRuntime={preferredRuntime}
            projects={projects}
            runtimeOptions={runtimeOptions}
            selectedRuntime={selectedRuntime}
          />

          <div className="rounded-xl border border-border/70 bg-background/45 p-1">
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

          <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-background/45 p-1">
            <Button className="h-8 rounded-lg px-3" onClick={() => void onLoadApplyPreview()} size="sm" variant="ghost">
              {t('previewPropagation')}
            </Button>
            <Button
              className="h-8 rounded-lg px-3"
              disabled={isCheckingMarketplace || isDiffMode || Boolean(marketplaceReview) || !selectedInstance}
              onClick={() => void onCheckMarketplace()}
              size="sm"
              variant="ghost"
            >
              {isCheckingMarketplace ? t('checkingMarketplace') : t('checkMarketplace')}
            </Button>
            <Button className="h-8 rounded-lg px-3" disabled={isSaving || isDiffMode || Boolean(marketplaceReview)} onClick={() => void onSave()} size="sm">
              {isSaving ? t('saving') : t('saveSkillContent')}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {marketplaceReview ? (
          <SkillMarketplaceReview
            localContent={marketplaceReview.localContent}
            marketplaceContent={marketplaceReview.content}
            source={marketplaceReview.source}
            onApply={onApplyMarketplaceChanges}
            onCancel={onCloseMarketplaceReview}
          />
        ) : (
          <SkillContentEditor
            actionMessage={actionMessage}
            applyPreview={applyPreview}
            detailError={detailError}
            diffContent={diffContent}
            diffVersion={diffVersion}
            draftContent={draftContent}
            isApplying={isApplying}
            onApplyToFamily={onApplyToFamily}
            onCloseApplyPreview={onCloseApplyPreview}
            onDraftChange={onDraftChange}
            selectedVersion={selectedVersion}
          />
        )}
      </CardContent>
    </Card>
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
    <div className="grid w-[344px] max-w-full shrink-0 grid-cols-2 gap-1 rounded-xl border border-border/70 bg-background/45 p-1">
      <Select onValueChange={onPreferredProjectChange} value={preferredProjectPath || undefined}>
        <SelectTrigger
          aria-label={t('selectPreferredProject')}
          className="h-8 w-full rounded-lg border-transparent bg-transparent px-3 shadow-none hover:bg-muted/60"
        >
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
        <SelectTrigger
          aria-label={t('switchRuntime')}
          className="h-8 w-full rounded-lg border-transparent bg-transparent px-3 shadow-none hover:bg-muted/60"
        >
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
      <Skeleton className="h-[560px] w-full" />
    </div>
  )
}
