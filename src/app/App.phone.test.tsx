// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A phone's width: the tree is not pinned beside a home, where it would take
 * half the screen and cut every name short, but brought by its toggle; row
 * one's back, forward, undo and redo are marked to give way to the place, the
 * word and ⋯ (`Frame.css`, which jsdom does not lay out).
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

  it('marks back, forward, undo and redo as what row one lets go of first', async () => {
    renderApp({ repositories: heldRepositories(organisation) })
    await screen.findAllByText('Acme')
    const steps = Array.from(document.querySelectorAll('.kit-frame__steps'))
    expect(steps.some((held) => held.querySelector('[data-testid="back-forward"]'))).toBe(true)
    expect(steps.some((held) => held.querySelector('[aria-label="Undo"]'))).toBe(true)
    expect(document.querySelector('.kit-frame__steps [data-testid="overflow-button"], .kit-frame__steps [data-testid="saved-indicator"]')).toBeNull()
  })

  it('keeps the tree beside a home on a wider screen', async () => {
    widthIs(false)
    renderApp({ repositories: heldRepositories(organisation) })
    await screen.findAllByText('Acme')
    expect(document.querySelector('.kit-frame__tree')).not.toBeNull()
  })
})
