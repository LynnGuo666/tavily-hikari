import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'

import { LanguageProvider } from '../i18n'
import { ADMIN_USER_CONSOLE_HREF } from '../lib/adminUserConsoleEntry'
import { ThemeProvider } from '../theme'
import AdminPanelHeader from './AdminPanelHeader'

function renderWithProviders(node: React.JSX.Element): string {
  return renderToStaticMarkup(
    <LanguageProvider>
      <ThemeProvider>{node}</ThemeProvider>
    </LanguageProvider>,
  )
}

describe('admin return-to-console CTA', () => {
  it('renders the shared href in the admin dashboard header', () => {
    const html = renderWithProviders(
      <AdminPanelHeader
        title="Overview"
        subtitle="Monitor system health."
        displayName="Ops Admin"
        isAdmin
        isRefreshing={false}
        refreshLabel="Refresh"
        refreshingLabel="Refreshing"
        userConsoleLabel="Back to User Console"
        userConsoleHref={ADMIN_USER_CONSOLE_HREF}
        onRefresh={() => undefined}
      />,
    )

    expect(html).toContain('Back to User Console')
    expect(html).toContain(`href="${ADMIN_USER_CONSOLE_HREF}"`)
    expect(html).toContain('admin-return-link')
  })
})
