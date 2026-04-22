import { Layers01Icon, LinkCircle02Icon, TimeQuarterPassIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  formatCompactNumber,
  formatDateTime,
  formatRelativeTime,
  getSkillStatusBadgeVariant,
} from '@/lib/format'
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
  draftContent: string
  family: DashboardSkillFamily | null
  instances: DashboardSkillInstance[]
  isApplying: boolean
  isLoading: boolean
  isSaving: boolean
  onApplyToFamily: () => void
  onDraftChange: (value: string) => void
  onLoadApplyPreview: () => void
  onPreferredProjectChange: (projectPath: string) => void
  onSelectInstance: (instanceId: string) => void
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
  draftContent,
  family,
  instances,
  isApplying,
  isLoading,
  isSaving,
  onApplyToFamily,
  onDraftChange,
  onLoadApplyPreview,
  onPreferredProjectChange,
  onSelectInstance,
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
          先从左侧选择一个 skill family。
        </CardContent>
      </Card>
    )
  }

  const runtimeOptions = family.runtimes.length > 0 ? family.runtimes : [preferredRuntime]

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/92">
        <CardHeader className="gap-4 border-b border-border/70">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={Layers01Icon} size={18} strokeWidth={1.8} />
                <CardTitle className="text-2xl">{family.familyName}</CardTitle>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{family.instanceCount} instances</Badge>
                <Badge variant="outline">{family.projectCount} projects</Badge>
                <Badge variant="outline">{family.revisionCount} revisions</Badge>
                <Badge variant={getSkillStatusBadgeVariant(family.status)}>{family.status ?? 'partial'}</Badge>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 xl:max-w-[560px]">
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
                最近调用 {formatRelativeTime(family.usage.lastUsedAt ?? family.lastUsedAt)}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Observed Calls" value={formatCompactNumber(family.usage.observedCalls)} />
            <Metric label="Analyzed Touches" value={formatCompactNumber(family.usage.analyzedTouches)} />
            <Metric label="Optimized" value={formatCompactNumber(family.usage.optimizedCount)} />
            <Metric label="Diverged Content" value={family.hasDivergedContent ? 'Yes' : 'No'} />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="text-sm font-medium">Instances</div>
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-3 pb-1">
                {instances.map((instance) => {
                  const isActive = instance.instanceId === selectedInstance?.instanceId
                  return (
                    <button
                      className={`min-w-[220px] rounded-xl border px-4 py-3 text-left ${
                        isActive
                          ? 'border-primary/50 bg-primary/8'
                          : 'border-border/70 bg-background/40 hover:border-primary/30 hover:bg-muted/40'
                      }`}
                      key={instance.instanceId}
                      onClick={() => onSelectInstance(instance.instanceId)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{instance.projectPath.split('/').at(-1) ?? instance.projectPath}</div>
                        <Badge variant={getSkillStatusBadgeVariant(instance.status)}>{instance.status}</Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {instance.runtime} · effective v{instance.effectiveVersion ?? '--'} ·{' '}
                        {formatRelativeTime(instance.lastUsedAt)}
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="border-border/70 bg-card/92">
          <CardHeader className="gap-4 border-b border-border/70">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-1">
                <CardTitle>正文</CardTitle>
                <div className="text-sm text-muted-foreground">
                  {selectedInstance?.projectPath ?? '暂无实例'} · {selectedInstance?.runtime ?? preferredRuntime}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void onLoadApplyPreview()} size="sm" variant="outline">
                  预览传播
                </Button>
                <Button disabled={isSaving} onClick={() => void onSave()} size="sm">
                  {isSaving ? '保存中' : '保存正文'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {detailError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {detailError}
              </div>
            ) : null}

            <Textarea
              className="min-h-[420px] rounded-xl border-border/80 bg-background/60 font-mono text-sm"
              onChange={(event) => onDraftChange(event.target.value)}
              value={draftContent}
            />

            {actionMessage ? <div className="text-sm text-muted-foreground">{actionMessage}</div> : null}

            {applyPreview ? (
              <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <HugeiconsIcon icon={LinkCircle02Icon} size={16} strokeWidth={1.8} />
                  将影响 {applyPreview.totalTargets} 个同族实例
                </div>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {applyPreview.targets.slice(0, 6).map((target) => (
                    <div className="flex items-center justify-between gap-3" key={`${target.projectPath}:${target.runtime}`}>
                      <span>{target.projectPath}</span>
                      <span>{target.runtime}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Button disabled={isApplying} onClick={() => void onApplyToFamily()} size="sm">
                    {isApplying ? '应用中' : '应用到同族实例'}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/92">
          <CardHeader className="gap-2 border-b border-border/70">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={TimeQuarterPassIcon} size={18} strokeWidth={1.8} />
              <CardTitle>版本历史</CardTitle>
            </div>
            <div className="text-sm text-muted-foreground">
              effective v{detail?.effectiveVersion ?? selectedInstance?.effectiveVersion ?? '--'}
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <ScrollArea className="h-[min(72vh,760px)]">
              <div className="space-y-2 px-4 py-4">
                {(detail?.versions ?? []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    当前没有版本记录。
                  </div>
                ) : (
                  [...(detail?.versions ?? [])].reverse().map((version) => {
                    const metadata = versionMetadataByNumber[version]
                    const isDisabled = Boolean(metadata?.isDisabled)
                    return (
                      <div
                        className={`rounded-xl border px-4 py-3 ${
                          selectedVersion === version
                            ? 'border-primary/50 bg-primary/8'
                            : 'border-border/70 bg-background/30'
                        }`}
                        key={version}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            className="min-w-0 flex-1 text-left"
                            onClick={() => void onSelectVersion(version)}
                            type="button"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">v{version}</span>
                              {detail?.effectiveVersion === version && !isDisabled ? (
                                <Badge variant="outline">effective</Badge>
                              ) : null}
                              {isDisabled ? <Badge variant="destructive">disabled</Badge> : null}
                            </div>
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              <div>{metadata?.reason ?? 'No reason'}</div>
                              <div>{formatDateTime(metadata?.createdAt)}</div>
                            </div>
                          </button>
                          <Button
                            onClick={() => void onToggleVersionDisabled(version, !isDisabled)}
                            size="xs"
                            variant="outline"
                          >
                            {isDisabled ? '恢复' : '停用'}
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
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
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_200px]">
      <Select onValueChange={onPreferredProjectChange} value={preferredProjectPath || undefined}>
        <SelectTrigger className="w-full rounded-xl">
          <SelectValue placeholder="选择优先项目" />
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
        <SelectTrigger className="w-full rounded-xl">
          <SelectValue placeholder="切换 runtime" />
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/40 px-4 py-4">
      <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
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
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-[560px] w-full" />
        <Skeleton className="h-[560px] w-full" />
      </div>
    </div>
  )
}
