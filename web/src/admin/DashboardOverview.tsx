import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { Area, AreaChart } from 'recharts'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useId, useMemo } from 'react'
import type React from 'react'

import type {
  AlertGroup,
  DashboardHourlyRequestWindow,
  DashboardRollupIntegrityStatus,
  DashboardMonthSeries,
  JobLogView,
  RecentAlertsSummary,
  RequestLog,
  SummaryWindowsResponse,
} from '../api'
import RollingNumber from '../components/RollingNumber'
import { StatusBadge, type StatusTone } from '../components/StatusBadge'
import DashboardTrendPanel from './DashboardTrendPanel'
import {
  type DashboardCreditSeriesId,
  type DashboardHourlyChartMode,
  type DashboardResultSeriesId,
  type DashboardTypeSeriesId,
} from './dashboardHourlyCharts'
import {
  buildMonthSeriesBackdropSeries,
  buildPeriodBackdropSeries,
  getBackdropMetricKey,
  type DashboardBackdropMetricKey,
  type DashboardCardBackdropMap,
  type DashboardCardBackdropSeries,
} from './dashboardCardBackdrops'


export interface DashboardMetricCard {
  id: string
  label: string
  value: string
  valueNumber?: number
  marker?: string
  markerTone?: 'primary' | 'secondary' | 'neutral'
  valueMeta?: string
  subtitle?: string
  fullWidth?: boolean
  comparison?: {
    label: string
    value: string
    direction: 'up' | 'down' | 'flat'
    tone?: 'positive' | 'negative' | 'neutral'
  }
}

export interface DashboardQuotaChargeCardData {
  title: string
  localLabel: string
  localValue: string
  localValueNumber?: number
  upstreamLabel: string
  upstreamValue: string
  upstreamValueNumber?: number
  deltaLabel: string
  deltaValue: string
  deltaValueNumber?: number
  deltaTone?: 'positive' | 'negative' | 'neutral'
  coverage: string
  freshness: string
}

export interface DashboardOverviewStrings {
  loading: string
  summaryUnavailable: string
  statusUnavailable: string
  todayTitle: string
  todayDescription: string
  monthTitle: string
  monthDescription: string
  monthComparisonEmpty: string
  currentStatusTitle: string
  currentStatusDescription: string
  trendsTitle: string
  trendsDescription: string
  requestTrend: string
  errorTrend: string
  chartModeResults: string
  chartModeTypes: string
  chartModeCredits: string
  chartModeResultsArea: string
  chartModeTypesArea: string
  chartModeCreditsArea: string
  chartMetricLabel: string
  chartRenderLabel: string
  chartRenderBar: string
  chartRenderArea: string
  chartVisibleSeries: string
  chartEmpty: string
  chartUtcWindow: string
  chartRollingWindow: string
  chartIntegrityHealthy: string
  chartIntegrityRepairing: string
  chartIntegrityDegraded: string
  chartIntegrityLastVerified: string
  chartResultSecondarySuccess: string
  chartResultPrimarySuccess: string
  chartResultSecondaryFailure: string
  chartResultPrimaryFailure429: string
  chartResultPrimaryFailureOther: string
  chartResultUnknown: string
  chartTypeMcpNonBillable: string
  chartTypeMcpBillable: string
  chartTypeApiNonBillable: string
  chartTypeApiBillable: string
  chartCreditLocalEstimate: string
  chartCreditUpstreamActual: string
  actionsTitle: string
  actionsDescription: string
  recentRequests: string
  recentJobs: string
  recentAlertsTitle: string
  recentAlertsDescription: string
  recentAlertsOverviewTitle: string
  recentAlertsOverviewSummary: string
  recentAlertsCurrentWindow: string
  recentAlertsWindowLabels: {
    hour1: string
    hour24: string
    day7: string
  }
  recentAlertsColumns: {
    alert: string
    requestKind: string
    timeRange: string
    hits: string
    review: string
  }
  recentAlertsHits: string
  recentAlertsTimeRange: string
  recentAlertsEmpty: string
  recentAlertsOpen: string
  recentAlertsOpenGroup: string
  recentAlertsOpenUser: string
  recentAlertsTypeLabels: Record<
    | 'upstream_rate_limited_429'
    | 'upstream_usage_limit_432'
    | 'upstream_key_blocked'
    | 'user_request_rate_limited'
    | 'user_quota_exhausted'
    | 'api_key_exhausted'
    | 'job_failed',
    string
  >
}

export type DashboardRecentAlertGroup = AlertGroup

interface DashboardOverviewProps {
  strings: DashboardOverviewStrings
  language?: 'zh' | 'en'
  overviewReady: boolean
  statusLoading: boolean
  todayMetrics: DashboardMetricCard[]
  todayQuotaCharge?: DashboardQuotaChargeCardData | null
  monthMetrics: DashboardMetricCard[]
  monthQuotaCharge?: DashboardQuotaChargeCardData | null
  statusMetrics: DashboardMetricCard[]
  summaryWindows?: SummaryWindowsResponse | null
  hourlyRequestWindow: DashboardHourlyRequestWindow
  rollupIntegrity: DashboardRollupIntegrityStatus
  monthSeries?: DashboardMonthSeries | null
  logs: RequestLog[]
  jobs: JobLogView[]
  recentAlerts: RecentAlertsSummary
  onOpenRecentAlerts: () => void
  onOpenRecentAlertGroup?: (group: DashboardRecentAlertGroup) => void
  onOpenUser?: (id: string) => void
  initialChartMode?: DashboardHourlyChartMode
  initialVisibleResultSeries?: ReadonlyArray<DashboardResultSeriesId>
  initialVisibleTypeSeries?: ReadonlyArray<DashboardTypeSeriesId>
  initialVisibleCreditSeries?: ReadonlyArray<DashboardCreditSeriesId>
  chartPersistenceKey?: string | null
  chartLabelTimeZone?: string | null
}

function buildCumulativeNullableSeries(
  values: ReadonlyArray<number | null>,
  initialValue = 0,
): Array<number | null> {
  let runningTotal = initialValue
  return values.map((value) => {
    if (value == null) return null
    runningTotal += Math.max(0, value)
    return runningTotal
  })
}

function MetricValue({
  value,
  valueNumber,
  compact = false,
}: {
  value: string
  valueNumber?: number
  compact?: boolean
}): React.JSX.Element {
  const splitValue = value.split(' / ')
  if (splitValue.length === 2) {
    return (
      <div className={`font-mono text-2xl font-semibold tabular-nums flex items-baseline gap-1${compact ? ' dashboard-metric-value-split-compact' : ''}`}>
        <span>{splitValue[0]}</span>
        <span className="text-base font-normal text-muted-foreground">/ {splitValue[1]}</span>
      </div>
    )
  }

  if (typeof valueNumber === 'number' && Number.isFinite(valueNumber)) {
    return (
      <div className={`font-mono text-2xl font-semibold tabular-nums ${compact ? ' dashboard-metric-value-compact' : ''}`}>
        <RollingNumber value={valueNumber} />
      </div>
    )
  }

  return <div className="font-mono text-2xl font-semibold tabular-nums">{value}</div>
}

function SummaryMetricCard({
  metric,
  compact = false,
  backdrop,
  backdropNotice,
}: {
  metric: DashboardMetricCard
  compact?: boolean
  backdrop?: DashboardCardBackdropSeries
  backdropNotice?: string | null
}): React.JSX.Element {
  const deltaTone = metric.comparison?.tone ?? (
    metric.comparison?.direction === 'flat'
      ? 'neutral'
      : metric.comparison?.direction === 'up'
        ? 'positive'
        : 'negative'
  )

  return (
    <div className={cn(
      'dashboard-summary-card relative min-w-0 flex flex-col gap-1',
      backdrop && 'dashboard-summary-card-with-backdrop',
      compact && 'dashboard-summary-card-compact',
      metric.fullWidth && 'dashboard-summary-card-full-width sm:col-span-2 xl:col-span-1',
    )}>
      {backdrop ? (
        <DashboardUsageBackdropChart
          ariaLabel={metric.label}
          className="dashboard-summary-card-backdrop pointer-events-none absolute inset-0 z-0 opacity-50"
          primaryValues={backdrop.current}
          comparisonValues={backdrop.comparison}
          primaryInitialValue={backdrop.baseline ?? 0}
          comparisonInitialValue={backdrop.baseline ?? 0}
          primaryColor={backdrop.color}
          comparisonColor={backdrop.comparisonColor}
        />
      ) : null}
      <div className="relative z-10 flex items-start justify-between gap-2">
          <div role="heading" aria-level={3} className="text-xs text-muted-foreground">{metric.label}</div>
          {metric.marker ? (
            <Badge variant={metric.markerTone === 'primary' ? 'default' : 'secondary'}>{metric.marker}</Badge>
          ) : null}
      </div>
      <div className="relative z-10 flex flex-col gap-1.5">
        <div className="flex items-baseline gap-2">
          <MetricValue value={metric.value} valueNumber={metric.valueNumber} compact={compact} />
        </div>
        {metric.comparison ? (
          <div className="flex flex-col gap-0.5">
            {metric.valueMeta ? <div className="text-xs text-muted-foreground">{metric.valueMeta}</div> : null}
            <div className={`inline-flex items-center gap-1.5 text-xs metric-delta-${deltaTone}`}>
              <span className="text-muted-foreground">{metric.comparison.label}</span>
              <span className="font-mono font-medium tabular-nums">{metric.comparison.value}</span>
            </div>
          </div>
        ) : metric.subtitle ? (
          <div className="text-xs text-muted-foreground">{metric.subtitle}</div>
        ) : null}
        {metric.comparison && metric.subtitle ? <div className="text-xs text-muted-foreground">{metric.subtitle}</div> : null}
        {!metric.comparison && backdropNotice ? <div className="text-xs text-muted-foreground">{backdropNotice}</div> : null}
      </div>
    </div>
  )
}

function QuotaChargeCard({
  card,
  backdrop,
}: {
  card: DashboardQuotaChargeCardData
  backdrop?: DashboardCardBackdropSeries
}): React.JSX.Element {
  return (
    <div className="dashboard-summary-card relative min-w-0 flex flex-col gap-1 dashboard-quota-charge-card">
      {backdrop ? (
        <DashboardUsageBackdropChart
          ariaLabel={card.title}
          className="dashboard-summary-card-backdrop pointer-events-none absolute inset-0 z-0 opacity-50"
          primaryValues={backdrop.current}
          comparisonValues={backdrop.comparison}
          primaryInitialValue={backdrop.baseline ?? 0}
          comparisonInitialValue={backdrop.baseline ?? 0}
          primaryColor={backdrop.color}
          comparisonColor={backdrop.comparisonColor}
        />
      ) : null}
      <div className="relative z-10">
        <div role="heading" aria-level={3} className="text-xs text-muted-foreground">{card.title}</div>
      </div>
      <div className="relative z-10 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="font-mono text-sm font-semibold tabular-nums">
            <span className="text-xs text-muted-foreground">{card.localLabel}</span>
            <MetricValue value={card.localValue} valueNumber={card.localValueNumber} />
          </div>
          <div className="font-mono text-sm font-semibold tabular-nums">
            <span className="text-xs text-muted-foreground">{card.upstreamLabel}</span>
            <MetricValue value={card.upstreamValue} valueNumber={card.upstreamValueNumber} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className={`inline-flex items-center gap-1.5 text-xs metric-delta-${card.deltaTone ?? 'neutral'}`}>
            <span className="text-muted-foreground">{card.deltaLabel}</span>
            <span className="font-mono font-medium tabular-nums">{card.deltaValue}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span>{card.coverage}</span>
            <span>{card.freshness}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardUsageBackdropChart({
  ariaLabel,
  primaryValues,
  comparisonValues,
  primaryInitialValue = 0,
  comparisonInitialValue = 0,
  primaryColor = 'var(--chart-1)',
  comparisonColor = 'var(--chart-2)',
  className,
}: {
  ariaLabel: string
  primaryValues: ReadonlyArray<number | null>
  comparisonValues?: ReadonlyArray<number | null>
  primaryInitialValue?: number
  comparisonInitialValue?: number
  primaryColor?: string
  comparisonColor?: string
  className?: string
}): React.JSX.Element | null {
  if (primaryValues.length === 0) return null
  const primary = buildCumulativeNullableSeries(primaryValues, primaryInitialValue)
  const comparison = comparisonValues ? buildCumulativeNullableSeries(comparisonValues, comparisonInitialValue) : []
  const data = primary.map((value, index) => ({ index, primary: value, comparison: comparison[index] ?? null }))
  const config = {
    primary: { label: 'Current', color: primaryColor },
    comparison: { label: 'Previous', color: comparisonColor },
  } satisfies ChartConfig
  return (
    <div className={className} aria-hidden="true">
      <ChartContainer config={config} className="h-full w-full aspect-auto">
        <AreaChart accessibilityLayer data={data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
          <Area dataKey="primary" type="natural" fill="var(--color-primary)" fillOpacity={0.4} stroke="var(--color-primary)" />
          {comparisonValues ? <Area dataKey="comparison" type="natural" fill="var(--color-comparison)" fillOpacity={0.1} stroke="var(--color-comparison)" /> : null}
        </AreaChart>
      </ChartContainer>
    </div>
  )
}

function alertSummaryTone(type: keyof DashboardOverviewStrings['recentAlertsTypeLabels']): StatusTone {
  switch (type) {
    case 'api_key_exhausted':
    case 'job_failed':
    case 'upstream_key_blocked':
    case 'user_quota_exhausted':
      return 'error'
    case 'upstream_usage_limit_432':
    case 'upstream_rate_limited_429':
    case 'user_request_rate_limited':
      return 'warning'
    default:
      return 'neutral'
  }
}

function formatAlertRange(timestamp: number): string {
  const parsed = new Date(timestamp * 1000)
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')
  const seconds = String(parsed.getSeconds()).padStart(2, '0')
  return `${month}/${day} ${hours}:${minutes}:${seconds}`
}

function compactWindowCountLabel(
  strings: DashboardOverviewStrings,
  windowHours: number,
): string {
  switch (windowHours) {
    case 1:
      return strings.recentAlertsWindowLabels.hour1.replace('Last ', '').replace('最近 ', '')
    case 24:
      return strings.recentAlertsWindowLabels.hour24.replace('Last ', '').replace('最近 ', '')
    case 24 * 7:
      return strings.recentAlertsWindowLabels.day7.replace('Last ', '').replace('最近 ', '')
    default:
      return `${windowHours}h`
  }
}

function extractRecentAlertWindowMinutes(group: DashboardRecentAlertGroup): number | null {
  const eventWindowMinutes = group.latestEvent.semanticWindow?.windowMinutes
  if (typeof eventWindowMinutes === 'number' && eventWindowMinutes > 0) {
    return eventWindowMinutes
  }

  const windowText = [
    group.latestEvent.summary,
    group.latestEvent.errorMessage,
  ].filter(Boolean).join(' ')
  const match = windowText.match(/\b(?:rolling\s+)?(\d+)m\b/i) ?? windowText.match(/\bwindow=(\d+)m\b/i)
  if (match) {
    const parsed = Number.parseInt(match[1] ?? '', 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return typeof group.semanticWindowMinutes === 'number' && group.semanticWindowMinutes > 0
    ? group.semanticWindowMinutes
    : null
}

function getRecentAlertRateWindowLabel(group: DashboardRecentAlertGroup, language: 'zh' | 'en'): string | null {
  const windowMinutes = extractRecentAlertWindowMinutes(group)
  if (windowMinutes == null) return null
  return language === 'zh' ? `滚动 ${windowMinutes} 分钟窗口` : `${windowMinutes}m window`
}

function getRecentAlertReasonBadgeLabel(group: DashboardRecentAlertGroup, typeLabel: string, language: 'zh' | 'en'): string {
  const parts = [typeLabel]
  if (group.type === 'user_request_rate_limited') {
    const windowLabel = getRecentAlertRateWindowLabel(group, language)
    if (windowLabel) parts.push(windowLabel)
  }
  return parts.join(' · ')
}

function formatAlertDateTimeIso(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString()
}

export default function DashboardOverview({
  strings,
  language = 'en',
  overviewReady,
  statusLoading,
  todayMetrics,
  todayQuotaCharge,
  monthMetrics,
  monthQuotaCharge,
  statusMetrics,
  summaryWindows,
  hourlyRequestWindow,
  rollupIntegrity,
  monthSeries,
  logs,
  jobs,
  recentAlerts,
  onOpenRecentAlerts,
  onOpenRecentAlertGroup,
  onOpenUser,
  initialChartMode,
  initialVisibleResultSeries,
  initialVisibleTypeSeries,
  initialVisibleCreditSeries,
  chartPersistenceKey,
  chartLabelTimeZone,
}: DashboardOverviewProps): React.JSX.Element {
  const recentAlertsTableId = useId()
  const recentAlertsAlertHeaderId = `${recentAlertsTableId}-alert`
  const recentAlertsWindowHeaderId = `${recentAlertsTableId}-window`
  const recentAlertsReviewHeaderId = `${recentAlertsTableId}-review`

  const openRecentAlertGroup = (group: DashboardRecentAlertGroup): void => {
    if (onOpenRecentAlertGroup) {
      onOpenRecentAlertGroup(group)
      return
    }
    onOpenRecentAlerts()
  }

  const hasTodaySummary = todayMetrics.length > 0
  const hasMonthSummary = monthMetrics.length > 0
  const hasStatusSummary = statusMetrics.length > 0
  const todayTotalMetric = todayMetrics.find((metric) => metric.id === 'today-total') ?? null
  const todayDetailMetrics = todayMetrics.filter((metric) => metric.id !== 'today-total')
  const monthTotalMetric = monthMetrics.find((metric) => metric.id === 'month-total') ?? null
  const monthDetailMetrics = monthMetrics.filter((metric) => metric.id !== 'month-total')
  const summaryWindowValues = summaryWindows ?? {
    today: {
      total_requests: 0,
      success_count: 0,
      error_count: 0,
      quota_exhausted_count: 0,
      valuable_success_count: 0,
      valuable_failure_count: 0,
      other_success_count: 0,
      other_failure_count: 0,
      unknown_count: 0,
      upstream_exhausted_key_count: 0,
      new_keys: 0,
      new_quarantines: 0,
    },
    yesterday: {
      total_requests: 0,
      success_count: 0,
      error_count: 0,
      quota_exhausted_count: 0,
      valuable_success_count: 0,
      valuable_failure_count: 0,
      other_success_count: 0,
      other_failure_count: 0,
      unknown_count: 0,
      upstream_exhausted_key_count: 0,
      new_keys: 0,
      new_quarantines: 0,
    },
    month: {
      total_requests: 0,
      success_count: 0,
      error_count: 0,
      quota_exhausted_count: 0,
      valuable_success_count: 0,
      valuable_failure_count: 0,
      other_success_count: 0,
      other_failure_count: 0,
      unknown_count: 0,
      upstream_exhausted_key_count: 0,
      new_keys: 0,
      new_quarantines: 0,
    },
    today_start: 0,
    today_end: 0,
    yesterday_start: 0,
    yesterday_end: 0,
    month_start: 0,
    month_end: 0,
  }
  const backdropColors = {
    today: 'var(--chart-1)',
    yesterday: 'var(--chart-1)',
    month: 'var(--chart-1)',
    success: 'var(--success)',
    failure: 'var(--destructive)',
  }
  const comparisonRangeStart = summaryWindowValues.yesterday_start
  const comparisonRangeEnd = summaryWindowValues.today_start
  const todayPeriodEnd = summaryWindowValues.today_period_end ?? summaryWindowValues.today_end
  const monthSeriesValue = monthSeries ?? { current: [], comparison: [] }
  const todayBackdrop = useMemo(
    () => buildPeriodBackdropSeries({
      hourlyRequestWindow,
      currentValueRange: {
        rangeStart: summaryWindowValues.today_start,
        rangeEnd: summaryWindowValues.today_end,
      },
      currentDisplayRange: {
        rangeStart: summaryWindowValues.today_start,
        rangeEnd: todayPeriodEnd,
      },
      comparisonValueRange: {
        rangeStart: comparisonRangeStart,
        rangeEnd: comparisonRangeEnd,
      },
      comparisonDisplayRange: {
        rangeStart: comparisonRangeStart,
        rangeEnd: comparisonRangeEnd,
      },
      displayBucketSeconds: 3600,
      metricKey: 'total',
    }),
    [
      comparisonRangeEnd,
      comparisonRangeStart,
      hourlyRequestWindow,
      summaryWindowValues.today_end,
      summaryWindowValues.today_start,
      todayPeriodEnd,
    ],
  )
  const todayCardBackdrops = useMemo<DashboardCardBackdropMap>(() => (
    {
      total: {
        ...todayBackdrop,
        color: backdropColors.today,
        comparisonColor: backdropColors.yesterday,
      },
      valuableSuccess: {
        ...buildPeriodBackdropSeries({
          hourlyRequestWindow,
          currentValueRange: {
            rangeStart: summaryWindowValues.today_start,
            rangeEnd: summaryWindowValues.today_end,
          },
          currentDisplayRange: {
            rangeStart: summaryWindowValues.today_start,
            rangeEnd: todayPeriodEnd,
          },
          comparisonValueRange: {
            rangeStart: comparisonRangeStart,
            rangeEnd: comparisonRangeEnd,
          },
          comparisonDisplayRange: {
            rangeStart: comparisonRangeStart,
            rangeEnd: comparisonRangeEnd,
          },
          displayBucketSeconds: 3600,
          metricKey: 'valuableSuccess',
        }),
        color: backdropColors.success,
        comparisonColor: backdropColors.success,
      },
      valuableFailure: {
        ...buildPeriodBackdropSeries({
          hourlyRequestWindow,
          currentValueRange: {
            rangeStart: summaryWindowValues.today_start,
            rangeEnd: summaryWindowValues.today_end,
          },
          currentDisplayRange: {
            rangeStart: summaryWindowValues.today_start,
            rangeEnd: todayPeriodEnd,
          },
          comparisonValueRange: {
            rangeStart: comparisonRangeStart,
            rangeEnd: comparisonRangeEnd,
          },
          comparisonDisplayRange: {
            rangeStart: comparisonRangeStart,
            rangeEnd: comparisonRangeEnd,
          },
          displayBucketSeconds: 3600,
          metricKey: 'valuableFailure',
        }),
        color: backdropColors.failure,
        comparisonColor: backdropColors.failure,
      },
      otherSuccess: {
        ...buildPeriodBackdropSeries({
          hourlyRequestWindow,
          currentValueRange: {
            rangeStart: summaryWindowValues.today_start,
            rangeEnd: summaryWindowValues.today_end,
          },
          currentDisplayRange: {
            rangeStart: summaryWindowValues.today_start,
            rangeEnd: todayPeriodEnd,
          },
          comparisonValueRange: {
            rangeStart: comparisonRangeStart,
            rangeEnd: comparisonRangeEnd,
          },
          comparisonDisplayRange: {
            rangeStart: comparisonRangeStart,
            rangeEnd: comparisonRangeEnd,
          },
          displayBucketSeconds: 3600,
          metricKey: 'otherSuccess',
        }),
        color: backdropColors.success,
        comparisonColor: backdropColors.success,
      },
      otherFailure: {
        ...buildPeriodBackdropSeries({
          hourlyRequestWindow,
          currentValueRange: {
            rangeStart: summaryWindowValues.today_start,
            rangeEnd: summaryWindowValues.today_end,
          },
          currentDisplayRange: {
            rangeStart: summaryWindowValues.today_start,
            rangeEnd: todayPeriodEnd,
          },
          comparisonValueRange: {
            rangeStart: comparisonRangeStart,
            rangeEnd: comparisonRangeEnd,
          },
          comparisonDisplayRange: {
            rangeStart: comparisonRangeStart,
            rangeEnd: comparisonRangeEnd,
          },
          displayBucketSeconds: 3600,
          metricKey: 'otherFailure',
        }),
        color: backdropColors.failure,
        comparisonColor: backdropColors.failure,
      },
      unknown: {
        ...buildPeriodBackdropSeries({
          hourlyRequestWindow,
          currentValueRange: {
            rangeStart: summaryWindowValues.today_start,
            rangeEnd: summaryWindowValues.today_end,
          },
          currentDisplayRange: {
            rangeStart: summaryWindowValues.today_start,
            rangeEnd: todayPeriodEnd,
          },
          comparisonValueRange: {
            rangeStart: comparisonRangeStart,
            rangeEnd: comparisonRangeEnd,
          },
          comparisonDisplayRange: {
            rangeStart: comparisonRangeStart,
            rangeEnd: comparisonRangeEnd,
          },
          displayBucketSeconds: 3600,
          metricKey: 'unknown',
        }),
        color: 'var(--chart-1)',
        comparisonColor: backdropColors.yesterday,
      },
      upstreamExhausted: {
        ...buildPeriodBackdropSeries({
          hourlyRequestWindow,
          currentValueRange: {
            rangeStart: summaryWindowValues.today_start,
            rangeEnd: summaryWindowValues.today_end,
          },
          currentDisplayRange: {
            rangeStart: summaryWindowValues.today_start,
            rangeEnd: todayPeriodEnd,
          },
          comparisonValueRange: {
            rangeStart: comparisonRangeStart,
            rangeEnd: comparisonRangeEnd,
          },
          comparisonDisplayRange: {
            rangeStart: comparisonRangeStart,
            rangeEnd: comparisonRangeEnd,
          },
          displayBucketSeconds: 3600,
          metricKey: 'upstreamExhausted',
        }),
        color: backdropColors.failure,
        comparisonColor: backdropColors.failure,
      },
    }
  ), [
    backdropColors.failure,
    backdropColors.success,
    backdropColors.today,
    backdropColors.yesterday,
    comparisonRangeEnd,
    comparisonRangeStart,
    hourlyRequestWindow,
    todayBackdrop,
  ])
  const monthBackdrop = useMemo(
    () => {
      const backdrop = buildMonthSeriesBackdropSeries(monthSeriesValue, 'total')
      return {
        ...backdrop,
        baseline: 0,
      }
    },
    [monthSeriesValue],
  )
  const monthCardBackdrops = useMemo<DashboardCardBackdropMap>(() => {
    const buildMonthCardBackdrop = (
      metricKey: DashboardBackdropMetricKey,
      color = backdropColors.month,
    ): DashboardCardBackdropSeries => {
      const backdrop = buildMonthSeriesBackdropSeries(monthSeriesValue, metricKey)
      return {
        ...backdrop,
        baseline: 0,
        color,
        comparisonColor: backdropColors.yesterday,
      }
    }
    return {
      total: {
        ...monthBackdrop,
        color: backdropColors.month,
        comparisonColor: backdropColors.yesterday,
      },
      valuableSuccess: buildMonthCardBackdrop('valuableSuccess', backdropColors.success),
      valuableFailure: buildMonthCardBackdrop('valuableFailure', backdropColors.failure),
      otherSuccess: buildMonthCardBackdrop('otherSuccess', backdropColors.success),
      otherFailure: buildMonthCardBackdrop('otherFailure', backdropColors.failure),
      unknown: buildMonthCardBackdrop('unknown'),
      upstreamExhausted: buildMonthCardBackdrop('upstreamExhausted', backdropColors.failure),
    }
  }, [
    backdropColors.failure,
    backdropColors.month,
    backdropColors.success,
    backdropColors.yesterday,
    monthBackdrop,
    monthSeriesValue,
  ])
  const monthComparisonNotice = monthBackdrop.hasVisibleComparison ? null : strings.monthComparisonEmpty

  return (
    <div className="flex flex-col gap-4">
      <section className="dashboard-summary-panel flex flex-col gap-4">
        {!overviewReady ? (
          <Card className="surface panel">
            <Empty><EmptyDescription>{strings.loading}</EmptyDescription></Empty>
          </Card>
        ) : !hasTodaySummary && !hasMonthSummary && !hasStatusSummary ? (
          <Card className="surface panel">
            <Empty><EmptyDescription>{overviewReady ? strings.summaryUnavailable : strings.loading}</EmptyDescription></Empty>
          </Card>
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
              <Card className="min-w-0">

                  <CardHeader>
                    <div>
                      <CardTitle role="heading" aria-level={2}>{strings.todayTitle}</CardTitle>
                      <CardDescription>{strings.todayDescription}</CardDescription>
                    </div>
                  </CardHeader>
<CardContent>
                  {hasTodaySummary ? (
                    <div className="flex flex-col gap-3">
                      {todayTotalMetric ? (
                        <SummaryMetricCard
                          metric={todayTotalMetric}
                          backdrop={todayCardBackdrops[getBackdropMetricKey(todayTotalMetric.id) ?? 'total']}
                        />
                      ) : null}
                      {todayQuotaCharge ? <QuotaChargeCard card={todayQuotaCharge} backdrop={todayCardBackdrops.total} /> : null}
                      <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 dashboard-today-grid">
                        {todayDetailMetrics.map((metric) => (
                          <SummaryMetricCard
                            key={metric.id}
                            metric={metric}
                            backdrop={todayCardBackdrops[getBackdropMetricKey(metric.id) ?? 'total']}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Empty><EmptyDescription>{strings.summaryUnavailable}</EmptyDescription></Empty>
                  )}
                </CardContent>

              </Card>

              <Card className="min-w-0">

                  <CardHeader>
                    <div>
                      <CardTitle role="heading" aria-level={2}>{strings.monthTitle}</CardTitle>
                      <CardDescription>{strings.monthDescription}</CardDescription>
                    </div>
                  </CardHeader>
<CardContent>
                  {hasMonthSummary ? (
                    <div className="flex flex-col gap-3">
                      {monthTotalMetric ? (
                        <SummaryMetricCard
                          metric={monthTotalMetric}
                          backdrop={monthCardBackdrops[getBackdropMetricKey(monthTotalMetric.id) ?? 'total']}
                          backdropNotice={monthComparisonNotice}
                        />
                      ) : null}
                      {monthQuotaCharge ? <QuotaChargeCard card={monthQuotaCharge} backdrop={monthCardBackdrops.total} /> : null}
                      <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 dashboard-summary-metrics-month">
                        {monthDetailMetrics.map((metric) => (
                          <SummaryMetricCard
                            key={metric.id}
                            metric={metric}
                            compact
                            backdrop={monthCardBackdrops[getBackdropMetricKey(metric.id) ?? 'total']}
                            backdropNotice={monthComparisonNotice}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Empty><EmptyDescription>{strings.summaryUnavailable}</EmptyDescription></Empty>
                  )}
                </CardContent>

              </Card>
            </div>

            <Card className="min-w-0">
              <CardHeader>
                <div>
                  <CardTitle role="heading" aria-level={2}>{strings.currentStatusTitle}</CardTitle>
                  <CardDescription>{strings.currentStatusDescription}</CardDescription>
                </div>
              </CardHeader>
<CardContent>
              {hasStatusSummary ? (
                <div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                  {statusMetrics.map((metric) => (
                    <SummaryMetricCard key={metric.id} metric={metric} compact />
                  ))}
                </div>
              ) : (
                <Empty><EmptyDescription>
                  {statusLoading ? strings.loading : strings.statusUnavailable}
                </EmptyDescription></Empty>
              )}
            </CardContent>
</Card>
          </div>
        )}
      </section>

      <DashboardTrendPanel
        strings={strings}
        overviewReady={overviewReady}
        hourlyRequestWindow={hourlyRequestWindow}
        rollupIntegrity={rollupIntegrity}
        initialChartMode={initialChartMode}
        initialVisibleResultSeries={initialVisibleResultSeries}
        initialVisibleTypeSeries={initialVisibleTypeSeries}
        initialVisibleCreditSeries={initialVisibleCreditSeries}
        chartPersistenceKey={chartPersistenceKey}
        chartLabelTimeZone={chartLabelTimeZone}
      />

      <Card className="surface panel">
        <CardHeader className="panel-header border-b">
          <div>
            <CardTitle role="heading" aria-level={2}>{strings.recentAlertsTitle}</CardTitle>
            <CardDescription>{strings.recentAlertsDescription}</CardDescription>
          </div>
          <CardAction><Button type="button" variant="outline" size="sm" onClick={onOpenRecentAlerts}>
            {strings.recentAlertsOpen}
          </Button></CardAction>
        </CardHeader>
        {!overviewReady ? (
          <Empty><EmptyDescription>{strings.loading}</EmptyDescription></Empty>
        ) : recentAlerts.totalEvents === 0 ? (
          <Empty><EmptyDescription>{strings.recentAlertsEmpty}</EmptyDescription></Empty>
        ) : (
          <CardContent className="dashboard-alerts-summary flex flex-col gap-4">
            <div className="dashboard-alerts-summary__overview grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-1 [&>p]:text-sm [&>p]:text-muted-foreground">
                <strong>{strings.recentAlertsOverviewTitle}</strong>
                <p>{strings.recentAlertsOverviewSummary}</p>
              </div>
              <div className="dashboard-alerts-summary__metrics grid grid-cols-3 gap-3">
                {recentAlerts.groupedCountWindows.map((item) => (
                  <article
                    className="dashboard-alerts-summary__metric-chip flex flex-col gap-1 p-3 [&>strong]:text-lg [&>strong]:tabular-nums [&>small]:text-muted-foreground"
                    data-current-window={item.windowHours === recentAlerts.windowHours ? 'true' : undefined}
                    key={item.windowHours}
                  >
                    <span>{compactWindowCountLabel(strings, item.windowHours)}</span>
                    <strong>{item.groupedCount}</strong>
                    {item.windowHours === recentAlerts.windowHours ? (
                      <small>{strings.recentAlertsCurrentWindow}</small>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
            <Table className="block md:table" aria-label={strings.recentAlertsTitle}>
              <TableHeader className="hidden md:table-header-group">
                <TableRow className="dashboard-alerts-summary__table-head">
                  <TableHead id={recentAlertsAlertHeaderId}>{strings.recentAlertsColumns.alert}</TableHead>
                  <TableHead id={recentAlertsWindowHeaderId}>{strings.recentAlertsColumns.timeRange}</TableHead>
                  <TableHead id={recentAlertsReviewHeaderId}>{strings.recentAlertsColumns.review}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="block md:table-row-group">
                {recentAlerts.topGroups.map((group, index) => {
                  const typeLabel = strings.recentAlertsTypeLabels[group.type]
                  const reasonBadgeLabel = getRecentAlertReasonBadgeLabel(group, typeLabel, language)
                  const rowBaseId = `${recentAlertsTableId}-row-${index}`
                  const subjectId = `${rowBaseId}-subject`
                  const summaryId = `${rowBaseId}-summary`
                  const windowId = `${rowBaseId}-window`
                  const actionHintId = `${rowBaseId}-action-hint`
                  const openGroupAriaLabel = `${strings.recentAlertsOpenGroup}: ${group.subjectLabel}`
                  const userSubjectId = group.subjectKind === 'user' ? group.user?.userId : null
                  const subjectLabel = group.subjectLabel.trim() || '—'

                  return (
                    <TableRow key={group.id} className="dashboard-alerts-summary__row flex flex-col gap-3 py-4 md:table-row md:py-0">
                      <TableCell
                        className="min-w-0"
                        role="cell"
                        aria-labelledby={`${recentAlertsAlertHeaderId} ${subjectId}`}
                        aria-describedby={summaryId}
                      >
                        <span className="dashboard-alerts-summary__field-label mb-1 block text-xs text-muted-foreground md:hidden" aria-hidden="true">{strings.recentAlertsColumns.alert}</span>
                        <div className="dashboard-alerts-summary__identity-head flex flex-wrap items-center gap-2">
                          {userSubjectId && onOpenUser ? (
                            <Button
                              type="button"
                              variant="link"
                              id={subjectId}
                              className="dashboard-alerts-summary__subject-button h-auto p-0"
                              onClick={() => onOpenUser(userSubjectId)}
                              aria-label={`${strings.recentAlertsOpenUser}: ${subjectLabel}`}
                            >
                              {subjectLabel}
                            </Button>
                          ) : (
                            <strong id={subjectId}>{subjectLabel}</strong>
                          )}
                          <div className="flex flex-wrap items-center gap-1">
                            <StatusBadge
                              tone={alertSummaryTone(group.type)}
                            >
                              {reasonBadgeLabel}
                            </StatusBadge>
                            <StatusBadge
                              tone={alertSummaryTone(group.type)}
                              className="dashboard-alerts-summary__count-badge"
                              title={`${group.count} ${strings.recentAlertsColumns.hits}`}
                            >
                              <strong>{group.count}</strong>
                              <span>{strings.recentAlertsColumns.hits}</span>
                            </StatusBadge>
                          </div>
                        </div>
                        {group.requestKind ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            <span className="inline-flex flex-wrap gap-1">
                              <span>
                                {strings.recentAlertsColumns.requestKind}
                              </span>
                              <span>
                                {group.requestKind.label}
                              </span>
                            </span>
                          </div>
                        ) : null}
                        <div className="mt-1 whitespace-normal text-sm text-muted-foreground" id={summaryId}>
                          <span>{group.latestEvent.summary}</span>
                        </div>
                      </TableCell>
                      <TableCell
                        className="md:w-60"
                        role="cell"
                        aria-labelledby={`${recentAlertsWindowHeaderId} ${windowId}`}
                      >
                        <span className="dashboard-alerts-summary__field-label mb-1 block text-xs text-muted-foreground md:hidden" aria-hidden="true">{strings.recentAlertsColumns.timeRange}</span>
                        <strong id={windowId} className="flex flex-wrap items-center gap-1 text-xs font-normal tabular-nums">
                          <time dateTime={formatAlertDateTimeIso(group.firstSeen)}>{formatAlertRange(group.firstSeen)}</time>
                          <span aria-hidden="true">→</span>
                          <time dateTime={formatAlertDateTimeIso(group.lastSeen)}>{formatAlertRange(group.lastSeen)}</time>
                        </strong>
                      </TableCell>
                      <TableCell
                        className="dashboard-alerts-summary__action md:w-28"
                        role="cell"
                        aria-labelledby={recentAlertsReviewHeaderId}
                      >
                        <span className="dashboard-alerts-summary__field-label mb-1 block text-xs text-muted-foreground md:hidden" aria-hidden="true">{strings.recentAlertsColumns.review}</span>
                        <span id={actionHintId} className="sr-only">
                          {group.subjectLabel} · {formatAlertRange(group.firstSeen)} → {formatAlertRange(group.lastSeen)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost" size="xs"
                          onClick={() => openRecentAlertGroup(group)}
                          aria-label={openGroupAriaLabel}
                          aria-describedby={actionHintId}
                        >
                          {strings.recentAlertsOpenGroup}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      <Card className="surface panel">
        <CardHeader className="panel-header border-b">
          <div>
            <CardTitle role="heading" aria-level={2}>{strings.actionsTitle}</CardTitle>
            <CardDescription>{strings.actionsDescription}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Card size="sm">
            <CardHeader><CardTitle role="heading" aria-level={3}>{strings.recentRequests}</CardTitle></CardHeader>
            <CardContent><ul className="flex flex-col gap-2">
              {logs.slice(0, 5).map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3">
                  <code>{log.key_id}</code>
                  <StatusBadge tone={log.result_status === 'success' ? 'success' : log.result_status === 'quota_exhausted' ? 'warning' : 'error'}>{log.result_status}</StatusBadge>
                </li>
              ))}
            </ul></CardContent>
          </Card>
          <Card size="sm">
            <CardHeader><CardTitle role="heading" aria-level={3}>{strings.recentJobs}</CardTitle></CardHeader>
            <CardContent><ul className="flex flex-col gap-2">
              {jobs.slice(0, 5).map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-3">
                  <span>#{job.id}</span>
                  <StatusBadge tone={job.status === 'success' ? 'success' : job.status === 'failed' ? 'error' : 'neutral'}>{job.status}</StatusBadge>
                </li>
              ))}
            </ul></CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}
