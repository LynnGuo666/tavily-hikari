import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register({
  url: 'http://localhost/',
})

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const DEFAULT_CLIENT_WIDTH = 1280
const DEFAULT_CLIENT_HEIGHT = 720

function parsePx(raw: string): number | null {
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : null
}

function inferClientWidth(element: HTMLElement): number {
  const inlineWidth = parsePx(element.style.width)
  if (inlineWidth && inlineWidth > 0) return inlineWidth
  if (element instanceof HTMLCanvasElement && element.width > 0) return element.width
  return DEFAULT_CLIENT_WIDTH
}

function inferClientHeight(element: HTMLElement): number {
  const inlineHeight = parsePx(element.style.height)
  if (inlineHeight && inlineHeight > 0) return inlineHeight
  if (element instanceof HTMLCanvasElement && element.height > 0) return element.height
  return DEFAULT_CLIENT_HEIGHT
}

Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get() {
    return inferClientWidth(this as HTMLElement)
  },
})

Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  configurable: true,
  get() {
    return inferClientHeight(this as HTMLElement)
  },
})


// ResizeObserver does not perform layout in Happy DOM. Give responsive charts
// measurable bounds while preserving the geometry of other test elements.
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
HTMLElement.prototype.getBoundingClientRect = function () {
  if (this.classList.contains('recharts-responsive-container')) {
    const width = 640
    const height = 320
    return { x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON: () => ({}) }
  }
  return originalGetBoundingClientRect.call(this)
}
