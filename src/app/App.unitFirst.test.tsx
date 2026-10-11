// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A unit's inspector puts the unit first (ADR-0036, as built 3.6.1), in the
 * app: the host says its section leads where the actor has a type, and the
 * editor draws it under the name with the element's own fields folded below
 * — on a board picked by a person, and where an agent opens the board on it
 * (ADR-0019). An actor without a type keeps the element's order, and giving
 * it one turns the inspector over.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'
import { laidOut } from '../model/testFixtures'
import type { DesignElement } from '../model/types'
import { controlSelector } from '../platform/controlNames'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSnapshot } from '../projects/scope'
import { axeFindings } from './testing/axe'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

configure({ asyncUtilTimeout: 5_000 })
beforeAll(() => installReactFlowMocks())
afterEach(() => cleanup())

const TODAY = '2026-10-11'

const actor = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})

const organisation: ScopeSnapshot = {
  path: '',
  model: {
    name: 'Acme Logistics',
    elements: [actor('dispatch', 'Dispatch', { unitTypeId: 'ut-team' }), actor('warehouse', 'Warehouse team')],
    relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'Board', placements: [{ id: 'dispatch', x: 0, y: 0 }, { id: 'warehouse', x: 300, y: 0 }] })],
    unitTypes: [{ id: 'ut-team', name: 'Team', top: true, within: [], slots: [{ role: 'ro-lead', min: 1, max: 1 }] }],
    roles: [{ id: 'ro-lead', name: 'Team lead', duties: [], manages: true }],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
}

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

const inspector = () => document.querySelector<HTMLElement>(controlSelector('board.inspector'))!
/** Whether `a` comes before `b` in the document. */
const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

async function pick(id: string) {
  const card = await waitFor(() => {
    const found = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)
    expect(found, id).not.toBeNull()
    return found!
  })
  card.focus()
  fireEvent.keyDown(card, { key: 'Enter' })
}

describe('a unit\'s inspector, unit first', { timeout: 20_000 }, () => {
  it('keeps the element\'s order for an actor without a type, and turns over once it is given one', async () => {
    renderApp({ repositories: heldRepositories([organisation]), today: () => TODAY, boot: { initialProject: organisation } })
    await pick('warehouse')
    const party = await within(inspector()).findByTestId('unit-section')
    expect(before(within(inspector()).getByRole('tablist'), party)).toBe(true)
    expect(within(inspector()).queryByTestId('element-fold')).toBeNull()
    expect(within(inspector()).queryByTestId('inspector-more')).toBeNull()
    fireEvent.change(within(party).getByTestId('unit-type'), { target: { value: 'ut-team' } })
    // A unit now: its section under the name, the element's fields folded under Element below it.
    const fold = await within(inspector()).findByTestId('element-fold')
    const unit = within(inspector()).getByTestId('unit-section')
    expect(before(within(inspector()).getByLabelText('Name'), unit)).toBe(true)
    expect(before(unit, fold)).toBe(true)
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    expect(within(unit).getByTestId('unit-filed-in').textContent).toBe('Filed in Acme Logistics')
    // Create drawing, which the board offers, is in the ⋯ beside the name.
    fireEvent.click(within(inspector()).getByRole('button', { name: 'More' }))
    expect(within(await screen.findByRole('menu', { name: 'More' })).getByRole('menuitem', { name: 'Create drawing' })).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('menu', { name: 'More' }), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'More' })).toBeNull())
    expect(await axeFindings()).toEqual([])
  })

  it('is what an agent lands on when it opens the board on a unit (ADR-0019)', async () => {
    const wire = gateway()
    renderApp({ agent: wire.gateway, repositories: heldRepositories([organisation]), today: () => TODAY, boot: { initialProject: organisation } })
    await waitFor(() => expect(wire.bound()).toBe(true))
    expect((await wire.ask('app.open', { scope: '', page: 'board', id: 'd1', select: 'dispatch' })).arrived).toBe(true)
    const unit = await within(inspector()).findByTestId('unit-section')
    expect((within(inspector()).getByLabelText('Name') as HTMLInputElement).value).toBe('Dispatch')
    expect(before(unit, within(inspector()).getByTestId('element-fold'))).toBe(true)
    expect(within(unit).getByTestId('unit-slot-ro-lead')).toBeTruthy()
  })
})
