import type { AdminUserUsageSeries, AdminUserUsageSeriesKey } from './runtime'

type DemoUserUsage = {
  hourlyAnyLimit: number
  quotaHourlyLimit: number
  quotaDailyLimit: number
  quotaMonthlyLimit: number
  businessCalls1h: { successCount: number; failureCount: number; totalCount: number }
}

export function buildDemoUserUsageSeries(series: AdminUserUsageSeriesKey, user: DemoUserUsage, now: number): AdminUserUsageSeries {
  if (series === 'businessCalls1h') {
    const bucketEnd = Math.floor(now / 300) * 300
    const share = (count: number, index: number) => Math.floor(count / 12) + (index % 12 < count % 12 ? 1 : 0)
    return {
      kind: 'businessCalls1h',
      limit: user.quotaHourlyLimit,
      points: Array.from({ length: 288 }, (_, index) => ({
        bucketStart: bucketEnd - (287 - index) * 300,
        bars: { success: share(user.businessCalls1h.successCount, index), failure: share(user.businessCalls1h.failureCount, index) },
        pressure: user.businessCalls1h.totalCount,
        limitValue: user.quotaHourlyLimit,
      })),
    }
  }
  const limit = series === 'rate5m' ? user.hourlyAnyLimit : series === 'dailyCredits' ? user.quotaDailyLimit : user.quotaMonthlyLimit
  const count = series === 'monthlyCredits' ? 12 : series === 'dailyCredits' ? 30 : 288
  const currentMonth = new Date(now * 1000)
  const step = series === 'dailyCredits' ? 86400 : 300
  const end = Math.floor(now / step) * step
  return {
    kind: 'quotaLike', limit,
    points: Array.from({ length: count }, (_, index) => ({
      bucketStart: series === 'monthlyCredits'
        ? Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - (count - 1 - index), 1) / 1000
        : end - (count - 1 - index) * step,
      value: Math.round(limit * (0.15 + (index % 12) / 30)),
      limitValue: limit,
    })),
  }
}
