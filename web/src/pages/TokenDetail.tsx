import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Fragment, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../lib/icons'
import {
  fetchProfile,
  fetchTokenLogDetails,
  fetchTokenLogsCatalog,
  fetchTokenLogsList,
  fetchTokenUsageSeries,
  rotateTokenSecret,
  type Profile,
  type RequestLog,
  type RequestLogsCatalog,
  type RequestLogFacets,
  type RequestLogsListPage,
  type TokenOwnerSummary,
  type TokenUsageBucket,
} from '../api'
import { type QueryLoadState, getBlockingLoadState, getRefreshingLoadState, isBlockingLoadState, isRefreshingLoadState } from '../admin/queryLoadState'
import {
  buildRequestLogsCatalogPlan,
  formatRequestLogsDescription,
  formatRequestLogsPaginationSummary,
} from '../admin/requestLogsUi'
import AdminLoadingRegion from '../components/AdminLoadingRegion'
import AdminRecentRequestsPanel, { type RecentRequestsOutcomeFilter } from '../components/AdminRecentRequestsPanel'
import AdminReturnToConsoleLink from '../components/AdminReturnToConsoleLink'
import ThemeToggle from '../components/ThemeToggle'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { StatusBadge } from '../components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage, useTranslate } from '../i18n'
import { ADMIN_USER_CONSOLE_HREF } from '../lib/adminUserConsoleEntry'
import { copyText, selectAllReadonlyText } from '../lib/clipboard'
import { useResponsiveModes } from '../lib/responsive'
import { AdminShellSidebarUtility } from '../admin/AdminShell'
import {
  buildRequestKindQuickFilterSelection,
  defaultTokenLogRequestKindQuickFilters,
  hasActiveRequestKindQuickFilters,
  resolveEffectiveRequestKindSelection,
  resolveManualRequestKindQuickFilters,
  requestKindSelectionsMatch,
  tokenLogRequestKindEmptySelectionKey,
  toggleRequestKindSelection,
  type TokenLogRequestKindQuickBilling,
  type TokenLogRequestKindQuickProtocol,
  type TokenLogRequestKindOption,
  uniqueSelectedRequestKinds,
} from '../tokenLogRequestKinds'
import type React from 'react'


const emptyRequestLogFacets: RequestLogFacets = {
  results: [],
  keyEffects: [],
  bindingEffects: [],
  selectionEffects: [],
  tokens: [],
  keys: [],
}

const emptyRequestLogsListPage: RequestLogsListPage = {
  items: [],
  pageSize: 20,
  nextCursor: null,
  prevCursor: null,
  hasOlder: false,
  hasNewer: false,
}

function createEmptyTokenLogsListPage(pageSize: number): RequestLogsListPage {
  return {
    ...emptyRequestLogsListPage,
    pageSize,
  }
}

function buildTokenLogsListQueryKey(
  baseKey: string,
  cursor: string | null,
  direction: 'older' | 'newer',
  perPage: number,
): string {
  return `${baseKey}:cursor=${cursor ?? ''}:direction=${direction}:perPage=${perPage}`
}

type Period = 'day' | 'week' | 'month'

interface TokenDetailInfo {
  id: string
  enabled: boolean
  note: string | null
  owner?: TokenOwnerSummary | null
  total_requests: number
  created_at: number
  last_used_at: number | null
  quota_state: 'normal' | 'hour' | 'day' | 'month'
  quota_hourly_used: number
  quota_hourly_limit: number
  quota_daily_used: number
  quota_daily_limit: number
  quota_monthly_used: number
  quota_monthly_limit: number
  quota_hourly_reset_at: number | null
  quota_daily_reset_at: number | null
  quota_monthly_reset_at: number | null
}

interface TokenSummary {
  total_requests: number
  success_count: number
  error_count: number
  quota_exhausted_count: number
  last_activity: number | null
}

type TokenLog = RequestLog

interface UsageBar {
  bucket: number
  success: number
  system: number
  external: number
}

function localeTag(language: string): string {
  return language === 'zh' ? 'zh-CN' : 'en-US'
}

function formatNumber(n: number, locale = 'en-US') {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n)
}

function formatDateTimeValue(ts: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(ts * 1000))
}

function formatTime(ts: number | null, locale = 'en-US') {
  return ts ? formatDateTimeValue(ts, locale) : '—'
}

function formatLogTime(ts: number | null, period: Period, locale = 'en-US') {
  if (!ts) return '—'
  const date = new Date(ts * 1000)
  const hh = date.getHours().toString().padStart(2, '0')
  const mm = date.getMinutes().toString().padStart(2, '0')
  const ss = date.getSeconds().toString().padStart(2, '0')
  const time = `${hh}:${mm}:${ss}`
  switch (period) {
    case 'day':
      return time
    case 'week':
      return `${new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)} ${time}`
    case 'month':
      return `${date.toLocaleDateString(locale, { month: 'short', day: '2-digit' })} ${time}`
    default:
      return formatDateTimeValue(ts, locale)
  }
}

function tokenOwnerPrimary(owner: TokenOwnerSummary | null): string {
  if (!owner) return ''
  return owner.displayName || owner.userId
}

function tokenOwnerSecondary(owner: TokenOwnerSummary | null): string | null {
  if (!owner?.username) return null
  return `@${owner.username}`
}

function TokenOwnerValue({
  owner,
  emptyLabel,
  onOpenUser,
}: {
  owner: TokenOwnerSummary | null
  emptyLabel: string
  onOpenUser?: (userId: string) => void
}): React.JSX.Element {
  if (!owner) {
    return <span className="text-xs text-muted-foreground">{emptyLabel}</span>
  }

  const secondary = tokenOwnerSecondary(owner)
  return (
    <div className="flex items-center gap-2">
      {onOpenUser ? (
        <Button type="button" variant="link" size="sm" className="h-auto p-0 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm hover:bg-muted" onClick={() => onOpenUser(owner.userId)}>
          <span className="text-primary underline-offset-4 hover:underline">{tokenOwnerPrimary(owner)}</span>
          {secondary ? <span className="text-xs text-muted-foreground">{secondary}</span> : null}
        </Button>
      ) : (
        <>
          <span className="text-primary underline-offset-4 hover:underline">{tokenOwnerPrimary(owner)}</span>
          {secondary ? <span className="text-xs text-muted-foreground">{secondary}</span> : null}
        </>
      )}
    </div>
  )
}

function formatDate(value: Date): string {
  const y = value.getFullYear()
  const m = (value.getMonth() + 1).toString().padStart(2, '0')
  const d = value.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface QuotaStatCardProps {
  label: string
  used: number
  limit: number
  resetAt?: number | null
  description: string
  locale: string
  notUsedYetLabel: string
  formatNextReset: (time: string) => string
}

function QuotaStatCard({ label, used, limit, resetAt, description, locale, notUsedYetLabel, formatNextReset }: QuotaStatCardProps): React.JSX.Element {
  const shouldShowReset = used > 0 && typeof resetAt === 'number' && resetAt * 1000 > Date.now()
  let resetLabel = notUsedYetLabel
  if (shouldShowReset) {
    try {
      resetLabel = formatDateTimeValue(resetAt!, locale)
    } catch {
      resetLabel = '—'
    }
  }
  return (
    <div>
      <div>{label}</div>
      <div>
        {formatNumber(used, locale)}
        <span>/ {formatNumber(limit, locale)}</span>
      </div>
      <div>{description}</div>
      <div>
        {shouldShowReset ? formatNextReset(resetLabel) : resetLabel}
      </div>
    </div>
  )
}

function startOfDay(ts = Date.now()): Date {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d
}
function startOfWeek(ts = Date.now()): Date {
  const d = new Date(ts)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}
function startOfMonth(ts = Date.now()): Date {
  const d = new Date(ts)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function computeStartDate(period: Period, input: string): Date {
  const now = new Date()
  const maxDate = startOfDay(now.getTime()).valueOf()
  if (!input) {
    return period === 'day' ? new Date(maxDate) : period === 'week' ? startOfWeek(maxDate) : startOfMonth(maxDate)
  }
  if (period === 'day') {
    const [y, m, d] = input.split('-').map(Number)
    if (!y || !m || !d) return startOfDay()
    const result = new Date(y, m - 1, d, 0, 0, 0, 0)
    return result.getTime() > maxDate ? new Date(maxDate) : result
  }
  if (period === 'week') {
    const [y, w] = input.split('-W')
    const year = Number(y)
    const week = Number(w)
    if (!year || !week) return startOfWeek()
    const jan4 = new Date(year, 0, 4)
    const day = (jan4.getDay() + 6) % 7
    const start = new Date(jan4)
    start.setDate(jan4.getDate() - day + (week - 1) * 7)
    start.setHours(0, 0, 0, 0)
    return start.getTime() > maxDate ? new Date(maxDate) : start
  }
  const [yy, mm] = input.split('-').map(Number)
  if (!yy || !mm) return startOfMonth()
  const start = new Date(yy, mm - 1, 1, 0, 0, 0, 0)
  return start.getTime() > maxDate ? startOfMonth(maxDate) : start
}

function computeEndDate(period: Period, start: Date): Date {
  const end = new Date(start)
  if (period === 'day') {
    end.setDate(end.getDate() + 1)
  } else if (period === 'week') {
    end.setDate(end.getDate() + 7)
  } else {
    end.setMonth(end.getMonth() + 1)
  }
  return end
}

function toIso(date: Date): string {
  const pad = (value: number, length = 2) => value.toString().padStart(length, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const offsetHour = pad(Math.floor(Math.abs(offsetMinutes) / 60))
  const offsetMinute = pad(Math.abs(offsetMinutes) % 60)
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHour}:${offsetMinute}`
}

function formatWeekInput(date: Date): string {
  const tmp = new Date(date)
  tmp.setHours(0, 0, 0, 0)
  // Move to Thursday to ensure correct year
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7))
  const week1 = new Date(tmp.getFullYear(), 0, 4)
  const weekNumber = 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${tmp.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`
}

function formatPeriodInput(period: Period, date: Date): string {
  if (period === 'day') return formatDate(date)
  if (period === 'week') return formatWeekInput(date)
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
}

function defaultInputValue(period: Period): string {
  const now = Date.now()
  const base = period === 'day' ? startOfDay(now) : period === 'week' ? startOfWeek(now) : startOfMonth(now)
  return formatPeriodInput(period, base)
}

function sanitizeInput(period: Period, raw: string): string {
  const start = computeStartDate(period, raw)
  return formatPeriodInput(period, start)
}

function alignToBucket(timestampSec: number, bucketSeconds: number): number {
  return timestampSec - (timestampSec % bucketSeconds)
}

function buildUsageBars(
  buckets: TokenUsageBucket[],
  startSec: number,
  bucketSeconds: number,
  bucketCount: number,
): UsageBar[] {
  const map = new Map<number, TokenUsageBucket>()
  for (const bucket of buckets) {
    map.set(bucket.bucket_start, bucket)
  }
  const bars: UsageBar[] = []
  for (let i = 0; i < bucketCount; i += 1) {
    const bucketStart = startSec + i * bucketSeconds
    const found = map.get(bucketStart)
    bars.push({
      bucket: bucketStart,
      success: found?.success_count ?? 0,
      system: found?.system_failure_count ?? 0,
      external: found?.external_failure_count ?? 0,
    })
  }
  return bars
}

function hourLabel(bucket: number): string {
  const date = new Date(bucket * 1000)
  return `${date.getHours().toString().padStart(2, '0')}:00`
}

function dayLabel(bucket: number, locale = 'en-US'): string {
  const date = new Date(bucket * 1000)
  return date.toLocaleDateString(locale, { month: 'short', day: '2-digit' })
}

export default function TokenDetail({
  id,
  onBack,
  onOpenKey,
  onOpenUser,
  onSecretRotated,
}: {
  id: string
  onBack?: () => void
  onOpenKey?: (keyId: string) => void
  onOpenUser?: (userId: string) => void
  onSecretRotated?: (id: string, token: string) => void
}): React.JSX.Element {
  const translations = useTranslate()
  const { language } = useLanguage()
  const tokenStrings = translations.admin.tokens
  const loadingStateStrings = translations.admin.loadingStates
  const headerStrings = translations.admin.header
  const strings = translations.admin.tokenDetail
  const locale = localeTag(language)
  const refreshingLabel = (
    <span className="inline-flex items-center gap-1.5">
      <Spinner className="size-3" aria-hidden="true" />
      {loadingStateStrings.refreshing}
    </span>
  )
  const pageRef = useRef<HTMLDivElement>(null)
  const { viewportMode, contentMode, isCompactLayout } = useResponsiveModes(pageRef)
  const [info, setInfo] = useState<TokenDetailInfo | null>(null)
  const [summary, setSummary] = useState<TokenSummary | null>(null)
  const [quickStats, setQuickStats] = useState<{
    day: TokenSummary | null
    month: TokenSummary | null
    total: TokenSummary | null
  }>({ day: null, month: null, total: null })
  const [period, setPeriod] = useState<Period>('month')
  const [sinceInput, setSinceInput] = useState<string>('')
  const [debouncedSinceInput, setDebouncedSinceInput] = useState<string>('')
  const [logs, setLogs] = useState<TokenLog[]>([])
  const [perPage, setPerPage] = useState(20)
  const [logsCursor, setLogsCursor] = useState<string | null>(null)
  const [logsDirection, setLogsDirection] = useState<'older' | 'newer'>('older')
  const [logsPageInfo, setLogsPageInfo] = useState<RequestLogsListPage>(emptyRequestLogsListPage)
  const [requestKindOptions, setRequestKindOptions] = useState<TokenLogRequestKindOption[]>([])
  const [selectedRequestKinds, setSelectedRequestKinds] = useState<string[]>([])
  const [requestKindQuickBilling, setRequestKindQuickBilling] = useState<TokenLogRequestKindQuickBilling>('all')
  const [requestKindQuickProtocol, setRequestKindQuickProtocol] = useState<TokenLogRequestKindQuickProtocol>('all')
  const [logFacets, setLogFacets] = useState<RequestLogFacets>(emptyRequestLogFacets)
  const [logsCatalog, setLogsCatalog] = useState<RequestLogsCatalog | null>(null)
  const [outcomeFilter, setOutcomeFilter] = useState<RecentRequestsOutcomeFilter | null>(null)
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)
  const [summaryLoadState, setSummaryLoadState] = useState<QueryLoadState>('initial_loading')
  const [logsLoadState, setLogsLoadState] = useState<QueryLoadState>('initial_loading')
  const [quickUsage, setQuickUsage] = useState<UsageBar[]>([])
  const [quickUsageLoading, setQuickUsageLoading] = useState(true)
  const [snapshotUsage, setSnapshotUsage] = useState<UsageBar[]>([])
  const [snapshotUsageLoading, setSnapshotUsageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const sseRef = useRef<EventSource | null>(null)
  const warningTimerRef = useRef<number | null>(null)
  const sinceDebounceRef = useRef<number | null>(null)
  const [isRotateDialogOpen, setIsRotateDialogOpen] = useState(false)
  const [isRotatedDialogOpen, setIsRotatedDialogOpen] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [rotatedToken, setRotatedToken] = useState<string | null>(null)
  const [rotatedCopyState, setRotatedCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [sseConnected, setSseConnected] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const perPageRef = useRef(20)
  const quickUsageAbortRef = useRef<AbortController | null>(null)
  const snapshotUsageAbortRef = useRef<AbortController | null>(null)
  const detailAbortRef = useRef<AbortController | null>(null)
  const logsAbortRef = useRef<AbortController | null>(null)
  const requestKindOptionsAbortRef = useRef<AbortController | null>(null)
  const summaryQueryKeyRef = useRef<string | null>(null)
  const logsQueryKeyRef = useRef<string | null>(null)
  const rotatedTokenFieldRef = useRef<HTMLTextAreaElement | null>(null)
  const logsQueryBaseKeyRef = useRef<string>('')
  const logsRequestContextRef = useRef<{
    tokenId: string
    sinceIso: string
    untilIso: string
    requestKinds: string[]
    forceEmptyMatch: boolean
    result?: string
    keyEffect?: string
    bindingEffect?: string
    selectionEffect?: string
    keyId?: string
  }>({
    tokenId: id,
    sinceIso: '',
    untilIso: '',
    requestKinds: [],
    forceEmptyMatch: false,
    result: undefined,
    keyEffect: undefined,
    bindingEffect: undefined,
    selectionEffect: undefined,
    keyId: undefined,
  })

  useEffect(() => {
    setInfo(null)
    setSummary(null)
    setQuickStats({ day: null, month: null, total: null })
    setLogs([])
    setLogsCursor(null)
    setLogsDirection('older')
    setLogsPageInfo(emptyRequestLogsListPage)
    setRequestKindOptions([])
    setSelectedRequestKinds([])
    setRequestKindQuickBilling('all')
    setRequestKindQuickProtocol('all')
    setLogFacets(emptyRequestLogFacets)
    setLogsCatalog(null)
    setOutcomeFilter(null)
    setSelectedKeyId(null)
    setWarning(null)
    setQuickUsage([])
    setQuickUsageLoading(true)
    setSnapshotUsage([])
    setSnapshotUsageLoading(true)
    setSummaryLoadState('initial_loading')
    setLogsLoadState('initial_loading')
    summaryQueryKeyRef.current = null
    logsQueryKeyRef.current = null
  }, [id])

  useEffect(() => {
    perPageRef.current = perPage
  }, [perPage])

  useEffect(() => {
    if (!isRotatedDialogOpen || !rotatedToken) return
    const frame = window.requestAnimationFrame(() => {
      selectAllReadonlyText(rotatedTokenFieldRef.current)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [isRotatedDialogOpen, rotatedToken])

  const { sinceIso, untilIso } = useMemo(() => {
    const start = computeStartDate(period, debouncedSinceInput)
    const end = computeEndDate(period, start)
    return { sinceIso: toIso(start), untilIso: toIso(end) }
  }, [period, debouncedSinceInput])
  const summaryBlocking = isBlockingLoadState(summaryLoadState)
  const summaryRefreshing = isRefreshingLoadState(summaryLoadState)
  const logsBlocking = isBlockingLoadState(logsLoadState)
  const logsRefreshing = isRefreshingLoadState(logsLoadState)
  const logsDescription = useMemo(
    () => formatRequestLogsDescription(translations.admin.logs, logsCatalog?.retentionDays),
    [logsCatalog?.retentionDays, translations.admin.logs],
  )
  const logsPaginationSummary = useMemo(
    () => formatRequestLogsPaginationSummary(translations.admin.logs, logsCatalog?.retentionDays),
    [logsCatalog?.retentionDays, translations.admin.logs],
  )
  const filterControlsDisabled = summaryBlocking || logsBlocking
  const infoRegionLoadState: QueryLoadState = info
    ? (summaryRefreshing ? 'refreshing' : 'ready')
    : summaryLoadState

  const periodSelectId = `token-period-select-${id}`
  const sinceInputId = `token-since-input-${id}`
  const selectedRequestKindsNormalized = useMemo(
    () => uniqueSelectedRequestKinds(selectedRequestKinds),
    [selectedRequestKinds],
  )
  const requestKindQuickFilters = useMemo(
    () => ({
      billing: requestKindQuickBilling,
      protocol: requestKindQuickProtocol,
    }),
    [requestKindQuickBilling, requestKindQuickProtocol],
  )
  const hasActiveQuickRequestKindFilters = useMemo(
    () => hasActiveRequestKindQuickFilters(requestKindQuickFilters),
    [requestKindQuickFilters],
  )
  const requestKindQuickSelection = useMemo(
    () => buildRequestKindQuickFilterSelection(requestKindOptions, requestKindQuickFilters),
    [requestKindOptions, requestKindQuickFilters],
  )
  const resultFilter =
    outcomeFilter?.kind === 'result'
      ? (outcomeFilter.value as 'success' | 'error' | 'neutral' | 'quota_exhausted')
      : undefined
  const keyEffectFilter = outcomeFilter?.kind === 'keyEffect' ? outcomeFilter.value : undefined
  const bindingEffectFilter =
    outcomeFilter?.kind === 'bindingEffect' ? outcomeFilter.value : undefined
  const selectionEffectFilter =
    outcomeFilter?.kind === 'selectionEffect' ? outcomeFilter.value : undefined
  const effectiveSelectedRequestKinds = useMemo(
    () =>
      resolveEffectiveRequestKindSelection(
        selectedRequestKindsNormalized,
        requestKindQuickFilters,
        requestKindQuickSelection,
      ),
    [requestKindQuickFilters, requestKindQuickSelection, selectedRequestKindsNormalized],
  )
  const hasQuickRequestKindEmptyMatch = useMemo(
    () => hasActiveQuickRequestKindFilters && requestKindQuickSelection.length === 0,
    [hasActiveQuickRequestKindFilters, requestKindQuickSelection.length],
  )
  const summaryQueryBaseKey = useMemo(
    () => `${id}:${period}:${sinceIso}:${untilIso}`,
    [id, period, sinceIso, untilIso],
  )
  const logsQueryBaseKey = useMemo(
    () =>
      `${summaryQueryBaseKey}:quick=${requestKindQuickBilling}:${requestKindQuickProtocol}:requestKinds=${selectedRequestKindsNormalized.join(',')}:result=${resultFilter ?? ''}:keyEffect=${keyEffectFilter ?? ''}:bindingEffect=${bindingEffectFilter ?? ''}:selectionEffect=${selectionEffectFilter ?? ''}:key=${selectedKeyId ?? ''}`,
    [
      bindingEffectFilter,
      keyEffectFilter,
      requestKindQuickBilling,
      requestKindQuickProtocol,
      resultFilter,
      selectedKeyId,
      selectionEffectFilter,
      selectedRequestKindsNormalized,
      summaryQueryBaseKey,
    ],
  )
  const logsListQueryKey = useMemo(
    () => buildTokenLogsListQueryKey(logsQueryBaseKey, logsCursor, logsDirection, perPage),
    [logsCursor, logsDirection, logsQueryBaseKey, perPage],
  )
  logsRequestContextRef.current = {
    tokenId: id,
    sinceIso,
    untilIso,
    requestKinds: effectiveSelectedRequestKinds,
    forceEmptyMatch: hasQuickRequestKindEmptyMatch,
    result: resultFilter,
    keyEffect: keyEffectFilter,
    bindingEffect: bindingEffectFilter,
    selectionEffect: selectionEffectFilter,
    keyId: selectedKeyId ?? undefined,
  }
  useEffect(() => {
    logsQueryBaseKeyRef.current = logsQueryBaseKey
  }, [logsQueryBaseKey])

  useEffect(() => {
    if (logsCursor || !hasActiveQuickRequestKindFilters) return
    if (requestKindSelectionsMatch(selectedRequestKindsNormalized, requestKindQuickSelection)) return
    setSelectedRequestKinds(requestKindQuickSelection)
  }, [
    hasActiveQuickRequestKindFilters,
    logsCursor,
    requestKindQuickSelection,
    selectedRequestKindsNormalized,
  ])

  const applyStartInput = (raw: string, nextPeriod: Period = period, opts?: { suppressWarning?: boolean }) => {
    const sanitized = sanitizeInput(nextPeriod, raw || defaultInputValue(nextPeriod))
    const shouldWarn = !opts?.suppressWarning && raw.trim() !== '' && sanitized !== raw
    setWarning(shouldWarn ? strings.startAdjustedWarning : null)
    setSinceInput((prev) => (prev === sanitized ? prev : sanitized))
  }

  const handleStartChange = (nextPeriod: Period, value: string) => {
    applyStartInput(value, nextPeriod)
    setLogsCursor(null)
    setLogsDirection('older')
  }

  useEffect(() => {
    applyStartInput(sinceInput, period, { suppressWarning: sinceInput.trim() === '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  useEffect(() => {
    if (sinceDebounceRef.current != null) {
      window.clearTimeout(sinceDebounceRef.current)
      sinceDebounceRef.current = null
    }
    sinceDebounceRef.current = window.setTimeout(() => {
      setDebouncedSinceInput(sinceInput)
      sinceDebounceRef.current = null
    }, 500)
    return () => {
      if (sinceDebounceRef.current != null) {
        window.clearTimeout(sinceDebounceRef.current)
        sinceDebounceRef.current = null
      }
    }
  }, [sinceInput])

  useEffect(() => {
    if (!warning) {
      if (warningTimerRef.current != null) {
        window.clearTimeout(warningTimerRef.current)
        warningTimerRef.current = null
      }
      return
    }
    if (warningTimerRef.current != null) {
      window.clearTimeout(warningTimerRef.current)
    }
    warningTimerRef.current = window.setTimeout(() => {
      setWarning(null)
      warningTimerRef.current = null
    }, 4000)
    return () => {
      if (warningTimerRef.current != null) {
        window.clearTimeout(warningTimerRef.current)
        warningTimerRef.current = null
      }
    }
  }, [warning])

  async function getJson<T = any>(url: string, signal?: AbortSignal): Promise<T> {
    const res = await fetch(url, { signal })
    const contentType = res.headers.get('content-type') ?? ''
    const body = await res.text()
    if (!res.ok) {
      throw new Error(body || `${res.status} ${res.statusText}`)
    }
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new Error(body || strings.loadFailed)
    }
    try {
      return JSON.parse(body) as T
    } catch {
      throw new Error(body || strings.loadFailed)
    }
  }

  const loadLogsPage = useCallback(
    (
      cursor: string | null,
      direction: 'older' | 'newer',
      nextPerPage = perPageRef.current,
      signal?: AbortSignal,
    ) => {
      const {
        tokenId,
        sinceIso,
        untilIso,
        requestKinds,
        forceEmptyMatch,
        result,
        keyEffect,
        bindingEffect,
        selectionEffect,
        keyId,
      } = logsRequestContextRef.current
      return fetchTokenLogsList(
        tokenId,
        {
          limit: nextPerPage,
          cursor,
          direction,
          sinceIso,
          untilIso,
          requestKinds: forceEmptyMatch ? [tokenLogRequestKindEmptySelectionKey] : requestKinds,
          result: result as 'success' | 'error' | 'quota_exhausted' | undefined,
          keyEffect,
          bindingEffect,
          selectionEffect,
          keyId,
        },
        signal,
      )
    },
    [],
  )
  const refreshLogsCatalog = useCallback(
    (opts?: { preserveOnError?: boolean }) => {
      requestKindOptionsAbortRef.current?.abort()
      const controller = new AbortController()
      requestKindOptionsAbortRef.current = controller
      const catalogPlan = buildRequestLogsCatalogPlan({
        sinceIso,
        untilIso,
      })
      fetchTokenLogsCatalog(id, catalogPlan.query, controller.signal)
        .then((catalog) => {
          if (controller.signal.aborted) return
          setLogsCatalog(catalog)
          setRequestKindOptions(catalog.requestKindOptions)
          setLogFacets(catalog.facets)
        })
        .catch((e) => {
          if ((e as Error).name === 'AbortError' || controller.signal.aborted) return
          if (opts?.preserveOnError) return
          setLogsCatalog(null)
          setRequestKindOptions([])
          setLogFacets(emptyRequestLogFacets)
        })
      return controller
    },
    [id, sinceIso, untilIso],
  )
  const loadTokenLogBodies = useCallback(
    (log: RequestLog, signal: AbortSignal) => fetchTokenLogDetails(id, log.id, signal),
    [id],
  )

  async function loadQuickStats() {
    const now = new Date()
    const dayStart = startOfDay(now.getTime())
    const monthStart = startOfMonth(now.getTime())
    const sinceDay = toIso(dayStart)
    const sinceMonth = toIso(monthStart)
    const sinceEpoch = '1970-01-01T00:00:00+00:00'
    const untilNow = toIso(now)
    try {
      const [d, m, t] = await Promise.all([
        getJson<TokenSummary>(`/api/tokens/${encodeURIComponent(id)}/metrics?since=${encodeURIComponent(sinceDay)}&until=${encodeURIComponent(untilNow)}`),
        getJson<TokenSummary>(`/api/tokens/${encodeURIComponent(id)}/metrics?since=${encodeURIComponent(sinceMonth)}&until=${encodeURIComponent(untilNow)}`),
        getJson<TokenSummary>(`/api/tokens/${encodeURIComponent(id)}/metrics?since=${encodeURIComponent(sinceEpoch)}&until=${encodeURIComponent(untilNow)}`),
      ])
      setQuickStats({ day: d, month: m, total: t })
    } catch {
      // ignore quick stats errors to avoid blocking page
    }
  }

  const refreshQuickUsage = useCallback(() => {
    quickUsageAbortRef.current?.abort()
    const controller = new AbortController()
    quickUsageAbortRef.current = controller
    setQuickUsageLoading(true)
    const bucketSeconds = 3600
    const nowSec = Math.floor(Date.now() / 1000)
    const currentBucket = alignToBucket(nowSec, bucketSeconds)
    const bucketCount = 25
    const startSec = currentBucket - (bucketCount - 1) * bucketSeconds
    const untilSec = currentBucket + bucketSeconds
    fetchTokenUsageSeries(
      id,
      { since: toIso(new Date(startSec * 1000)), until: toIso(new Date(untilSec * 1000)), bucketSecs: bucketSeconds },
      controller.signal,
    )
      .then((rows) => {
        if (!controller.signal.aborted) {
          setQuickUsage(buildUsageBars(rows, startSec, bucketSeconds, bucketCount))
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setQuickUsage([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setQuickUsageLoading(false)
      })
  }, [id])

  const refreshSnapshotUsage = useCallback(() => {
    snapshotUsageAbortRef.current?.abort()
    const controller = new AbortController()
    snapshotUsageAbortRef.current = controller
    setSnapshotUsageLoading(true)
    const bucketSeconds = period === 'day' ? 3600 : 86400
    const startMs = Date.parse(sinceIso)
    const endMs = Date.parse(untilIso)
    const safeStart = Number.isNaN(startMs) ? Date.now() : startMs
    const safeEnd = Number.isNaN(endMs) ? safeStart + bucketSeconds * 1000 : endMs
    const startSec = alignToBucket(Math.floor(safeStart / 1000), bucketSeconds)
    const endSec = Math.max(startSec + bucketSeconds, Math.floor(safeEnd / 1000))
    const bucketCount = Math.max(1, Math.ceil((endSec - startSec) / bucketSeconds))
    const untilAligned = startSec + bucketCount * bucketSeconds
    fetchTokenUsageSeries(
      id,
      { since: toIso(new Date(startSec * 1000)), until: toIso(new Date(untilAligned * 1000)), bucketSecs: bucketSeconds },
      controller.signal,
    )
      .then((rows) => {
        if (!controller.signal.aborted) {
          setSnapshotUsage(buildUsageBars(rows, startSec, bucketSeconds, bucketCount))
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setSnapshotUsage([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setSnapshotUsageLoading(false)
      })
  }, [id, period, sinceIso, untilIso])

  useEffect(() => {
    refreshQuickUsage()
    return () => { quickUsageAbortRef.current?.abort() }
  }, [refreshQuickUsage])

  useEffect(() => {
    refreshSnapshotUsage()
    return () => { snapshotUsageAbortRef.current?.abort() }
  }, [refreshSnapshotUsage])

  useEffect(() => () => {
    detailAbortRef.current?.abort()
    logsAbortRef.current?.abort()
    requestKindOptionsAbortRef.current?.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchProfile(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setProfile(data)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const handleManualRefresh = useCallback(() => {
    setReloadTick((tick) => tick + 1)
    refreshQuickUsage()
    refreshSnapshotUsage()
    refreshLogsCatalog({ preserveOnError: true })
  }, [refreshQuickUsage, refreshSnapshotUsage, refreshLogsCatalog])

  // load detail + summary when the time window changes
  useEffect(() => {
    detailAbortRef.current?.abort()
    const detailController = new AbortController()
    detailAbortRef.current = detailController
    const nextQueryKey = summaryQueryBaseKey
    setSummaryLoadState(getBlockingLoadState(summaryQueryKeyRef.current != null))
    setSummary(null)
    setError(null)
    const run = async () => {
      try {
        const [detailRes, summaryRes] = await Promise.all([
          getJson(`/api/tokens/${encodeURIComponent(id)}`, detailController.signal),
          getJson(`/api/tokens/${encodeURIComponent(id)}/metrics?period=${period}&since=${encodeURIComponent(sinceIso)}&until=${encodeURIComponent(untilIso)}`, detailController.signal),
        ])
        if (detailController.signal.aborted) return
        setInfo(detailRes)
        setSummary(summaryRes)
        setError(null)
        setSummaryLoadState('ready')
        summaryQueryKeyRef.current = nextQueryKey
        void loadQuickStats()
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        setError(e instanceof Error ? e.message : strings.loadFailed)
        setSummaryLoadState('error')
      }
    }
    void run()
    return () => {
      detailController.abort()
    }
  }, [id, period, reloadTick, sinceIso, summaryQueryBaseKey, untilIso])

  // load logs list when the time window, cursor, or filters change
  useEffect(() => {
    logsAbortRef.current?.abort()
    const logsController = new AbortController()
    logsAbortRef.current = logsController
    const requestedPerPage = perPageRef.current
    setLogsLoadState(getBlockingLoadState(logsQueryKeyRef.current != null))
    setLogs([])
    setLogsPageInfo(createEmptyTokenLogsListPage(requestedPerPage))
    setError(null)
    const run = async () => {
      try {
        const logsRes = await loadLogsPage(logsCursor, logsDirection, requestedPerPage, logsController.signal)
        if (logsController.signal.aborted) return
        setLogs(logsRes.items)
        setLogsPageInfo(logsRes)
        setError(null)
        setLogsLoadState('ready')
        logsQueryKeyRef.current = buildTokenLogsListQueryKey(
          logsQueryBaseKey,
          logsCursor,
          logsDirection,
          logsRes.pageSize,
        )
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        setLogs([])
        setLogsPageInfo(createEmptyTokenLogsListPage(requestedPerPage))
        setError(e instanceof Error ? e.message : strings.loadLogsFailed)
        setLogsLoadState('error')
      }
    }
    void run()
    return () => {
      logsController.abort()
    }
  }, [loadLogsPage, logsCursor, logsDirection, logsListQueryKey, logsQueryBaseKey, reloadTick])

  useEffect(() => {
    const controller = refreshLogsCatalog()
    return () => controller.abort()
  }, [refreshLogsCatalog])

  // SSE for live updates (refresh first page upon snapshot)
  useEffect(() => {
    const refreshDetail = async () => {
      try {
        const detail = await getJson(`/api/tokens/${encodeURIComponent(id)}`)
        setInfo(detail)
      } catch {
        // ignore
      }
    }
    const refreshLogs = async () => {
      if (logsCursor) return
      logsAbortRef.current?.abort()
      const controller = new AbortController()
      logsAbortRef.current = controller
      const requestedPerPage = perPageRef.current
      setLogsLoadState(getRefreshingLoadState(logsQueryKeyRef.current != null))
      setLogsPageInfo(createEmptyTokenLogsListPage(requestedPerPage))
      try {
        const data = await loadLogsPage(null, 'older', requestedPerPage, controller.signal)
        if (controller.signal.aborted) return
        setLogs(data.items)
        setLogsPageInfo(data)
        setLogsLoadState('ready')
        logsQueryKeyRef.current = buildTokenLogsListQueryKey(logsQueryBaseKey, null, 'older', data.pageSize)
      } catch {
        if (!controller.signal.aborted) {
          setLogs([])
          setLogsPageInfo(createEmptyTokenLogsListPage(requestedPerPage))
          setLogsLoadState('error')
        }
        // ignore
      }
    }
    try { sseRef.current?.close() } catch {}
    const es = new EventSource(`/api/tokens/${encodeURIComponent(id)}/events`)
    sseRef.current = es
    es.addEventListener('snapshot', (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as { summary: TokenSummary, logs: TokenLog[] }
        const defaultMonthInput = defaultInputValue('month')
        const isMonthView = period === 'month' && (debouncedSinceInput === '' || debouncedSinceInput === defaultMonthInput)
        if (isMonthView) {
          setSummaryLoadState(getRefreshingLoadState(summaryQueryKeyRef.current != null))
          setSummary(data.summary)
          setSummaryLoadState('ready')
        }
        void refreshDetail()
        void refreshLogs()
        refreshLogsCatalog({ preserveOnError: true })
        void loadQuickStats()
        refreshQuickUsage()
        refreshSnapshotUsage()
        setSseConnected(true)
      } catch {
        // ignore bad payloads
      }
    })
    es.onopen = () => setSseConnected(true)
    es.onerror = () => { setSseConnected(false) }
    return () => { try { es.close() } catch {} setSseConnected(false) }
  }, [
    debouncedSinceInput,
    id,
    loadLogsPage,
    logsQueryBaseKey,
    logsCursor,
    period,
    refreshQuickUsage,
    refreshSnapshotUsage,
    refreshLogsCatalog,
    sinceIso,
    untilIso,
  ])

  useEffect(() => {
    ;(window as typeof window & { __TOKEN_PERIOD__?: Period }).__TOKEN_PERIOD__ = period
  }, [period])

  const goNewerLogsPage = () => {
    if (!logsPageInfo.prevCursor) return
    setLogsCursor(logsPageInfo.prevCursor)
    setLogsDirection('newer')
  }

  const goOlderLogsPage = () => {
    if (!logsPageInfo.nextCursor) return
    setLogsCursor(logsPageInfo.nextCursor)
    setLogsDirection('older')
  }

  const changePerPage = (nextPerPage: number) => {
    setPerPage(nextPerPage)
    setLogsCursor(null)
    setLogsDirection('older')
  }

  const applyRequestKindQuickFilters = useCallback(
    (nextBilling: TokenLogRequestKindQuickBilling, nextProtocol: TokenLogRequestKindQuickProtocol) => {
      const nextFilters = {
        billing: nextBilling,
        protocol: nextProtocol,
      }
      setRequestKindQuickBilling(nextBilling)
      setRequestKindQuickProtocol(nextProtocol)
      setSelectedRequestKinds(buildRequestKindQuickFilterSelection(requestKindOptions, nextFilters))
      setLogsCursor(null)
      setLogsDirection('older')
    },
    [requestKindOptions],
  )

  const handleToggleRequestKind = useCallback(
    (key: string) => {
      const nextSelected = toggleRequestKindSelection(effectiveSelectedRequestKinds, key)
      const nextQuickFilters = resolveManualRequestKindQuickFilters(
        nextSelected,
        requestKindQuickFilters,
        requestKindQuickSelection,
        requestKindOptions,
      )
      setSelectedRequestKinds(nextSelected)
      setRequestKindQuickBilling(nextQuickFilters.billing)
      setRequestKindQuickProtocol(nextQuickFilters.protocol)
      setLogsCursor(null)
      setLogsDirection('older')
    },
    [
      effectiveSelectedRequestKinds,
      requestKindOptions,
      requestKindQuickFilters,
      requestKindQuickSelection,
    ],
  )

  const handleClearRequestKinds = useCallback(() => {
    setSelectedRequestKinds([])
    setRequestKindQuickBilling(defaultTokenLogRequestKindQuickFilters.billing)
    setRequestKindQuickProtocol(defaultTokenLogRequestKindQuickFilters.protocol)
    setLogsCursor(null)
    setLogsDirection('older')
  }, [])

  const handleOutcomeFilterChange = useCallback((next: RecentRequestsOutcomeFilter | null) => {
    setOutcomeFilter(next)
    setLogsCursor(null)
    setLogsDirection('older')
  }, [])

  const handleKeyFilterChange = useCallback((next: string | null) => {
    setSelectedKeyId(next)
    setLogsCursor(null)
    setLogsDirection('older')
  }, [])

  const handleRotateToken = useCallback(async () => {
    try {
      setRotating(true)
      const res = await rotateTokenSecret(id)
      setRotatedToken(res.token)
      onSecretRotated?.(id, res.token)
      const copyResult = await copyText(res.token)
      setRotatedCopyState(copyResult.ok ? 'copied' : 'error')
      setIsRotateDialogOpen(false)
      setIsRotatedDialogOpen(true)
    } catch (e) {
      setIsRotateDialogOpen(false)
      alert((e as Error)?.message || strings.rotate.failed)
    } finally {
      setRotating(false)
    }
  }, [id, onSecretRotated])

  const handleCopyRotatedToken = useCallback(async () => {
    if (!rotatedToken) return
    const copyResult = await copyText(rotatedToken, { preferExecCommand: true })
    setRotatedCopyState(copyResult.ok ? 'copied' : 'error')
    if (!copyResult.ok) {
      window.requestAnimationFrame(() => {
        selectAllReadonlyText(rotatedTokenFieldRef.current)
      })
    }
  }, [rotatedToken])
  const manualRefreshBusy = summaryBlocking || logsBlocking
  const tokenDetailSidebarUtility = (
    <AdminShellSidebarUtility>
      <div className="flex flex-col gap-3">
        <Card size="sm" className="admin-sidebar-utility-card">
          <CardContent className="flex flex-col gap-3">
            <div className="admin-sidebar-utility-toolbar flex flex-wrap items-center gap-2">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              {profile?.displayName && (
                <div className="user-badge flex min-w-0 items-center gap-2 text-sm [&>span]:truncate" title={profile.displayName}>
                  {profile.isAdmin && <Icon icon="mdi:crown-outline" className="size-4 shrink-0" aria-hidden="true" />}
                  <span>{profile.displayName}</span>
                </div>
              )}
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${sseConnected ? 'border-success/40 bg-success/10 text-success' : 'border-warning/40 bg-warning/10 text-warning'}`} title={strings.liveBadgeTitle}>
                <span className="size-1.5 rounded-full bg-current" aria-hidden="true" /> {sseConnected ? strings.live : strings.offline}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card size="sm" className="admin-sidebar-utility-card">
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 [&>a]:w-full [&>button]:w-full">
              <AdminReturnToConsoleLink
                label={headerStrings.returnToConsole}
                href={ADMIN_USER_CONSOLE_HREF}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => (onBack ? onBack() : window.history.back())}
              >
                <Icon icon="mdi:arrow-left" width={18} height={18} aria-hidden="true" />
                {translations.admin.keyDetails.back}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-warning/40 text-warning hover:bg-warning/10"
                onClick={() => setIsRotateDialogOpen(true)}
                aria-label={strings.rotate.actionAria}
              >
                <Icon icon="mdi:key-change" width={16} height={16} aria-hidden="true" />
                {strings.rotate.action}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="admin-panel-refresh-button"
                onClick={handleManualRefresh}
                disabled={manualRefreshBusy}
              >
                <Icon
                  icon={manualRefreshBusy ? 'mdi:loading' : 'mdi:refresh'}
                  width={16}
                  height={16}
                  className={manualRefreshBusy ? 'icon-spin' : undefined}
                  aria-hidden="true"
                />
                <span>{manualRefreshBusy ? headerStrings.refreshing : headerStrings.refreshNow}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShellSidebarUtility>
  )

  return (
    <div
      ref={pageRef}
      className={`flex min-w-0 flex-col gap-6 viewport-${viewportMode} content-${contentMode}${
        isCompactLayout ? ' is-compact-layout' : ''
      }`}
    >
      {tokenDetailSidebarUtility}

      <div className="block md:hidden">
        <section className="surface">
          <div className="flex flex-col gap-1">
            <h1>{strings.title}</h1>
            <div className="text-sm text-muted-foreground">{strings.tokenId} <code>{id}</code></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <AdminReturnToConsoleLink
              label={translations.admin.header.returnToConsole}
              href={ADMIN_USER_CONSOLE_HREF}
            />
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${sseConnected ? 'border-success/40 bg-success/10 text-success' : 'border-warning/40 bg-warning/10 text-warning'}`} title={strings.liveBadgeTitle}>
              <span className="size-1.5 rounded-full bg-current" aria-hidden="true" /> {sseConnected ? strings.live : strings.offline}
            </span>
            <Button type="button" variant="outline" onClick={() => (onBack ? onBack() : window.history.back())}>
              <Icon icon="mdi:arrow-left" width={18} height={18} />
              {translations.admin.keyDetails.back}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-warning/40 text-warning hover:bg-warning/10"
              onClick={() => setIsRotateDialogOpen(true)}
              aria-label={strings.rotate.actionAria}
            >
              <Icon icon="mdi:key-change" width={16} height={16} aria-hidden="true" />
              {strings.rotate.action}
            </Button>
          </div>
        </section>
      </div>

      <div className="hidden md:block">
        <section className="admin-compact-intro flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">{strings.title}</h1>
            <p className="text-sm text-muted-foreground">{strings.tokenId} <code>{id}</code></p>
          </div>
        </section>
      </div>

      {error && <div className="surface rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div>}

      <Card className="surface panel flex flex-col gap-1">
        <AdminLoadingRegion
          loadState={infoRegionLoadState}
          loadingLabel={summaryRefreshing ? refreshingLabel : loadingStateStrings.switching}
          minHeight={184}
        >
          {info ? (
            <div className="grid min-w-0 gap-3 px-4 sm:grid-cols-2" aria-label={strings.title}>
              <InfoCard
                label={strings.tokenId}
                value={<code title={info.id}>{info.id}</code>}
              />
              <InfoCard
                label={strings.status}
                value={
                  <StatusBadge tone={info.enabled ? 'success' : 'error'}>
                    {info.enabled ? strings.enabled : strings.disabled}
                  </StatusBadge>
                }
              />
              <InfoCard label={strings.totalRequests} value={formatNumber(info.total_requests, locale)} />
              <InfoCard label={strings.created} value={formatTime(info.created_at, locale)} />
              <InfoCard label={strings.lastUsed} value={formatTime(info.last_used_at, locale)} />
              <InfoCard
                label={tokenStrings.owner.label}
                value={<TokenOwnerValue owner={info.owner ?? null} emptyLabel={tokenStrings.owner.unbound} onOpenUser={onOpenUser} />}
              />
              <InfoCard
                label={strings.note}
                value={info.note ? <span className="text-xs text-muted-foreground" title={info.note}>{info.note}</span> : '—'}
              />
            </div>
          ) : (
            <Empty><EmptyDescription>{strings.infoUnavailable}</EmptyDescription></Empty>
          )}
        </AdminLoadingRegion>
      </Card>

      <Card className="surface panel">
        <CardHeader className="panel-header border-b">
          <div>
            <CardTitle role="heading" aria-level={2}>{strings.quickStatsTitle}</CardTitle>
            <CardDescription>{strings.quickStatsDescription}</CardDescription>
          </div>
        </CardHeader>
        <AdminLoadingRegion
          loadState={infoRegionLoadState}
          loadingLabel={summaryRefreshing ? refreshingLabel : loadingStateStrings.switching}
          minHeight={176}
        >
          <section className="grid min-w-0 gap-3 px-4 sm:grid-cols-3">
            {info ? (
              <>
                <QuotaStatCard
                  label={strings.windowHour}
                  used={info.quota_hourly_used}
                  limit={info.quota_hourly_limit}
                  resetAt={info.quota_hourly_reset_at}
                  description={strings.windowHourDescription}
                  locale={locale}
                  notUsedYetLabel={strings.notUsedYet}
                  formatNextReset={strings.nextReset}
                />
                <QuotaStatCard
                  label={strings.window24Hours}
                  used={info.quota_daily_used}
                  limit={info.quota_daily_limit}
                  resetAt={info.quota_daily_reset_at}
                  description={strings.window24HoursDescription}
                  locale={locale}
                  notUsedYetLabel={strings.notUsedYet}
                  formatNextReset={strings.nextReset}
                />
                <QuotaStatCard
                  label={strings.windowMonth}
                  used={info.quota_monthly_used}
                  limit={info.quota_monthly_limit}
                  resetAt={info.quota_monthly_reset_at}
                  description={strings.windowMonthDescription}
                  locale={locale}
                  notUsedYetLabel={strings.notUsedYet}
                  formatNextReset={strings.nextReset}
                />
              </>
            ) : (
              <Empty className="col-span-full"><EmptyDescription>
                {strings.quotaUnavailable}
              </EmptyDescription></Empty>
            )}
          </section>
        </AdminLoadingRegion>
        <div className="mt-4">
          <UsageChart data={quickUsage} loading={quickUsageLoading} labelFormatter={hourLabel} height={200}
            legendLabels={{ success: strings.chart.success, system: strings.chart.systemLimited, external: strings.chart.otherFailures }}
            loadingLabel={strings.chart.loading}
          />
        </div>
      </Card>

      <Card className="surface panel">
        <CardHeader className="panel-header border-b flex flex-wrap items-start justify-between gap-3 border-b px-4 pb-4">
          <div>
            <CardTitle role="heading" aria-level={2}>{strings.snapshotTitle}</CardTitle>
            <CardDescription>{strings.snapshotDescription}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4" role="group" aria-label={strings.periodFilterAria}>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium">
              <label htmlFor={periodSelectId}>{strings.periodLabel}</label>
              <Select
                value={period}
                onValueChange={(value) => {
                  const next = value as Period
                  setPeriod(next)
                  applyStartInput('', next)
                  setLogsCursor(null)
                  setLogsDirection('older')
                }}
                disabled={filterControlsDisabled}
              >
                <SelectTrigger id={periodSelectId} disabled={filterControlsDisabled}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    <SelectItem value="day">{translations.admin.keyDetails.periodOptions.day}</SelectItem>
                    <SelectItem value="week">{translations.admin.keyDetails.periodOptions.week}</SelectItem>
                    <SelectItem value="month">{translations.admin.keyDetails.periodOptions.month}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium">
              <label htmlFor={sinceInputId}>{strings.startLabel}</label>
              {period === 'day' && (
                <Input
                  id={sinceInputId}
                  type="date"
                  max={defaultInputValue('day')}
                  value={sinceInput}
                  disabled={filterControlsDisabled}
                  onChange={(e) => handleStartChange(period, e.target.value)}
                />
              )}
              {period === 'week' && (
                <Input
                  id={sinceInputId}
                  type="week"
                  max={defaultInputValue('week')}
                  value={sinceInput}
                  disabled={filterControlsDisabled}
                  onChange={(e) => handleStartChange(period, e.target.value)}
                />
              )}
              {period === 'month' && (
                <Input
                  id={sinceInputId}
                  type="month"
                  max={defaultInputValue('month')}
                  value={sinceInput}
                  disabled={filterControlsDisabled}
                  onChange={(e) => handleStartChange(period, e.target.value)}
                />
              )}
            </div>
          </div>
        </CardHeader>
        {warning && (
          <div className="px-4 text-xs text-warning alert border-warning/40 bg-warning/10 text-warning" role="status">
            <Icon icon="mdi:alert-circle-outline" width={18} height={18} aria-hidden="true" />
            <span>{warning}</span>
          </div>
        )}
        <AdminLoadingRegion
          loadState={summaryLoadState}
          loadingLabel={summaryRefreshing ? refreshingLabel : loadingStateStrings.switching}
          minHeight={160}
        >
          <div className="grid min-w-0 grid-cols-2 gap-3 px-4 sm:grid-cols-4">
            <MetricCard label={translations.admin.keyDetails.metrics.total} value={formatNumber(summary?.total_requests ?? 0, locale)} />
            <MetricCard label={translations.admin.keyDetails.metrics.success} value={formatNumber(summary?.success_count ?? 0, locale)} />
            <MetricCard label={translations.admin.keyDetails.metrics.errors} value={formatNumber(summary?.error_count ?? 0, locale)} />
            <MetricCard label={translations.admin.keyDetails.metrics.quota} value={formatNumber(summary?.quota_exhausted_count ?? 0, locale)} />
          </div>
        </AdminLoadingRegion>
        <div className="mt-4">
          <UsageChart
            data={snapshotUsage}
            loading={snapshotUsageLoading}
            labelFormatter={period === 'day' ? hourLabel : (bucket) => dayLabel(bucket, locale)}
            height={220}
            legendLabels={{ success: strings.chart.success, system: strings.chart.systemLimited, external: strings.chart.otherFailures }}
            loadingLabel={strings.chart.loading}
          />
        </div>
      </Card>

      <AdminRecentRequestsPanel
        variant="token"
        language={language}
        strings={translations.admin}
        title={translations.admin.logs.title}
        description={logsDescription}
        emptyLabel={strings.logsEmpty}
        loadState={logsLoadState}
        loadingLabel={logsRefreshing ? refreshingLabel : loadingStateStrings.switching}
        errorLabel={error}
        logs={logs}
        requestKindOptions={requestKindOptions}
        requestKindQuickBilling={requestKindQuickBilling}
        requestKindQuickProtocol={requestKindQuickProtocol}
        selectedRequestKinds={selectedRequestKinds}
        onRequestKindQuickFiltersChange={applyRequestKindQuickFilters}
        onToggleRequestKind={handleToggleRequestKind}
        onClearRequestKinds={handleClearRequestKinds}
        outcomeFilter={outcomeFilter}
        resultOptions={logFacets.results}
        keyEffectOptions={logFacets.keyEffects}
        bindingEffectOptions={logFacets.bindingEffects}
        selectionEffectOptions={logFacets.selectionEffects}
        onOutcomeFilterChange={handleOutcomeFilterChange}
        keyOptions={logFacets.keys}
        selectedKeyId={selectedKeyId}
        onKeyFilterChange={handleKeyFilterChange}
        showKeyColumn
        showTokenColumn={false}
        onOpenKey={onOpenKey}
        perPage={perPage}
        hasOlder={logsPageInfo.hasOlder}
        hasNewer={logsPageInfo.hasNewer}
        paginationSummary={logsPaginationSummary}
        paginationDisabled={logsBlocking}
        onNewerPage={goNewerLogsPage}
        onOlderPage={goOlderLogsPage}
        onPerPageChange={(value) => void changePerPage(value)}
        formatTime={(ts) => formatLogTime(ts, period, locale)}
        formatTimeDetail={(ts) => (ts ? formatDateTimeValue(ts, locale) : '—')}
        loadLogBodies={loadTokenLogBodies}
      />

    <Dialog open={isRotateDialogOpen} onOpenChange={setIsRotateDialogOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{strings.rotate.dialogTitle}</DialogTitle>
          <DialogDescription>
            {strings.rotate.dialogDescription}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setIsRotateDialogOpen(false)}>
            {strings.rotate.cancel}
          </Button>
          <Button type="button" variant="outline" className="border-warning/40 bg-warning/10 text-warning hover:bg-warning/20" onClick={() => void handleRotateToken()} disabled={rotating}>
            {rotating ? strings.rotate.confirming : strings.rotate.confirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isRotatedDialogOpen} onOpenChange={setIsRotatedDialogOpen}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{strings.rotated.dialogTitle}</DialogTitle>
          <DialogDescription>
            {rotatedCopyState === 'error'
              ? strings.rotated.copyBlockedDescription
              : strings.rotated.copiedDescription}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          ref={rotatedTokenFieldRef}
          readOnly
          rows={1}
          className="min-h-0 resize-none font-mono text-xs"
          value={rotatedToken ?? '—'}
          onClick={(event) => selectAllReadonlyText(event.currentTarget)}
          onFocus={(event) => selectAllReadonlyText(event.currentTarget)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setIsRotatedDialogOpen(false)}>
            {strings.rotated.close}
          </Button>
          <Button type="button" onClick={() => void handleCopyRotatedToken()}>
            {rotatedCopyState === 'copied' ? strings.rotated.copied : rotatedCopyState === 'error' ? strings.rotated.copyFailed : strings.rotated.copy}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="font-mono text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}

function UsageChart({
  data,
  loading,
  labelFormatter,
  height = 180,
  legendLabels,
  loadingLabel = 'Loading…',
}: {
  data: UsageBar[]
  loading: boolean
  labelFormatter: (bucket: number) => string
  height?: number
  legendLabels: { success: string; system: string; external: string }
  loadingLabel?: string
}) {
  const chartConfig = {
    success: { label: legendLabels.success, color: 'var(--chart-1)' },
    system: { label: legendLabels.system, color: 'var(--chart-2)' },
    external: { label: legendLabels.external, color: 'var(--chart-3)' },
  } satisfies ChartConfig
  return (
    <div className="min-w-0 px-4">
      {loading ? (
        <Empty><EmptyDescription>{loadingLabel}</EmptyDescription></Empty>
      ) : (
        <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
          <BarChart accessibilityLayer data={data.map((point) => ({ ...point, label: labelFormatter(point.bucket) }))}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={24} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="success" stackId="requests" fill="var(--color-success)" radius={[0, 0, 4, 4]} />
            <Bar dataKey="system" stackId="requests" fill="var(--color-system)" />
            <Bar dataKey="external" stackId="requests" fill="var(--color-external)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  )
}

export const __testables = {
  buildTokenLogsListQueryKey,
  createEmptyTokenLogsListPage,
}
