import '../../test/happydom'

import { afterEach, describe, expect, it } from 'bun:test'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type React from 'react'

import { Dialog, DialogContent, DialogTitle } from './ui/dialog'
import { Sheet, SheetContent, SheetTitle } from './ui/sheet'
import { Drawer, DrawerContent, DrawerTitle } from './ui/drawer'
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from './ui/alert-dialog'

let root: Root | null = null

afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  root = null
  document.body.innerHTML = ''
})

const overlays = [
  { name: 'dialog', Root: Dialog, Content: DialogContent, Title: DialogTitle },
  { name: 'sheet', Root: Sheet, Content: SheetContent, Title: SheetTitle },
  { name: 'drawer', Root: Drawer, Content: DrawerContent, Title: DrawerTitle },
  { name: 'alert', Root: AlertDialog, Content: AlertDialogContent, Title: AlertDialogTitle },
]

async function flush(delay = 30) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, delay))
  })
}

describe('controlled overlay keyboard focus', () => {
  for (const overlay of overlays) {
    it(`returns focus to the ordinary button that opened a ${overlay.name}`, async () => {
      function Example(): React.JSX.Element {
        const [open, setOpen] = useState(false)
        return <>
          <button id="opener" onClick={() => setOpen(true)}>Open</button>
          <overlay.Root open={open} onOpenChange={setOpen}>
            <overlay.Content aria-describedby={undefined}>
              <overlay.Title>Review</overlay.Title>
              <button id="dismiss" onClick={() => setOpen(false)}>Cancel</button>
            </overlay.Content>
          </overlay.Root>
        </>
      }
      const container = document.createElement('div')
      document.body.appendChild(container)
      root = createRoot(container)
      await act(async () => root?.render(<Example />))
      const opener = document.getElementById('opener') as HTMLButtonElement
      opener.focus()
      await act(async () => opener.click())
      await flush()
      const dismiss = document.getElementById('dismiss') as HTMLButtonElement
      dismiss.focus()
      const content = dismiss.closest('[role=dialog],[role=alertdialog]') as HTMLElement
      await act(async () => dismiss.click())
      // Happy DOM does not run Vaul's CSS exit animation. Complete its real
      // animation lifecycle so Radix can unmount the focus scope.
      if (overlay.name === 'drawer') {
        await act(async () => content.dispatchEvent(new AnimationEvent('animationend', {
          animationName: getComputedStyle(content).animationName, bubbles: true,
        })))
      }
      await flush()
      expect(document.activeElement?.id).toBe(opener.id)
    })
  }
})
