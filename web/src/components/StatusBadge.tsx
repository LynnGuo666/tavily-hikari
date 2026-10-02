import React from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'

const toneStyles: Record<StatusTone, { variant: BadgeVariant; className: string }> = {
  success: { variant: 'outline', className: 'border-success/30 bg-success/10 text-success' },
  warning: { variant: 'outline', className: 'border-warning/40 bg-warning/10 text-warning' },
  error: { variant: 'destructive', className: '' },
  info: { variant: 'outline', className: 'border-primary/30 bg-primary/10 text-primary' },
  neutral: { variant: 'outline', className: 'bg-muted text-muted-foreground' },
}

export interface StatusBadgeProps {
  tone: StatusTone
  children: React.ReactNode
  className?: string
  title?: string
}

export function StatusBadge({ tone, children, className = '', title }: StatusBadgeProps): React.JSX.Element {
  const style = toneStyles[tone]
  return (
    <Badge variant={style.variant} className={cn('status-badge', `status-pill-${tone}`, style.className, className)} title={title}>
      {children}
    </Badge>
  )
}
