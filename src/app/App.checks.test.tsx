// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Findings marked as intended, and the Checks page, through the whole shell
 * (ADR-0036, amended 11 October 2026).
 *
 * A mark made where its scope is open is a step of that scope's session —
 * one undo takes it back — and one made from a home, where nothing is open,
 * is the step of the scope that keeps it, written there; either is listed
 * under *Accepted* and taken back from there. The Checks page is reached
 * from the home's card and its counts, and by an agent's `app.open`, which
 * may name the check to pick.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { DesignElement } from '../model/types'
import type { AgentGateway } from '../ports/AgentGateway'
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
function show(scopes: ScopeSnapshot[], opened?: ScopeSnapshot, agent?: AgentGateway) {
  const listeners: ((command: HostCommand) => void)[] = []
  const held = heldRepositories(scopes)
  renderApp({
    repositories: held, today: TODAY, ...(agent ? { agent } : {}),
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

describe('the Checks page', { timeout: 20_000 }, () => {
  it('lists every check by category from the home\'s card, the notes hidden until shown, each instance opening where it is fixed', async () => {
    show(organisation())
    fireEvent.click(await screen.findByTestId('open-checks'))
    await screen.findByTestId('checks-topbar')
    const landscape = await screen.findByRole('heading', { name: 'The landscape' })
    expect(landscape).toBeDefined()
    // A note's check is hidden until the notes are shown, as in every list.
    expect(screen.queryByTestId('checks-row-check.interactionUnused')).toBeNull()
    fireEvent.click(screen.getByTestId('checks-weight-note'))
    fireEvent.click(screen.getByTestId('checks-row-check.interactionUnused'))
    const detail = screen.getByTestId('checks-detail')
    expect(within(detail).getByTestId('checks-why').textContent).toContain('Two units declare that they work together')
    expect(await axeFindings()).toEqual([])
    // Each instance opens where it is fixed: the unit it starts from, in the scope that keeps it.
    fireEvent.click(within(detail).getByRole('button', { name: /^Operations and Sales declare/ }))
    await waitFor(() => expect(screen.getByTestId('crumb-current').textContent).toBe('Acme Logistics'))
  })

  it('marks one kept in another scope as that scope\'s step from the home, and takes it back', async () => {
    const { held } = show(organisation())
    fireEvent.click(await screen.findByTestId('attention-count-review'))
    await screen.findByTestId('checks-topbar')
    fireEvent.click(await screen.findByTestId('checks-row-check.applicationUnowned'))
    const detail = screen.getByTestId('checks-detail')
    fireEvent.click(within(detail).getByRole('button', { name: /^Mark as intended… Point of sale/ }))
    fireEvent.change(await screen.findByTestId('finding-mark-reason'), { target: { value: 'Bought in, run by the shop' } })
    fireEvent.click(screen.getByTestId('finding-mark-confirm'))
    // Written to the scope that keeps the application, and read again.
    await waitFor(async () => expect((await held.read('retail'))?.model.checkMarks).toEqual([
      { check: 'check.applicationUnowned', key: 'pos', reason: 'Bought in, run by the shop', on: '2026-10-12' },
    ]))
    const accepted = await within(screen.getByTestId('checks-detail')).findByTestId('checks-accepted')
    expect(within(accepted).getByTestId('accepted-reason').textContent).toContain('“Bought in, run by the shop”')
    expect(screen.getByTestId('checks-row-check.applicationUnowned').textContent).toMatch(/0$/)
    fireEvent.click(within(accepted).getByTestId('finding-take-back'))
    await waitFor(async () => expect((await held.read('retail'))?.model.checkMarks ?? []).toEqual([]))
    await waitFor(() => expect(screen.getByTestId('checks-row-check.applicationUnowned').textContent).toMatch(/1$/))
  })

  it('opens for an agent on the check it names, and says it is up', async () => {
    const wire = gateway()
    show(organisation(), undefined, wire.gateway)
    await waitFor(() => expect(wire.bound()).toBe(true))
    const answer = await wire.ask('app.open', { scope: '', page: 'checks', id: 'check.interactionUnused' })
    expect(answer.page).toEqual({ page: 'checks' })
    // A note's check, asked for: the notes are shown for it.
    await waitFor(() => expect(screen.getByTestId('checks-detail').dataset.check).toBe('check.interactionUnused'))
    expect(screen.getByTestId('checks-weight-note').getAttribute('aria-pressed')).toBe('true')
    expect((await wire.ask('app.current')).page).toEqual({ page: 'checks' })
  })
})

/** A gateway that keeps whoever subscribed, and says a client is connected. */
function gateway() {
  let handler: ((request: AgentRequest) => Promise<AgentAnswer>) | undefined
  const connected = { kind: 'connected' as const, port: 51733, token: 't'.repeat(24), client: { name: 'Claude Code', version: '2.0' } }
  const held: AgentGateway = {
    id: 'fake',
    on(next) {
      handler = next
      return () => { if (handler === next) handler = undefined }
    },
    status: () => Promise.resolve(connected),
    onStatus: () => () => {},
    configure: () => Promise.resolve(connected),
    newToken: () => Promise.resolve(connected),
  }
  let n = 0
  const ask = async (tool: string, args: unknown = {}): Promise<Record<string, unknown>> => {
    if (!handler) throw new Error('nobody is listening')
    const answer = await handler({ id: `r${++n}`, tool, args })
    if (!answer.ok || answer.content[0].type !== 'text') throw new Error(`refused: ${JSON.stringify(answer)}`)
    return JSON.parse(answer.content[0].text) as Record<string, unknown>
  }
  return { gateway: held, ask, bound: () => handler !== undefined }
}
