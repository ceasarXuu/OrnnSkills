import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/lib/i18n'
import { resolveMarketEntries, type MarketEntry, type MarketEntryGroup } from '@/lib/market-directory'

const MARKET_GROUPS: Array<{ group: MarketEntryGroup; titleKey: 'marketDirectories' | 'marketRepositories' }> = [
  { group: 'directory', titleKey: 'marketDirectories' },
  { group: 'repository', titleKey: 'marketRepositories' },
]

export function MarketWorkspace() {
  const { lang, t } = useI18n()
  const entries = resolveMarketEntries(undefined, lang)

  return (
    <div className="space-y-7">
      {MARKET_GROUPS.map(({ group, titleKey }) => {
        const groupEntries = entries.filter((entry) => entry.group === group)
        return (
          <section className="space-y-4" key={group}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium">{t(titleKey)}</h2>
              <Badge variant="outline">
                {groupEntries.length} {t('totalRows')}
              </Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {groupEntries.map((entry) => (
                <MarketEntryCard entry={entry} key={entry.id} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function MarketEntryCard({ entry }: { entry: MarketEntry }) {
  const { t } = useI18n()

  return (
    <a className="block focus-visible:outline-none" href={entry.url} rel="noreferrer" target="_blank">
      <Card className="h-full border-border/70 bg-card/92 transition-colors hover:border-foreground/30 hover:bg-card" size="sm">
        <CardHeader className="gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-background/75">
                <img alt="" className="size-6" src={entry.iconUrl || entry.coverUrl || entry.resolvedIconUrl} />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate">{entry.displayName}</CardTitle>
                <div className="mt-1 truncate text-xs text-muted-foreground">{entry.displayUrl}</div>
              </div>
            </div>
            <Badge variant={entry.trust === 'official' ? 'default' : 'outline'}>{trustLabel(entry.trust, t)}</Badge>
          </div>
        </CardHeader>
      </Card>
    </a>
  )
}

function trustLabel(trust: MarketEntry['trust'], t: ReturnType<typeof useI18n>['t']) {
  if (trust === 'official') return t('marketTrustOfficial')
  if (trust === 'index') return t('marketTrustIndex')
  return t('marketTrustCommunity')
}
