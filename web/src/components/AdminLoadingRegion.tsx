import { Empty, EmptyDescription } from '@/components/ui/empty'
import type { ReactNode } from 'react'

import type { QueryLoadState } from '../admin/queryLoadState'
import { isBlockingLoadState, isRefreshingLoadState } from '../admin/queryLoadState'
import { cn } from '../lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface AdminLoadingRegionProps {
  children?: ReactNode
  className?: string
  loadState?: QueryLoadState
  loadingLabel?: ReactNode
  errorLabel?: ReactNode
  minHeight?: number | string
  skeletonRows?: number
}

export default function AdminLoadingRegion({
  children,
  className,
  loadState = 'ready',
  loadingLabel = 'Loading…',
  errorLabel,
  minHeight = 220,
  skeletonRows = 4,
}: AdminLoadingRegionProps): JSX.Element {
  const blocking = isBlockingLoadState(loadState)
  const refreshing = isRefreshingLoadState(loadState)
  const errored = loadState === 'error'
  const ariaBusy = blocking || refreshing

  return (
    <div
      className={cn(
        'admin-loading-region min-w-0 max-w-full',
        blocking && 'admin-loading-region-blocking',
        refreshing && 'admin-loading-region-refreshing',
        className,
      )}
      aria-busy={ariaBusy ? true : undefined}
    >
      {blocking ? (
        <div className="admin-loading-region-placeholder flex flex-col gap-3 p-4" style={{ minHeight }}>
          <div className="admin-loading-region-skeleton flex flex-col gap-3" aria-hidden="true">
            {Array.from({ length: skeletonRows }, (_, index) => (
              <Skeleton
                key={`admin-loading-skeleton-${index}`}
                className="admin-loading-region-skeleton-row h-5"
                style={{ width: `${Math.max(42, 100 - index * 11)}%` }}
              />
            ))}
          </div>
          <div className="admin-loading-region-label">{loadingLabel}</div>
        </div>
      ) : errored && errorLabel ? (
        <Empty className="admin-loading-region-error empty-state" role="alert"><EmptyDescription>
          {errorLabel}
        </EmptyDescription></Empty>
      ) : (
        <>
          {refreshing && (
            <div className="admin-loading-region-indicator p-2 text-xs text-muted-foreground" aria-live="polite">
              {loadingLabel}
            </div>
          )}
          {children}
        </>
      )}
    </div>
  )
}
