import { type ReactNode } from 'react'
import { CrownIcon, RefreshCwIcon } from 'lucide-react'
import type React from 'react'

import AdminReturnToConsoleLink from './AdminReturnToConsoleLink'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeToggle from './ThemeToggle'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

interface AdminPanelHeaderProps {
  title: string
  subtitle?: string
  displayName?: string | null
  isAdmin: boolean
  isRefreshing: boolean
  refreshDisabled?: boolean
  refreshLabel: string
  refreshingLabel: string
  userConsoleLabel?: string
  userConsoleHref?: string
  stackActions?: boolean
  onRefresh: () => void
  extraActions?: ReactNode
}

export default function AdminPanelHeader(props: AdminPanelHeaderProps): React.JSX.Element {
  return (
    <section
      className={cn(
        'admin-panel-header flex flex-wrap items-start justify-between gap-3 border-b bg-background px-4 py-3',
        props.stackActions && 'admin-panel-header--stacked-actions',
      )}
    >
      <div className="admin-panel-header-main flex min-w-0 flex-col gap-1">
        <h1 className="truncate text-lg font-semibold">{props.title}</h1>
        {props.subtitle ? (
          <p className="admin-panel-header-subtitle text-sm text-muted-foreground">{props.subtitle}</p>
        ) : null}
      </div>

      <div className="admin-panel-header-side flex flex-col items-end gap-2">
        <div className="admin-panel-header-tools flex items-center gap-2">
          <div className="admin-language-switcher flex items-center gap-1">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
          {props.displayName && (
            <div
              className={cn(
                'user-badge inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                props.isAdmin
                  ? 'user-badge-admin border-warning/40 bg-warning/10 text-warning'
                  : 'border-border bg-muted text-muted-foreground',
              )}
              title={props.displayName}
            >
              {props.isAdmin && <CrownIcon className="size-3.5" aria-hidden="true" />}
              <span className="max-w-40 truncate">{props.displayName}</span>
            </div>
          )}
        </div>

        <div
          className={cn(
            'admin-panel-header-actions flex flex-wrap items-center gap-2',
            props.stackActions && 'admin-panel-header-actions--stacked flex-col items-stretch',
          )}
        >
          {props.extraActions}

          {props.userConsoleLabel && (
            <AdminReturnToConsoleLink
              label={props.userConsoleLabel}
              href={props.userConsoleHref}
              className="admin-return-link--header"
            />
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="admin-panel-refresh-button"
            onClick={props.onRefresh}
            disabled={props.isRefreshing || props.refreshDisabled}
          >
            {props.isRefreshing ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCwIcon data-icon="inline-start" />
            )}
            <span>{props.isRefreshing ? props.refreshingLabel : props.refreshLabel}</span>
          </Button>
        </div>
      </div>
    </section>
  )
}
