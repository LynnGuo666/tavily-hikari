import '../../test/happydom'

import { afterEach, describe, expect, it } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import ConnectivityChecksPanel, { type ProbeButtonModel, type ProbeStepStatus } from './ConnectivityChecksPanel'
import { TooltipProvider } from '@/components/ui/tooltip'

const stepStatusText: Record<ProbeStepStatus, string> = {
  running: '进行中',
  success: '成功',
  failed: '失败',
  blocked: '受阻',
  skipped: '已跳过',
}

const idleProbe: ProbeButtonModel = {
  state: 'idle',
  completed: 0,
  total: 0,
}

async function mountPanel(label: string): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <TooltipProvider>
        <ConnectivityChecksPanel
          title="连通性检测"
          costHint="Runs probe checks."
          costHintAria="Probe cost hint"
          stepStatusText={stepStatusText}
          mcpButtonLabel="检测 MCP"
          apiButtonLabel="检测 API"
          mcpProbe={idleProbe}
          apiProbe={idleProbe}
          probeBubble={{
            visible: true,
            anchor: 'mcp',
            items: [{
              id: 'mcp-tool-call:tavily_search',
              label,
              status: 'success',
              detail: label === '调用 tavily_search 工具' ? 'mock upstream replied in 42ms' : undefined,
            }],
          }}
        />
      </TooltipProvider>,
    )
  })

  return { container, root }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ConnectivityChecksPanel', () => {
  it('renders MCP tool-call rows with a separate monospace tool chip', async () => {
    const { root } = await mountPanel('调用 tavily_search 工具')
    const html = document.body.innerHTML

    expect(html).toContain('user-console-probe-bubble-item-label-structured')
    expect(html).toContain('<span class="user-console-probe-bubble-item-label-text">调用</span>')
    expect(html).toContain('<code class="user-console-probe-bubble-item-tool">tavily_search</code>')
    expect(html).toContain('<span class="user-console-probe-bubble-item-label-text">工具</span>')
    expect(html).toContain('mock upstream replied in 42ms')

    await act(async () => {
      root.unmount()
    })
  })

  it('falls back to the plain label when the rendered copy cannot be split around the tool name', async () => {
    const { root } = await mountPanel('自定义调用文案')
    const html = document.body.innerHTML

    expect(html).not.toContain('user-console-probe-bubble-item-label-structured')
    expect(html).toContain('<strong class="user-console-probe-bubble-item-label">自定义调用文案</strong>')

    await act(async () => {
      root.unmount()
    })
  })
})
