import { AlertTriangle, DownloadCloud, Loader2, RefreshCw } from 'lucide-react'
import type React from 'react'

import type { PublicTranslations } from '../i18n'
import type { PwaUpdateStatus } from '../pwa/runtime'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import useUpdateAvailable from '../hooks/useUpdateAvailable'

interface UpdateAvailableBannerProps {
  className?: string
  strings: PublicTranslations['updateBanner']
  currentVersion: string | null
  availableVersion: string | null
  status: PwaUpdateStatus
  loading: boolean
  onUpdate: () => void
  onDismiss: () => void
}

export default function UpdateAvailableBanner({
  className,
  strings,
  currentVersion,
  availableVersion,
  status,
  loading,
  onUpdate,
  onDismiss,
}: UpdateAvailableBannerProps): React.JSX.Element {
  const isActivating = status === 'activating'
  const isFailed = status === 'activation-failed'
  const isPreparing = loading && !isActivating
  const description = isFailed
    ? strings.failureDescription
    : isActivating
    ? strings.activating
    : isPreparing
      ? strings.preparing
      : currentVersion && availableVersion
        ? strings.description(currentVersion, availableVersion)
        : strings.readyFallback

  return (
    <Alert
      className={cn('surface update-banner', isFailed && 'update-banner-failed', className)}
      role="status"
      aria-live="polite"
    >
      {loading
        ? <Loader2 className="update-banner-status update-banner-spinner animate-spin" aria-hidden="true" />
        : isFailed
          ? <AlertTriangle className="update-banner-status text-destructive" aria-hidden="true" />
          : <DownloadCloud className="update-banner-status" aria-hidden="true" />}
      <AlertTitle className="update-banner-text">{isFailed ? strings.failureTitle : strings.title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      <div className="update-banner-actions flex flex-wrap items-center gap-2 pt-1 group-has-[>svg]/alert:col-start-2">
        <Button
          type="button"
          onClick={onUpdate}
          disabled={isActivating}
          aria-busy={loading}
        >
          {loading ? <Loader2 className="update-banner-button-spinner animate-spin" size={16} aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
          {loading ? strings.refreshing : isFailed ? strings.retry : strings.refresh}
        </Button>
        <Button type="button" variant="ghost" onClick={onDismiss} disabled={isActivating}>
          {strings.dismiss}
        </Button>
      </div>
    </Alert>
  )
}

export function ConnectedUpdateAvailableBanner({
  className,
  strings,
}: {
  className?: string
  strings: PublicTranslations['updateBanner']
}): React.JSX.Element | null {
  const updateBanner = useUpdateAvailable()

  if (!updateBanner.visible) {
    return null
  }

  return (
    <UpdateAvailableBanner
      className={className}
      strings={strings}
      currentVersion={updateBanner.currentVersion}
      availableVersion={updateBanner.availableVersion}
      status={updateBanner.status}
      loading={updateBanner.loading}
      onUpdate={updateBanner.applyUpdate}
      onDismiss={updateBanner.dismiss}
    />
  )
}
