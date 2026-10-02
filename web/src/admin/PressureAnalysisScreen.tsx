import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import AdminLoadingRegion from '../components/AdminLoadingRegion'
import type { AnalysisCurrentUserPressureDistribution, AnalysisPressureSnapshot } from '../api'
import type { AdminTranslations, Language } from '../i18n'
import type React from 'react'

export type ActiveUserPressureDistributionPoint = { pressure: number; userCount: number }

function formatNumber(language: Language, value: number): string {
  return new Intl.NumberFormat(language === 'zh' ? 'zh-CN' : 'en-US').format(value)
}

function formatAxisTime(language: Language, timestamp: number): string {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp * 1000))
}

function formatAxisHour(language: Language, timestamp: number): string {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).format(new Date(timestamp * 1000))
}

export function buildActiveUserPressureDistribution(
  distribution: AnalysisCurrentUserPressureDistribution,
): ActiveUserPressureDistributionPoint[] {
  const pressureToUserCount = new Map<number, number>()

  for (const row of distribution.rows) {
    if (row.pressure <= 0) continue
    pressureToUserCount.set(row.pressure, (pressureToUserCount.get(row.pressure) ?? 0) + 1)
  }

  return [...pressureToUserCount.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([pressure, userCount]) => ({
      pressure,
      userCount,
    }))
}

function averagePressure(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export interface PressureAnalysisScreenProps {
  snapshot: AnalysisPressureSnapshot | null
  loading: boolean
  error: string | null
  language: Language
  strings: AdminTranslations['pressure']
  onRetry: () => void
}

export default function PressureAnalysisScreen({ snapshot, loading, error, language, strings, onRetry }: PressureAnalysisScreenProps): React.JSX.Element {
  const current24hAverage = averagePressure(snapshot?.server24h.current.map((point) => point.pressure) ?? [])
  const current24hData = snapshot?.server24h.current.map((point, index) => ({
    timestamp: point.displayBucketStart,
    current: point.pressure,
    previous: snapshot.server24h.previous[index]?.pressure ?? null,
    average: current24hAverage,
  })) ?? []
  const config24h = {
    current: { label: strings.charts.last24h.currentLabel, color: 'var(--chart-1)' },
    previous: { label: strings.charts.last24h.previousLabel, color: 'var(--chart-2)' },
    average: { label: `${strings.charts.last24h.averageLabel} (${formatNumber(language, Math.round(current24hAverage * 10) / 10)})`, color: 'var(--chart-3)' },
  } satisfies ChartConfig
  const config7d: ChartConfig = {
    pressure: { label: strings.charts.last7d.seriesLabel, color: 'var(--chart-1)' },
    sma6h: { label: strings.charts.last7d.sma6hLabel, color: 'var(--chart-2)' },
    sma24h: { label: strings.charts.last7d.sma24hLabel, color: 'var(--chart-3)' },
  }
  const server7dData = snapshot?.server7d.points.map((point, index) => ({
    timestamp: point.displayBucketStart,
    pressure: point.pressure,
    ...Object.fromEntries(snapshot.server7d.movingAverages.map((series) => [series.key, series.points[index]?.value ?? null])),
  })) ?? []
  const userDistributionPoints = useMemo(() => snapshot ? buildActiveUserPressureDistribution(snapshot.currentUserDistribution) : [], [snapshot])
  const distributionConfig = {
    userCount: { label: strings.charts.userDistribution.userCountLabel, color: 'var(--chart-1)' },
  } satisfies ChartConfig

  if (loading && !snapshot) return <AdminLoadingRegion loadState="initial_loading" loadingLabel={strings.loading} minHeight={420} />
  if (!snapshot) return (
    <Card className="pressure-analysis-empty-state" role={error ? 'alert' : undefined}>
      <CardHeader><CardTitle>{error ? strings.errorTitle : strings.emptyTitle}</CardTitle>
        <CardDescription>{error ?? strings.emptyDescription}</CardDescription></CardHeader>
      {error ? <CardContent><Button variant="outline" size="sm" onClick={onRetry}>{strings.retry}</Button></CardContent> : null}
    </Card>
  )
  return (
    <div className="pressure-analysis-page flex min-w-0 flex-col gap-6" data-testid="pressure-analysis-screen">
      <Card>
        <CardHeader><CardTitle>{strings.charts.last24h.title}</CardTitle><CardDescription>{strings.charts.last24h.description}</CardDescription></CardHeader>
        <CardContent>
          <ChartContainer config={config24h} className="h-80 w-full aspect-auto">
            <LineChart accessibilityLayer data={current24hData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={(value) => formatAxisTime(language, value)} tickLine={false} axisLine={false} tickMargin={10} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={40} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => formatAxisTime(language, payload[0]?.payload.timestamp ?? 0)} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line dataKey="current" type="natural" stroke="var(--color-current)" strokeWidth={2} dot={false} />
              <Line dataKey="previous" type="natural" stroke="var(--color-previous)" strokeWidth={2} dot={false} />
              <Line dataKey="average" stroke="var(--color-average)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{strings.charts.userDistribution.title}</CardTitle><CardDescription>{strings.charts.userDistribution.description}</CardDescription></CardHeader>
        <CardContent>
          {userDistributionPoints.length === 0 ? <Empty><EmptyDescription>{strings.charts.userDistribution.empty}</EmptyDescription></Empty> : (
            <ChartContainer config={distributionConfig} className="h-80 w-full aspect-auto" data-testid="pressure-distribution-chart">
              <AreaChart accessibilityLayer data={userDistributionPoints}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="pressure" type="number" tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => `${strings.charts.userDistribution.xAxisLabel}: ${payload[0]?.payload.pressure ?? 0}`} />} />
                <Area dataKey="userCount" type="natural" fill="var(--color-userCount)" fillOpacity={0.4} stroke="var(--color-userCount)" />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{strings.charts.last7d.title}</CardTitle><CardDescription>{strings.charts.last7d.description}</CardDescription></CardHeader>
        <CardContent>
          <ChartContainer config={config7d} className="h-80 w-full aspect-auto">
            <LineChart accessibilityLayer data={server7dData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={(value) => formatAxisHour(language, value)} tickLine={false} axisLine={false} tickMargin={10} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={40} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => formatAxisHour(language, payload[0]?.payload.timestamp ?? 0)} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line dataKey="pressure" type="natural" stroke="var(--color-pressure)" strokeWidth={2} dot={false} />
              {snapshot.server7d.movingAverages.map((series) => <Line key={series.key} dataKey={series.key} type="natural" stroke={`var(--color-${series.key})`} strokeWidth={2} dot={false} />)}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
