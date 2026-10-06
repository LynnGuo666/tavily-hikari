import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type React from 'react'

import type { QueryLoadState } from '../admin/queryLoadState'
import { cn } from '../lib/utils'
import AdminLoadingRegion from './AdminLoadingRegion'
import { Table } from '@/components/ui/table'

interface AdminTableShellProps {
  children: ReactNode
  className?: string
  tableClassName?: string
  loadState?: QueryLoadState
  loadingLabel?: ReactNode
  errorLabel?: ReactNode
  minHeight?: number | string
  skeletonRows?: number
}

// macOS overlay scrollbars never surface a persistent affordance, so wide tables get
// edge fades whenever there is more content beyond the visible scroll position. The
// ref wrapper stays mounted across skeleton/table swaps so observers attach once.
export default function AdminTableShell({
  children,
  className,
  tableClassName,
  loadState = 'ready',
  loadingLabel,
  errorLabel,
  minHeight,
  skeletonRows,
}: AdminTableShellProps): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [edgeFade, setEdgeFade] = useState<{ left: boolean; right: boolean }>({ left: false, right: false })

  const updateEdgeFade = useCallback(() => {
    const container = wrapperRef.current?.querySelector('[data-slot=table-container]')
    if (!(container instanceof HTMLElement)) return
    setEdgeFade({
      left: container.scrollLeft > 4,
      right: container.scrollLeft + container.clientWidth < container.scrollWidth - 4,
    })
  }, [])

  useEffect(() => {
    updateEdgeFade()
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const observer = new ResizeObserver(updateEdgeFade)
    observer.observe(wrapper)
    wrapper.querySelectorAll('table').forEach((table) => observer.observe(table))
    const mutationObserver = new MutationObserver(() => {
      updateEdgeFade()
      wrapper.querySelectorAll('table').forEach((table) => observer.observe(table))
    })
    mutationObserver.observe(wrapper, { childList: true, subtree: true })
    // Native capture listener: scroll does not bubble through React synthetic events.
    wrapper.addEventListener('scroll', updateEdgeFade, { capture: true, passive: true })
    return () => {
      observer.disconnect()
      mutationObserver.disconnect()
      wrapper.removeEventListener('scroll', updateEdgeFade, { capture: true })
    }
  }, [updateEdgeFade])

  return (
    <div ref={wrapperRef} className="relative">
      {edgeFade.left ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-card to-transparent" />
      ) : null}
      {edgeFade.right ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-card to-transparent" />
      ) : null}
      <AdminLoadingRegion
        className={cn('table-wrapper overflow-hidden', className)}
        loadState={loadState}
        loadingLabel={loadingLabel}
        errorLabel={errorLabel}
        minHeight={minHeight}
        skeletonRows={skeletonRows}
      >
        <Table className={tableClassName}>{children}</Table>
      </AdminLoadingRegion>
    </div>
  )
}
