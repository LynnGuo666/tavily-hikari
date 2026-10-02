import { useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import SegmentedTabs from '@/components/SegmentedTabs'
import { useTheme } from '../theme'
import type { AdminUserIpTimelineEntry, AdminUserUsageSeries, AdminUserUsageSeriesKey, AdminUserUsageSeriesQuotaPoint } from '../api'
import type { AdminTranslations } from '../i18n'
import type React from 'react'

const USAGE_TAB_ORDER = ['rate5m', 'businessCalls1h', 'dailyCredits', 'monthlyCredits', 'ip'] as const
const USAGE_SERIES_KEYS = new Set<AdminUserUsageSeriesKey>(['rate5m', 'businessCalls1h', 'dailyCredits', 'monthlyCredits'])
type AdminUserUsagePanelTab = AdminUserUsageSeriesKey | 'ip'
type LoadStatus = 'idle' | 'loading' | 'success' | 'error'
type TimelineBounds = { min: number; max: number }
type IpGanttRange = [number, number]

interface UserDetailSharedUsagePanelProps {
  usersStrings: AdminTranslations['users']
  language: string
  loadSeries: (series: AdminUserUsageSeriesKey, signal: AbortSignal) => Promise<AdminUserUsageSeries>
  initialSeries?: AdminUserUsagePanelTab
  ipTimeline?: AdminUserIpTimelineEntry[]
  ipAddresses24h?: string[]
  ipAddresses7d?: string[]
  ipCount24h?: number
  ipCount7d?: number
  title?: string
  description?: string
  initialSeriesCache?: Partial<Record<AdminUserUsageSeriesKey, AdminUserUsageSeries>>
  onSeriesCacheChange?: (cache: Partial<Record<AdminUserUsageSeriesKey, AdminUserUsageSeries>>) => void
}

function isUsageSeriesKey(value: AdminUserUsagePanelTab): value is AdminUserUsageSeriesKey {
  return USAGE_SERIES_KEYS.has(value as AdminUserUsageSeriesKey)
}

function formatNumber(locale: string, value: number): string {
  return new Intl.NumberFormat(locale).format(value)
}

function formatBucketAxisLabel(
  locale: string,
  series: AdminUserUsageSeriesKey,
  point: AdminUserUsageSeriesQuotaPoint,
): string {
  const date = new Date((point.displayBucketStart ?? point.bucketStart) * 1000)
  if (series === 'monthlyCredits') {
    return new Intl.DateTimeFormat(locale, {
      year: '2-digit',
      month: '2-digit',
      timeZone: 'UTC',
    }).format(date)
  }
  if (series === 'dailyCredits') {
    return new Intl.DateTimeFormat(locale, {
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC',
    }).format(date)
  }
  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function monthBucketEnd(bucketStart: Date): Date {
  return new Date(Date.UTC(bucketStart.getUTCFullYear(), bucketStart.getUTCMonth() + 1, 1))
}

function bucketDurationSeconds(series: AdminUserUsageSeriesKey, bucketStart: number): number {
  switch (series) {
    case 'rate5m':
    case 'businessCalls1h':
      return 5 * 60
    case 'dailyCredits':
      return 24 * 60 * 60
    case 'monthlyCredits': {
      const start = new Date(bucketStart * 1000)
      return Math.max(1, Math.round((monthBucketEnd(start).getTime() - start.getTime()) / 1000))
    }
  }
}

function formatBucketTooltipLabel(
  locale: string,
  series: AdminUserUsageSeriesKey,
  point: AdminUserUsageSeriesQuotaPoint,
): string {
  const displayStart = point.displayBucketStart ?? point.bucketStart
  const start = new Date(displayStart * 1000)
  if (series === 'monthlyCredits') {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(start)
  }
  if (series === 'dailyCredits') {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC',
    }).format(start)
  }

  const end = new Date((point.bucketStart + bucketDurationSeconds(series, point.bucketStart) - 1) * 1000)
  const dateLabel = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(start)
  const timeLabel = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${dateLabel} ${timeLabel.format(start)} – ${timeLabel.format(end)}`
}

function formatIpTimelineAxisLabel(locale: string, timestamp: number): string {
  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(timestamp * 1000))
}

function formatIpTimelineRangeLabel(locale: string, startTimestamp: number, endTimestamp: number): string {
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${dateFormatter.format(new Date(startTimestamp * 1000))} – ${dateFormatter.format(new Date(endTimestamp * 1000))}`
}

function clipIpTimelineRange(item: AdminUserIpTimelineEntry, bounds: TimelineBounds): IpGanttRange {
  const first = Math.min(bounds.max, Math.max(bounds.min, item.firstSeenAt))
  const last = Math.min(bounds.max, Math.max(bounds.min, item.lastSeenAt))
  return [Math.min(first, last), Math.max(first, last)]
}

export function isBusinessCalls1hStacked(activeSeries: AdminUserUsageSeriesKey): boolean {
  return activeSeries === 'businessCalls1h'
}

function isQuotaLikeSeries(
  value: AdminUserUsageSeries | null | undefined,
): value is Extract<AdminUserUsageSeries, { kind: 'quotaLike' }> {
  return value?.kind === 'quotaLike'
}

function isBusinessCallsSeries(
  value: AdminUserUsageSeries | null | undefined,
): value is Extract<AdminUserUsageSeries, { kind: 'businessCalls1h' }> {
  return value?.kind === 'businessCalls1h'
}

export function UserDetailSharedUsagePanel({
  usersStrings,
  language,
  loadSeries,
  initialSeries = 'businessCalls1h',
  ipTimeline = [],
  ipAddresses24h = [],
  ipAddresses7d = [],
  ipCount24h = ipAddresses24h.length,
  ipCount7d = ipAddresses7d.length,
  title,
  description,
  initialSeriesCache,
  onSeriesCacheChange,
}: UserDetailSharedUsagePanelProps): React.JSX.Element {
  const { resolvedTheme } = useTheme()
  const [activeSeries, setActiveSeries] = useState<AdminUserUsagePanelTab>(initialSeries)
  const [seriesCache, setSeriesCache] = useState<Partial<Record<AdminUserUsageSeriesKey, AdminUserUsageSeries>>>(
    () => initialSeriesCache ?? {},
  )
  const [statusBySeries, setStatusBySeries] = useState<Partial<Record<AdminUserUsageSeriesKey, LoadStatus>>>({})
  const loadSeriesRef = useRef(loadSeries)
  const inflightControllersRef = useRef<Partial<Record<AdminUserUsageSeriesKey, AbortController>>>({})
  const currentSeries = isUsageSeriesKey(activeSeries) ? seriesCache[activeSeries] ?? null : null
  const activeStatus = isUsageSeriesKey(activeSeries) ? statusBySeries[activeSeries] ?? 'idle' : 'success'

  useEffect(() => {
    loadSeriesRef.current = loadSeries
  }, [loadSeries])

  useEffect(() => {
    return () => {
      Object.values(inflightControllersRef.current).forEach((controller) => controller?.abort())
      inflightControllersRef.current = {}
    }
  }, [])

  useEffect(() => {
    if (!isUsageSeriesKey(activeSeries)) return
    if (currentSeries) return
    if (activeStatus !== 'idle') return

    const controller = new AbortController()
    inflightControllersRef.current[activeSeries]?.abort()
    inflightControllersRef.current[activeSeries] = controller
    setStatusBySeries((current) => ({ ...current, [activeSeries]: 'loading' }))
    loadSeriesRef.current(activeSeries, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return
        if (inflightControllersRef.current[activeSeries] === controller) {
          delete inflightControllersRef.current[activeSeries]
        }
        setSeriesCache((current) => {
          const next = { ...current, [activeSeries]: payload }
          onSeriesCacheChange?.(next)
          return next
        })
        setStatusBySeries((current) => ({ ...current, [activeSeries]: 'success' }))
      })
      .catch((error) => {
        if (inflightControllersRef.current[activeSeries] === controller) {
          delete inflightControllersRef.current[activeSeries]
        }
        if (controller.signal.aborted) return
        console.error('load admin user usage series failed', error)
        setStatusBySeries((current) => ({ ...current, [activeSeries]: 'error' }))
      })
  }, [activeSeries, activeStatus, currentSeries])

  const loadedSeries = useMemo(
    () => USAGE_TAB_ORDER.filter((key) => key === 'ip' || (isUsageSeriesKey(key) && seriesCache[key] != null)),
    [seriesCache],
  )
  const hasRenderablePoints = useMemo(() => {
    if (!currentSeries) return false
    if (isQuotaLikeSeries(currentSeries)) {
      return currentSeries.points.some((point) => point.value != null || point.limitValue != null)
    }
    return currentSeries.points.some(
      (point) =>
        point.bars.success != null ||
        point.bars.failure != null ||
        point.pressure != null ||
        point.limitValue != null,
    )
  }, [currentSeries])
  const chartConfig = {
    success: { label: usersStrings.detail.sharedUsageLegendSuccess, color: 'var(--chart-1)' },
    failure: { label: usersStrings.detail.sharedUsageLegendFailure, color: 'var(--chart-2)' },
    value: { label: usersStrings.detail.sharedUsageLegendUsed, color: 'var(--chart-1)' },
    pressure: { label: usersStrings.detail.sharedUsageLegendPressure, color: 'var(--chart-3)' },
    limitValue: { label: usersStrings.detail.sharedUsageLegendLimit, color: 'var(--chart-4)' },
  } satisfies ChartConfig
  const chartData = currentSeries?.points.map((point) => {
    const valuePoint = 'value' in point ? point : { ...point, value: point.pressure }
    return {
      ...point,
      label: isUsageSeriesKey(activeSeries) ? formatBucketAxisLabel(language, activeSeries, valuePoint) : '',
      tooltipLabel: isUsageSeriesKey(activeSeries) ? formatBucketTooltipLabel(language, activeSeries, valuePoint) : '',
      ...('bars' in point ? { success: point.bars.success, failure: point.bars.failure } : {}),
    }
  }) ?? []
  const businessCalls = isBusinessCallsSeries(currentSeries)
  const retryActiveSeries = () => {
    if (!isUsageSeriesKey(activeSeries)) return
    inflightControllersRef.current[activeSeries]?.abort()
    delete inflightControllersRef.current[activeSeries]
    setStatusBySeries((current) => ({ ...current, [activeSeries]: 'idle' }))
  }
  const ipTimelineBounds = useMemo(() => {
    const max = Math.floor(Date.now() / 1000)
    return { min: max - 7 * 24 * 60 * 60, max }
  }, [])
  const ipData = ipTimeline.map((item) => ({ ...item, range: clipIpTimelineRange(item, ipTimelineBounds) }))
  const ipConfig = { range: { label: usersStrings.detail.ipUsageTitle, color: 'var(--chart-1)' } } satisfies ChartConfig
  const renderIpList = (titleText: string, values: string[], total: number) => (
    <Card size="sm">
      <CardHeader><CardTitle>{titleText} · {formatNumber(language, total)}</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {values.length === 0 ? <p className="text-muted-foreground">{usersStrings.detail.ipUsageListEmpty}</p> : values.map((ip) => <code key={ip}>{ip}</code>)}
      </CardContent>
    </Card>
  )
  return (
    <div className="admin-user-shared-usage-panel flex min-w-0 flex-col gap-4" data-active-series={activeSeries} data-loaded-series={loadedSeries.join(',')} data-resolved-theme={resolvedTheme}>
      <div className="admin-user-shared-usage-panel-header flex flex-wrap items-start justify-between gap-3 px-4">
        {title || description ? <div>{title ? <h2>{title}</h2> : null}{description ? <p className="text-muted-foreground">{description}</p> : null}</div> : null}
        <SegmentedTabs<AdminUserUsagePanelTab> value={activeSeries} onChange={setActiveSeries} ariaLabel={usersStrings.detail.sharedUsageTitle}
          options={[
            { value: 'rate5m', label: usersStrings.detail.sharedUsageTabs.fiveMinute },
            { value: 'businessCalls1h', label: usersStrings.detail.sharedUsageTabs.businessOneHour },
            { value: 'dailyCredits', label: usersStrings.detail.sharedUsageTabs.daily },
            { value: 'monthlyCredits', label: usersStrings.detail.sharedUsageTabs.monthly },
            { value: 'ip', label: usersStrings.detail.sharedUsageTabs.ip },
          ]} />
      </div>
      <div className="admin-user-shared-usage-chart min-w-0 px-4">
        {activeSeries === 'ip' ? (
          <div className="admin-user-ip-usage flex min-w-0 flex-col gap-4">
            <div><h3>{usersStrings.detail.ipUsageTitle}</h3><p className="text-muted-foreground">{usersStrings.detail.ipUsageDescription}</p></div>
            {ipTimeline.length === 0 ? <Empty><EmptyDescription>{usersStrings.detail.ipUsageEmpty}</EmptyDescription></Empty> : (
              <ChartContainer config={ipConfig} className="admin-user-ip-gantt-chart w-full aspect-auto" aria-label={usersStrings.detail.ipUsageTitle}
                style={{ height: Math.min(420, Math.max(172, ipTimeline.length * 32 + 46)) }}>
                <BarChart accessibilityLayer layout="vertical" data={ipData}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" domain={[ipTimelineBounds.min, ipTimelineBounds.max]} tickFormatter={(value) => formatIpTimelineAxisLabel(language, value)} tickLine={false} axisLine={false} />
                  <YAxis dataKey="ipAddress" type="category" tickLine={false} axisLine={false} width={120} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload[0]?.payload.ipAddress}
                    formatter={(_, __, item) => `${formatIpTimelineRangeLabel(language, item.payload.firstSeenAt, item.payload.lastSeenAt)} · ${formatNumber(language, item.payload.requestCount)}`} />} />
                  <Bar dataKey="range" fill="var(--color-range)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
            <div className="admin-user-ip-lists grid gap-4 sm:grid-cols-2">
              {renderIpList(usersStrings.detail.ipUsage24hTitle, ipAddresses24h, ipCount24h)}
              {renderIpList(usersStrings.detail.ipUsage7dTitle, ipAddresses7d, ipCount7d)}
            </div>
          </div>
        ) : activeStatus === 'loading' && !currentSeries ? <Empty><EmptyDescription>{usersStrings.detail.sharedUsageLoading}</EmptyDescription></Empty>
          : activeStatus === 'error' && !currentSeries ? (
            <Empty><EmptyDescription>{usersStrings.detail.sharedUsageLoadFailed}</EmptyDescription><Button variant="outline" size="sm" onClick={retryActiveSeries}>{usersStrings.detail.sharedUsageRetryAction}</Button></Empty>
          ) : !hasRenderablePoints ? <Empty><EmptyDescription>{usersStrings.detail.sharedUsageEmpty}</EmptyDescription></Empty> : (
            <ChartContainer config={chartConfig} className="h-80 w-full aspect-auto" aria-label={Object.values(chartConfig).map((item) => item.label).join(", ")}>
              <ComposedChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={32} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload[0]?.payload.tooltipLabel} />} />
                <ChartLegend content={<ChartLegendContent className="admin-user-shared-usage-legend" />} />
                {businessCalls ? <Bar dataKey="success" stackId="calls" fill="var(--color-success)" radius={[0, 0, 4, 4]} /> : <Bar dataKey="value" fill="var(--color-value)" radius={4} />}
                {businessCalls ? <Bar dataKey="failure" stackId="calls" fill="var(--color-failure)" radius={[4, 4, 0, 0]} /> : null}
                {businessCalls ? <Line dataKey="pressure" type="step" stroke="var(--color-pressure)" strokeWidth={2} dot={false} /> : null}
                <Line dataKey="limitValue" type="step" stroke="var(--color-limitValue)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ChartContainer>
          )}
      </div>
    </div>
  )
}
