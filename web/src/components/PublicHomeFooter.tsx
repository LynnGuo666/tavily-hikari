import { GithubIcon } from 'lucide-react'
import type React from 'react'

import { buildOctoRillReleaseLink, formatVersionDisplay } from '../lib/releaseLinks'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export default function PublicHomeFooter({
  versionLabel,
  version,
}: {
  versionLabel: string
  version: string | null
}): React.JSX.Element {
  const release = buildOctoRillReleaseLink(version)
  const displayVersion = formatVersionDisplay(version)

  return (
    <footer className="mt-6 flex flex-col gap-3 text-sm text-muted-foreground">
      <Separator />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button asChild variant="link" size="sm">
            <a href="https://github.com/IvanLi-CN/tavily-hikari" target="_blank" rel="noreferrer">
              <GithubIcon data-icon="inline-start" />
              GitHub
            </a>
          </Button>
          <span className="inline-flex flex-wrap items-center gap-1">
            {versionLabel} {release ? (
              <a className="underline-offset-4 hover:underline" href={release.href} target="_blank" rel="noreferrer">
                <code>{release.label}</code>
              </a>
            ) : <code>{displayVersion ?? '—'}</code>}
          </span>
        </div>
      </div>
    </footer>
  )
}
