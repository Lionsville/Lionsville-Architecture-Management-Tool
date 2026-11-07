// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The root of the shell: the language under every page, and the accent a
 * source's environment wears.
 *
 * The harness wraps what it renders in a language of its own, which is how pages
 * stayed English under a translated bar with every suite green. So these render
 * the harness in English and the app's own preference in another language: only
 * a provider at the app's root can make the words change.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import type { ScopeSnapshot } from '../projects/scope'
import { deriveAccent } from '../widgets/kit/accent'
import { coloursOf } from '../widgets/kit/tokens'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

afterEach(() => cleanup())

const root: ScopeSnapshot = {
  path: '',
  model: { name: 'Acme Logistics', elements: [], relations: [], diagrams: [], decisions: [] },
  activeDiagramId: '',
  logoLibrary: [],
} as unknown as ScopeSnapshot

const boot = (language: string) => ({ initialProject: undefined, initialPreferences: { language }, browserLanguages: [language] })

/** What the baseline set on the root: emotion's sheets, as text. */
const rootVariables = () => [...document.querySelectorAll('style')].map((style) => style.textContent).join('\n')

describe('the language', () => {
  it.each([['nl', 'Principes'], ['de', 'Prinzipien']])('reaches a page that only asks for it, in %s', async (language, word) => {
    renderApp({ repositories: heldRepositories([root]), boot: boot(language) }, { language: 'en' })
    expect((await screen.findAllByText(word)).length).toBeGreaterThan(0)
    expect(screen.queryByText('Principles')).toBeNull()
  })
})

describe('the accent', () => {
  it('stays the default where the source says none', async () => {
    renderApp({ repositories: heldRepositories([root]), boot: boot('en') })
    const accents = [coloursOf('light').accent, coloursOf('dark').accent]
    await waitFor(() => expect(accents.some((accent) => rootVariables().includes(`--accent:${accent}`))).toBe(true))
  })

  it('wears the one the source says', async () => {
    const answer = deriveAccent('#a0186b')
    if (!answer.ok) throw new Error('refused')
    renderApp({ repositories: heldRepositories([root]), boot: boot('en'), provider: { accent: '#a0186b' } })
    const accents = [answer.shades.light.accent, answer.shades.dark.accent]
    await waitFor(() => expect(accents.some((accent) => rootVariables().includes(`--accent:${accent}`))).toBe(true))
  })

  it('keeps the default and says why when the source asks for a status’s colour', async () => {
    const view = renderApp({ repositories: heldRepositories([root]), boot: boot('en'), provider: { accent: coloursOf('light').bad } })
    await waitFor(() => expect(view.diagnostics.messages().join('\n')).toContain('accent was refused: status-hue'))
    expect(rootVariables()).not.toContain(`--accent:${coloursOf('light').bad}`)
  })
})
