import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Toggle } from '@/components/ui/toggle'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useEffect, useMemo, useState } from 'react'
import type React from 'react'

import type { DashboardHourlyRequestWindow, DashboardRollupIntegrityStatus } from '../api'
import SegmentedTabs from '@/components/SegmentedTabs'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart'
import {
  formatDashboardRealtimeWindowLabel,
  buildRollingHourlyWindow,
  getVisibleHourlyWindow,
  DASHBOARD_RESULT_SERIES_ORDER,
  DASHBOARD_TYPE_SERIES_ORDER,
  DASHBOARD_CREDIT_SERIES_ORDER,
  DEFAULT_VISIBLE_CREDIT_SERIES,
  DEFAULT_VISIBLE_RESULT_SERIES,
  DEFAULT_VISIBLE_TYPE_SERIES,
  createDashboardHourlyChartPreferences,
  formatHourlyBucketLabel,
  getResultSeriesValue,
  getTypeSeriesValue,
  getCreditSeriesValue,
  readDashboardHourlyChartPreferences,
  toggleSeriesSelection,
  writeDashboardHourlyChartPreferences,
  type DashboardCreditSeriesId,
  type DashboardHourlyChartMode,
  type DashboardHourlyChartPreferences,
  type DashboardResultSeriesId,
  type DashboardTypeSeriesId,
} from './dashboardHourlyCharts'
import type { DashboardOverviewStrings } from './DashboardOverview'

function formatChartWindow(copy: string, count: number): string {
  return copy.replace('{count}', String(count))
}

function formatChartWindowWithLabels(
  chartMode: DashboardHourlyChartMode,
  strings: Pick<DashboardOverviewStrings, 'chartUtcWindow' | 'chartRollingWindow'>,
  count: number,
  window?: DashboardHourlyRequestWindow,
): string {
  if (chartMode === 'resultsArea' || chartMode === 'typesArea' || chartMode === 'creditsArea') {
    return formatDashboardRealtimeWindowLabel(
      strings.chartRollingWindow,
      window?.bucketSeconds ?? 0,
      window?.visibleBuckets ?? count,
      count,
    )
  }
  return formatChartWindow(strings.chartUtcWindow, count)
}

function DashboardChartSeriesButton({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean
  label: string
  color: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <Toggle
      variant="outline"
      size="sm"
      className="dashboard-chart-series-chip"
      onPressedChange={onClick}
      pressed={active}
    >
      <span className="dashboard-chart-series-chip-swatch size-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      <span>{label}</span>
    </Toggle>
  )
}

function isAreaChartMode(mode: DashboardHourlyChartMode): mode is 'resultsArea' | 'typesArea' | 'creditsArea' {
  return mode === 'resultsArea' || mode === 'typesArea' || mode === 'creditsArea'
}

function isCreditChartMode(mode: DashboardHourlyChartMode): mode is 'credits' | 'creditsArea' {
  return mode === 'credits' || mode === 'creditsArea'
}

export default function DashboardTrendPanel({
  strings,
  overviewReady,
  hourlyRequestWindow,
  rollupIntegrity,
  initialChartMode = 'results',
  initialVisibleResultSeries = DEFAULT_VISIBLE_RESULT_SERIES,
  initialVisibleTypeSeries = DEFAULT_VISIBLE_TYPE_SERIES,
  initialVisibleCreditSeries = DEFAULT_VISIBLE_CREDIT_SERIES,
  chartPersistenceKey = null,
  chartLabelTimeZone = null,
}: {
  strings: DashboardOverviewStrings
  overviewReady: boolean
  hourlyRequestWindow: DashboardHourlyRequestWindow
  rollupIntegrity: DashboardRollupIntegrityStatus
  initialChartMode?: DashboardHourlyChartMode
  initialVisibleResultSeries?: ReadonlyArray<DashboardResultSeriesId>
  initialVisibleTypeSeries?: ReadonlyArray<DashboardTypeSeriesId>
  initialVisibleCreditSeries?: ReadonlyArray<DashboardCreditSeriesId>
  chartPersistenceKey?: string | null
  chartLabelTimeZone?: string | null
}): React.JSX.Element {
  const legacyChartPersistenceKeys = useMemo(
    () => (
      chartPersistenceKey === 'admin.dashboard.hourly-request-charts.v2'
        ? ['admin.dashboard.hourly-request-charts.v1']
        : []
    ),
    [chartPersistenceKey],
  )
  const initialPreferences = useMemo<DashboardHourlyChartPreferences>(() => {
    const fallback = createDashboardHourlyChartPreferences({
      chartMode: initialChartMode,
      visibleResultSeries: initialVisibleResultSeries,
      visibleTypeSeries: initialVisibleTypeSeries,
      visibleCreditSeries: initialVisibleCreditSeries,
    })
    if (typeof window === 'undefined') return fallback
    return readDashboardHourlyChartPreferences(
      window.localStorage,
      chartPersistenceKey,
      legacyChartPersistenceKeys,
    ) ?? fallback
  }, [
    chartPersistenceKey,
    initialChartMode,
    initialVisibleCreditSeries,
    initialVisibleResultSeries,
    initialVisibleTypeSeries,
    legacyChartPersistenceKeys,
  ])

  const [chartMode, setChartMode] = useState<DashboardHourlyChartMode>(initialPreferences.chartMode)
  const [visibleResultSeries, setVisibleResultSeries] = useState<DashboardResultSeriesId[]>(initialPreferences.visibleResultSeries)
  const [visibleTypeSeries, setVisibleTypeSeries] = useState<DashboardTypeSeriesId[]>(initialPreferences.visibleTypeSeries)
  const [visibleCreditSeries, setVisibleCreditSeries] = useState<DashboardCreditSeriesId[]>(initialPreferences.visibleCreditSeries)

  useEffect(() => {
    if (typeof window === 'undefined') return
    writeDashboardHourlyChartPreferences(window.localStorage, chartPersistenceKey, {
      chartMode,
      visibleResultSeries,
      visibleTypeSeries,
      visibleCreditSeries,
    })
  }, [
    chartMode,
    chartPersistenceKey,
    visibleCreditSeries,
    visibleResultSeries,
    visibleTypeSeries,
  ])

  const isAreaMode = isAreaChartMode(chartMode)
  const isCreditMode = isCreditChartMode(chartMode)
  const rangeSlots = useMemo(() => isAreaMode
    ? getVisibleHourlyWindow(hourlyRequestWindow).slots
    : buildRollingHourlyWindow(hourlyRequestWindow).slots, [hourlyRequestWindow, isAreaMode])
  const resultSeriesLabels: Record<DashboardResultSeriesId, string> = {
    secondarySuccess: strings.chartResultSecondarySuccess, primarySuccess: strings.chartResultPrimarySuccess,
    secondaryFailure: strings.chartResultSecondaryFailure, primaryFailure429: strings.chartResultPrimaryFailure429,
    primaryFailureOther: strings.chartResultPrimaryFailureOther, unknown: strings.chartResultUnknown,
  }
  const typeSeriesLabels: Record<DashboardTypeSeriesId, string> = {
    mcpNonBillable: strings.chartTypeMcpNonBillable, mcpBillable: strings.chartTypeMcpBillable,
    apiNonBillable: strings.chartTypeApiNonBillable, apiBillable: strings.chartTypeApiBillable,
  }
  const creditSeriesLabels: Record<DashboardCreditSeriesId, string> = {
    localEstimate: strings.chartCreditLocalEstimate, upstreamActual: strings.chartCreditUpstreamActual,
  }
  const seriesLabels = { ...resultSeriesLabels, ...typeSeriesLabels, ...creditSeriesLabels }
  const allSeries = isCreditMode ? DASHBOARD_CREDIT_SERIES_ORDER
    : chartMode === 'types' || chartMode === 'typesArea' ? DASHBOARD_TYPE_SERIES_ORDER : DASHBOARD_RESULT_SERIES_ORDER
  const activeSeries = isCreditMode ? visibleCreditSeries
    : chartMode === 'types' || chartMode === 'typesArea' ? visibleTypeSeries : visibleResultSeries
  const chartConfig: ChartConfig = Object.fromEntries(allSeries.map((key, index) => [key, {
    label: seriesLabels[key], color: `var(--chart-${index % 5 + 1})`,
  }]))
  const chartData = rangeSlots.map((slot, index) => ({
    label: slot.bucketStart == null ? '' : formatHourlyBucketLabel(slot.bucketStart, chartLabelTimeZone ?? undefined).join(' '),
    index,
    ...Object.fromEntries(allSeries.map((key) => [key, !slot.bucket ? null
      : isCreditMode ? getCreditSeriesValue(slot.bucket, key as DashboardCreditSeriesId)
      : chartMode === 'types' || chartMode === 'typesArea' ? getTypeSeriesValue(slot.bucket, key as DashboardTypeSeriesId)
      : getResultSeriesValue(slot.bucket, key as DashboardResultSeriesId)])),
  }))
  const seriesColors = Object.fromEntries(allSeries.map((key, index) => [key, `var(--chart-${index % 5 + 1})`]))
  const modeOptions = [
    { value: 'results' as const, label: strings.chartModeResults },
    { value: 'types' as const, label: strings.chartModeTypes },
    { value: 'credits' as const, label: strings.chartModeCredits },
    { value: 'resultsArea' as const, label: strings.chartModeResultsArea },
    { value: 'typesArea' as const, label: strings.chartModeTypesArea },
    { value: 'creditsArea' as const, label: strings.chartModeCreditsArea },
  ]

  const showEmpty = overviewReady && (rangeSlots.length === 0 || activeSeries.length === 0)
  const chartSeriesLabel = strings.chartVisibleSeries
  const chartMeta = formatChartWindowWithLabels(
    chartMode,
    strings,
    rangeSlots.length,
    hourlyRequestWindow,
  )
  const integrityLabel = rollupIntegrity.state === 'healthy'
    ? strings.chartIntegrityHealthy
    : rollupIntegrity.state === 'degraded'
      ? strings.chartIntegrityDegraded
      : strings.chartIntegrityRepairing
  const integrityTimestamp = rollupIntegrity.lastVerifiedAt == null
    ? null
    : new Date(rollupIntegrity.lastVerifiedAt * 1000).toLocaleString()

  return (
    <Card className="surface panel dashboard-trend-panel">
      <CardHeader className="panel-header border-b dashboard-trend-header">
        <div>
          <CardTitle role="heading" aria-level={2}>{strings.trendsTitle}</CardTitle>
          <CardDescription className="panel-description">{strings.trendsDescription}</CardDescription>
        </div>
        <div className="dashboard-trend-meta flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{chartMeta}</span>
          <span className={`dashboard-rollup-integrity is-${rollupIntegrity.state}`}>
            {integrityLabel}
            {integrityTimestamp && ` · ${strings.chartIntegrityLastVerified.replace('{time}', integrityTimestamp)}`}
          </span>
        </div>
      </CardHeader>

      <SegmentedTabs<DashboardHourlyChartMode>
        className="dashboard-trend-segmented px-4"
        value={chartMode}
        onChange={setChartMode}
        options={modeOptions}
        ariaLabel={strings.trendsTitle}
      />

      <div className="dashboard-chart-toolbar flex flex-wrap items-center justify-between gap-2 px-4">
        <span className="dashboard-chart-toolbar-label text-sm font-medium">{chartSeriesLabel}</span>
        <div className="dashboard-chart-series-list flex flex-wrap items-center gap-x-4 gap-y-1" role="group" aria-label={chartSeriesLabel}>
          {(chartMode === 'results' || chartMode === 'resultsArea'
            ? DASHBOARD_RESULT_SERIES_ORDER.map((seriesId) => (
                <DashboardChartSeriesButton
                  key={seriesId}
                  active={visibleResultSeries.includes(seriesId)}
                  label={resultSeriesLabels[seriesId]}
                  color={seriesColors[seriesId]}
                  onClick={() => setVisibleResultSeries((current) => toggleSeriesSelection(current, seriesId))}
                />
              ))
            : chartMode === 'types' || chartMode === 'typesArea'
              ? DASHBOARD_TYPE_SERIES_ORDER.map((seriesId) => (
                  <DashboardChartSeriesButton
                    key={seriesId}
                    active={visibleTypeSeries.includes(seriesId)}
                    label={typeSeriesLabels[seriesId]}
                    color={seriesColors[seriesId]}
                    onClick={() => setVisibleTypeSeries((current) => toggleSeriesSelection(current, seriesId))}
                  />
                ))
              : DASHBOARD_CREDIT_SERIES_ORDER.map((seriesId) => (
                      <DashboardChartSeriesButton
                        key={seriesId}
                        active={visibleCreditSeries.includes(seriesId)}
                        label={creditSeriesLabels[seriesId]}
                        color={seriesColors[seriesId]}
                        onClick={() => setVisibleCreditSeries((current) => toggleSeriesSelection(current, seriesId))}
                      />
                    )))}
        </div>
      </div>

      <CardContent className="dashboard-chart-shell min-w-0">
        {!overviewReady ? (
          <Empty className="empty-state"><EmptyDescription>{strings.loading}</EmptyDescription></Empty>
        ) : showEmpty ? (
          <Empty className="empty-state"><EmptyDescription>{strings.chartEmpty}</EmptyDescription></Empty>
        ) : (
          <ChartContainer config={chartConfig} className="h-80 w-full aspect-auto">
            {isAreaMode ? (
              <AreaChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {activeSeries.map((key) => (
                  <Area key={key} dataKey={key} type="natural" stackId={isCreditMode ? undefined : 'requests'}
                    stroke={`var(--color-${key})`} fill={`var(--color-${key})`} fillOpacity={0.4} />
                ))}
              </AreaChart>
            ) : (
              <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {activeSeries.map((key) => (
                  <Bar key={key} dataKey={key} stackId={isCreditMode ? undefined : 'requests'} fill={`var(--color-${key})`} radius={4} />
                ))}
              </BarChart>
            )}
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
