import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select'
import type React from 'react'

export type UserTagBindingOption = {
  id: string
  displayName: string
}

type UserTagBindingControlsProps = {
  bindableTags: UserTagBindingOption[]
  buttonLabel: string
  buttonBusyLabel?: string
  disabled?: boolean
  emptyLabel: string
  onBind: () => void
  onSelectedTagIdChange: (value: string) => void
  placeholder: string
  selectedTagId: string
}

export function UserTagBindingControls({
  bindableTags,
  buttonBusyLabel,
  buttonLabel,
  disabled,
  emptyLabel,
  onBind,
  onSelectedTagIdChange,
  placeholder,
  selectedTagId,
}: UserTagBindingControlsProps): React.JSX.Element {
  const isBusy = disabled ?? false

  return (
    <div className="user-tag-bind-controls">
      <Select value={selectedTagId} onValueChange={onSelectedTagIdChange} disabled={isBusy}>
        <SelectTrigger aria-label={placeholder}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectGroup>
            {bindableTags.length === 0 ? (
              <SelectItem value="__no_bindable_user_tags__" disabled>
                {emptyLabel}
              </SelectItem>
            ) : (
              bindableTags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.displayName}
                </SelectItem>
              ))
            )}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="default" size="sm"
        onClick={() => void onBind()}
        disabled={isBusy || !selectedTagId}
      >
        {isBusy ? buttonBusyLabel ?? buttonLabel : buttonLabel}
      </Button>
    </div>
  )
}
