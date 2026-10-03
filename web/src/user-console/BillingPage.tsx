import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { cn } from '@/lib/utils'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type React from 'react'

import type {
  RechargeConfig,
  RechargeOrder,
  RechargeQuote,
  UserBillingSummary,
} from '../api'
import { StatusBadge, type StatusTone } from '../components/StatusBadge'
import { useViewportMode } from '../lib/responsive'
import RechargePanel from './RechargePanel'

interface BillingText {
  title: string
  description: string
  summaryTitle: string
  summaryDescription: string
  currentTotal: string
  baseEntitlements: string
  monthlyAdjustments: string
  rechargePackage: string
  rechargeCredits: string
  emptyDelta: string
  blockAllNotice: string
  pricingTitle: string
  pricingDescription: string
  unitPrice: string
  creditStep: string
  monthsRange: string
  testPriceEnabled: string
  unavailableNotice: string
  timelineTitle: string
  timelineDescription: string
  timelinePrevious: string
  timelineCurrent: string
  timelineFuture: string
  timelineBack: string
  timelineForward: string
  timelineSelectMonth: string
  timelinePersistent: string
  timelineAdjustments: string
  timelineRecharge: string
  timelineEffective: string
  timelineRechargeCredits: string
  timelineNoFuture: string
  timelineNoScheduledChanges: string
  ordersTitle: string
  ordersDescription: string
  orderCreatedAt: string
  orderImpact: string
  orderClampApplied: string
  ordersPageSummary: string
  ordersPreviousPage: string
  ordersNextPage: string
}

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

interface BillingPageProps {
  text: BillingText
  rechargeText: RechargePanelText
  summary: UserBillingSummary | null
  config: RechargeConfig | null
  orders: RechargeOrder[]
  loading: boolean
  credits: number
  months: number
  quote: RechargeQuote | null
  busy: boolean
  error: string | null
  language: 'en' | 'zh'
  onCreditsChange: (value: number) => void
  onMonthsChange: (value: number) => void
  onCreateOrder: () => void
}

interface BillingQuota {
  hourly: number
  daily: number
  monthly: number
}

type BillingTimelineMonth = NonNullable<BillingPageProps['summary']>['timeline'][number]

const ORDERS_PER_PAGE = 10

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function formatMoneyLdc(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatMonthLabel(monthStart: number, language: 'en' | 'zh'): string {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
  }).format(new Date(monthStart * 1000))
}

function formatDateTime(value: number, language: 'en' | 'zh'): string {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value * 1000))
}

function formatMonthsRange(minMonths: number, maxMonths: number, language: 'en' | 'zh'): string {
  const range = minMonths === maxMonths ? `${minMonths}` : `${minMonths} - ${maxMonths}`
  return language === 'zh' ? `${range} 个月` : `${range} months`
}

function formatCreditStepValue(value: number, language: 'en' | 'zh'): string {
  const formatted = formatNumber(value)
  return language === 'zh' ? `${formatted} 月积分` : `${formatted} monthly credits`
}

function orderStatusTone(status: string): StatusTone {
  if (status === 'paid') return 'success'
  if (status === 'pending' || status === 'expired' || status === 'refunding') return 'warning'
  if (status === 'failed') return 'error'
  return 'neutral'
}

function orderStatusDetail(
  order: RechargeOrder,
  text: RechargePanelText,
  language: 'en' | 'zh',
): string | null {
  if (order.status === 'pending') {
    return formatTemplate(text.orderStatusDetail.pending, {
      time: formatDateTime(order.payExpiresAt, language),
    })
  }
  if (order.status === 'paid' && order.paidAt != null) {
    return formatTemplate(text.orderStatusDetail.paid, {
      time: formatDateTime(order.paidAt, language),
    })
  }
  if (order.status === 'failed') return text.orderStatusDetail.failed
  if (order.status === 'expired') {
    return formatTemplate(text.orderStatusDetail.expired, {
      time: formatDateTime(order.payExpiresAt, language),
    })
  }
  if (order.status === 'cancelled') {
    return formatTemplate(text.orderStatusDetail.cancelled, {
      time: formatDateTime(order.cancelledAt ?? order.cancelAfterAt, language),
    })
  }
  if (order.status === 'refunding') {
    if (order.refundRetryAfterAt != null) {
      return `${text.orderStatusDetail.refunding} ${formatTemplate(text.orderStatusDetail.refundRetryAt, {
        time: formatDateTime(order.refundRetryAfterAt, language),
      })}`
    }
    return text.orderStatusDetail.refunding
  }
  if (order.status === 'refunded') return text.orderStatusDetail.refunded
  if (order.status === 'refundOnly') return text.orderStatusDetail.refundOnly
  return null
}

function isZeroQuota(value: BillingQuota): boolean {
  return value.hourly === 0 && value.daily === 0 && value.monthly === 0
}

function sumQuotas(...quotas: BillingQuota[]): BillingQuota {
  return quotas.reduce<BillingQuota>((total, quota) => ({
    hourly: total.hourly + quota.hourly,
    daily: total.daily + quota.daily,
    monthly: total.monthly + quota.monthly,
  }), {
    hourly: 0,
    daily: 0,
    monthly: 0,
  })
}

function clampIndex(value: number, max: number): number {
  return Math.min(Math.max(value, 0), Math.max(max, 0))
}

function resolveTimelineVisibleCount(width: number, viewportMode: 'small' | 'normal'): 1 | 2 | 3 {
  if (viewportMode === 'small') return 1
  if (width >= 980) return 3
  if (width >= 680) return 2
  return 1
}

function scrollTimelineToIndex(
  viewport: HTMLDivElement | null,
  index: number,
  behavior: ScrollBehavior,
): void {
  if (!viewport) return

  const cards = Array.from(viewport.querySelectorAll<HTMLElement>('[data-timeline-index]'))
  const target = cards[index]
  if (!target) return

  viewport.scrollTo({
    left: target.offsetLeft,
    behavior,
  })
}

function QuotaStrip({
  quota,
  tone = 'table',
  muted = false,
}: {
  quota: BillingQuota
  tone?: 'hero' | 'table' | 'micro'
  muted?: boolean
}): React.JSX.Element {
  return (
    <div className={cn(
      'user-console-billing-quota-strip grid shrink-0 grid-cols-3 gap-2 text-right tabular-nums [&>div]:flex [&>div]:min-w-0 [&>div]:flex-col [&_span]:text-xs [&_span]:font-normal [&_span]:text-muted-foreground',
      `is-${tone}`,
      tone === 'micro' ? 'w-36 text-xs' : 'w-56 max-w-full text-sm',
      tone === 'hero' && 'w-full text-2xl',
      muted && 'is-muted text-muted-foreground',
    )}>
      <div>
        <span>1H</span>
        <strong>{formatNumber(quota.hourly)}</strong>
      </div>
      <div>
        <span>1D</span>
        <strong>{formatNumber(quota.daily)}</strong>
      </div>
      <div>
        <span>1M</span>
        <strong>{formatNumber(quota.monthly)}</strong>
      </div>
    </div>
  )
}

function SummaryRow({
  title,
  description,
  quota,
  badge,
}: {
  title: string
  description?: string | null
  quota: BillingQuota
  badge?: string | null
}): React.JSX.Element {
  return (
    <li className="user-console-billing-summary-row flex flex-wrap items-center justify-between gap-3 px-4 py-4">
      <div className="user-console-billing-summary-row-copy min-w-0">
        <div className="user-console-billing-summary-row-title flex flex-col items-start gap-1 text-sm">
          <h3 className="font-medium">{title}</h3>
          {description ? <span className="user-console-billing-summary-row-note text-xs text-muted-foreground">{description}</span> : null}
          {badge ? <Badge variant="secondary" className="user-console-billing-inline-badge">{badge}</Badge> : null}
        </div>
      </div>
      <QuotaStrip quota={quota} muted={isZeroQuota(quota)} />
    </li>
  )
}

function TimelineQuotaRow({
  label,
  quota,
}: {
  label: string
  quota: BillingQuota
}): React.JSX.Element {
  return (
    <div className="user-console-billing-timeline-row flex items-center justify-between gap-2 text-xs">
      <span className="user-console-billing-timeline-row-label text-muted-foreground">{label}</span>
      <QuotaStrip quota={quota} tone="micro" muted={isZeroQuota(quota)} />
    </div>
  )
}

function TimelineNavButton({
  direction,
  label,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next'
  label: string
  disabled: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={`user-console-billing-timeline-nav-button shrink-0 is-${direction}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {direction === 'prev' ? (
        <ChevronLeft aria-hidden="true" />
      ) : (
        <ChevronRight aria-hidden="true" />
      )}
      <span className="sr-only">{label}</span>
    </Button>
  )
}

function resolveTimelinePhaseLabel(
  month: BillingTimelineMonth,
  currentMonthStart: number,
  text: BillingText,
): string {
  if (month.isCurrentMonth) return text.timelineCurrent
  return month.monthStart < currentMonthStart ? text.timelinePrevious : text.timelineFuture
}

function TimelineCard({
  language,
  text,
  currentMonthStart,
  month,
  index,
  selected,
  onSelect,
}: {
  language: 'en' | 'zh'
  text: BillingText
  currentMonthStart: number
  month: BillingTimelineMonth
  index: number
  selected: boolean
  onSelect: (index: number) => void
}): React.JSX.Element {
  const monthLabel = formatMonthLabel(month.monthStart, language)
  const phaseLabel = resolveTimelinePhaseLabel(month, currentMonthStart, text)
  const rechargeBadge = month.recharge.credits > 0
    ? formatTemplate(text.timelineRechargeCredits, { credits: formatNumber(month.recharge.credits) })
    : null
  const selectionLabel = formatTemplate(text.timelineSelectMonth, { month: monthLabel })
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onSelect(index)
  }

  return (
    <article
      className={cn('user-console-billing-timeline-card relative flex min-w-0 shrink-0 basis-(--billing-timeline-card-width) snap-start cursor-pointer flex-col gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', selected && 'border-primary/50 bg-muted/30')}
      data-timeline-index={index}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={selectionLabel}
      onClick={() => onSelect(index)}
      onKeyDown={handleKeyDown}
    >
      <div className="user-console-billing-timeline-card-head flex items-start justify-between gap-2">
        <div className="user-console-billing-timeline-card-aside flex flex-col [&_p]:text-xs [&_p]:uppercase [&_p]:tracking-wide [&_p]:text-muted-foreground [&_h3]:text-base [&_h3]:font-semibold">
          <p>{phaseLabel}</p>
          <h3>{monthLabel}</h3>
        </div>
        {rechargeBadge ? <Badge variant="secondary" className="user-console-billing-inline-badge">{rechargeBadge}</Badge> : null}
      </div>
      <div className="user-console-billing-timeline-total flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
        <span>{text.timelineEffective}</span>
        <QuotaStrip quota={month.effectiveTotal} tone="micro" />
      </div>
      <div className="user-console-billing-timeline-card-body flex flex-col gap-2">
        <TimelineQuotaRow label={text.timelinePersistent} quota={month.persistentTotal} />
        <TimelineQuotaRow label={text.timelineAdjustments} quota={month.monthlyAdjustments} />
        <TimelineQuotaRow label={text.timelineRecharge} quota={month.recharge.quota} />
      </div>
    </article>
  )
}

export default function BillingPage({
  text,
  rechargeText,
  summary,
  config,
  orders,
  loading,
  credits,
  months,
  quote,
  busy,
  error,
  language,
  onCreditsChange,
  onMonthsChange,
  onCreateOrder,
}: BillingPageProps): React.JSX.Element {
  const viewportMode = useViewportMode()
  const timelineViewportRef = useRef<HTMLDivElement | null>(null)
  const [timelineVisibleCount, setTimelineVisibleCount] = useState<1 | 2 | 3>(1)
  const [timelineWindowIndex, setTimelineWindowIndex] = useState(0)
  const [selectedTimelineMonthStart, setSelectedTimelineMonthStart] = useState<number | null>(null)
  const previousCurrentMonthStartRef = useRef<number | null>(null)
  const [ordersPage, setOrdersPage] = useState(1)
  const timeline = summary?.timeline ?? []
  const rechargeVisible = config?.visible ?? false
  const purchaseConfig = rechargeVisible
    ? config
    : config
      ? { ...config, visible: false, enabled: false }
      : null
  const unitPriceText = config
    ? language === 'zh'
      ? `${formatMoneyLdc(config.unitPriceLdc)} LDC 可换 ${formatNumber(config.unitCredits)} 月积分`
      : `${formatMoneyLdc(config.unitPriceLdc)} LDC exchanges for ${formatNumber(config.unitCredits)} monthly credits`
    : text.unavailableNotice
  const effectiveUntilLabel = summary?.effectiveUntilMonthStart
    ? formatMonthLabel(summary.effectiveUntilMonthStart, language)
    : null
  const timelineMonthStarts = timeline.map((item) => item.monthStart).join(':')
  const markedCurrentTimelineIndex = timeline.findIndex((item) => item.isCurrentMonth)
  const summaryCurrentTimelineIndex = summary
    ? timeline.findIndex((item) => item.monthStart === summary.currentMonthStart)
    : -1
  const currentTimelineIndex = markedCurrentTimelineIndex >= 0
    ? markedCurrentTimelineIndex
    : Math.max(0, summaryCurrentTimelineIndex)
  const visibleTimelineCount = Math.max(1, Math.min(timelineVisibleCount, timeline.length || 1))
  const maxTimelineIndex = Math.max(0, timeline.length - visibleTimelineCount)
  const defaultTimelineIndex = useMemo(() => {
    if (timeline.length === 0) return 0
    if (visibleTimelineCount >= 3) {
      return clampIndex(currentTimelineIndex - 1, maxTimelineIndex)
    }
    return clampIndex(currentTimelineIndex, maxTimelineIndex)
  }, [currentTimelineIndex, maxTimelineIndex, timeline.length, visibleTimelineCount])
  const safeTimelineWindowIndex = clampIndex(timelineWindowIndex, maxTimelineIndex)
  const selectedTimelineIndex = selectedTimelineMonthStart == null
    ? currentTimelineIndex
    : timeline.findIndex((item) => item.monthStart === selectedTimelineMonthStart)
  const safeSelectedTimelineIndex = selectedTimelineIndex >= 0
    ? selectedTimelineIndex
    : currentTimelineIndex
  const visibleTimelineEndIndex = Math.min(
    timeline.length - 1,
    safeTimelineWindowIndex + visibleTimelineCount - 1,
  )
  const selectedTimelineMonth = timeline[safeSelectedTimelineIndex] ?? null
  const selectedTimelinePhaseLabel = selectedTimelineMonth
    ? resolveTimelinePhaseLabel(selectedTimelineMonth, summary?.currentMonthStart ?? selectedTimelineMonth.monthStart, text)
    : null
  const selectedTimelineRechargeBadge = selectedTimelineMonth && selectedTimelineMonth.recharge.credits > 0
    ? formatTemplate(text.timelineRechargeCredits, {
      credits: formatNumber(selectedTimelineMonth.recharge.credits),
    })
    : null
  const visibleTimelineRangeLabel = timeline.length === 0
    ? null
    : visibleTimelineCount === 1
      ? formatMonthLabel(timeline[safeTimelineWindowIndex].monthStart, language)
      : `${formatMonthLabel(timeline[safeTimelineWindowIndex].monthStart, language)} - ${formatMonthLabel(
        timeline[visibleTimelineEndIndex].monthStart,
        language,
      )}`
  const visibleTimelineProgress = timeline.length === 0
    ? null
    : visibleTimelineCount === 1
      ? `${safeTimelineWindowIndex + 1} / ${timeline.length}`
      : `${safeTimelineWindowIndex + 1}-${visibleTimelineEndIndex + 1} / ${timeline.length}`
  const hasFutureScheduledEntitlement = summary
    ? timeline.some((item) => (
      item.monthStart > summary.currentMonthStart
      && (
        item.recharge.credits > 0
        || !isZeroQuota(item.recharge.quota)
        || !isZeroQuota(item.monthlyAdjustments)
      )
    ))
    : false
  const timelineViewportStyle = {
    '--billing-timeline-visible': String(visibleTimelineCount),
    '--billing-timeline-card-width': `calc((100% - ${(visibleTimelineCount - 1) * 12}px) / ${visibleTimelineCount})`,
  } as CSSProperties
  const baselineEntitlements = summary
    ? sumQuotas(
      summary.composition.baseAccess,
      summary.composition.permanentEntitlements,
      summary.composition.tagAdjustments,
    )
    : null
  const summaryRows = summary && selectedTimelineMonth ? [
    {
      title: text.baseEntitlements,
      description: baselineEntitlements && isZeroQuota(baselineEntitlements) ? text.emptyDelta : null,
      quota: baselineEntitlements ?? selectedTimelineMonth.persistentTotal,
      badge: null,
    },
    {
      title: text.monthlyAdjustments,
      description: isZeroQuota(selectedTimelineMonth.monthlyAdjustments) ? text.emptyDelta : null,
      quota: selectedTimelineMonth.monthlyAdjustments,
      badge: null,
    },
    {
      title: text.rechargePackage,
      description: isZeroQuota(selectedTimelineMonth.recharge.quota) ? text.emptyDelta : null,
      quota: selectedTimelineMonth.recharge.quota,
      badge: selectedTimelineMonth.recharge.credits > 0
        ? formatTemplate(text.rechargeCredits, {
          credits: formatNumber(selectedTimelineMonth.recharge.credits),
        })
        : null,
    },
  ] : []
  const ordersTotalPages = Math.max(1, Math.ceil(orders.length / ORDERS_PER_PAGE))
  const safeOrdersPage = Math.min(Math.max(ordersPage, 1), ordersTotalPages)
  const visibleOrders = useMemo(() => {
    if (orders.length === 0) return []
    const start = (safeOrdersPage - 1) * ORDERS_PER_PAGE
    return orders.slice(start, start + ORDERS_PER_PAGE)
  }, [orders, safeOrdersPage])
  const ordersPageSummary = formatTemplate(text.ordersPageSummary, {
    page: safeOrdersPage,
    totalPages: ordersTotalPages,
    total: formatNumber(orders.length),
  })

  useEffect(() => {
    const node = timelineViewportRef.current
    if (!node) {
      setTimelineVisibleCount(viewportMode === 'small' ? 1 : 3)
      return
    }

    const update = () => {
      const width = node.getBoundingClientRect().width
      setTimelineVisibleCount(resolveTimelineVisibleCount(width, viewportMode))
    }

    update()

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    resizeObserver?.observe(node)
    window.addEventListener('resize', update)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [timeline.length, viewportMode])

  useEffect(() => {
    setTimelineWindowIndex(defaultTimelineIndex)
    const handle = window.requestAnimationFrame(() => {
      scrollTimelineToIndex(timelineViewportRef.current, defaultTimelineIndex, 'auto')
    })
    return () => window.cancelAnimationFrame(handle)
  }, [defaultTimelineIndex])

  useEffect(() => {
    if (timeline.length === 0) {
      setSelectedTimelineMonthStart(null)
      previousCurrentMonthStartRef.current = summary?.currentMonthStart ?? null
      return
    }

    const currentMonthStart = summary?.currentMonthStart ?? null
    const currentMonthChanged = previousCurrentMonthStartRef.current != null
      && previousCurrentMonthStartRef.current !== currentMonthStart
    const selectedMonthStillExists = selectedTimelineMonthStart != null
      && timeline.some((item) => item.monthStart === selectedTimelineMonthStart)

    if (selectedTimelineMonthStart == null || !selectedMonthStillExists || currentMonthChanged) {
      setSelectedTimelineMonthStart(timeline[currentTimelineIndex]?.monthStart ?? null)
    }
    previousCurrentMonthStartRef.current = currentMonthStart
  }, [currentTimelineIndex, selectedTimelineMonthStart, summary?.currentMonthStart, timeline.length, timelineMonthStarts])

  useEffect(() => {
    const viewport = timelineViewportRef.current
    if (!viewport) return

    let frame = 0
    let isInitialSync = true
    const syncWindowIndex = () => {
      const cards = Array.from(viewport.querySelectorAll<HTMLElement>('[data-timeline-index]'))
      if (cards.length === 0) {
        setTimelineWindowIndex(0)
        return
      }

      const scrollLeft = viewport.scrollLeft
      let nextIndex = 0
      let closestOffset = Number.POSITIVE_INFINITY

      cards.forEach((card, index) => {
        const offset = Math.abs(card.offsetLeft - scrollLeft)
        if (offset < closestOffset) {
          closestOffset = offset
          nextIndex = index
        }
      })

      setTimelineWindowIndex((current) => current === nextIndex ? current : nextIndex)
      if (!isInitialSync) {
        setSelectedTimelineMonthStart((current) => {
          const currentIndex = current == null
            ? currentTimelineIndex
            : timeline.findIndex((item) => item.monthStart === current)
          const resolvedCurrentIndex = currentIndex >= 0 ? currentIndex : currentTimelineIndex
          const nextVisibleEnd = Math.min(timeline.length - 1, nextIndex + visibleTimelineCount - 1)
          const nextSelectedIndex = resolvedCurrentIndex < nextIndex
            ? nextIndex
            : resolvedCurrentIndex > nextVisibleEnd
              ? nextVisibleEnd
              : resolvedCurrentIndex
          return timeline[nextSelectedIndex]?.monthStart ?? null
        })
      }
    }

    const handleScroll = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(syncWindowIndex)
    }

    syncWindowIndex()
    isInitialSync = false
    viewport.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.cancelAnimationFrame(frame)
      viewport.removeEventListener('scroll', handleScroll)
    }
  }, [currentTimelineIndex, timeline.length, timelineMonthStarts, visibleTimelineCount])

  useEffect(() => {
    setOrdersPage((current) => Math.min(Math.max(current, 1), ordersTotalPages))
  }, [ordersTotalPages])

  useEffect(() => {
    if (timeline.length === 0) return

    const nextWindowIndex = safeSelectedTimelineIndex < safeTimelineWindowIndex
      ? safeSelectedTimelineIndex
      : safeSelectedTimelineIndex > visibleTimelineEndIndex
        ? safeSelectedTimelineIndex - visibleTimelineCount + 1
        : safeTimelineWindowIndex
    if (nextWindowIndex === safeTimelineWindowIndex) return

    setTimelineWindowIndex(nextWindowIndex)
    const handle = window.requestAnimationFrame(() => {
      scrollTimelineToIndex(timelineViewportRef.current, nextWindowIndex, 'auto')
    })
    return () => window.cancelAnimationFrame(handle)
  }, [safeSelectedTimelineIndex, safeTimelineWindowIndex, timeline.length, visibleTimelineCount, visibleTimelineEndIndex])

  const moveTimeline = (step: number) => {
    const nextIndex = clampIndex(safeTimelineWindowIndex + step, maxTimelineIndex)
    setTimelineWindowIndex(nextIndex)
    const nextVisibleEnd = Math.min(timeline.length - 1, nextIndex + visibleTimelineCount - 1)
    const nextSelectedIndex = safeSelectedTimelineIndex < nextIndex
      ? nextIndex
      : safeSelectedTimelineIndex > nextVisibleEnd
        ? nextVisibleEnd
        : safeSelectedTimelineIndex
    setSelectedTimelineMonthStart(timeline[nextSelectedIndex]?.monthStart ?? null)
    scrollTimelineToIndex(timelineViewportRef.current, nextIndex, 'smooth')
  }

  return (
    <div className="user-console-billing-stack flex min-w-0 flex-col gap-6">
      <Card className="surface panel user-console-section user-console-billing-section">
        <header className="user-console-billing-stage-head flex flex-wrap items-start justify-between gap-3 border-b px-4 pb-4">
          <div className="user-console-billing-stage-intro flex flex-col gap-1.5 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:text-sm [&_p]:text-muted-foreground">
            <h2>{text.timelineTitle}</h2>
            <p>{text.timelineDescription}</p>
          </div>
          {summary ? (
            <div className="user-console-billing-stage-meta flex flex-wrap items-center gap-1.5">
              <span className="user-console-billing-meta-pill inline-flex items-center rounded-full border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                {formatMonthLabel(summary.currentMonthStart, language)}
              </span>
              {effectiveUntilLabel ? (
                <span className="user-console-billing-meta-pill inline-flex items-center rounded-full border bg-muted px-2.5 py-1 text-xs text-muted-foreground">{effectiveUntilLabel}</span>
              ) : null}
              {summary.blockAll ? (
                <span className="user-console-billing-meta-pill inline-flex items-center rounded-full border bg-muted px-2.5 py-1 text-xs text-muted-foreground border-warning/40 bg-warning/10 text-warning">block_all</span>
              ) : null}
            </div>
          ) : null}
        </header>
        {loading && timeline.length === 0 ? (
          <Empty className="empty-state"><EmptyDescription>Loading timeline...</EmptyDescription></Empty>
        ) : timeline.length > 0 ? (
          <>
            <div className="user-console-billing-timeline-stage flex items-center gap-2 px-4">
              {viewportMode === 'small' ? null : (
                <TimelineNavButton
                  direction="prev"
                  label={text.timelineBack}
                  disabled={safeTimelineWindowIndex <= 0}
                  onClick={() => moveTimeline(-1)}
                />
              )}
              <div
                ref={timelineViewportRef}
                className="user-console-billing-timeline-viewport relative min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto pb-2"
                style={timelineViewportStyle}
              >
                <div className="user-console-billing-timeline-track flex gap-3">
                  {timeline.map((month, index) => (
                    <TimelineCard
                      key={month.monthStart}
                      index={index}
                      language={language}
                      text={text}
                      currentMonthStart={summary?.currentMonthStart ?? month.monthStart}
                      month={month}
                      selected={index === safeSelectedTimelineIndex}
                      onSelect={(nextIndex) => setSelectedTimelineMonthStart(timeline[nextIndex]?.monthStart ?? null)}
                    />
                  ))}
                </div>
              </div>
              {viewportMode === 'small' ? null : (
                <TimelineNavButton
                  direction="next"
                  label={text.timelineForward}
                  disabled={safeTimelineWindowIndex >= maxTimelineIndex}
                  onClick={() => moveTimeline(1)}
                />
              )}
            </div>

            {viewportMode === 'small' ? (
              <div className="user-console-billing-timeline-mobile-controls flex items-center justify-between gap-2 px-4">
                <TimelineNavButton
                  direction="prev"
                  label={text.timelineBack}
                  disabled={safeTimelineWindowIndex <= 0}
                  onClick={() => moveTimeline(-1)}
                />
                <div className="user-console-billing-timeline-status flex items-center gap-2 text-xs text-muted-foreground [&_strong]:text-foreground">
                  {visibleTimelineRangeLabel ? <strong>{visibleTimelineRangeLabel}</strong> : null}
                  {visibleTimelineProgress ? <span>{visibleTimelineProgress}</span> : null}
                </div>
                <TimelineNavButton
                  direction="next"
                  label={text.timelineForward}
                  disabled={safeTimelineWindowIndex >= maxTimelineIndex}
                  onClick={() => moveTimeline(1)}
                />
              </div>
            ) : (
              <div className="user-console-billing-timeline-status-bar flex items-center justify-end gap-2 px-4 text-xs text-muted-foreground [&_strong]:text-foreground">
                {visibleTimelineRangeLabel ? <strong>{visibleTimelineRangeLabel}</strong> : null}
                {visibleTimelineProgress ? <span>{visibleTimelineProgress}</span> : null}
              </div>
            )}
          </>
        ) : (
          <Empty className="empty-state"><EmptyDescription>{text.timelineNoFuture}</EmptyDescription></Empty>
        )}
        {timeline.length > 0 && !hasFutureScheduledEntitlement ? (
          <p className="user-console-billing-inline-note px-4 text-xs text-muted-foreground">{text.timelineNoScheduledChanges}</p>
        ) : null}
      </Card>

      <div className="user-console-billing-workbench grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="user-console-billing-main-column flex min-w-0 flex-col gap-4">
          <Card className="surface panel user-console-section user-console-billing-section user-console-billing-summary-section gap-0 py-0">
            <CardHeader className="panel-header border-b user-console-section-header user-console-billing-summary-head gap-3 py-4">
              <div>
                <CardTitle role="heading" aria-level={2}>{text.summaryTitle}</CardTitle>
                <CardDescription className="panel-description">{text.summaryDescription}</CardDescription>
              </div>
              {selectedTimelineMonth ? (
                <div className="user-console-billing-summary-meta flex flex-wrap items-center gap-1.5">
                  <span className="user-console-billing-meta-pill inline-flex items-center rounded-full border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {formatMonthLabel(selectedTimelineMonth.monthStart, language)}
                  </span>
                  {selectedTimelinePhaseLabel ? (
                    <span className="user-console-billing-meta-pill inline-flex items-center rounded-full border bg-muted px-2.5 py-1 text-xs text-muted-foreground">{selectedTimelinePhaseLabel}</span>
                  ) : null}
                  {selectedTimelineRechargeBadge ? (
                    <span className="user-console-billing-meta-pill inline-flex items-center rounded-full border bg-muted px-2.5 py-1 text-xs text-muted-foreground">{selectedTimelineRechargeBadge}</span>
                  ) : null}
                </div>
              ) : null}
            </CardHeader>
            {loading && !summary ? (
              <Empty className="empty-state"><EmptyDescription>Loading billing summary...</EmptyDescription></Empty>
            ) : summary && selectedTimelineMonth ? (
              <>
                <div className="user-console-billing-current-total-row flex flex-wrap items-center justify-between gap-3 border-b bg-muted/50 px-4 py-4 text-sm font-medium">
                  <span>{text.timelineEffective}</span>
                  <QuotaStrip quota={selectedTimelineMonth.effectiveTotal} tone="table" />
                </div>
                <ul className="user-console-billing-summary-list flex flex-col divide-y">
                  {summaryRows.map((row) => (
                    <SummaryRow
                      key={row.title}
                      title={row.title}
                      description={row.description}
                      quota={row.quota}
                      badge={row.badge}
                    />
                  ))}
                </ul>
                {summary.blockAll ? (
                  <p className="user-console-billing-notice mx-4 bg-warning/10 p-3 text-sm text-warning">{text.blockAllNotice}</p>
                ) : null}
              </>
            ) : (
              <Empty className="empty-state"><EmptyDescription>{text.emptyDelta}</EmptyDescription></Empty>
            )}
          </Card>
        </div>

        <aside className="user-console-landing-rail user-console-billing-side-column flex min-w-0 flex-col gap-4">
          <Card className="user-console-billing-pricing-inline" aria-label={text.pricingTitle}>
            <CardHeader className="user-console-billing-pricing-inline-head flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>{text.pricingTitle}</CardTitle>
                {text.pricingDescription ? <CardDescription>{text.pricingDescription}</CardDescription> : null}
              </div>
              {rechargeVisible ? (
                <StatusBadge tone={config?.enabled ? 'success' : 'neutral'}>
                  {config?.enabled ? rechargeText.enabled : rechargeText.disabled}
                </StatusBadge>
              ) : (
                <StatusBadge tone="neutral">{rechargeText.disabled}</StatusBadge>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="user-console-billing-pricing-inline-metrics flex flex-col gap-3 text-sm [&>div]:flex [&>div]:flex-col [&>div]:gap-1 [&_span]:text-xs [&_span]:text-muted-foreground [&_strong]:font-medium">
                <div>
                  <span>{text.unitPrice}</span>
                  <strong>{unitPriceText}</strong>
                </div>
                <div>
                  <span>{text.creditStep}</span>
                  <strong>{config ? formatCreditStepValue(config.creditsStep, language) : '0'}</strong>
                </div>
                <div>
                  <span>{text.monthsRange}</span>
                  <strong>{config ? formatMonthsRange(config.minMonths, config.maxMonths, language) : '0'}</strong>
                </div>
              </div>
              {config?.testPriceEnabled && text.testPriceEnabled ? (
                <p className="user-console-billing-inline-note text-xs text-muted-foreground">{text.testPriceEnabled}</p>
              ) : null}
              {!config?.enabled || !rechargeVisible ? (
                <p className="user-console-billing-inline-note text-xs text-muted-foreground">{text.unavailableNotice}</p>
              ) : null}
            </CardContent>
          </Card>
          <RechargePanel
            text={rechargeText}
            language={language}
            dashboard={null}
            config={purchaseConfig}
            orders={[]}
            credits={credits}
            months={months}
            quote={quote}
            busy={busy}
            error={error}
            onCreditsChange={onCreditsChange}
            onMonthsChange={onMonthsChange}
            onCreateOrder={onCreateOrder}
            showSummary={false}
            showOrders={false}
          />
        </aside>

        <Card className="surface panel user-console-section user-console-billing-section user-console-billing-orders-section min-w-0 lg:col-span-full">
          <CardHeader className="panel-header border-b user-console-section-header">
            <div>
              <CardTitle role="heading" aria-level={2}>{text.ordersTitle}</CardTitle>
              <CardDescription className="panel-description">{text.ordersDescription}</CardDescription>
            </div>
          </CardHeader>
          {orders.length === 0 ? (
            <Empty className="empty-state"><EmptyDescription>{rechargeText.noOrders}</EmptyDescription></Empty>
          ) : (
            <>
              <div className="user-console-billing-orders-table mx-4 flex min-w-0 flex-col divide-y text-sm" role="list">
                {visibleOrders.map((order) => {
                  const detail = orderStatusDetail(order, rechargeText, language)
                  return (
                    <article key={order.outTradeNo} className="user-console-billing-order-row grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.5fr)_auto] lg:items-center" role="listitem">
                      <div className="user-console-billing-order-primary flex min-w-0 flex-col gap-1">
                        <div className="user-console-billing-order-title-row flex flex-wrap items-center gap-2">
                          <h3 className="font-medium tabular-nums">{formatNumber(order.credits)} × {order.months}</h3>
                          {order.monthEndClampApplied ? (
                            <span className="user-console-billing-inline-badge inline-flex items-center rounded-full border bg-primary/10 px-2 py-0.5 text-xs text-primary border-warning/40 bg-warning/10 text-warning">{text.orderClampApplied}</span>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">{formatTemplate(text.orderCreatedAt, {
                          time: formatDateTime(order.createdAt, language),
                        })}</p>
                      </div>
                      <div className="user-console-billing-order-facts col-span-full flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground lg:col-span-1 [&_strong]:font-medium">
                        <strong>{formatNumber(order.credits)} / {order.months}</strong>
                        <strong>{order.money} LDC</strong>
                        <strong>{formatMonthLabel(order.quoteMonthStart, language)}</strong>
                      </div>
                      <div className="user-console-billing-order-impact col-span-full flex min-w-0 flex-col gap-1 text-xs tabular-nums lg:col-span-1 [&_strong]:font-medium">
                        <span className="text-muted-foreground">{text.timelineEffective}</span>
                        <strong>{formatTemplate(text.orderImpact, {
                          hourly: formatNumber(order.finalHourlyDelta),
                          daily: formatNumber(order.finalDailyDelta),
                          monthly: formatNumber(order.finalMonthlyDelta),
                        })}</strong>
                        {detail ? <p className="user-console-billing-order-detail text-xs text-muted-foreground">{detail}</p> : null}
                      </div>
                      <div className="user-console-billing-order-status col-start-2 row-start-1 inline-flex items-center self-start lg:col-start-4 lg:self-center">
                        <StatusBadge tone={orderStatusTone(order.status)}>
                          {rechargeText.status[order.status] ?? order.status}
                        </StatusBadge>
                      </div>
                    </article>
                  )
                })}
              </div>
              {ordersTotalPages > 1 ? (
                <div className="table-pagination flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="table-pagination-meta table-pagination-meta-summary-only flex min-w-0 flex-col gap-2">
                    <span className="table-pagination-summary text-sm text-muted-foreground">{ordersPageSummary}</span>
                  </div>
                  <Pagination className="table-pagination-nav mx-0 w-auto justify-start sm:justify-end" aria-label={`${text.ordersPreviousPage} / ${text.ordersNextPage}`}>
                    <PaginationContent>
                      <PaginationItem>
                        <Button
                          type="button"
                          variant="outline"
                          className="table-pagination-button"
                          onClick={() => setOrdersPage((current) => Math.max(1, current - 1))}
                          disabled={safeOrdersPage <= 1}
                        >
                          <ChevronLeft data-icon="inline-start" />
                          {text.ordersPreviousPage}
                        </Button>
                      </PaginationItem>
                      <PaginationItem>
                        <Button
                          type="button"
                          variant="outline"
                          className="table-pagination-button"
                          onClick={() => setOrdersPage((current) => Math.min(ordersTotalPages, current + 1))}
                          disabled={safeOrdersPage >= ordersTotalPages}
                        >
                          {text.ordersNextPage}
                          <ChevronRight data-icon="inline-end" />
                        </Button>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
