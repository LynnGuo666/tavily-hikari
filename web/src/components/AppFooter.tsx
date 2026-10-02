import type { ReactNode } from 'react'
import { GithubIcon } from 'lucide-react'
import type React from 'react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface AppFooterProps {
  title?: ReactNode
  githubLabel: string
  githubAria?: string
  version: ReactNode
  className?: string
}

export default function AppFooter({ title, githubLabel, githubAria, version, className }: AppFooterProps): React.JSX.Element {
  return (
    <footer className={cn('app-footer mt-6 flex flex-col gap-3 text-sm text-muted-foreground', className)}>
      <Separator />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {title ? <span>{title}</span> : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button asChild variant="link" size="sm">
            <a href="https://github.com/IvanLi-CN/tavily-hikari" className="footer-link" target="_blank" rel="noreferrer" aria-label={githubAria}>
              <GithubIcon data-icon="inline-start" />
              {githubLabel}
            </a>
          </Button>
          <span className="footer-meta inline-flex flex-wrap items-center gap-1">{version}</span>
        </div>
      </div>
    </footer>
  )
}
