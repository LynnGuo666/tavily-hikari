import AppFooter from './AppFooter'
import { buildOctoRillReleaseLink, formatVersionDisplay } from '../lib/releaseLinks'
import type React from 'react'

import type { VersionInfo } from '../api'

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
    <AppFooter
      className="user-console-footer"
      title={strings.title}
      githubLabel={strings.githubLabel}
      githubAria={strings.githubAria}
      version={
        <>
        {release ? (
          <>
            {strings.tagPrefix}
            <a href={release.href} className="footer-link" target="_blank" rel="noreferrer">
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
        </>
      }
    />
  )
}
