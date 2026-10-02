import type { ReactNode } from 'react'
import type React from 'react'

import { cn } from '../lib/utils'

import { FieldSet, FieldLegend } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

interface DateTimeRangeFieldProps {
  label: ReactNode
  inputType?: 'date' | 'month'
  hideLabel?: boolean
  startId: string
  endId: string
  startLabel: ReactNode
  endLabel: ReactNode
  startValue: string
  endValue: string
  startSeparator: ReactNode
  startMax?: string
  endMin?: string
  disabled?: boolean
  className?: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
}

export default function DateTimeRangeField({
  label,
  inputType = 'date',
  hideLabel = false,
  startId,
  endId,
  startLabel,
  endLabel,
  startValue,
  endValue,
  startSeparator,
  startMax,
  endMin,
  disabled = false,
  className,
  onStartChange,
  onEndChange,
}: DateTimeRangeFieldProps): React.JSX.Element {
  return (
    <FieldSet className={cn('date-time-range-field min-w-0 gap-2', className)}>
      <FieldLegend variant="label" className={cn('date-time-range-field__label mb-0', hideLabel && 'sr-only')}>{label}</FieldLegend>

      <div className="date-time-range-field__control grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div className="min-w-0 date-time-range-field__segment date-time-range-field__segment--start">
          <label className="sr-only" htmlFor={startId}>
            {startLabel}
          </label>
          <Input
            id={startId}
            type={inputType}
            value={startValue}
            onChange={(event) => onStartChange(event.target.value)}
            max={startMax || undefined}
            disabled={disabled}
            className="date-time-range-field__input min-w-0"
          />
        </div>

        <div className="date-time-range-field__separator text-muted-foreground" aria-hidden="true">
          {startSeparator}
        </div>

        <div className="min-w-0 date-time-range-field__segment date-time-range-field__segment--end">
          <label className="sr-only" htmlFor={endId}>
            {endLabel}
          </label>
          <Input
            id={endId}
            type={inputType}
            value={endValue}
            onChange={(event) => onEndChange(event.target.value)}
            min={endMin || undefined}
            disabled={disabled}
            className="date-time-range-field__input min-w-0"
          />
        </div>
      </div>
    </FieldSet>
  )
}
