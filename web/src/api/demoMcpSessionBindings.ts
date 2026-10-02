import type { AdminMcpSessionBindingListItem, AdminMcpSessionBindingsPage } from './systemSettingsTypes'

export function createDemoMcpSessionBindings(now: () => number): AdminMcpSessionBindingListItem[] {
  return Array.from({ length: 8 }, (_, index) => ({
    proxySessionId: `demo-proxy-${index + 1}`,
    authTokenId: index % 2 === 0 ? 'dm01' : 'ops2',
    userId: index % 2 === 0 ? 'user-demo-admin' : 'user-ops',
    upstreamKeyId: index % 2 === 0 ? 'Hk01' : 'Sf02',
    createdAt: now() - (index + 1) * 3600,
    updatedAt: now() - (index + 1) * 60,
    expiresAt: now() + (index < 6 ? 3600 : -3600),
    status: index < 6 ? 'active' : index === 6 ? 'expired' : 'revoked',
    revokedAt: index === 7 ? now() - 60 : null,
    revokeReason: index === 7 ? 'admin_manual' : null,
  }))
}

function matchingItems(items: AdminMcpSessionBindingListItem[], params: URLSearchParams) {
  const status = params.get('status') ?? 'active'
  return items.filter((item) => {
    if (status !== 'all' && item.status !== status) return false
    for (const [parameter, timestamp, lower] of [
      ['created_from', item.createdAt, true], ['created_to', item.createdAt, false],
      ['updated_from', item.updatedAt, true], ['updated_to', item.updatedAt, false],
    ] as const) {
      const raw = params.get(parameter)
      if (!raw) continue
      const bound = Date.parse(raw) / 1000
      if (Number.isFinite(bound) && (lower ? timestamp < bound : timestamp > bound)) return false
    }
    return true
  })
}

export function handleDemoMcpSessionBindingsRoute(
  url: URL,
  method: string,
  items: AdminMcpSessionBindingListItem[],
  body: Record<string, unknown>,
): Response | null {
  const base = '/api/settings/system/mcp-session-bindings'
  if (url.pathname === base && method === 'GET') {
    const matching = matchingItems(items, url.searchParams)
    const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1))
    const perPage = Math.max(1, Math.min(100, Math.floor(Number(url.searchParams.get('per_page')) || 20)))
    const payload: AdminMcpSessionBindingsPage = {
      items: matching.slice((page - 1) * perPage, page * perPage),
      total: matching.length, page, perPage,
      activeMatchingCount: matching.filter((item) => item.status === 'active').length,
    }
    return Response.json(payload)
  }
  if (method !== 'POST' || ![`${base}/revoke-selected`, `${base}/revoke-filtered`].includes(url.pathname)) return null
  const selected = url.pathname.endsWith('/revoke-selected')
    ? new Set(Array.isArray(body.proxySessionIds) ? body.proxySessionIds : [])
    : new Set(matchingItems(items, new URLSearchParams(Object.entries(body).flatMap(([key, value]) => {
        if (value == null) return []
        const parameter = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
        return [[parameter, String(value)]]
      }))).map((item) => item.proxySessionId))
  let revokedCount = 0
  for (const item of items) {
    if (item.status !== 'active' || !selected.has(item.proxySessionId)) continue
    item.status = 'revoked'
    item.revokedAt = Math.floor(Date.now() / 1000)
    item.revokeReason = 'admin_manual'
    revokedCount += 1
  }
  return Response.json({ revokedCount })
}
