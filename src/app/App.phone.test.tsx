// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A phone's width: the tree is not pinned beside a home, where it would take
 * half the screen and cut every name short, but brought by its toggle; row
 * one's undo and redo are marked to give way to the place, the word and ⋯
 * (`Frame.css`, which jsdom does not lay out), and Back is not: it stays at
 * every width, with Forward folding into ⋯ as the row measures it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import type { ScopeSnapshot } from '../projects/scope'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

const organisation: ScopeSnapshot[] = [
  { path: '', model: { name: 'Acme', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [] },
]

const widthIs = (phone: boolean) => vi.stubGlobal('matchMedia', (query: string) => ({
  matches: phone && query.includes('max-width: 600px'), media: query, onchange: null,
  addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
}))

beforeEach(() => widthIs(true))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('a phone', () => {
  it('opens a home without the tree beside it, and brings it with the toggle', async () => {
    renderApp({ repositories: heldRepositories(organisation) })
    await screen.findAllByText('Acme')
    expect(document.querySelector('.kit-frame__tree')).toBeNull()
    fireEvent.click(screen.getByTestId('frame-tree-toggle'))
    expect(document.querySelector('.kit-frame__tree')).not.toBeNull()
  })

  it('marks undo and redo as what row one lets go of first, and never Back', async () => {
    renderApp({ repositories: heldRepositories(organisation) })
    await screen.findAllByText('Acme')
    const steps = Array.from(document.querySelectorAll('.kit-frame__steps'))
    expect(steps.some((held) => held.querySelector('[aria-label="Undo"]'))).toBe(true)
    expect(screen.getByRole('button', { name: 'Back' }).closest('.kit-frame__steps')).toBeNull()
    expect(document.querySelector('.kit-frame__steps [data-testid="back-forward"], .kit-frame__steps [data-testid="overflow-button"], .kit-frame__steps [data-testid="saved-indicator"]')).toBeNull()
  })

  it('folds the status word to its mark and Forward into ⋯ last, where it goes forward, and keeps Back on a row with room for nothing', async () => {
    // A row that never fits: everything that may fold, folds.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => 300)
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => 2000)
    const forward = vi.spyOn(window.history, 'forward').mockImplementation(() => undefined)
    try {
      renderApp({ repositories: heldRepositories(organisation) })
      await screen.findAllByText('Acme')
      expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Forward' })).toBeNull()
      // The status word folds whole to its mark and keeps its name; the find field is named in full whatever it shows.
      const status = screen.getByTestId('saved-indicator')
      expect(status.dataset.folded).toBe('true')
      expect(status.getAttribute('aria-label')).not.toBe('')
      expect(screen.getByTestId('frame-find').getAttribute('aria-label')).toBe('Find or run a command')
      fireEvent.click(screen.getAllByTestId('overflow-button')[0])
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Forward' }))
      expect(forward).toHaveBeenCalledTimes(1)
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('keeps the tree beside a home on a wider screen', async () => {
    widthIs(false)
    renderApp({ repositories: heldRepositories(organisation) })
    await screen.findAllByText('Acme')
    expect(document.querySelector('.kit-frame__tree')).not.toBeNull()
  })
})
