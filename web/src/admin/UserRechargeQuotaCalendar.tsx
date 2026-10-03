import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { useMemo } from 'react'
import type React from 'react'

import type { AdminUserDetail } from '../api'
import type { AdminRechargeTranslations } from '../i18n/adminRechargeTranslationTypes'
import { getRechargeMonthUsedQuota } from './rechargeQuotaCalendarUsage'

interface UserRechargeQuotaCalendarProps {
  detail: AdminUserDetail
  strings: AdminRechargeTranslations['userDetail']
  language: 'en' | 'zh'
  formatNumber: (value: number) => string
  embedded?: boolean
}

interface MonthQuotaRow {
  monthStart: number
  hourlyDelta: number
  dailyDelta: number
  monthlyDelta: number
}

export function UserRechargeQuotaCalendar({
  detail,
  strings,
  language,
  formatNumber,
  embedded = false,
}: UserRechargeQuotaCalendarProps): React.JSX.Element {
  const entitlements = detail.recharge?.entitlements ?? []
  const rows = useMemo(() => buildRechargeMonthRows(entitlements), [entitlements])
  const tagDelta = detail.quotaBreakdown
    .filter((item) => item.kind === 'tag')
    .reduce((sum, item) => sum + item.monthlyCreditsDelta, 0)
  const locale = language === 'zh' ? 'zh-CN' : 'en-US'
  const currentRecharge = detail.recharge?.currentMonthEntitlementMonthlyDelta
    ?? rows.find((row) => isSameLocalMonth(row.monthStart, Date.now() / 1000))?.monthlyDelta
    ?? 0
  const currentMonthStart = detail.entitlements.currentMonthStart
    || rows.find((row) => isSameLocalMonth(row.monthStart, Date.now() / 1000))?.monthStart
    || null
  const effectiveUntil = detail.recharge?.effectiveUntilMonthStart
  const tableFacts = [
    formatTemplate(strings.currentMonthRecharge, { value: formatNumber(currentRecharge) }),
    formatTemplate(strings.currentFinal, { value: formatNumber(detail.quotaBase.monthlyCreditsLimit + tagDelta + currentRecharge) }),
    effectiveUntil
      ? formatTemplate(strings.effectiveUntil, { value: formatMonth(effectiveUntil, locale) })
      : strings.effectiveUntilEmpty,
  ]
  const Heading = embedded ? 'h3' : 'h2'

  return (
    <section className={embedded ? 'user-recharge-quota-calendar-panel user-recharge-quota-calendar-panel--embedded' : 'surface panel flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-card-foreground ring-1 ring-foreground/10 user-recharge-quota-calendar-panel'}>
      <div className="panel-header flex flex-col gap-1.5 border-b px-4 pb-4">
        <div>
          <Heading>{strings.title}</Heading>
          <p className="text-sm text-muted-foreground">{strings.description}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty><EmptyDescription>{strings.empty}</EmptyDescription></Empty>
      ) : (
        <>
          <div aria-label={strings.title}>
            {tableFacts.map((fact) => <span key={fact}>{fact}</span>)}
          </div>
          <div>
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{strings.monthColumn}</TableHead>
                <TableHead scope="col">{strings.baseColumn}</TableHead>
                <TableHead scope="col">{strings.tagColumn}</TableHead>
                <TableHead scope="col">{strings.rechargeColumn}</TableHead>
                <TableHead scope="col">{strings.finalColumn}</TableHead>
                <TableHead scope="col">{strings.usedColumn}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.monthStart}>
                  <TableHead scope="row">{formatMonth(row.monthStart, locale)}</TableHead>
                <TableCell>{formatNumber(detail.quotaBase.monthlyCreditsLimit)}</TableCell>
                <TableCell>{formatNumber(tagDelta)}</TableCell>
                <TableCell>{formatNumber(row.monthlyDelta)}</TableCell>
                <TableCell>{formatNumber(detail.quotaBase.monthlyCreditsLimit + tagDelta + row.monthlyDelta)}</TableCell>
                <TableCell>{formatNumber(getRechargeMonthUsedQuota(row.monthStart, currentMonthStart, detail.monthlyCreditsUsed))}</TableCell>
              </TableRow>
              ))}
            </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  )
}

function buildRechargeMonthRows(entitlements: AdminUserDetail['recharge']['entitlements']): MonthQuotaRow[] {
  if (entitlements.length === 0) return []
  const totals = new Map<number, MonthQuotaRow>()
  for (const entitlement of entitlements) {
    const current = totals.get(entitlement.monthStart) ?? {
      monthStart: entitlement.monthStart,
      hourlyDelta: 0,
      dailyDelta: 0,
      monthlyDelta: 0,
    }
    current.hourlyDelta += entitlement.hourlyDelta
    current.dailyDelta += entitlement.dailyDelta
    current.monthlyDelta += entitlement.monthlyDelta
    totals.set(entitlement.monthStart, current)
  }
  const starts = [...totals.keys()].sort((a, b) => a - b)
  const first = addLocalMonths(starts[0], -1)
  const last = addLocalMonths(starts[starts.length - 1], 1)
  const rows: MonthQuotaRow[] = []
  for (let cursor = first; cursor <= last; cursor = addLocalMonths(cursor, 1)) {
    rows.push(totals.get(cursor) ?? { monthStart: cursor, hourlyDelta: 0, dailyDelta: 0, monthlyDelta: 0 })
  }
  return rows
}

function addLocalMonths(ts: number, months: number): number {
  const date = new Date(ts * 1000)
  date.setMonth(date.getMonth() + months)
  return Math.floor(date.getTime() / 1000)
}

function formatMonth(ts: number, locale: string): string {
  return new Date(ts * 1000).toLocaleDateString(locale, { year: 'numeric', month: 'short' })
}

function isSameLocalMonth(leftTs: number, rightTs: number): boolean {
  const left = new Date(leftTs * 1000)
  const right = new Date(rightTs * 1000)
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
}

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (current, [key, value]) => current.replaceAll(`{${key}}`, String(value)),
    template,
  )
}
