import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Area, ComposedChart, CartesianGrid, Line, YAxis } from 'recharts'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import type { ReactNode } from 'react'
import type React from 'react'

import type {
  UserDashboardOverview,
  UserDashboardProgressCard,
} from '../api'
import { UsageMetricLabel } from '../components/UsageMetricLabel'
import { quotaLoadTextClass } from './DashboardQuotaGrid'
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

function ProgressChart({
  card,
  accentId,
  language,
}: {
  card: UserDashboardProgressCard | null
  accentId: keyof typeof CHART_ACCENT_COLOR
  language: Language
}): React.JSX.Element {
  const config = {
    value: { label: language === 'zh' ? '已用' : 'Used', color: CHART_ACCENT_COLOR[accentId] },
    limitValue: { label: language === 'zh' ? '上限' : 'Limit', color: 'var(--muted-foreground)' },
  } satisfies ChartConfig
  if (!card || !card.points.some((point) => point.value != null || point.limitValue != null)) {
    return (
      <Empty className="h-28 min-h-0 p-0">
        <EmptyDescription>—</EmptyDescription>
      </Empty>
    )
  }
  const points = card.points.map((point) => ({
    ...point,
    label: new Date((point.displayBucketStart ?? point.bucketStart) * 1000)
      .toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US'),
  }))

  return (
    <ChartContainer config={config} className="h-28 w-full aspect-auto" data-accent={accentId}>
      <ComposedChart accessibilityLayer margin={{ top: 8, right: 4, bottom: 0, left: 4 }} data={points}>
        <CartesianGrid vertical={false} />
        <YAxis hide domain={[0, 'auto']} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload[0]?.payload.label} />} />
        <Area
          dataKey="value"
          type="linear"
          fill="var(--color-value)"
          fillOpacity={0.15}
          stroke="var(--color-value)"
          strokeWidth={2}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="limitValue"
          type="stepAfter"
          stroke="var(--color-limitValue)"
          strokeDasharray="5 4"
          strokeWidth={1.5}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
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
  tone,
  formatNumber,
}: {
  label: string
  value: number
  loading: boolean
  tone: 'success' | 'failure' | 'month'
  formatNumber: (value: number) => string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        `user-console-summary-card user-console-summary-card-${tone}`,
        'flex flex-col gap-3',
        tone === 'month' && 'col-span-2 @lg:col-span-1',
      )}
    >
      <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div>
        <span
          className={cn(
            'text-3xl font-semibold tabular-nums',
            SUMMARY_TONE_VALUE_CLASS[tone],
            loading && 'text-muted-foreground/50',
          )}
        >
          {loading ? '--' : formatNumber(value)}
        </span>
      </div>
    </div>
  )
}

const CHART_ACCENT_COLOR: Record<'request' | 'hour' | 'day' | 'month', string> = {
  request: 'var(--chart-1)',
  hour: 'var(--chart-2)',
  day: 'var(--chart-4)',
  month: 'var(--chart-3)',
}

function ProgressCard({
  language,
  label,
  card,
  loading,
  accent,
  marker,
  formatNumber,
}: {
  language: Language
  label: ReactNode
  card: UserDashboardProgressCard | null
  loading: boolean
  accent: 'request' | 'hour' | 'day' | 'month'
  marker: string
  formatNumber: (value: number) => string
}): React.JSX.Element {
  const fillRatio = !loading && card && card.limit > 0
    ? Math.max(0, Math.min(1, card.used / card.limit))
    : null

  return (
    <div
      className={cn(
        `user-console-progress-card user-console-progress-card-${accent}`,
        'flex flex-col gap-3',
        loading && 'is-loading',
      )}
    >
      <div>
        <div className="min-h-8 min-w-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <strong className={cn('text-2xl font-semibold tabular-nums', loading && 'text-muted-foreground/50')}>
            {loading || !card ? '--' : formatNumber(card.used)}
          </strong>
          <span className="ml-1.5 text-sm text-muted-foreground">
            {loading || !card ? '/ --' : `/ ${formatNumber(card.limit)}`}
          </span>
        </div>
        <ProgressChart card={card} accentId={accent} language={language} />
      </div>
      <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span>{marker}</span>
        <strong className={cn('tabular-nums', fillRatio == null ? 'text-muted-foreground' : quotaLoadTextClass(fillRatio))}>
          {fillRatio == null ? '--' : `${Math.round(fillRatio * 100)}%`}
        </strong>
      </div>
    </div>
  )
}

export default function UserDashboardOverview({
  text,
  overview,
  loading,
  language,
  requestRateLabel,
  formatNumber,
}: UserDashboardOverviewProps): React.JSX.Element {
  const summary = overview?.summary ?? null
  const progress = overview?.progress ?? null
  const markerText = language === 'zh'
    ? {
        monthUtc: 'UTC 月',
        rolling: '滚动 5 分钟',
        hour: '当前小时',
        day: '当前自然日',
      }
    : {
        monthUtc: 'UTC month',
        rolling: 'Rolling 5m',
        hour: 'Current hour',
        day: 'Current day',
      }

  return (
    <div className="@container flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 @lg:grid-cols-3">
        <SummaryCard
          label={text.dailySuccess}
          value={summary?.dailySuccess ?? 0}
          loading={loading}
          tone="success"
          formatNumber={formatNumber}
        />
        <SummaryCard
          label={text.dailyFailure}
          value={summary?.dailyFailure ?? 0}
          loading={loading}
          tone="failure"
          formatNumber={formatNumber}
        />
        <SummaryCard
          label={text.monthlySuccessUtc}
          value={summary?.monthlySuccess ?? 0}
          loading={loading}
          tone="month"
          formatNumber={formatNumber}
        />
      </div>

      <div className="grid gap-4 @md:grid-cols-2 @5xl:grid-cols-4">
        <ProgressCard
          language={language}
          label={requestRateLabel}
          card={progress?.requestRate ?? null}
          loading={loading}
          accent="request"
          marker={markerText.rolling}
          formatNumber={formatNumber}
        />
        <ProgressCard
          language={language}
          label={
            <UsageMetricLabel
              label={text.hourly}
              kind="businessCalls1h"
              language={language}
              className="min-w-0 whitespace-normal text-left"
            />
          }
          card={progress?.businessCalls1h ?? null}
          loading={loading}
          accent="hour"
          marker={markerText.hour}
          formatNumber={formatNumber}
        />
        <ProgressCard
          language={language}
          label={
            <UsageMetricLabel
              label={text.daily}
              kind="dailyCredits"
              language={language}
              className="min-w-0 whitespace-normal text-left"
            />
          }
          card={progress?.dailyCredits ?? null}
          loading={loading}
          accent="day"
          marker={markerText.day}
          formatNumber={formatNumber}
        />
        <ProgressCard
          language={language}
          label={
            <UsageMetricLabel
              label={text.monthly}
              kind="monthlyCredits"
              language={language}
              className="min-w-0 whitespace-normal text-left"
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
