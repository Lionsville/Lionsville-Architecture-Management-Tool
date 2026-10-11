// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A reorganisation on its plan's page (ADR-0036 §6), over one fictional
 * organisation, Acme Logistics: the Shipping domain splits its Parcel &
 * Freight cluster in two on 1 January 2027, moves its teams under the new
 * clusters and ends the role of release manager. The page lists the moves,
 * says what the plan does, draws the organisation before and after, lists the
 * people to move with their suggestions, writes them as one step — which undo
 * takes back whole — and says what is still open on the day.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { renderShell } from '../testing/renderShell'
import { translator } from '../../i18n'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import { fromArrays, toArrays } from '../../model/normalised'
import type { Model } from '../../model/normalised'
import type { Responsibility, Role, UnitType } from '../../model/operatingModel'
import { apply } from '../../model/reducer'
import type { Transition } from '../../model/transition'
import type { DesignElement } from '../../model/types'
import type { Assignment } from '../../model/units'
import type { Person } from '../../people/person'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { indexScopes } from '../../projects/scopeIndex'
import { landPeopleMoves } from './landPeopleMoves'
import { PlanMoves, PlanOrganisation } from './PlanOrganisation'

afterEach(() => cleanup())

const s = translator('en')
const SPLIT = '2027-01-01'
const EVE = '2026-12-31'

const domain: UnitType = { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [] }
const cluster: UnitType = {
  id: 'ut-cluster', name: 'Cluster', within: ['ut-domain'],
  slots: [{ role: 'ro-lead', min: 1, max: 1 }, { role: 'ro-pm', min: 1, max: 1 }, { role: 'ro-rel', min: 0, max: 1 }],
}
const team: UnitType = { id: 'ut-team', name: 'Team', within: ['ut-cluster'], slots: [{ role: 'ro-po', min: 1, max: 1 }] }
const roles: Role[] = [
  { id: 'ro-lead', name: 'Cluster lead', duties: [], manages: true },
  { id: 'ro-pm', name: 'Product manager', duties: [] },
  { id: 'ro-rel', name: 'Release manager', duties: [{ responsibility: 'rs-release', raci: 'A' }], until: EVE, successors: ['ro-lead'] },
  { id: 'ro-po', name: 'Product owner', duties: [] },
]
const responsibilities: Responsibility[] = [{ id: 'rs-release', name: 'Release to production' }]
const actor = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})
const as = (id: string, unitId: string, roleId: string, person: string, over: Partial<Assignment> = {}): Assignment => ({
  id, unitId, roleId, person: { person }, ...over,
})

const ROOT: HostModel = { name: 'Acme Logistics', elements: [], relations: [], diagrams: [], unitTypes: [domain, cluster, team], roles, responsibilities }
const PLAN: Transition = {
  id: 'tr-7', number: 7, title: 'Split Parcel & Freight', status: 'agreed', from: '2026-11-01', to: SPLIT,
  elements: [
    { elementId: 'parcel', role: 'introduces' }, { elementId: 'freight', role: 'introduces' }, { elementId: 'pf', role: 'retires' },
  ],
  moves: [{ unitId: 'tracking', parentId: 'parcel', on: SPLIT }, { unitId: 'booking', parentId: 'freight', on: SPLIT }],
  decisions: [], milestones: [], body: '',
}
const SHIPPING: HostModel = {
  name: 'Shipping',
  elements: [
    actor('shipping', 'Shipping', { unitTypeId: 'ut-domain' }),
    actor('pf', 'Parcel & Freight', { unitTypeId: 'ut-cluster', parentId: 'shipping', lifecycleDates: { retired: SPLIT }, successorId: 'parcel' }),
    actor('parcel', 'Parcel', { unitTypeId: 'ut-cluster', parentId: 'shipping', lifecycle: 'planned', lifecycleDates: { live: SPLIT } }),
    actor('freight', 'Freight', { unitTypeId: 'ut-cluster', parentId: 'shipping', lifecycle: 'planned', lifecycleDates: { live: SPLIT } }),
    actor('tracking', 'Tracking', { unitTypeId: 'ut-team', parentId: 'pf' }),
    actor('booking', 'Booking', { unitTypeId: 'ut-team', parentId: 'pf' }),
  ],
  relations: [],
  diagrams: [],
  assignments: [
    as('as-1', 'pf', 'ro-lead', 'pe-omar'),
    as('as-2', 'pf', 'ro-pm', 'pe-sanne'),
    as('as-3', 'pf', 'ro-rel', 'pe-joost'),
    as('as-4', 'tracking', 'ro-po', 'pe-lisa'),
  ],
  transitions: [PLAN],
}
const PEOPLE: Person[] = [
  { id: 'pe-omar', name: 'Omar Haddad', pseudonym: 'BCDF', kind: 'internal', state: 'active' },
  { id: 'pe-sanne', name: 'Sanne de Boer', pseudonym: 'CDFG', kind: 'internal', state: 'active' },
  { id: 'pe-joost', name: 'Joost Vermeer', pseudonym: 'DFGH', kind: 'internal', state: 'active' },
  { id: 'pe-lisa', name: 'Lisa Jansen', pseudonym: 'FGHJ', kind: 'internal', state: 'active' },
]
const register = { people: PEOPLE } as unknown as PeopleRegisterAccess
const index = indexScopes([{ path: '', model: ROOT }, { path: 'shipping', model: SHIPPING }])
let made = 0

/** The plan's two parts over a session held here, written by the model's own writer, with an undo. */
function Harness({ dispatched, opened = [] }: { dispatched: Command[]; opened?: string[] }) {
  const [model, setModel] = useState<Model>(fromArrays(SHIPPING))
  const [undo, setUndo] = useState<Command[]>([])
  const held = { current: model }
  const dispatch = (command: Command) => {
    const result = apply(held.current, command)
    if (!result.ok) return undefined
    dispatched.push(command)
    held.current = result.model
    setModel(result.model)
    setUndo((was) => [...was, result.inverse])
    return result.model
  }
  const session = { indexed: () => held.current, dispatch }
  const land = (steps: ReadonlyMap<string, readonly Command[]>) => landPeopleMoves({
    scope: 'shipping', scopes: { tree: () => Promise.reject(new Error('no other scope')) } as never, session, writable: () => true, save: () => Promise.resolve(),
  }, steps)
  const host = toArrays(model)
  const plan = host.transitions!.find((one) => one.id === 'tr-7')!
  const props = {
    plan, scope: 'shipping', model: host, index, people: register, readOnly: false, dispatch, makeId: (prefix: string) => `${prefix}-new-${(made += 1)}`,
    land, scopeLabel: (path: string) => path || 'Acme Logistics', onOpenElement: (id: string) => { opened.push(id) }, s,
  }
  return (
    <>
      <PlanMoves {...props} />
      <PlanOrganisation {...props} />
      <button type="button" data-testid="undo" onClick={() => {
        const last = undo[undo.length - 1]
        if (last) dispatch(last)
        setUndo((was) => was.slice(0, -2))
      }}>undo</button>
    </>
  )
}

const lines = (id: string) => screen.getAllByTestId(id).map((one) => one.textContent)

describe('a reorganisation on its plan\'s page', () => {
  it('lists the units it moves, and adds and takes a move away as a change to the plan', () => {
    const dispatched: Command[] = []
    renderShell(<Harness dispatched={dispatched} />)
    expect(screen.getByTestId('plan-move-tracking').textContent).toBe('Tracking under Parcel from 2027-01-01')
    fireEvent.change(screen.getByTestId('plan-move-unit'), { target: { value: 'booking' } })
    fireEvent.change(screen.getByTestId('plan-move-parent'), { target: { value: 'parcel' } })
    fireEvent.click(screen.getByTestId('plan-move-add'))
    expect(dispatched).toEqual([{
      type: 'transition.update', id: 'tr-7',
      patch: { moves: [{ unitId: 'tracking', parentId: 'parcel', on: SPLIT }, { unitId: 'booking', parentId: 'parcel', on: SPLIT }] },
    }])
    fireEvent.click(within(screen.getByTestId('plan-move-booking')).getByRole('button'))
    expect(dispatched[1]).toEqual({ type: 'transition.update', id: 'tr-7', patch: { moves: [{ unitId: 'tracking', parentId: 'parcel', on: SPLIT }] } })
  })

  it('offers no parent below the unit on the move\'s day: that would be a loop', () => {
    renderShell(<Harness dispatched={[]} />)
    // Tracking moves under Parcel on the plan's day, so Parcel under Tracking then is a loop.
    fireEvent.change(screen.getByTestId('plan-move-unit'), { target: { value: 'parcel' } })
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1])
    const offered = screen.getAllByRole('option').map((one) => one.textContent)
    expect(offered).toContain('Booking')
    expect(offered).not.toContain('Tracking')
    expect(offered).not.toContain('Parcel')
  })

  it('says what it does, and draws the organisation the day before and on its day', () => {
    renderShell(<Harness dispatched={[]} />)
    expect(lines('plan-does')).toEqual([
      'Introduces Parcel (Cluster) on 2027-01-01',
      'Introduces Freight (Cluster) on 2027-01-01',
      'Retires Parcel & Freight: its last day is 2026-12-31',
      'Tracking under Parcel from 2027-01-01',
      'Booking under Freight from 2027-01-01',
      'Ends the role Release manager on 2026-12-31; followed by Cluster lead',
    ])
    expect(within(screen.getByTestId('plan-before')).getByTestId('plan-before-pf').textContent).toContain('ends')
    expect(within(screen.getByTestId('plan-before')).getByTestId('plan-before-pf').textContent)
      .toContain('Cluster lead: Omar Haddad · Product manager: Sanne de Boer · Release manager: Joost Vermeer')
    const after = screen.getByTestId('plan-after')
    expect(within(after).queryByTestId('plan-after-pf')).toBeNull()
    expect(within(within(after).getByTestId('plan-after-parcel')).getByTestId('plan-after-tracking').textContent).toContain('moved')
  })

  it('lists the people to move with their suggestions, and what is still open on the day', () => {
    const opened: string[] = []
    renderShell(<Harness dispatched={[]} opened={opened} />)
    expect(screen.getAllByTestId(/^move-row-/).map((row) => row.getAttribute('data-testid'))).toEqual(['move-row-as-1', 'move-row-as-2', 'move-row-as-3'])
    expect(within(screen.getByTestId('move-row-as-3')).getByRole('combobox').textContent).toBe('Cluster lead, Parcel — suggested')
    const open = lines('plan-still-open')[0]
    expect(open).toContain('Release to production needs a new A')
    expect(open).toContain('Freight is short of Cluster lead')
    // A finding about a unit opens the unit; the lost A is a line.
    fireEvent.click(screen.getByRole('button', { name: /^Freight is short of Cluster lead/ }))
    expect(opened).toEqual(['freight'])
    expect(screen.queryByRole('button', { name: /Release to production/ })).toBeNull()
  })

  it('writes every end and beginning as one step, a row changed as chosen, and undo takes it all back', async () => {
    const dispatched: Command[] = []
    renderShell(<Harness dispatched={dispatched} />)
    fireEvent.mouseDown(within(screen.getByTestId('move-row-as-2')).getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: 'Product manager, Freight' }))
    fireEvent.click(screen.getByTestId('move-write'))
    await waitFor(() => expect(screen.getByTestId('move-said').textContent).toContain('One step: 3 ended'))
    expect(dispatched).toHaveLength(1)
    const step = dispatched[0]
    expect(step.type).toBe('transaction')
    const commands = step.type === 'transaction' ? step.commands : []
    expect(commands.filter((one) => one.type === 'assignment.add').map((one) => one.type === 'assignment.add' && [one.assignment.person.person, one.assignment.unitId, one.assignment.roleId, one.assignment.from]))
      .toEqual([['pe-omar', 'parcel', 'ro-lead', SPLIT], ['pe-sanne', 'freight', 'ro-pm', SPLIT], ['pe-joost', 'parcel', 'ro-lead', SPLIT]])
    expect(screen.getByText(s('move.nobody'))).toBeTruthy()
    fireEvent.click(screen.getByTestId('undo'))
    // Every assignment runs past the day again, and nothing new is left behind.
    await waitFor(() => expect(screen.getAllByTestId(/^move-row-/)).toHaveLength(3))
    expect(within(screen.getByTestId('plan-after')).getByTestId('plan-after-parcel').textContent).not.toContain('Omar Haddad')
  })
})
