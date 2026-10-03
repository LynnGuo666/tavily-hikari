import { GithubIcon } from 'lucide-react'
import type React from 'react'

import type { VersionInfo } from '../api'
import { buildOctoRillReleaseLink, formatVersionDisplay } from '../lib/releaseLinks'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export interface UserConsoleFooterStrings {
  title: string
  githubAria: string
  githubLabel: string
  loadingVersion: string
  errorVersion: string
  tagPrefix: string
}

export function buildUserConsoleFooterRelease(version: VersionInfo | null): {
  href: string
  label: string
} | null {
  return buildOctoRillReleaseLink(version?.backend)
}

export default function UserConsoleFooter({
  strings,
  versionState,
}: {
  strings: UserConsoleFooterStrings
  versionState:
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; value: VersionInfo | null }
}): React.JSX.Element {
  const release = versionState.status === 'ready'
    ? buildUserConsoleFooterRelease(versionState.value)
    : null
  const versionLabel = versionState.status === 'ready'
    ? formatVersionDisplay(versionState.value?.backend)
    : null

  return (
    <footer className="mt-6 flex flex-col gap-3 text-sm text-muted-foreground">
      <Separator />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>{strings.title}</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button asChild variant="link" size="sm">
            <a href="https://github.com/IvanLi-CN/tavily-hikari" target="_blank" rel="noreferrer" aria-label={strings.githubAria}>
              <GithubIcon data-icon="inline-start" />
              {strings.githubLabel}
            </a>
          </Button>
          <span className="inline-flex flex-wrap items-center gap-1">
            {release ? (
              <>
                {strings.tagPrefix}
                <a href={release.href} target="_blank" rel="noreferrer">
                  {release.label}
                </a>
              </>
            ) : versionLabel ? (
              <>
                {strings.tagPrefix}
                <span>{versionLabel}</span>
              </>
            ) : versionState.status === 'error' ? (
              strings.errorVersion
            ) : (
              strings.loadingVersion
            )}
          </span>
        </div>
      </div>
    </footer>
  )
}
