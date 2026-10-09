import { useRef } from 'react'

type AutoFocusHandler = (event: Event) => void

// Controlled overlays can be opened without a Radix Trigger. Preserve that
// opener as well, while allowing callers to override autofocus deliberately.
export function useOverlayFocusReturn(
  onOpenAutoFocus?: AutoFocusHandler,
  onCloseAutoFocus?: AutoFocusHandler,
) {
  const opener = useRef<HTMLElement | null>(null)

  return {
    onOpenAutoFocus(event: Event) {
      const active = document.activeElement
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null
      onOpenAutoFocus?.(event)
    },
    onCloseAutoFocus(event: Event) {
      onCloseAutoFocus?.(event)
      if (!event.defaultPrevented && opener.current?.isConnected) {
        event.preventDefault()
        opener.current.focus({ preventScroll: true })
      }
      opener.current = null
    },
  }
}
