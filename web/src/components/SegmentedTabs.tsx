import * as React from 'react'

import { useViewportMode } from '@/lib/responsive'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export interface SegmentedTabsOption<T extends string = string> {
  value: T
  label: React.ReactNode
  disabled?: boolean
}

interface SegmentedTabsProps<T extends string = string> {
  value: T
  onChange: (value: T) => void
  options: ReadonlyArray<SegmentedTabsOption<T>>
  ariaLabel: string
  className?: string
  disabled?: boolean
  smallViewportBehavior?: 'select' | 'buttons'
  collapseMode?: 'auto' | 'never'
}

function labelToPlainText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map((item) => labelToPlainText(item)).join('').trim()
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return labelToPlainText(node.props.children).trim()
  }
  return ''
}

export default function SegmentedTabs<T extends string = string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  disabled = false,
  collapseMode = 'auto',
  smallViewportBehavior,
}: SegmentedTabsProps<T>): JSX.Element {
  const viewportMode = useViewportMode()
  const effectiveSmallViewportBehavior =
    smallViewportBehavior ?? (collapseMode === 'never' ? 'buttons' : 'select')

  if (viewportMode === 'small' && effectiveSmallViewportBehavior === 'select') {
    const selectedOption = options.find((option) => option.value === value)
    const selectedLabel = selectedOption ? labelToPlainText(selectedOption.label) : ''

    return (
      <div className={cn('segmented-tabs segmented-tabs-mobile w-full', className)}>
        <Select value={value} onValueChange={(next) => onChange(next as T)} disabled={disabled}>
          <SelectTrigger aria-label={ariaLabel} className="w-full" disabled={disabled}>
            <SelectValue>{selectedLabel || value}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value} disabled={disabled || option.disabled}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as T)}
      className={cn('segmented-tabs', className)}
    >
      <TabsList aria-label={ariaLabel} className="h-auto flex-wrap">
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            disabled={disabled || option.disabled}
            onClick={() => {
              if (!disabled && !option.disabled && option.value !== value) {
                onChange(option.value)
              }
            }}
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
