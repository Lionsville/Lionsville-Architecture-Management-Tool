// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * What a unit type or a role that ends leaves to decide, on the operating
 * model's page (ADR-0036 §6), over Acme Logistics: the release manager's role
 * ends at the year's end and is followed by the cluster lead, and the team
 * type ends on the same day. The role's people are listed with the successor
 * in the same unit and moved across the scopes that keep them in one write;
 * the type's units are listed, and nothing is guessed for them. And the
 * cluster type stops holding the release manager today: its people are
 * listed first, and the role is taken out with their moves in one write.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { axeFindings } from '../testing/axe'
import { renderShell } from '../testing/renderShell'
import { translator } from '../../i18n'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import type { Role, UnitType } from '../../model/operatingModel'
import type { DesignElement } from '../../model/types'
import type { Assignment } from '../../model/units'
import type { Person } from '../../people/person'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { indexScopes } from '../../projects/scopeIndex'
import { EndedHolders, SlotHolders } from './EndedHolders'

afterEach(() => cleanup())

const s = translator('en')
const EVE = '2026-12-31'
const cluster: UnitType = { id: 'ut-cluster', name: 'Cluster', top: true, within: [], slots: [{ role: 'ro-lead', min: 1, max: 1 }, { role: 'ro-rel', min: 0, max: 1 }] }
const team: UnitType = { id: 'ut-team', name: 'Team', within: ['ut-cluster'], slots: [{ role: 'ro-po', min: 1, max: 1 }], until: EVE }
const roles: Role[] = [
  { id: 'ro-lead', name: 'Cluster lead', duties: [] },
  { id: 'ro-rel', name: 'Release manager', duties: [], until: EVE, successors: ['ro-lead'] },
  { id: 'ro-po', name: 'Product owner', duties: [] },
]
const actor = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})
const as = (id: string, unitId: string, roleId: string, person: string): Assignment => ({ id, unitId, roleId, person: { person } })
const ROOT: HostModel = {
  name: 'Acme Logistics', elements: [actor('data', 'Data & Integration', { unitTypeId: 'ut-cluster' })], relations: [], diagrams: [],
  unitTypes: [cluster, team], roles, assignments: [as('as-9', 'data', 'ro-rel', 'pe-eva')],
}
const SHIPPING: HostModel = {
  name: 'Shipping',
  elements: [actor('parcel', 'Parcel', { unitTypeId: 'ut-cluster' }), actor('tracking', 'Tracking', { unitTypeId: 'ut-team', parentId: 'parcel' })],
  relations: [], diagrams: [],
  assignments: [as('as-1', 'parcel', 'ro-rel', 'pe-joost'), as('as-2', 'tracking', 'ro-po', 'pe-lisa')],
}
const PEOPLE: Person[] = [
  { id: 'pe-eva', name: 'Eva Lind', pseudonym: 'BCDF', kind: 'internal', state: 'active' },
  { id: 'pe-joost', name: 'Joost Vermeer', pseudonym: 'CDFG', kind: 'internal', state: 'active' },
  { id: 'pe-lisa', name: 'Lisa Jansen', pseudonym: 'DFGH', kind: 'internal', state: 'active' },
]
const index = indexScopes([{ path: '', model: ROOT }, { path: 'shipping', model: SHIPPING }])
const register = { people: PEOPLE } as unknown as PeopleRegisterAccess

function show(item: Parameters<typeof EndedHolders>[0]['item'], landed: Map<string, readonly Command[]>[]) {
  let made = 0
  renderShell(
    <EndedHolders item={item} scope="" model={ROOT} index={index} people={register} readOnly={false}
      makeId={(prefix) => `${prefix}-new-${(made += 1)}`}
      land={(steps) => { landed.push(new Map(steps)); return Promise.resolve({ ok: true, changed: [...steps.keys()], ended: 2, begun: 2 }) }}
      s={s} />,
  )
}

describe('what an ending leaves to decide', () => {
  it('lists a role\'s people with its successor in the same unit, and writes them in every scope that keeps one, together', async () => {
    const landed: Map<string, readonly Command[]>[] = []
    show({ kind: 'role', item: roles[1] }, landed)
    expect(screen.getByText('Its people after 2026-12-31')).toBeTruthy()
    expect(within(screen.getByTestId('move-row-as-9')).getByRole('combobox').textContent).toBe('Cluster lead, Data & Integration — suggested')
    expect(within(screen.getByTestId('move-row-as-1')).getByRole('combobox').textContent).toBe('Cluster lead, Parcel — suggested')
    fireEvent.click(screen.getByTestId('move-write'))
    await waitFor(() => expect(landed).toHaveLength(1))
    expect([...landed[0].keys()]).toEqual(['shipping', ''])
    expect(landed[0].get('shipping')).toEqual([
      { type: 'assignment.update', id: 'as-1', patch: { until: EVE } },
      { type: 'assignment.add', assignment: { id: 'as-new-1', unitId: 'parcel', roleId: 'ro-lead', person: { person: 'pe-joost' }, from: '2027-01-01' } },
    ])
    expect((await screen.findByTestId('move-said')).textContent).toContain('One step in each of 2 scopes')
  })

  it('lists the units still of a type that ends, with who holds a role in each, and guesses nothing', () => {
    show({ kind: 'unitType', item: team }, [])
    expect(screen.getByTestId('operating-ended-unit').textContent).toBe('Tracking: Lisa Jansen (Product owner)')
    expect(screen.queryByTestId('move-people')).toBeNull()
  })

  it('says nothing of one that does not end', () => {
    show({ kind: 'role', item: roles[0] }, [])
    expect(screen.queryByTestId('operating-ended')).toBeNull()
  })
})

describe('a role taken out of a unit type', () => {
  const TODAY = '2026-10-11'
  function showSlot(type: UnitType, landed: Map<string, readonly Command[]>[], onDone = () => {}) {
    let made = 0
    renderShell(
      <SlotHolders type={type} roleId="ro-rel" today={TODAY} onDone={onDone} scope="" model={ROOT} index={index} people={register} readOnly={false}
        makeId={(prefix) => `${prefix}-new-${(made += 1)}`}
        land={(steps) => { landed.push(new Map(steps)); return Promise.resolve({ ok: true, changed: [...steps.keys()], ended: 2, begun: 2 }) }}
        s={s} />,
    )
  }

  it('lists who holds it through the type before it goes, and takes it out with their moves as one write', async () => {
    const landed: Map<string, readonly Command[]>[] = []
    showSlot(cluster, landed)
    expect(screen.getByText('Taking Release manager out of this type')).toBeTruthy()
    expect(screen.getByText(/Their last day in it is today, 2026-10-11/)).toBeTruthy()
    const row = screen.getByTestId('move-row-as-1')
    expect(within(row).getByRole('combobox').textContent).toBe('Cluster lead, Parcel — suggested')
    expect(row.textContent).toContain('Its type no longer holds Release manager')
    expect(within(screen.getByTestId('move-row-as-9')).getByRole('combobox').textContent).toBe('Cluster lead, Data & Integration — suggested')
    expect(await axeFindings()).toEqual([])
    fireEvent.click(screen.getByTestId('move-write'))
    await waitFor(() => expect(landed).toHaveLength(1))
    expect([...landed[0].keys()]).toEqual(['shipping', ''])
    expect(landed[0].get('')).toEqual([
      { type: 'unitType.update', id: 'ut-cluster', patch: { slots: [{ role: 'ro-lead', min: 1, max: 1 }] } },
      { type: 'assignment.update', id: 'as-9', patch: { until: TODAY } },
      { type: 'assignment.add', assignment: { id: 'as-new-2', unitId: 'data', roleId: 'ro-lead', person: { person: 'pe-eva' }, from: '2026-10-12' } },
    ])
    expect(landed[0].get('shipping')).toEqual([
      { type: 'assignment.update', id: 'as-1', patch: { until: TODAY } },
      { type: 'assignment.add', assignment: { id: 'as-new-1', unitId: 'parcel', roleId: 'ro-lead', person: { person: 'pe-joost' }, from: '2026-10-12' } },
    ])
    expect((await screen.findByTestId('move-said')).textContent).toContain('One step in each of 2 scopes')
  })

  it('keeps the role on Keep, and once it is taken out says so and writes the type no more', async () => {
    const done = vi.fn()
    showSlot(cluster, [], done)
    fireEvent.click(screen.getByRole('button', { name: 'Keep Release manager' }))
    expect(done).toHaveBeenCalledOnce()
    cleanup()
    const landed: Map<string, readonly Command[]>[] = []
    showSlot({ ...cluster, slots: [cluster.slots[0]] }, landed, done)
    expect(screen.getByText('Release manager is taken out of this type')).toBeTruthy()
    fireEvent.click(screen.getByTestId('move-write'))
    await waitFor(() => expect(landed).toHaveLength(1))
    expect(landed[0].get('')?.some((one) => one.type === 'unitType.update')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(done).toHaveBeenCalledTimes(2)
  })
})
