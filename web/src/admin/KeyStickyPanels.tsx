import { Area, AreaChart, Bar, BarChart, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useMemo } from 'react'
import type React from 'react'

import type {
  ForwardProxyActivityBucket,
  ForwardProxyStatsNode,
  ForwardProxyWeightBucket,
  StickyNode,
  StickyUserDailyBucket,
  StickyUserRow,
} from '../api'
import { useTranslate } from '../i18n'
import AdminLoadingRegion from '../components/AdminLoadingRegion'
import { StatusBadge } from '../components/StatusBadge'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import type { QueryLoadState } from './queryLoadState'
import { isBlockingLoadState, isRefreshingLoadState } from './queryLoadState'

const numberFormatter = new Intl.NumberFormat('en-US')
const percentageFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 0,
})
const timestampFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const timeRangeFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
})

type StickyUserIdentityLike = StickyUserRow['user']

type WeightTrendScale = {
  minValue: number
  maxValue: number
}

export interface KeyStickyPanelsProps {
  stickyUsers: StickyUserRow[]
  stickyUsersLoadState: QueryLoadState
  stickyUsersError?: string | null
  stickyUsersPage: number
  stickyUsersTotal: number
  stickyUsersPerPage: number
  onStickyUsersPrevious?: () => void
  onStickyUsersNext?: () => void
  stickyNodes: StickyNode[]
  stickyNodesLoadState: QueryLoadState
  stickyNodesError?: string | null
  onOpenUser?: (userId: string) => void
}

function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

function formatTimestamp(value: number | null): string {
  if (!value) return '—'
  return timestampFormatter.format(new Date(value * 1000))
}

function formatDateOnly(value: number): string {
  return dateFormatter.format(new Date(value * 1000))
}

function formatTrendTimeRange(startIso: string, endIso: string): string {
  return `${timeRangeFormatter.format(new Date(startIso))} - ${timeRangeFormatter.format(new Date(endIso))}`
}

function stickyUserPrimary(user: StickyUserIdentityLike): string {
  return user.displayName || user.userId
}

function stickyUserSecondary(user: StickyUserIdentityLike): string | null {
  return user.username ? `@${user.username}` : null
}

function StickyCreditsTrendCell({ buckets, scaleMax }: { buckets: StickyUserDailyBucket[]; scaleMax: number }): React.JSX.Element {
  if (!buckets.length) return <span>—</span>
  const data = buckets.map((bucket) => ({ label: formatDateOnly(bucket.bucketStart), success: bucket.successCredits, failure: bucket.failureCredits }))
  return <ChartContainer config={{ success: { label: 'Success', color: 'var(--chart-1)' }, failure: { label: 'Failure', color: 'var(--chart-2)' } }} className="h-16 w-40 aspect-auto">
    <BarChart accessibilityLayer data={data}>
      <YAxis hide domain={[0, Math.max(scaleMax, 1)]} />
      <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload[0]?.payload.label} />} />
      <Bar dataKey="success" stackId="activity" fill="var(--color-success)" radius={2} />
      <Bar dataKey="failure" stackId="activity" fill="var(--color-failure)" radius={2} />
    </BarChart>
  </ChartContainer>
}

function ProxyActivityTrendCell({ buckets, scaleMax }: { buckets: ForwardProxyActivityBucket[]; scaleMax: number }): React.JSX.Element {
  if (!buckets.length) return <span>—</span>
  const data = buckets.map((bucket) => ({ label: formatTrendTimeRange(bucket.bucketStart, bucket.bucketEnd), success: bucket.successCount, failure: bucket.failureCount }))
  return <ChartContainer config={{ success: { label: 'Success', color: 'var(--chart-1)' }, failure: { label: 'Failure', color: 'var(--chart-2)' } }} className="h-16 w-40 aspect-auto">
    <BarChart accessibilityLayer data={data}>
      <YAxis hide domain={[0, Math.max(scaleMax, 1)]} />
      <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload[0]?.payload.label} />} />
      <Bar dataKey="success" stackId="activity" fill="var(--color-success)" radius={2} />
      <Bar dataKey="failure" stackId="activity" fill="var(--color-failure)" radius={2} />
    </BarChart>
  </ChartContainer>
}

function ProxyWeightTrendCell({ buckets, scale }: { buckets: ForwardProxyWeightBucket[]; scale: WeightTrendScale }): React.JSX.Element {
  if (!buckets.length) return <span>—</span>
  return <ChartContainer config={{ lastWeight: { label: 'Weight', color: 'var(--chart-1)' } }} className="h-16 w-40 aspect-auto">
    <AreaChart accessibilityLayer data={buckets.map((bucket) => ({ ...bucket, label: formatTrendTimeRange(bucket.bucketStart, bucket.bucketEnd) }))}>
      <YAxis hide domain={[scale.minValue, scale.maxValue]} />
      <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload[0]?.payload.label} />} />
      <Area dataKey="lastWeight" type="natural" stroke="var(--color-lastWeight)" fill="var(--color-lastWeight)" fillOpacity={0.4} />
    </AreaChart>
  </ChartContainer>
}

function resolveStickyNodeWeightBuckets(node: ForwardProxyStatsNode): ForwardProxyWeightBucket[] {
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

function stickyNodeWindowSummary(node: StickyNode): string {
  const attempts = node.stats.oneDay.attempts
  const successRate = node.stats.oneDay.successRate
  const latency = node.stats.oneDay.avgLatencyMs
  const rateLabel = successRate == null ? '—' : percentageFormatter.format(successRate)
  const latencyLabel = latency == null ? '—' : `${Math.round(latency)} ms`
  return `${formatNumber(attempts)} · ${rateLabel} · ${latencyLabel}`
}

function stickyNodeAssignmentSummary(
  node: StickyNode,
  strings: {
    assignmentSummary: string
    primaryAssignments: string
    secondaryAssignments: string
  },
): { compact: string; detail: string } {
  const primaryCount = formatNumber(node.primaryAssignmentCount)
  const secondaryCount = formatNumber(node.secondaryAssignmentCount)
  const detail = [
    strings.primaryAssignments.replace('{count}', primaryCount),
    strings.secondaryAssignments.replace('{count}', secondaryCount),
  ].join(' · ')
  return {
    compact: strings.assignmentSummary
      .replace('{primary}', primaryCount)
      .replace('{secondary}', secondaryCount),
    detail,
  }
}

function StickyWindowValue({
  successValue,
  failureValue,
  successLabel,
  failureLabel,
}: {
  successValue: number
  failureValue: number
  successLabel: string
  failureLabel: string
}): React.JSX.Element {
  return (
    <span className="sticky-window-values inline-flex items-center gap-1 tabular-nums">
      <span
        className="sticky-window-value sticky-window-value-success"
        aria-label={`${successLabel} ${formatNumber(successValue)}`}
      >
        {formatNumber(successValue)}
      </span>
      <span className="sticky-window-value-divider" aria-hidden="true">|</span>
      <span
        className="sticky-window-value sticky-window-value-failure"
        aria-label={`${failureLabel} ${formatNumber(failureValue)}`}
      >
        {formatNumber(failureValue)}
      </span>
    </span>
  )
}

export default function KeyStickyPanels({
  stickyUsers,
  stickyUsersLoadState,
  stickyUsersError,
  stickyUsersPage,
  stickyUsersTotal,
  stickyUsersPerPage,
  onStickyUsersPrevious,
  onStickyUsersNext,
  stickyNodes,
  stickyNodesLoadState,
  stickyNodesError,
  onOpenUser = () => undefined,
}: KeyStickyPanelsProps): React.JSX.Element {
  const translations = useTranslate()
  const adminStrings = translations.admin
  const keyStrings = adminStrings.keys
  const keyDetailsStrings = adminStrings.keyDetails
  const loadingStateStrings = adminStrings.loadingStates
  const tokenStrings = adminStrings.tokens

  const stickyUserScaleMax = useMemo(
    () => Math.max(...stickyUsers.flatMap((item) => item.dailyBuckets.map((bucket) => bucket.successCredits + bucket.failureCredits)), 0),
    [stickyUsers],
  )
  const stickyNodeScaleMax = useMemo(
    () => Math.max(...stickyNodes.flatMap((node) => node.last24h.map((bucket) => bucket.successCount + bucket.failureCount)), 0),
    [stickyNodes],
  )
  const stickyNodeWeightScale = useMemo(() => {
    const weightValues = stickyNodes.flatMap((node) =>
      resolveStickyNodeWeightBuckets(node).flatMap((bucket) => [bucket.minWeight, bucket.maxWeight, bucket.lastWeight]),
    )
    const minWeightValue = Math.min(...weightValues, 0)
    const maxWeightValue = Math.max(...weightValues, 0)
    const weightPadding = Math.max((maxWeightValue - minWeightValue) * 0.08, 0.2)
    return {
      minValue: minWeightValue - weightPadding,
      maxValue: maxWeightValue + weightPadding,
    }
  }, [stickyNodes])
  const stickyUsersBlocking = isBlockingLoadState(stickyUsersLoadState)
  const stickyUsersRefreshing = isRefreshingLoadState(stickyUsersLoadState)
  const stickyUsersLoadingLabel = stickyUsersRefreshing ? loadingStateStrings.refreshing : loadingStateStrings.switching
  const stickyUsersTotalPages = Math.max(1, Math.ceil(stickyUsersTotal / stickyUsersPerPage))
  const stickyNodesRefreshing = isRefreshingLoadState(stickyNodesLoadState)
  const stickyNodesLoadingLabel = stickyNodesRefreshing ? loadingStateStrings.refreshing : loadingStateStrings.switching

  return (
    <div className="key-sticky-panels-stack flex min-w-0 flex-col gap-6">
      <Card className="surface panel min-w-0">
        <CardHeader className="panel-header border-b">
          <div>
            <CardTitle role="heading" aria-level={2}>{keyDetailsStrings.stickyUsers.title}</CardTitle>
            <CardDescription className="panel-description">{keyDetailsStrings.stickyUsers.description}</CardDescription>
          </div>
        </CardHeader>
        <AdminLoadingRegion
          className="table-wrapper overflow-hidden hidden md:block"
          loadState={stickyUsersLoadState}
          loadingLabel={stickyUsersLoadingLabel}
          errorLabel={stickyUsersError ?? adminStrings.errors.loadKeyDetails}
          minHeight={220}
        >
          {stickyUsers.length === 0 ? (
            <Empty className="empty-state"><EmptyDescription>{keyDetailsStrings.stickyUsers.empty}</EmptyDescription></Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{keyDetailsStrings.stickyUsers.user}</TableHead>
                  <TableHead>{keyDetailsStrings.stickyUsers.yesterday}</TableHead>
                  <TableHead>{keyDetailsStrings.stickyUsers.today}</TableHead>
                  <TableHead>{keyDetailsStrings.stickyUsers.month}</TableHead>
                  <TableHead>{keyDetailsStrings.stickyUsers.lastSuccess}</TableHead>
                  <TableHead>{keyDetailsStrings.stickyUsers.trend}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stickyUsers.map((item) => {
                  const secondary = stickyUserSecondary(item.user)
                  return (
                    <TableRow key={item.user.userId}>
                      <TableCell>
                        <div className="token-owner-block flex flex-col gap-1">
                          <Button type="button" variant="link" size="sm" className="h-auto p-0 token-owner-trigger" onClick={() => onOpenUser(item.user.userId)}>
                            <span className="token-owner-link">{stickyUserPrimary(item.user)}</span>
                            {secondary ? <span className="token-owner-secondary">{secondary}</span> : null}
                          </Button>
                          {!item.user.active ? <span className="token-owner-empty">{keyDetailsStrings.stickyUsers.inactive}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StickyWindowValue
                          successValue={item.windows.yesterday.successCredits}
                          failureValue={item.windows.yesterday.failureCredits}
                          successLabel={keyDetailsStrings.stickyUsers.success}
                          failureLabel={keyDetailsStrings.stickyUsers.failure}
                        />
                      </TableCell>
                      <TableCell>
                        <StickyWindowValue
                          successValue={item.windows.today.successCredits}
                          failureValue={item.windows.today.failureCredits}
                          successLabel={keyDetailsStrings.stickyUsers.success}
                          failureLabel={keyDetailsStrings.stickyUsers.failure}
                        />
                      </TableCell>
                      <TableCell>
                        <StickyWindowValue
                          successValue={item.windows.month.successCredits}
                          failureValue={item.windows.month.failureCredits}
                          successLabel={keyDetailsStrings.stickyUsers.success}
                          failureLabel={keyDetailsStrings.stickyUsers.failure}
                        />
                      </TableCell>
                      <TableCell>{formatTimestamp(item.lastSuccessAt)}</TableCell>
                      <TableCell style={{ minWidth: 180 }}>
                        <StickyCreditsTrendCell buckets={item.dailyBuckets} scaleMax={stickyUserScaleMax} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </AdminLoadingRegion>
        <AdminLoadingRegion
          className="flex flex-col divide-y md:hidden flex md:hidden"
          loadState={stickyUsersLoadState}
          loadingLabel={stickyUsersLoadingLabel}
          errorLabel={stickyUsersError ?? adminStrings.errors.loadKeyDetails}
          minHeight={220}
        >
          {stickyUsers.length === 0 ? (
            <Empty className="empty-state"><EmptyDescription>{keyDetailsStrings.stickyUsers.empty}</EmptyDescription></Empty>
          ) : (
            stickyUsers.map((item) => {
              const secondary = stickyUserSecondary(item.user)
              return (
                <article key={item.user.userId} className="py-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span>{keyDetailsStrings.stickyUsers.user}</span>
                    <strong>
                      <Button type="button" variant="link" size="sm" className="h-auto p-0 token-owner-trigger" onClick={() => onOpenUser(item.user.userId)}>
                        <span className="token-owner-link">{stickyUserPrimary(item.user)}</span>
                        {secondary ? <span className="token-owner-secondary">{secondary}</span> : null}
                      </Button>
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span>{keyDetailsStrings.stickyUsers.yesterday}</span>
                    <strong>
                      <StickyWindowValue
                        successValue={item.windows.yesterday.successCredits}
                        failureValue={item.windows.yesterday.failureCredits}
                        successLabel={keyDetailsStrings.stickyUsers.success}
                        failureLabel={keyDetailsStrings.stickyUsers.failure}
                      />
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span>{keyDetailsStrings.stickyUsers.today}</span>
                    <strong>
                      <StickyWindowValue
                        successValue={item.windows.today.successCredits}
                        failureValue={item.windows.today.failureCredits}
                        successLabel={keyDetailsStrings.stickyUsers.success}
                        failureLabel={keyDetailsStrings.stickyUsers.failure}
                      />
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span>{keyDetailsStrings.stickyUsers.month}</span>
                    <strong>
                      <StickyWindowValue
                        successValue={item.windows.month.successCredits}
                        failureValue={item.windows.month.failureCredits}
                        successLabel={keyDetailsStrings.stickyUsers.success}
                        failureLabel={keyDetailsStrings.stickyUsers.failure}
                      />
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span>{keyDetailsStrings.stickyUsers.lastSuccess}</span>
                    <strong>{formatTimestamp(item.lastSuccessAt)}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span>{keyDetailsStrings.stickyUsers.trend}</span>
                    <div style={{ width: '100%' }}>
                      <StickyCreditsTrendCell buckets={item.dailyBuckets} scaleMax={stickyUserScaleMax} />
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </AdminLoadingRegion>
        {stickyUsersTotal > stickyUsersPerPage ? (
          <div className="table-pagination flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="table-pagination-meta flex min-w-0 flex-col gap-2 table-pagination-meta-summary-only">
              <span className="table-pagination-summary text-sm text-muted-foreground">
                <span className="panel-description text-sm text-muted-foreground">
                  {keyStrings.pagination.page
                    .replace('{page}', String(stickyUsersPage))
                    .replace('{total}', String(stickyUsersTotalPages))}
                </span>
              </span>
            </div>
            <Pagination
              className="table-pagination-nav mx-0 w-auto justify-start sm:justify-end"
              aria-label={`${tokenStrings.pagination.prev} / ${tokenStrings.pagination.next}`}
            >
              <PaginationContent>
                <PaginationItem>
                  <Button
                    type="button"
                    variant="outline"
                    className="table-pagination-button"
                    onClick={() => void (onStickyUsersPrevious ?? (() => undefined))()}
                    disabled={stickyUsersBlocking || stickyUsersPage <= 1}
                  >
                    <ChevronLeftIcon data-icon="inline-start" />
                    {tokenStrings.pagination.prev}
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <Button
                    type="button"
                    variant="outline"
                    className="table-pagination-button"
                    onClick={() => void (onStickyUsersNext ?? (() => undefined))()}
                    disabled={stickyUsersBlocking || stickyUsersPage >= stickyUsersTotalPages}
                  >
                    {tokenStrings.pagination.next}
                    <ChevronRightIcon data-icon="inline-end" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        ) : null}
      </Card>

      <Card className="surface panel min-w-0">
        <CardHeader className="panel-header border-b">
          <div>
            <CardTitle role="heading" aria-level={2}>{keyDetailsStrings.stickyNodes.title}</CardTitle>
            <CardDescription className="panel-description">{keyDetailsStrings.stickyNodes.description}</CardDescription>
          </div>
        </CardHeader>
        <AdminLoadingRegion
          className="table-wrapper overflow-hidden hidden md:block"
          loadState={stickyNodesLoadState}
          loadingLabel={stickyNodesLoadingLabel}
          errorLabel={stickyNodesError ?? adminStrings.errors.loadKeyDetails}
          minHeight={220}
        >
          {stickyNodes.length === 0 ? (
            <Empty className="empty-state"><EmptyDescription>{keyDetailsStrings.stickyNodes.empty}</EmptyDescription></Empty>
          ) : (
            <Table className="key-sticky-nodes-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{keyDetailsStrings.stickyNodes.role}</TableHead>
                  <TableHead>{keyDetailsStrings.stickyNodes.node}</TableHead>
                  <TableHead>{keyDetailsStrings.stickyNodes.window}</TableHead>
                  <TableHead>{keyDetailsStrings.stickyNodes.activity}</TableHead>
                  <TableHead>{keyDetailsStrings.stickyNodes.weight}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stickyNodes.map((node) => {
                  const assignmentSummary = stickyNodeAssignmentSummary(node, keyDetailsStrings.stickyNodes)
                  return (
                    <TableRow key={`${node.role}:${node.key}`}>
                      <TableCell className="key-sticky-nodes-role-cell">
                        <StatusBadge tone={node.role === 'primary' ? 'success' : 'info'}>
                          {node.role === 'primary' ? keyDetailsStrings.stickyNodes.primary : keyDetailsStrings.stickyNodes.secondary}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="key-sticky-nodes-node-cell">
                        <div className="sticky-node-summary flex flex-col gap-1" title={`${node.displayName} · ${assignmentSummary.detail}`}>
                          <strong className="sticky-node-summary-title">{node.displayName}</strong>
                          <div className="sticky-node-summary-meta flex flex-wrap gap-1 text-xs text-muted-foreground">
                            <span className="sticky-node-summary-chip rounded border bg-muted px-1.5 py-0.5" aria-label={assignmentSummary.detail}>
                              {assignmentSummary.compact}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{stickyNodeWindowSummary(node)}</TableCell>
                      <TableCell style={{ minWidth: 180 }}>
                        <ProxyActivityTrendCell buckets={node.last24h} scaleMax={stickyNodeScaleMax} />
                      </TableCell>
                      <TableCell style={{ minWidth: 180 }}>
                        <ProxyWeightTrendCell buckets={resolveStickyNodeWeightBuckets(node)} scale={stickyNodeWeightScale} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </AdminLoadingRegion>
        <AdminLoadingRegion
          className="flex flex-col divide-y md:hidden flex md:hidden"
          loadState={stickyNodesLoadState}
          loadingLabel={stickyNodesLoadingLabel}
          errorLabel={stickyNodesError ?? adminStrings.errors.loadKeyDetails}
          minHeight={220}
        >
          {stickyNodes.length === 0 ? (
            <Empty className="empty-state"><EmptyDescription>{keyDetailsStrings.stickyNodes.empty}</EmptyDescription></Empty>
          ) : (
            stickyNodes.map((node) => {
              const assignmentSummary = stickyNodeAssignmentSummary(node, keyDetailsStrings.stickyNodes)
              return (
                <article key={`${node.role}:${node.key}`} className="py-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span>{keyDetailsStrings.stickyNodes.role}</span>
                    <StatusBadge tone={node.role === 'primary' ? 'success' : 'info'}>
                      {node.role === 'primary' ? keyDetailsStrings.stickyNodes.primary : keyDetailsStrings.stickyNodes.secondary}
                    </StatusBadge>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span>{keyDetailsStrings.stickyNodes.node}</span>
                    <div className="sticky-node-summary flex flex-col gap-1" title={`${node.displayName} · ${assignmentSummary.detail}`}>
                      <strong className="sticky-node-summary-title">{node.displayName}</strong>
                      <div className="sticky-node-summary-meta flex flex-wrap gap-1 text-xs text-muted-foreground">
                        <span className="sticky-node-summary-chip rounded border bg-muted px-1.5 py-0.5" aria-label={assignmentSummary.detail}>
                          {assignmentSummary.compact}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span>{keyDetailsStrings.stickyNodes.activity}</span>
                    <div style={{ width: '100%' }}>
                      <ProxyActivityTrendCell buckets={node.last24h} scaleMax={stickyNodeScaleMax} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span>{keyDetailsStrings.stickyNodes.weight}</span>
                    <div style={{ width: '100%' }}>
                      <ProxyWeightTrendCell buckets={resolveStickyNodeWeightBuckets(node)} scale={stickyNodeWeightScale} />
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </AdminLoadingRegion>
      </Card>
    </div>
  )
}
