import type { ReactNode } from 'react'

import { cn } from '../lib/utils'

interface AdminModuleSurfaceProps {
  children: ReactNode
  className?: string
  toolbar?: ReactNode
  toolbarClassName?: string
}

export default function AdminModuleSurface({
  children,
  className,
  toolbar,
  toolbarClassName,
}: AdminModuleSurfaceProps): JSX.Element {
  return (
    <section className={cn('surface panel flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-card-foreground ring-1 ring-foreground/10 admin-module-surface', className)}>
      {toolbar ? (
        <div className={cn('admin-module-toolbar', toolbarClassName)}>
          {toolbar}
        </div>
      ) : null}
      {children}
    </section>
  )
}
