import { describe, expect, it } from 'bun:test'

import {
  buildDashboardHourlyRequestWindowFixture,
  buildAggregatedHourlySlots,
  buildHourlyBucketLookup,
  buildHourlyRangeSlots,
  createDashboardHourlyChartPreferences,
  createEmptyDashboardHourlyRequestWindow,
  DASHBOARD_REALTIME_BUCKET_SECONDS,
  DASHBOARD_REALTIME_RETAINED_BUCKETS,
  DASHBOARD_REALTIME_VISIBLE_BUCKETS,
  DASHBOARD_RESULT_SERIES_ORDER,
  DASHBOARD_TYPE_SERIES_ORDER,
  DASHBOARD_CREDIT_SERIES_ORDER,
  getCurrentDayHourlyBuckets,
  formatHourlyBucketLabel,
  formatDashboardRealtimeWindowLabel,
  getHourlyBucketsInRange,
  buildRollingHourlyWindow,
  getVisibleHourlyBuckets,
  getVisibleHourlyWindow,
  readDashboardHourlyChartPreferences,
  toggleSeriesSelection,
  writeDashboardHourlyChartPreferences,
} from './dashboardHourlyCharts'

describe('dashboardHourlyCharts helpers', () => {
  it('returns the latest visible bucket slice and keeps retained metadata intact', () => {
    const window = buildDashboardHourlyRequestWindowFixture()

    expect(window.retainedBuckets).toBe(DASHBOARD_REALTIME_RETAINED_BUCKETS)
    expect(window.visibleBuckets).toBe(DASHBOARD_REALTIME_VISIBLE_BUCKETS)
    expect(getVisibleHourlyBuckets(window)).toHaveLength(DASHBOARD_REALTIME_VISIBLE_BUCKETS)
    expect(getVisibleHourlyBuckets(window)[0]?.bucketStart).toBe(window.buckets[516]?.bucketStart)
    expect(getVisibleHourlyBuckets(window).at(-1)?.bucketStart).toBe(window.buckets.at(-1)?.bucketStart)
    expect(window.buckets[0]?.bucketStart).toBe(
      window.buckets.at(-1)!.bucketStart - (DASHBOARD_REALTIME_RETAINED_BUCKETS - 1) * DASHBOARD_REALTIME_BUCKET_SECONDS,
    )
  })

  it('anchors the latest bucket to the current five-minute bucket instead of the previous closed bucket', () => {
    const currentHourStart = Date.UTC(2026, 3, 7, 12, 0, 0) / 1000
    const window = buildDashboardHourlyRequestWindowFixture({ currentHourStart })

    expect(window.buckets.at(-1)?.bucketStart).toBe(currentHourStart)
    expect(getVisibleHourlyBuckets(window).at(-1)?.bucketStart).toBe(currentHourStart)
  })

  it('builds a rolling 24-hour hourly window plus the current partial hour', () => {
    const currentHourStart = Date.UTC(2026, 3, 7, 12, 0, 0) / 1000
    const window = buildDashboardHourlyRequestWindowFixture({
      currentHourStart,
      bucketSeconds: 3600,
      visibleBuckets: 25,
      retainedBuckets: 49,
    })

    const rolling = buildRollingHourlyWindow(window)

    expect(rolling.slots).toHaveLength(25)
    expect(rolling.slots[0]?.bucketStart).toBe(currentHourStart - 24 * 3600)
    expect(rolling.slots.at(-1)?.bucketStart).toBe(currentHourStart)
  })

  it('formats hourly bucket labels in the requested local timezone', () => {
    const bucketStart = Date.UTC(2026, 3, 10, 22, 0, 0) / 1000

    expect(formatHourlyBucketLabel(bucketStart, 'UTC')).toEqual(['04/10', '22:00'])
    expect(formatHourlyBucketLabel(bucketStart, 'Asia/Shanghai')).toEqual(['04/11', '06:00'])
  })

  it('filters current-day buckets using the requested timezone', () => {
    const currentHourStart = Date.UTC(2026, 3, 7, 4, 0, 0) / 1000
    const window = buildDashboardHourlyRequestWindowFixture({
      currentHourStart,
      bucketSeconds: 3600,
      visibleBuckets: 25,
      retainedBuckets: 49,
    })

    const utcBuckets = getCurrentDayHourlyBuckets(window, 'UTC')
    const shanghaiBuckets = getCurrentDayHourlyBuckets(window, 'Asia/Shanghai')

    expect(utcBuckets).toHaveLength(5)
    expect(utcBuckets[0]?.bucketStart).toBe(Date.UTC(2026, 3, 7, 0, 0, 0) / 1000)
    expect(utcBuckets.at(-1)?.bucketStart).toBe(currentHourStart)
    expect(shanghaiBuckets).toHaveLength(13)
    expect(shanghaiBuckets[0]?.bucketStart).toBe(Date.UTC(2026, 3, 6, 16, 0, 0) / 1000)
    expect(shanghaiBuckets.at(-1)?.bucketStart).toBe(currentHourStart)
  })

  it('filters buckets using explicit server epoch boundaries', () => {
    const currentHourStart = Date.UTC(2026, 3, 7, 4, 0, 0) / 1000
    const window = buildDashboardHourlyRequestWindowFixture({
      currentHourStart,
      bucketSeconds: 3600,
      visibleBuckets: 25,
      retainedBuckets: 49,
    })
    const rangeStart = Date.UTC(2026, 3, 6, 16, 0, 0) / 1000

    const buckets = getHourlyBucketsInRange(window, rangeStart, currentHourStart + 1)

    expect(buckets).toHaveLength(13)
    expect(buckets[0]?.bucketStart).toBe(rangeStart)
    expect(buckets.at(-1)?.bucketStart).toBe(currentHourStart)
    expect(getHourlyBucketsInRange(window, rangeStart, rangeStart)).toEqual([])
  })

  it('builds fixed hourly slots and leaves missing buckets empty', () => {
    const currentHourStart = Date.UTC(2026, 3, 7, 4, 0, 0) / 1000
    const window = buildDashboardHourlyRequestWindowFixture({
      currentHourStart,
      bucketSeconds: 3600,
      visibleBuckets: 4,
      retainedBuckets: 4,
    })
    const rangeStart = currentHourStart - 3 * 3600
    const rangeEnd = currentHourStart + 2 * 3600

    const slots = buildHourlyRangeSlots(window, rangeStart, rangeEnd)

    expect(slots.map((slot) => slot.bucketStart)).toEqual([
      currentHourStart - 3 * 3600,
      currentHourStart - 2 * 3600,
      currentHourStart - 1 * 3600,
      currentHourStart,
      currentHourStart + 3600,
    ])
    expect(slots.slice(0, 4).every((slot) => slot.bucket != null)).toBe(true)
    expect(slots[4]?.bucket).toBeNull()
  })

  it('builds fixed slots using the server bucket alignment offset', () => {
    const kathmanduOffsetSeconds = 45 * 60
    const currentHourStart = Date.UTC(2026, 3, 7, 12, 0, 0) / 1000 + kathmanduOffsetSeconds
    const window = buildDashboardHourlyRequestWindowFixture({
      currentHourStart,
      bucketSeconds: 3600,
      visibleBuckets: 4,
      retainedBuckets: 4,
    })
    const slots = buildHourlyRangeSlots(window, currentHourStart - 2 * 3600 - 60, currentHourStart + 3600)

    expect(slots.map((slot) => slot.bucketStart)).toEqual([
      currentHourStart - 2 * 3600,
      currentHourStart - 3600,
      currentHourStart,
    ])
    expect(slots.every((slot) => slot.bucket?.bucketStart === slot.bucketStart)).toBe(true)
  })

  it('toggles absolute-series visibility without mutating the source array', () => {
    const source = ['primarySuccess', 'secondaryFailure'] as const

    const removed = toggleSeriesSelection(source, 'primarySuccess')
    const added = toggleSeriesSelection(source, 'primaryFailure429')

    expect(removed).toEqual(['secondaryFailure'])
    expect(added).toEqual(['primarySuccess', 'secondaryFailure', 'primaryFailure429'])
    expect(source).toEqual(['primarySuccess', 'secondaryFailure'])
  })

  it('creates an empty fallback window for dashboard boot', () => {
    expect(createEmptyDashboardHourlyRequestWindow()).toEqual({
      bucketSeconds: DASHBOARD_REALTIME_BUCKET_SECONDS,
      visibleBuckets: DASHBOARD_REALTIME_VISIBLE_BUCKETS,
      retainedBuckets: DASHBOARD_REALTIME_RETAINED_BUCKETS,
      buckets: [],
      unverifiedBucketStarts: [],
    })
  })

  it('formats the realtime window label from bucket metadata', () => {
    expect(
      formatDashboardRealtimeWindowLabel(
        'Local time axis · Last {range} · {bucket} buckets ({count} current buckets)',
        300,
        73,
        73,
      ),
    ).toBe('Local time axis · Last 6h · 5m buckets (73 current buckets)')
  })

  it('defaults both absolute charts to all visible series', () => {
    const preferences = createDashboardHourlyChartPreferences()

    expect(preferences.visibleResultSeries).toEqual([...DASHBOARD_RESULT_SERIES_ORDER])
    expect(preferences.visibleTypeSeries).toEqual([...DASHBOARD_TYPE_SERIES_ORDER])
    expect(preferences.visibleCreditSeries).toEqual([...DASHBOARD_CREDIT_SERIES_ORDER])
  })

  it('supports the expanded chart mode set including area charts', () => {
    expect(createDashboardHourlyChartPreferences({ chartMode: 'resultsArea' }).chartMode).toBe('resultsArea')
    expect(createDashboardHourlyChartPreferences({ chartMode: 'typesArea' }).chartMode).toBe('typesArea')
    expect(createDashboardHourlyChartPreferences({ chartMode: 'credits' }).chartMode).toBe('credits')
    expect(createDashboardHourlyChartPreferences({ chartMode: 'creditsArea' }).chartMode).toBe('creditsArea')
  })

  it('migrates removed delta chart preferences to credit modes', () => {
    expect(createDashboardHourlyChartPreferences({ chartMode: 'resultsDelta' }).chartMode).toBe('credits')
    expect(createDashboardHourlyChartPreferences({ chartMode: 'typesDelta' }).chartMode).toBe('creditsArea')
  })

  it('round-trips persisted chart preferences and preserves explicit empty absolute selections', () => {
    const storage = new Map<string, string>()
    const storageApi = {
      getItem(key: string) {
        return storage.get(key) ?? null
      },
      setItem(key: string, value: string) {
        storage.set(key, value)
      },
    }
    const key = 'admin.dashboard.hourly-request-charts.v1'

    writeDashboardHourlyChartPreferences(storageApi, key, {
      chartMode: 'results',
      visibleResultSeries: [],
      visibleTypeSeries: ['apiBillable'],
      visibleCreditSeries: ['upstreamActual'],
    })

    expect(readDashboardHourlyChartPreferences(storageApi, key)).toEqual({
      chartMode: 'results',
      visibleResultSeries: [],
      visibleTypeSeries: ['apiBillable'],
      visibleCreditSeries: ['upstreamActual'],
    })
  })

  it('falls back to a legacy persistence key when the new key is empty', () => {
    const storage = new Map<string, string>()
    const storageApi = {
      getItem(key: string) {
        return storage.get(key) ?? null
      },
      setItem(key: string, value: string) {
        storage.set(key, value)
      },
    }

    storage.set('admin.dashboard.hourly-request-charts.v1', JSON.stringify({
      chartMode: 'resultsArea',
      visibleResultSeries: ['primarySuccess'],
      visibleTypeSeries: ['apiBillable'],
      visibleCreditSeries: ['localEstimate'],
    }))

    expect(
      readDashboardHourlyChartPreferences(
        storageApi,
        'admin.dashboard.hourly-request-charts.v2',
        ['admin.dashboard.hourly-request-charts.v1'],
      ),
    ).toEqual({
      chartMode: 'resultsArea',
      visibleResultSeries: ['primarySuccess'],
      visibleTypeSeries: ['apiBillable'],
      visibleCreditSeries: ['localEstimate'],
    })
  })

  it('aggregates upstream credits only when at least one source bucket is sampled', () => {
    const currentHourStart = Date.UTC(2026, 3, 7, 12, 0, 0) / 1000
    const window = buildDashboardHourlyRequestWindowFixture({
      currentHourStart,
      retainedBuckets: 13,
      visibleBuckets: 13,
      mapBucket: ({ index }) => ({
        localEstimatedCredits: 2,
        upstreamActualCredits: index === 3 ? 5 : index === 8 ? 0 : null,
      }),
    })

    const aggregated = buildAggregatedHourlySlots(
      window,
      currentHourStart - 60 * 60,
      currentHourStart + 5 * 60,
    )

    expect(aggregated.slots[0]?.bucket?.localEstimatedCredits).toBe(24)
    expect(aggregated.slots[0]?.bucket?.upstreamActualCredits).toBe(5)
    expect(aggregated.slots[1]?.bucket?.localEstimatedCredits).toBe(2)
    expect(aggregated.slots[1]?.bucket?.upstreamActualCredits).toBeNull()
  })

  it('renders an unverified source interval as a gap while retaining verified zero buckets', () => {
    const currentHourStart = Date.UTC(2026, 3, 7, 12, 0, 0) / 1000
    const gapStart = currentHourStart - 10 * 60
    const window = buildDashboardHourlyRequestWindowFixture({
      currentHourStart,
      retainedBuckets: 13,
      visibleBuckets: 13,
      unverifiedBucketStarts: [gapStart],
      mapBucket: ({ bucketStart }) => ({
        primarySuccess: bucketStart === currentHourStart - 5 * 60 ? 0 : 4,
      }),
    })

    const slots = buildHourlyRangeSlots(window, currentHourStart - 60 * 60, currentHourStart + 5 * 60)
    expect(slots.find((slot) => slot.bucketStart === gapStart)?.bucket).toBeNull()
    expect(slots.find((slot) => slot.bucketStart === currentHourStart - 5 * 60)?.bucket?.primarySuccess).toBe(0)

    const aggregated = buildAggregatedHourlySlots(
      window,
      currentHourStart - 60 * 60,
      currentHourStart + 5 * 60,
    )
    expect(aggregated.slots[0]?.bucket).toBeNull()
  })

  it('builds the rolling visible window directly from visibleBuckets metadata', () => {
    const currentHourStart = Date.UTC(2026, 3, 7, 12, 0, 0) / 1000
    const window = buildDashboardHourlyRequestWindowFixture({ currentHourStart })

    const visible = getVisibleHourlyWindow(window)

    expect(visible.rangeStart).toBe(currentHourStart - 6 * 3600)
    expect(visible.rangeEnd).toBe(currentHourStart + DASHBOARD_REALTIME_BUCKET_SECONDS)
    expect(visible.slots).toHaveLength(DASHBOARD_REALTIME_VISIBLE_BUCKETS)
    expect(visible.slots[0]?.bucketStart).toBe(currentHourStart - 6 * 3600)
    expect(visible.slots.at(-1)?.bucketStart).toBe(currentHourStart)
  })

  it('keeps the rolling window fixed to the latest visible slot count even when buckets are sparse', () => {
    const currentHourStart = Date.UTC(2026, 3, 7, 12, 0, 0) / 1000
    const window = buildDashboardHourlyRequestWindowFixture({ currentHourStart })
    const missingBucketStart = currentHourStart - 3 * 3600
    window.buckets = window.buckets.filter((bucket) => bucket.bucketStart !== missingBucketStart)

    const visible = getVisibleHourlyWindow(window)

    expect(visible.rangeStart).toBe(currentHourStart - 6 * 3600)
    expect(visible.rangeEnd).toBe(currentHourStart + DASHBOARD_REALTIME_BUCKET_SECONDS)
    expect(visible.slots).toHaveLength(DASHBOARD_REALTIME_VISIBLE_BUCKETS)
    expect(visible.slots[36]?.bucketStart).toBe(missingBucketStart)
    expect(visible.slots[36]?.bucket).toBeNull()
  })

  it('aggregates five-minute buckets into hourly slots for bar charts', () => {
    const currentHourStart = Date.UTC(2026, 3, 7, 12, 0, 0) / 1000
    const window = buildDashboardHourlyRequestWindowFixture({
      currentHourStart,
      bucketSeconds: 300,
      visibleBuckets: 73,
      retainedBuckets: 73,
      mapBucket: () => ({
        primarySuccess: 1,
        apiBillable: 2,
      }),
    })

    const aggregated = buildAggregatedHourlySlots(window, currentHourStart - 2 * 3600, currentHourStart + 300)

    expect(aggregated.bucketSeconds).toBe(3600)
    expect(aggregated.slots.map((slot) => slot.bucketStart)).toEqual([
      currentHourStart - 2 * 3600,
      currentHourStart - 3600,
      currentHourStart,
    ])
    expect(aggregated.slots[0]?.bucket?.primarySuccess).toBe(12)
    expect(aggregated.slots[0]?.bucket?.apiBillable).toBe(24)
    expect(aggregated.slots[2]?.bucket?.primarySuccess).toBe(1)
  })

  it('aggregates fixed slots from the requested range start alignment', () => {
    const kathmanduOffsetSeconds = 5.75 * 3600
    const currentBucketStart = Date.UTC(2026, 3, 7, 12, 0, 0) / 1000 + kathmanduOffsetSeconds
    const rangeStart = currentBucketStart - 2 * 3600
    const window = buildDashboardHourlyRequestWindowFixture({
      currentHourStart: currentBucketStart,
      bucketSeconds: 300,
      visibleBuckets: 25,
      retainedBuckets: 25,
      mapBucket: () => ({
        primarySuccess: 1,
      }),
    })

    const aggregated = buildAggregatedHourlySlots(window, rangeStart, currentBucketStart + 300)

    expect(aggregated.slots.map((slot) => slot.bucketStart)).toEqual([
      rangeStart,
      rangeStart + 3600,
      rangeStart + 2 * 3600,
    ])
    expect(aggregated.slots[0]?.bucket?.primarySuccess).toBe(12)
    expect(aggregated.slots[1]?.bucket?.primarySuccess).toBe(12)
    expect(aggregated.slots[2]?.bucket?.primarySuccess).toBe(1)
  })
})
