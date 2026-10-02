import type { ReactNode } from 'react'
import type React from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup } from '@/components/ui/select'
import type { UserTokenSummary } from '../api'
import type { EN } from './text'

interface SetupGuidePageProps {
  text: typeof EN.setup
  tokens: UserTokenSummary[]
  selectedTokenId: string | null
  onTokenChange: (tokenId: string) => void
  guide: ReactNode
}

function maskedTokenLabel(tokenId: string): string {
  return `th-${tokenId}-************************`
}

export default function SetupGuidePage({
  text,
  tokens,
  selectedTokenId,
  onTokenChange,
  guide,
}: SetupGuidePageProps): React.JSX.Element {
  return (
    <Card className="surface panel user-console-setup-page gap-0 overflow-visible py-0">
      <CardHeader className="panel-header border-b user-console-setup-header flex-row flex-wrap items-start justify-between gap-3 border-b p-5">
        <div className="user-console-setup-heading min-w-0">
          <CardTitle className="text-base font-semibold" role="heading" aria-level={2}>{text.title}</CardTitle>
          <CardDescription className="panel-description text-sm text-muted-foreground mt-1 text-sm">{text.description}</CardDescription>
        </div>
        {selectedTokenId ? (
          <div className="user-console-setup-token-select flex items-center gap-2">
            <Badge variant="outline" className="max-w-40 shrink-0 truncate font-mono text-xs font-normal">
              {text.tokenLabel}
            </Badge>
            <Select value={selectedTokenId} onValueChange={onTokenChange}>
              <SelectTrigger aria-label={text.tokenSelectAria} className="w-56">
                <SelectValue>{maskedTokenLabel(selectedTokenId)}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {tokens.filter((token) => token.enabled).map((token) => (
                    <SelectItem key={token.tokenId} value={token.tokenId}>
                      {maskedTokenLabel(token.tokenId)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {selectedTokenId ? guide : (
          <div className="empty-state px-4 py-8 text-center text-sm text-muted-foreground user-console-setup-empty flex flex-col items-center gap-2 p-10 text-center">
            <strong className="text-sm font-semibold">{text.emptyTitle}</strong>
            <span className="text-sm text-muted-foreground">{text.emptyDescription}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
