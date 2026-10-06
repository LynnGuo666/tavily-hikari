import { useTranslate } from '../i18n'
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
  const t = useTranslate()
  const returnLabel = returnHref === '/admin' ? t.notFound.returnConsole : t.notFound.returnHome

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 text-foreground">
      <main
        role="main"
        className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm"
      >
        <BrandLockup title="Tavily Hikari Proxy" variant="responsive" className="justify-center" />
        <p className="mt-6 font-mono text-4xl font-semibold tracking-tight text-muted-foreground">
          {t.notFound.code}
        </p>
        <h1 className="mt-2 text-xl font-semibold">{t.notFound.title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t.notFound.description(originalPath)}</p>
        <a
          href={returnHref}
          className="mt-6 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {returnLabel}
        </a>
        <p className="mt-6 font-mono text-xs text-muted-foreground">
          {t.notFound.errorReference}: {t.notFound.code}
        </p>
      </main>
    </div>
  )
}
