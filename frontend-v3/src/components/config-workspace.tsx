import { ConfigProviderStack } from '@/components/config-provider-stack'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { getConfigText } from '@/lib/config-workspace'
import { useDashboardV3Config } from '@/features/dashboard/use-dashboard-v3-config'
import { useI18n } from '@/lib/i18n'

export function ConfigWorkspace() {
  const { lang } = useI18n()
  const configText = getConfigText(lang)
  const {
    addProvider,
    catalogError,
    checkConnectivity,
    config,
    connectivityResults,
    isApiKeyVisible,
    isCheckingConnectivity,
    isLoading,
    loadError,
    providerCatalog,
    reloadProviderCatalog,
    refresh,
    removeProvider,
    saveHint,
    setDefaultProvider,
    setSafetyField,
    toggleApiKeyVisibility,
    updateProvider,
  } = useDashboardV3Config()

  return (
    <div className="space-y-5">
      {catalogError ? (
        <NoticeRow
          actionLabel={configText.retry}
          message={`${configText.catalogErrorPrefix} ${catalogError}`}
          onAction={() => void reloadProviderCatalog()}
          tone="danger"
        />
      ) : null}

      {isLoading ? <NoticeRow message={configText.loading} tone="muted" /> : null}

      {loadError ? (
        <NoticeRow
          actionLabel={configText.retry}
          message={`${configText.loadErrorPrefix} ${loadError}`}
          onAction={() => void refresh()}
          tone="danger"
        />
      ) : null}

      <Tabs value="model">
        <TabsList variant="line">
          <TabsTrigger value="model">{configText.modelSubTab}</TabsTrigger>
        </TabsList>
      </Tabs>

      <ConfigProviderStack
        apiKeyVisibilityByRow={config.providers.reduce<Record<string, boolean>>((acc, _, index) => {
          acc[String(index)] = isApiKeyVisible(index)
          return acc
        }, {})}
        config={config}
        connectivityResults={connectivityResults}
        isCatalogLoading={isLoading && providerCatalog.length === 0}
        isCheckingConnectivity={isCheckingConnectivity}
        onAddProvider={addProvider}
        onCheckConnectivity={checkConnectivity}
        onRemoveProvider={removeProvider}
        onSetDefaultProvider={setDefaultProvider}
        onSetSafetyField={setSafetyField}
        onToggleApiKeyVisibility={toggleApiKeyVisibility}
        onUpdateProvider={updateProvider}
        providerCatalog={providerCatalog}
      />

      <div className="flex min-h-6 items-center text-sm text-muted-foreground">
        <span id="cfg_save_hint">{translateConfigHint(saveHint, configText)}</span>
      </div>
    </div>
  )
}

function translateConfigHint(saveHint: string, configText: ReturnType<typeof getConfigText>) {
  if (saveHint === '保存中...' || saveHint === configText.saveSaving) return configText.saveSaving
  if (saveHint === '已自动保存' || saveHint === configText.saveAuto) return configText.saveAuto
  if (saveHint.startsWith('配置保存失败')) {
    return saveHint.replace('配置保存失败', configText.saveFailed)
  }
  if (saveHint === '连通性检查中...') return configText.connectivityChecking
  if (saveHint === '连通性检查完成') return configText.connectivityDone
  if (saveHint.startsWith('连通性检查失败')) {
    return saveHint.replace('连通性检查失败', configText.connectivityFailed)
  }
  return saveHint
}

function NoticeRow({
  actionLabel,
  message,
  onAction,
  tone,
}: {
  actionLabel?: string
  message: string
  onAction?: () => void
  tone: 'danger' | 'muted'
}) {
  return (
    <div
      className={
        tone === 'danger'
          ? 'flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'
          : 'rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground'
      }
    >
      <span>{message}</span>
      {actionLabel && onAction ? (
        <Button onClick={onAction} size="sm" type="button" variant="outline">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
