import { Field, FieldLabel, FieldGroup } from '@/components/ui/field'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import DateTimeRangeField from '../components/DateTimeRangeField'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type {
  AccountEntitlementScopeKind,
  AdminUserDetail,
  AdminUserEntitlement,
  AdminUserQuotaBreakdownEntry,
  CreateAdminUserEntitlementPayload,
} from '../api'
import type { AdminTranslations } from '../i18n'
import type { AdminRechargeTranslations } from '../i18n/adminRechargeTranslationTypes'
import { useEffect, useState } from 'react'
import { UserDetailQuotaBreakdown } from './UserDetailQuotaBreakdown'
import { UserRechargeQuotaCalendar } from './UserRechargeQuotaCalendar'
import type React from 'react'

type EntitlementScopeFilter = AccountEntitlementScopeKind | 'all'

const ENTITLEMENT_DELTA_STAGES = [
  -100_000,
  -50_000,
  -20_000,
  -10_000,
  -5_000,
  -2_000,
  -1_000,
  -500,
  -250,
  -100,
  -50,
  -25,
  -10,
  -5,
  -1,
  0,
  1,
  5,
  10,
  25,
  50,
  100,
  250,
  500,
  1_000,
  2_000,
  5_000,
  10_000,
  20_000,
  50_000,
  100_000,
] as const

interface EntitlementFormState {
  scopeKind: AccountEntitlementScopeKind
  month: string
  businessCalls1hDelta: string
  dailyCreditsDelta: string
  monthlyCreditsDelta: string
  backendNote: string
  frontendNote: string
}

function buildQuotaBreakdownEntry(
  entry: Pick<
    AdminUserQuotaBreakdownEntry,
    'kind' | 'label' | 'tagId' | 'tagName' | 'source' | 'effectKind'
  > & {
    businessCalls1hDelta: number
    dailyCreditsDelta: number
    monthlyCreditsDelta: number
  },
): AdminUserQuotaBreakdownEntry {
  return {
    ...entry,
    businessCalls1hDelta: entry.businessCalls1hDelta,
    dailyCreditsDelta: entry.dailyCreditsDelta,
    monthlyCreditsDelta: entry.monthlyCreditsDelta,
  }
}

interface AdminUserDetailQuotaWorkspaceProps {
  detail: AdminUserDetail
  usersStrings: AdminTranslations['users']
  rechargeStrings: AdminRechargeTranslations['userDetail']
  language: 'en' | 'zh'
  hasBlockAllTag: boolean
  formatNumber: (value: number) => string
  formatQuotaLimitValue: (value: number) => string
  formatSignedQuotaDelta: (value: number) => string
  onCreateEntitlement: (userId: string, payload: CreateAdminUserEntitlementPayload) => Promise<AdminUserEntitlement>
  onFetchEntitlements: (
    userId: string,
    filters: { scopeKind?: EntitlementScopeFilter; startMonth?: number | null; endMonthBefore?: number | null },
  ) => Promise<AdminUserEntitlement[]>
  onRefreshDetail: () => Promise<void>
}

export function AdminUserDetailQuotaWorkspace({
  detail,
  usersStrings,
  rechargeStrings,
  language,
  hasBlockAllTag,
  formatNumber,
  formatQuotaLimitValue,
  formatSignedQuotaDelta,
  onCreateEntitlement,
  onFetchEntitlements,
  onRefreshDetail,
}: AdminUserDetailQuotaWorkspaceProps): React.JSX.Element {
  const defaultMonth = formatMonthInput(detail.entitlements.currentMonthStart || Math.floor(Date.now() / 1000))
  const [entitlementForm, setEntitlementForm] = useState<EntitlementFormState>(() => ({
    scopeKind: 'base',
    month: defaultMonth,
    businessCalls1hDelta: '0',
    dailyCreditsDelta: '0',
    monthlyCreditsDelta: '0',
    backendNote: '',
    frontendNote: '',
  }))
  const [entitlementScopeFilter, setEntitlementScopeFilter] = useState<EntitlementScopeFilter>('all')
  const [entitlementStartMonth, setEntitlementStartMonth] = useState('')
  const [entitlementEndMonth, setEntitlementEndMonth] = useState('')
  const [entitlementItems, setEntitlementItems] = useState<AdminUserEntitlement[]>(detail.entitlements.items)
  const [entitlementBusy, setEntitlementBusy] = useState(false)
  const [entitlementError, setEntitlementError] = useState<string | null>(null)
  const [entitlementDialogOpen, setEntitlementDialogOpen] = useState(false)
  useEffect(() => {
    setEntitlementItems(detail.entitlements.items)
    setEntitlementForm((current) => ({ ...current, month: current.month || defaultMonth }))
  }, [defaultMonth, detail.entitlements.items])
  const breakdownEntries = detail.quotaBreakdown.length > 0
    ? detail.quotaBreakdown
    : buildFallbackQuotaBreakdown(detail, rechargeStrings.rechargeColumn)
  const submitEntitlement = async () => {
    setEntitlementBusy(true)
    setEntitlementError(null)
    try {
      const payload: CreateAdminUserEntitlementPayload = {
        scopeKind: entitlementForm.scopeKind,
        monthStart: entitlementForm.scopeKind === 'month' ? parseMonthInput(entitlementForm.month) : null,
        businessCalls1hDelta: parseIntegerInput(entitlementForm.businessCalls1hDelta),
        dailyCreditsDelta: parseIntegerInput(entitlementForm.dailyCreditsDelta),
        monthlyCreditsDelta: parseIntegerInput(entitlementForm.monthlyCreditsDelta),
        backendNote: entitlementForm.backendNote.trim(),
        frontendNote: entitlementForm.frontendNote.trim(),
      }
      if (payload.scopeKind === 'month' && !payload.monthStart) throw new Error(rechargeStrings.entitlementInvalidMonth)
      if (!payload.frontendNote) throw new Error(rechargeStrings.entitlementNotesRequired)
      if (!payload.businessCalls1hDelta && !payload.dailyCreditsDelta && !payload.monthlyCreditsDelta) {
        throw new Error(rechargeStrings.entitlementDeltaRequired)
      }
      await onCreateEntitlement(detail.userId, payload)
      setEntitlementForm((current) => ({
        ...current,
        businessCalls1hDelta: '0',
        dailyCreditsDelta: '0',
        monthlyCreditsDelta: '0',
        backendNote: '',
        frontendNote: '',
      }))
      await onRefreshDetail()
      setEntitlementDialogOpen(false)
    } catch (err) {
      setEntitlementError(err instanceof Error ? err.message : rechargeStrings.entitlementCreateFailed)
    } finally {
      setEntitlementBusy(false)
    }
  }
  const applyEntitlementFilters = async () => {
    setEntitlementBusy(true)
    setEntitlementError(null)
    try {
      const items = await onFetchEntitlements(detail.userId, {
        scopeKind: entitlementScopeFilter,
        startMonth: entitlementStartMonth ? parseMonthInput(entitlementStartMonth) : null,
        endMonthBefore: entitlementEndMonth ? addLocalMonths(parseMonthInput(entitlementEndMonth), 1) : null,
      })
      setEntitlementItems(items)
    } catch (err) {
      setEntitlementError(err instanceof Error ? err.message : rechargeStrings.entitlementLoadFailed)
    } finally {
      setEntitlementBusy(false)
    }
  }

  return (
    <Card className="surface panel" id="user-detail-quota">
      <CardHeader className="panel-header border-b" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div>
          <CardTitle role="heading" aria-level={2}>{usersStrings.quota.title}</CardTitle>
          <CardDescription>{usersStrings.quota.description}</CardDescription>
        </div>
      </CardHeader>

      {hasBlockAllTag && (
        <Alert className="border-warning/40 bg-warning/10 text-warning" role="status"><AlertDescription>
          {usersStrings.effectiveQuota.blockAllNotice}
        </AlertDescription></Alert>
      )}

      <div>
        <div>
          <h3>{usersStrings.effectiveQuota.title}</h3>
          <p className="text-sm text-muted-foreground">{usersStrings.effectiveQuota.description}</p>
        </div>
        <UserDetailQuotaBreakdown
          entries={breakdownEntries}
          usersStrings={usersStrings}
          language={language}
          formatQuotaLimitValue={formatQuotaLimitValue}
          formatSignedQuotaDelta={formatSignedQuotaDelta}
        />
      </div>

      <UserRechargeQuotaCalendar
        detail={detail}
        strings={rechargeStrings}
        language={language}
        formatNumber={formatNumber}
        embedded
      />

      <div>
        <div>
          <div>
            <h3>{rechargeStrings.entitlementTitle}</h3>
            <p className="text-sm text-muted-foreground">{rechargeStrings.entitlementDescription}</p>
          </div>
          <Dialog
            open={entitlementDialogOpen}
            onOpenChange={(open) => {
              if (entitlementBusy) return
              setEntitlementDialogOpen(open)
              if (open) setEntitlementError(null)
            }}
          >
            <DialogTrigger asChild>
              <Button type="button">{rechargeStrings.entitlementCreate}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[64rem]">
              <DialogHeader>
                <DialogTitle>{rechargeStrings.entitlementCreate}</DialogTitle>
                <DialogDescription>{rechargeStrings.entitlementDescription}</DialogDescription>
              </DialogHeader>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field data-disabled={entitlementBusy}>
                  <FieldLabel htmlFor="user-entitlement-scope">{rechargeStrings.entitlementScope}</FieldLabel>
                  <Select
                    value={entitlementForm.scopeKind}
                    onValueChange={(value) => {
                      setEntitlementForm((current) => ({
                        ...current,
                        scopeKind: value === 'permanent' ? 'permanent' : value === 'month' ? 'month' : 'base',
                      }))
                    }}
                    disabled={entitlementBusy}
                  >
                    <SelectTrigger id="user-entitlement-scope" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup>
                    <SelectItem value="base">{rechargeStrings.entitlementScopeBase}</SelectItem>
                    <SelectItem value="month">{rechargeStrings.entitlementScopeMonth}</SelectItem>
                    <SelectItem value="permanent">{rechargeStrings.entitlementScopePermanent}</SelectItem>
                    </SelectGroup></SelectContent>
                  </Select>
                </Field>
                <Field data-disabled={entitlementBusy || entitlementForm.scopeKind !== 'month'}>
                  <FieldLabel htmlFor="user-entitlement-month">{rechargeStrings.entitlementMonth}</FieldLabel>
                  <Input
                    id="user-entitlement-month"
                    type="month"
                    value={entitlementForm.month}
                    onChange={(event) => setEntitlementForm((current) => ({ ...current, month: event.target.value }))}
                    disabled={entitlementBusy || entitlementForm.scopeKind !== 'month'}
                  />
                </Field>
                <EntitlementDeltaField
                  name="businessCalls1hDelta"
                  label={usersStrings.quota.hourly}
                  value={entitlementForm.businessCalls1hDelta}
                  disabled={entitlementBusy}
                  onChange={(value) => setEntitlementForm((current) => ({ ...current, businessCalls1hDelta: value }))}
                />
                <EntitlementDeltaField
                  name="dailyCreditsDelta"
                  label={usersStrings.quota.daily}
                  value={entitlementForm.dailyCreditsDelta}
                  disabled={entitlementBusy}
                  onChange={(value) => setEntitlementForm((current) => ({ ...current, dailyCreditsDelta: value }))}
                />
                <EntitlementDeltaField
                  name="monthlyCreditsDelta"
                  label={usersStrings.quota.monthly}
                  value={entitlementForm.monthlyCreditsDelta}
                  disabled={entitlementBusy}
                  onChange={(value) => setEntitlementForm((current) => ({ ...current, monthlyCreditsDelta: value }))}
                />
                <Field data-disabled={entitlementBusy}>
                  <FieldLabel htmlFor="user-entitlement-backend-note">{rechargeStrings.entitlementBackendNote}</FieldLabel>
                  <Textarea id="user-entitlement-backend-note" value={entitlementForm.backendNote} onChange={(event) => setEntitlementForm((current) => ({ ...current, backendNote: event.target.value }))} disabled={entitlementBusy} />
                </Field>
                <Field data-disabled={entitlementBusy}>
                  <FieldLabel htmlFor="user-entitlement-frontend-note">{rechargeStrings.entitlementFrontendNote}</FieldLabel>
                  <Textarea id="user-entitlement-frontend-note" value={entitlementForm.frontendNote} onChange={(event) => setEntitlementForm((current) => ({ ...current, frontendNote: event.target.value }))} disabled={entitlementBusy} />
                </Field>
                <div>
                  <Button type="button" onClick={() => void submitEntitlement()} disabled={entitlementBusy}>
                    {entitlementBusy ? rechargeStrings.entitlementSaving : rechargeStrings.entitlementCreate}
                  </Button>
                </div>
              </FieldGroup>
              {entitlementError && <p role="status">{entitlementError}</p>}
            </DialogContent>
          </Dialog>
        </div>
        <div>
          <span>{rechargeStrings.entitlementBase.replace('{value}', formatSignedQuotaDelta(detail.entitlements.currentBaseDelta.monthlyCreditsDelta))}</span>
          <span>{rechargeStrings.entitlementCurrentMonth.replace('{value}', formatSignedQuotaDelta(detail.entitlements.currentMonthDelta.monthlyCreditsDelta))}</span>
          <span>{rechargeStrings.entitlementPermanent.replace('{value}', formatSignedQuotaDelta(detail.entitlements.currentPermanentDelta.monthlyCreditsDelta))}</span>
        </div>
        <div className="user-detail-entitlement-filters">
          <Select value={entitlementScopeFilter} onValueChange={(value) => setEntitlementScopeFilter(value as EntitlementScopeFilter)} disabled={entitlementBusy}>
            <SelectTrigger aria-label={rechargeStrings.entitlementScope}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                <SelectItem value="all">{rechargeStrings.entitlementScopeAll}</SelectItem>
                <SelectItem value="base">{rechargeStrings.entitlementScopeBase}</SelectItem>
                <SelectItem value="month">{rechargeStrings.entitlementScopeMonth}</SelectItem>
                <SelectItem value="permanent">{rechargeStrings.entitlementScopePermanent}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <DateTimeRangeField
            label={rechargeStrings.entitlementFilterRange}
            hideLabel
            inputType="month"
            startId="user-detail-entitlement-filter-start"
            endId="user-detail-entitlement-filter-end"
            startLabel={rechargeStrings.entitlementFilterStart}
            endLabel={rechargeStrings.entitlementFilterEnd}
            startValue={entitlementStartMonth}
            endValue={entitlementEndMonth}
            startSeparator={rechargeStrings.entitlementFilterSeparator}
            startMax={entitlementEndMonth || undefined}
            endMin={entitlementStartMonth || undefined}
            disabled={entitlementBusy}
            onStartChange={setEntitlementStartMonth}
            onEndChange={setEntitlementEndMonth}
          />
          <Button className="user-detail-entitlement-apply-button" type="button" variant="outline" onClick={() => void applyEntitlementFilters()} disabled={entitlementBusy}>
            {rechargeStrings.entitlementApplyFilters}
          </Button>
        </div>
        <EntitlementTable
          items={entitlementItems}
          strings={rechargeStrings}
          locale={language === 'zh' ? 'zh-CN' : 'en-US'}
          formatSignedQuotaDelta={formatSignedQuotaDelta}
        />
      </div>
    </Card>
  )
}

function EntitlementDeltaField({
  name,
  label,
  value,
  disabled,
  onChange,
}: {
  name: string
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const parsedValue = parseSignedDeltaInput(value)
  const inputId = `${name}-entitlement-delta`
  return (
    <Field data-disabled={disabled}>
      <div>
        <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
        <Input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={formatSignedDeltaInput(value)}
          onChange={(event) => {
            const normalized = normalizeSignedDeltaInput(event.target.value)
            if (normalized == null) return
            onChange(normalized)
          }}
          aria-label={`${label} delta input`}
          disabled={disabled}
        />
      </div>
      <input
        type="range"
        name={`${name}-entitlement-delta-slider`}
        min={0}
        max={ENTITLEMENT_DELTA_STAGES.length - 1}
        step="any"
        className="w-full cursor-pointer accent-foreground"
        value={getSignedDeltaSliderPosition(parsedValue)}
        onChange={(event) => {
          const nextIndex = clampSignedDeltaSliderIndex(Number.parseFloat(event.target.value))
          onChange(String(ENTITLEMENT_DELTA_STAGES[nextIndex] ?? 0))
        }}
        style={{ background: buildSignedDeltaSliderTrack(parsedValue) }}
        aria-label={label}
        aria-valuetext={String(parsedValue)}
        disabled={disabled}
      />
    </Field>
  )
}

function EntitlementTable({
  items,
  strings,
  locale,
  formatSignedQuotaDelta,
}: {
  items: AdminUserEntitlement[]
  strings: AdminRechargeTranslations['userDetail']
  locale: string
  formatSignedQuotaDelta: (value: number) => string
}) {
  if (items.length === 0) return <Empty><EmptyDescription>{strings.entitlementEmpty}</EmptyDescription></Empty>
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{strings.entitlementScope}</TableHead>
            <TableHead>{strings.monthColumn}</TableHead>
            <TableHead>{strings.entitlementDeltaColumns}</TableHead>
            <TableHead>{strings.entitlementSource}</TableHead>
            <TableHead>{strings.entitlementNotes}</TableHead>
            <TableHead>{strings.entitlementActor}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{formatEntitlementScope(item.scopeKind, strings)}</TableCell>
              <TableCell>{item.scopeKind === 'month' ? formatMonth(item.monthStart, locale) : '—'}</TableCell>
              <TableCell>
                <div>
                  <span>{formatSignedQuotaDelta(item.businessCalls1hDelta)}</span>
                  <span>{formatSignedQuotaDelta(item.dailyCreditsDelta)}</span>
                  <span>{formatSignedQuotaDelta(item.monthlyCreditsDelta)}</span>
                </div>
              </TableCell>
              <TableCell>{item.sourceKind}</TableCell>
              <TableCell>
                <div>
                  <span>{item.backendNote}</span>
                  <span>{item.frontendNote}</span>
                </div>
              </TableCell>
              <TableCell>{item.actorDisplayName || item.actorUserId || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function formatMonthInput(ts: number): string {
  const date = new Date(ts * 1000)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

function parseMonthInput(value: string): number {
  const [year, month] = value.split('-').map((item) => Number(item))
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 0
  return Math.floor(new Date(year, month - 1, 1).getTime() / 1000)
}

function addLocalMonths(ts: number, months: number): number {
  if (!ts) return 0
  const date = new Date(ts * 1000)
  date.setMonth(date.getMonth() + months)
  return Math.floor(date.getTime() / 1000)
}

function formatMonth(ts: number, locale: string): string {
  return new Date(ts * 1000).toLocaleDateString(locale, { year: 'numeric', month: 'short' })
}

function formatEntitlementScope(
  scopeKind: AccountEntitlementScopeKind,
  strings: AdminRechargeTranslations['userDetail'],
): string {
  if (scopeKind === 'base') return strings.entitlementScopeBase
  if (scopeKind === 'permanent') return strings.entitlementScopePermanent
  return strings.entitlementScopeMonth
}

function parseIntegerInput(value: string): number {
  const parsed = Number.parseInt(normalizeSignedDeltaInput(value) ?? '', 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeSignedDeltaInput(value: string | undefined): string | null {
  const trimmed = (value ?? '').replace(/[\s,_']/g, '').trim()
  if (!trimmed) return ''
  if (trimmed === '-' || trimmed === '+') return trimmed
  if (!/^[+-]?\d+$/.test(trimmed)) return null

  const sign = trimmed.startsWith('-') ? '-' : trimmed.startsWith('+') ? '+' : ''
  const digitsOnly = trimmed.replace(/^[+-]/, '').replace(/^0+(?=\d)/, '')
  if (!digitsOnly || Number.parseInt(digitsOnly, 10) === 0) return '0'
  return `${sign}${digitsOnly}`
}

function parseSignedDeltaInput(value: string | undefined): number {
  const normalized = normalizeSignedDeltaInput(value)
  const parsed = Number.parseInt(normalized ?? '', 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatSignedDeltaInput(value: string | undefined): string {
  const normalized = normalizeSignedDeltaInput(value)
  if (normalized == null) return value ?? ''
  if (!normalized || normalized === '-' || normalized === '+') return normalized

  const parsed = Number.parseInt(normalized, 10)
  if (!Number.isFinite(parsed)) return normalized
  const sign = parsed < 0 ? '-' : normalized.startsWith('+') && parsed > 0 ? '+' : ''
  return `${sign}${Math.abs(parsed).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function getSignedDeltaSliderPosition(value: number): number {
  if (value <= ENTITLEMENT_DELTA_STAGES[0]) return 0
  for (let index = 0; index < ENTITLEMENT_DELTA_STAGES.length - 1; index += 1) {
    const left = ENTITLEMENT_DELTA_STAGES[index] ?? 0
    const right = ENTITLEMENT_DELTA_STAGES[index + 1] ?? left
    if (value <= right) {
      if (right <= left) return index + 1
      return index + (value - left) / (right - left)
    }
  }
  return ENTITLEMENT_DELTA_STAGES.length - 1
}

function clampSignedDeltaSliderIndex(index: number): number {
  if (!Number.isFinite(index)) return ENTITLEMENT_DELTA_STAGES.indexOf(0)
  return Math.min(ENTITLEMENT_DELTA_STAGES.length - 1, Math.max(0, Math.round(index)))
}

function toSignedDeltaSliderPercent(value: number): number {
  return Math.min(100, Math.max(0, (getSignedDeltaSliderPosition(value) / (ENTITLEMENT_DELTA_STAGES.length - 1)) * 100))
}

function buildSignedDeltaSliderTrack(value: number): string {
  const zero = toSignedDeltaSliderPercent(0)
  const current = toSignedDeltaSliderPercent(value)
  const start = Math.min(zero, current)
  const end = Math.max(zero, current)
  const activeColor = value < 0 ? 'color-mix(in oklab, var(--destructive) 46%, transparent)' : 'color-mix(in oklab, var(--primary) 50%, transparent)'
  return `linear-gradient(to right, color-mix(in oklab, var(--muted) 50%, transparent) 0% ${start}%, ${activeColor} ${start}% ${end}%, color-mix(in oklab, var(--muted) 50%, transparent) ${end}% 100%)`
}

function buildFallbackQuotaBreakdown(
  detail: AdminUserDetail,
  rechargeLabel: string,
): AdminUserQuotaBreakdownEntry[] {
  const rows: AdminUserQuotaBreakdownEntry[] = [
    buildQuotaBreakdownEntry({
      kind: 'base',
      label: 'base',
      tagId: null,
      tagName: null,
      source: null,
      effectKind: 'base',
      businessCalls1hDelta: detail.quotaBase.businessCalls1hLimit,
      dailyCreditsDelta: detail.quotaBase.dailyCreditsLimit,
      monthlyCreditsDelta: detail.quotaBase.monthlyCreditsLimit,
    }),
  ]
  const rechargeMonthlyDelta = detail.recharge?.currentMonthEntitlementMonthlyDelta ?? 0
  if (rechargeMonthlyDelta > 0) {
    rows.push(buildQuotaBreakdownEntry({
      kind: 'recharge',
      label: rechargeLabel,
      tagId: null,
      tagName: null,
      source: 'system_linuxdo',
      effectKind: 'quota_delta',
      businessCalls1hDelta: detail.recharge?.currentMonthEntitlementHourlyDelta ?? 0,
      dailyCreditsDelta: detail.recharge?.currentMonthEntitlementDailyDelta ?? 0,
      monthlyCreditsDelta: rechargeMonthlyDelta,
    }))
  }
  rows.push(buildQuotaBreakdownEntry({
    kind: 'effective',
    label: 'effective',
    tagId: null,
    tagName: null,
    source: null,
    effectKind: 'effective',
    businessCalls1hDelta: detail.effectiveQuota.businessCalls1hLimit,
    dailyCreditsDelta: detail.effectiveQuota.dailyCreditsLimit,
    monthlyCreditsDelta: detail.effectiveQuota.monthlyCreditsLimit,
  }))
  return rows
}
