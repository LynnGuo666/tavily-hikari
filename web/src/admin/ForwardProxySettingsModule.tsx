import { Area, AreaChart, Bar, BarChart, Pie, PieChart, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import SegmentedTabs from '../components/SegmentedTabs'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import AdminLoadingRegion from '../components/AdminLoadingRegion'
import { Icon } from '../lib/icons'
import { useAnchoredFloatingLayer } from '../lib/useAnchoredFloatingLayer'
import type {
  ForwardProxyActivityBucket,
  ForwardProxyErrorActivityBucket,
  ForwardProxyErrorKindCount,
  ForwardProxyErrorStatsNode,
  ForwardProxyErrorStatsResponse,
  ForwardProxyErrorWindowStats,
  ForwardProxyProgressEvent,
  ForwardProxyProgressNodeState,
  ForwardProxySettings,
  ForwardProxyStatsNode,
  ForwardProxyStatsResponse,
  ForwardProxyValidationKind,
  ForwardProxyValidationResponse,
  ForwardProxyWeightBucket,
  ForwardProxyWindowStats,
} from '../api'
import type { AdminTranslations } from '../i18n'
import {
  createDialogProgressState,
  type ForwardProxyDialogKind,
  type ForwardProxyDialogProgressState,
  updateDialogProgressState,
} from './forwardProxyDialogProgress'
import ForwardProxyEgressControl from './ForwardProxyEgressControl'
import ForwardProxyProgressBubble from './ForwardProxyProgressBubble'
import type { QueryLoadState } from './queryLoadState'

const numberFormatter = new Intl.NumberFormat()
const decimalFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const percentFormatter = new Intl.NumberFormat(undefined, {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

type NodeWindowKey = 'oneMinute' | 'fifteenMinutes' | 'oneHour' | 'oneDay' | 'sevenDays'

const WINDOW_KEYS: Array<{ key: NodeWindowKey; translationKey: keyof AdminTranslations['proxySettings']['windows'] }> = [
  { key: 'oneMinute', translationKey: 'oneMinute' },
  { key: 'fifteenMinutes', translationKey: 'fifteenMinutes' },
  { key: 'oneHour', translationKey: 'oneHour' },
  { key: 'oneDay', translationKey: 'oneDay' },
  { key: 'sevenDays', translationKey: 'sevenDays' },
]

export interface ForwardProxyDraft {
  proxyUrlsText: string
  subscriptionUrlsText: string
  subscriptionUpdateIntervalSecs: string
  insertDirect: boolean
  egressSocks5Enabled: boolean
  egressSocks5Url: string
}

export interface ForwardProxyValidationEntry {
  id: string
  kind: ForwardProxyValidationKind
  value: string
  result: ForwardProxyValidationResponse
}

export interface ForwardProxyDialogPreviewState {
  kind: Exclude<ForwardProxyDialogKind, null>
  input: string
  error?: string | null
  validating?: boolean
  results?: ForwardProxyValidationEntry[]
  progress?: ForwardProxyDialogProgressState | null
}

interface ForwardProxyPersistOptions {
  skipBootstrapProbe?: boolean
}

interface ForwardProxySettingsModuleProps {
  strings: AdminTranslations['proxySettings']
  settings: ForwardProxySettings | null
  stats: ForwardProxyStatsResponse | null
  errorStats: ForwardProxyErrorStatsResponse | null
  settingsLoadState: QueryLoadState
  statsLoadState: QueryLoadState
  errorStatsLoadState: QueryLoadState
  settingsError: string | null
  statsError: string | null
  errorStatsError: string | null
  saveError: string | null
  revalidateError: string | null
  saving: boolean
  revalidating: boolean
  savedAt: number | null
  revalidateProgress: ForwardProxyDialogProgressState | null
  egressPreviewProgress?: ForwardProxyDialogProgressState | null
  onPersistDraft: (
    draft: ForwardProxyDraft,
    onProgress?: (event: ForwardProxyProgressEvent) => void,
    options?: ForwardProxyPersistOptions,
  ) => Promise<void>
  onValidateCandidates: (
    kind: ForwardProxyValidationKind,
    values: string[],
    onProgress?: (event: ForwardProxyProgressEvent) => void,
    signal?: AbortSignal,
  ) => Promise<ForwardProxyValidationEntry[]>
  onRevalidate: () => void
  onSetNodesDisabled?: (proxyKeys: string[], disabled: boolean) => Promise<void>
  initialNodeView?: 'pool' | 'errors'
  dialogPreview?: ForwardProxyDialogPreviewState | null
  onDialogPreviewClose?: () => void
}

const FORWARD_PROXY_INTERVAL_OPTIONS = [
  { value: '60', label: '1m' },
  { value: '300', label: '5m' },
  { value: '900', label: '15m' },
  { value: '3600', label: '1h' },
  { value: '21600', label: '6h' },
  { value: '86400', label: '1d' },
]

interface ForwardProxyBucketRange {
  rangeStartMs: number
  bucketMs: number
  bucketCount: number
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return numberFormatter.format(value)
}

function formatDecimal(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return decimalFormatter.format(value)
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  const normalized = value > 1 ? value / 100 : value
  return percentFormatter.format(Math.max(0, normalized))
}

function formatLatency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${decimalFormatter.format(value)} ms`
}

function normalizeEgressErrorMessage(
  strings: AdminTranslations['proxySettings'],
  message: string | null | undefined,
): string {
  if (!message) return strings.config.egressUnknownError

  const normalized = message.trim()
  const withoutPrefix = normalized.replace(/^other error:\s*/i, '')

  if (
    /global SOCKS5 relay must be a valid socks5:\/\/ or socks5h:\/\/ URL/i.test(withoutPrefix)
  ) {
    return strings.config.egressInvalidUrlError
  }

  return withoutPrefix || strings.config.egressUnknownError
}

function validateEgressUrl(
  strings: AdminTranslations['proxySettings'],
  value: string,
): string | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) return null

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return strings.config.egressInvalidUrlError
  }

  const scheme = parsed.protocol.replace(/:$/, '').toLowerCase()
  if ((scheme !== 'socks5' && scheme !== 'socks5h') || !parsed.hostname || !parsed.port) {
    return strings.config.egressInvalidUrlError
  }

  return null
}

function formatTimeRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return '—'
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '—'
  return `${dateTimeFormatter.format(startDate)} - ${dateTimeFormatter.format(endDate)}`
}

function computeSuccessRate(stats: ForwardProxyWindowStats): number | null {
  if (typeof stats.successRate === 'number') {
    return stats.successRate
  }
  const success = stats.successCount ?? null
  const failure = stats.failureCount ?? null
  if (success == null || failure == null) {
    return null
  }
  const total = success + failure
  return total > 0 ? success / total : null
}

function buildMergedNodes(
  settings: ForwardProxySettings | null,
  stats: ForwardProxyStatsResponse | null,
): ForwardProxyStatsNode[] {
  const nodeMap = new Map<string, ForwardProxyStatsNode>()

  for (const node of settings?.nodes ?? []) {
    nodeMap.set(node.key, {
      ...node,
      last24h: [],
      weight24h: [],
    })
  }

  for (const node of stats?.nodes ?? []) {
    const previous = nodeMap.get(node.key)
    nodeMap.set(node.key, {
      ...(previous ?? node),
      ...node,
      stats: node.stats ?? previous?.stats ?? {
        oneMinute: { attempts: 0 },
        fifteenMinutes: { attempts: 0 },
        oneHour: { attempts: 0 },
        oneDay: { attempts: 0 },
        sevenDays: { attempts: 0 },
      },
      last24h: node.last24h ?? previous?.last24h ?? [],
      weight24h: node.weight24h ?? previous?.weight24h ?? [],
    })
  }

  const bucketRange = resolveBucketRange(stats)

  return Array.from(nodeMap.values())
    .map((node) => normalizeNodeBuckets(node, bucketRange))
    .sort((left, right) => {
    if (left.source === 'direct' && right.source !== 'direct') return 1
    if (left.source !== 'direct' && right.source === 'direct') return -1
    if (left.penalized !== right.penalized) return left.penalized ? 1 : -1
    return right.weight - left.weight || left.displayName.localeCompare(right.displayName)
    })
}

function resolveBucketRange(stats: ForwardProxyStatsResponse | null): ForwardProxyBucketRange | null {
  if (!stats) return null
  const rangeStartMs = Date.parse(stats.rangeStart)
  const rangeEndMs = Date.parse(stats.rangeEnd)
  const bucketMs = stats.bucketSeconds * 1000
  if (!Number.isFinite(rangeStartMs) || !Number.isFinite(rangeEndMs) || !Number.isFinite(bucketMs) || bucketMs <= 0) {
    return null
  }
  const bucketCount = Math.max(0, Math.round((rangeEndMs - rangeStartMs) / bucketMs))
  if (bucketCount <= 0) return null
  return { rangeStartMs, bucketMs, bucketCount }
}

function normalizeActivityBuckets(
  buckets: ForwardProxyActivityBucket[],
  bucketRange: ForwardProxyBucketRange | null,
): ForwardProxyActivityBucket[] {
  if (!bucketRange) return buckets
  const bucketMap = new Map<number, ForwardProxyActivityBucket>()
  for (const bucket of buckets) {
    const startMs = Date.parse(bucket.bucketStart)
    if (Number.isFinite(startMs)) {
      bucketMap.set(startMs, bucket)
    }
  }

  return Array.from({ length: bucketRange.bucketCount }, (_, index) => {
    const bucketStartMs = bucketRange.rangeStartMs + index * bucketRange.bucketMs
    const existing = bucketMap.get(bucketStartMs)
    if (existing) return existing
    return {
      bucketStart: new Date(bucketStartMs).toISOString(),
      bucketEnd: new Date(bucketStartMs + bucketRange.bucketMs).toISOString(),
      successCount: 0,
      failureCount: 0,
    }
  })
}

function normalizeWeightBuckets(
  buckets: ForwardProxyWeightBucket[],
  bucketRange: ForwardProxyBucketRange | null,
  fallbackWeight: number,
): ForwardProxyWeightBucket[] {
  if (!bucketRange) return buckets
  const bucketMap = new Map<number, ForwardProxyWeightBucket>()
  for (const bucket of buckets) {
    const startMs = Date.parse(bucket.bucketStart)
    if (Number.isFinite(startMs)) {
      bucketMap.set(startMs, bucket)
    }
  }

  let carryWeight = fallbackWeight
  return Array.from({ length: bucketRange.bucketCount }, (_, index) => {
    const bucketStartMs = bucketRange.rangeStartMs + index * bucketRange.bucketMs
    const existing = bucketMap.get(bucketStartMs)
    if (existing) {
      carryWeight = existing.lastWeight
      return existing
    }
    return {
      bucketStart: new Date(bucketStartMs).toISOString(),
      bucketEnd: new Date(bucketStartMs + bucketRange.bucketMs).toISOString(),
      sampleCount: 0,
      minWeight: carryWeight,
      maxWeight: carryWeight,
      avgWeight: carryWeight,
      lastWeight: carryWeight,
    }
  })
}

function normalizeNodeBuckets(
  node: ForwardProxyStatsNode,
  bucketRange: ForwardProxyBucketRange | null,
): ForwardProxyStatsNode {
  if (!bucketRange) return node
  return {
    ...node,
    last24h: normalizeActivityBuckets(node.last24h, bucketRange),
    weight24h: normalizeWeightBuckets(node.weight24h, bucketRange, node.weight),
  }
}

function summarizeActivity(node: ForwardProxyStatsNode): { success: number; failure: number } {
  return node.last24h.reduce(
    (accumulator, bucket) => {
      accumulator.success += bucket.successCount
      accumulator.failure += bucket.failureCount
      return accumulator
    },
    { success: 0, failure: 0 },
  )
}

function summarizeWeight(weight24h: ForwardProxyWeightBucket[]): {
  avgWeight: number | null
  minWeight: number | null
  maxWeight: number | null
  lastWeight: number | null
} {
  if (weight24h.length === 0) {
    return {
      avgWeight: null,
      minWeight: null,
      maxWeight: null,
      lastWeight: null,
    }
  }

  let totalSamples = 0
  let weightedTotal = 0
  let minWeight = Number.POSITIVE_INFINITY
  let maxWeight = Number.NEGATIVE_INFINITY

  for (const bucket of weight24h) {
    const sampleCount = Math.max(1, bucket.sampleCount)
    totalSamples += sampleCount
    weightedTotal += bucket.avgWeight * sampleCount
    minWeight = Math.min(minWeight, bucket.minWeight)
    maxWeight = Math.max(maxWeight, bucket.maxWeight)
  }

  const lastBucket = weight24h[weight24h.length - 1]
  return {
    avgWeight: totalSamples > 0 ? weightedTotal / totalSamples : null,
    minWeight: Number.isFinite(minWeight) ? minWeight : null,
    maxWeight: Number.isFinite(maxWeight) ? maxWeight : null,
    lastWeight: lastBucket?.lastWeight ?? null,
  }
}

function formatWeight(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return decimalFormatter.format(value)
}

function normalizeEntries(values: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    normalized.push(trimmed)
  }
  return normalized
}

function splitMultilineInput(value: string): string[] {
  return normalizeEntries(value.split(/\r?\n/))
}

function buildDraftFromSettings(settings: ForwardProxySettings | null): ForwardProxyDraft {
  return {
    proxyUrlsText: settings?.proxyUrls.join('\n') ?? '',
    subscriptionUrlsText: settings?.subscriptionUrls.join('\n') ?? '',
    subscriptionUpdateIntervalSecs: String(settings?.subscriptionUpdateIntervalSecs ?? 3600),
    insertDirect: settings?.insertDirect ?? true,
    egressSocks5Enabled: settings?.egressSocks5Enabled ?? false,
    egressSocks5Url: settings?.egressSocks5Url ?? '',
  }
}

function withDraftList(
  draft: ForwardProxyDraft,
  key: 'proxyUrlsText' | 'subscriptionUrlsText',
  values: string[],
): ForwardProxyDraft {
  return {
    ...draft,
    [key]: normalizeEntries(values).join('\n'),
  }
}

function extractProtocolName(value: string): string {
  const index = value.indexOf(':')
  if (index <= 0) return 'unknown'
  return value.slice(0, index)
}

function extractListDisplayName(value: string, fallback: string): string {
  const hashIndex = value.lastIndexOf('#')
  if (hashIndex >= 0 && hashIndex < value.length - 1) {
    try {
      return decodeURIComponent(value.slice(hashIndex + 1))
    } catch {
      return value.slice(hashIndex + 1)
    }
  }

  try {
    const url = new URL(value)
    if (url.hostname) {
      return url.port ? `${url.hostname}:${url.port}` : url.hostname
    }
  } catch {
    // Ignore parse failures for share links and fall back to the raw value.
  }

  return value.length > 72 ? `${value.slice(0, 69)}...` : value || fallback
}

function resolveWeightBuckets(node: ForwardProxyStatsNode): ForwardProxyWeightBucket[] {
  if (node.weight24h.length > 0) return node.weight24h
  if (node.last24h.length === 0) return []
  return node.last24h.map((bucket) => ({
    bucketStart: bucket.bucketStart,
    bucketEnd: bucket.bucketEnd,
    sampleCount: 0,
    minWeight: node.weight,
    maxWeight: node.weight,
    avgWeight: node.weight,
    lastWeight: node.weight,
  }))
}

interface WeightTrendScale { minValue: number; maxValue: number }

function formatErrorKind(kind: string): string { return kind.replaceAll('_', ' ') }

function getWindowColumnClassName(index: number): string {
  if (index === 1 || index === 2) return 'hidden min-w-[5.5rem] text-center md:table-cell'
  if (index === 3 || index === 4) return 'hidden min-w-[5.5rem] text-center xl:table-cell'
  return 'min-w-[5.5rem] text-center'
}

function RequestTrendCell({ buckets, scaleMax }: { buckets: ForwardProxyActivityBucket[]; scaleMax: number }): JSX.Element {
  if (!buckets.length) return <span>—</span>
  const data = buckets.map((bucket) => ({ label: formatTimeRange(bucket.bucketStart, bucket.bucketEnd), success: bucket.successCount, failure: bucket.failureCount }))
  return <ChartContainer config={{ success: { label: 'Success', color: 'var(--chart-1)' }, failure: { label: 'Failure', color: 'var(--chart-2)' } }} className="h-16 w-40 aspect-auto">
    <BarChart accessibilityLayer data={data}>
      <YAxis hide domain={[0, Math.max(scaleMax, 1)]} />
      <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload[0]?.payload.label} />} />
      <Bar dataKey="success" stackId="activity" fill="var(--color-success)" radius={2} />
      <Bar dataKey="failure" stackId="activity" fill="var(--color-failure)" radius={2} />
    </BarChart>
  </ChartContainer>
}

function formatErrorWindow(windowStats: ForwardProxyErrorWindowStats): JSX.Element {
  if (windowStats.totalCount <= 0) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <div className="flex flex-col items-center gap-0.5 py-1">
      <span>{formatPercent(windowStats.errorRate)}</span>
      <span className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
        {formatNumber(windowStats.errorCount)} / {formatNumber(windowStats.totalCount)}
      </span>
    </div>
  )
}

function ErrorActivityCell({ buckets }: { buckets: ForwardProxyErrorActivityBucket[] }): JSX.Element {
  if (!buckets.length) return <span>—</span>
  const kinds = [...new Set(buckets.flatMap((bucket) => bucket.errors.map((item) => item.kind)))].sort()
  const config: ChartConfig = { success: { label: 'Success', color: 'var(--chart-1)' } }
  kinds.forEach((kind, index) => { config[kind] = { label: formatErrorKind(kind), color: `var(--chart-${(index + 1) % 5 + 1})` } })
  const data = buckets.map((bucket) => ({ label: formatTimeRange(bucket.bucketStart, bucket.bucketEnd), success: bucket.successCount, ...Object.fromEntries(kinds.map((kind) => [kind, bucket.errors.find((item) => item.kind === kind)?.count ?? 0])) }))
  return <ChartContainer config={config} className="h-16 w-40 aspect-auto">
    <BarChart accessibilityLayer data={data}>
      <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload[0]?.payload.label} />} />
      <Bar dataKey="success" stackId="errors" fill="var(--color-success)" radius={2} />
      {kinds.map((kind) => <Bar key={kind} dataKey={kind} stackId="errors" fill={`var(--color-${kind})`} radius={2} />)}
    </BarChart>
  </ChartContainer>
}

function ErrorPieCell({ distribution }: { distribution: ForwardProxyErrorKindCount[] }): JSX.Element {
  if (!distribution.some((item) => item.count > 0)) return <span>—</span>
  const config = Object.fromEntries(distribution.map((item, index) => [item.kind, { label: formatErrorKind(item.kind), color: `var(--chart-${index % 5 + 1})` }])) satisfies ChartConfig
  const data = distribution.map((item) => ({ ...item, fill: `var(--color-${item.kind})` }))
  return <ChartContainer config={config} className="size-20 aspect-square">
    <PieChart accessibilityLayer>
      <ChartTooltip content={<ChartTooltipContent nameKey="kind" hideLabel />} />
      <Pie data={data} dataKey="count" nameKey="kind" />
    </PieChart>
  </ChartContainer>
}

function WeightTrendCell({ buckets, scale }: { buckets: ForwardProxyWeightBucket[]; scale: WeightTrendScale }): JSX.Element {
  if (!buckets.length) return <span>—</span>
  return <ChartContainer config={{ lastWeight: { label: 'Weight', color: 'var(--chart-1)' } }} className="h-16 w-40 aspect-auto">
    <AreaChart accessibilityLayer data={buckets.map((bucket) => ({ ...bucket, label: formatTimeRange(bucket.bucketStart, bucket.bucketEnd) }))}>
      <YAxis hide domain={[scale.minValue, scale.maxValue]} />
      <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload[0]?.payload.label} />} />
      <Area dataKey="lastWeight" type="natural" stroke="var(--color-lastWeight)" fill="var(--color-lastWeight)" fillOpacity={0.4} />
    </AreaChart>
  </ChartContainer>
}

function getSourceLabel(strings: AdminTranslations['proxySettings'], source: string): string {
  if (source === 'manual') return strings.sources.manual
  if (source === 'subscription') return strings.sources.subscription
  if (source === 'direct') return strings.sources.direct
  return strings.sources.unknown
}

type StatusBadgeVariant = 'success' | 'warning' | 'info' | 'neutral' | 'destructive'

function mapValidationErrorLabel(
  strings: AdminTranslations['proxySettings'],
  errorCode: string | null | undefined,
  message?: string | null | undefined,
): string {
  const normalizedMessage = cleanValidationMessage(message).toLowerCase()
  switch (errorCode) {
    case 'proxy_timeout':
      return strings.validation.timeout
    case 'proxy_unreachable':
      return strings.validation.unreachable
    case 'xray_missing':
      return strings.validation.xrayMissing
    case 'subscription_invalid':
      return strings.validation.subscriptionInvalid
    case 'subscription_unreachable':
      if (
        normalizedMessage.includes('resolved zero proxy entries')
        || normalizedMessage.includes('resolved 0 proxy entries')
        || normalizedMessage.includes('no proxy entries')
        || normalizedMessage.includes('contains no supported proxy entries')
      ) {
        return strings.validation.subscriptionInvalid
      }
      return strings.validation.subscriptionUnreachable
    default:
      return strings.validation.validationFailed
  }
}

function cleanValidationMessage(message: string | null | undefined): string {
  if (!message) return ''
  return message
    .replace(/(?:^|\s+)other error:\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatValidationMessage(
  strings: AdminTranslations['proxySettings'],
  result: ForwardProxyValidationResponse,
): string {
  const message = cleanValidationMessage(result.message)
  if (result.ok) {
    return message
  }

  if (result.errorCode === 'subscription_unreachable') {
    const normalized = message.toLowerCase()
    if (
      normalized.includes('timed out')
      || normalized.includes('no entry passed validation')
      || normalized.includes('validation timeout')
    ) {
      return strings.validation.subscriptionTimedOut
    }
    if (
      normalized.includes('resolved zero proxy entries')
      || normalized.includes('resolved 0 proxy entries')
      || normalized.includes('no proxy entries')
      || normalized.includes('did not resolve to any nodes')
    ) {
      return strings.validation.subscriptionNoNodes
    }
    if (
      normalized.includes('no supported proxy entries')
      || normalized.includes('unsupported proxy entries')
      || normalized.includes('unsupported nodes')
      || normalized.includes('did not contain supported nodes')
    ) {
      return strings.validation.subscriptionUnsupportedNodes
    }
    return strings.validation.subscriptionUnreachable
  }

  if (result.errorCode === 'subscription_invalid') {
    const normalized = message.toLowerCase()
    if (
      normalized.includes('resolved zero proxy entries')
      || normalized.includes('resolved 0 proxy entries')
      || normalized.includes('no proxy entries')
      || normalized.includes('did not resolve to any nodes')
    ) {
      return strings.validation.subscriptionNoNodes
    }
    if (
      normalized.includes('no supported proxy entries')
      || normalized.includes('unsupported proxy entries')
      || normalized.includes('unsupported nodes')
      || normalized.includes('did not contain supported nodes')
    ) {
      return strings.validation.subscriptionUnsupportedNodes
    }
    return strings.validation.subscriptionInvalid
  }

  return message || mapValidationErrorLabel(strings, result.errorCode, result.message)
}

export interface ForwardProxyValidationNodeRow {
  id: string
  displayName: string
  protocol: string
  ip: string | null
  location: string | null
  latencyMs: number | null
  status: 'pending' | 'probing' | 'ok' | 'failed'
  message: string
  entry?: ForwardProxyValidationEntry
}

export function canImportSubscriptionDuringValidation(
  rows: ForwardProxyValidationNodeRow[],
): boolean {
  return rows.some((row) => row.status === 'ok' || row.latencyMs != null)
}

function createPendingSubscriptionNodeRows(
  nodes: ForwardProxyProgressNodeState[],
): ForwardProxyValidationNodeRow[] {
  return nodes.map((node, index) => ({
    id: node.nodeKey || `subscription-node-${index + 1}`,
    displayName: node.displayName,
    protocol: node.protocol,
    ip: node.ip ?? null,
    location: node.location ?? null,
    latencyMs: node.latencyMs ?? null,
    status: node.status,
    message: node.message ?? '',
  }))
}

function updateSubscriptionNodeRows(
  rows: ForwardProxyValidationNodeRow[],
  node: ForwardProxyProgressNodeState,
): ForwardProxyValidationNodeRow[] {
  const nextStatus = node.status
  return rows.map((row) =>
    row.id !== node.nodeKey
      ? row
      : {
          ...row,
          displayName: node.displayName,
          protocol: node.protocol,
          ip: node.ip ?? row.ip,
          location: node.location ?? row.location,
          latencyMs: node.latencyMs ?? row.latencyMs,
          status: nextStatus,
          message: cleanValidationMessage(node.message ?? row.message),
        },
  )
}

function getValidationRowBadgeState(
  strings: AdminTranslations['proxySettings'],
  row: ForwardProxyValidationNodeRow,
): { label: string; variant: StatusBadgeVariant } {
  switch (row.status) {
    case 'ok':
      return { label: strings.validation.ok, variant: 'success' }
    case 'failed':
      return { label: strings.validation.failed, variant: 'destructive' }
    case 'probing':
      return { label: strings.progress.running, variant: 'info' }
    default:
      return { label: strings.progress.waiting, variant: 'neutral' }
  }
}

function getLatencyToneClass(latencyMs: number | null): string {
  if (latencyMs == null) return 'text-muted-foreground'
  if (latencyMs <= 150) return 'text-success'
  if (latencyMs <= 300) return 'text-warning'
  return 'text-destructive'
}

interface ForwardProxyStatusBubbleState {
  anchorEl: HTMLElement
  row: ForwardProxyValidationNodeRow
  pinned: boolean
}

function ForwardProxyStatusDetailBubble({
  strings,
  state,
  onClose,
  onPointerEnter,
  onPointerLeave,
}: {
  strings: AdminTranslations['proxySettings']
  state: ForwardProxyStatusBubbleState | null
  onClose: () => void
  onPointerEnter: () => void
  onPointerLeave: () => void
}): JSX.Element | null {
  const { layerRef: bubbleRef, position } = useAnchoredFloatingLayer<HTMLDivElement>({
    open: Boolean(state),
    anchorEl: state?.anchorEl ?? null,
    placement: 'right',
    align: 'center',
    offset: 10,
    viewportMargin: 12,
    arrowPadding: 18,
  })

  useEffect(() => {
    if (!state) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (bubbleRef.current?.contains(target)) return
      if (state.anchorEl.contains(target)) return
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, state])

  if (!state || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      ref={bubbleRef}
      className="forward-proxy-status-bubble fixed z-[1100] max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-auto layer-popover rounded-lg border bg-popover p-3 text-xs shadow-lg"
      role="dialog"
      aria-label={strings.config.resultDetails}
      data-placement={position?.placement ?? 'right'}
      style={{
        top: `${position?.top ?? 0}px`,
        left: `${position?.left ?? 0}px`,
        visibility: position ? 'visible' : 'hidden',
        pointerEvents: position ? 'auto' : 'none',
        ['--forward-proxy-status-bubble-arrow-offset' as string]: `${position?.arrowOffset ?? 24}px`,
      }}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
    >
      <div className="forward-proxy-status-bubble-header flex items-start justify-between gap-3">
        <strong className="forward-proxy-status-bubble-title">{strings.config.resultDetails}</strong>
        <button
          type="button"
          className="forward-proxy-status-bubble-close"
          onClick={onClose}
          aria-label={strings.config.closeDetails}
        >
          <Icon icon="mdi:close" className="text-sm" />
        </button>
      </div>
      <p className="forward-proxy-status-bubble-message mt-2 max-w-full break-words">{state.row.message}</p>
    </div>,
    document.body,
  )
}

export function buildValidationNodeRows(
  strings: AdminTranslations['proxySettings'],
  dialogIsSubscription: boolean,
  dialogResults: ForwardProxyValidationEntry[],
): ForwardProxyValidationNodeRow[] {
  if (dialogIsSubscription) {
    const result = dialogResults[0]?.result
    const nodes = result?.nodes ?? []
    if (nodes.length > 0) {
      return nodes.map((node, index) => ({
        id: `subscription-node-${index + 1}`,
        displayName:
          node.displayName
          || extractListDisplayName(
            result?.normalizedValue ?? '',
            strings.config.subscriptionItemFallback.replace('{index}', String(index + 1)),
          ),
        protocol: node.protocol || 'unknown',
        ip: node.ip ?? null,
        location: node.location ?? null,
        latencyMs: node.ok ? (node.latencyMs ?? null) : null,
        status: node.ok ? 'ok' : 'failed',
        message: cleanValidationMessage(node.message ?? result?.message ?? ''),
      }))
    }

    return []
  }

  return dialogResults.map((entry, index) => {
    const node = entry.result.nodes?.[0]
    return {
      id: entry.id,
      displayName:
        node?.displayName
        ?? extractListDisplayName(
          entry.result.normalizedValue ?? entry.value,
          strings.config.manualItemFallback.replace('{index}', String(index + 1)),
        ),
      protocol: node?.protocol ?? extractProtocolName(entry.result.normalizedValue ?? entry.value),
      ip: node?.ip ?? null,
      location: node?.location ?? null,
      latencyMs: entry.result.ok ? (node?.latencyMs ?? entry.result.latencyMs ?? null) : null,
      status: entry.result.ok ? 'ok' : 'failed',
      message: cleanValidationMessage(entry.result.message),
      entry,
    }
  })
}

export function resolveManualBatchButtonLabel(
  strings: AdminTranslations['proxySettings'],
  hasValidatedResults: boolean,
  availableCount: number,
): string {
  return hasValidatedResults && availableCount > 0
    ? strings.config.importAvailable.replace('{count}', formatNumber(availableCount))
    : strings.config.importInput
}

function ForwardProxyValidationNodeTable({
  strings,
  rows,
  dialogIsSubscription,
  previewMode,
  saving,
  onAddManualEntry,
}: {
  strings: AdminTranslations['proxySettings']
  rows: ForwardProxyValidationNodeRow[]
  dialogIsSubscription: boolean
  previewMode: boolean
  saving: boolean
  onAddManualEntry: (entry: ForwardProxyValidationEntry) => void
}): JSX.Element {
  const [detailBubble, setDetailBubble] = useState<ForwardProxyStatusBubbleState | null>(null)
  const closeTimerRef = useRef<number | null>(null)

  const clearCloseTimer = () => {
    if (closeTimerRef.current != null && typeof window !== 'undefined') {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const openDetailBubble = (
    row: ForwardProxyValidationNodeRow,
    anchorEl: HTMLElement,
    pinned: boolean,
  ) => {
    clearCloseTimer()
    setDetailBubble((current) => {
      if (pinned && current?.pinned && current.row.id === row.id) {
        return null
      }
      if (current?.pinned && !pinned && current.row.id !== row.id) {
        return current
      }
      return {
        anchorEl,
        row,
        pinned,
      }
    })
  }

  const scheduleClose = () => {
    if (typeof window === 'undefined') return
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setDetailBubble((current) => (current?.pinned ? current : null))
      closeTimerRef.current = null
    }, 100)
  }

  useEffect(() => () => clearCloseTimer(), [])

  if (rows.length === 0) {
    return (
      <div className="alert" role="status">
        {strings.validation.empty}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/35">
      <Table className="table-fixed text-xs">
        <TableHeader className="bg-muted/40 uppercase tracking-[0.08em] text-[11px] text-muted-foreground">
          <TableRow className="hover:bg-transparent">
            <TableHead>{strings.config.resultNode}</TableHead>
            <TableHead className="w-[26%]">{strings.config.resultNetwork}</TableHead>
            <TableHead className="w-[28%]">{strings.config.resultStatus}</TableHead>
            {!dialogIsSubscription && <TableHead className="w-24 text-right">{strings.config.resultAction}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="border-border/65 align-top">
              <TableCell className="min-w-0">
                <div className="flex flex-col gap-1">
                  <div className="truncate font-medium">{row.displayName}</div>
                  <span className="truncate text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    {(row.protocol || 'unknown').toUpperCase()}
                  </span>
                </div>
              </TableCell>
              <TableCell className="min-w-0">
                <div className="flex flex-col gap-1">
                  <span className="truncate font-mono text-[12px] font-medium text-foreground">{row.ip ?? '—'}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{row.location ?? '—'}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <Badge variant={getValidationRowBadgeState(strings, row).variant}>
                    {getValidationRowBadgeState(strings, row).label}
                  </Badge>
                  {row.latencyMs != null && (
                    <span className={`text-[11px] ${getLatencyToneClass(row.latencyMs)}`}>
                      {strings.validation.latency}: {formatLatency(row.latencyMs)}
                    </span>
                  )}
                  {row.status === 'failed' && row.message && (
                    <div className="flex w-full min-w-0 items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{row.message}</span>
                      <button
                        type="button"
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2"
                        aria-label={strings.config.resultDetails}
                        aria-expanded={detailBubble?.row.id === row.id}
                        onMouseEnter={(event) => openDetailBubble(row, event.currentTarget, false)}
                        onMouseLeave={scheduleClose}
                        onFocus={(event) => openDetailBubble(row, event.currentTarget, false)}
                        onBlur={scheduleClose}
                        onClick={(event) => openDetailBubble(row, event.currentTarget, true)}
                      >
                        <Icon icon="mdi:information-outline" className="text-sm" />
                      </button>
                    </div>
                  )}
                </div>
              </TableCell>
              {!dialogIsSubscription && (
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="xs"
                    onClick={() => row.entry && onAddManualEntry(row.entry)}
                    disabled={previewMode || row.status !== 'ok' || !row.entry || saving}
                  >
                    {strings.config.add}
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ForwardProxyStatusDetailBubble
        strings={strings}
        state={detailBubble}
        onClose={() => {
          clearCloseTimer()
          setDetailBubble(null)
        }}
        onPointerEnter={clearCloseTimer}
        onPointerLeave={scheduleClose}
      />
    </div>
  )
}

export function ForwardProxyCandidateDialog({
  strings,
  previewMode,
  dialogIsSubscription,
  dialogInput,
  dialogError,
  dialogValidating,
  dialogSaving,
  dialogResults,
  liveRows,
  canAddSubscription,
  canAddManualBatch,
  addManualBatchLabel,
  saving,
  progress,
  onClose,
  onCancelValidate,
  onInputChange,
  onValidate,
  onAddSubscription,
  onAddManualBatch,
  onAddManualEntry,
}: {
  strings: AdminTranslations['proxySettings']
  previewMode: boolean
  dialogIsSubscription: boolean
  dialogInput: string
  dialogError: string | null
  dialogValidating: boolean
  dialogSaving: boolean
  dialogResults: ForwardProxyValidationEntry[]
  liveRows: ForwardProxyValidationNodeRow[]
  canAddSubscription: boolean
  canAddManualBatch: boolean
  addManualBatchLabel: string
  saving: boolean
  progress: ForwardProxyDialogProgressState | null
  onClose: () => void
  onCancelValidate: () => void
  onInputChange: (value: string) => void
  onValidate: () => void
  onAddSubscription: () => void
  onAddManualBatch: () => void
  onAddManualEntry: (entry: ForwardProxyValidationEntry) => void
}): JSX.Element {
  const hasLiveSubscriptionRows = dialogIsSubscription && dialogValidating && liveRows.length > 0
  const showProgress =
    progress != null
    && !hasLiveSubscriptionRows
    && (progress.action === 'save' || dialogValidating || (progress.action === 'validate' && dialogResults.length === 0))
  const validationRows = hasLiveSubscriptionRows
    ? liveRows
    : buildValidationNodeRows(strings, dialogIsSubscription, dialogResults)

  return (
    <>
      <DialogHeader className="shrink-0 px-6 pt-6">
        <DialogTitle>
          {dialogIsSubscription ? strings.config.subscriptionDialogTitle : strings.config.manualDialogTitle}
        </DialogTitle>
        <DialogDescription>
          {dialogIsSubscription ? strings.config.subscriptionDialogDescription : strings.config.manualDialogDescription}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-4">
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground" htmlFor="forward-proxy-dialog-input">
              {dialogIsSubscription ? strings.config.subscriptionDialogInputLabel : strings.config.manualDialogInputLabel}
            </label>
            {dialogIsSubscription ? (
              <Input
                id="forward-proxy-dialog-input"
                type="url"
                name="subscription-source-url"
                value={dialogInput}
                readOnly={previewMode}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="url"
                data-1p-ignore="true"
                data-op-ignore="true"
                placeholder={strings.config.subscriptionsPlaceholder}
                onChange={(event) => onInputChange(event.target.value)}
              />
            ) : (
              <Textarea
                id="forward-proxy-dialog-input"
                name="manual-proxy-nodes"
                rows={7}
                value={dialogInput}
                readOnly={previewMode}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                data-1p-ignore="true"
                data-op-ignore="true"
                placeholder={strings.config.manualPlaceholder}
                onChange={(event) => onInputChange(event.target.value)}
              />
            )}
          </div>

          {dialogError && (
            <Alert className="" role="alert" variant="destructive"><AlertDescription>
              {dialogError}
            </AlertDescription></Alert>
          )}

          {dialogValidating && !progress && (
            <div className="alert" role="status">
              {strings.config.validating}
            </div>
          )}

          {showProgress && <ForwardProxyProgressBubble strings={strings} progress={progress} />}

          {dialogIsSubscription && dialogResults[0] && (
            <Card className="forward-proxy-validation-card">
              <CardContent className="forward-proxy-validation-card-content">
                <div className="forward-proxy-validation-head">
                  <Badge variant={dialogResults[0].result.ok ? 'success' : 'destructive'}>
                    {dialogResults[0].result.ok
                      ? strings.validation.ok
                      : mapValidationErrorLabel(
                        strings,
                        dialogResults[0].result.errorCode,
                        dialogResults[0].result.message,
                      )}
                  </Badge>
                  <Badge variant="outline">{strings.validation.subscriptionKind}</Badge>
                </div>
                <p className="forward-proxy-validation-message">
                  {formatValidationMessage(strings, dialogResults[0].result)}
                </p>
                <div className="forward-proxy-validation-meta">
                  <span>
                    {strings.validation.discoveredNodes}: {formatNumber(dialogResults[0].result.discoveredNodes ?? 0)}
                  </span>
                  <span>
                    {strings.validation.latency}: {formatLatency(dialogResults[0].result.latencyMs)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {validationRows.length > 0 && !showProgress && (
            <ForwardProxyValidationNodeTable
              strings={strings}
              rows={validationRows}
              dialogIsSubscription={dialogIsSubscription}
              previewMode={previewMode}
              saving={saving}
              onAddManualEntry={onAddManualEntry}
            />
          )}
        </div>
      </div>

      <DialogFooter className="mt-0 shrink-0 border-t border-border/70 bg-background/95 px-6 pb-6 pt-4 backdrop-blur supports-[backdrop-filter]:bg-background/88">
        <Button
          type="button"
          variant="ghost"
          onClick={dialogValidating ? onCancelValidate : onClose}
          disabled={previewMode || saving}
        >
          {strings.config.cancel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onValidate}
          disabled={previewMode || dialogValidating || saving}
        >
          {dialogValidating ? (
            <>
              <Icon icon="mdi:loading" className="animate-spin text-base" />
              <span>{dialogIsSubscription ? strings.progress.buttonValidatingSubscription : strings.progress.buttonValidatingManual}</span>
            </>
          ) : (
            strings.config.validate
          )}
        </Button>
        {dialogIsSubscription ? (
          <Button
            type="button"
            onClick={onAddSubscription}
            disabled={previewMode || !canAddSubscription || saving}
          >
            {dialogSaving ? (
              <>
                <Icon icon="mdi:loading" className="animate-spin text-base" />
                <span>{strings.progress.buttonAddingSubscription}</span>
              </>
            ) : (
              strings.config.add
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onAddManualBatch}
            disabled={previewMode || !canAddManualBatch || dialogValidating || saving}
          >
            {dialogSaving ? (
              <>
                <Icon icon="mdi:loading" className="animate-spin text-base" />
                <span>{strings.progress.buttonAddingManual}</span>
              </>
            ) : (
              addManualBatchLabel
            )}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

function getNodeStateBadge(
  strings: AdminTranslations['proxySettings'],
  node: ForwardProxyStatsNode,
): { label: string; variant: StatusBadgeVariant } {
  if (node.disabled) {
    return { label: strings.states.disabled, variant: 'neutral' }
  }
  if (node.source === 'direct') {
    return { label: strings.states.direct, variant: 'info' }
  }
  if (node.penalized) {
    return { label: strings.states.penalized, variant: 'warning' }
  }
  if (!node.available) {
    switch (node.lastError) {
      case 'proxy_timeout':
        return { label: strings.states.timeout, variant: 'destructive' }
      case 'proxy_unreachable':
        return { label: strings.states.unreachable, variant: 'destructive' }
      case 'xray_missing':
        return { label: strings.states.xrayMissing, variant: 'warning' }
      default:
        return { label: strings.states.unavailable, variant: 'neutral' }
    }
  }
  return { label: strings.states.ready, variant: 'success' }
}

export default function ForwardProxySettingsModule({
  strings,
  settings,
  stats,
  errorStats,
  settingsLoadState,
  statsLoadState,
  errorStatsLoadState,
  settingsError,
  statsError,
  errorStatsError,
  saveError,
  revalidateError,
  saving,
  revalidating,
  savedAt,
  revalidateProgress,
  egressPreviewProgress = null,
  onPersistDraft,
  onValidateCandidates,
  onRevalidate,
  onSetNodesDisabled,
  initialNodeView = 'pool',
  dialogPreview = null,
  onDialogPreviewClose,
}: ForwardProxySettingsModuleProps): JSX.Element {
  const mergedNodes = buildMergedNodes(settings, stats)
  const nodeRows = mergedNodes.map((node) => ({
    node,
    activity: summarizeActivity(node),
    weight: summarizeWeight(node.weight24h),
    weightBuckets: resolveWeightBuckets(node),
  }))
  const errorRows = [...(errorStats?.nodes ?? [])].sort((left, right) => {
    const leftRate = left.errorRate24h
    const rightRate = right.errorRate24h
    if (leftRate == null && rightRate == null) return left.displayName.localeCompare(right.displayName)
    if (leftRate == null) return 1
    if (rightRate == null) return -1
    return rightRate - leftRate || right.error24h - left.error24h || left.displayName.localeCompare(right.displayName)
  })
  const [nodeView, setNodeView] = useState<'pool' | 'errors'>(initialNodeView)
  const [selectedNodeKeys, setSelectedNodeKeys] = useState<Set<string>>(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const visibleNodeKeys = nodeView === 'errors'
    ? errorRows.map((node) => node.key)
    : nodeRows.map(({ node }) => node.key)
  const selectedVisibleCount = visibleNodeKeys.filter((key) => selectedNodeKeys.has(key)).length
  const selectedTotalCount = selectedNodeKeys.size
  const toggleNodeSelection = (proxyKey: string) => {
    setBulkError(null)
    setSelectedNodeKeys((current) => {
      const next = new Set(current)
      if (next.has(proxyKey)) {
        next.delete(proxyKey)
      } else {
        next.add(proxyKey)
      }
      return next
    })
  }
  const selectVisibleNodes = () => {
    setBulkError(null)
    setSelectedNodeKeys((current) => {
      const next = new Set(current)
      for (const key of visibleNodeKeys) next.add(key)
      return next
    })
  }
  const invertVisibleNodes = () => {
    setBulkError(null)
    setSelectedNodeKeys((current) => {
      const next = new Set(current)
      for (const key of visibleNodeKeys) {
        if (next.has(key)) {
          next.delete(key)
        } else {
          next.add(key)
        }
      }
      return next
    })
  }
  const applyBulkDisabled = async (disabled: boolean) => {
    if (!onSetNodesDisabled || selectedNodeKeys.size === 0) return
    setBulkBusy(true)
    setBulkError(null)
    try {
      await onSetNodesDisabled(Array.from(selectedNodeKeys), disabled)
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : strings.bulk.updateFailed)
    } finally {
      setBulkBusy(false)
    }
  }
  const requestBucketScaleMax = Math.max(
    ...nodeRows.flatMap(({ node }) => node.last24h.map((bucket) => bucket.successCount + bucket.failureCount)),
    0,
  )
  const allWeightValues = nodeRows.flatMap(({ weightBuckets }) =>
    weightBuckets.flatMap((bucket) => [bucket.minWeight, bucket.maxWeight, bucket.lastWeight]),
  )
  const minWeightValue = Math.min(...allWeightValues, 0)
  const maxWeightValue = Math.max(...allWeightValues, 0)
  const weightPadding = Math.max((maxWeightValue - minWeightValue) * 0.08, 0.2)
  const weightTrendScale: WeightTrendScale = {
    minValue: minWeightValue - weightPadding,
    maxValue: maxWeightValue + weightPadding,
  }
  const totalPrimaryAssignments = mergedNodes.reduce((sum, node) => sum + node.primaryAssignmentCount, 0)
  const totalSecondaryAssignments = mergedNodes.reduce((sum, node) => sum + node.secondaryAssignmentCount, 0)
  const penalizedCount = mergedNodes.filter((node) => node.penalized).length
  const readyCount = mergedNodes.filter((node) => node.available && !node.penalized).length
  const manualUrls = settings?.proxyUrls ?? []
  const subscriptionUrls = settings?.subscriptionUrls ?? []
  const draft = buildDraftFromSettings(settings)
  const [egressSocks5UrlDraft, setEgressSocks5UrlDraft] = useState(draft.egressSocks5Url)
  const [egressSocks5EnabledDraft, setEgressSocks5EnabledDraft] = useState(draft.egressSocks5Enabled)
  const [egressProgress, setEgressProgress] = useState<ForwardProxyDialogProgressState | null>(null)
  const [egressFieldError, setEgressFieldError] = useState<{ message: string; presentation: 'hint' | 'alert' } | null>(null)
  const [dialogKind, setDialogKind] = useState<ForwardProxyDialogKind>(null)
  const [dialogInput, setDialogInput] = useState('')
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [dialogValidating, setDialogValidating] = useState(false)
  const [dialogResults, setDialogResults] = useState<ForwardProxyValidationEntry[]>([])
  const [dialogLiveNodes, setDialogLiveNodes] = useState<ForwardProxyValidationNodeRow[]>([])
  const [dialogProgress, setDialogProgress] = useState<ForwardProxyDialogProgressState | null>(null)
  const dialogValidationAbortRef = useRef<AbortController | null>(null)
  const isDialogPreview = dialogPreview != null
  const activeDialogKind = dialogPreview?.kind ?? dialogKind
  const activeDialogInput = dialogPreview?.input ?? dialogInput
  const activeDialogError = dialogPreview?.error ?? dialogError
  const activeDialogValidating = dialogPreview?.validating ?? dialogValidating
  const activeDialogResults = dialogPreview?.results ?? dialogResults
  const activeDialogLiveNodes = dialogPreview == null ? dialogLiveNodes : []
  const activeDialogProgress = dialogPreview?.progress ?? dialogProgress
  const dialogIsSubscription = activeDialogKind === 'subscription'
  const dialogAvailableResults = activeDialogResults.filter((entry) => entry.result.ok)
  const dialogInputValues = dialogIsSubscription
    ? normalizeEntries([activeDialogInput])
    : splitMultilineInput(activeDialogInput)
  const dialogHasValidatedResults = activeDialogResults.length > 0
  const dialogSubscriptionCandidate =
    dialogAvailableResults[0]?.result.normalizedValue ?? dialogAvailableResults[0]?.value ?? dialogInputValues[0] ?? null
  const dialogHasLiveImportableSubscription = dialogIsSubscription
    && activeDialogValidating
    && canImportSubscriptionDuringValidation(activeDialogLiveNodes)
  const dialogCanSkipBootstrapProbe = dialogIsSubscription
    && dialogHasValidatedResults
    && activeDialogResults.length === 1
    && activeDialogResults[0]?.result.ok === true
    && dialogInputValues.length === 1
    && dialogSubscriptionCandidate != null
    && dialogSubscriptionCandidate === dialogInputValues[0]
  const dialogManualBatchValues = dialogHasValidatedResults && dialogAvailableResults.length > 0
    ? normalizeEntries([
        ...manualUrls,
        ...dialogAvailableResults.map((entry) => entry.result.normalizedValue ?? entry.value),
      ])
    : normalizeEntries([...manualUrls, ...dialogInputValues])
  const controlsDisabled = saving || revalidating
  const activeEgressProgress = egressPreviewProgress ?? egressProgress
  const egressInputLocked = settings?.egressSocks5Enabled ?? false
  const egressDraftDirty =
    egressSocks5UrlDraft.trim() !== draft.egressSocks5Url.trim()
    || egressSocks5EnabledDraft !== draft.egressSocks5Enabled
  const egressApplyBusy = activeEgressProgress?.action === 'save'
  useEffect(() => {
    const knownKeys = new Set([
      ...mergedNodes.map((node) => node.key),
      ...errorRows.map((node) => node.key),
    ])
    setSelectedNodeKeys((current) => {
      const next = new Set(Array.from(current).filter((key) => knownKeys.has(key)))
      return next.size === current.size ? current : next
    })
  }, [mergedNodes, errorRows])
  const canAddSubscription = dialogSubscriptionCandidate != null
    && (!activeDialogValidating || dialogHasLiveImportableSubscription)
  const canAddManualBatch = dialogManualBatchValues.length > manualUrls.length
  const addManualBatchLabel = resolveManualBatchButtonLabel(
    strings,
    dialogHasValidatedResults,
    dialogAvailableResults.length,
  )
  const dialogIsSaving = activeDialogProgress?.action === 'save' ? (saving || isDialogPreview) : false
  const selectedInterval =
    FORWARD_PROXY_INTERVAL_OPTIONS.find(
      (option) => option.value === String(settings?.subscriptionUpdateIntervalSecs ?? 3600),
    )?.value ?? '3600'

  useEffect(() => {
    setEgressSocks5UrlDraft(draft.egressSocks5Url)
    setEgressSocks5EnabledDraft(draft.egressSocks5Enabled)
    setEgressFieldError(null)
  }, [draft.egressSocks5Enabled, draft.egressSocks5Url])

  const summaryCards = [
    {
      key: 'nodes',
      label: strings.summary.configuredNodes,
      value: formatNumber(mergedNodes.length),
      hint: strings.summary.configuredNodesHint,
    },
    {
      key: 'ready',
      label: strings.summary.readyNodes,
      value: formatNumber(readyCount),
      hint: strings.summary.readyNodesHint,
    },
    {
      key: 'penalized',
      label: strings.summary.penalizedNodes,
      value: formatNumber(penalizedCount),
      hint: strings.summary.penalizedNodesHint,
    },
    {
      key: 'subscriptions',
      label: strings.summary.subscriptions,
      value: formatNumber(subscriptionUrls.length),
      hint: strings.summary.subscriptionsHint,
    },
    {
      key: 'manual',
      label: strings.summary.manualNodes,
      value: formatNumber(manualUrls.length),
      hint: strings.summary.manualNodesHint,
    },
    {
      key: 'assignments',
      label: strings.summary.assignmentSpread,
      value: `${formatNumber(totalPrimaryAssignments)} / ${formatNumber(totalSecondaryAssignments)}`,
      hint: strings.summary.assignmentSpreadHint,
    },
  ]

  const openDialog = (kind: Exclude<ForwardProxyDialogKind, null>) => {
    if (isDialogPreview) return
    dialogValidationAbortRef.current?.abort()
    dialogValidationAbortRef.current = null
    setDialogKind(kind)
    setDialogInput('')
    setDialogError(null)
    setDialogResults([])
    setDialogLiveNodes([])
    setDialogProgress(null)
  }

  const closeDialog = () => {
    if (controlsDisabled) return
    if (dialogValidating) {
      dialogValidationAbortRef.current?.abort()
      dialogValidationAbortRef.current = null
    }
    if (isDialogPreview) {
      onDialogPreviewClose?.()
      return
    }
    setDialogKind(null)
    setDialogInput('')
    setDialogError(null)
    setDialogResults([])
    setDialogLiveNodes([])
    setDialogProgress(null)
  }

  const cancelDialogValidation = () => {
    dialogValidationAbortRef.current?.abort()
    dialogValidationAbortRef.current = null
    setDialogValidating(false)
    setDialogProgress(null)
    setDialogResults([])
    setDialogLiveNodes([])
    setDialogError(strings.validation.cancelled)
  }

  const persistDraft = async (
    nextDraft: ForwardProxyDraft,
    onProgress?: (event: ForwardProxyProgressEvent) => void,
    options?: ForwardProxyPersistOptions,
  ) => {
    setDialogError(null)
    await onPersistDraft(nextDraft, onProgress, options)
  }

  const persistManualUrls = async (
    nextManualUrls: string[],
    onProgress?: (event: ForwardProxyProgressEvent) => void,
  ) => {
    await persistDraft(withDraftList(draft, 'proxyUrlsText', nextManualUrls), onProgress)
  }

  const persistSubscriptionUrls = async (
    nextSubscriptionUrls: string[],
    onProgress?: (event: ForwardProxyProgressEvent) => void,
    options?: ForwardProxyPersistOptions,
  ) => {
    await persistDraft(withDraftList(draft, 'subscriptionUrlsText', nextSubscriptionUrls), onProgress, options)
  }

  const handleRemoveManual = async (value: string) => {
    try {
      await persistManualUrls(manualUrls.filter((candidate) => candidate !== value))
    } catch {
      // Parent state already exposes the error banner.
    }
  }

  const handleRemoveSubscription = async (value: string) => {
    try {
      await persistSubscriptionUrls(subscriptionUrls.filter((candidate) => candidate !== value))
    } catch {
      // Parent state already exposes the error banner.
    }
  }

  const handleIntervalChange = async (value: string) => {
    try {
      await persistDraft({
        ...draft,
        subscriptionUpdateIntervalSecs: value,
      })
    } catch {
      // Parent state already exposes the error banner.
    }
  }

  const handleInsertDirectChange = async (checked: boolean) => {
    try {
      await persistDraft({
        ...draft,
        insertDirect: checked,
      })
    } catch {
      // Parent state already exposes the error banner.
    }
  }

  const handleToggleEgress = async (nextChecked: boolean) => {
    const localValidationError = validateEgressUrl(strings, egressSocks5UrlDraft)
    if (nextChecked && localValidationError) {
      setEgressFieldError({
        message: localValidationError,
        presentation: 'alert',
      })
      setEgressSocks5EnabledDraft(false)
      return
    }

    setEgressFieldError(null)
    setEgressSocks5EnabledDraft(nextChecked)
    try {
      setEgressProgress(
        createDialogProgressState(strings.progress, 'egress', 'save', {
          includeEgressValidation: nextChecked,
        }),
      )
      await persistDraft(
        {
          ...draft,
          egressSocks5Enabled: nextChecked,
          egressSocks5Url: egressSocks5UrlDraft.trim(),
        },
        (event) => {
          const normalizedEvent =
            event.type === 'error'
              ? {
                  ...event,
                  message: normalizeEgressErrorMessage(
                    strings,
                    event.message || event.detail || strings.config.egressUnknownError,
                  ),
                  detail: normalizeEgressErrorMessage(
                    strings,
                    event.detail || event.message || strings.config.egressUnknownError,
                  ),
                }
              : event

          if (normalizedEvent.type === 'error') {
            setEgressFieldError({
              message: normalizedEvent.message,
              presentation: 'alert',
            })
          }
          setEgressProgress((current) => {
            const base =
              current
              ?? createDialogProgressState(strings.progress, 'egress', 'save', {
                includeEgressValidation: nextChecked,
              })
            return updateDialogProgressState(base, strings.progress, normalizedEvent)
          })
        },
      )
    } catch {
      setEgressFieldError((current) => current ?? {
        message: normalizeEgressErrorMessage(strings, saveError || strings.config.egressUnknownError),
        presentation: 'alert',
      })
      setEgressSocks5EnabledDraft(draft.egressSocks5Enabled)
    }
  }

  const handleValidateDialog = async () => {
    if (isDialogPreview) return
    const values = dialogInputValues
    if (values.length === 0) {
      setDialogResults([])
      setDialogError(
        dialogIsSubscription ? strings.validation.emptySubscriptions : strings.validation.emptyManual,
      )
      return
    }

    setDialogError(null)
    setDialogValidating(true)
    setDialogLiveNodes([])
    setDialogProgress(createDialogProgressState(strings.progress, dialogIsSubscription ? 'subscription' : 'manual', 'validate'))
    dialogValidationAbortRef.current?.abort()
    const controller = new AbortController()
    dialogValidationAbortRef.current = controller
    try {
      const kind: ForwardProxyValidationKind = dialogIsSubscription ? 'subscriptionUrl' : 'proxyUrl'
      const results = await onValidateCandidates(
        kind,
        values,
        (event) => {
          if (dialogIsSubscription) {
            if (event.type === 'nodes') {
              setDialogLiveNodes(createPendingSubscriptionNodeRows(event.nodes))
            } else if (event.type === 'node') {
              setDialogLiveNodes((current) => updateSubscriptionNodeRows(current, event.node))
            }
          }
          setDialogProgress((current) => {
            const base =
              current
              ?? createDialogProgressState(strings.progress, dialogIsSubscription ? 'subscription' : 'manual', 'validate')
            return updateDialogProgressState(base, strings.progress, event)
          })
        },
        controller.signal,
      )
      if (controller.signal.aborted) {
        return
      }
      setDialogResults(results)
      if (results.length === 0) {
        setDialogError(strings.validation.requestFailed)
      }
    } catch (err) {
      if (controller.signal.aborted || (err as Error).name === 'AbortError') {
        return
      }
      setDialogResults([])
      setDialogLiveNodes([])
      setDialogError(err instanceof Error ? err.message : strings.validation.requestFailed)
    } finally {
      if (dialogValidationAbortRef.current === controller) {
        dialogValidationAbortRef.current = null
      }
      setDialogValidating(false)
    }
  }

  const handleAddSubscription = async () => {
    if (isDialogPreview) return
    if (!dialogSubscriptionCandidate) return
    try {
      if (dialogValidating) {
        dialogValidationAbortRef.current?.abort()
        dialogValidationAbortRef.current = null
        setDialogValidating(false)
        setDialogProgress(null)
      }
      setDialogProgress(createDialogProgressState(strings.progress, 'subscription', 'save'))
      await persistSubscriptionUrls(
        [...subscriptionUrls, dialogSubscriptionCandidate],
        (event) => {
          setDialogProgress((current) => {
            const base = current ?? createDialogProgressState(strings.progress, 'subscription', 'save')
            return updateDialogProgressState(base, strings.progress, event)
          })
        },
        {
          skipBootstrapProbe: dialogCanSkipBootstrapProbe,
        },
      )
      closeDialog()
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : strings.config.saveFailed)
    }
  }

  const handleAddManualBatch = async () => {
    if (isDialogPreview) return
    if (dialogManualBatchValues.length === manualUrls.length) return
    try {
      setDialogProgress(createDialogProgressState(strings.progress, 'manual', 'save'))
      await persistManualUrls(dialogManualBatchValues, (event) => {
        setDialogProgress((current) => {
          const base = current ?? createDialogProgressState(strings.progress, 'manual', 'save')
          return updateDialogProgressState(base, strings.progress, event)
        })
      })
      closeDialog()
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : strings.config.saveFailed)
    }
  }

  const handleAddManualEntry = async (entry: ForwardProxyValidationEntry) => {
    if (isDialogPreview) return
    const nextValue = entry.result.normalizedValue ?? entry.value
    try {
      setDialogError(null)
      setDialogProgress(createDialogProgressState(strings.progress, 'manual', 'save'))
      await persistManualUrls([...manualUrls, nextValue], (event) => {
        setDialogProgress((current) => {
          const base = current ?? createDialogProgressState(strings.progress, 'manual', 'save')
          return updateDialogProgressState(base, strings.progress, event)
        })
      })
      setDialogResults((previous) =>
        previous.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                result: {
                  ...item.result,
                  message: strings.config.addedToList,
                },
              }
            : item,
        ),
      )
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : strings.config.saveFailed)
    }
  }

  useEffect(() => () => {
    dialogValidationAbortRef.current?.abort()
  }, [])

  return (
    <div className="forward-proxy-stack flex min-w-0 flex-col gap-6">
      <Card className="surface panel forward-proxy-summary-panel">
        <CardHeader className="forward-proxy-panel-header flex flex-wrap items-start justify-between gap-3 border-b px-4 pb-4 forward-proxy-summary-header">
          <div className="forward-proxy-panel-heading text-base font-semibold forward-proxy-panel-heading--compact">
            <CardTitle>{strings.summary.range}</CardTitle>
            <CardDescription className="panel-description text-sm text-muted-foreground">
              {formatTimeRange(stats?.rangeStart, stats?.rangeEnd)}
            </CardDescription>
          </div>
          <div className="forward-proxy-panel-meta flex flex-wrap items-center gap-2">
            <div className="forward-proxy-toolbar">
              <Button type="button" variant="outline" onClick={onRevalidate} disabled={saving || revalidating}>
                {revalidating ? strings.actions.validatingSubscriptions : strings.actions.validateSubscriptions}
              </Button>
            </div>
            <div className="forward-proxy-range-row">
              {savedAt != null && (
                <span className="panel-description text-sm text-muted-foreground">
                  {strings.summary.savedAt.replace('{time}', dateTimeFormatter.format(new Date(savedAt)))}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="forward-proxy-panel-content flex flex-col gap-4 p-4 forward-proxy-summary-content">
          {revalidateError && (
            <div className="mb-4 alert border-destructive/30 bg-destructive/10 text-destructive" role="alert">
              {revalidateError}
            </div>
          )}
          {revalidateProgress && (
            <div className="mb-4">
              <ForwardProxyProgressBubble strings={strings} progress={revalidateProgress} />
            </div>
          )}
          <div className="forward-proxy-summary-grid grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {summaryCards.map((card) => (
              <Card key={card.key} className="forward-proxy-summary-card">
                <CardContent className="forward-proxy-summary-card-content flex min-w-0 flex-col gap-2">
                  <span className="forward-proxy-summary-label text-xs text-muted-foreground">{card.label}</span>
                  <strong className="forward-proxy-summary-value text-xl font-semibold tabular-nums">{card.value}</strong>
                  <span className="forward-proxy-summary-hint text-xs text-muted-foreground">{card.hint}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="surface panel">
        <CardHeader className="forward-proxy-panel-header flex flex-wrap items-start justify-between gap-3 border-b px-4 pb-4">
          <div className="forward-proxy-panel-heading text-base font-semibold">
            <CardTitle>{strings.nodes.title}</CardTitle>
            <CardDescription className="panel-description text-sm text-muted-foreground">{strings.nodes.description}</CardDescription>
          </div>
          <SegmentedTabs<'pool' | 'errors'>
            className="forward-proxy-view-switcher"
            value={nodeView}
            onChange={setNodeView}
            ariaLabel={strings.nodes.viewSwitcherLabel}
            collapseMode="never"
            options={[{ value: 'pool', label: strings.nodes.views.pool }, { value: 'errors', label: strings.nodes.views.errors }]}
          />
        </CardHeader>
        <CardContent className="forward-proxy-panel-content flex flex-col gap-4 p-4">
          {statsError && (
            <Alert className="" role="alert" variant="destructive"><AlertDescription>
              {statsError}
            </AlertDescription></Alert>
          )}
          {nodeView === 'errors' && errorStatsError && (
            <Alert className="" role="alert" variant="destructive"><AlertDescription>
              {errorStatsError}
            </AlertDescription></Alert>
          )}
          {bulkError && (
            <Alert className="" role="alert" variant="destructive"><AlertDescription>
              {bulkError}
            </AlertDescription></Alert>
          )}

          {nodeView === 'pool' ? (
            <AdminLoadingRegion
              loadState={statsLoadState}
              loadingLabel={strings.nodes.loading}
              errorLabel={statsError || undefined}
              minHeight={240}
            >
            {mergedNodes.length === 0 ? (
              <Empty className="empty-state"><EmptyDescription>{strings.nodes.empty}</EmptyDescription></Empty>
            ) : (
              <>
                <div className="forward-proxy-node-list-mobile flex flex-col gap-3 md:hidden">
                  {nodeRows.map(({ node, activity, weight }) => {
                    const stateBadge = getNodeStateBadge(strings, node)
                    return (
                      <Card className="forward-proxy-node-mobile-card" key={`mobile-${node.key}`}>
                        <CardHeader className="forward-proxy-node-mobile-header">
                          <div className="forward-proxy-node-mobile-title-row flex items-center gap-3">
                            <Checkbox
                              aria-label={`${strings.bulk.selectRow} ${node.displayName}`}
                              checked={selectedNodeKeys.has(node.key)}
                              className="forward-proxy-row-checkbox size-4"
                              onCheckedChange={() => toggleNodeSelection(node.key)}
                            />
                            <CardTitle className="text-base">{node.displayName}</CardTitle>
                          </div>
                          <div className="forward-proxy-node-chip-row flex flex-wrap items-center gap-1.5">
                            <span className="forward-proxy-node-chip-text text-xs">
                              {strings.nodes.primary}: <strong>{formatNumber(node.primaryAssignmentCount)}</strong>
                            </span>
                            <span className="forward-proxy-node-chip-text text-xs">
                              {strings.nodes.secondary}: <strong>{formatNumber(node.secondaryAssignmentCount)}</strong>
                            </span>
                            <Badge variant={node.source === 'subscription' ? 'info' : node.source === 'manual' ? 'outline' : 'neutral'}>
                              {getSourceLabel(strings, node.source)}
                            </Badge>
                            <Badge variant={stateBadge.variant}>{stateBadge.label}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="forward-proxy-node-mobile-content flex min-w-0 flex-col gap-3">
                          <div className="forward-proxy-node-mobile-grid grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="forward-proxy-node-mobile-block flex min-w-0 flex-col gap-1 text-xs">
                              <span className="forward-proxy-node-metric-label text-xs text-muted-foreground">{strings.nodes.table.activity24h}</span>
                              <span>
                                {strings.nodes.successCountLabel}: <strong>{formatNumber(activity.success)}</strong>
                              </span>
                              <span>
                                {strings.nodes.failureCountLabel}: <strong>{formatNumber(activity.failure)}</strong>
                              </span>
                            </div>
                            <div className="forward-proxy-node-mobile-block flex min-w-0 flex-col gap-1 text-xs">
                              <span className="forward-proxy-node-metric-label text-xs text-muted-foreground">{strings.nodes.table.weight24h}</span>
                              <span>
                                {strings.nodes.lastWeightLabel}: <strong>{formatDecimal(weight.lastWeight)}</strong>
                              </span>
                              <span>
                                {strings.nodes.avgWeightLabel}: <strong>{formatDecimal(weight.avgWeight)}</strong>
                              </span>
                              <span>
                                {strings.nodes.minMaxWeightLabel}: <strong>{`${formatDecimal(weight.minWeight)} / ${formatDecimal(weight.maxWeight)}`}</strong>
                              </span>
                            </div>
                          </div>

                          <div className="forward-proxy-window-grid grid min-w-0 grid-cols-2 gap-2">
                            {WINDOW_KEYS.map((windowDefinition) => {
                              const statsForWindow = node.stats[windowDefinition.key]
                              return (
                                <Card className="forward-proxy-window-card" key={`${node.key}-${windowDefinition.key}`}>
                                  <CardContent className="forward-proxy-window-card-content flex min-w-0 flex-col gap-1">
                                    <span className="forward-proxy-window-label text-xs text-muted-foreground">{strings.windows[windowDefinition.translationKey]}</span>
                                    <strong>{formatPercent(computeSuccessRate(statsForWindow))}</strong>
                                    <span>{formatLatency(statsForWindow.avgLatencyMs)}</span>
                                  </CardContent>
                                </Card>
                              )
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                <div className="forward-proxy-table-wrapper hidden min-w-0 md:block rounded-2xl border border-border/75 bg-card/50">
                  <Table className="forward-proxy-table min-w-[980px] table-fixed text-xs xl:min-w-0">
                    <TableHeader className="bg-muted/40 uppercase tracking-[0.08em] text-[11px] text-muted-foreground">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-10">
                          <span className="sr-only">{strings.bulk.selection}</span>
                        </TableHead>
                        <TableHead className="w-[30%]">{strings.nodes.table.node}</TableHead>
                        {WINDOW_KEYS.map((windowDefinition, index) => (
                          <TableHead
                            className={`${getWindowColumnClassName(index)} forward-proxy-table-head-nowrap whitespace-nowrap`}
                            key={`head-${windowDefinition.key}`}
                          >
                            {strings.windows[windowDefinition.translationKey]}
                          </TableHead>
                        ))}
                        <TableHead className="w-[18%] forward-proxy-table-head-nowrap whitespace-nowrap">
                          {strings.nodes.table.activity24h}
                        </TableHead>
                        <TableHead className="w-[18%] forward-proxy-table-head-nowrap whitespace-nowrap">
                          {strings.nodes.table.weight24h}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border/65 [&_tr:last-child]:border-0">
                      {nodeRows.map(({ node, activity, weight, weightBuckets }) => {
                        const stateBadge = getNodeStateBadge(strings, node)
                        return (
                          <TableRow key={node.key} className="forward-proxy-table-row border-0 align-top">
                            <TableCell className="py-3">
                              <Checkbox
                                aria-label={`${strings.bulk.selectRow} ${node.displayName}`}
                                checked={selectedNodeKeys.has(node.key)}
                                className="forward-proxy-row-checkbox size-4"
                                onCheckedChange={() => toggleNodeSelection(node.key)}
                              />
                            </TableCell>
                            <TableCell className="forward-proxy-node-cell py-3">
                              <div className="forward-proxy-node-cell-main min-w-0">
                                <div className="forward-proxy-node-cell-title-row flex min-w-0 items-center gap-2">
                                  <strong className="truncate text-sm">{node.displayName}</strong>
                                </div>
                                <div className="forward-proxy-node-chip-row flex flex-wrap items-center gap-1.5">
                                  <span className="forward-proxy-node-chip-text text-xs">
                                    {strings.nodes.primary}: <strong>{formatNumber(node.primaryAssignmentCount)}</strong>
                                  </span>
                                  <span className="forward-proxy-node-chip-text text-xs">
                                    {strings.nodes.secondary}: <strong>{formatNumber(node.secondaryAssignmentCount)}</strong>
                                  </span>
                                  <Badge variant={node.source === 'subscription' ? 'info' : node.source === 'manual' ? 'outline' : 'neutral'}>
                                    {getSourceLabel(strings, node.source)}
                                  </Badge>
                                  <Badge variant={stateBadge.variant}>{stateBadge.label}</Badge>
                                </div>
                              </div>
                            </TableCell>
                            {WINDOW_KEYS.map((windowDefinition, index) => {
                              const statsForWindow = node.stats[windowDefinition.key]
                              return (
                                <TableCell className={getWindowColumnClassName(index)} key={`${node.key}-${windowDefinition.key}`}>
                                  <div className="flex flex-col items-center gap-0.5 py-1">
                                    <span>{formatPercent(computeSuccessRate(statsForWindow))}</span>
                                    <span className="text-[11px] text-muted-foreground">{formatLatency(statsForWindow.avgLatencyMs)}</span>
                                  </div>
                                </TableCell>
                              )
                            })}
                            <TableCell className="py-3">
                              <div className="flex flex-col gap-2">
                                <RequestTrendCell buckets={node.last24h} scaleMax={requestBucketScaleMax} />
                                <div className="text-[11px] text-muted-foreground">
                                  {strings.nodes.successCountLabel}: <strong>{formatNumber(activity.success)}</strong>
                                  {' · '}
                                  {strings.nodes.failureCountLabel}: <strong>{formatNumber(activity.failure)}</strong>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="flex flex-col gap-2">
                                <WeightTrendCell buckets={weightBuckets} scale={weightTrendScale} />
                                <div className="text-[11px] text-muted-foreground">
                                  {strings.nodes.lastWeightLabel}: <strong>{formatWeight(weight.lastWeight)}</strong>
                                  {' · '}
                                  {strings.nodes.avgWeightLabel}: <strong>{formatWeight(weight.avgWeight)}</strong>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            </AdminLoadingRegion>
          ) : (
            <AdminLoadingRegion
              loadState={errorStatsLoadState}
              loadingLabel={strings.nodes.errorStats.loading}
              errorLabel={errorStatsError || undefined}
              minHeight={240}
            >
              {errorRows.length === 0 ? (
                <Empty className="empty-state"><EmptyDescription>{strings.nodes.errorStats.empty}</EmptyDescription></Empty>
              ) : (
                <div className="forward-proxy-table-wrapper rounded-2xl border border-border/75 bg-card/50">
                  <Table className="forward-proxy-table min-w-[1080px] table-fixed text-xs xl:min-w-0">
                    <TableHeader className="bg-muted/40 uppercase tracking-[0.08em] text-[11px] text-muted-foreground">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-10">
                          <span className="sr-only">{strings.bulk.selection}</span>
                        </TableHead>
                        <TableHead className="w-[34%]">{strings.nodes.table.node}</TableHead>
                        {WINDOW_KEYS.map((windowDefinition, index) => (
                          <TableHead
                            className={`${getWindowColumnClassName(index)} forward-proxy-table-head-nowrap whitespace-nowrap`}
                            key={`error-head-${windowDefinition.key}`}
                          >
                            {strings.windows[windowDefinition.translationKey]}
                          </TableHead>
                        ))}
                        <TableHead className="w-[20%] forward-proxy-table-head-nowrap whitespace-nowrap">
                          {strings.nodes.errorStats.activity24h}
                        </TableHead>
                        <TableHead className="w-[18%] forward-proxy-table-head-nowrap whitespace-nowrap">
                          {strings.nodes.errorStats.distribution24h}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border/65 [&_tr:last-child]:border-0">
                      {errorRows.map((node) => (
                        <TableRow key={node.key} className="forward-proxy-table-row border-0 align-top">
                          <TableCell className="py-3">
                            <Checkbox
                              aria-label={`${strings.bulk.selectRow} ${node.displayName}`}
                              checked={selectedNodeKeys.has(node.key)}
                              className="forward-proxy-row-checkbox size-4"
                              onCheckedChange={() => toggleNodeSelection(node.key)}
                            />
                          </TableCell>
                          <TableCell className="forward-proxy-node-cell py-3">
                            <div className="forward-proxy-node-cell-main min-w-0">
                              <div className="forward-proxy-node-cell-title-row flex min-w-0 items-center gap-2">
                                <strong className="truncate text-sm">{node.displayName}</strong>
                              </div>
                              <div className="forward-proxy-node-chip-row flex flex-wrap items-center gap-1.5">
                                <Badge variant={node.source === 'subscription' ? 'info' : node.source === 'manual' ? 'outline' : 'neutral'}>
                                  {getSourceLabel(strings, node.source)}
                                </Badge>
                                {node.disabled && <Badge variant="neutral">{strings.states.disabled}</Badge>}
                                <span className="forward-proxy-node-chip-text text-xs">
                                  {strings.nodes.errorStats.total24h}: <strong>{formatNumber(node.total24h)}</strong>
                                </span>
                                <span className="forward-proxy-node-chip-text text-xs">
                                  {strings.nodes.errorStats.error24h}: <strong>{formatNumber(node.error24h)}</strong>
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          {WINDOW_KEYS.map((windowDefinition, index) => (
                            <TableCell className={getWindowColumnClassName(index)} key={`${node.key}-error-${windowDefinition.key}`}>
                              {formatErrorWindow(node.windows[windowDefinition.key])}
                            </TableCell>
                          ))}
                          <TableCell className="py-3">
                            <ErrorActivityCell buckets={node.last24h} />
                          </TableCell>
                          <TableCell className="py-3">
                            <ErrorPieCell distribution={node.distribution24h} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </AdminLoadingRegion>
          )}
          {visibleNodeKeys.length > 0 && (
            <div className={`forward-proxy-bulk-bar flex flex-wrap items-center gap-2 rounded-lg border p-3 ${selectedTotalCount > 0 ? '' : 'hidden'}`} aria-live="polite">
              <span className="forward-proxy-bulk-count">
                {strings.bulk.selected.replace('{count}', formatNumber(selectedTotalCount))}
              </span>
              <Button type="button" size="sm" variant="outline" onClick={selectVisibleNodes} disabled={bulkBusy}>
                {strings.bulk.selectAll}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={invertVisibleNodes} disabled={bulkBusy}>
                {strings.bulk.invert}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void applyBulkDisabled(true)}
                disabled={bulkBusy || selectedTotalCount === 0 || !onSetNodesDisabled}
              >
                {strings.bulk.disable}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void applyBulkDisabled(false)}
                disabled={bulkBusy || selectedTotalCount === 0 || !onSetNodesDisabled}
              >
                {strings.bulk.enable}
              </Button>
              <span className="forward-proxy-bulk-scope">
                {strings.bulk.visibleSelected.replace('{count}', formatNumber(selectedVisibleCount))}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="surface panel">
        <CardHeader className="forward-proxy-panel-header flex flex-wrap items-start justify-between gap-3 border-b px-4 pb-4">
          <div className="forward-proxy-panel-heading text-base font-semibold">
            <CardTitle>{strings.config.title}</CardTitle>
            <CardDescription className="panel-description text-sm text-muted-foreground">{strings.config.description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="forward-proxy-panel-content flex flex-col gap-4 p-4">
          {saveError && !activeEgressProgress && (
            <Alert className="" role="alert" variant="destructive"><AlertDescription>
              {saveError}
            </AlertDescription></Alert>
          )}
          {settingsError && (
            <Alert className="" role="alert" variant="destructive"><AlertDescription>
              {settingsError}
            </AlertDescription></Alert>
          )}

          <AdminLoadingRegion
            loadState={settingsLoadState}
            loadingLabel={strings.config.loading}
            errorLabel={settingsError || undefined}
            minHeight={220}
          >
            <div className="space-y-3">
              <ForwardProxyEgressControl
                strings={strings}
                enabled={egressSocks5EnabledDraft}
                url={egressSocks5UrlDraft}
                loading={egressApplyBusy}
                controlsDisabled={controlsDisabled}
                inputLocked={egressInputLocked}
                errorMessage={egressFieldError?.message ?? null}
                errorPresentation={egressFieldError?.presentation ?? 'hint'}
                progress={activeEgressProgress}
                onToggle={(checked) => void handleToggleEgress(checked)}
                onUrlChange={(value) => {
                  setEgressFieldError(null)
                  setEgressSocks5UrlDraft(value)
                }}
                onUrlBlur={() => {
                  const validationError = validateEgressUrl(strings, egressSocks5UrlDraft)
                  setEgressFieldError(
                    validationError
                      ? {
                          message: validationError,
                          presentation: 'alert',
                        }
                      : null,
                  )
                }}
                onRequireUrl={() => {
                  setEgressFieldError({
                    message: strings.config.egressRequiredError,
                    presentation: 'hint',
                  })
                }}
              />

              <div className="rounded-xl border border-border/70 bg-card/45 px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="secondary" size="sm" onClick={() => openDialog('subscription')} disabled={controlsDisabled}>
                    {strings.config.addSubscription}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {strings.config.subscriptionCount.replace('{count}', formatNumber(subscriptionUrls.length))}
                  </span>
                  <Button type="button" variant="secondary" size="sm" onClick={() => openDialog('manual')} disabled={controlsDisabled}>
                    {strings.config.addManual}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {strings.config.manualCount.replace('{count}', formatNumber(manualUrls.length))}
                  </span>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <Card className="forward-proxy-editor-card">
                  <CardHeader className="forward-proxy-editor-head">
                    <div>
                      <CardTitle className="text-base">{strings.config.subscriptionsTitle}</CardTitle>
                      <CardDescription className="panel-description text-sm text-muted-foreground">{strings.config.subscriptionsDescription}</CardDescription>
                    </div>
                    <Badge variant="info">{formatNumber(subscriptionUrls.length)}</Badge>
                  </CardHeader>
                  <CardContent className="forward-proxy-editor-card-content flex min-w-0 flex-col gap-3">
                    {subscriptionUrls.length === 0 ? (
                      <Empty className="empty-state"><EmptyDescription>{strings.config.subscriptionListEmpty}</EmptyDescription></Empty>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {subscriptionUrls.map((subscriptionUrl, index) => (
                          <li
                            key={`subscription-${subscriptionUrl}`}
                            className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/65 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">
                                {extractListDisplayName(
                                  subscriptionUrl,
                                  strings.config.subscriptionItemFallback.replace('{index}', String(index + 1)),
                                )}
                              </div>
                            </div>
                            <Badge variant="outline">{extractProtocolName(subscriptionUrl)}</Badge>
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              onClick={() => void handleRemoveSubscription(subscriptionUrl)}
                              disabled={controlsDisabled}
                            >
                              {strings.config.remove}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Card className="forward-proxy-editor-card">
                  <CardHeader className="forward-proxy-editor-head">
                    <div>
                      <CardTitle className="text-base">{strings.config.manualTitle}</CardTitle>
                      <CardDescription className="panel-description text-sm text-muted-foreground">{strings.config.manualDescription}</CardDescription>
                    </div>
                    <Badge variant="outline">{formatNumber(manualUrls.length)}</Badge>
                  </CardHeader>
                  <CardContent className="forward-proxy-editor-card-content flex min-w-0 flex-col gap-3">
                    {manualUrls.length === 0 ? (
                      <Empty className="empty-state"><EmptyDescription>{strings.config.manualListEmpty}</EmptyDescription></Empty>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {manualUrls.map((proxyUrl, index) => (
                          <li
                            key={`manual-${proxyUrl}`}
                            className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/65 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">
                                {extractListDisplayName(
                                  proxyUrl,
                                  strings.config.manualItemFallback.replace('{index}', String(index + 1)),
                                )}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">{proxyUrl}</div>
                            </div>
                            <Badge variant="outline">{extractProtocolName(proxyUrl)}</Badge>
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              onClick={() => void handleRemoveManual(proxyUrl)}
                              disabled={controlsDisabled}
                            >
                              {strings.config.remove}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,280px)_1fr]">
                <Card className="forward-proxy-field-card">
                  <CardContent className="forward-proxy-field-card-content">
                    <label className="forward-proxy-field flex min-w-0 flex-col gap-2">
                      <span className="forward-proxy-field-label text-sm font-medium">{strings.config.subscriptionIntervalLabel}</span>
                      <Select value={selectedInterval} onValueChange={(value) => void handleIntervalChange(value)} disabled={controlsDisabled}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {FORWARD_PROXY_INTERVAL_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <span className="panel-description text-sm text-muted-foreground">{strings.config.subscriptionIntervalHint}</span>
                    </label>
                  </CardContent>
                </Card>

                <Card className="forward-proxy-checkbox-card">
                  <CardContent className="forward-proxy-checkbox-card-content">
                    <label className="forward-proxy-checkbox flex items-start gap-3" htmlFor="forward-proxy-insert-direct">
                      <Checkbox
                        id="forward-proxy-insert-direct"
                        checked={settings?.insertDirect ?? true}
                        onCheckedChange={(checked) => void handleInsertDirectChange(checked === true)}
                        disabled={controlsDisabled}
                      />
                      <div>
                        <strong>{strings.config.insertDirectLabel}</strong>
                        <p className="panel-description text-sm text-muted-foreground">{strings.config.insertDirectHint}</p>
                      </div>
                    </label>
                  </CardContent>
                </Card>
              </div>
            </div>
          </AdminLoadingRegion>
        </CardContent>
      </Card>

      <Dialog open={activeDialogKind != null} onOpenChange={(open) => (!open ? closeDialog() : undefined)}>
        <DialogContent className="max-h-[min(calc(100dvh-2rem),calc(100vh-2rem))] sm:max-w-3xl grid-rows-[auto,minmax(0,1fr),auto] gap-0 overflow-hidden border-border/90 bg-background p-0 shadow-2xl sm:max-h-[min(calc(100dvh-4rem),calc(100vh-4rem))]">
          <ForwardProxyCandidateDialog
            strings={strings}
            previewMode={isDialogPreview}
            dialogIsSubscription={dialogIsSubscription}
            dialogInput={activeDialogInput}
            dialogError={activeDialogError}
            dialogValidating={activeDialogValidating}
            dialogSaving={dialogIsSaving}
            dialogResults={activeDialogResults}
            liveRows={activeDialogLiveNodes}
            canAddSubscription={canAddSubscription}
            canAddManualBatch={canAddManualBatch}
            addManualBatchLabel={addManualBatchLabel}
            saving={controlsDisabled}
            progress={activeDialogProgress}
            onClose={closeDialog}
            onCancelValidate={cancelDialogValidation}
            onInputChange={(value) => {
              if (isDialogPreview) return
              setDialogInput(value)
              setDialogResults([])
              setDialogLiveNodes([])
              setDialogError(null)
              setDialogProgress(null)
            }}
            onValidate={() => void handleValidateDialog()}
            onAddSubscription={() => void handleAddSubscription()}
            onAddManualBatch={() => void handleAddManualBatch()}
            onAddManualEntry={(entry) => void handleAddManualEntry(entry)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
