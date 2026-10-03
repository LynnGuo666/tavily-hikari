import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Icon } from '../lib/icons'
import type { AdminUserTokenSummary } from '../api'
import type { AdminTranslations } from '../i18n'
import { StatusBadge } from '../components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import type React from 'react'

interface UserDetailTokenTableProps {
  tokens: AdminUserTokenSummary[]
  usersStrings: AdminTranslations['users']
  formatNumber: (value: number) => string
  formatTimestamp: (value: number | null | undefined) => string
  onViewToken: (tokenId: string) => void
  onDeleteToken: (tokenId: string) => void
  deletingTokenId?: string | null
}

export function UserDetailTokenTable({
  tokens,
  usersStrings,
  formatNumber,
  formatTimestamp,
  onViewToken,
  onDeleteToken,
  deletingTokenId = null,
}: UserDetailTokenTableProps): React.JSX.Element {
  if (tokens.length === 0) {
    return <Empty><EmptyDescription>{usersStrings.empty.noTokens}</EmptyDescription></Empty>
  }

  return (
    <>
      <div className="hidden md:block">
        <Table className="admin-user-tokens-table">
          <TableHeader>
            <TableRow>
              <TableHead>{`${usersStrings.tokens.table.id} · ${usersStrings.tokens.table.note}`}</TableHead>
              <TableHead>{`${usersStrings.tokens.table.status} · ${usersStrings.tokens.table.lastUsed}`}</TableHead>
              <TableHead>{`${usersStrings.tokens.table.totalRequests} · ${usersStrings.tokens.table.createdAt}`}</TableHead>
              <TableHead>{`${usersStrings.tokens.table.successDaily} · ${usersStrings.tokens.table.successMonthly}`}</TableHead>
              <TableHead>{usersStrings.tokens.table.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => {
              const successDailyText = `${formatNumber(token.dailySuccess)} / ${formatNumber(token.dailyFailure)}`
              const canDelete = tokens.length > 1
              const isDeleting = deletingTokenId === token.tokenId
              const deleteLabel = canDelete ? usersStrings.tokens.actions.delete : usersStrings.tokens.actions.deleteDisabled
              return (
                <TableRow key={token.tokenId}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline gap-1.5">
                        <code className="tabular-nums">{token.tokenId}</code>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="tabular-nums">{token.note || '—'}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline gap-1.5">
                        <StatusBadge tone={token.enabled ? 'success' : 'neutral'}>
                          {token.enabled ? usersStrings.status.enabled : usersStrings.status.disabled}
                        </StatusBadge>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="tabular-nums">{formatTimestamp(token.lastUsedAt)}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs text-muted-foreground">{usersStrings.tokens.table.totalRequests}</span>
                        <span className="tabular-nums">{formatNumber(token.totalRequests)}</span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs text-muted-foreground">{usersStrings.tokens.table.createdAt}</span>
                        <span className="tabular-nums">{formatTimestamp(token.createdAt)}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs text-muted-foreground">{usersStrings.tokens.table.successDaily}</span>
                        <span className="tabular-nums">{successDailyText}</span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs text-muted-foreground">{usersStrings.tokens.table.successMonthly}</span>
                        <span className="tabular-nums">{formatNumber(token.monthlySuccess)}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full p-0 shadow-none"
                        title={usersStrings.tokens.actions.view}
                        aria-label={usersStrings.tokens.actions.view}
                        onClick={() => onViewToken(token.tokenId)}
                      >
                        <Icon icon="mdi:eye-outline" width={16} height={16} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full p-0 shadow-none"
                        title={deleteLabel}
                        aria-label={deleteLabel}
                        disabled={!canDelete || isDeleting}
                        onClick={() => onDeleteToken(token.tokenId)}
                      >
                        <Icon icon={isDeleting ? 'mdi:progress-helper' : 'mdi:trash-outline'} width={16} height={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:hidden flex md:hidden">
        {tokens.map((token) => {
          const successDailyText = `${formatNumber(token.dailySuccess)} / ${formatNumber(token.dailyFailure)}`
          const canDelete = tokens.length > 1
          const isDeleting = deletingTokenId === token.tokenId
          const deleteLabel = canDelete ? usersStrings.tokens.actions.delete : usersStrings.tokens.actions.deleteDisabled
          return (
            <article key={token.tokenId} className="rounded-lg border p-3 admin-user-token-card">
              <div>
                <div>
                  <span>{usersStrings.tokens.table.id}</span>
                  <div className="text-sm text-muted-foreground">
                    <code>{token.tokenId}</code>
                    <div>
                      <span>{token.note || '—'}</span>
                      <StatusBadge
                        tone={token.enabled ? 'success' : 'neutral'}
                      >
                        {token.enabled ? usersStrings.status.enabled : usersStrings.status.disabled}
                      </StatusBadge>
                    </div>
                  </div>
                </div>
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full p-0 shadow-none"
                    title={usersStrings.tokens.actions.view}
                    aria-label={usersStrings.tokens.actions.view}
                    onClick={() => onViewToken(token.tokenId)}
                  >
                    <Icon icon="mdi:eye-outline" width={16} height={16} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full p-0 shadow-none"
                    title={deleteLabel}
                    aria-label={deleteLabel}
                    disabled={!canDelete || isDeleting}
                    onClick={() => onDeleteToken(token.tokenId)}
                  >
                    <Icon icon={isDeleting ? 'mdi:progress-helper' : 'mdi:trash-outline'} width={16} height={16} />
                  </Button>
                </div>
              </div>

              <div className="admin-user-mobile-metric-grid">
                <div>
                  <span className="text-xs text-muted-foreground">{usersStrings.tokens.table.lastUsed}</span>
                  <strong>{formatTimestamp(token.lastUsedAt)}</strong>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">{usersStrings.tokens.table.totalRequests}</span>
                  <strong>{formatNumber(token.totalRequests)}</strong>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">{usersStrings.tokens.table.successMonthly}</span>
                  <strong>{formatNumber(token.monthlySuccess)}</strong>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">{usersStrings.tokens.table.successDaily}</span>
                  <strong>{successDailyText}</strong>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">{usersStrings.tokens.table.createdAt}</span>
                  <strong>{formatTimestamp(token.createdAt)}</strong>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
