import '../../test/happydom'

import { afterEach, describe, expect, it } from 'bun:test'
import { act, createRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { Button } from './ui/button'
import { Progress } from './ui/progress'
import { Checkbox } from './ui/checkbox'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import SegmentedTabs from './SegmentedTabs'
import SearchableFacetSelect from './SearchableFacetSelect'

let root: Root | null = null

afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  root = null
  document.body.innerHTML = ''
})

function mount(element: JSX.Element) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root?.render(element))
  return container
}

describe('shadcn composition on React 18', () => {
  it('reports actual progress rather than an indeterminate state', () => {
    const container = mount(<Progress value={60} aria-label="Coverage" />)
    const meter = container.querySelector('[role=progressbar]')!
    expect(meter.getAttribute('aria-valuenow')).toBe('60')
    expect(meter.getAttribute('aria-valuemax')).toBe('100')
  })

  it('connects the searchable trigger and input to their popups and selects once', async () => {
    const changes: Array<string | null> = []
    const container = mount(<SearchableFacetSelect value={null} options={[{ value: 'Hk01' }]}
      summary="All" allLabel="All" emptyLabel="No keys" searchPlaceholder="Search keys"
      searchAriaLabel="Search keys" triggerAriaLabel="Key: All" listAriaLabel="Keys"
      onChange={(next) => changes.push(next)} />)
    const trigger = container.querySelector<HTMLButtonElement>('button')!
    await act(async () => trigger.click())
    const popup = document.getElementById(trigger.getAttribute('aria-controls')!)!
    expect(popup.getAttribute('role')).toBe('dialog')
    const input = popup.querySelector<HTMLInputElement>('input')!
    const list = document.getElementById(input.getAttribute('aria-controls')!)!
    expect(list.getAttribute('role')).toBe('listbox')
    expect(list.getAttribute('aria-label')).toBe('Keys')
    const option = popup.querySelector<HTMLElement>('[cmdk-item][data-value="Hk01"]')!
    await act(async () => option.click())
    expect(changes).toEqual(['Hk01'])
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('forwards form refs so callers can focus and select the actual control', () => {
    const inputRef = createRef<HTMLInputElement>()
    const textareaRef = createRef<HTMLTextAreaElement>()
    mount(<><Input ref={inputRef} defaultValue="search" /><Textarea ref={textareaRef} defaultValue="note" /></>)

    expect(inputRef.current).toBeInstanceOf(HTMLInputElement)
    inputRef.current?.focus()
    inputRef.current?.select()
    expect(document.activeElement).toBe(inputRef.current)
    expect(inputRef.current?.selectionEnd).toBe(6)
    textareaRef.current?.focus()
    expect(document.activeElement).toBe(textareaRef.current)
  })

  it('preserves the DOM ref through Button asChild without nesting interactive elements', () => {
    const ref = createRef<HTMLButtonElement>()
    const container = mount(<Button ref={ref} asChild variant="outline"><a href="#detail">Open detail</a></Button>)
    const link = container.querySelector('a')
    expect(ref.current as unknown).toBe(link)
    expect(container.querySelector('button')).toBeNull()
    ref.current?.focus()
    expect(document.activeElement).toBe(link)
  })

  it('exposes a mixed checkbox and resolves its next action to selecting the page', async () => {
    const changes: Array<boolean | 'indeterminate'> = []
    function Selection() {
      const [checked, setChecked] = useState<boolean | 'indeterminate'>('indeterminate')
      return <Checkbox checked={checked} aria-label="Select page" onCheckedChange={(next) => { changes.push(next); setChecked(next) }} />
    }
    const container = mount(<Selection />)
    const checkbox = container.querySelector<HTMLButtonElement>('[role=checkbox]')!
    expect(checkbox.getAttribute('aria-checked')).toBe('mixed')
    await act(async () => checkbox.click())
    expect(changes).toEqual([true])
    expect(checkbox.getAttribute('aria-checked')).toBe('true')
    await act(async () => checkbox.click())
    expect(changes).toEqual([true, false])
  })

  it('changes a segmented selection once and keeps one option selected', async () => {
    const changes: string[] = []
    function Selection() {
      const [value, setValue] = useState('day')
      return <SegmentedTabs collapseMode="never" value={value} onChange={(next) => { changes.push(next); setValue(next) }} ariaLabel="Window" options={[{ value: 'day', label: 'Day' }, { value: 'month', label: 'Month' }]} />
    }
    const container = mount(<Selection />)
    const month = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Month')!
    await act(async () => month.click())
    expect(changes).toEqual(['month'])
    expect(month.getAttribute('aria-checked')).toBe('true')
    await act(async () => month.click())
    expect(changes).toEqual(['month'])
    expect(month.getAttribute('aria-checked')).toBe('true')
  })
})
