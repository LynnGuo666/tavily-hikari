import type { CSSProperties, ReactNode } from 'react'
import type React from 'react'

import { Input } from '@/components/ui/input'

interface QuotaRangeFieldProps {
  label: ReactNode
  sliderName: string
  sliderMin: number
  sliderMax: number
  sliderValue: number
  sliderAriaLabel: string
  helperText: ReactNode
  sliderStyle?: CSSProperties
  onSliderChange: (value: number) => void
  inputName: string
  inputValue: string
  inputAriaLabel: string
  disabled?: boolean
  onInputChange: (value: string) => void
}

export default function QuotaRangeField({
  label,
  sliderName,
  sliderMin,
  sliderMax,
  sliderValue,
  sliderAriaLabel,
  helperText,
  sliderStyle,
  onSliderChange,
  inputName,
  inputValue,
  inputAriaLabel,
  disabled = false,
  onInputChange,
}: QuotaRangeFieldProps): React.JSX.Element {
  return (
    <label>
      <span>{label}</span>
      <div>
        <div>
          <input
            type="range"
            name={sliderName}
            min={sliderMin}
            max={sliderMax}
            step="any"
            value={sliderValue}
            onChange={(event) => onSliderChange(Number.parseFloat(event.target.value))}
            style={sliderStyle}
            aria-label={sliderAriaLabel}
            disabled={disabled}
          />
          <span className="text-sm text-muted-foreground">{helperText}</span>
        </div>
        <Input
          type="text"
          name={inputName}
          inputMode="numeric"
          autoComplete="off"
          size={10}
          className="shrink-0"
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          aria-label={inputAriaLabel}
          disabled={disabled}
        />
      </div>
    </label>
  )
}
