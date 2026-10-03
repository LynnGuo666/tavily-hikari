import type { EN } from './text'
import type React from 'react'

type TokenText = typeof EN.tokens

interface TokenListSummaryProps {
  text: TokenText
  total: number
  enabled: number
  dailySuccess: number
  formatNumber: (value: number) => string
}

export default function TokenListSummary({
  text,
  total,
  enabled,
  dailySuccess,
  formatNumber,
}: TokenListSummaryProps): React.JSX.Element {
  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
      aria-label={text.title}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-muted-foreground">{text.summary.total}</span>
        <strong className="font-semibold tabular-nums">{formatNumber(total)}</strong>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-muted-foreground">{text.summary.enabled}</span>
        <strong className="font-semibold tabular-nums">{formatNumber(enabled)}</strong>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-muted-foreground">{text.summary.dailySuccess}</span>
        <strong className="font-semibold tabular-nums">{formatNumber(dailySuccess)}</strong>
      </div>
    </div>
  )
}
