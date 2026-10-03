import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import type { AdminUserQuotaBreakdownEntry } from '../api'
import { UsageMetricLabel } from '../components/UsageMetricLabel'
import type { AdminTranslations } from '../i18n'
import { StatusBadge, type StatusTone } from '../components/StatusBadge'
import type React from 'react'

interface UserDetailQuotaBreakdownProps {
  entries: AdminUserQuotaBreakdownEntry[]
  usersStrings: AdminTranslations['users']
  language: 'en' | 'zh'
  formatQuotaLimitValue: (value: number) => string
  formatSignedQuotaDelta: (value: number) => string
}

interface BreakdownViewModel {
  breakdownLabel: string
  sourceLabel: string
  effectLabel: string
  effectTone: StatusTone
  isAbsoluteRow: boolean
}

function buildBreakdownViewModel(
  entry: AdminUserQuotaBreakdownEntry,
  usersStrings: AdminTranslations['users'],
): BreakdownViewModel {
  const isAbsoluteRow = entry.kind === 'base' || entry.kind === 'effective'
  const breakdownLabel =
    entry.kind === 'base'
      ? usersStrings.effectiveQuota.baseLabel
      : entry.kind === 'effective'
        ? usersStrings.effectiveQuota.effectiveLabel
        : entry.label
  const sourceLabel = entry.source
    ? entry.source === 'system_linuxdo'
      ? usersStrings.userTags.sourceSystem
      : usersStrings.userTags.sourceManual
    : '—'
  const effectLabel =
    entry.effectKind === 'block_all'
      ? usersStrings.catalog.effectKinds.blockAll
      : entry.effectKind === 'base'
        ? usersStrings.effectiveQuota.baseLabel
        : entry.kind === 'effective' || entry.effectKind === 'effective'
          ? usersStrings.effectiveQuota.effectiveLabel
          : usersStrings.catalog.effectKinds.quotaDelta

  return {
    breakdownLabel,
    sourceLabel,
    effectLabel,
    effectTone: entry.effectKind === 'block_all' ? 'error' : 'neutral',
    isAbsoluteRow,
  }
}

export function UserDetailQuotaBreakdown({
  entries,
  usersStrings,
  language,
  formatQuotaLimitValue,
  formatSignedQuotaDelta,
}: UserDetailQuotaBreakdownProps): React.JSX.Element {
  const formatBreakdownValue = (entry: AdminUserQuotaBreakdownEntry, isAbsoluteRow: boolean, value: number) =>
    isAbsoluteRow ? formatQuotaLimitValue(value) : formatSignedQuotaDelta(value)

  return (
    <>
      <div className="table-wrapper overflow-hidden hidden md:block" style={{ marginTop: 12 }}>
        <Table className="user-tag-breakdown-table">
          <TableHeader>
            <TableRow>
              <TableHead>{usersStrings.effectiveQuota.columns.item}</TableHead>
              <TableHead>{usersStrings.effectiveQuota.columns.source}</TableHead>
              <TableHead>{usersStrings.effectiveQuota.columns.effect}</TableHead>
              <TableHead>
                <UsageMetricLabel label={usersStrings.quota.hourly} kind="businessCalls1h" language={language} />
              </TableHead>
              <TableHead>
                <UsageMetricLabel label={usersStrings.quota.daily} kind="dailyCredits" language={language} />
              </TableHead>
              <TableHead>
                <UsageMetricLabel label={usersStrings.quota.monthly} kind="monthlyCredits" language={language} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, index) => {
              const view = buildBreakdownViewModel(entry, usersStrings)
              return (
                <TableRow key={`${entry.kind}:${entry.tagId ?? 'row'}:${index}`}>
                  <TableCell>
                    <div className="token-compact-pair">
                      <div className="token-compact-field token-compact-field--wrap">
                        <span className="token-compact-value token-compact-value--wrap">{view.breakdownLabel}</span>
                      </div>
                      {entry.tagName && (
                        <div className="token-compact-field token-compact-field--wrap">
                          <code className="token-compact-value token-compact-value--wrap">{entry.tagName}</code>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{view.sourceLabel}</TableCell>
                  <TableCell>
                    <StatusBadge tone={view.effectTone}>{view.effectLabel}</StatusBadge>
                  </TableCell>
                  <TableCell>{formatBreakdownValue(entry, view.isAbsoluteRow, entry.businessCalls1hDelta)}</TableCell>
                  <TableCell>{formatBreakdownValue(entry, view.isAbsoluteRow, entry.dailyCreditsDelta)}</TableCell>
                  <TableCell>{formatBreakdownValue(entry, view.isAbsoluteRow, entry.monthlyCreditsDelta)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:hidden flex md:hidden" style={{ marginTop: 12 }}>
        {entries.map((entry, index) => {
          const view = buildBreakdownViewModel(entry, usersStrings)
          return (
            <article className="rounded-lg border p-3 admin-user-breakdown-card" key={`${entry.kind}:${entry.tagId ?? 'row'}:${index}`}>
              <div className="admin-user-mobile-card-head">
                <div className="admin-mobile-identity-block admin-user-mobile-identity">
                  <span className="admin-mobile-identity-label">{usersStrings.effectiveQuota.columns.item}</span>
                  <div className="panel-description text-sm text-muted-foreground admin-mobile-identity-meta admin-user-breakdown-meta">
                    <strong className="admin-user-breakdown-title">{view.breakdownLabel}</strong>
                    {entry.tagName ? <code className="admin-user-detail-mobile-code">{entry.tagName}</code> : null}
                  </div>
                </div>
                <StatusBadge tone={view.effectTone}>{view.effectLabel}</StatusBadge>
              </div>

              <div className="admin-user-mobile-chip-row">
                <div className="admin-user-mobile-chip admin-user-mobile-chip--wide">
                  <span className="admin-user-mobile-chip-label">{usersStrings.effectiveQuota.columns.source}</span>
                  <strong>{view.sourceLabel}</strong>
                </div>
              </div>

              <div className="admin-user-mobile-metric-grid admin-user-breakdown-metric-grid">
                <div className="admin-user-mobile-metric-card">
                  <UsageMetricLabel
                    label={usersStrings.quota.hourly}
                    kind="businessCalls1h"
                    language={language}
                    className="admin-user-mobile-metric-label"
                  />
                  <strong>{formatBreakdownValue(entry, view.isAbsoluteRow, entry.businessCalls1hDelta)}</strong>
                </div>
                <div className="admin-user-mobile-metric-card">
                  <UsageMetricLabel
                    label={usersStrings.quota.daily}
                    kind="dailyCredits"
                    language={language}
                    className="admin-user-mobile-metric-label"
                  />
                  <strong>{formatBreakdownValue(entry, view.isAbsoluteRow, entry.dailyCreditsDelta)}</strong>
                </div>
                <div className="admin-user-mobile-metric-card admin-user-mobile-metric-card--span-2">
                  <UsageMetricLabel
                    label={usersStrings.quota.monthly}
                    kind="monthlyCredits"
                    language={language}
                    className="admin-user-mobile-metric-label"
                  />
                  <strong>{formatBreakdownValue(entry, view.isAbsoluteRow, entry.monthlyCreditsDelta)}</strong>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
