import type { ReactNode } from 'react'
import { CircleAlertIcon, HouseIcon, KeyRoundIcon, LoaderCircleIcon, PauseCircleIcon } from 'lucide-react'
import type React from 'react'

import BrandLockup from './BrandLockup'

import type { PublicMetrics } from '../api'
import type { Translations } from '../i18n'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export interface PublicHomeHeroCardProps {
  publicStrings: Translations['public']
  metricsLoading: boolean
  summaryLoading: boolean
  metrics: PublicMetrics | null
  availableKeys: number | null
  totalKeys: number | null
  error: string | null
  showAuthStatusLoading?: boolean
  showAuthStatusUnavailable?: boolean
  showLinuxDoLogin: boolean
  showRegistrationPausedNotice?: boolean
  showTokenAccessButton: boolean
  showAdminAction: boolean
  adminActionLabel: string
  topControls?: ReactNode
  linuxDoHref?: string
  onLinuxDoLogin?: () => void
  onTokenAccessClick?: () => void
  onAdminActionClick?: () => void
}

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

function HeroMetric({
  title,
  value,
  loading,
}: {
  title: string
  value: string
  loading: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border p-4">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {loading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      )}
    </div>
  )
}

function PublicHomeHeroCard({
  publicStrings,
  metricsLoading,
  summaryLoading,
  metrics,
  availableKeys,
  totalKeys,
  error,
  showAuthStatusLoading = false,
  showAuthStatusUnavailable = false,
  showLinuxDoLogin,
  showRegistrationPausedNotice = false,
  showTokenAccessButton,
  showAdminAction,
  adminActionLabel,
  topControls,
  linuxDoHref = '/auth/linuxdo',
  onLinuxDoLogin,
  onTokenAccessClick,
  onAdminActionClick,
}: PublicHomeHeroCardProps): React.JSX.Element {
  const showAuthStatus = showAuthStatusLoading || showAuthStatusUnavailable
  const shouldShowActions = showAuthStatus || showLinuxDoLogin || showTokenAccessButton || showAdminAction
  const authStatusText = showAuthStatusUnavailable
    ? publicStrings.authStatus.unavailable
    : publicStrings.authStatus.checking
  const linuxDoContent = (
    <>
      <img src="/assets/linuxdo-logo.svg" alt={publicStrings.linuxDoLogin.logoAlt} width={16} height={16} />
      {publicStrings.linuxDoLogin.button}
    </>
  )

  return (
    <Card className="gap-0">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <BrandLockup title="Tavily Hikari" variant="responsive" />
          <CardTitle className="pt-2 text-2xl">{publicStrings.heroTitle}</CardTitle>
          <CardDescription>{publicStrings.heroDescription}</CardDescription>
        </div>
        {topControls ? <div className="flex items-center gap-2">{topControls}</div> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {showRegistrationPausedNotice ? (
          <Alert className="border-warning/40 bg-warning/10">
            <PauseCircleIcon className="text-warning" />
            <AlertTitle className="text-warning">{publicStrings.registrationPausedNotice.title}</AlertTitle>
            <AlertDescription className="text-warning">{publicStrings.registrationPausedNotice.description}</AlertDescription>
          </Alert>
        ) : null}

        {showAuthStatus ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
            {showAuthStatusLoading ? (
              <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CircleAlertIcon className="size-4" aria-hidden="true" />
            )}
            {authStatusText}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3" aria-label={publicStrings.metrics.pool.title}>
          <HeroMetric
            title={publicStrings.metrics.monthly.title}
            value={numberFormatter.format(metrics?.monthlySuccess ?? 0)}
            loading={metricsLoading}
          />
          <HeroMetric
            title={publicStrings.metrics.daily.title}
            value={numberFormatter.format(metrics?.dailySuccess ?? 0)}
            loading={metricsLoading}
          />
          <HeroMetric
            title={publicStrings.metrics.pool.title}
            value={
              !summaryLoading && availableKeys != null && totalKeys != null
                ? `${availableKeys}/${totalKeys}`
                : '—'
            }
            loading={summaryLoading}
          />
        </div>

        {shouldShowActions ? (
          <div className="flex flex-wrap items-center gap-2">
            {showAuthStatus ? (
              <Button variant="outline" disabled aria-label={authStatusText}>
                {authStatusText}
              </Button>
            ) : null}
            {showLinuxDoLogin ? (
              onLinuxDoLogin ? (
                <Button onClick={onLinuxDoLogin} aria-label={publicStrings.linuxDoLogin.button}>
                  {linuxDoContent}
                </Button>
              ) : (
                <Button asChild>
                  <a href={linuxDoHref} aria-label={publicStrings.linuxDoLogin.button}>
                    {linuxDoContent}
                  </a>
                </Button>
              )
            ) : null}
            {showTokenAccessButton ? (
              <Button variant="outline" onClick={onTokenAccessClick}>
                <KeyRoundIcon data-icon="inline-start" />
                {publicStrings.tokenAccess.button}
              </Button>
            ) : null}
            {showAdminAction ? (
              <Button onClick={onAdminActionClick}>
                <HouseIcon data-icon="inline-start" />
                {adminActionLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default PublicHomeHeroCard
