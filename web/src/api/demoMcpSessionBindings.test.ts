import { afterEach, expect, it } from 'bun:test'
import { createDemoMcpSessionBindings, handleDemoMcpSessionBindingsRoute } from './demoMcpSessionBindings'
import { fetchAdminMcpSessionBindings } from './runtime'

const base = 'http://demo.test/api/settings/system/mcp-session-bindings'
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

it('provides a paginated session list and applies date and status filters', async () => {
  const items = createDemoMcpSessionBindings(() => 1700000000)
  const response = handleDemoMcpSessionBindingsRoute(new URL(`${base}?status=all&page=2&per_page=3`), 'GET', items, {})!
  const result = await response.json()
  expect(result.items).toHaveLength(3)
  expect(result.items[0].proxySessionId).toBe(items[3].proxySessionId)
  expect(result.total).toBe(8)
  expect(result.activeMatchingCount).toBe(6)
  const filtered = await handleDemoMcpSessionBindingsRoute(new URL(`${base}?created_from=${encodeURIComponent(new Date(items[1].createdAt * 1000).toISOString())}`), 'GET', items, {})!.json()
  expect(filtered.items.map((item: { proxySessionId: string }) => item.proxySessionId)).toEqual(['demo-proxy-1', 'demo-proxy-2'])
})

it('releases only active selected sessions and returns the resulting status list', async () => {
  const items = createDemoMcpSessionBindings(() => 1700000000)
  const result = await handleDemoMcpSessionBindingsRoute(new URL(`${base}/revoke-selected`), 'POST', items, { proxySessionIds: ['demo-proxy-1', 'demo-proxy-7'] })!.json()
  expect(result.revokedCount).toBe(1)
  expect(items[6].status).toBe('expired')
  const revoked = await handleDemoMcpSessionBindingsRoute(new URL(`${base}?status=revoked`), 'GET', items, {})!.json()
  expect(revoked.total).toBe(2)
  expect(revoked.activeMatchingCount).toBe(0)
})

it('rejects an invalid session response so the page can display its loading error', async () => {
  globalThis.fetch = (async () => Response.json({ demo: true })) as typeof fetch
  await expect(fetchAdminMcpSessionBindings({})).rejects.toThrow('Invalid MCP session bindings response')
})
