// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Search from a home, with nothing open: the bar's *Search* and ⌘K open the
 * workspace's wider search over the whole tree, and a hit opens the scope
 * that holds it.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { heldRepositories } from '../testing/heldRepositories'
import { laidOut } from '../../model/testFixtures'
import type { ScopeSnapshot } from '../../projects/scope'
import { renderApp } from '../testing/renderShell'
import { installReactFlowMocks } from '../../editor/reactFlowTestSetup'

afterEach(() => cleanup())
beforeAll(() => installReactFlowMocks())

const board = () => laidOut({ id: 'l7', kind: 'layer7' as const, name: 'L7', placements: [{ id: 'billing', x: 0, y: 0 }] })

const TREE = (): ScopeSnapshot[] => [
  { path: '', model: { name: 'Acme Logistics', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [] },
  { path: 'retail', model: { name: 'Retail', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [] },
  {
    path: 'retail/warehouse',
    model: {
      name: 'Warehouse',
      elements: [{ id: 'billing', kind: 'application', name: 'Billing engine', lifecycle: 'live', isManaged: true, aspects: {} }],
      relations: [],
      diagrams: [board()],
    },
    activeDiagramId: 'l7',
    logoLibrary: [],
  },
]

const show = () => renderApp({ repositories: heldRepositories(TREE()), today: () => '2026-10-18' })

describe('search on a home', () => {
  it('finds an element in a scope folded away under the tree, and opens it there', async () => {
    show()
    fireEvent.click(await screen.findByTestId('home-search'))
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'billing' } })
    const hit = await screen.findByRole('option', { name: /Billing engine/ })
    expect(hit.textContent).toContain('Warehouse')
    fireEvent.mouseMove(hit)
    fireEvent.click(hit)
    await waitFor(() => expect(screen.getByTestId('crumb-current').textContent).toBe('Warehouse'))
    await waitFor(() => expect(screen.getByTestId('saved-indicator')).toBeDefined())
  })

  it('opens on ⌘K, as in the workspace', async () => {
    show()
    await screen.findByTestId('home-search')
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(await screen.findByRole('combobox')).toBeDefined()
  })
})
