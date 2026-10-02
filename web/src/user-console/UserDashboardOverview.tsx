import type { ReactNode } from 'react'

import type {
  UserDashboardOverview,
  UserDashboardOverviewSeriesPoint,
  UserDashboardProgressCard,
} from '../api'
import { UsageMetricLabel } from '../components/UsageMetricLabel'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Language } from '../i18n'

interface UserDashboardOverviewText {
  usage: string
  description: string
  dailySuccess: string
  dailyFailure: string
  monthlySuccessUtc: string
  hourly: string
  daily: string
  monthly: string
}

interface UserDashboardOverviewProps {
  text: UserDashboardOverviewText
  overview: UserDashboardOverview | null
  loading: boolean
  language: Language
  requestRateLabel: string
  formatNumber: (value: number) => string
}

interface ChartSegment {
  areaPath: string
  linePath: string
  lastPoint: { x: number, y: number } | null
}

interface ChartGeometry {
  actualSegments: ChartSegment[]
  limitPaths: string[]
  width: number
  height: number
  hasData: boolean
}

const CHART_WIDTH = 320
const CHART_HEIGHT = 148
const CHART_INSET_TOP = 10
const CHART_INSET_RIGHT = 10
const CHART_INSET_BOTTOM = 10
const CHART_INSET_LEFT = 10

function chartPathForSegment(
  points: Array<{ x: number, y: number }>,
  baselineY: number,
): ChartSegment | null {
  if (points.length === 0) return null
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${baselineY.toFixed(2)} L ${points[0].x.toFixed(2)} ${baselineY.toFixed(2)} Z`
  return {
    areaPath,
    linePath,
    lastPoint: points[points.length - 1] ?? null,
  }
}

function buildSeriesPaths(
  points: UserDashboardOverviewSeriesPoint[],
  pickValue: (point: UserDashboardOverviewSeriesPoint) => number | null,
): string[] {
  if (points.length === 0) return []
  const maxValue = Math.max(
    1,
    ...points.flatMap((point) => {
      const value = pickValue(point)
      return typeof value === 'number' && Number.isFinite(value) ? [value] : []
    }),
  )
  const plotWidth = CHART_WIDTH - CHART_INSET_LEFT - CHART_INSET_RIGHT
  const plotHeight = CHART_HEIGHT - CHART_INSET_TOP - CHART_INSET_BOTTOM
  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0
  const segments: string[] = []
  let currentSegment: Array<{ x: number, y: number }> = []

  points.forEach((point, index) => {
    const value = pickValue(point)
    if (value == null) {
      if (currentSegment.length > 1) {
        segments.push(
          currentSegment
            .map((segmentPoint, segmentIndex) => `${segmentIndex === 0 ? 'M' : 'L'} ${segmentPoint.x.toFixed(2)} ${segmentPoint.y.toFixed(2)}`)
            .join(' '),
        )
      }
      currentSegment = []
      return
    }
    const x = CHART_INSET_LEFT + xStep * index
    const y = CHART_INSET_TOP + (1 - value / maxValue) * plotHeight
    currentSegment.push({ x, y })
  })

  if (currentSegment.length > 1) {
    segments.push(
      currentSegment
        .map((segmentPoint, segmentIndex) => `${segmentIndex === 0 ? 'M' : 'L'} ${segmentPoint.x.toFixed(2)} ${segmentPoint.y.toFixed(2)}`)
        .join(' '),
    )
  }

  return segments
}

function buildChartGeometry(points: UserDashboardOverviewSeriesPoint[]): ChartGeometry {
  if (points.length === 0) {
    return {
      actualSegments: [],
      limitPaths: [],
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
      hasData: false,
    }
  }

  const maxValue = Math.max(
    1,
    ...points.flatMap((point) => {
      const out: number[] = []
      if (typeof point.value === 'number' && Number.isFinite(point.value)) out.push(point.value)
      if (typeof point.limitValue === 'number' && Number.isFinite(point.limitValue)) out.push(point.limitValue)
      return out
    }),
  )
  const plotWidth = CHART_WIDTH - CHART_INSET_LEFT - CHART_INSET_RIGHT
  const plotHeight = CHART_HEIGHT - CHART_INSET_TOP - CHART_INSET_BOTTOM
  const baselineY = CHART_HEIGHT - CHART_INSET_BOTTOM
  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0
  const actualSegments: ChartSegment[] = []
  let currentActualSegment: Array<{ x: number, y: number }> = []

  points.forEach((point, index) => {
    if (point.value == null) {
      const segment = chartPathForSegment(currentActualSegment, baselineY)
      if (segment) actualSegments.push(segment)
      currentActualSegment = []
      return
    }

    const x = CHART_INSET_LEFT + xStep * index
    const y = CHART_INSET_TOP + (1 - point.value / maxValue) * plotHeight
    currentActualSegment.push({ x, y })
  })

  const tailSegment = chartPathForSegment(currentActualSegment, baselineY)
  if (tailSegment) actualSegments.push(tailSegment)

  return {
    actualSegments,
    limitPaths: buildSeriesPaths(points, (point) => point.limitValue),
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    hasData: actualSegments.length > 0,
  }
}

const CHART_ACCENT_CLASS: Record<'request' | 'hour' | 'day' | 'month', string> = {
  request: 'text-chart-1',
  hour: 'text-chart-2',
  day: 'text-chart-4',
  month: 'text-chart-3',
}

function ProgressChart({
  card,
  accentId,
}: {
  card: UserDashboardProgressCard | null
  accentId: string
}): JSX.Element {
  if (!card) {
    return (
      <div
        className="user-console-progress-chart user-console-progress-chart-empty min-h-[120px] flex-1 rounded-lg border border-dashed border-border/70 bg-muted/30"
        aria-hidden="true"
      />
    )
  }

  const geometry = buildChartGeometry(card.points)

  if (!geometry.hasData && geometry.limitPaths.length === 0) {
    return (
      <div
        className="user-console-progress-chart user-console-progress-chart-empty min-h-[120px] flex-1 rounded-lg border border-dashed border-border/70 bg-muted/30"
        aria-hidden="true"
      />
    )
  }

  const lastPoint = geometry.actualSegments[geometry.actualSegments.length - 1]?.lastPoint ?? null

  return (
    <div
      className={cn(
        'user-console-progress-chart relative min-h-[120px] flex-1 self-stretch overflow-hidden rounded-lg bg-muted/20',
        CHART_ACCENT_CLASS[accentId as keyof typeof CHART_ACCENT_CLASS] ?? 'text-chart-1',
      )}
      aria-hidden="true"
    >
      <svg
        className="user-console-progress-chart-svg h-full w-full"
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        preserveAspectRatio="none"
        data-accent={accentId}
      >
        <defs>
          <linearGradient id={`user-console-${accentId}-area`} x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
            <stop offset="85%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {geometry.limitPaths.map((path, index) => (
          <path
            key={`limit-${index}`}
            d={path}
            className="user-console-progress-limit-path fill-none stroke-muted-foreground/60 [stroke-dasharray:5_4] [stroke-width:1.5]"
          />
        ))}
        {geometry.actualSegments.map((segment, index) => (
          <g key={`actual-${index}`}>
            <path d={segment.areaPath} fill={`url(#user-console-${accentId}-area)`} />
            <path d={segment.linePath} className="user-console-progress-line-path fill-none stroke-current [vector-effect:non-scaling-stroke] [stroke-width:2]" />
          </g>
        ))}
        {lastPoint ? (
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="4"
            className="user-console-progress-line-cap fill-current stroke-background [stroke-width:2]"
          />
        ) : null}
      </svg>
    </div>
  )
}

const SUMMARY_TONE_VALUE_CLASS: Record<'success' | 'failure' | 'month', string> = {
  success: 'text-success',
  failure: 'text-destructive',
  month: 'text-foreground',
}

function SummaryCard({
  label,
  value,
  loading,
  marker,
  tone,
  formatNumber,
}: {
  label: string
  value: number
  loading: boolean
  marker: string
  tone: 'success' | 'failure' | 'month'
  formatNumber: (value: number) => string
}): JSX.Element {
  return (
    <Card
      className={cn(
        `user-console-summary-card user-console-summary-card-${tone}`,
        'gap-2 py-5',
      )}
    >
      <CardHeader className="user-console-summary-card-header gap-1">
        <CardDescription className="user-console-summary-card-label text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </CardDescription>
        <CardAction className="user-console-summary-card-marker text-xs text-muted-foreground">
          {marker}
        </CardAction>
      </CardHeader>
      <CardContent className="user-console-summary-card-value">
        <span
          className={cn(
            'text-3xl font-semibold tabular-nums',
            SUMMARY_TONE_VALUE_CLASS[tone],
            loading && 'text-muted-foreground/50',
          )}
        >
          {loading ? '--' : formatNumber(value)}
        </span>
      </CardContent>
      <CardFooter className="user-console-summary-card-foot justify-between text-xs text-muted-foreground">
        <span>{marker}</span>
      </CardFooter>
    </Card>
  )
}

function ProgressCard({
  label,
  card,
  loading,
  accent,
  marker,
  formatNumber,
}: {
  label: ReactNode
  card: UserDashboardProgressCard | null
  loading: boolean
  accent: 'request' | 'hour' | 'day' | 'month'
  marker: string
  formatNumber: (value: number) => string
}): JSX.Element {
  const fillRatio = !loading && card && card.limit > 0
    ? Math.max(0, Math.min(1, card.used / card.limit))
    : null

  return (
    <Card
      className={cn(
        `user-console-progress-card user-console-progress-card-${accent}`,
        loading && 'is-loading',
        'gap-3 py-5',
      )}
    >
      <div className="user-console-progress-card-copy flex flex-1 flex-col gap-3">
        <CardHeader className="user-console-progress-card-header gap-1">
          <CardDescription className="user-console-progress-card-label min-w-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </CardDescription>
          <CardAction className="user-console-progress-card-marker text-xs text-muted-foreground">
            {marker}
          </CardAction>
        </CardHeader>
        <CardContent className="user-console-progress-card-value">
          <strong className={cn('text-2xl font-semibold tabular-nums', loading && 'text-muted-foreground/50')}>
            {loading || !card ? '--' : formatNumber(card.used)}
          </strong>
          <span className="ml-1.5 text-sm text-muted-foreground">
            {loading || !card ? '/ --' : `/ ${formatNumber(card.limit)}`}
          </span>
        </CardContent>
        <CardFooter className="user-console-progress-card-foot mt-auto justify-between border-t bg-transparent pt-3 text-xs text-muted-foreground">
          <span>{marker}</span>
          <strong className={cn('tabular-nums', CHART_ACCENT_CLASS[accent])}>
            {fillRatio == null ? '--' : `${Math.round(fillRatio * 100)}%`}
          </strong>
        </CardFooter>
      </div>
      <div className="px-4">
        <ProgressChart card={card} accentId={accent} />
      </div>
    </Card>
  )
}

export default function UserDashboardOverview({
  text,
  overview,
  loading,
  language,
  requestRateLabel,
  formatNumber,
}: UserDashboardOverviewProps): JSX.Element {
  const summary = overview?.summary ?? null
  const progress = overview?.progress ?? null
  const markerText = language === 'zh'
    ? {
        today: '今日',
        monthUtc: 'UTC 月',
        rolling: '滚动 5 分钟',
        hour: '当前小时',
        day: '当前自然日',
      }
    : {
        today: 'Today',
        monthUtc: 'UTC month',
        rolling: 'Rolling 5m',
        hour: 'Current hour',
        day: 'Current day',
      }

  return (
    <div className="user-console-overview-grid flex flex-col gap-4">
      <div className="user-console-summary-grid grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label={text.dailySuccess}
          value={summary?.dailySuccess ?? 0}
          loading={loading}
          marker={markerText.today}
          tone="success"
          formatNumber={formatNumber}
        />
        <SummaryCard
          label={text.dailyFailure}
          value={summary?.dailyFailure ?? 0}
          loading={loading}
          marker={markerText.today}
          tone="failure"
          formatNumber={formatNumber}
        />
        <SummaryCard
          label={text.monthlySuccessUtc}
          value={summary?.monthlySuccess ?? 0}
          loading={loading}
          marker={markerText.monthUtc}
          tone="month"
          formatNumber={formatNumber}
        />
      </div>

      <div className="user-console-progress-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ProgressCard
          label={requestRateLabel}
          card={progress?.requestRate ?? null}
          loading={loading}
          accent="request"
          marker={markerText.rolling}
          formatNumber={formatNumber}
        />
        <ProgressCard
          label={
            <UsageMetricLabel
              label={text.hourly}
              kind="businessCalls1h"
              language={language}
              className="user-console-progress-card-label"
            />
          }
          card={progress?.businessCalls1h ?? null}
          loading={loading}
          accent="hour"
          marker={markerText.hour}
          formatNumber={formatNumber}
        />
        <ProgressCard
          label={
            <UsageMetricLabel
              label={text.daily}
              kind="dailyCredits"
              language={language}
              className="user-console-progress-card-label"
            />
          }
          card={progress?.dailyCredits ?? null}
          loading={loading}
          accent="day"
          marker={markerText.day}
          formatNumber={formatNumber}
        />
        <ProgressCard
          label={
            <UsageMetricLabel
              label={text.monthly}
              kind="monthlyCredits"
              language={language}
              className="user-console-progress-card-label"
            />
          }
          card={progress?.monthlyCredits ?? null}
          loading={loading}
          accent="month"
          marker={markerText.monthUtc}
          formatNumber={formatNumber}
        />
      </div>
    </div>
  )
}
