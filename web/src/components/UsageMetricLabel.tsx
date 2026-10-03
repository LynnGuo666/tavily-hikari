import { AnchoredInfoDisclosure } from "@/components/anchored-info-disclosure"
import { cn } from '../lib/utils'
import type React from 'react'

export type UsageMetricHelpKind = 'businessCalls1h' | 'dailyCredits' | 'monthlyCredits'

function usageMetricHelpText(kind: UsageMetricHelpKind, language: 'en' | 'zh'): string {
  if (language === 'zh') {
    switch (kind) {
      case 'businessCalls1h':
        return '滚动 1 小时内实际打到上游的业务请求次数。成功和失败都会计入；在本地提前拦截的请求不计入。'
      case 'dailyCredits':
        return '当前自然日内累计消耗的业务积分。'
      case 'monthlyCredits':
        return '当前自然月内累计消耗的业务积分。'
    }
  }

  switch (kind) {
    case 'businessCalls1h':
      return 'Rolling 1-hour count of business requests that actually reached the upstream. Both successes and failures count. Requests blocked locally do not count.'
    case 'dailyCredits':
      return 'Business credits consumed in the current calendar day.'
    case 'monthlyCredits':
      return 'Business credits consumed in the current calendar month.'
  }
}

export function UsageMetricLabel({
  label,
  kind,
  language,
  className,
}: {
  label: string
  kind: UsageMetricHelpKind
  language: 'en' | 'zh'
  className?: string
}): React.JSX.Element {
  if (typeof document === 'undefined') {
    return <span className={cn(className)}>{label}</span>
  }

  return (
    <AnchoredInfoDisclosure
      className={cn(className, 'inline-flex items-center gap-1.5 p-0 border-0 [background:none] text-inherit [font:inherit] cursor-help underline decoration-dotted underline-offset-3')}
      bubbleClassName="max-w-[min(18rem,calc(100vw-2rem))]"
      bubbleContent={<p className="m-0">{usageMetricHelpText(kind, language)}</p>}
      aria-label={label}
    >
      <span>{label}</span>
    </AnchoredInfoDisclosure>
  )
}
