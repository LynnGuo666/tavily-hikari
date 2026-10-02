import AppFooter from './AppFooter'
import { buildOctoRillReleaseLink, formatVersionDisplay } from '../lib/releaseLinks'

export default function PublicHomeFooter({
  versionLabel,
  version,
}: {
  versionLabel: string
  version: string | null
}): JSX.Element {
  const release = buildOctoRillReleaseLink(version)
  const displayVersion = formatVersionDisplay(version)

  return (
    <AppFooter
      className="public-home-footer"
      githubLabel="GitHub"
      version={<>{versionLabel} {release ? (
        <a className="underline-offset-4 hover:underline" href={release.href} target="_blank" rel="noreferrer">
          <code>{release.label}</code>
        </a>
      ) : <code>{displayVersion ?? '—'}</code>}</>}
    />
  )
}
