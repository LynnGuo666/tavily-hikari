import type { InputHTMLAttributes, KeyboardEvent as ReactKeyboardEvent, Ref } from 'react'
import { CheckIcon, CircleAlertIcon, CopyIcon, EyeIcon, EyeOffIcon } from 'lucide-react'
import type React from 'react'

import { isCopyIntentKey } from '../lib/clipboard'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'

export type TokenSecretCopyState = 'idle' | 'copied' | 'error'

interface TokenSecretFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'onCopy'> {
  inputId: string
  label: string
  value: string
  visible: boolean
  hiddenDisplayValue?: string
  visibilityBusy?: boolean
  copyState: TokenSecretCopyState
  onValueChange: (value: string) => void
  onToggleVisibility: () => void
  onCopy: (anchorEl: HTMLButtonElement) => void | Promise<void>
  onCopyIntent?: () => void | Promise<void>
  onCopyIntentCancel?: () => void
  visibilityShowLabel: string
  visibilityHideLabel: string
  visibilityIconAlt: string
  copyAriaLabel: string
  copyLabel: string
  copiedLabel: string
  copyErrorLabel: string
  wrapperClassName?: string
  rowClassName?: string
  shellClassName?: string
  inputClassName?: string
  copyButtonClassName?: string
  copyDisabled?: boolean
  inputRef?: Ref<HTMLInputElement>
}

export default function TokenSecretField({
  inputId,
  label,
  value,
  visible,
  hiddenDisplayValue,
  visibilityBusy = false,
  copyState,
  onValueChange,
  onToggleVisibility,
  onCopy,
  onCopyIntent,
  onCopyIntentCancel,
  visibilityShowLabel,
  visibilityHideLabel,
  visibilityIconAlt,
  copyAriaLabel,
  copyLabel,
  copiedLabel,
  copyErrorLabel,
  wrapperClassName,
  rowClassName,
  inputClassName,
  copyButtonClassName,
  copyDisabled = false,
  inputRef,
  className,
  onBlur,
  ...inputProps
}: TokenSecretFieldProps): React.JSX.Element {
  const displayValue = !visible && hiddenDisplayValue != null ? hiddenDisplayValue : value
  const copied = copyState === 'copied'
  const failed = copyState === 'error'
  const shouldMaskValue = !visible && hiddenDisplayValue == null
  const copyText = copied ? copiedLabel : failed ? copyErrorLabel : copyLabel

  const handleCopyIntentKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!isCopyIntentKey(event.key)) return
    void onCopyIntent?.()
  }

  return (
    <div className={cn('flex w-full flex-col gap-2', wrapperClassName)}>
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className={cn('flex flex-wrap items-center gap-2', rowClassName)}>
        <InputGroup className={cn(shouldMaskValue && 'font-mono tracking-widest')}>
          <InputGroupInput
            {...inputProps}
            id={inputId}
            ref={inputRef}
            className={inputClassName}
            type="text"
            value={shouldMaskValue ? '•'.repeat(Math.min(value.length, 32)) : displayValue}
            onChange={(event) => onValueChange(event.target.value)}
            onBlur={onBlur}
            aria-label={inputProps['aria-label'] ?? label}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              size="icon-sm"
              onClick={onToggleVisibility}
              aria-label={visible ? visibilityHideLabel : visibilityShowLabel}
              aria-busy={visibilityBusy ? 'true' : undefined}
              disabled={visibilityBusy}
            >
              {visibilityBusy ? (
                <Spinner className="size-3.5" />
              ) : visible ? (
                <EyeOffIcon aria-hidden="true" />
              ) : (
                <EyeIcon aria-hidden="true" />
              )}
              <span className="sr-only">{visibilityIconAlt}</span>
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <Button
          type="button"
          variant={copied ? 'default' : failed ? 'destructive' : 'outline'}
          className={cn(copyButtonClassName)}
          onPointerEnter={() => void onCopyIntent?.()}
          onPointerLeave={() => onCopyIntentCancel?.()}
          onBlur={() => onCopyIntentCancel?.()}
          onPointerDown={() => void onCopyIntent?.()}
          onKeyDown={handleCopyIntentKeyDown}
          onClick={(event) => void onCopy(event.currentTarget)}
          aria-label={copyAriaLabel}
          disabled={copyDisabled}
        >
          {copied ? <CheckIcon data-icon="inline-start" /> : null}
          {failed ? <CircleAlertIcon data-icon="inline-start" /> : null}
          {!copied && !failed ? <CopyIcon data-icon="inline-start" /> : null}
          {copyText}
        </Button>
      </div>
    </div>
  )
}
