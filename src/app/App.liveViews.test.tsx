// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A view in a document is the view (ADR-0043 §11), through the whole shell
 * with the real editor: an element's page that shows a board draws that
 * board live and read-only — a press on it selects nothing — and the
 * caption under it leaves the page for the board.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import type { DesignElement } from '../model'
import { readPlace } from '../agent/place'
import type { ScopeSnapshot } from '../projects/scope'
import { placeLanding, readPlaceScope } from './bootLanding'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'

afterEach(() => cleanup())
beforeAll(() => installReactFlowMocks())

const app = (id: string, name: string, description?: string): DesignElement => ({
  id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {}, ...(description ? { description } : {}),
})

const tree = (): ScopeSnapshot[] => [
  { path: '', model: { name: 'Acme', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [] },
  {
    path: 'freight', activeDiagramId: 'd1', logoLibrary: [],
    model: {
      name: 'Freight', relations: [],
      elements: [app('billing', 'Billing', 'Where it sits:\n\n![The landscape](view:d1)\n'), app('ledger', 'Ledger')],
      diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'Freight board', placements: [{ id: 'billing', x: 0, y: 0 }, { id: 'ledger', x: 300, y: 0 }] })],
    },
  },
]

async function openPage() {
  const repositories = heldRepositories(tree())
  const place = readPlace('#/freight/-/document/billing')!
  renderApp({ repositories, boot: placeLanding(await readPlaceScope(repositories.scopes, place.scope), place) })
}

describe('a view in a document', () => {
  it('draws the board live and read-only on an element\'s page, and its caption opens the board', async () => {
    await openPage()
    const live = () => screen.getByTestId('view-live')
    await waitFor(() => expect(within(live()).getAllByText('Ledger').length).toBeGreaterThan(0))
    expect(live().getAttribute('data-view')).toBe('d1')
    expect(live().textContent).toContain('The landscape')
    // Read, never used: the view is inert, so no press and no key reaches it; its frame still scrolls.
    const inert = within(live()).getByTestId('view-inert')
    expect(inert.hasAttribute('inert')).toBe(true)
    expect(inert.contains(within(live()).getAllByText('Ledger')[0]!)).toBe(true)
    fireEvent.click(within(live()).getByTestId('view-open'))
    await waitFor(() => expect(screen.queryByTestId('doc-nav')).toBeNull())
  })

})
