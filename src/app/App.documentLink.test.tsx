// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A link to an element's page (ADR-0033, amended 17 October 2026), through the
 * whole shell with the real editor: the boot reads the link as it reads every
 * address, and the page opens for every element that has one — a unit kept by
 * a domain that draws nothing, an element no view draws, and one a view draws
 * — without a view to stand on, and closing it in a scope that draws nothing
 * goes home. No raw words about a missing view reach the screen.
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

const unit = (id: string, name: string): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId: 'division',
})
const app = (id: string, name: string): DesignElement => ({ id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {} })
const scope = (path: string, name: string, over: Partial<ScopeSnapshot['model']> = {}, activeDiagramId = ''): ScopeSnapshot => ({
  path, model: { name, elements: [], relations: [], diagrams: [], ...over }, activeDiagramId, logoLibrary: [],
})
const tree = () => [
  scope('', 'Acme'),
  // A domain that keeps its unit and draws nothing at all.
  scope('freight', 'Freight', { elements: [unit('freight-division', 'Freight Division'), unit('freight-yard', 'Freight Yard')] }),
  // A landscape with a board that draws one of its two applications.
  scope('freight/landscape', 'Landscape', {
    elements: [app('billing', 'Billing'), app('undrawn', 'Undrawn ledger')],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [{ id: 'billing', x: 0, y: 0 }] })],
  }, 'd1'),
]

/** The app booted at a link, the way `main.tsx` lands one: the fragment read, the scope it names read, and where that lands. */
async function openLink(hash: string) {
  const scopes = tree()
  const repositories = heldRepositories(scopes)
  const place = readPlace(hash)
  if (place === undefined) throw new Error(`not a place: ${hash}`)
  const landing = placeLanding(await readPlaceScope(repositories.scopes, place.scope), place)
  renderApp({ repositories, boot: landing })
  return { landing }
}

const NO_VIEW = /no view here to show|Diagram not found|activeDiagramId/

/** The documentation page, on the element named. */
async function onThePageOf(name: string) {
  const nav = await screen.findByTestId('doc-nav')
  await waitFor(() => expect(screen.getAllByText(name).length).toBeGreaterThan(0))
  return nav
}

describe('a link to an element’s page', () => {
  it('opens a unit’s page in a scope that draws nothing, with the scope’s own records beside it', async () => {
    const { landing } = await openLink('#/freight/-/document/freight-division')
    expect(landing.notice).toBeUndefined()
    const nav = await onThePageOf('Freight Division')
    // Its neighbours are what the scope keeps, since there is no view to be next on.
    expect(within(nav).getByText('Freight Yard')).toBeTruthy()
    expect(screen.queryByText(NO_VIEW)).toBeNull()
  })

  it('opens it from the form links had before 3.7.0 as well', async () => {
    await openLink('#place?scope=freight&page=document&id=freight-division')
    await onThePageOf('Freight Division')
    expect(screen.queryByText(NO_VIEW)).toBeNull()
  })

  it('goes home when the page is closed in a scope that draws nothing, rather than onto an empty canvas', async () => {
    await openLink('#/freight/-/document/freight-division')
    await onThePageOf('Freight Division')
    fireEvent.click(screen.getByRole('button', { name: 'Close documentation' }))
    await waitFor(() => expect(screen.getByTestId('organisation-name').textContent).toBe('Freight'))
    expect(screen.queryByText(NO_VIEW)).toBeNull()
  })

  it('opens the page of an element no view draws, in a scope with a board', async () => {
    await openLink('#/freight/landscape/-/document/undrawn')
    await onThePageOf('Undrawn ledger')
    expect(screen.queryByText(NO_VIEW)).toBeNull()
  })

  it('lands an element that is not there on the scope, and says so, rather than on a page with nothing on it', async () => {
    const { landing } = await openLink('#/freight/-/document/gone')
    expect(landing.notice).toBe('shell.placeGone')
    expect(screen.queryByTestId('doc-nav')).toBeNull()
    await waitFor(() => expect(screen.getByTestId('organisation-name').textContent).toBe('Freight'))
    expect(screen.queryByText(NO_VIEW)).toBeNull()
  })
})
