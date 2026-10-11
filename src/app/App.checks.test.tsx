// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Findings marked as intended, through the whole shell (ADR-0036, amended 11
 * October 2026): a mark made where its scope is open is a step of that
 * scope's session — one undo takes it back — listed under *Accepted* and
 * taken back from there.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { DesignElement } from '../model/types'
import type { HostCommand } from '../platform/hostCommands'
import type { ScopeSnapshot } from '../projects/scope'
import { axeFindings } from './testing/axe'
import { unfoldFindings } from './testing/findings'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

afterEach(() => cleanup())
beforeAll(() => { Element.prototype.scrollIntoView ??= () => {} })

const TODAY = () => '2026-10-12'

const team = (id: string, name: string): DesignElement => ({ id, kind: 'actor', name, unitTypeId: 'ut-team', lifecycle: 'live', isManaged: false, aspects: {} })
const app = (id: string, name: string, partyId?: string): DesignElement => ({
  id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {}, ...(partyId ? { partyId } : {}),
})

/** Two teams that declare they work together and run no interface, on a Conway map; a domain with an application nobody owns. */
function organisation(): ScopeSnapshot[] {
  return [
    {
      path: '',
      model: {
        name: 'Acme Logistics',
        elements: [team('ops', 'Operations'), team('sales', 'Sales'), app('wms', 'WMS', 'ops')],
        relations: [{ id: 'i-ops-sales', type: 'interacts', sourceId: 'ops', targetId: 'sales', mode: 'service' }],
        diagrams: [{ id: 'cw', kind: 'conway', name: 'Teams and systems', members: [] }],
        unitTypes: [{ id: 'ut-team', name: 'Team', top: true, within: [], slots: [] }],
        roles: [],
      },
      activeDiagramId: 'cw',
      logoLibrary: [],
    },
    { path: 'retail', model: { name: 'Retail', elements: [app('pos', 'Point of sale')], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [] },
  ]
}

/** The app with the host's command stream, as the preload hands it over: what ⌘Z sends. */
function show(scopes: ScopeSnapshot[], opened?: ScopeSnapshot) {
  const listeners: ((command: HostCommand) => void)[] = []
  const held = heldRepositories(scopes)
  renderApp({
    repositories: held, today: TODAY,
    boot: { initialProject: opened },
    host: {
      commands: (listener) => {
        listeners.push(listener)
        return () => { listeners.splice(listeners.indexOf(listener), 1) }
      },
    },
  })
  return { held, send: (command: HostCommand) => act(() => { for (const one of [...listeners]) one(command) }) }
}

const unused = () => document.querySelector<HTMLElement>('[data-check="check.interactionUnused"]')

describe('a finding marked as intended where its scope is open', { timeout: 20_000 }, () => {
  it('is a step of the session: listed under Accepted, back with one undo, and taken back from Accepted', async () => {
    const scopes = organisation()
    const { held, send } = show(scopes, scopes[0])
    const list = await screen.findByTestId('conway-findings')
    unfoldFindings(list)
    fireEvent.click(within(unused()!).getByTestId('conway-finding'))
    fireEvent.click(within(list).getByTestId('finding-mark'))
    const dialog = await screen.findByRole('dialog', { name: 'Mark as intended' })
    expect(within(dialog).getByTestId('finding-mark-sentence').textContent).toBe('Operations and Sales declare As a service, and no interface runs between them.')
    expect(await axeFindings()).toEqual([])
    fireEvent.change(within(dialog).getByTestId('finding-mark-reason'), { target: { value: 'They design the API together' } })
    fireEvent.keyDown(within(dialog).getByTestId('finding-mark-reason'), { key: 'Enter' })
    // Out of the groups, and listed apart.
    await waitFor(() => expect(unused()).toBeNull())
    fireEvent.click(within(list).getByTestId('findings-accepted-toggle'))
    expect(within(list).getByTestId('accepted-reason').textContent).toContain('“They design the API together”')
    expect(await axeFindings()).toEqual([])

    // One undo: the mark is gone, and the finding is back.
    send({ type: 'undo' })
    await waitFor(() => expect(unused()).not.toBeNull())
    expect(within(list).queryByTestId('findings-accepted')).toBeNull()

    // Marked again, and taken back from Accepted: a step of its own, written with the scope.
    unfoldFindings(list)
    fireEvent.click(within(unused()!).getByTestId('conway-finding'))
    fireEvent.click(within(list).getByTestId('finding-mark'))
    fireEvent.click(await screen.findByTestId('finding-mark-confirm'))
    await waitFor(() => expect(unused()).toBeNull())
    send({ type: 'save' })
    await waitFor(async () => expect((await held.read(''))?.model.checkMarks).toEqual([
      // On the workspace's own day, which the window reads off its clock.
      { check: 'check.interactionUnused', key: 'i-ops-sales ops sales', on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) as string },
    ]))
    // Accepted stays as it was left for the session: open.
    expect(within(list).getByTestId('findings-accepted-toggle').getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(within(list).getByTestId('finding-take-back'))
    await waitFor(() => expect(unused()).not.toBeNull())
    send({ type: 'save' })
    await waitFor(async () => expect((await held.read(''))?.model.checkMarks ?? []).toEqual([]))
  })
})
