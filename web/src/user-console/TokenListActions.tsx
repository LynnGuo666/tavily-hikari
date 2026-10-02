import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TokenSecretCopyState } from '../components/TokenSecretField'
import type { EN } from './text'
import type React from 'react'

type TokenText = typeof EN.tokens

interface TokenListActionsProps {
  tokenId: string
  text: TokenText
  copyState: TokenSecretCopyState
  onScheduleWarmSecret: (tokenId: string) => void
  onCancelWarmSecret: (tokenId: string) => void
  onWarmSecret: (tokenId: string) => void
  onCopy: (tokenId: string, anchorEl: HTMLElement) => void
  onDetail: (tokenId: string) => void
  onReset: (tokenId: string) => void
  isCopyIntentKey: (key: string) => boolean
  canReset: boolean
  className?: string
}

const COPY_STATE_CLASS: Record<TokenSecretCopyState, string> = {
  idle: '',
  copied: 'btn-success border-success/40 bg-success/10 text-success hover:bg-success/20',
  error: 'btn-warning border-warning/40 bg-warning/10 text-warning hover:bg-warning/20',
}

export default function TokenListActions({
  tokenId,
  text,
  copyState,
  onScheduleWarmSecret,
  onCancelWarmSecret,
  onWarmSecret,
  onCopy,
  onDetail,
  onReset,
  isCopyIntentKey,
  canReset,
  className = '',
}: TokenListActionsProps): React.JSX.Element {
  const copyLabel = copyState === 'copied' ? text.copied : copyState === 'error' ? text.copyFailed : text.copy

  return (
    <div className={cn('table-actions flex flex-wrap items-center gap-2', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={COPY_STATE_CLASS[copyState]}
        onPointerEnter={() => onScheduleWarmSecret(tokenId)}
        onPointerLeave={() => onCancelWarmSecret(tokenId)}
        onBlur={() => onCancelWarmSecret(tokenId)}
        onPointerDown={() => onWarmSecret(tokenId)}
        onKeyDown={(event) => {
          if (!isCopyIntentKey(event.key)) return
          onWarmSecret(tokenId)
        }}
        onClick={(event) => onCopy(tokenId, event.currentTarget)}
      >
        {copyLabel}
      </Button>
      <Button type="button" size="sm" onClick={() => onDetail(tokenId)}>
        {text.detail}
      </Button>
      <Button
        type="button"
        size="sm"
        className="btn-warning bg-warning/15 text-warning hover:bg-warning/25"
        onClick={() => onReset(tokenId)}
        disabled={!canReset}
      >
        {text.reset}
      </Button>
    </div>
  )
}
