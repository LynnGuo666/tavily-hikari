import React from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral'

const toneVariant = {
  success: 'success',
  warning: 'warning',
  error: 'destructive',
  info: 'info',
  neutral: 'neutral',
} as const

export interface StatusBadgeProps {
  tone: StatusTone
  children: React.ReactNode
  className?: string
  title?: string
}

export function StatusBadge({ tone, children, className = '', title }: StatusBadgeProps): React.JSX.Element {
  return (
    <Badge variant={toneVariant[tone]} className={cn('status-badge', `status-pill-${tone}`, className)} title={title}>
      {children}
    </Badge>
  )
}
