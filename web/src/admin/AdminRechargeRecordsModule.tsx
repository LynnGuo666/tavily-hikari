import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Field, FieldLabel, FieldGroup } from '@/components/ui/field'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { useEffect, useMemo, useState } from 'react'

import {
  fetchAdminRecharges,
  fetchAdminTotpStatus,
  refundAdminRecharge,
  refundOnlyAdminRecharge,
  type AdminTotpStatus,
  type AdminRechargeListResponse,
  type AdminRechargeOrder,
  type AdminRechargeSort,
  type AdminRechargeStatus,
  type AdminRechargeViewMode,
} from '../api'
import { StatusBadge } from '../components/StatusBadge'
import AdminLoadingRegion from '../components/AdminLoadingRegion'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useTranslate, type AdminTranslations } from '../i18n'
import type { QueryLoadState } from './queryLoadState'

interface AdminRechargeRecordsModuleProps {
  initialData?: AdminRechargeListResponse
  initialTotpStatus?: AdminTotpStatus | null
  disableAutoLoad?: boolean
  onOpenUser?: (id: string) => void
  onOpenSystemSettings?: () => void
}

export type RefundKind = 'refund' | 'refundOnly'

const STATUS_OPTIONS: Array<AdminRechargeStatus | 'all'> = ['all', 'pending', 'paid', 'failed', 'expired', 'cancelled', 'refunding', 'refunded', 'refundOnly']
const SORT_OPTIONS: AdminRechargeSort[] = ['createdAt', 'paidAt', 'refundedAt', 'status']

function formatDate(ts: number | null | undefined): string {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString()
}

function userLabel(user: AdminRechargeOrder['user']): string {
  return user.displayName || user.username || user.id
}

function dateStartSeconds(value: string): number | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : Math.floor(date.getTime() / 1000)
}

function dateEndSeconds(value: string): number | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T23:59:59`)
  return Number.isNaN(date.getTime()) ? undefined : Math.floor(date.getTime() / 1000)
}

export default function AdminRechargeRecordsModule({
  initialData,
  initialTotpStatus,
  disableAutoLoad = false,
  onOpenUser,
  onOpenSystemSettings,
}: AdminRechargeRecordsModuleProps): JSX.Element {
  const strings = useTranslate().admin.recharges
  const [data, setData] = useState<AdminRechargeListResponse | null>(initialData ?? null)
  const [loadState, setLoadState] = useState<QueryLoadState>(initialData ? 'ready' : 'initial_loading')
  const [error, setError] = useState<string | null>(null)
  const [totpStatus, setTotpStatus] = useState<AdminTotpStatus | null>(initialTotpStatus ?? null)
  const [totpStatusError, setTotpStatusError] = useState<string | null>(null)
  const [totpStatusLoading, setTotpStatusLoading] = useState(!disableAutoLoad && initialTotpStatus === undefined)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<AdminRechargeStatus | 'all'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sort, setSort] = useState<AdminRechargeSort>('createdAt')
  const [view, setView] = useState<AdminRechargeViewMode>('flat')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [refundTarget, setRefundTarget] = useState<{ order: AdminRechargeOrder; kind: RefundKind } | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [refundBusy, setRefundBusy] = useState(false)
  const [refundError, setRefundError] = useState<string | null>(null)

  const load = () => {
    const controller = new AbortController()
    setLoadState((current) => (current === 'ready' ? 'refreshing' : 'initial_loading'))
    setError(null)
    fetchAdminRecharges(
      {
        user: query.trim() || undefined,
        status,
        startAt: dateStartSeconds(startDate),
        endAt: dateEndSeconds(endDate),
        sort,
        order,
        view,
        page,
        perPage: 25,
      },
      controller.signal,
    )
      .then((next) => {
        setData(next)
        setLoadState('ready')
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : String(err))
          setLoadState('error')
        }
      })
    return () => controller.abort()
  }

  const openUser = (id: string) => {
    if (onOpenUser) {
      onOpenUser(id)
      return
    }
    if (typeof window !== 'undefined') {
      window.location.assign(`/admin/users/${encodeURIComponent(id)}`)
    }
  }

  const openSystemSettings = () => {
    if (onOpenSystemSettings) {
      onOpenSystemSettings()
      return
    }
    if (typeof window !== 'undefined') {
      window.location.assign('/admin/system-settings')
    }
  }

  const openRefundDialog = (order: AdminRechargeOrder, kind: RefundKind) => {
    setRefundTarget({ order, kind })
    setTotpCode('')
    setRefundError(null)
  }

  const closeRefundDialog = () => {
    if (refundBusy) return
    setRefundTarget(null)
    setTotpCode('')
    setRefundError(null)
  }

  useEffect(() => {
    if (disableAutoLoad) return
    return load()
  }, [disableAutoLoad, query, status, startDate, endDate, sort, order, view, page])

  useEffect(() => {
    if (disableAutoLoad) return
    const controller = new AbortController()
    setTotpStatusLoading(true)
    setTotpStatusError(null)
    fetchAdminTotpStatus(controller.signal)
      .then((nextStatus) => {
        setTotpStatus(nextStatus)
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setTotpStatusError(err instanceof Error ? err.message : String(err))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setTotpStatusLoading(false)
      })
    return () => controller.abort()
  }, [disableAutoLoad])

  const summary = useMemo(() => {
    const items = data?.items ?? []
    return {
      actionable: items.filter((item) => item.status === 'paid').length,
      total: data?.total ?? 0,
    }
  }, [data])

  const executeRefund = async () => {
    if (!refundTarget) return
    setRefundBusy(true)
    setRefundError(null)
    try {
      await (refundTarget.kind === 'refund'
        ? refundAdminRecharge(refundTarget.order.outTradeNo, totpCode)
        : refundOnlyAdminRecharge(refundTarget.order.outTradeNo, totpCode))
      setRefundTarget(null)
      setTotpCode('')
      setRefundError(null)
      load()
    } catch (err) {
      setRefundError(refundErrorMessage(err instanceof Error ? err.message : String(err), strings))
    } finally {
      setRefundBusy(false)
    }
  }

  const totpSummaryText = totpStatus == null
    ? strings.summary.totpRequired
    : totpStatus.enabled
      ? strings.summary.totpRequired
      : totpStatus.available === false
        ? strings.summary.totpUnavailable
        : strings.summary.totpSetupRequired
  if (data && !data.hasRechargeOrders) {
    return (
      <section className="admin-recharge-module admin-recharge-module--empty" aria-label={strings.title}>
        <Empty className="empty-state"><EmptyDescription>{strings.emptyHiddenDescription}</EmptyDescription></Empty>
      </section>
    )
  }

  return (
    <section className="admin-recharge-module flex min-w-0 flex-col gap-4" aria-label={strings.title}>
      <div className="admin-recharge-summary flex flex-wrap gap-3 text-sm text-muted-foreground" aria-label={strings.title}>
        <span>{formatTemplate(strings.summary.orders, { total: summary.total })}</span>
        <span>{formatTemplate(strings.summary.actionable, { count: summary.actionable })}</span>
        <span>{totpSummaryText}</span>
      </div>
      {totpStatusError && (
        <p className="admin-recharge-inline-status" role="status" aria-live="polite">
          {formatTemplate(strings.totpStatusLoadFailed, { message: totpStatusError })}
        </p>
      )}

      <div className="admin-recharge-toolbar flex flex-col gap-4">
        <div className="admin-recharge-toolbar-primary flex flex-wrap items-center gap-3">
          <Field className="admin-recharge-search-field"><FieldLabel htmlFor="admin-recharge-search" className="sr-only">{strings.searchLabel}</FieldLabel>
            <Input
              id="admin-recharge-search"
              name="admin_recharge_search"
              value={query}
              onChange={(event) => { setPage(1); setQuery(event.target.value) }}
              placeholder={strings.searchPlaceholder}
            />
          </Field>
          <ToggleGroup type="single" value={view} onValueChange={(value) => { if (value) setView(value as AdminRechargeViewMode) }} variant="outline" aria-label={strings.viewAriaLabel}>
            <ToggleGroupItem value="flat">{strings.flatView}</ToggleGroupItem>
            <ToggleGroupItem value="user">{strings.userView}</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <FieldGroup className="admin-recharge-filter-row grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field className="admin-recharge-filter-field"><FieldLabel htmlFor="admin-recharge-status">{strings.statusFilterLabel}</FieldLabel>
            <Select name="admin_recharge_status"
              value={status}
              onValueChange={(value) => { setPage(1); setStatus(value as AdminRechargeStatus | 'all') }}><SelectTrigger id="admin-recharge-status" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>
              {STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item === 'all' ? strings.allStatuses : statusLabel(item, strings)}</SelectItem>)}
            </SelectGroup></SelectContent></Select>
          </Field>
          <Field className="admin-recharge-filter-field"><FieldLabel htmlFor="admin-recharge-start-date">{strings.startDateFilterLabel}</FieldLabel>
            <Input
              id="admin-recharge-start-date"
              name="admin_recharge_start_date"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => { setPage(1); setStartDate(event.target.value) }}
            />
          </Field>
          <Field className="admin-recharge-filter-field"><FieldLabel htmlFor="admin-recharge-end-date">{strings.endDateFilterLabel}</FieldLabel>
            <Input
              id="admin-recharge-end-date"
              name="admin_recharge_end_date"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => { setPage(1); setEndDate(event.target.value) }}
            />
          </Field>
          <Field className="admin-recharge-filter-field"><FieldLabel htmlFor="admin-recharge-sort">{strings.sortFilterLabel}</FieldLabel>
            <Select name="admin_recharge_sort"
              value={sort}
              onValueChange={(value) => setSort(value as AdminRechargeSort)}><SelectTrigger id="admin-recharge-sort" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>
              {SORT_OPTIONS.map((item) => <SelectItem key={item} value={item}>{sortLabel(item, strings)}</SelectItem>)}
            </SelectGroup></SelectContent></Select>
          </Field>
          <Field className="admin-recharge-filter-field"><FieldLabel htmlFor="admin-recharge-order">{strings.orderFilterLabel}</FieldLabel>
            <Select name="admin_recharge_order"
              value={order}
              onValueChange={(value) => setOrder(value as 'asc' | 'desc')}><SelectTrigger id="admin-recharge-order" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>
              <SelectItem value="desc">{strings.orderDesc}</SelectItem>
              <SelectItem value="asc">{strings.orderAsc}</SelectItem>
            </SelectGroup></SelectContent></Select>
          </Field>
        </FieldGroup>
      </div>

      <AdminLoadingRegion loadState={loadState} errorLabel={error} loadingLabel={strings.loading}>
        {view === 'user' ? (
          <div className="admin-recharge-group-grid grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(data?.groups ?? []).map((group) => (
              <Button variant="outline" key={group.user.id} type="button" className="admin-recharge-user-card h-auto w-full items-start whitespace-normal text-left flex flex-col gap-2 p-4 [&_span]:text-xs [&_span]:text-muted-foreground" onClick={() => openUser(group.user.id)}>
                <strong>{userLabel(group.user)}</strong>
                <span>{formatTemplate(strings.groupSummary, { orders: group.orderCount, paid: group.paidOrderCount, refunded: group.refundedOrderCount })}</span>
                <span>{formatTemplate(strings.groupCredits, { credits: group.totalCredits.toLocaleString(), amount: (group.totalMoneyCents / 100).toFixed(2) })}</span>
              </Button>
            ))}
          </div>
        ) : (
          <div className="admin-recharge-table-scroll min-w-0 max-w-full rounded-lg border">
            <Table className="admin-recharge-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{strings.table.user}</TableHead>
                  <TableHead>{strings.table.order}</TableHead>
                  <TableHead>{strings.table.status}</TableHead>
                  <TableHead>{strings.table.amount}</TableHead>
                  <TableHead>{strings.table.finalAmount}</TableHead>
                  <TableHead>{strings.table.createdAt}</TableHead>
                  <TableHead>{strings.table.paidAt}</TableHead>
                  <TableHead>{strings.table.refundedAt}</TableHead>
                  <TableHead>{strings.table.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((item) => (
                  <TableRow key={item.outTradeNo}>
                    <TableCell><Button type="button" variant="link" size="sm" className="h-auto p-0 admin-recharge-user-link" onClick={() => openUser(item.user.id)}>{userLabel(item.user)}</Button></TableCell>
                    <TableCell>
                      <div className="admin-recharge-order-cell flex flex-col gap-1 [&_code]:text-xs">
                        <span>{formatTemplate(strings.orderCredits, { credits: item.credits.toLocaleString(), months: item.months })}</span>
                        <code>{item.outTradeNo}</code>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge tone={item.status === 'paid' ? 'success' : item.status === 'failed' ? 'error' : item.status === 'pending' || item.status === 'refunding' ? 'warning' : 'neutral'}>{statusLabel(item.status, strings)}</StatusBadge></TableCell>
                    <TableCell>{formatTemplate(strings.amountLdc, { amount: item.money })}</TableCell>
                    <TableCell>
                      <div className="admin-recharge-order-cell flex flex-col gap-1 [&_code]:text-xs">
                        <span>{formatTemplate(strings.finalAmountLdc, { amount: (item.finalMoneyCents / 100).toFixed(2) })}</span>
                        {item.monthEndClampApplied ? (
                          <span className="admin-recharge-order-meta text-xs text-muted-foreground">{strings.monthEndClampApplied}</span>
                        ) : (
                          <span className="admin-recharge-order-meta text-xs text-muted-foreground">{strings.monthEndClampInactive}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(item.createdAt)}</TableCell>
                    <TableCell>{formatDate(item.paidAt)}</TableCell>
                    <TableCell>{formatDate(item.refundedAt)}</TableCell>
                    <TableCell>
                      {item.status === 'paid' ? (
                        <div className="admin-recharge-actions flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" className="admin-recharge-action-button" onClick={() => openRefundDialog(item, 'refund')}>{strings.actions.refund}</Button>
                          <Button type="button" size="sm" variant="outline" className="admin-recharge-action-button" onClick={() => openRefundDialog(item, 'refundOnly')}>{strings.actions.refundOnly}</Button>
                        </div>
                      ) : (
                        <span className="admin-recharge-action-state">{statusActionLabel(item, strings)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AdminLoadingRegion>

      <div className="admin-recharge-pagination flex flex-wrap items-center justify-center gap-3 border-t pt-4 text-sm">
        <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{strings.actions.previousPage}</Button>
        <span>{formatTemplate(strings.paginationSummary, { page: data?.page ?? page, total: data?.total ?? 0 })}</span>
        <Button type="button" variant="outline" disabled={!data || page * data.perPage >= data.total} onClick={() => setPage((value) => value + 1)}>{strings.actions.nextPage}</Button>
      </div>

      <AdminRechargeRefundDialog
        refundTarget={refundTarget}
        totpStatus={totpStatus}
        totpCode={totpCode}
        refundBusy={refundBusy}
        refundError={refundError}
        totpStatusLoading={totpStatusLoading}
        totpStatusError={totpStatusError}
        onTotpCodeChange={(value) => {
          setTotpCode(value)
          setRefundError(null)
        }}
        onClose={closeRefundDialog}
        onExecuteRefund={() => void executeRefund()}
        onOpenSystemSettings={openSystemSettings}
      />
    </section>
  )
}

interface AdminRechargeRefundDialogProps {
  refundTarget: { order: AdminRechargeOrder; kind: RefundKind } | null
  totpStatus: AdminTotpStatus | null
  totpCode: string
  refundBusy: boolean
  refundError: string | null
  totpStatusLoading?: boolean
  totpStatusError?: string | null
  onTotpCodeChange: (value: string) => void
  onClose: () => void
  onExecuteRefund: () => void
  onOpenSystemSettings: () => void
  chrome?: 'dialog' | 'plain'
}

export function AdminRechargeRefundDialog({
  refundTarget,
  totpStatus,
  totpCode,
  refundBusy,
  refundError,
  totpStatusLoading,
  totpStatusError,
  onTotpCodeChange,
  onClose,
  onExecuteRefund,
  onOpenSystemSettings,
}: AdminRechargeRefundDialogProps): JSX.Element {
  return (
    <Dialog open={refundTarget != null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <AdminRechargeRefundDialogBody
          refundTarget={refundTarget}
          totpStatus={totpStatus}
          totpCode={totpCode}
          refundBusy={refundBusy}
          refundError={refundError}
          totpStatusLoading={totpStatusLoading}
          totpStatusError={totpStatusError}
          onTotpCodeChange={onTotpCodeChange}
          onClose={onClose}
          onExecuteRefund={onExecuteRefund}
          onOpenSystemSettings={onOpenSystemSettings}
        />
      </DialogContent>
    </Dialog>
  )
}

export function AdminRechargeRefundDialogBody({
  refundTarget,
  totpStatus,
  totpCode,
  refundBusy,
  refundError,
  totpStatusLoading = false,
  totpStatusError = null,
  onTotpCodeChange,
  onClose,
  onExecuteRefund,
  onOpenSystemSettings,
  chrome = 'dialog',
}: AdminRechargeRefundDialogProps): JSX.Element {
  const strings = useTranslate().admin.recharges
  const refundDialogNeedsStatus = totpStatus == null
  const refundDialogUnavailable = totpStatus?.available === false
  const refundDialogNeedsSetup = totpStatus?.enabled === false
  const refundDialogBlocked = refundDialogNeedsStatus || refundDialogUnavailable || refundDialogNeedsSetup
  const refundDialogStatus = refundError ?? (refundBusy ? strings.confirm.processing : null)
  const title = refundDialogBlocked
    ? refundDialogNeedsStatus
      ? strings.confirm.totpStatusTitle
      : refundDialogUnavailable
        ? strings.confirm.totpUnavailableTitle
      : strings.confirm.totpSetupTitle
    : refundTarget?.kind === 'refund' ? strings.confirm.refundTitle : strings.confirm.refundOnlyTitle
  const description = refundDialogBlocked
    ? refundDialogNeedsStatus
      ? strings.confirm.totpStatusDescription
      : refundDialogUnavailable
        ? strings.confirm.totpUnavailableDescription
      : strings.confirm.totpSetupDescription
    : strings.confirm.description
  const blockedCallout = refundDialogNeedsStatus
    ? totpStatusError
      ? formatTemplate(strings.confirm.totpStatusErrorCallout, { message: totpStatusError })
      : totpStatusLoading
        ? strings.confirm.totpStatusLoadingCallout
        : strings.confirm.totpStatusUnknownCallout
    : refundDialogUnavailable
      ? strings.confirm.totpUnavailableCallout
    : strings.confirm.totpSetupCallout
  const header = chrome === 'dialog' ? (
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
  ) : (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
  const footerContent = (
    <>
      <Button type="button" variant="outline" disabled={refundBusy} onClick={onClose}>{strings.actions.cancel}</Button>
      {refundDialogNeedsSetup && !refundDialogUnavailable ? (
        <Button type="button" onClick={onOpenSystemSettings}>{strings.actions.openTotpSettings}</Button>
      ) : refundDialogBlocked ? null : (
        <Button type="button" disabled={refundBusy || totpCode.length !== 6} onClick={onExecuteRefund}>
          {refundBusy ? strings.actions.processing : strings.actions.confirm}
        </Button>
      )}
    </>
  )
  return (
    <>
      {header}
      {refundDialogBlocked ? (
        <div className="admin-recharge-setup-callout rounded-lg border bg-muted/50 p-3 text-sm" role="status" aria-live="polite">
          {blockedCallout}
        </div>
      ) : (
        <label className="admin-recharge-totp-field flex flex-col gap-2 text-sm font-medium" htmlFor="admin-recharge-refund-totp">
          <span>{strings.confirm.totpLabel}</span>
          <Input
            id="admin-recharge-refund-totp"
            name="admin_recharge_refund_totp"
            type="text"
            className="admin-recharge-totp-input"
            value={totpCode}
            onChange={(event) => onTotpCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={strings.confirm.totpPlaceholder}
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            disabled={refundBusy}
          />
        </label>
      )}
      {refundDialogStatus && (
        <p
          className={refundError ? 'admin-recharge-dialog-error text-sm text-destructive' : 'admin-recharge-dialog-status text-sm text-muted-foreground'}
          role="status"
          aria-live="polite"
        >
          {refundDialogStatus}
        </p>
      )}
      {chrome === 'dialog' ? <DialogFooter>{footerContent}</DialogFooter> : <div>{footerContent}</div>}
    </>
  )
}

function sortLabel(sort: AdminRechargeSort, strings: AdminTranslations['recharges']): string {
  return strings.sort[sort]
}

function statusLabel(status: AdminRechargeStatus, strings: AdminTranslations['recharges']): string {
  return strings.status[status]
}

function statusActionLabel(item: AdminRechargeOrder, strings: AdminTranslations['recharges']): string {
  if (item.status === 'paid') return strings.actions.refund
  if (item.status === 'refunding' && item.refundActor === 'system:auto') return strings.statusAction.refundingAuto
  if (item.status === 'refunded' && item.refundActor === 'system:auto') return strings.statusAction.refundedAuto
  return strings.statusAction[item.status]
}

export function refundErrorMessage(message: string, strings: AdminTranslations['recharges']): string {
  const normalized = message.trim()
  if (/admin TOTP is not bound/i.test(normalized)) return strings.errors.totpNotBound
  if (/invalid TOTP code/i.test(normalized)) return strings.errors.invalidTotp
  if (/TOTP is temporarily locked/i.test(normalized)) return strings.errors.totpLocked
  if (/DEV_OPEN_ADMIN/i.test(normalized)) return strings.errors.devOpenAdmin
  return normalized || strings.errors.refundFailed
}

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (current, [key, value]) => current.replaceAll(`{${key}}`, String(value)),
    template,
  )
}
