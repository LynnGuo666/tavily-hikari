import type { ReactNode } from 'react'
import type React from 'react'

import SegmentedTabs from '../components/SegmentedTabs'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Icon } from '../lib/icons'

export type DetailLogsPushIssueCode = 'unsupported' | 'reconnecting' | 'closed'
export type UserTokenLogFilter = 'all' | 'billable'

export interface SegmentedTabsOption<T extends string = string> {
  value: T
  label: ReactNode
  disabled?: boolean
}

export interface DetailLogsPushStatusText {
  ariaLabel: string
  browserUnsupported: string
  reconnecting: string
  closed: string
}

interface TokenLogsHeaderProps {
  title: string
  filter: UserTokenLogFilter
  filterOptions: ReadonlyArray<SegmentedTabsOption<UserTokenLogFilter>>
  filterAriaLabel: string
  filterDisabled: boolean
  pushIssue: DetailLogsPushIssueCode | null
  pushStatusText: DetailLogsPushStatusText
  onFilterChange: (filter: UserTokenLogFilter) => void
}

export function resolveDetailLogsPushIssueMessage(
  issue: DetailLogsPushIssueCode,
  text: DetailLogsPushStatusText,
): string {
  switch (issue) {
    case 'unsupported':
      return text.browserUnsupported
    case 'reconnecting':
      return text.reconnecting
    case 'closed':
      return text.closed
  }
}

export default function TokenLogsHeader({
  title,
  filter,
  filterOptions,
  filterAriaLabel,
  filterDisabled,
  pushIssue,
  pushStatusText,
  onFilterChange,
}: TokenLogsHeaderProps): React.JSX.Element {
  return (
    <div className="user-console-logs-header flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="user-console-logs-header-actions flex items-center gap-2">
        <SegmentedTabs<UserTokenLogFilter>
          value={filter}
          onChange={onFilterChange}
          options={filterOptions}
          ariaLabel={filterAriaLabel}
          disabled={filterDisabled}
        />
        {pushIssue ? (
          <div className="user-console-push-status-slot is-active flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon"
                  type="button"
                  className="user-console-push-status-trigger text-warning"
                  aria-label={pushStatusText.ariaLabel}
                >
                  <Icon icon="mdi:alert-circle-outline" width={18} height={18} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" align="end" className="max-w-[min(20rem,calc(100vw-2rem))]">
                {resolveDetailLogsPushIssueMessage(pushIssue, pushStatusText)}
              </TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </div>
    </div>
  )
}
