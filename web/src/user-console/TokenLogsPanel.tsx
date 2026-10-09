import { Empty, EmptyDescription } from '@/components/ui/empty'
import { type PublicTokenLog } from '../api'
import { StatusBadge, type StatusTone } from '../components/StatusBadge'
import TokenLogsHeader, { type DetailLogsPushIssueCode, type SegmentedTabsOption, type UserTokenLogFilter } from './TokenLogsHeader'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type React from 'react'

interface TokenLogsPanelText {
  logs: string
  emptyLogs: string
  noError: string
  mobileOpen: string
  mobileSummary: string
  mobileAction: string
  logFilters: {
    ariaLabel: string
  }
  pushStatus: {
    ariaLabel: string
    browserUnsupported: string
    reconnecting: string
    closed: string
  }
  table: {
    request: string
    transport: string
    credits: string
    result: string
  }
  resultLabels: Record<string, string>
}

interface TokenLogsPanelProps {
  logs: PublicTokenLog[]
  text: TokenLogsPanelText
  filter: UserTokenLogFilter
  filterOptions: ReadonlyArray<SegmentedTabsOption<UserTokenLogFilter>>
  filterDisabled: boolean
  pushIssue: DetailLogsPushIssueCode | null
  mode: 'detail' | 'full'
  onFilterChange: (filter: UserTokenLogFilter) => void
  onOpenFull: () => void
  formatTimestamp: (timestamp: number) => string
  formatLogCredits: (value: number | null | undefined) => string
  statusTone: (status: string) => StatusTone
}

const LOGS_TABLE_HEAD_CLASS = 'text-xs tracking-wide text-muted-foreground uppercase'

export default function TokenLogsPanel({
  logs,
  text,
  filter,
  filterOptions,
  filterDisabled,
  pushIssue,
  mode,
  onFilterChange,
  onOpenFull,
  formatTimestamp,
  formatLogCredits,
  statusTone,
}: TokenLogsPanelProps): React.JSX.Element {
  const renderDesktopRows = (keyPrefix: string) =>
    logs.map((log, index) => (
      <TableRow key={`${keyPrefix}-${log.id}-${index}`}>
        <TableCell className="whitespace-normal">
          <div className="flex min-w-0 flex-col gap-0.5">
            <strong className="text-sm font-semibold tabular-nums">{formatTimestamp(log.created_at)}</strong>
            <span className="truncate text-xs text-muted-foreground">
              {log.method} {log.path}
              {log.query ? ` · ${log.query}` : ''}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <em className="not-italic text-muted-foreground">H</em>
              <strong className="font-semibold tabular-nums">{log.http_status ?? '—'}</strong>
            </span>
            <span className="flex items-center gap-1">
              <em className="not-italic text-muted-foreground">T</em>
              <strong className="font-semibold tabular-nums">{log.mcp_status ?? '—'}</strong>
            </span>
          </div>
        </TableCell>
        <TableCell className="user-console-log-credits tabular-nums">
          {formatLogCredits(log.business_credits)}
        </TableCell>
        <TableCell className="whitespace-normal">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <StatusBadge tone={statusTone(log.result_status)}>
              {text.resultLabels[log.result_status] ?? log.result_status}
            </StatusBadge>
            <span className="truncate text-xs text-muted-foreground">{log.error_message ?? '—'}</span>
          </div>
        </TableCell>
      </TableRow>
    ))

  const renderLogsTable = (tableClassName: string, keyPrefix: string): React.JSX.Element => (
    <Table className={tableClassName}>
      <TableHeader>
        <TableRow>
          <TableHead className={LOGS_TABLE_HEAD_CLASS}>{text.table.request}</TableHead>
          <TableHead className={LOGS_TABLE_HEAD_CLASS}>{text.table.transport}</TableHead>
          <TableHead className={LOGS_TABLE_HEAD_CLASS}>{text.table.credits}</TableHead>
          <TableHead className={LOGS_TABLE_HEAD_CLASS}>{text.table.result}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{renderDesktopRows(keyPrefix)}</TableBody>
    </Table>
  )

  return (
    <section
      className={cn(
        'surface panel flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-card-foreground ring-1 ring-foreground/10',
        `is-${mode}`,
        'overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10',
      )}
    >
      <TokenLogsHeader
        title={mode === 'detail' ? text.logs : undefined}
        filter={filter}
        filterOptions={filterOptions}
        filterAriaLabel={text.logFilters.ariaLabel}
        filterDisabled={filterDisabled}
        pushIssue={pushIssue}
        pushStatusText={text.pushStatus}
        onFilterChange={onFilterChange}
      />
      {mode === 'detail' ? (
        <button
          type="button"
          className="user-console-mobile-log-entry flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
          aria-label={`${text.mobileOpen}，${text.mobileSummary}`}
          onClick={onOpenFull}
        >
          <span className="flex min-w-0 flex-col">
            <strong className="truncate text-sm font-semibold">{text.mobileOpen}</strong>
            <span className="truncate text-xs text-muted-foreground">{text.mobileSummary}</span>
          </span>
          <span className="user-console-mobile-log-entry-action text-muted-foreground" aria-hidden="true">
            {text.mobileAction}
          </span>
        </button>
      ) : null}
      <div
        className={cn(
          'table-wrapper rounded-lg border',
          mode === 'detail'
            ? 'max-h-[420px] overflow-auto table-sticky-header-shell user-console-logs-table-scroll'
            : 'overflow-x-auto',
        )}
        onScroll={mode === 'detail'
          ? (event) => event.currentTarget.style.setProperty('--table-scroll-y', `${event.currentTarget.scrollTop}px`)
          : undefined}
      >
        {logs.length === 0 ? (
          <Empty className="p-6"><EmptyDescription>{text.emptyLogs}</EmptyDescription></Empty>
        ) : (
          <>
            {mode === 'detail' ? (
              <div className="table-sticky-header-overlay sr-only" aria-hidden="true">
                <div className="table-sticky-header-blur-source">
                  {renderLogsTable('token-detail-table user-console-logs-table table-sticky-header-blur', 'blur')}
                </div>
                <div className="table-sticky-header-labels">
                  <span>{text.table.request}</span>
                  <span>{text.table.transport}</span>
                  <span>{text.table.credits}</span>
                  <span>{text.table.result}</span>
                </div>
              </div>
            ) : null}
            <div className={mode === 'detail' ? 'table-sticky-header-content' : undefined}>
              {renderLogsTable(
                mode === 'detail'
                  ? 'token-detail-table user-console-logs-table table-sticky-header'
                  : 'token-detail-table user-console-logs-table',
                'content',
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
