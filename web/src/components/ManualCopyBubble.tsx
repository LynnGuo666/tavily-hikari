import { type FocusEvent, type MouseEvent, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type React from 'react'

import { selectAllReadonlyText } from '../lib/clipboard'
import { useAnchoredFloatingLayer } from '../lib/useAnchoredFloatingLayer'
import { cn } from '../lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export interface ManualCopyBubbleProps {
  open: boolean
  anchorEl: HTMLElement | null
  title: string
  description: string
  fieldLabel: string
  value: string
  closeLabel: string
  multiline?: boolean
  className?: string
  onClose: () => void
}

const VIEWPORT_MARGIN = 12
const ANCHOR_GAP = 10
const ARROW_MARGIN = 18

export default function ManualCopyBubble({
  open,
  anchorEl,
  title,
  description,
  fieldLabel,
  value,
  closeLabel,
  multiline = false,
  className,
  onClose,
}: ManualCopyBubbleProps): React.JSX.Element | null {
  const fieldId = useId()
  const titleId = useId()
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const { layerRef: bubbleRef, position } = useAnchoredFloatingLayer<HTMLDivElement>({
    open,
    anchorEl,
    placement: 'bottom',
    align: 'center',
    offset: ANCHOR_GAP,
    viewportMargin: VIEWPORT_MARGIN,
    arrowPadding: ARROW_MARGIN,
  })

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const bubble = bubbleRef.current
      const target = event.target as Node | null
      if (!target) return
      if (bubble?.contains(target)) return
      if (anchorEl?.contains(target)) return
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [anchorEl, onClose, open])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      selectAllReadonlyText(fieldRef.current)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, value])

  if (!open || !anchorEl || typeof document === 'undefined') {
    return null
  }

  const fieldProps = {
    readOnly: true,
    spellCheck: false,
    value,
    onClick: (event: MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      selectAllReadonlyText(event.currentTarget)
    },
    onFocus: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      selectAllReadonlyText(event.currentTarget)
    },
    id: fieldId,
    'aria-label': fieldLabel,
    className: 'manual-copy-bubble-field font-mono text-xs',
  }

  return createPortal(
    <div
      ref={bubbleRef}
      className={cn('manual-copy-bubble fixed z-[1100] flex max-h-[calc(100dvh-2rem)] w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto overscroll-contain rounded-xl border bg-popover p-4 text-sm text-popover-foreground shadow-md', className)}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      style={{
        top: `${position?.top ?? 0}px`,
        left: `${position?.left ?? 0}px`,
        visibility: position ? 'visible' : 'hidden',
        pointerEvents: position ? 'auto' : 'none',
        ['--manual-copy-arrow-left' as string]: `${position?.arrowOffset ?? 40}px`,
      }}
      data-placement={position?.placement ?? 'bottom'}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <strong id={titleId} className="font-medium">{title}</strong>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label={closeLabel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <label htmlFor={fieldId} className="text-sm font-medium">{fieldLabel}</label>
      {multiline ? (
        <Textarea
          {...fieldProps}
          ref={(node) => {
            fieldRef.current = node
          }}
          rows={4}
        />
      ) : (
        <Input
          {...fieldProps}
          ref={(node) => {
            fieldRef.current = node
          }}
          type="text"
        />
      )}
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
    </div>,
    document.body,
  )
}
