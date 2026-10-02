import React from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral'

const toneClassName: Record<StatusTone, string> = {
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
  info: 'border-primary/30 bg-primary/10 text-primary',
  neutral: 'border-border bg-muted text-muted-foreground',
}

export interface StatusBadgeProps {
  tone: StatusTone
  children: React.ReactNode
  className?: string
  title?: string
}

export function StatusBadge({ tone, children, className = '', title }: StatusBadgeProps): JSX.Element {
  return (
    <Badge variant="outline" className={cn('status-badge', `status-pill-${tone}`, toneClassName[tone], className)} title={title}>
      {children}
    </Badge>
  )
}
