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
      <div className="table-wrapper overflow-hidden hidden md:block mt-3">
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
                    <div>
                      <div>
                        <span>{view.breakdownLabel}</span>
                      </div>
                      {entry.tagName && (
                        <div>
                          <code>{entry.tagName}</code>
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

      <div className="flex flex-col gap-3 md:hidden flex md:hidden mt-3">
        {entries.map((entry, index) => {
          const view = buildBreakdownViewModel(entry, usersStrings)
          return (
            <article className="rounded-lg border p-3 admin-user-breakdown-card" key={`${entry.kind}:${entry.tagId ?? 'row'}:${index}`}>
              <div>
                <div>
                  <span>{usersStrings.effectiveQuota.columns.item}</span>
                  <div className="text-sm text-muted-foreground">
                    <strong>{view.breakdownLabel}</strong>
                    {entry.tagName ? <code>{entry.tagName}</code> : null}
                  </div>
                </div>
                <StatusBadge tone={view.effectTone}>{view.effectLabel}</StatusBadge>
              </div>

              <div>
                <div>
                  <span>{usersStrings.effectiveQuota.columns.source}</span>
                  <strong>{view.sourceLabel}</strong>
                </div>
              </div>

              <div className="admin-user-mobile-metric-grid">
                <div>
                  <UsageMetricLabel
                    label={usersStrings.quota.hourly}
                    kind="businessCalls1h"
                    language={language}
                  />
                  <strong>{formatBreakdownValue(entry, view.isAbsoluteRow, entry.businessCalls1hDelta)}</strong>
                </div>
                <div>
                  <UsageMetricLabel
                    label={usersStrings.quota.daily}
                    kind="dailyCredits"
                    language={language}
                  />
                  <strong>{formatBreakdownValue(entry, view.isAbsoluteRow, entry.dailyCreditsDelta)}</strong>
                </div>
                <div>
                  <UsageMetricLabel
                    label={usersStrings.quota.monthly}
                    kind="monthlyCredits"
                    language={language}
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
