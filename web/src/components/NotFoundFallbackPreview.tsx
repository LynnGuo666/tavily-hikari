import BrandLockup from './BrandLockup'
import type React from 'react'

interface NotFoundFallbackPreviewProps {
  originalPath?: string
  returnHref?: string
}

export default function NotFoundFallbackPreview({
  originalPath = '/accounts',
  returnHref = '/',
}: NotFoundFallbackPreviewProps): React.JSX.Element {
  return (
    <div className="not-found-page-body">
      <main role="main">
        <BrandLockup
          title="Tavily Hikari Proxy"
          variant="responsive"
          markClassName="not-found-brand-mark"
        />
        <p>404</p>
        <h1>Page not found</h1>
        <p>
          The page you’re trying to visit, <code>{originalPath}</code>, isn’t available right now.
        </p>
        <div>
          <a href={returnHref} aria-label="Back to dashboard">
            Return to dashboard
          </a>
        </div>
        <p>Error reference: 404</p>
      </main>
    </div>
  )
}
