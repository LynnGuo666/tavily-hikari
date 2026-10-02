import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AdminCompactIntroProps {
  title: ReactNode
  description?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}

export default function AdminCompactIntro({
  title,
  description,
  meta,
  actions,
  className,
}: AdminCompactIntroProps): JSX.Element {
  const classes = cn('admin-compact-intro flex flex-wrap items-end justify-between gap-4', actions && 'admin-compact-intro--with-actions', className)

  return (
    <section className={classes}>
      <div className="admin-compact-intro-main flex min-w-0 flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="admin-compact-intro-description text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="admin-compact-intro-actions max-w-full">{actions}</div> : null}
      {meta ? <div className="admin-compact-intro-meta text-sm text-muted-foreground">{meta}</div> : null}
    </section>
  )
}
