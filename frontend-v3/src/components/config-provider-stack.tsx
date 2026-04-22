import type { ReactNode } from 'react'
import {
  Add01Icon,
  ArrowReloadHorizontalIcon,
  CheckmarkCircle02Icon,
  DatabaseIcon,
  Delete02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getConfiguredProviderOptions,
  getProviderDisplayName,
  maskApiKey,
} from '@/lib/dashboard-config'
import { cn } from '@/lib/utils'
import type {
  DashboardConfig,
  DashboardProviderCatalogEntry,
  DashboardProviderConfig,
  DashboardProviderHealthResult,
  DashboardProviderHealthSummary,
} from '@/types/config'

interface ConfigProviderStackProps {
  catalogError: string | null
  config: DashboardConfig
  connectivityResults: DashboardProviderHealthResult[]
  isCheckingConnectivity: boolean
  onAddProvider: () => void
  onCheckConnectivity: () => void | Promise<void>
  onRemoveProvider: (index: number) => void
  onSetDefaultProvider: (value: string) => void
  onUpdateProvider: (index: number, patch: Partial<DashboardProviderConfig>) => void
  providerCatalog: DashboardProviderCatalogEntry[]
  providerHealth: DashboardProviderHealthSummary
}

function getProviderStatus(
  provider: DashboardProviderConfig,
  connectivityResults: DashboardProviderHealthResult[],
  providerHealth: DashboardProviderHealthSummary,
) {
  const key = `${provider.provider}:${provider.modelName}`
  const connectivityMap = new Map(
    connectivityResults.map((result) => [`${result.provider}:${result.modelName}`, result]),
  )
  const healthMap = new Map(
    providerHealth.results.map((result) => [`${result.provider}:${result.modelName}`, result]),
  )

  return connectivityMap.get(key) ?? healthMap.get(key) ?? null
}

export function ConfigProviderStack({
  catalogError,
  config,
  connectivityResults,
  isCheckingConnectivity,
  onAddProvider,
  onCheckConnectivity,
  onRemoveProvider,
  onSetDefaultProvider,
  onUpdateProvider,
  providerCatalog,
  providerHealth,
}: ConfigProviderStackProps) {
  const defaultProvider = config.defaultProvider || config.providers[0]?.provider || ''
  const configuredProviders = getConfiguredProviderOptions(config)

  return (
    <Card className="border-border/70">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={DatabaseIcon} size={18} strokeWidth={1.8} />
              <CardTitle>Provider Stack</CardTitle>
            </div>
            <CardDescription>
              把默认 provider、模型和密钥都集中放在一个工作面里管理，不再散落到旧面板。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onAddProvider} variant="secondary">
              <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.8} />
              添加 Provider
            </Button>
            <Button
              disabled={config.providers.length === 0 || isCheckingConnectivity}
              onClick={() => void onCheckConnectivity()}
              variant="outline"
            >
              <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={16} strokeWidth={1.8} />
              {isCheckingConnectivity ? '检查中' : '检查连通性'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/20 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Default Provider</p>
            <p className="text-sm text-muted-foreground">
              这里决定 dashboard 默认走哪条 provider/model 组合。
            </p>
          </div>
          <Select onValueChange={onSetDefaultProvider} value={defaultProvider}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择默认 provider" />
            </SelectTrigger>
            <SelectContent>
              {configuredProviders.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {provider || '未命名 provider'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {catalogError ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            Provider catalog 暂时不可用，仍然可以编辑已加载的配置。{catalogError}
          </div>
        ) : null}

        {config.providers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            当前没有已配置 provider，先添加一条配置再保存。
          </div>
        ) : (
          <div className="space-y-4">
            {config.providers.map((provider, index) => (
              <ProviderRow
                index={index}
                key={`${provider.provider}:${provider.modelName}:${index}`}
                onRemove={onRemoveProvider}
                onUpdate={onUpdateProvider}
                provider={provider}
                providerCatalog={providerCatalog}
                status={getProviderStatus(provider, connectivityResults, providerHealth)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ProviderRow({
  index,
  onRemove,
  onUpdate,
  provider,
  providerCatalog,
  status,
}: {
  index: number
  onRemove: (index: number) => void
  onUpdate: (index: number, patch: Partial<DashboardProviderConfig>) => void
  provider: DashboardProviderConfig
  providerCatalog: DashboardProviderCatalogEntry[]
  status: DashboardProviderHealthResult | null
}) {
  const providerValue = provider.provider || providerCatalog[0]?.id || ''
  const maskedApiKey = maskApiKey(provider.apiKey)

  return (
    <div className="rounded-xl border border-border/70 bg-card/70 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">
              {getProviderDisplayName(providerCatalog, provider.provider || providerValue)}
            </p>
            <Badge variant={status?.ok ? 'default' : status ? 'destructive' : 'secondary'}>
              {status?.ok ? 'Healthy' : status ? 'Attention' : 'Unchecked'}
            </Badge>
            {provider.hasApiKey || provider.apiKey ? (
              <Badge variant="outline">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} strokeWidth={1.8} />
                {maskedApiKey || 'API key ready'}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {status?.message || '保存后可以继续做连通性检查和 provider health 校验。'}
          </p>
        </div>
        <Button
          aria-label="删除 provider"
          onClick={() => onRemove(index)}
          size="icon"
          variant="ghost"
        >
          <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.8} />
        </Button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Provider">
          <Select
            onValueChange={(value) => onUpdate(index, { provider: value })}
            value={providerValue}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择 provider" />
            </SelectTrigger>
            <SelectContent>
              {providerCatalog.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Model Name">
          <Input
            onChange={(event) => onUpdate(index, { modelName: event.target.value })}
            placeholder="deepseek/deepseek-reasoner"
            value={provider.modelName}
          />
        </Field>

        <Field label="API Key Env">
          <Input
            onChange={(event) => onUpdate(index, { apiKeyEnvVar: event.target.value })}
            placeholder="DEEPSEEK_API_KEY"
            value={provider.apiKeyEnvVar}
          />
        </Field>

        <Field label="API Key">
          <Input
            onChange={(event) =>
              onUpdate(index, {
                apiKey: event.target.value,
                hasApiKey: event.target.value.trim().length > 0 || provider.hasApiKey,
              })
            }
            placeholder="输入或覆盖 API key"
            type="password"
            value={provider.apiKey || ''}
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Model: {provider.modelName || '未设置'}</span>
        <span>Env: {provider.apiKeyEnvVar || '未设置'}</span>
        {status ? <span>Latency: {status.durationMs} ms</span> : null}
      </div>
    </div>
  )
}

function Field({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <label className={cn('space-y-2')}>
      <Label>{label}</Label>
      {children}
    </label>
  )
}
