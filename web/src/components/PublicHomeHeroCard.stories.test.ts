import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { LanguageProvider } from '../i18n'
import { ThemeProvider } from '../theme'
import meta, * as heroStories from './PublicHomeHeroCard.stories'

function renderHeroStory(story: { args?: Record<string, unknown> }): string {
  const render = meta.render as
    | ((args: Record<string, unknown>) => JSX.Element)
    | undefined
  expect(render).toBeDefined()
  return renderToStaticMarkup(
    createElement(
      LanguageProvider,
      null,
      createElement(
        ThemeProvider,
        null,
        render?.({ ...((meta as { args?: Record<string, unknown> }).args ?? {}), ...(story.args ?? {}) }),
      ),
    ),
  )
}

describe('PublicHomeHeroCard Storybook proofs', () => {
  it('exports a stable authentication checking state for slow statistics', () => {
    expect(meta).toMatchObject({
      title: 'Public/PublicHomeHeroCard',
      tags: ['autodocs'],
    })

    expect(heroStories.AuthStatusCheckingSlowStats.args).toMatchObject({
      metricsLoading: true,
      summaryLoading: true,
      showAuthStatusLoading: true,
    })
  })

  it('renders authentication checking copy with loading placeholders instead of resolved metrics', () => {
    const markup = renderHeroStory(heroStories.AuthStatusCheckingSlowStats)

    expect(markup).toContain('Checking sign-in and registration status')
    expect(markup).toContain('Checking sign-in')
    expect(markup).toContain('/assets/relay-mesh-lockup-light.svg')
    expect(markup).toContain('/assets/relay-mesh-lockup-dark.svg')
    // Console-style hero renders metric titles with loading skeletons, no decorative effects.
    expect(markup).toContain('data-slot="skeleton"')
    expect(markup).not.toContain('/assets/public-hero-load-balancer.png')
    expect(markup).not.toContain('animateMotion')
    expect(markup).not.toContain('hero-flow-')
    expect(markup).not.toContain('public-home-load-balancer')
    expect(markup).not.toContain('Sign in with Linux DO')
  })

  it('renders the Linux DO login action with the primary button treatment', () => {
    const markup = renderHeroStory(heroStories.LoggedOutNoToken)

    expect(markup).toContain('/assets/linuxdo-logo.svg')
    expect(markup).toContain('data-slot="button"')
  })
})
