import { type ReactNode, useId, useMemo, useState } from 'react'

import { Icon } from '../lib/icons'
import { cn } from '../lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandSeparator } from '@/components/ui/command'

export interface SearchableFacetSelectOption {
  value: string
  label?: string
  count?: number
}

export interface SearchableFacetSelectProps {
  value: string | null
  options: SearchableFacetSelectOption[]
  summary: string
  allLabel: string
  emptyLabel: string
  searchPlaceholder: string
  searchAriaLabel: string
  triggerAriaLabel: string
  listAriaLabel: string
  onChange: (nextValue: string | null) => void
  disabled?: boolean
  align?: 'start' | 'center' | 'end'
  triggerClassName?: string
  triggerId?: string
  contentClassName?: string
  labelVariant?: 'default' | 'mono'
  renderOptionLabel?: (option: SearchableFacetSelectOption) => ReactNode
}

export default function SearchableFacetSelect({
  value,
  options,
  summary,
  allLabel,
  emptyLabel,
  searchPlaceholder,
  searchAriaLabel,
  triggerAriaLabel,
  listAriaLabel,
  onChange,
  disabled = false,
  align = 'end',
  triggerClassName,
  triggerId,
  contentClassName,
  labelVariant = 'default',
  renderOptionLabel,
}: SearchableFacetSelectProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const popupId = useId()

  const normalizedQuery = query.trim().toLowerCase()
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options
    return options.filter((option) => {
      const haystacks = [option.value, option.label ?? '']
      return haystacks.some((candidate) => candidate.toLowerCase().includes(normalizedQuery))
    })
  }, [normalizedQuery, options])

  const renderLabel = (option: SearchableFacetSelectOption): ReactNode => {
    if (renderOptionLabel) return renderOptionLabel(option)
    const label = option.label ?? option.value
    return (
      <span
        className={cn(
          'searchable-facet-select__label',
          labelVariant === 'mono' && 'searchable-facet-select__label--mono font-mono',
        )}
      >
        {label}
      </span>
    )
  }

  const selectValue = (nextValue: string | null) => {
    onChange(nextValue)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setQuery('') }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          id={triggerId}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? popupId : undefined}
          className={cn('searchable-facet-select__trigger min-w-40 justify-between', triggerClassName)}
          aria-label={triggerAriaLabel}
          disabled={disabled}
        >
          <span className="searchable-facet-select__summary truncate">{summary}</span>
          <Icon icon="mdi:chevron-down" data-icon="inline-end" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent id={popupId} aria-label={listAriaLabel} align={align} className={cn('searchable-facet-select__content w-[max(16rem,var(--radix-popover-trigger-width))] max-w-[calc(100vw-2rem)] p-0', contentClassName)}>
        <Command shouldFilter={false} label={listAriaLabel}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder} aria-label={searchAriaLabel} />
          <CommandList label={listAriaLabel}>
            <CommandGroup>
              <CommandItem value="__all__" data-checked={!value} onSelect={() => selectValue(null)}>
                {allLabel}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            {filteredOptions.length === 0 ? (
              <div role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</div>
            ) : (
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem key={option.value} value={option.value} data-checked={value === option.value} onSelect={() => selectValue(option.value)}>
                    <span className="searchable-facet-select__option-body flex min-w-0 flex-1 items-center justify-between gap-2">
                      {renderLabel(option)}
                      {typeof option.count === 'number' ? <span className="searchable-facet-select__count text-xs text-muted-foreground">{`x${option.count}`}</span> : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
