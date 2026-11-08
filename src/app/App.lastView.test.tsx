// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A scope's last view removed, through the whole shell with the real editor:
 * asked first like any other, and then the scope stays open — its pages still
 * there, an empty place where the view was that offers another, a page
 * closed onto that place rather than home — so ⌘Z takes the removal back.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import type { ScopeSnapshot } from '../projects/scope'
import type { ScopeSession } from '../ports/ScopeSession'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'

afterEach(() => cleanup())
beforeAll(() => installReactFlowMocks())

const board = laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })
const tree = (): ScopeSnapshot[] => [
  { path: '', model: { name: 'Acme', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [] },
  { path: 'acme/landscape', model: { name: 'Landscape', elements: [], relations: [], diagrams: [board] }, activeDiagramId: 'd1', logoLibrary: [] },
]

describe('removing a scope’s last view', () => {
  it('keeps the scope open on an empty place, with its pages, and ⌘Z puts the view back', async () => {
    let session: ScopeSession | undefined
    const scopes = tree()
    renderApp({ repositories: heldRepositories(scopes), boot: { initialProject: scopes[1] }, provider: { onScopeSession: (held) => { session = held } } })
    await waitFor(() => expect(session?.scope).toBe('acme/landscape'))

    fireEvent.contextMenu(await screen.findByRole('tab', { name: /L7/ }))
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: /Delete/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await screen.findByText('No view here yet')
    expect(session!.current().diagrams).toEqual([])
    // A closing dialog hides the page from role queries until it is gone.
    expect(await screen.findByRole('button', { name: 'New view…' })).toBeTruthy()
    // Still the workspace: no home came up in its place.
    expect(screen.queryByTestId('organisation-name')).toBeNull()

    // A page over it closes onto the empty place, not home: going home would take ⌘Z with it.
    fireEvent.click(await screen.findByText('Decisions'))
    await screen.findByText(/No decisions in Landscape/)
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByText(/No decisions in Landscape/)).toBeNull())
    expect(screen.getByText('No view here yet')).toBeTruthy()
    expect(screen.queryByTestId('organisation-name')).toBeNull()

    // On the place itself: jsdom lays nothing out, so nowhere in particular never counts as on screen here.
    fireEvent.keyDown(screen.getByTestId('no-view'), { key: 'z', ctrlKey: true })
    await waitFor(() => expect(session!.current().diagrams.map((d) => d.id)).toEqual(['d1']))
    await screen.findByRole('tab', { name: /L7/ })
    expect(screen.queryByText('No view here yet')).toBeNull()
  })

  it('offers a view again from the empty place, made through the shell’s own question', async () => {
    let session: ScopeSession | undefined
    const scopes = tree()
    renderApp({ repositories: heldRepositories(scopes), boot: { initialProject: scopes[1] }, provider: { onScopeSession: (held) => { session = held } } })
    await waitFor(() => expect(session?.scope).toBe('acme/landscape'))
    act(() => { session!.dispatch({ type: 'diagram.delete', id: 'd1' }) })
    fireEvent.click(await screen.findByRole('button', { name: 'New view…' }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })
})
