import { describe, expect, it } from 'bun:test'
import { buildDemoUserUsageSeries } from './demoUserUsageSeries'
const user = { hourlyAnyLimit: 200, quotaHourlyLimit: 120, quotaDailyLimit: 1000, quotaMonthlyLimit: 10000, businessCalls1h: { successCount: 42, failureCount: 2, totalCount: 44 } }
const now = Date.UTC(2026, 9, 3) / 1000

describe('demo user usage series', () => {
  it('keeps the last hour bars consistent with the summary and separates rolling pressure', () => {
    const result = buildDemoUserUsageSeries('businessCalls1h', user, now)
    if (result.kind !== 'businessCalls1h') throw new Error('Expected business calls')
    expect(result.points).toHaveLength(288)
    expect(result.points.slice(-12).reduce((sum, point) => sum + (point.bars.success ?? 0), 0)).toBe(42)
    expect(result.points.slice(-12).reduce((sum, point) => sum + (point.bars.failure ?? 0), 0)).toBe(2)
    expect(result.points.at(-1)?.pressure).toBe(44)
    expect(result.points.at(-1)?.limitValue).toBe(120)
  })
  it('uses the matching quota and calendar buckets for each window', () => {
    expect(buildDemoUserUsageSeries('rate5m', user, now).limit).toBe(200)
    const daily = buildDemoUserUsageSeries('dailyCredits', user, now)
    expect(daily.limit).toBe(1000)
    expect(daily.points[1].bucketStart - daily.points[0].bucketStart).toBe(86400)
    const monthly = buildDemoUserUsageSeries('monthlyCredits', user, now)
    expect(monthly.limit).toBe(10000)
    expect(monthly.points.at(-1)?.bucketStart).toBe(Date.UTC(2026, 9, 1) / 1000)
  })
})
