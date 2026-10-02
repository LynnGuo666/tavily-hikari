import type { ReactNode } from 'react'

import type { RequestRate } from '../api'
import { UsageMetricLabel } from '../components/UsageMetricLabel'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface DashboardQuotaGridText {
  hourly: string
  daily: string
  monthly: string
}

interface DashboardQuotaGridProps {
  text: DashboardQuotaGridText
  rateLabel: string
  rate: RequestRate
  hourlyUsed: number
  hourlyLimit: number
  dailyUsed: number
  dailyLimit: number
  monthlyUsed: number
  monthlyLimit: number
  formatNumber: (value: number) => string
  language: 'en' | 'zh'
}

function quotaRatio(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.max(0, Math.min(1, used / limit))
}

function progressToneClass(ratio: number): string {
  if (ratio >= 1) return '[&>[data-slot=progress-indicator]]:bg-destructive'
  if (ratio >= 0.8) return '[&>[data-slot=progress-indicator]]:bg-warning'
  return '[&>[data-slot=progress-indicator]]:bg-success'
}

function QuotaStatCard({
  label,
  used,
  limit,
  formatNumber,
}: {
  label: ReactNode
  used: number
  limit: number
  formatNumber: (value: number) => string
}): JSX.Element {
  const ratio = quotaRatio(used, limit)

  return (
    <Card className="access-stat quota-stat-card gap-2 py-4">
      <CardHeader className="quota-stat-label gap-1">
        <CardDescription className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent className="quota-stat-value flex flex-col gap-2">
        <div className="text-2xl font-semibold tabular-nums">
          {formatNumber(used)}
          <span className="ml-1 text-sm font-normal text-muted-foreground">/ {formatNumber(limit)}</span>
        </div>
        <Progress
          value={Math.round(ratio * 100)}
          aria-label={`${formatNumber(used)} / ${formatNumber(limit)}`}
          className={cn('h-1.5', progressToneClass(ratio))}
        />
      </CardContent>
    </Card>
  )
}

export default function DashboardQuotaGrid({
  text,
  rateLabel,
  rate,
  hourlyUsed,
  hourlyLimit,
  dailyUsed,
  dailyLimit,
  monthlyUsed,
  monthlyLimit,
  formatNumber,
  language,
}: DashboardQuotaGridProps): JSX.Element {
  const helpLabels: Record<'hourly' | 'daily' | 'monthly', ReactNode> = {
    hourly: (
      <UsageMetricLabel label={text.hourly} kind="businessCalls1h" language={language} className="quota-stat-label" />
    ),
    daily: (
      <UsageMetricLabel label={text.daily} kind="dailyCredits" language={language} className="quota-stat-label" />
    ),
    monthly: (
      <UsageMetricLabel label={text.monthly} kind="monthlyCredits" language={language} className="quota-stat-label" />
    ),
  }

  return (
    <div className="access-stats grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <QuotaStatCard
        label={rateLabel}
        used={rate.used}
        limit={rate.limit}
        formatNumber={formatNumber}
      />
      <QuotaStatCard
        label={helpLabels.hourly}
        used={hourlyUsed}
        limit={hourlyLimit}
        formatNumber={formatNumber}
      />
      <QuotaStatCard
        label={helpLabels.daily}
        used={dailyUsed}
        limit={dailyLimit}
        formatNumber={formatNumber}
      />
      <QuotaStatCard
        label={helpLabels.monthly}
        used={monthlyUsed}
        limit={monthlyLimit}
        formatNumber={formatNumber}
      />
    </div>
  )
}
