// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Deleting a unit says what goes and offers ending first (ADR-0036, amended
 * 12 October 2026; 3.6.2), in the app: on a board, the remove-or-delete
 * question leads with *End on a day…*, names who stops being what, asks where
 * the units inside go — another unit of its type where theirs may not sit in
 * its parent — and says what else goes; Delete lands it over every scope it
 * writes, the units inside moved, the applications' team cleared and the rows
 * kept elsewhere taken away. The agent's `element.remove` is refused with the
 * choices named, and does the same with `units`.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'
import { laidOut } from '../model/testFixtures'
import type { DesignElement } from '../model/types'
import type { HostCommand } from '../platform/hostCommands'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSnapshot } from '../projects/scope'
import { axeFindings } from './testing/axe'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

configure({ asyncUtilTimeout: 5_000 })
beforeAll(() => installReactFlowMocks())
afterEach(() => cleanup())

const TODAY = () => '2026-10-12'

const actor = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})

/**
 * Two divisions at the top, a team in the first kept here and another kept
 * in Shipping — a team may sit only in a division — an application of
 * Shipping's whose team is the first division, and a capability of
 * Shipping's it answers for, its row kept there.
 */
function organisation(): ScopeSnapshot[] {
  return [
    {
      path: '',
      model: {
        name: 'Acme Logistics',
        elements: [
          actor('north', 'North', { unitTypeId: 'ut-division', scopes: ['shipping'] }),
          actor('south', 'South', { unitTypeId: 'ut-division' }),
          actor('booking', 'Booking', { unitTypeId: 'ut-team', parentId: 'north' }),
        ],
        relations: [],
        diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'Board', placements: [{ id: 'north', x: 0, y: 0 }, { id: 'south', x: 300, y: 0 }] })],
        unitTypes: [
          { id: 'ut-division', name: 'Division', top: true, within: [], slots: [] },
          { id: 'ut-team', name: 'Team', within: ['ut-division'], slots: [] },
        ],
        roles: [{ id: 'ro-lead', name: 'Lead', duties: [] }],
        assignments: [{ id: 'as-1', unitId: 'north', roleId: 'ro-lead', person: { person: 'pe-ada' } }],
      },
      activeDiagramId: 'd1',
      logoLibrary: [],
    },
    {
      path: 'shipping',
      model: {
        name: 'Shipping',
        elements: [
          actor('rates', 'Rates', { unitTypeId: 'ut-team', parentId: 'north' }),
          { id: 'tms', kind: 'application', name: 'TMS', lifecycle: 'live', isManaged: true, aspects: {}, partyId: 'north' },
          { id: 'book', kind: 'function', name: 'Book freight', lifecycle: 'live', isManaged: false, aspects: {} },
        ],
        relations: [{ id: 'r-north-book', type: 'assigned', sourceId: 'north', targetId: 'book' }],
        diagrams: [],
      },
      activeDiagramId: '',
      logoLibrary: [],
    },
  ]
}

function show(scopes: ScopeSnapshot[], agent?: AgentGateway) {
  const listeners: ((command: HostCommand) => void)[] = []
  const held = heldRepositories(scopes)
  renderApp({
    repositories: held, today: TODAY, ...(agent ? { agent } : {}),
    boot: { initialProject: scopes[0] },
    host: {
      commands: (listener) => {
        listeners.push(listener)
        return () => { listeners.splice(listeners.indexOf(listener), 1) }
      },
    },
  })
  return { held, send: (command: HostCommand) => act(() => { for (const one of [...listeners]) one(command) }) }
}

async function askToDelete(id: string) {
  const card = await waitFor(() => {
    const found = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)
    expect(found, id).not.toBeNull()
    return found!
  })
  card.focus()
  fireEvent.keyDown(card, { key: 'Enter' })
  fireEvent.click(await screen.findByRole('button', { name: 'Remove / delete…' }))
  return screen.findByRole('dialog')
}

describe('deleting a unit on a board', { timeout: 20_000 }, () => {
  it('offers ending first, asks where the units inside go, says what else goes, and lands it in every scope', async () => {
    const { held, send } = show(organisation())
    const dialog = await askToDelete('north')
    const parts = await within(dialog).findByTestId('unit-deletion')
    // Ending first, and Delete for a mistake.
    expect(within(parts).getByTestId('unit-delete-end').textContent).toBe('End on a day…')
    expect(parts.textContent).toContain('Delete is for a unit made by mistake.')
    // A team may not sit at the top, so South — another division — is chosen, every choice shown, Up marked.
    expect(within(parts).getByTestId('unit-delete-inside').textContent).toContain('Inside it: Booking, Rates')
    expect(within(parts).getByTestId('unit-delete-into').querySelector('input')?.checked).toBe(true)
    expect(within(parts).getByTestId('unit-delete-up').textContent).toContain('would show as misplaced')
    expect(within(parts).getByTestId('unit-delete-also').textContent).toContain('1 application names it as its team')
    expect(within(parts).getByTestId('unit-delete-also').textContent).toContain('It is responsible for 1 capability')
    expect(await axeFindings()).toEqual([])

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete from model' }))
    // Shipping's part, written as that scope's step: its team moved, the application's team cleared, the row gone.
    await waitFor(async () => {
      const shipping = (await held.read('shipping'))!.model
      expect(shipping.elements.find((one) => one.id === 'rates')?.parentId).toBe('south')
    })
    const shipping = (await held.read('shipping'))!.model
    expect(shipping.elements.find((one) => one.id === 'tms')?.partyId).toBeUndefined()
    expect(shipping.relations).toEqual([])
    // This scope's, saved with it: the unit and its assignment gone, its team moved.
    send({ type: 'save' })
    await waitFor(async () => {
      const top = (await held.read(''))!.model
      expect(top.elements.map((one) => one.id)).toEqual(['south', 'booking'])
      expect(top.elements.find((one) => one.id === 'booking')?.parentId).toBe('south')
      expect(top.assignments ?? []).toEqual([])
    })
  })

  it('moves them up by default where their type may sit there, the other choices folded, and deletes them too when asked', async () => {
    const scopes = organisation()
    scopes[0].model.unitTypes = scopes[0].model.unitTypes!.map((type) => (type.id === 'ut-team' ? { ...type, top: true } : type))
    const { held, send } = show(scopes)
    const dialog = await askToDelete('north')
    const inside = await within(dialog).findByTestId('unit-delete-inside')
    expect(within(inside).getByTestId('unit-delete-up').textContent).toBe('Move them up to the top')
    expect(within(inside).queryByTestId('unit-delete-too')).toBeNull()
    fireEvent.click(within(inside).getByTestId('unit-delete-more'))
    fireEvent.click(within(inside).getByTestId('unit-delete-too').querySelector('input')!)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete from model' }))
    await waitFor(async () => expect((await held.read('shipping'))!.model.elements.map((one) => one.id)).toEqual(['tms', 'book']))
    send({ type: 'save' })
    await waitFor(async () => expect((await held.read(''))!.model.elements.map((one) => one.id)).toEqual(['south']))
  })

  it('ends it on a day instead, from the question, and deletes nothing', async () => {
    const { held, send } = show(organisation())
    const dialog = await askToDelete('south')
    fireEvent.click(within(dialog).getByTestId('unit-delete-end'))
    fireEvent.change(within(dialog).getByTestId('unit-delete-last-day'), { target: { value: '2026-12-31' } })
    fireEvent.click(within(dialog).getByTestId('unit-delete-end-it'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    send({ type: 'save' })
    await waitFor(async () => expect((await held.read(''))!.model.elements.find((one) => one.id === 'south')?.lifecycleDates)
      .toEqual({ retired: '2027-01-01' }))
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
  const ask = async (tool: string, args: unknown = {}) => {
    if (!handler) throw new Error('nobody is listening')
    return handler({ id: `r${++n}`, tool, args })
  }
  return { gateway: held, ask, bound: () => handler !== undefined }
}

describe('element.remove on a unit, from an agent', { timeout: 20_000 }, () => {
  it('is refused with the choices named where the units inside may not move up, and lands across scopes with units', async () => {
    const agent = gateway()
    const { held } = show(organisation(), agent.gateway)
    await waitFor(() => expect(agent.bound()).toBe(true))
    await screen.findByTestId('crumb-current')
    // The index has read Shipping: its team is among the units inside.
    await waitFor(async () => {
      const refusal = await agent.ask('element.remove', { id: 'north' })
      expect(refusal.ok).toBe(false)
      expect(JSON.stringify(refusal)).toContain('Rates')
    })
    const refusal = await agent.ask('element.remove', { id: 'north' })
    expect(refusal).toMatchObject({ ok: false, refusal: 'agent.unitsInside' })
    expect(JSON.stringify(refusal)).toContain('into:south')

    const done = await agent.ask('element.remove', { id: 'north', units: 'into:south' })
    expect(done.ok).toBe(true)
    const said = JSON.parse((done as unknown as { content: { text: string }[] }).content[0].text) as Record<string, unknown>
    expect(said).toMatchObject({
      removed: true, alsoChanged: ['shipping'], teamCleared: [{ id: 'tms', scope: 'shipping' }],
      unitsMoved: [{ id: 'booking', parentId: 'south' }, { id: 'rates', parentId: 'south' }],
    })
    await waitFor(async () => expect((await held.read('shipping'))!.model.elements.find((one) => one.id === 'rates')?.parentId).toBe('south'))
  })
})
