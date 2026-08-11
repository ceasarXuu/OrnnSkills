import { Layers01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { SkillContentEditor } from '@/components/skill-content-editor'
import { SkillMarketplaceReview } from '@/components/skill-marketplace-review'
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
  DashboardSkillFamily,
  DashboardSkillInstance,
  DashboardProject,
} from '@/types/dashboard'

interface SkillFamilyDetailProps {
  actionMessage: string | null
  detailError: string | null
  draftContent: string
  family: DashboardSkillFamily | null
  isCheckingMarketplace: boolean
  isLoading: boolean
  isSaving: boolean
  marketplaceReview: {
    source: { repo: string; skill: string; url: string }
    content: string
    localContent: string
  } | null
  onApplyMarketplaceChanges: (mergedContent: string) => void
  onCheckMarketplace: () => void
  onCloseMarketplaceReview: () => void
  onDraftChange: (value: string) => void
  onPreferredProjectChange: (projectPath: string) => void
  onSave: () => void
  preferredProjectPath: string
  projects: DashboardProject[]
  selectedInstance: DashboardSkillInstance | null
}

export function SkillFamilyDetail({
  actionMessage,
  detailError,
  draftContent,
  family,
  isCheckingMarketplace,
  isLoading,
  isSaving,
  marketplaceReview,
  onApplyMarketplaceChanges,
  onCheckMarketplace,
  onCloseMarketplaceReview,
  onDraftChange,
  onPreferredProjectChange,
  onSave,
  preferredProjectPath,
  projects,
  selectedInstance,
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
            <ProjectSelector
              onPreferredProjectChange={onPreferredProjectChange}
              preferredProjectPath={preferredProjectPath}
              projects={projects}
            />
          </div>
        </CardHeader>
        <CardContent className="py-20 text-center text-sm text-muted-foreground">
          {t('noSkillFamilySelected')}
        </CardContent>
      </Card>
    )
  }

  const installLocation = selectedInstance?.projectPath === '~' ? '全局 skills' : selectedInstance?.projectPath ?? preferredProjectPath
  const runtimeLabel = selectedInstance?.runtime ?? 'generic'

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
            <Badge variant={getSkillStatusBadgeVariant(family.status)}>{family.status ?? 'partial'}</Badge>
            <Badge variant="outline">{t('lastCalled')} {formatRelativeTime(family.usage.lastUsedAt ?? family.lastUsedAt, locale, t('invalidDate'))}</Badge>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-5">
          <ProjectSelector
            onPreferredProjectChange={onPreferredProjectChange}
            preferredProjectPath={preferredProjectPath}
            projects={projects}
          />

          <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-background/45 p-1">
            <Button
              className="h-8 rounded-lg px-3"
              disabled={isCheckingMarketplace || Boolean(marketplaceReview) || !selectedInstance}
              onClick={() => void onCheckMarketplace()}
              size="sm"
              variant="ghost"
            >
              {isCheckingMarketplace ? t('checkingMarketplace') : t('checkMarketplace')}
            </Button>
            <Button className="h-8 rounded-lg px-3" disabled={isSaving || Boolean(marketplaceReview)} onClick={() => void onSave()} size="sm">
              {isSaving ? t('saving') : t('saveSkillContent')}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <Badge variant="outline">{runtimeLabel}</Badge>
          <span className="truncate">{installLocation}</span>
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
            detailError={detailError}
            draftContent={draftContent}
            onDraftChange={onDraftChange}
          />
        )}
      </CardContent>
    </Card>
  )
}

function ProjectSelector({
  onPreferredProjectChange,
  preferredProjectPath,
  projects,
}: {
  onPreferredProjectChange: (projectPath: string) => void
  preferredProjectPath: string
  projects: DashboardProject[]
}) {
  const { t } = useI18n()

  return (
    <div className="grid w-[220px] max-w-full shrink-0 grid-cols-1 gap-1 rounded-xl border border-border/70 bg-background/45 p-1">
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
