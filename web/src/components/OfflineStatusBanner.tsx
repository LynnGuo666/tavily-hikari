import { Icon } from '../lib/icons'
import type React from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface OfflineStatusBannerProps {
  title: string
  description: string
}

export default function OfflineStatusBanner({
  title,
  description,
}: OfflineStatusBannerProps): React.JSX.Element {
  return (
    <Alert variant="destructive" className="surface offline-status-banner" role="status" aria-live="polite">
      <Icon icon="mdi:web-off" width={20} height={20} className="offline-status-banner-icon" aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  )
}
