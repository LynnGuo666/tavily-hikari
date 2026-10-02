import { type PropsWithChildren, type ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface AdminSidebarUtilityCardProps extends PropsWithChildren {
  title?: ReactNode
  description?: ReactNode
  className?: string
}

interface AdminSidebarUtilityStackProps extends PropsWithChildren {
  className?: string
}

export function AdminSidebarUtilityStack({
  children,
  className,
}: AdminSidebarUtilityStackProps): JSX.Element {
  const classes = cn('admin-sidebar-utility-stack flex flex-col gap-3', className)

  return <div className={classes}>{children}</div>
}

export function AdminSidebarUtilityCard({
  title,
  description,
  className,
  children,
}: AdminSidebarUtilityCardProps): JSX.Element {
  const classes = cn('admin-sidebar-utility-card', className)

  return (
    <Card size="sm" className={classes}>
      {(title || description) ? (
        <CardHeader>
          {title ? <CardTitle>{title}</CardTitle> : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
      ) : null}
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  )
}
