import { ConfigProviderRow } from '@/components/config-provider-row'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { getConfigText } from '@/lib/config-workspace'
import { useI18n } from '@/lib/i18n'
import type {
  DashboardConfig,
  DashboardProviderCatalogEntry,
  DashboardProviderConfig,
  DashboardProviderHealthResult,
} from '@/types/config'

interface ConfigProviderStackProps {
  apiKeyVisibilityByRow: Record<string, boolean>
  config: DashboardConfig
  connectivityResults: DashboardProviderHealthResult[]
  isCatalogLoading: boolean
  isCheckingConnectivity: boolean
  onAddProvider: () => void
  onCheckConnectivity: (rowIndex?: number | null) => void | Promise<void>
  onRemoveProvider: (index: number) => void
  onSetDefaultProvider: (value: string) => void
  onSetSafetyField: (field: keyof DashboardConfig['llmSafety'], value: boolean | number) => void
  onToggleApiKeyVisibility: (index: number) => void
  onUpdateProvider: (index: number, patch: Partial<DashboardProviderConfig>) => void
  providerCatalog: DashboardProviderCatalogEntry[]
}

export function ConfigProviderStack({
  apiKeyVisibilityByRow,
  config,
  connectivityResults,
  isCatalogLoading,
  isCheckingConnectivity,
  onAddProvider,
  onCheckConnectivity,
  onRemoveProvider,
  onSetDefaultProvider,
  onSetSafetyField,
  onToggleApiKeyVisibility,
  onUpdateProvider,
  providerCatalog,
}: ConfigProviderStackProps) {
  const { lang } = useI18n()
  const configText = getConfigText(lang)

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{configText.providersLabel}</p>
          <p className="text-sm text-muted-foreground">{configText.providersHelp}</p>
        </div>

        {isCatalogLoading ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            {configText.catalogLoading}
          </div>
        ) : null}

        {config.providers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
            {configText.noProviders}
          </div>
        ) : (
          <div className="space-y-4" id="cfg_providers_rows">
            {config.providers.map((provider, index) => (
              <ConfigProviderRow
                index={index}
                isApiKeyVisible={Boolean(apiKeyVisibilityByRow[String(index)])}
                isCheckingConnectivity={isCheckingConnectivity}
                key={`${provider.provider}:${provider.modelName}:${index}`}
                onCheckConnectivity={onCheckConnectivity}
                onRemove={onRemoveProvider}
                onSetDefaultProvider={onSetDefaultProvider}
                onToggleApiKeyVisibility={onToggleApiKeyVisibility}
                onUpdate={onUpdateProvider}
                provider={provider}
                providerCatalog={providerCatalog}
                result={findConnectivityResult(connectivityResults, provider)}
                selectedDefaultProvider={config.defaultProvider}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={onAddProvider} type="button" variant="secondary">
            {configText.addProvider}
          </Button>
        </div>

        <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
          <p className="text-sm font-medium text-foreground">{configText.connectivityTitle}</p>
          {connectivityResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">{configText.connectivityEmpty}</p>
          ) : (
            <div className="space-y-2">
              {connectivityResults.map((result) => (
                <div className="text-sm text-muted-foreground" key={`${result.provider}:${result.modelName}`}>
                  <span className={result.ok ? 'text-emerald-500' : 'text-destructive'}>
                    [{result.ok ? 'OK' : 'FAIL'}]
                  </span>{' '}
                  {result.provider} / {result.modelName} ({result.durationMs}ms)
                  <div>{result.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{configText.llmSafetyLabel}</p>
          <p className="text-sm text-muted-foreground">{configText.llmSafetyHelp}</p>
        </div>

        <div className="grid gap-4 rounded-lg border border-border/70 bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="flex min-h-16 items-center justify-between gap-4 rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm">
            <span>{configText.llmSafetyEnabled}</span>
            <Switch
              aria-label={configText.llmSafetyEnabled}
              checked={config.llmSafety.enabled}
              id="cfg_llm_safety_enabled"
              onCheckedChange={(checked) => onSetSafetyField('enabled', checked)}
            />
          </label>

          <NumericField
            label={configText.llmSafetyWindow}
            onChange={(value) => onSetSafetyField('windowMs', value)}
            value={config.llmSafety.windowMs}
          />
          <NumericField
            label={configText.llmSafetyRequests}
            onChange={(value) => onSetSafetyField('maxRequestsPerWindow', value)}
            value={config.llmSafety.maxRequestsPerWindow}
          />
          <NumericField
            label={configText.llmSafetyConcurrent}
            onChange={(value) => onSetSafetyField('maxConcurrentRequests', value)}
            value={config.llmSafety.maxConcurrentRequests}
          />
          <NumericField
            label={configText.llmSafetyTokens}
            onChange={(value) => onSetSafetyField('maxEstimatedTokensPerWindow', value)}
            value={config.llmSafety.maxEstimatedTokensPerWindow}
          />
        </div>
      </section>
    </div>
  )
}

function findConnectivityResult(
  results: DashboardProviderHealthResult[],
  provider: DashboardProviderConfig,
) {
  return (
    results.find(
      (result) =>
        result.provider === provider.provider && result.modelName === provider.modelName,
    ) ?? null
  )
}

function NumericField({
  label,
  onChange,
  value,
}: {
  label: string
  onChange: (value: number) => void
  value: number
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Input
        min={1}
        onChange={(event) => onChange(Number(event.target.value) || 1)}
        type="number"
        value={value}
      />
    </label>
  )
}
