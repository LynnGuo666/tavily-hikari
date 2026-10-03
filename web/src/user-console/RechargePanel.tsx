import { Empty, EmptyDescription } from '@/components/ui/empty'
import type { RechargeConfig, RechargeOrder, RechargeQuote } from '../api'
import type { UserDashboard } from '../api'
import { CircleHelp, Eye, Minus, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Icon } from '../lib/icons'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge, type StatusTone } from '../components/StatusBadge'
import { cn } from '@/lib/utils'
import { useViewportMode } from '../lib/responsive'
import { AnchoredInfoDisclosure } from '@/components/anchored-info-disclosure'
import {
  DEFAULT_RECHARGE_UNIT_CREDITS,
  TEST_RECHARGE_CREDITS,
  TEST_RECHARGE_MONTHS,
  isTestRechargeSelection,
  nextRechargeCredits,
  normalizeRechargeMonths,
  normalizeRechargeSelection,
} from './rechargeControls'
import type React from 'react'

const DEFAULT_RECHARGE_MAX_CREDITS = 20_000
const DEFAULT_RECHARGE_MAX_MONTHS = 12

interface RechargePanelText {
  title: string
  description: string
  enabled: string
  disabled: string
  currentEntitlement: string
  currentMonthFinal: string
  effectiveUntil: string
  noEntitlement: string
  credits: string
  months: string
  quotaDelta: string
  hourlyDelta: string
  dailyDelta: string
  monthlyDelta: string
  testPrice: string
  amount: string
  discountedAmount: string
  discountNotice: string
  clampNotice: string
  preview: string
  previewTitle: string
  previewDescription: string
  previewScopeNote: string
  previewMonth: string
  previewCurrentQuota: string
  previewCurrentQuotaHint: string
  previewDelta: string
  previewDeltaHint: string
  previewExpectedQuota: string
  previewExpectedQuotaHint: string
  previewFieldHelpLabel: string
  previewAfterExpiry: string
  closePreview: string
  create: string
  creating: string
  unavailable: string
  orders: string
  noOrders: string
  status: Record<string, string>
  orderStatusDetail: Record<string, string>
}

interface RechargePanelProps {
  text: RechargePanelText
  language: 'en' | 'zh'
  dashboard: UserDashboard | null
  config: RechargeConfig | null
  orders: RechargeOrder[]
  credits: number
  months: number
  quote: RechargeQuote | null
  busy: boolean
  error: string | null
  onCreditsChange: (value: number) => void
  onMonthsChange: (value: number) => void
  onCreateOrder: () => void
  showSummary?: boolean
  showOrders?: boolean
  ordersLimit?: number
}

interface RechargePreviewMonth {
  monthStart: number
  currentQuota: number
  delta: number
  expectedQuota: number
  afterExpiry: boolean
  clampApplied: boolean
}

function formatRechargeMoney(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function rechargeStatusTone(status: string): StatusTone {
  if (status === 'paid') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'pending' || status === 'expired' || status === 'refunding') return 'warning'
  return 'neutral'
}

function rechargeOrderStatusDetail(
  order: RechargeOrder,
  text: RechargePanelText,
): string | null {
  if (order.status === 'pending') {
    return formatTemplate(text.orderStatusDetail.pending, {
      time: formatTimestamp(order.payExpiresAt),
    })
  }
  if (order.status === 'paid' && order.paidAt != null) {
    return formatTemplate(text.orderStatusDetail.paid, {
      time: formatTimestamp(order.paidAt),
    })
  }
  if (order.status === 'failed') return text.orderStatusDetail.failed
  if (order.status === 'expired') {
    return formatTemplate(text.orderStatusDetail.expired, {
      time: formatTimestamp(order.payExpiresAt),
    })
  }
  if (order.status === 'cancelled') {
    return formatTemplate(text.orderStatusDetail.cancelled, {
      time: formatTimestamp(order.cancelledAt ?? order.cancelAfterAt),
    })
  }
  if (order.status === 'refunding') {
    if (order.refundRetryAfterAt != null) {
      return `${text.orderStatusDetail.refunding} ${formatTemplate(text.orderStatusDetail.refundRetryAt, {
        time: formatTimestamp(order.refundRetryAfterAt),
      })}`
    }
    return text.orderStatusDetail.refunding
  }
  if (order.status === 'refunded') return text.orderStatusDetail.refunded
  if (order.status === 'refundOnly') return text.orderStatusDetail.refundOnly
  return null
}

export default function RechargePanel({
  text,
  language,
  dashboard,
  config,
  orders,
  credits,
  months,
  quote,
  busy,
  error,
  onCreditsChange,
  onMonthsChange,
  onCreateOrder,
  showSummary = true,
  showOrders = true,
  ordersLimit = 3,
}: RechargePanelProps): React.JSX.Element {
  const [previewOpen, setPreviewOpen] = useState(false)
  const viewportMode = useViewportMode()
  const unitCredits = config?.unitCredits ?? DEFAULT_RECHARGE_UNIT_CREDITS
  const minCredits = config?.minCredits ?? unitCredits
  const maxCredits = config?.maxCredits ?? DEFAULT_RECHARGE_MAX_CREDITS
  const creditsStep = config?.creditsStep ?? unitCredits
  const minMonths = config?.minMonths ?? 1
  const maxMonths = config?.maxMonths ?? DEFAULT_RECHARGE_MAX_MONTHS
  const stepConfig = {
    minCredits,
    maxCredits,
    creditsStep,
    minMonths,
    maxMonths,
    testPriceEnabled: config?.testPriceEnabled ?? false,
  }
  const { credits: normalizedCredits, months: normalizedMonths } = normalizeRechargeSelection(
    credits,
    months,
    stepConfig,
  )
  const isTestOffer = config?.testPriceEnabled && isTestRechargeSelection(normalizedCredits, normalizedMonths)
  const currentEntitlement = dashboard?.recharge.currentEntitlementCredits
    ?? config?.currentEntitlementCredits
    ?? 0
  const currentMonthFinal = dashboard?.recharge.currentEntitlementMonthlyDelta
    ?? config?.currentEntitlementMonthlyDelta
    ?? currentEntitlement
  const effectiveUntil = dashboard?.recharge.effectiveUntilMonthStart
    ?? config?.effectiveUntilMonthStart
    ?? null
  const currentMonthStart = dashboard?.recharge.currentMonthStart
    ?? config?.currentMonthStart
    ?? currentBrowserMonthStartSeconds()
  const previewMonths = useMemo(() => buildRechargePreviewMonths({
    currentMonthStart,
    currentEntitlement,
    currentMonthFinal,
    effectiveUntil,
    quote,
  }), [currentEntitlement, currentMonthFinal, currentMonthStart, effectiveUntil, quote])
  const amountCents = quote?.finalOrderMoneyCents ?? 0

  const applyCreditsChange = (value: number) => {
    onCreditsChange(value)
    if (config?.testPriceEnabled && value === TEST_RECHARGE_CREDITS) {
      onMonthsChange(TEST_RECHARGE_MONTHS)
    }
  }

  return (
    <Card className="surface panel user-console-recharge-section @container gap-0 py-0">
      <CardHeader className="panel-header flex flex-row items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base font-semibold">{text.title}</CardTitle>
          <CardDescription className="mt-1">{text.description}</CardDescription>
        </div>
        {config?.enabled ? (
          <StatusBadge tone="success">{text.enabled}</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">{text.disabled}</StatusBadge>
        )}
      </CardHeader>

      <div className={cn('p-4', showOrders ? 'grid gap-5 @3xl:grid-cols-[1fr_320px]' : 'user-console-recharge-grid-composer')}>
        <div className="flex flex-col gap-4">
          {showSummary ? (
            <div className="grid gap-3 bg-muted/30 p-4 text-sm @xs:grid-cols-2 @xl:grid-cols-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{text.currentEntitlement}</span>
                <strong className="font-semibold tabular-nums">{formatNumber(currentEntitlement)}</strong>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{text.currentMonthFinal}</span>
                <strong className="font-semibold tabular-nums">{formatNumber(currentMonthFinal)}</strong>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{text.effectiveUntil}</span>
                <strong className="font-semibold tabular-nums">{effectiveUntil ? formatTimestamp(effectiveUntil) : text.noEntitlement}</strong>
              </div>
              {quote?.monthEndClampApplied ? <p className="text-xs text-warning @xl:col-span-3">{text.clampNotice}</p> : null}
              {config?.testPriceEnabled && text.testPrice ? (
                <p className="text-xs text-warning @xl:col-span-3">{text.testPrice}</p>
              ) : null}
            </div>
          ) : null}

          {config?.enabled ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 @xs:grid-cols-2">
                <Field className="gap-2">
                  <FieldLabel className="text-xs font-medium text-muted-foreground">{text.credits}</FieldLabel>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => applyCreditsChange(nextRechargeCredits(normalizedCredits, -1, stepConfig))}
                      disabled={normalizedCredits <= (config?.testPriceEnabled ? TEST_RECHARGE_CREDITS : minCredits)}
                      aria-label={`Decrease ${text.credits}`}
                    >
                      <Minus size={16} strokeWidth={2.2} aria-hidden="true" />
                    </Button>
                    <Input
                      className="min-w-0 flex-1 text-center tabular-nums"
                      type="text"
                      readOnly
                      value={formatNumber(normalizedCredits)}
                      aria-label={text.credits}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => applyCreditsChange(nextRechargeCredits(normalizedCredits, 1, stepConfig))}
                      disabled={normalizedCredits >= maxCredits}
                      aria-label={`Increase ${text.credits}`}
                    >
                      <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
                    </Button>
                  </div>
                </Field>
                <Field className="gap-2">
                  <FieldLabel className="text-xs font-medium text-muted-foreground">{text.months}</FieldLabel>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => onMonthsChange(normalizeRechargeMonths(normalizedMonths - 1, normalizedCredits, stepConfig))}
                      disabled={isTestOffer || normalizedMonths <= minMonths}
                      aria-label={`Decrease ${text.months}`}
                    >
                      <Minus size={16} strokeWidth={2.2} aria-hidden="true" />
                    </Button>
                    <Input
                      className="min-w-0 flex-1 text-center tabular-nums"
                      type="text"
                      readOnly
                      value={formatNumber(normalizedMonths)}
                      aria-label={text.months}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => onMonthsChange(normalizeRechargeMonths(normalizedMonths + 1, normalizedCredits, stepConfig))}
                      disabled={isTestOffer || normalizedMonths >= maxMonths}
                      aria-label={`Increase ${text.months}`}
                    >
                      <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
                    </Button>
                  </div>
                </Field>
              </div>

              <div className="grid gap-2 @xs:grid-cols-3" aria-label={text.quotaDelta}>
                {(quote
                  ? [
                      { kind: 'hourly' as const, label: text.hourlyDelta, value: quote.currentMonthFinalHourlyDelta },
                      { kind: 'daily' as const, label: text.dailyDelta, value: quote.currentMonthFinalDailyDelta },
                      { kind: 'monthly' as const, label: text.monthlyDelta, value: quote.currentMonthFinalMonthlyDelta },
                    ]
                  : [
                      { kind: 'hourly' as const, label: text.hourlyDelta, value: 0 },
                      { kind: 'daily' as const, label: text.dailyDelta, value: 0 },
                      { kind: 'monthly' as const, label: text.monthlyDelta, value: 0 },
                    ]).map(({ kind, label, value }) => (
                  <div key={label} className="flex min-w-0 flex-col gap-1 px-3 py-2 text-sm @xl:flex-row @xl:items-center @xl:justify-between">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <strong className="font-semibold tabular-nums">{formatRechargeDeltaValue(kind, Number(value), language)}</strong>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 bg-muted/30 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{quote?.monthEndClampApplied ? text.discountedAmount : text.amount}</span>
                  <strong className="text-lg font-semibold tabular-nums">{formatRechargeMoney(amountCents / 100)} LDC</strong>
                </div>
                {quote?.monthEndClampApplied ? (
                  <p className="text-xs text-warning">{text.discountNotice}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={busy} onClick={() => setPreviewOpen(true)}>
                    <Eye size={16} strokeWidth={2.2} aria-hidden="true" />
                    {text.preview}
                  </Button>
                  <Button type="button" disabled={busy || !quote} aria-busy={busy} onClick={onCreateOrder}>
                    {busy
                      ? <Spinner className="size-4" aria-label={undefined} />
                      : <Icon icon="mdi:credit-card-outline" width={16} height={16} aria-hidden="true" />}
                    {busy ? text.creating : text.create}
                  </Button>
                </div>
              </div>
              {error ? <p className="text-sm text-destructive" role="status" aria-live="polite">{error}</p> : null}
            </div>
          ) : (
            <Empty className="bg-muted/30 p-4"><EmptyDescription>{text.unavailable}</EmptyDescription></Empty>
          )}
        </div>

        {showOrders ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{text.orders}</h3>
            <div className="user-console-recharge-orders-panel flex flex-col gap-3">
              {orders.length === 0 ? (
                <Empty className="bg-muted/30 p-4"><EmptyDescription>{text.noOrders}</EmptyDescription></Empty>
              ) : (
                <ul className="flex flex-col divide-y">
                  {orders.slice(0, ordersLimit).map((order) => (
                    <li key={order.outTradeNo} className="flex items-start justify-between gap-3 p-3 text-sm">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <strong className="font-semibold tabular-nums">{formatNumber(order.credits)} × {order.months}</strong>
                        <span className="text-xs text-muted-foreground">{order.money} LDC · {formatTimestamp(order.createdAt)}{order.monthEndClampApplied ? ` · ${text.discountedAmount}` : ''}</span>
                        {rechargeOrderStatusDetail(order, text) ? (
                          <span className="text-xs text-muted-foreground">{rechargeOrderStatusDetail(order, text)}</span>
                        ) : null}
                      </div>
                      <StatusBadge tone={rechargeStatusTone(order.status)}>
                        {text.status[order.status] ?? order.status}
                      </StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {viewportMode === 'small' ? (
        <Drawer open={previewOpen} onOpenChange={setPreviewOpen} shouldScaleBackground={false}>
          <DrawerContent>
            <DrawerHeader className="shrink-0">
              <div className="flex items-center justify-between gap-2">
                <DrawerTitle>{text.previewTitle}</DrawerTitle>
                <RechargePreviewMobileHelp text={text} />
              </div>
              <DrawerDescription>{text.previewDescription}</DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              <RechargePreviewBody
                text={text}
                quote={quote}
                credits={normalizedCredits}
                months={normalizedMonths}
                rows={previewMonths}
              />
            </div>
            <DrawerFooter className="shrink-0">
              <DrawerClose asChild>
                <Button type="button" variant="outline">{text.closePreview}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{text.previewTitle}</DialogTitle>
              <DialogDescription>{text.previewDescription}</DialogDescription>
            </DialogHeader>
            <RechargePreviewBody
              text={text}
              quote={quote}
              credits={normalizedCredits}
              months={normalizedMonths}
              rows={previewMonths}
            />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

function formatRechargeDeltaValue(kind: 'hourly' | 'daily' | 'monthly', value: number, language: 'en' | 'zh'): string {
  const formatted = formatNumber(value)
  if (language === 'zh') {
    if (kind === 'hourly') return `+${formatted} 次`
    return `+${formatted} 积分`
  }

  if (kind === 'hourly') return `+${formatted} requests`
  return `+${formatted} credits`
}

function currentBrowserMonthStartSeconds(): number {
  const now = new Date()
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000)
}

function addMonthsToMonthStart(monthStart: number, offset: number): number {
  const month = new Date(monthStart * 1000)
  return Math.floor(new Date(month.getFullYear(), month.getMonth() + offset, 1).getTime() / 1000)
}

function RechargePreviewColumnLabel({
  label,
  hint,
}: {
  label: string
  hint: string
}): React.JSX.Element {
  return (
    <AnchoredInfoDisclosure
      className="text-xs font-medium text-muted-foreground underline decoration-dotted underline-offset-4"
      aria-label={label}
      bubbleContent={hint}
      bubbleClassName="user-console-recharge-preview-help-bubble max-w-64 rounded-lg bg-foreground px-3 py-2 text-xs leading-relaxed text-background shadow-lg"
    >
      {label}
    </AnchoredInfoDisclosure>
  )
}

function RechargePreviewFieldHelp({ text }: { text: RechargePanelText }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 text-left">
      <p><strong className="font-semibold">{text.previewCurrentQuota}</strong>{text.previewCurrentQuotaHint}</p>
      <p><strong className="font-semibold">{text.previewDelta}</strong>{text.previewDeltaHint}</p>
      <p><strong className="font-semibold">{text.previewExpectedQuota}</strong>{text.previewExpectedQuotaHint}</p>
    </div>
  )
}

function RechargePreviewMobileHelp({ text }: { text: RechargePanelText }): React.JSX.Element {
  return (
    <AnchoredInfoDisclosure
      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
      aria-label={text.previewFieldHelpLabel}
      bubbleContent={<RechargePreviewFieldHelp text={text} />}
      bubbleClassName="user-console-recharge-preview-help-bubble max-w-72 rounded-lg bg-foreground px-3 py-2.5 text-xs leading-relaxed text-background shadow-lg"
    >
      <CircleHelp size={18} strokeWidth={2.1} aria-hidden="true" />
    </AnchoredInfoDisclosure>
  )
}

function buildRechargePreviewMonths(input: {
  currentMonthStart: number
  currentEntitlement: number
  currentMonthFinal: number
  effectiveUntil: number | null
  quote: RechargeQuote | null
}): RechargePreviewMonth[] {
  const rows: RechargePreviewMonth[] = []
  const currentEffectEnd = input.effectiveUntil ?? addMonthsToMonthStart(input.currentMonthStart, 1)
  const quote = input.quote
  const scheduleEnd = quote ? addMonthsToMonthStart(quote.quoteMonthStart, quote.requestedMonths - 1) : currentEffectEnd
  const previewEnd = Math.max(currentEffectEnd, scheduleEnd)
  for (let monthStart = input.currentMonthStart; monthStart <= previewEnd; monthStart = addMonthsToMonthStart(monthStart, 1)) {
    const scheduleRow = quote?.schedule.find((item) => item.monthStart === monthStart)
    const beforeQuota = monthStart === input.currentMonthStart
      ? input.currentMonthFinal
      : monthStart < currentEffectEnd ? input.currentEntitlement : 0
    const delta = scheduleRow?.monthlyDelta ?? 0
    rows.push({
      monthStart,
      currentQuota: beforeQuota,
      delta,
      expectedQuota: beforeQuota + delta,
      afterExpiry: monthStart > currentEffectEnd,
      clampApplied: scheduleRow?.monthEndClampApplied ?? false,
    })
  }
  return rows
}

function formatMonthLabel(monthStart: number): string {
  try {
    return new Date(monthStart * 1000).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
    })
  } catch {
    return String(monthStart)
  }
}

function RechargePreviewBody({
  text,
  quote,
  credits,
  months,
  rows,
}: {
  text: RechargePanelText
  quote: RechargeQuote | null
  credits: number
  months: number
  rows: RechargePreviewMonth[]
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{text.credits}</span>
          <strong className="font-semibold tabular-nums">{formatNumber(credits)}</strong>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{text.months}</span>
          <strong className="font-semibold tabular-nums">{formatNumber(months)}</strong>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{quote?.monthEndClampApplied ? text.discountedAmount : text.amount}</span>
          <strong className="font-semibold tabular-nums">{formatRechargeMoney((quote?.finalOrderMoneyCents ?? 0) / 100)} LDC</strong>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {quote?.monthEndClampApplied ? text.discountNotice : text.previewScopeNote}
      </p>

      <div className="overflow-x-auto rounded-lg border border-border text-sm" role="table">
        <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr] gap-2 border-b bg-muted/50 px-3 py-2 font-medium sm:grid" role="row">
          <div role="columnheader">{text.previewMonth}</div>
          <div role="columnheader">
            <RechargePreviewColumnLabel label={text.previewCurrentQuota} hint={text.previewCurrentQuotaHint} />
          </div>
          <div role="columnheader">
            <RechargePreviewColumnLabel label={text.previewDelta} hint={text.previewDeltaHint} />
          </div>
          <div role="columnheader">
            <RechargePreviewColumnLabel label={text.previewExpectedQuota} hint={text.previewExpectedQuotaHint} />
          </div>
        </div>
        {rows.map((row) => (
          <div
            key={row.monthStart}
            className={cn(
              'grid grid-cols-3 gap-3 border-b px-3 py-3 last:border-b-0 sm:grid-cols-[1.4fr_1fr_1fr_1fr]',
              row.afterExpiry && 'bg-muted/20 text-muted-foreground',
            )}
            role="row"
          >
            <span role="cell" className="col-span-full flex flex-col gap-0.5 sm:col-span-1">
              {formatMonthLabel(row.monthStart)}
              {row.afterExpiry ? <em className="not-italic text-xs">{text.previewAfterExpiry}</em> : null}
              {row.clampApplied ? <em className="not-italic text-xs text-warning">{text.clampNotice}</em> : null}
            </span>
            <strong role="cell" data-label={text.previewCurrentQuota} className="flex flex-col gap-1 font-semibold tabular-nums">
              <span className="text-xs font-normal text-muted-foreground sm:hidden">{text.previewCurrentQuota}</span>
              {formatNumber(row.currentQuota)}
            </strong>
            <strong role="cell" data-label={text.previewDelta} className="flex flex-col gap-1 font-semibold tabular-nums">
              <span className="text-xs font-normal text-muted-foreground sm:hidden">{text.previewDelta}</span>
              +{formatNumber(row.delta)}
            </strong>
            <strong role="cell" data-label={text.previewExpectedQuota} className="flex flex-col gap-1 font-semibold tabular-nums">
              <span className="text-xs font-normal text-muted-foreground sm:hidden">{text.previewExpectedQuota}</span>
              {formatNumber(row.expectedQuota)}
            </strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatTimestamp(ts: number): string {
  try {
    return new Date(ts * 1000).toLocaleString()
  } catch {
    return String(ts)
  }
}

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (current, [key, value]) => current.replaceAll(`{${key}}`, String(value)),
    template,
  )
}
