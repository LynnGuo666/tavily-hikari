import SegmentedTabs from '../components/SegmentedTabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useId, useMemo } from 'react'
import type React from 'react'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

import type { AdminTranslations, Language } from '../i18n'
import type { AdminUserRankingRow, AdminUserRankingsSnapshot } from '../api/adminRankings'
import { Icon } from '../lib/icons'
import { useViewportMode } from '../lib/responsive'


type RankingWindowKey = 'last24h' | 'last7d' | 'last30d'
type RankingMetricKey = 'primarySuccess' | 'businessCredits' | 'uniqueIp'
type RankingTabKey = RankingWindowKey | RankingMetricKey
type RankingsConnectionState = 'connecting' | 'live' | 'degraded'

const DEFAULT_RANKINGS_REFRESH_INTERVAL_SECS = 10
const DESKTOP_RANKING_ROW_HEIGHT = 32
const MOBILE_RANKING_ROW_HEIGHT = 28
const RANKING_CHART_BASE_HEIGHT = 48
const RANKING_SLOT_COUNT = 20

type RankingCardDefinition = {
  key: string
  title: string
  description: string
  rows: AdminUserRankingRow[]
  color: string
}

type RankingsMetaProps = {
  strings: AdminTranslations['rankings']
  snapshot: AdminUserRankingsSnapshot | null
  connectionState: RankingsConnectionState
  language: Language
}

type RankingsChartCardProps = {
  title: string
  description: string
  rows: AdminUserRankingRow[]
  strings: AdminTranslations['rankings']
  color: string
  onSelectUser?: (userId: string) => void
}

export type { RankingMetricKey, RankingTabKey, RankingWindowKey }

function formatDisplayName(row: AdminUserRankingRow, fallback: string): string {
  return row.user.displayName?.trim() || row.user.username?.trim() || row.user.userId || fallback
}

function buildTopBarDomainMax(topValue: number): number {
  if (topValue <= 0) return 1
  return topValue
}

function formatTimestamp(unixSeconds: number, language: Language): string {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(unixSeconds * 1000))
}

function rankingRowHeight(compact: boolean): number {
  return compact ? MOBILE_RANKING_ROW_HEIGHT : DESKTOP_RANKING_ROW_HEIGHT
}

function rankingChartHeight(rowCount: number, compact: boolean): number {
  const clampedRowCount = Math.max(rowCount, RANKING_SLOT_COUNT)
  return Math.max(320, clampedRowCount * rankingRowHeight(compact) + RANKING_CHART_BASE_HEIGHT)
}

function connectionToneClass(state: RankingsConnectionState): string {
  if (state === 'live') return 'is-live'
  if (state === 'degraded') return 'is-degraded'
  return 'is-connecting'
}

function connectionIcon(state: RankingsConnectionState): string {
  if (state === 'live') return 'mdi:check-circle-outline'
  if (state === 'degraded') return 'mdi:alert-circle-outline'
  return 'mdi:loading'
}

function RankingsSemanticList({
  id,
  title,
  rows,
  strings,
}: {
  id: string
  title: string
  rows: AdminUserRankingRow[]
  strings: AdminTranslations['rankings']
}): React.JSX.Element {
  return (
    <div id={id} className="sr-only">
      <p>{title}</p>
      <ol>
        {rows.map((row) => (
          <li key={`${row.user.userId}-${row.rank}`}>
            {row.rank}. {formatDisplayName(row, strings.userFallback)}: {row.value.toLocaleString()}
          </li>
        ))}
      </ol>
    </div>
  )
}

function RankingsChartCard({ title, description, rows, strings, color, onSelectUser }: RankingsChartCardProps): React.JSX.Element {
  const descriptionId = useId()
  const compact = useViewportMode() === 'small'
  const data = rows.map((row) => ({ ...row, name: `${row.rank}. ${formatDisplayName(row, strings.userFallback)}` }))
  return (
    <Card className="admin-ranking-card min-w-0">
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="admin-ranking-empty-state py-10 text-center text-muted-foreground" role="status">{strings.empty}</p> : (
          <div className="admin-ranking-chart-shell min-w-0">
            <RankingsSemanticList id={descriptionId} title={title} rows={rows} strings={strings} />
            <ChartContainer config={{ value: { label: title, color } }} className="w-full aspect-auto" style={{ height: rankingChartHeight(rows.length, compact) }} aria-describedby={descriptionId}>
              <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" domain={[0, buildTopBarDomainMax(rows[0]?.value ?? 0)]} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={compact ? 100 : 140} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload[0]?.payload.name} />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={4} onClick={(entry) => onSelectUser?.(entry.payload.user.userId)} cursor={onSelectUser ? 'pointer' : undefined} />
              </BarChart>
            </ChartContainer>
            {onSelectUser && <div className="sr-only focus-within:not-sr-only flex flex-wrap gap-2">
              {data.map((row) => <Button key={row.user.userId} variant="outline" size="sm" onClick={() => onSelectUser(row.user.userId)}>{row.name}</Button>)}
            </div>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RankingsLoadingCard({
  title,
  description,
  strings,
}: {
  title: string
  description: string
  strings: AdminTranslations['rankings']
}): React.JSX.Element {
  const compact = useViewportMode() === 'small'
  const chartHeight = rankingChartHeight(RANKING_SLOT_COUNT, compact)
  const skeletonRows = Array.from({ length: RANKING_SLOT_COUNT }, (_, index) => ({
    rank: index + 1,
    nameWidth: `${44 + ((index * 7) % 32)}%`,
    barWidth: `${Math.max(18, 100 - index * 3.6)}%`,
  }))

  return (
    <Card className="surface panel admin-ranking-card relative min-w-0 overflow-hidden">
      <CardHeader className="panel-header border-b">
        <div>
          <CardTitle role="heading" aria-level={3}>{title}</CardTitle>
          <CardDescription className="panel-description">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="admin-ranking-card-body flex min-w-0 flex-col gap-3">
        <div
          className="admin-ranking-skeleton-stage"
          role="status"
          aria-live="polite"
          style={{ minHeight: chartHeight, height: chartHeight }}
        >
          <span className="sr-only">{strings.loading}</span>
          <div className="admin-ranking-skeleton-list flex flex-col gap-3" aria-hidden="true">
            {skeletonRows.map((row) => (
              <div key={`${title}-${row.rank}`} className="admin-ranking-skeleton-item flex items-center gap-2">
                <span className="admin-ranking-skeleton-rank">{row.rank}.</span>
                <span className="admin-ranking-skeleton-avatar size-6 shrink-0 rounded-full bg-muted" />
                <span className="admin-ranking-skeleton-name h-3 rounded bg-muted" style={{ width: row.nameWidth }} />
                <span className="admin-ranking-skeleton-track h-6 flex-1 rounded bg-muted/50">
                  <span className="admin-ranking-skeleton-bar block h-full rounded bg-muted" style={{ width: row.barWidth }} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function buildLoadingCards(
  strings: AdminTranslations['rankings'],
  activeTab: RankingTabKey,
): Array<Pick<RankingCardDefinition, 'key' | 'title' | 'description'>> {
  if (isWindowTab(activeTab)) {
    return [
      {
        key: `${activeTab}-loading-primary-success`,
        title: strings.metrics.primarySuccess,
        description: strings.primarySuccessDescription,
      },
      {
        key: `${activeTab}-loading-business-credits`,
        title: strings.metrics.businessCredits,
        description: strings.businessCreditsDescription,
      },
      {
        key: `${activeTab}-loading-unique-ip`,
        title: strings.metrics.uniqueIp,
        description: strings.uniqueIpDescription,
      },
    ]
  }

  return [
    {
      key: `${activeTab}-loading-last24h`,
      title: strings.windows.last24h,
      description: descriptionForMetric(strings, activeTab),
    },
    {
      key: `${activeTab}-loading-last7d`,
      title: strings.windows.last7d,
      description: descriptionForMetric(strings, activeTab),
    },
    {
      key: `${activeTab}-loading-last30d`,
      title: strings.windows.last30d,
      description: descriptionForMetric(strings, activeTab),
    },
  ]
}

function isWindowTab(value: RankingTabKey): value is RankingWindowKey {
  return value === 'last24h' || value === 'last7d' || value === 'last30d'
}

function buildTabLabel(strings: AdminTranslations['rankings'], value: RankingTabKey): string {
  return isWindowTab(value) ? strings.windows[value] : strings.metrics[value]
}

function rowsForMetric(windowData: AdminUserRankingsSnapshot[RankingWindowKey], metric: RankingMetricKey): AdminUserRankingRow[] {
  if (metric === 'primarySuccess') return windowData.primarySuccessTop
  if (metric === 'businessCredits') return windowData.businessCreditsTop
  return windowData.uniqueIpTop
}

function descriptionForMetric(strings: AdminTranslations['rankings'], metric: RankingMetricKey): string {
  if (metric === 'primarySuccess') return strings.primarySuccessDescription
  if (metric === 'businessCredits') return strings.businessCreditsDescription
  return strings.uniqueIpDescription
}

function colorForMetric(
  metric: RankingMetricKey,
  colors: { primaryColor: string; creditColor: string; uniqueIpColor: string },
): string {
  if (metric === 'primarySuccess') return colors.primaryColor
  if (metric === 'businessCredits') return colors.creditColor
  return colors.uniqueIpColor
}

function buildRankingCards({
  activeTab,
  snapshot,
  strings,
  primaryColor,
  creditColor,
  uniqueIpColor,
}: {
  activeTab: RankingTabKey
  snapshot: AdminUserRankingsSnapshot
  strings: AdminTranslations['rankings']
  primaryColor: string
  creditColor: string
  uniqueIpColor: string
}): RankingCardDefinition[] {
  if (isWindowTab(activeTab)) {
    const windowData = snapshot[activeTab]
    return [
      {
        key: `${activeTab}-primary-success`,
        title: strings.metrics.primarySuccess,
        description: strings.primarySuccessDescription,
        rows: windowData.primarySuccessTop,
        color: primaryColor,
      },
      {
        key: `${activeTab}-business-credits`,
        title: strings.metrics.businessCredits,
        description: strings.businessCreditsDescription,
        rows: windowData.businessCreditsTop,
        color: creditColor,
      },
      {
        key: `${activeTab}-unique-ip`,
        title: strings.metrics.uniqueIp,
        description: strings.uniqueIpDescription,
        rows: windowData.uniqueIpTop,
        color: uniqueIpColor,
      },
    ]
  }

  const colors = { primaryColor, creditColor, uniqueIpColor }
  const metric = activeTab
  const color = colorForMetric(metric, colors)
  return [
    {
      key: `${metric}-last24h`,
      title: strings.windows.last24h,
      description: descriptionForMetric(strings, metric),
      rows: rowsForMetric(snapshot.last24h, metric),
      color,
    },
    {
      key: `${metric}-last7d`,
      title: strings.windows.last7d,
      description: descriptionForMetric(strings, metric),
      rows: rowsForMetric(snapshot.last7d, metric),
      color,
    },
    {
      key: `${metric}-last30d`,
      title: strings.windows.last30d,
      description: descriptionForMetric(strings, metric),
      rows: rowsForMetric(snapshot.last30d, metric),
      color,
    },
  ]
}

function statusLabel(strings: AdminTranslations['rankings'], state: RankingsConnectionState): string {
  if (state === 'live') return strings.statusLive
  if (state === 'degraded') return strings.statusDegraded
  return strings.statusConnecting
}

export function RankingsMeta({
  strings,
  snapshot,
  connectionState,
  language,
}: RankingsMetaProps): React.JSX.Element {
  const lastUpdated =
    snapshot && !snapshot.stale && snapshot.generatedAt > 0
      ? formatTimestamp(snapshot.generatedAt, language)
      : null
  const refreshCopy = strings.refreshEvery.replace(
    '{seconds}',
    String(snapshot?.refreshIntervalSecs ?? DEFAULT_RANKINGS_REFRESH_INTERVAL_SECS),
  )
  const updatedCopy = lastUpdated
    ? strings.lastUpdated.replace('{time}', lastUpdated)
    : null
  const pendingCopy = !snapshot ? strings.awaitingFirstSnapshot : null

  return (
    <div className="admin-rankings-meta flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-xs" aria-live="polite">
      <span className="admin-rankings-meta-item flex items-center gap-2 text-xs text-muted-foreground">
        <Icon icon="mdi:refresh" width={16} height={16} className="admin-rankings-meta-icon" aria-hidden="true" />
        <span className="admin-rankings-meta-copy flex flex-col">{refreshCopy}</span>
      </span>
      {updatedCopy || pendingCopy ? (
        <span className="admin-rankings-meta-item flex items-center gap-2 text-xs text-muted-foreground">
          <Icon
            icon="mdi:clock-time-four-outline"
            width={16}
            height={16}
            className="admin-rankings-meta-icon"
            aria-hidden="true"
          />
          <span className="admin-rankings-meta-copy flex flex-col">{updatedCopy ?? pendingCopy}</span>
        </span>
      ) : null}
      <span className={`admin-ranking-connection inline-flex items-center gap-2 ${connectionToneClass(connectionState)}`}>
        <Icon
          icon={connectionIcon(connectionState)}
          width={16}
          height={16}
          className={connectionState === 'connecting' ? 'icon-spin' : undefined}
          aria-hidden="true"
        />
        {statusLabel(strings, connectionState)}
      </span>
    </div>
  )
}

export default function AdminUserRankingsPage({
  strings,
  language,
  snapshot,
  loading,
  error,
  connectionState,
  onRetry,
  activeTab = 'last24h',
  onTabChange,
  onSelectUser,
  showHeader = true,
}: {
  strings: AdminTranslations['rankings']
  language: Language
  snapshot: AdminUserRankingsSnapshot | null
  loading: boolean
  error: string | null
  connectionState: RankingsConnectionState
  onRetry: () => void
  activeTab?: RankingTabKey
  onTabChange?: (tab: RankingTabKey) => void
  onSelectUser?: (userId: string) => void
  showHeader?: boolean
}): React.JSX.Element {
  const primaryColor = 'var(--chart-1)'
  const creditColor = 'var(--chart-2)'
  const uniqueIpColor = 'var(--chart-3)'
  const rankingTabs = useMemo<ReadonlyArray<RankingTabKey>>(
    () => ['last24h', 'last7d', 'last30d', 'primarySuccess', 'businessCredits', 'uniqueIp'],
    [],
  )

  const renderedCards = useMemo(
    () =>
      snapshot
        ? buildRankingCards({
          activeTab,
          snapshot,
          strings,
          primaryColor,
          creditColor,
          uniqueIpColor,
        })
        : [],
    [activeTab, creditColor, primaryColor, snapshot, strings, uniqueIpColor],
  )
  const loadingCards = useMemo(() => buildLoadingCards(strings, activeTab), [activeTab, strings])
  const showLoadingSkeleton = loading && !snapshot
  const showStaleHint = snapshot?.stale ?? false

  return (
    <section className="admin-rankings-page flex min-w-0 flex-col gap-4">
      {showHeader ? (
        <Card className="surface panel">
          <CardHeader className="panel-header border-b admin-rankings-header">
            <div className="admin-rankings-header-row">
              <CardTitle role="heading" aria-level={2}>{strings.title}</CardTitle>
              <RankingsMeta
                strings={strings}
                snapshot={snapshot}
                connectionState={connectionState}
                language={language}
              />
            </div>
          </CardHeader>
          {error ? (
            <div className={`alert ${snapshot ? '' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
              <div>{error}</div>
              {snapshot ? <div className="admin-ranking-stale-hint text-xs text-warning">{strings.staleHint}</div> : null}
              {!snapshot ? (
                <div className="admin-ranking-inline-actions flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="xs" onClick={onRetry}>
                    {strings.retry}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      {snapshot || showLoadingSkeleton ? (
        <section className="admin-rankings-toolbar-band" aria-label={strings.tabsLabel}>
          <SegmentedTabs<RankingTabKey>
            className="admin-rankings-tab-strip"
            value={activeTab}
            disabled={showLoadingSkeleton}
            onChange={(tab) => onTabChange?.(tab)}
            options={rankingTabs.map((tab) => ({ value: tab, label: buildTabLabel(strings, tab) }))}
            ariaLabel={strings.tabsLabel}
          />
        </section>
      ) : null}

      {!showHeader && error ? (
        <div className={`alert ${snapshot ? '' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
          <div>{error}</div>
          {snapshot ? <div className="admin-ranking-stale-hint text-xs text-warning">{strings.staleHint}</div> : null}
          {!snapshot ? (
            <div className="admin-ranking-inline-actions flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="xs" onClick={onRetry}>
                {strings.retry}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!error && showStaleHint ? <div className="admin-ranking-stale-hint text-xs text-warning">{strings.staleHint}</div> : null}

      {showLoadingSkeleton ? (
        <section className="admin-ranking-window flex min-w-0 flex-col gap-2">
          <div className="admin-ranking-window-grid grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
            {loadingCards.map((card) => (
              <RankingsLoadingCard
                key={card.key}
                title={card.title}
                description={card.description}
                strings={strings}
              />
            ))}
          </div>
        </section>
      ) : snapshot && renderedCards.length > 0 ? (
        <section className="admin-ranking-window flex min-w-0 flex-col gap-2">
          <div className="admin-ranking-window-grid grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
            {renderedCards.map((card) => (
              <RankingsChartCard
                key={card.key}
                title={card.title}
                description={card.description}
                rows={card.rows}
                strings={strings}
                color={card.color}
                onSelectUser={onSelectUser}
              />
            ))}
          </div>
        </section>
      ) : null}
    </section>
  )
}
