import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { useEffect, useMemo, useState } from 'react'
import type React from 'react'

import type {
  AdminMcpSessionBindingsPage,
  AdminMcpSessionBindingsQuery,
  AdminMcpSessionBindingListItem,
} from '../api'
import type { Language } from '../i18n'
import type { QueryLoadState } from './queryLoadState'
import type {
  AdminMcpSessionBindingsPathContext,
} from './routes'
import AdminLoadingRegion from '../components/AdminLoadingRegion'
import DateTimeRangeField from '../components/DateTimeRangeField'
import { StatusBadge, type StatusTone } from '../components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import McpSessionBindingsStatusTabs from './McpSessionBindingsStatusTabs'

interface McpSessionBindingsModuleProps {
  language: Language
  query: AdminMcpSessionBindingsPathContext
  data: AdminMcpSessionBindingsPage | null
  loadState: QueryLoadState
  error: string | null
  busy: boolean
  showStatusTabs?: boolean
  onNavigate: (next: AdminMcpSessionBindingsPathContext) => void
  onRevokeSelected: (proxySessionIds: string[]) => Promise<void> | void
  onRevokeFiltered: (query: AdminMcpSessionBindingsQuery) => Promise<void> | void
  onOpenUser: (userId: string) => void
  onOpenToken: (tokenId: string) => void
  onOpenKey: (keyId: string) => void
}

function copyFor(language: Language) {
  if (language === 'zh') {
    return {
      loading: '正在加载 session 绑定记录…',
      loadFailed: '读取 session 绑定记录失败。',
      empty: '当前筛选下没有 session 绑定记录。',
      filters: {
        createdRange: '创建日期范围',
        createdFrom: '创建日期起',
        createdTo: '创建日期止',
        updatedRange: '续约日期范围',
        updatedFrom: '续约日期起',
        updatedTo: '续约日期止',
        rangeSeparator: '至',
        apply: '应用筛选',
        reset: '重置',
      },
      summary: {
        total: '命中总数',
        activeMatching: '当前筛选内活跃',
        currentPageActionable: '当前页可释放',
      },
      selection: {
        page: '选择当前页可操作会话',
        row: '选择会话 {id}',
        selectedCount: '已选 {count} 项',
        clear: '清空选择',
      },
      actions: {
        release: '释放',
        releaseSelected: '释放已选',
        releaseFiltered: '释放当前筛选结果全部活跃会话',
        releaseFilteredWithCount: '释放当前筛选结果全部活跃会话（{count}）',
      },
      table: {
        proxySessionId: '代理会话',
        authTokenId: '访问令牌',
        userId: '用户',
        upstreamKeyId: '上游 Key',
        createdAt: '创建时间',
        updatedAt: '续约时间',
        expiresAt: '过期时间',
        status: '状态',
        history: '释放记录',
        action: '操作',
      },
      status: {
        active: '活跃',
        expired: '已过期',
        revoked: '已释放',
      },
      revokeHistoryEmpty: '—',
      revokeReasonPrefix: '原因：',
      confirmTitle: '确认释放当前筛选结果中的全部活跃会话',
      confirmDescription:
        '该操作会释放当前筛选结果中的全部活跃 upstream_mcp session。已有过期或已释放记录不会被重复处理。',
      confirmCount: '本次将释放 {count} 个活跃会话。',
      confirmCancel: '取消',
      confirmRelease: '确认释放',
      pagination: '第 {page} / {total} 页',
      notAvailable: '—',
    }
  }

  return {
    loading: 'Loading session binding records…',
    loadFailed: 'Failed to load session binding records.',
    empty: 'No session binding records match the current filters.',
    filters: {
      createdRange: 'Created date range',
      createdFrom: 'Created date from',
      createdTo: 'Created date to',
      updatedRange: 'Renewed date range',
      updatedFrom: 'Renewed date from',
      updatedTo: 'Renewed date to',
      rangeSeparator: 'to',
      apply: 'Apply filters',
      reset: 'Reset',
    },
    summary: {
      total: 'Matches',
      activeMatching: 'Active in filter',
      currentPageActionable: 'Actionable on page',
    },
    selection: {
      page: 'Select actionable sessions on this page',
      row: 'Select session {id}',
      selectedCount: '{count} selected',
      clear: 'Clear',
    },
    actions: {
      release: 'Release',
      releaseSelected: 'Release selected',
      releaseFiltered: 'Release all active sessions in current filter',
      releaseFilteredWithCount: 'Release all active sessions in current filter ({count})',
    },
    table: {
      proxySessionId: 'Proxy Session',
      authTokenId: 'Access token',
      userId: 'User',
      upstreamKeyId: 'Upstream key',
      createdAt: 'Created',
      updatedAt: 'Renewed',
      expiresAt: 'Expires',
      status: 'Status',
      history: 'Release history',
      action: 'Action',
    },
    status: {
      active: 'Active',
      expired: 'Expired',
      revoked: 'Revoked',
    },
    revokeHistoryEmpty: '—',
    revokeReasonPrefix: 'Reason:',
    confirmTitle: 'Release all active sessions in the current filter',
    confirmDescription:
      'This releases every active upstream_mcp session in the current filter result. Expired or revoked records are ignored.',
    confirmCount: 'This action will release {count} active sessions.',
    confirmCancel: 'Cancel',
    confirmRelease: 'Release sessions',
    pagination: 'Page {page} / {total}',
    notAvailable: '—',
  }
}

function formatIso8601WithOffset(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absoluteOffsetMinutes = Math.abs(offsetMinutes)
  const offsetHours = String(Math.floor(absoluteOffsetMinutes / 60)).padStart(2, '0')
  const offsetRemainderMinutes = String(absoluteOffsetMinutes % 60).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetRemainderMinutes}`
}

function isoToDateInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateInputValueToIso(value: string, bound: 'start' | 'end'): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!match) return null
  const [, year, month, day] = match
  const parsed =
    bound === 'start'
      ? new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0)
      : new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59)
  if (Number.isNaN(parsed.getTime())) return null
  return formatIso8601WithOffset(parsed)
}

function formatTimestamp(timestamp: number | null, formatter: Intl.DateTimeFormat, emptyLabel: string): string {
  if (timestamp == null) return emptyLabel
  const parsed = new Date(timestamp * 1000)
  return Number.isNaN(parsed.getTime()) ? emptyLabel : formatter.format(parsed)
}

function rowTone(item: AdminMcpSessionBindingListItem): StatusTone {
  switch (item.status) {
    case 'active':
      return 'warning'
    case 'expired':
      return 'neutral'
    case 'revoked':
      return 'success'
    default:
      return 'neutral'
  }
}

const selectionCheckboxLabelStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
} as const

export default function McpSessionBindingsModule({
  language,
  query,
  data,
  loadState,
  error,
  busy,
  showStatusTabs = true,
  onNavigate,
  onRevokeSelected,
  onRevokeFiltered,
  onOpenUser,
  onOpenToken,
  onOpenKey,
}: McpSessionBindingsModuleProps): React.JSX.Element {
  const copy = useMemo(() => copyFor(language), [language])
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [language],
  )
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(language === 'zh' ? 'zh-CN' : 'en-US'),
    [language],
  )
  const [draftCreatedFrom, setDraftCreatedFrom] = useState(() => isoToDateInputValue(query.createdFrom))
  const [draftCreatedTo, setDraftCreatedTo] = useState(() => isoToDateInputValue(query.createdTo))
  const [draftUpdatedFrom, setDraftUpdatedFrom] = useState(() => isoToDateInputValue(query.updatedFrom))
  const [draftUpdatedTo, setDraftUpdatedTo] = useState(() => isoToDateInputValue(query.updatedTo))
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [confirmReleaseAllOpen, setConfirmReleaseAllOpen] = useState(false)

  useEffect(() => {
    setDraftCreatedFrom(isoToDateInputValue(query.createdFrom))
    setDraftCreatedTo(isoToDateInputValue(query.createdTo))
    setDraftUpdatedFrom(isoToDateInputValue(query.updatedFrom))
    setDraftUpdatedTo(isoToDateInputValue(query.updatedTo))
  }, [query.createdFrom, query.createdTo, query.updatedFrom, query.updatedTo])

  useEffect(() => {
    setSelectedIds((current) => {
      if (!data) return new Set()
      const next = new Set<string>()
      data.items.forEach((item) => {
        if (item.status === 'active' && current.has(item.proxySessionId)) {
          next.add(item.proxySessionId)
        }
      })
      return next
    })
  }, [data])

  const actionableItems = useMemo(
    () => data?.items.filter((item) => item.status === 'active') ?? [],
    [data],
  )
  const actionableIds = useMemo(
    () => actionableItems.map((item) => item.proxySessionId),
    [actionableItems],
  )
  const allActionableSelected = actionableIds.length > 0 && actionableIds.every((id) => selectedIds.has(id))
  const selectedCount = selectedIds.size
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / Math.max(1, data?.perPage ?? 20)))

  const applyFilters = () => {
    onNavigate({
      status: query.status ?? 'active',
      createdFrom: dateInputValueToIso(draftCreatedFrom, 'start'),
      createdTo: dateInputValueToIso(draftCreatedTo, 'end'),
      updatedFrom: dateInputValueToIso(draftUpdatedFrom, 'start'),
      updatedTo: dateInputValueToIso(draftUpdatedTo, 'end'),
      page: 1,
    })
  }

  const resetFilters = () => {
    setDraftCreatedFrom('')
    setDraftCreatedTo('')
    setDraftUpdatedFrom('')
    setDraftUpdatedTo('')
    onNavigate({
      status: query.status ?? 'active',
      createdFrom: null,
      createdTo: null,
      updatedFrom: null,
      updatedTo: null,
      page: 1,
    })
  }

  const currentApiQuery: AdminMcpSessionBindingsQuery = {
    status: query.status ?? 'active',
    createdFrom: query.createdFrom ?? null,
    createdTo: query.createdTo ?? null,
    updatedFrom: query.updatedFrom ?? null,
    updatedTo: query.updatedTo ?? null,
    page: query.page ?? 1,
    perPage: data?.perPage ?? 20,
  }

  return (
    <Card className="surface panel min-w-0 grid gap-4">
      {showStatusTabs ? (
        <CardHeader className="panel-header border-b justify-end gap-3">
          <McpSessionBindingsStatusTabs
            language={language}
            value={query.status ?? 'active'}
            onChange={(value) => {
              onNavigate({
                ...query,
                status: value,
                page: 1,
              })
            }}
          />
        </CardHeader>
      ) : null}

      <CardContent className="grid gap-4">
        <div className="grid items-end gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <DateTimeRangeField
            label={copy.filters.createdRange}
            startId="mcp-session-bindings-created-from"
            endId="mcp-session-bindings-created-to"
            startLabel={copy.filters.createdFrom}
            endLabel={copy.filters.createdTo}
            startValue={draftCreatedFrom}
            endValue={draftCreatedTo}
            startSeparator={copy.filters.rangeSeparator}
            startMax={draftCreatedTo}
            endMin={draftCreatedFrom}
            disabled={busy}
            onStartChange={setDraftCreatedFrom}
            onEndChange={setDraftCreatedTo}
          />
          <DateTimeRangeField
            label={copy.filters.updatedRange}
            startId="mcp-session-bindings-updated-from"
            endId="mcp-session-bindings-updated-to"
            startLabel={copy.filters.updatedFrom}
            endLabel={copy.filters.updatedTo}
            startValue={draftUpdatedFrom}
            endValue={draftUpdatedTo}
            startSeparator={copy.filters.rangeSeparator}
            startMax={draftUpdatedTo}
            endMin={draftUpdatedFrom}
            disabled={busy}
            onStartChange={setDraftUpdatedFrom}
            onEndChange={setDraftUpdatedTo}
          />

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={applyFilters} disabled={busy}>
              {copy.filters.apply}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={resetFilters} disabled={busy}>
              {copy.filters.reset}
            </Button>
          </div>
        </div>
      </CardContent>

      <CardContent className="grid gap-3 md:grid-cols-3">
        <SummaryCard label={copy.summary.total} value={numberFormatter.format(data?.total ?? 0)} />
        <SummaryCard
          label={copy.summary.activeMatching}
          value={numberFormatter.format(data?.activeMatchingCount ?? 0)}
        />
        <SummaryCard
          label={copy.summary.currentPageActionable}
          value={numberFormatter.format(actionableItems.length)}
        />
      </CardContent>

      <CardContent
        className="flex flex-wrap items-center justify-between gap-2 pb-2"
        style={{ borderBottom: '1px solid color-mix(in oklab, var(--border) 46%, transparent)' }}
      >
        <div className="inline-flex flex-wrap items-center gap-2">
          <strong>{copy.selection.selectedCount.replace('{count}', numberFormatter.format(selectedCount))}</strong>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            disabled={selectedCount === 0 || busy}
          >
            {copy.selection.clear}
          </Button>
        </div>
        <div className="inline-flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onRevokeSelected(Array.from(selectedIds))}
            disabled={selectedCount === 0 || busy}
          >
            {copy.actions.releaseSelected}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
            size="sm"
            onClick={() => setConfirmReleaseAllOpen(true)}
            disabled={(data?.activeMatchingCount ?? 0) === 0 || busy}
          >
            {(data?.activeMatchingCount ?? 0) > 0
              ? copy.actions.releaseFilteredWithCount.replace(
                  '{count}',
                  numberFormatter.format(data?.activeMatchingCount ?? 0),
                )
              : copy.actions.releaseFiltered}
          </Button>
        </div>
      </CardContent>

      <CardContent className="min-w-0"><AdminLoadingRegion
        loadState={loadState}
        loadingLabel={copy.loading}
        errorLabel={error ?? copy.loadFailed}
        minHeight={260}
      >
        {!data || data.items.length === 0 ? (
          <Empty><EmptyDescription>{copy.empty}</EmptyDescription></Empty>
        ) : (
          <>
            <div className="table-wrapper overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <label style={selectionCheckboxLabelStyle}>
                        <Checkbox
                          aria-label={copy.selection.page}
                          checked={allActionableSelected ? true : selectedCount > 0 ? 'indeterminate' : false}
                          disabled={actionableIds.length === 0 || busy}
                          onCheckedChange={(checked) => {
                            if (checked === true) {
                              setSelectedIds(new Set(actionableIds))
                            } else {
                              setSelectedIds(new Set())
                            }
                          }}
                        />
                      </label>
                    </TableHead>
                    <TableHead>{copy.table.proxySessionId}</TableHead>
                    <TableHead>{copy.table.authTokenId}</TableHead>
                    <TableHead>{copy.table.userId}</TableHead>
                    <TableHead>{copy.table.upstreamKeyId}</TableHead>
                    <TableHead>{copy.table.createdAt}</TableHead>
                    <TableHead>{copy.table.updatedAt}</TableHead>
                    <TableHead>{copy.table.expiresAt}</TableHead>
                    <TableHead>{copy.table.status}</TableHead>
                    <TableHead>{copy.table.history}</TableHead>
                    <TableHead>{copy.table.action}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => {
                    const selectable = item.status === 'active'
                    return (
                      <TableRow key={item.proxySessionId}>
                        <TableCell>
                          <label style={selectionCheckboxLabelStyle}>
                            <Checkbox
                              aria-label={copy.selection.row.replace('{id}', item.proxySessionId)}
                              checked={selectedIds.has(item.proxySessionId)}
                              disabled={!selectable || busy}
                              onCheckedChange={(checked) => {
                                setSelectedIds((current) => {
                                  const next = new Set(current)
                                  if (checked === true) next.add(item.proxySessionId)
                                  else next.delete(item.proxySessionId)
                                  return next
                                })
                              }}
                            />
                          </label>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.proxySessionId}</TableCell>
                        <TableCell>{renderRelated(item.authTokenId, copy.notAvailable, onOpenToken)}</TableCell>
                        <TableCell>{renderRelated(item.userId, copy.notAvailable, onOpenUser)}</TableCell>
                        <TableCell>{renderRelated(item.upstreamKeyId, copy.notAvailable, onOpenKey)}</TableCell>
                        <TableCell>{formatTimestamp(item.createdAt, formatter, copy.notAvailable)}</TableCell>
                        <TableCell>{formatTimestamp(item.updatedAt, formatter, copy.notAvailable)}</TableCell>
                        <TableCell>{formatTimestamp(item.expiresAt, formatter, copy.notAvailable)}</TableCell>
                        <TableCell>
                          <StatusBadge tone={rowTone(item)}>{copy.status[item.status]}</StatusBadge>
                        </TableCell>
                        <TableCell>
                          {item.revokedAt == null ? (
                            <span>{copy.revokeHistoryEmpty}</span>
                          ) : (
                            <div className="grid gap-1">
                              <span>{formatTimestamp(item.revokedAt, formatter, copy.notAvailable)}</span>
                              {item.revokeReason ? (
                                <small className="text-muted-foreground">
                                  {copy.revokeReasonPrefix} {item.revokeReason}
                                </small>
                              ) : null}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {selectable ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => void onRevokeSelected([item.proxySessionId])}
                              disabled={busy}
                            >
                              {copy.actions.release}
                            </Button>
                          ) : (
                            <span>{copy.revokeHistoryEmpty}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col gap-2">
                <span className="text-sm text-muted-foreground">
                  <span className="text-sm text-muted-foreground">
                    {copy.pagination
                      .replace('{page}', String(data.page))
                      .replace('{total}', String(totalPages))}
                  </span>
                </span>
              </div>
              <Pagination
                className="mx-0 w-auto justify-start sm:justify-end"
                aria-label={`${language === 'zh' ? '上一页' : 'Previous'} / ${language === 'zh' ? '下一页' : 'Next'}`}
              >
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="outline"
                      className="table-pagination-button"
                      onClick={() => onNavigate({ ...query, page: Math.max(1, (query.page ?? 1) - 1) })}
                      disabled={busy || data.page <= 1}
                    >
                      <ChevronLeftIcon data-icon="inline-start" />
                      {language === 'zh' ? '上一页' : 'Previous'}
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="outline"
                      className="table-pagination-button"
                      onClick={() => onNavigate({ ...query, page: Math.min(totalPages, (query.page ?? 1) + 1) })}
                      disabled={busy || data.page >= totalPages}
                    >
                      {language === 'zh' ? '下一页' : 'Next'}
                      <ChevronRightIcon data-icon="inline-end" />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </>
        )}
      </AdminLoadingRegion></CardContent>

      <Dialog open={confirmReleaseAllOpen} onOpenChange={setConfirmReleaseAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.confirmTitle}</DialogTitle>
            <DialogDescription>{copy.confirmDescription}</DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium">
            {copy.confirmCount.replace('{count}', numberFormatter.format(data?.activeMatchingCount ?? 0))}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmReleaseAllOpen(false)} disabled={busy}>
              {copy.confirmCancel}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
              onClick={async () => {
                await onRevokeFiltered(currentApiQuery)
                setConfirmReleaseAllOpen(false)
              }}
              disabled={(data?.activeMatchingCount ?? 0) === 0 || busy}
            >
              {copy.confirmRelease}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className="text-2xl font-semibold tabular-nums">{value}</strong>
    </div>
  )
}

function renderRelated(
  value: string | null,
  emptyLabel: string,
  onOpen: (id: string) => void,
): React.JSX.Element {
  if (!value) return <span>{emptyLabel}</span>
  return (
    <Button
      type="button"
      variant="link"
      className="h-auto justify-start p-0 text-left font-mono text-xs"
      onClick={() => onOpen(value)}
    >
      {value}
    </Button>
  )
}
