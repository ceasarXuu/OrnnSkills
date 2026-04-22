import {
  ArrowReloadHorizontalIcon,
  CheckmarkCircle02Icon,
  Settings02Icon,
  TaskDone02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { ConfigGovernancePanel } from '@/components/config-governance-panel'
import { ConfigProviderStack } from '@/components/config-provider-stack'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDashboardV3Config } from '@/features/dashboard/use-dashboard-v3-config'
import { formatRelativeTime } from '@/lib/format'

export function ConfigWorkspace() {
  const {
    addProvider,
    catalogError,
    checkConnectivity,
    config,
    connectivityResults,
    hasUnsavedChanges,
    healthError,
    isCheckingConnectivity,
    isLoading,
    isSaving,
    loadError,
    providerCatalog,
    providerHealth,
    refresh,
    removeProvider,
    save,
    saveError,
    setBooleanFlag,
    setDefaultProvider,
    setLogLevel,
    setPromptOverride,
    setPromptSource,
    setSafetyField,
    updateProvider,
  } = useDashboardV3Config()

  return (
    <div className="space-y-6">
      <Card className="border-border/70">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={Settings02Icon} size={18} strokeWidth={1.8} />
                <CardTitle>配置控制台</CardTitle>
              </div>
              <CardDescription className="max-w-3xl">
                这页只负责全局配置，不再混入项目摘要或技能列表。默认 provider、运行策略和演进 prompt 都从这里统一管理。
              </CardDescription>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{config.providers.length} Providers</Badge>
                <Badge variant="outline">{config.defaultProvider || 'No default provider'}</Badge>
                <Badge variant={providerHealth.level === 'ok' ? 'default' : 'secondary'}>
                  Provider Health {providerHealth.level}
                </Badge>
                <Badge variant={hasUnsavedChanges ? 'secondary' : 'outline'}>
                  {hasUnsavedChanges ? '有未保存改动' : '已与磁盘同步'}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void refresh()} variant="outline">
                <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={16} strokeWidth={1.8} />
                重新加载
              </Button>
              <Button disabled={isLoading || isSaving || !hasUnsavedChanges} onClick={() => void save()}>
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} strokeWidth={1.8} />
                {isSaving ? '保存中' : '保存配置'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {loadError ? (
        <Alert variant="destructive">
          <HugeiconsIcon icon={TaskDone02Icon} size={16} strokeWidth={1.8} />
          <AlertTitle>配置加载失败</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {saveError || healthError ? (
        <Alert variant="destructive">
          <HugeiconsIcon icon={TaskDone02Icon} size={16} strokeWidth={1.8} />
          <AlertTitle>配置状态异常</AlertTitle>
          <AlertDescription>{saveError || healthError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.45fr)_420px]">
        <div className="space-y-6">
          <ConfigProviderStack
            catalogError={catalogError}
            config={config}
            connectivityResults={connectivityResults}
            isCheckingConnectivity={isCheckingConnectivity}
            onAddProvider={addProvider}
            onCheckConnectivity={checkConnectivity}
            onRemoveProvider={removeProvider}
            onSetDefaultProvider={setDefaultProvider}
            onUpdateProvider={updateProvider}
            providerCatalog={providerCatalog}
            providerHealth={providerHealth}
          />
        </div>

        <div className="space-y-6">
          <ProviderHealthCard
            checkedAt={providerHealth.checkedAt}
            isCheckingConnectivity={isCheckingConnectivity}
            message={providerHealth.message}
            results={providerHealth.results}
          />
          <ConfigGovernancePanel
            config={config}
            onSetBooleanFlag={setBooleanFlag}
            onSetLogLevel={setLogLevel}
            onSetPromptOverride={setPromptOverride}
            onSetPromptSource={setPromptSource}
            onSetSafetyField={setSafetyField}
          />
        </div>
      </div>
    </div>
  )
}

function ProviderHealthCard({
  checkedAt,
  isCheckingConnectivity,
  message,
  results,
}: {
  checkedAt: string
  isCheckingConnectivity: boolean
  message: string
  results: Array<{
    provider: string
    modelName: string
    ok: boolean
    message: string
    durationMs: number
  }>
}) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={TaskDone02Icon} size={18} strokeWidth={1.8} />
          <CardTitle>Provider Health</CardTitle>
        </div>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{checkedAt ? formatRelativeTime(checkedAt) : '暂无检查时间'}</span>
          {isCheckingConnectivity ? <span>正在刷新连通性结果</span> : null}
        </div>
        {results.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
            当前没有 provider health 结果。
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((result) => (
              <div
                className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3"
                key={`${result.provider}:${result.modelName}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{result.provider}</p>
                    <p className="text-sm text-muted-foreground">{result.modelName}</p>
                  </div>
                  <Badge variant={result.ok ? 'default' : 'destructive'}>
                    {result.ok ? 'OK' : 'FAIL'}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{result.durationMs} ms</span>
                  <span>{result.message}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
