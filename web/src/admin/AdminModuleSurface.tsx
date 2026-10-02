import type { ReactNode } from 'react'
import type React from 'react'

import { cn } from '../lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/card'

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
}: AdminModuleSurfaceProps): React.JSX.Element {
  return (
    <Card className={cn('surface panel admin-module-surface', className)}>
      {toolbar ? (
        <CardHeader className={cn('flex flex-wrap items-center justify-between gap-3 border-b', toolbarClassName)}>
          {toolbar}
        </CardHeader>
      ) : null}
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  )
}
