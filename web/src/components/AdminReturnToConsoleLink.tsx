import { Icon } from '../lib/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type React from 'react'

import { ADMIN_USER_CONSOLE_HREF } from '../lib/adminUserConsoleEntry'

interface AdminReturnToConsoleLinkProps {
  label: string
  href?: string
  className?: string
}

export default function AdminReturnToConsoleLink({
  label,
  href = ADMIN_USER_CONSOLE_HREF,
  className,
}: AdminReturnToConsoleLinkProps): React.JSX.Element {
  const classes = cn('admin-return-link', className)

  return (
    <Button asChild variant="outline" size="sm" className={classes}>
    <a href={href} aria-label={label}>
      <Icon icon="mdi:monitor-dashboard" data-icon="inline-start" aria-hidden="true" />
      <span>{label}</span>
    </a>
    </Button>
  )
}
