// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * An actor as a unit, in its inspector (ADR-0036 §3, §4, §12), over one
 * fictional organisation — Acme Logistics — with its operating model at the
 * root and a customer domain below: what the section says, and each change it
 * makes as the one command it is, applied by the model's own writer.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useRef, useState } from 'react'
import { renderShell } from '../testing/renderShell'
import { translator } from '../../i18n'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import { fromArrays, toArrays } from '../../model/normalised'
import type { Role, UnitType } from '../../model/operatingModel'
import { apply } from '../../model/reducer'
import type { DesignElement } from '../../model/types'
import type { Assignment } from '../../model/units'
import type { Person } from '../../people/person'
import { DEFAULT_POLICY } from '../../people/policy'
import { changePeople } from '../../people/register'
import type { PeopleChange } from '../../people/register'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { indexScopes } from '../../projects/scopeIndex'
import { assignmentOf, assignmentPatch, formOf, shareFrom } from './AssignDialog'
import { organisationHere } from './organisationHere'
import { UnitSection } from './UnitSection'

afterEach(() => cleanup())

const s = translator('en')
const TODAY = '2026-10-11'

const domain: UnitType = { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [{ role: 'ro-owner', min: 1, max: 1 }] }
const team: UnitType = {
  id: 'ut-team', name: 'Team', within: ['ut-domain'], limit: 1,
  slots: [{ role: 'ro-po', min: 1, max: 1 }, { role: 'ro-dev', min: 2, max: 3 }],
}
const roles: Role[] = [
  { id: 'ro-owner', name: 'Domain owner', duties: [], manages: true },
  { id: 'ro-po', name: 'Product owner', duties: [], manages: true },
  { id: 'ro-dev', name: 'Developer', duties: [] },
  { id: 'ro-coach', name: 'Team coach', duties: [] },
]
const actor = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})
const app = (id: string, name: string, partyId: string): DesignElement => ({
  id, kind: 'application', name, partyId, lifecycle: 'live', isManaged: true, aspects: {},
})
const as = (id: string, unitId: string, roleId: string, person: string, over: Partial<Assignment> = {}): Assignment => ({
  id, unitId, roleId, person: { person }, ...over,
})

const ROOT: HostModel = { name: 'Acme Logistics', elements: [], relations: [], diagrams: [], unitTypes: [domain, team], roles }
const CUSTOMER: HostModel = {
  name: 'Customer',
  elements: [
    actor('customer', 'Customer', { unitTypeId: 'ut-domain' }),
    actor('webshop', 'Webshop', { unitTypeId: 'ut-team', parentId: 'customer' }),
    actor('stakeholders', 'Stakeholders'),
    app('shop', 'Shop', 'webshop'), app('orders', 'Orders', 'webshop'),
    { id: 'sell', kind: 'function', name: 'Sell online', lifecycle: 'live', isManaged: false, aspects: {} },
  ],
  relations: [{ id: 'r1', type: 'assigned', sourceId: 'webshop', targetId: 'sell' }],
  diagrams: [],
  assignments: [
    as('as-1', 'customer', 'ro-owner', 'pe-ada'),
    as('as-2', 'webshop', 'ro-po', 'pe-femke'),
    as('as-3', 'webshop', 'ro-dev', 'pe-bram', { share: 0.5 }),
    as('as-4', 'webshop', 'ro-coach', 'pe-gijs', { acting: true }),
  ],
}
const PEOPLE: Person[] = [
  { id: 'pe-ada', name: 'Ada Verbeek', pseudonym: 'BCDF', kind: 'internal', state: 'active' },
  { id: 'pe-femke', name: 'Femke Bos', pseudonym: 'CDFG', kind: 'internal', state: 'active' },
  { id: 'pe-bram', name: 'Bram de Wit', pseudonym: 'DFGH', kind: 'internal', state: 'active' },
  { id: 'pe-gijs', name: 'Gijs Mulder', pseudonym: 'FGHJ', kind: 'internal', state: 'active' },
  { id: 'pe-ivo', name: 'Ivo Peters', pseudonym: 'GHJK', kind: 'internal', state: 'active' },
]

/** The section over a model held here, changed by the model's own writer, and a register held here too. */
function Harness({ unit = 'webshop', readOnly = false, model: start = CUSTOMER, scope = 'customer', root = ROOT, commands }: {
  unit?: string; readOnly?: boolean; model?: HostModel; scope?: string; root?: HostModel; commands: Command[]
}) {
  const [model, setModel] = useState(start)
  const [people, setPeople] = useState<readonly Person[]>(PEOPLE)
  const heldPeople = useRef<readonly Person[]>(PEOPLE)
  const index = indexScopes([{ path: '', model: root }, { path: 'customer', model: CUSTOMER }])
  const dispatch = (command: Command) => {
    commands.push(command)
    const result = apply(fromArrays(model), command)
    if (!result.ok) return undefined
    const next = toArrays(result.model)
    setModel(next)
    return next
  }
  const change = (work: PeopleChange) => {
    const answer = changePeople(heldPeople.current, work, { id: () => 'pe-new', pseudonym: () => 'NNZZ' })
    if ('refused' in answer) return Promise.resolve(answer)
    heldPeople.current = answer.people
    setPeople(answer.people)
    return Promise.resolve({ person: answer.people.find((one) => one.id === answer.changed[0])!, ended: 0, removed: [] })
  }
  const register: PeopleRegisterAccess = {
    people, policy: DEFAULT_POLICY, me: 'pe-femke', readOnly: false, today: TODAY,
    add: (one) => change({ kind: 'add', person: one }),
    change: (id, patch) => change({ kind: 'change', id, patch }),
    leave: (id, on) => change({ kind: 'leave', id, on }),
    forget: (id, on) => change({ kind: 'forget', id, on }),
    remove: (id) => change({ kind: 'remove', id }),
    merge: (from, into) => change({ kind: 'merge', from, into }),
    setPolicy: () => Promise.resolve(),
    setMe: () => Promise.resolve(),
    mentionsOf: () => Promise.resolve([]),
  }
  const element = model.elements.find((one) => one.id === unit)!
  return (
    <UnitSection
      element={element} readOnly={readOnly} scope={scope} model={model} index={index} dispatch={dispatch}
      makeId={(prefix) => `${prefix}-new`} people={register} today={TODAY}
      scopeLabel={(path) => (path === '' ? 'the organisation' : path === 'customer' ? 'Customer' : path)}
      scopes={['', 'customer', 'shipping']} s={s}
    />
  )
}

const text = (id: string) => screen.getByTestId(id).textContent

describe('a unit in its inspector', () => {
  it('says its type, where it is filed and serves, what it owns and answers for', () => {
    renderShell(<Harness commands={[]} />)
    expect((screen.getByTestId('unit-type') as HTMLInputElement).value).toBe('ut-team')
    expect(screen.getByTestId('unit-serves').textContent).toBe('Customer')
    expect(text('unit-owns')).toBe('Orders, Shop')
    expect(screen.getByText('Sell online')).toBeTruthy()
    expect(screen.getByText('A Team serves one domain.')).toBeTruthy()
  })

  it('lists who holds each role today, by the register\'s names, with shares, acting and you', () => {
    renderShell(<Harness commands={[]} />)
    const holders = screen.getAllByTestId('unit-holder').map((chip) => chip.textContent)
    expect(holders).toEqual(['Femke Bos · you', 'Bram de Wit · 50%', 'Team coach: Gijs Mulder · acting'])
    expect(within(screen.getByTestId('unit-slot-ro-dev')).getAllByTestId('unit-vacant')).toHaveLength(1)
    expect(within(screen.getByTestId('unit-slot-ro-po')).queryByTestId('unit-assign')).toBeNull()
  })

  it('says who manages it, nearest first, and that core grants nothing from it', () => {
    renderShell(<Harness commands={[]} />)
    expect(screen.getAllByTestId('unit-manager').map((line) => line.textContent)).toEqual([
      'Femke Bos — Product owner, Webshop · you', 'Ada Verbeek — Domain owner, Customer',
    ])
  })

  it('says what the checks find in it', () => {
    renderShell(<Harness commands={[]} />)
    const said = screen.getAllByTestId('unit-finding').map((line) => line.textContent)
    expect(said).toContain('Webshop is short of Developer: 1 hold the role, and its type asks for at least 2')
    expect(said).toContain('Webshop owns 2 applications, and a Team owns at most 1')
  })

  it('puts someone in a vacant role as one step: an assignment holding their id', async () => {
    const commands: Command[] = []
    renderShell(<Harness commands={commands} />)
    fireEvent.click(within(screen.getByTestId('unit-slot-ro-dev')).getByTestId('unit-vacant'))
    const dialog = await screen.findByTestId('assign-dialog')
    expect(within(dialog).getByText('Developer in Webshop')).toBeTruthy()
    fireEvent.click(within(dialog).getByTestId('person-pick-pe-ivo'))
    fireEvent.change(within(dialog).getByTestId('assign-share'), { target: { value: '50' } })
    fireEvent.click(within(dialog).getByTestId('assign-save'))
    expect(commands).toEqual([{
      type: 'assignment.add',
      assignment: { id: 'as-new', unitId: 'webshop', roleId: 'ro-dev', person: { person: 'pe-ivo' }, share: 0.5, from: TODAY },
    }])
    await waitFor(() => expect(screen.queryByTestId('assign-dialog')).toBeNull())
    expect(within(screen.getByTestId('unit-slot-ro-dev')).queryByTestId('unit-vacant')).toBeNull()
  })

  it('ends an assignment on today, as a correction of its last day', async () => {
    const commands: Command[] = []
    renderShell(<Harness commands={commands} />)
    fireEvent.click(screen.getAllByTestId('unit-holder')[1])
    fireEvent.click(await screen.findByTestId('assign-end'))
    expect(commands).toEqual([{ type: 'assignment.update', id: 'as-3', patch: { until: TODAY } }])
  })

  it('corrects an assignment with what changed, and removes one made by mistake', async () => {
    const commands: Command[] = []
    renderShell(<Harness commands={commands} />)
    fireEvent.click(screen.getAllByTestId('unit-holder')[1])
    fireEvent.change(await screen.findByTestId('assign-share'), { target: { value: '100' } })
    fireEvent.click(screen.getByTestId('assign-save'))
    expect(commands).toEqual([{ type: 'assignment.update', id: 'as-3', patch: { share: undefined } }])
    await waitFor(() => expect(screen.queryByTestId('assign-dialog')).toBeNull())
    fireEvent.click(screen.getAllByTestId('unit-holder')[0])
    fireEvent.click(await screen.findByTestId('assign-remove'))
    expect(commands[1]).toEqual({ type: 'assignment.remove', id: 'as-2' })
  })

  it('changes its type, a domain it serves and a role beyond its type as element updates', async () => {
    const commands: Command[] = []
    renderShell(<Harness unit="customer" commands={commands} />)
    fireEvent.mouseDown(within(screen.getByTestId('unit-section')).getAllByRole('combobox')[0])
    fireEvent.click(await screen.findByRole('option', { name: 'Team' }))
    expect(commands[0]).toEqual({ type: 'element.update', id: 'customer', patch: { unitTypeId: 'ut-team' } })
    cleanup()
    const spanning: HostModel = { ...ROOT, unitTypes: [domain, { ...team, spans: true }] }
    renderShell(<Harness root={spanning} commands={commands} />)
    fireEvent.mouseDown(within(screen.getByTestId('unit-section')).getAllByRole('combobox')[1])
    fireEvent.click(await screen.findByRole('option', { name: 'shipping' }))
    expect(commands[1]).toEqual({ type: 'element.update', id: 'webshop', patch: { scopes: ['customer', 'shipping'] } })
    fireEvent.mouseDown(within(screen.getByTestId('unit-section')).getAllByRole('combobox')[2])
    fireEvent.click(await screen.findByRole('option', { name: 'Team coach' }))
    expect(commands[2]).toEqual({ type: 'element.update', id: 'webshop', patch: { extraSlots: [{ role: 'ro-coach', min: 0, max: 1 }] } })
    // The coach held outside the type's slots now holds an extra one.
    expect(within(screen.getByTestId('unit-slot-ro-coach')).getAllByTestId('unit-holder')).toHaveLength(1)
    fireEvent.click(within(screen.getByTestId('unit-serves')).getAllByTestId('CancelIcon')[1])
    expect(commands[3]).toEqual({ type: 'element.update', id: 'webshop', patch: { scopes: ['customer'] } })
  })

  it('makes a stakeholder a unit by giving it a type, and says what a unit is until then', async () => {
    const commands: Command[] = []
    renderShell(<Harness unit="stakeholders" commands={commands} />)
    expect(screen.getByText(/An actor with a type is a unit/)).toBeTruthy()
    expect(screen.queryByTestId('unit-owns')).toBeNull()
  })

  it('only reads a unit in a scope that is read, and one another scope answers for', () => {
    renderShell(<Harness readOnly commands={[]} />)
    expect(text('unit-type')).toBe('Team')
    expect(screen.queryByTestId('unit-assign')).toBeNull()
    cleanup()
    const standIn: HostModel = { ...CUSTOMER, elements: [actor('webshop', 'Webshop', { ref: 'customer', unitTypeId: 'ut-team' })] }
    renderShell(<Harness model={standIn} scope="customer/web" commands={[]} />)
    expect(screen.getByText('Kept in Customer: its people are changed there.')).toBeTruthy()
  })
})

describe('the assign form', () => {
  it('reads a share in per cent as a fraction, and all of it as nothing', () => {
    expect(shareFrom('50')).toBe(0.5)
    expect(shareFrom('100')).toBeUndefined()
    expect(shareFrom('nonsense')).toBeUndefined()
  })

  it('opens on an assignment\'s own values, and says the patch of what changed', () => {
    const held = as('as-9', 'webshop', 'ro-dev', 'pe-bram', { share: 0.5, from: '2026-01-01', acting: true })
    const form = formOf({ mode: 'edit', assignment: held }, TODAY)
    expect(form).toEqual({ roleId: 'ro-dev', person: 'pe-bram', share: '50', from: '2026-01-01', until: '', acting: true })
    const next = assignmentOf({ ...form, person: 'pe-ivo', until: '2026-12-31', acting: false }, 'as-9', 'webshop')!
    expect(assignmentPatch(held, next)).toEqual({ until: '2026-12-31', acting: undefined, person: { person: 'pe-ivo' } })
    expect(assignmentOf({ ...form, person: undefined }, 'as-9', 'webshop')).toBeUndefined()
  })
})

describe('the organisation as the open scope has it', () => {
  it('lays the session\'s units and assignments over the index\'s', () => {
    const index = indexScopes([{ path: '', model: ROOT }, { path: 'customer', model: CUSTOMER }])
    const now: HostModel = { ...CUSTOMER, assignments: [as('as-9', 'webshop', 'ro-dev', 'pe-ivo')] }
    const here = organisationHere(index, 'customer', now)
    expect(here.organisation.assignments.map((one) => one.id)).toEqual(['as-9'])
    expect(here.assignmentAt(now.assignments![0])).toBe('customer')
    expect(here.unitAt('webshop')).toEqual({ scope: 'customer', name: 'Webshop', type: 'ut-team' })
    expect(here.owns('webshop')).toBe(2)
    expect(here.organisation.roles).toBe(index.operatingModel().roles)
    const atRoot = organisationHere(index, '', { ...ROOT, roles: [roles[0]] })
    expect(atRoot.organisation.roles).toEqual([roles[0]])
    expect(atRoot.unitAt('webshop')).toEqual({ scope: 'customer', name: 'Webshop', type: 'ut-team' })
  })
})
