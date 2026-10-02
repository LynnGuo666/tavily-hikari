import * as React from 'react'

import { useViewportMode } from '@/lib/responsive'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

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
            <SelectGroup>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={disabled || option.disabled}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => { if (next) onChange(next as T) }}
      variant="outline"
      spacing={0}
      aria-label={ariaLabel}
      className={cn('segmented-tabs flex-wrap', className)}
    >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            disabled={disabled || option.disabled}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
    </ToggleGroup>
  )
}
