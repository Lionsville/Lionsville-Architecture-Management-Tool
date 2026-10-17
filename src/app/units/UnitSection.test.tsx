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
import { pressAction, unfoldFindings } from '../testing/findings'
import { axeFindings } from '../testing/axe'
import { translator } from '../../i18n'
import type { Command } from '../../model/commands'
import { managesPeople } from '../../model/managing'
import type { ManagesPeople } from '../../model/managing'
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
import { checkMarking, CheckMarkingContext } from '../checkMarking'
import type { WriteIn } from './writeIn'

afterEach(() => cleanup())

/** What the checks find in the unit, the one list unfolded (3.6.1: grouped and folded, the notes hidden). */
function unitFindings(): HTMLElement[] {
  unfoldFindings(screen.getByTestId('unit-findings'))
  return screen.getAllByTestId('unit-finding')
}

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
function Harness({ unit = 'webshop', readOnly = false, model: start = CUSTOMER, scope = 'customer', root = ROOT, day, commands, register: held = PEOPLE, me = 'pe-femke', manages, more = [], writeIn, marking = false, onOpenHome, tree }: {
  unit?: string; readOnly?: boolean; model?: HostModel; scope?: string; root?: HostModel; day?: string; commands: Command[]
  onOpenHome?: (path: string) => void
  /** The scope tree offered, each by its name; absent, the organisation, the customer domain and shipping. */
  tree?: Record<string, string>
  register?: readonly Person[]; me?: string; manages?: ManagesPeople
  /** Marks as intended handed down, as the workspace hands them: this scope's through the session. */
  marking?: boolean
  /** Scopes beyond the organisation and the customer domain, or one in the customer domain's place. */
  more?: readonly { path: string; model: HostModel }[]
  writeIn?: WriteIn
}) {
  const [model, setModel] = useState(start)
  const [people, setPeople] = useState<readonly Person[]>(held)
  const heldPeople = useRef<readonly Person[]>(held)
  // A scope among `more` stands in for the one of the same path: the customer domain with lines of its own.
  const index = indexScopes([{ path: '', model: root }, ...(more.some((one) => one.path === 'customer') ? [] : [{ path: 'customer', model: CUSTOMER }]), ...more])
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
    people, policy: DEFAULT_POLICY, me, readOnly: false, today: TODAY, ...(manages ? { manages, managingRight: true } : {}),
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
  const section = (
    <UnitSection
      element={element} readOnly={readOnly} scope={scope} model={model} index={index} dispatch={dispatch}
      makeId={(prefix) => `${prefix}-new`} newRowId={() => 'i-new'} people={register} today={TODAY} {...(day !== undefined ? { day } : {})}
      scopeLabel={tree ? (path) => tree[path] ?? path : (path) => (path === '' ? 'the organisation' : path === 'customer' ? 'Customer' : path)}
      scopes={tree ? Object.keys(tree) : ['', 'customer', 'shipping']} {...(writeIn ? { writeIn } : {})} {...(onOpenHome ? { onOpenHome } : {})} s={s}
    />
  )
  if (!marking) return section
  const handed = checkMarking({ index, open: { scope, model, dispatch, writable: !readOnly }, writable: () => !readOnly, today: TODAY })
  return <CheckMarkingContext.Provider value={handed}>{section}</CheckMarkingContext.Provider>
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

  it('says who manages it, nearest first, one line each, and behind why? that core grants nothing from it', async () => {
    renderShell(<Harness commands={[]} />)
    expect(screen.getAllByTestId('unit-manager').map((line) => line.textContent)).toEqual([
      'Femke Bos — Product owner, Webshop · you', 'Ada Verbeek — Domain owner, Customer',
    ])
    // The four lines of why are not said on every unit: they are behind a native button that says whether it is open.
    const why = screen.getByRole('button', { name: 'why?' })
    expect(why.tagName).toBe('BUTTON')
    expect(why.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('unit-managed-note')).toBeNull()
    fireEvent.click(why)
    expect(why.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(why.getAttribute('aria-controls')!)?.textContent).toContain('here it is said, and grants nothing')
    expect(await axeFindings()).toEqual([])
    fireEvent.click(why)
    expect(screen.queryByTestId('unit-managed-note')).toBeNull()
  })

  // Pinned on purpose since 3.6.1, when the unit came first in its inspector:
  // who is in it and who manages it before what it serves, owns and answers
  // for, and where it is filed said under its type rather than as a section.
  it('says its parts in the order a person comes to a unit for: roles, who manages it, serves, owns, responsible for, works with', () => {
    renderShell(<Harness commands={[]} />)
    const section = screen.getByTestId('unit-section')
    const order = ['Roles, today', 'Who manages it', 'Serves', 'Owns', 'Responsible for', 'Works with']
    const at = order.map((words) => section.textContent!.indexOf(words))
    expect(at.every((one) => one >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(text('unit-filed-in')).toBe('Filed in Customer')
    // A unit's type says what it is: no Unit over it, as an actor that is not one still has.
    expect(within(section).queryByText('Unit')).toBeNull()
  })

  it('takes an id merged into an entry as that entry: you, a person\'s load and the checks count them as one', async () => {
    const merged: Person[] = [...PEOPLE, { id: 'pe-femke2', pseudonym: 'KLMN', kind: 'internal', state: 'active', mergedInto: 'pe-femke' }]
    const model: HostModel = { ...CUSTOMER, assignments: [...CUSTOMER.assignments!, as('as-5', 'webshop', 'ro-dev', 'pe-femke2', { share: 0.6 })] }
    renderShell(<Harness commands={[]} model={model} register={merged} me="pe-femke2" />)
    const holders = screen.getAllByTestId('unit-holder').map((chip) => chip.textContent)
    expect(holders).toContain('Femke Bos · you')
    expect(holders).toContain('Femke Bos · 60% · you')
    expect(screen.getAllByTestId('unit-manager')[0].textContent).toContain('· you')
    expect(unitFindings().map((line) => line.textContent)).toContain('Femke Bos holds 160% across their roles')
    fireEvent.click(within(screen.getByTestId('unit-slot-ro-dev')).getByTestId('unit-assign'))
    const dialog = await screen.findByTestId('assign-dialog')
    expect(within(dialog).getByTestId('person-pick-pe-femke').textContent).toContain('160%')
    expect(within(dialog).getByTestId('person-pick-pe-femke').textContent).toContain('you')
  })

  it('says what the checks find in it', () => {
    renderShell(<Harness commands={[]} />)
    const said = unitFindings().map((line) => line.textContent)
    expect(said).toContain('Webshop is short of Developer: 1 hold the role, and its type asks for at least 2')
    expect(said).toContain('Webshop owns 2 applications, and a Team owns at most 1')
  })

  it('leaves out of its checks a finding marked as intended in the scope that keeps it', () => {
    const model: HostModel = { ...CUSTOMER, checkMarks: [{ check: 'check.roleVacant', key: 'webshop ro-dev', on: TODAY }] }
    renderShell(<Harness commands={[]} model={model} />)
    const said = unitFindings().map((line) => line.textContent)
    expect(said).not.toContain('Webshop is short of Developer: 1 hold the role, and its type asks for at least 2')
    expect(said).toContain('Webshop owns 2 applications, and a Team owns at most 1')
  })

  it('marks a finding as intended from its explanation, as a step here, lists it under Accepted, and takes it back', async () => {
    const commands: Command[] = []
    renderShell(<Harness commands={commands} marking />)
    const list = screen.getByTestId('unit-findings')
    unfoldFindings(list)
    fireEvent.click(within(list).getByText(/^Webshop is short of Developer/))
    fireEvent.click(within(within(list).getByTestId('finding-explanation')).getByRole('button', { name: 'Mark as intended…' }))
    fireEvent.change(await screen.findByTestId('finding-mark-reason'), { target: { value: 'Hiring in November' } })
    fireEvent.click(screen.getByTestId('finding-mark-confirm'))
    expect(commands.at(-1)).toEqual({ type: 'checkMark.add', mark: { check: 'check.roleVacant', key: 'webshop ro-dev', reason: 'Hiring in November', on: TODAY } })
    await waitFor(() => expect(unitFindings().map((line) => line.textContent)).not.toContain('Webshop is short of Developer: 1 hold the role, and its type asks for at least 2'))
    fireEvent.click(within(list).getByRole('button', { name: 'Accepted (1)' }))
    expect(await axeFindings()).toEqual([])
    fireEvent.click(within(list).getByRole('button', { name: /^Take back/ }))
    expect(commands.at(-1)).toEqual({ type: 'checkMark.remove', id: 'check.roleVacant webshop ro-dev' })
    await waitFor(() => expect(unitFindings().map((line) => line.textContent)).toContain('Webshop is short of Developer: 1 hold the role, and its type asks for at least 2'))
  })

  it('offers no mark, and no Take back, where the scope is only read', () => {
    const model: HostModel = { ...CUSTOMER, checkMarks: [{ check: 'check.roleVacant', key: 'webshop ro-dev', on: TODAY }] }
    renderShell(<Harness commands={[]} model={model} readOnly marking />)
    const list = screen.getByTestId('unit-findings')
    unfoldFindings(list)
    fireEvent.click(within(list).getByText(/^Webshop owns 2 applications/))
    expect(within(list).queryByRole('button', { name: 'Mark as intended…' })).toBeNull()
    fireEvent.click(within(list).getByRole('button', { name: 'All findings' }))
    fireEvent.click(within(list).getByRole('button', { name: 'Accepted (1)' }))
    expect(within(list).queryByRole('button', { name: /^Take back/ })).toBeNull()
  })

  it('assigns someone to a role short of people from its explanation, where the role\'s people may be changed here', async () => {
    renderShell(<Harness commands={[]} />)
    const list = screen.getByTestId('unit-findings')
    unfoldFindings(list)
    fireEvent.click(within(list).getByText(/^Webshop is short of Developer/))
    const explanation = within(list).getByTestId('finding-explanation')
    expect(within(explanation).getByTestId('finding-why').textContent).toBeTruthy()
    expect(await axeFindings()).toEqual([])
    pressAction(explanation, 'Assign…')
    expect(within(await screen.findByTestId('assign-dialog')).getByText('Developer in Webshop')).toBeTruthy()
    cleanup()
    // Only read, and not a unit this person manages: the explanation, and nothing to press.
    renderShell(<Harness commands={[]} readOnly />)
    unfoldFindings(screen.getByTestId('unit-findings'))
    fireEvent.click(screen.getByText(/^Webshop is short of Developer/))
    expect(within(screen.getByTestId('finding-explanation')).queryAllByTestId(/^finding-action-/)).toEqual([])
  })

  it('ends an assignment that outlives its role from its explanation, in the dialog that ends one', async () => {
    const root: HostModel = { ...ROOT, roles: roles.map((role) => (role.id === 'ro-coach' ? { ...role, until: '2026-06-30' } : role)) }
    renderShell(<Harness commands={[]} root={root} />)
    const list = screen.getByTestId('unit-findings')
    unfoldFindings(list)
    fireEvent.click(within(list).getByText(/^Someone still holds Team coach in Webshop/))
    pressAction(within(list).getByTestId('finding-explanation'), 'End the assignment…')
    const dialog = await screen.findByTestId('assign-dialog')
    expect(within(dialog).getByText('An assignment as Team coach in Webshop')).toBeTruthy()
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
    // The domains it may serve are picked, as a scope's units are: the + opens a field to find one in.
    fireEvent.click(screen.getByTestId('unit-serves-add'))
    const field = screen.getByRole('combobox', { name: 'Find a scope' })
    // Flipped 13 October 2026: the organisation is no domain, and is not offered.
    expect(screen.getAllByRole('option').map((one) => one.textContent)).toEqual(['shipping'])
    fireEvent.change(field, { target: { value: 'ship' } })
    fireEvent.click(await screen.findByRole('option', { name: 'shipping' }))
    expect(commands[1]).toEqual({ type: 'element.update', id: 'webshop', patch: { scopes: ['customer', 'shipping'] } })
    fireEvent.mouseDown(within(screen.getByTestId('unit-section')).getAllByRole('combobox')[1])
    fireEvent.click(await screen.findByRole('option', { name: 'Team coach' }))
    expect(commands[2]).toEqual({ type: 'element.update', id: 'webshop', patch: { extraSlots: [{ role: 'ro-coach', min: 0, max: 1 }] } })
    // The coach held outside the type's slots now holds an extra one.
    expect(within(screen.getByTestId('unit-slot-ro-coach')).getAllByTestId('unit-holder')).toHaveLength(1)
    fireEvent.click(within(screen.getByTestId('unit-serves')).getAllByTestId('CancelIcon')[1])
    expect(commands[3]).toEqual({ type: 'element.update', id: 'webshop', patch: { scopes: ['customer'] } })
  })

  it('lets a one-domain unit kept at the organisation that says nothing be given its domain, which is written alone', async () => {
    const commands: Command[] = []
    // The usual organisation: the unit filed at the top, where the operating model lives.
    const top: HostModel = { ...ROOT, elements: [actor('ops', 'Operations', { unitTypeId: 'ut-domain' })] }
    renderShell(<Harness model={top} root={top} scope="" unit="ops" commands={commands} />)
    expect(text('unit-serves')).not.toContain('the organisation')
    fireEvent.click(screen.getByTestId('unit-serves-add'))
    fireEvent.click(await screen.findByRole('option', { name: 'Customer' }))
    expect(commands[0]).toEqual({ type: 'element.update', id: 'ops', patch: { scopes: ['customer'] } })
    // Its one domain now, and a type that serves one says so; the domain may be taken off again.
    expect(screen.queryByTestId('unit-serves-add')).toBeNull()
    fireEvent.click(within(screen.getByTestId('unit-serves')).getByTestId('CancelIcon'))
    expect(commands[1]).toEqual({ type: 'element.update', id: 'ops', patch: { scopes: undefined } })
    cleanup()
    renderShell(<Harness model={top} root={top} scope="" unit="ops" readOnly commands={[]} />)
    expect(text('unit-serves')).toBe('No domain')
  })

  it('offers each domain by its path, so two of one name are told apart, and finds one by its path', async () => {
    const commands: Command[] = []
    const top: HostModel = { ...ROOT, elements: [actor('ops', 'Operations', { unitTypeId: 'ut-domain' })] }
    const tree = { '': 'the organisation', north: 'North', 'north/cameras': 'Cameras', south: 'South', 'south/cameras': 'Cameras' }
    renderShell(<Harness model={top} root={top} scope="" unit="ops" tree={tree} commands={commands} />)
    fireEvent.click(screen.getByTestId('unit-serves-add'))
    expect(screen.getAllByRole('option').map((one) => one.textContent)).toEqual(['North', 'North › Cameras', 'South', 'South › Cameras'])
    fireEvent.change(screen.getByRole('combobox', { name: 'Find a scope' }), { target: { value: 'south' } })
    expect(screen.getAllByRole('option').map((one) => one.textContent)).toEqual(['South', 'South › Cameras'])
    fireEvent.click(screen.getByRole('option', { name: 'South › Cameras' }))
    expect(commands[0]).toEqual({ type: 'element.update', id: 'ops', patch: { scopes: ['south/cameras'] } })
    expect(text('unit-serves')).toBe('South › Cameras')
  })

  it('opens the home of each domain it serves, by the keyboard too', async () => {
    const opened: string[] = []
    renderShell(<Harness commands={[]} onOpenHome={(path) => opened.push(path)} />)
    const chip = screen.getByRole('button', { name: 'Customer' })
    expect(chip.getAttribute('title')).toBe('Open the home of Customer')
    fireEvent.click(chip)
    expect(opened).toEqual(['customer'])
    chip.focus()
    fireEvent.keyDown(chip, { key: 'Enter' })
    expect(opened).toEqual(['customer', 'customer'])
    expect(await axeFindings()).toEqual([])
  })

  it('offers the units it may work with in the one order for units: the type\'s rank, then the name', async () => {
    const shipping: HostModel = {
      name: 'Shipping', relations: [], diagrams: [],
      elements: [actor('zeta', 'Zeta', { unitTypeId: 'ut-domain' }), actor('accounts', 'Accounts', { unitTypeId: 'ut-team', parentId: 'zeta' })],
    }
    renderShell(<Harness more={[{ path: 'shipping', model: shipping }]} commands={[]} />)
    fireEvent.click(screen.getByTestId('unit-interaction-add'))
    const dialog = await screen.findByTestId('interact-dialog')
    fireEvent.mouseDown(within(dialog).getAllByRole('combobox')[0])
    expect(screen.getAllByRole('option').map((one) => one.textContent)).toEqual(['Customer', 'Zeta', 'Accounts'])
  })

  it('declares an interaction with another unit as one row, and corrects and removes one kept here (ADR-0036 §7)', async () => {
    const commands: Command[] = []
    renderShell(<Harness commands={commands} />)
    expect(text('unit-interactions')).toContain('No interaction declared')
    fireEvent.click(screen.getByTestId('unit-interaction-add'))
    const dialog = await screen.findByTestId('interact-dialog')
    fireEvent.mouseDown(within(dialog).getAllByRole('combobox')[0])
    fireEvent.click(await screen.findByRole('option', { name: 'Customer' }))
    fireEvent.mouseDown(within(dialog).getAllByRole('combobox')[1])
    fireEvent.click(await screen.findByRole('option', { name: 'As a service' }))
    fireEvent.change(within(dialog).getByTestId('interact-from'), { target: { value: '2026-11-01' } })
    fireEvent.click(within(dialog).getByTestId('interact-save'))
    expect(commands).toEqual([{
      type: 'relation.create',
      relation: { id: 'i-new', type: 'interacts', sourceId: 'webshop', targetId: 'customer', mode: 'service', validFrom: '2026-11-01' },
    }])
    await waitFor(() => expect(screen.queryByTestId('interact-dialog')).toBeNull())
    expect(screen.getByTestId('unit-interaction').textContent).toBe('Customer · As a service · 2026-11-01 – …')
    fireEvent.click(screen.getByTestId('unit-interaction'))
    const again = await screen.findByTestId('interact-dialog')
    fireEvent.mouseDown(within(again).getAllByRole('combobox')[1])
    fireEvent.click(await screen.findByRole('option', { name: 'Facilitating' }))
    fireEvent.click(within(again).getByTestId('interact-save'))
    expect(commands[1]).toEqual({ type: 'relation.update', id: 'i-new', patch: { mode: 'facilitating' } })
    await waitFor(() => expect(screen.queryByTestId('interact-dialog')).toBeNull())
    fireEvent.click(screen.getByTestId('unit-interaction'))
    fireEvent.click(await screen.findByTestId('interact-remove'))
    expect(commands[2]).toEqual({ type: 'relation.delete', id: 'i-new' })
  })

  it('lists an interaction another scope keeps with where it is kept, and does not change it here', () => {
    const root: HostModel = { ...ROOT, relations: [{ id: 'i-9', type: 'interacts', sourceId: 'data', targetId: 'webshop', mode: 'collaboration' }] }
    const index = indexScopes([{ path: '', model: root }, { path: 'customer', model: CUSTOMER }])
    const lines = index.rowsOf('webshop').filter(({ relation }) => relation.type === 'interacts')
    expect(lines.map(({ scope }) => scope)).toEqual([''])
    renderShell(<Harness root={root} commands={[]} />)
    // The harness indexes its own root; the row kept there is listed and is not a button.
    const chip = screen.getByTestId('unit-interaction')
    expect(chip.textContent).toContain('kept in the organisation')
    expect(chip.getAttribute('role')).not.toBe('button')
  })

  it('makes a stakeholder a unit by giving it a type, and says what a unit is until then', async () => {
    const commands: Command[] = []
    renderShell(<Harness unit="stakeholders" commands={commands} />)
    expect(screen.getByText(/An actor with a type is a unit/)).toBeTruthy()
    expect(screen.queryByTestId('unit-owns')).toBeNull()
    // An actor without a type keeps the section as it was: Unit over the choice, and nothing of a unit's.
    expect(within(screen.getByTestId('unit-section')).getByText('Unit')).toBeTruthy()
    expect(screen.queryByTestId('unit-filed-in')).toBeNull()
  })

  it('only reads a unit in a scope that is read, and one another scope answers for', () => {
    renderShell(<Harness readOnly commands={[]} />)
    expect(text('unit-type')).toBe('Team')
    expect(text('unit-filed-in')).toBe('Filed in Customer')
    expect(screen.queryByTestId('unit-assign')).toBeNull()
    cleanup()
    const standIn: HostModel = { ...CUSTOMER, elements: [actor('webshop', 'Webshop', { ref: 'customer', unitTypeId: 'ut-team' })] }
    renderShell(<Harness model={standIn} scope="customer/web" commands={[]} />)
    expect(screen.getByText('Kept in Customer: its people are changed there.')).toBeTruthy()
  })
})

/**
 * A manager where the scope is only read and the source grants a managing
 * role's right (ADR-0036 §12): the people of the units they manage, and
 * nothing else of them; a managing role only strictly below their own.
 */
describe('a unit a manager changes the people of, where the scope is only read', () => {
  const index = indexScopes([{ path: '', model: ROOT }, { path: 'customer', model: CUSTOMER }])
  const ada = () => managesPeople(index.organisation(), 'pe-ada', TODAY)

  it('assigns, corrects and ends in a unit below their own, a managing role there too, and changes nothing else of it', async () => {
    const commands: Command[] = []
    renderShell(<Harness readOnly manages={ada()} commands={commands} />)
    // The reason is behind why? since 3.6.1, said once it is asked for.
    fireEvent.click(screen.getByTestId('unit-managed-why'))
    expect(text('unit-managed-note')).toContain('they may change the people of this unit and of the units below it')
    expect(screen.queryByTestId('unit-extra-role')).toBeNull()
    expect(within(screen.getByTestId('unit-type')).queryByRole('combobox')).toBeNull()
    fireEvent.click(within(screen.getByTestId('unit-slot-ro-dev')).getByTestId('unit-vacant'))
    const dialog = await screen.findByTestId('assign-dialog')
    fireEvent.mouseDown(within(dialog).getByRole('combobox'))
    expect(screen.getAllByRole('option').map((one) => one.textContent)).toEqual(['Product owner', 'Developer'])
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
    fireEvent.click(within(dialog).getByTestId('person-pick-pe-ivo'))
    fireEvent.click(within(dialog).getByTestId('assign-save'))
    expect(commands).toEqual([{
      type: 'assignment.add', assignment: { id: 'as-new', unitId: 'webshop', roleId: 'ro-dev', person: { person: 'pe-ivo' }, from: TODAY },
    }])
    await waitFor(() => expect(screen.queryByTestId('assign-dialog')).toBeNull())
    fireEvent.click(within(screen.getByTestId('unit-slot-ro-po')).getByTestId('unit-holder'))
    fireEvent.click(await screen.findByTestId('assign-end'))
    expect(commands.at(-1)).toEqual({ type: 'assignment.update', id: 'as-2', patch: { until: TODAY } })
  })

  it('hands out no managing role in their own unit, and offers nothing in a unit they do not manage', () => {
    renderShell(<Harness unit="customer" readOnly manages={ada()} commands={[]} />)
    const owner = screen.getByTestId('unit-slot-ro-owner')
    expect(within(owner).queryByTestId('unit-assign')).toBeNull()
    fireEvent.click(within(owner).getByTestId('unit-holder'))
    expect(screen.queryByTestId('assign-dialog')).toBeNull()
    cleanup()
    const femke = managesPeople(index.organisation(), 'pe-femke', TODAY)
    renderShell(<Harness unit="customer" readOnly manages={femke} commands={[]} />)
    expect(screen.queryByTestId('unit-vacant')).toBeNull()
    expect(screen.queryByTestId('unit-assign')).toBeNull()
  })
})

/**
 * A manager reached by a reporting line (ADR-0039 §4): a solid line from a
 * role here that lands on a role they hold makes that role's people theirs to
 * change, though nesting does not bring them the unit; a dotted line brings
 * nothing. Ivo is the owner of a domain beside this one.
 */
describe('a unit whose role reports to a manager by a line, where the scope is only read', () => {
  const LINED_ROOT: HostModel = {
    ...ROOT,
    elements: [actor('platform', 'Platform', { unitTypeId: 'ut-domain' })],
    assignments: [as('as-p', 'platform', 'ro-owner', 'pe-ivo')],
  }
  const to = { scope: '', unit: 'platform', role: 'ro-owner' }
  const LINED: HostModel = {
    ...CUSTOMER,
    elements: CUSTOMER.elements.map((one) => (one.id === 'webshop'
      ? { ...one, reportingLines: [{ role: 'ro-dev', kind: 'solid' as const, to }, { role: 'ro-coach', kind: 'dotted' as const, to }] }
      : one)),
  }
  const more = [{ path: 'customer', model: LINED }]
  const ivo = () => managesPeople(indexScopes([{ path: '', model: LINED_ROOT }, ...more]).organisation(), 'pe-ivo', TODAY)

  it('offers Assign for the role a solid line reaches, and nothing for the one a dotted line reaches or the rest', async () => {
    const commands: Command[] = []
    renderShell(<Harness readOnly root={LINED_ROOT} model={LINED} more={more} me="pe-ivo" manages={ivo()} commands={commands} />)
    expect(within(screen.getByTestId('unit-slot-ro-po')).queryByTestId('unit-assign')).toBeNull()
    fireEvent.click(within(screen.getByTestId('unit-slot-ro-po')).getByTestId('unit-holder'))
    expect(screen.queryByTestId('assign-dialog')).toBeNull()
    // The coach reports by a dotted line: shown, and deciding nothing.
    fireEvent.click(screen.getByText(/Team coach: Gijs Mulder/))
    expect(screen.queryByTestId('assign-dialog')).toBeNull()
    fireEvent.click(within(screen.getByTestId('unit-slot-ro-dev')).getByTestId('unit-vacant'))
    const dialog = await screen.findByTestId('assign-dialog')
    fireEvent.mouseDown(within(dialog).getByRole('combobox'))
    expect(screen.getAllByRole('option').map((one) => one.textContent)).toEqual(['Developer'])
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
    fireEvent.click(within(dialog).getByTestId('person-pick-pe-gijs'))
    fireEvent.click(within(dialog).getByTestId('assign-save'))
    expect(commands).toEqual([{
      type: 'assignment.add', assignment: { id: 'as-new', unitId: 'webshop', roleId: 'ro-dev', person: { person: 'pe-gijs' }, from: TODAY },
    }])
  })

  it('offers nothing where the line to the role is dotted', () => {
    const dotted: HostModel = {
      ...LINED,
      elements: LINED.elements.map((one) => (one.id === 'webshop' ? { ...one, reportingLines: [{ role: 'ro-dev', kind: 'dotted' as const, to }] } : one)),
    }
    const tree = [{ path: 'customer', model: dotted }]
    const reach = managesPeople(indexScopes([{ path: '', model: LINED_ROOT }, ...tree]).organisation(), 'pe-ivo', TODAY)
    renderShell(<Harness readOnly root={LINED_ROOT} model={dotted} more={tree} me="pe-ivo" {...(reach ? { manages: reach } : {})} commands={[]} />)
    fireEvent.click(within(screen.getByTestId('unit-slot-ro-dev')).getByTestId('unit-vacant'))
    expect(screen.queryByTestId('assign-dialog')).toBeNull()
    expect(screen.queryByTestId('unit-assign')).toBeNull()
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

describe('a unit on the day the board is looked at', () => {
  // The coach's assignment ends at the year's end, Ivo comes in as a developer
  // from 2027, and a plan of the customer domain moves the webshop to the top
  // on the first day of 2027 (ADR-0027, ADR-0036 §6).
  const LATER = '2027-01-01'
  const PLANNED: HostModel = {
    ...CUSTOMER,
    assignments: [
      ...CUSTOMER.assignments!.map((one) => (one.id === 'as-4' ? { ...one, until: '2026-12-31' } : one)),
      as('as-5', 'webshop', 'ro-dev', 'pe-ivo', { from: LATER }),
    ],
    transitions: [{
      id: 'tr-1', number: 1, title: 'Webshop on its own', status: 'agreed', elements: [], decisions: [], milestones: [], body: '',
      moves: [{ unitId: 'webshop', on: LATER }],
    }],
  }

  it('says today\'s holders and managers where nobody looks away, and its move under Over time', () => {
    renderShell(<Harness model={PLANNED} commands={[]} />)
    expect(screen.queryByTestId('unit-day')).toBeNull()
    expect(screen.getByText('Roles, today')).toBeTruthy()
    expect(screen.getAllByTestId('unit-holder').map((chip) => chip.textContent)).toContain('Team coach: Gijs Mulder · acting')
    expect(screen.getAllByTestId('unit-move').map((line) => line.textContent)).toEqual(['Under the organisation itself from 2027-01-01 (TR-0001)'])
  })

  it('follows the day looked at: who holds a role then, who manages it there, and where it sits', () => {
    renderShell(<Harness model={PLANNED} day={LATER} commands={[]} />)
    expect(text('unit-day')).toBe('As on 2027-01-01, the day this board is looked at.')
    expect(screen.getByText('Roles on 2027-01-01')).toBeTruthy()
    expect(screen.getAllByTestId('unit-holder').map((chip) => chip.textContent)).toEqual(['Femke Bos · you', 'Bram de Wit · 50%', 'Ivo Peters'])
    // Moved to the top, it is no longer under the customer domain's owner.
    expect(screen.getAllByTestId('unit-manager').map((line) => line.textContent)).toEqual(['Femke Bos — Product owner, Webshop · you'])
    expect(screen.getByText('On this day it sits under the organisation itself: a plan moved it. Its own parent is where it sat before.')).toBeTruthy()
    expect(unitFindings().map((line) => line.textContent)).toContain('Webshop is a Team and may not sit where it is filed')
  })

  it('starts what it writes on the day looked at where that is still to come', async () => {
    const commands: Command[] = []
    renderShell(<Harness model={PLANNED} day={LATER} commands={commands} />)
    fireEvent.click(screen.getAllByTestId('unit-holder')[1])
    fireEvent.click(await screen.findByTestId('assign-end'))
    expect(commands).toEqual([{ type: 'assignment.update', id: 'as-3', patch: { until: '2026-12-31' } }])
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

  it('lays the session\'s plans\' moves over the tree\'s, so a move just made is on its day at once', () => {
    const plan = (moves: { unitId: string; parentId?: string; on: string }[]) => ({
      id: 'tr-1', number: 1, title: 'Move', status: 'draft' as const, elements: [], decisions: [], milestones: [], body: '', moves,
    })
    const kept: HostModel = { ...CUSTOMER, transitions: [plan([{ unitId: 'webshop', on: '2027-01-01' }])] }
    const index = indexScopes([{ path: '', model: ROOT }, { path: 'customer', model: kept }])
    expect(organisationHere(index, '', ROOT).organisation.moves).toEqual([{ unitId: 'webshop', on: '2027-01-01' }])
    const now: HostModel = { ...CUSTOMER, transitions: [plan([{ unitId: 'webshop', parentId: 'customer', on: '2027-02-01' }])] }
    expect(organisationHere(index, 'customer', now).organisation.moves).toEqual([{ unitId: 'webshop', parentId: 'customer', on: '2027-02-01' }])
    expect(organisationHere(index, 'customer', CUSTOMER).organisation).not.toHaveProperty('moves')
  })
})

/**
 * What it answers for, from the unit's end (ADR-0036, amended 11 October
 * 2026): a capability this scope defines is a row here; one another scope
 * defines is a row there, written as that scope's step; a row kept here comes
 * off here; and one in a domain it does not serve is among its checks.
 */
describe('what a unit is responsible for, from its own inspector', () => {
  const fn = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
    id, kind: 'function', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
  })

  it('makes it responsible for a capability here as a row here, and takes a row kept here off', async () => {
    const commands: Command[] = []
    const model: HostModel = { ...CUSTOMER, elements: [...CUSTOMER.elements, fn('returns', 'Handle returns', { parentId: 'sell' })] }
    renderShell(<Harness model={model} commands={commands} />)
    expect(screen.getAllByTestId('unit-answers-for-row').map((one) => one.textContent)).toEqual(['Sell online'])
    fireEvent.click(screen.getByTestId('unit-answers-for-add'))
    expect(screen.getAllByRole('option').map((one) => one.textContent)).toEqual(['Handle returnsin Sell online'])
    fireEvent.click(screen.getByRole('option', { name: /Handle returns/ }))
    expect(commands[0]).toEqual({ type: 'relation.create', relation: { id: 'i-new', type: 'assigned', sourceId: 'webshop', targetId: 'returns' } })
    fireEvent.click(within(screen.getAllByTestId('unit-answers-for-row')[0]).getByTestId('CancelIcon'))
    expect(commands[1]).toEqual({ type: 'relation.delete', id: 'r1' })
    expect(await axeFindings()).toEqual([])
  })

  it('writes the row for a capability another scope defines in that scope, and says so where it may not', async () => {
    const asked: { path: string; commands: readonly Command[] | undefined }[] = []
    let answer: Awaited<ReturnType<WriteIn>> = { ok: true }
    const writeIn: WriteIn = (path, change) => {
      asked.push({ path, commands: change({ path, model: ROOT, activeDiagramId: '', logoLibrary: [] }) })
      return Promise.resolve(answer)
    }
    const root: HostModel = { ...ROOT, elements: [fn('serve', 'Serve customers')] }
    renderShell(<Harness root={root} commands={[]} writeIn={writeIn} />)
    fireEvent.click(screen.getByTestId('unit-answers-for-add'))
    fireEvent.click(screen.getByRole('option', { name: /Serve customers/ }))
    await waitFor(() => expect(asked).toEqual([{
      path: '', commands: [{ type: 'relation.create', relation: { id: 'i-new', type: 'assigned', sourceId: 'webshop', targetId: 'serve' } }],
    }]))
    answer = { ok: false, reason: 'shell.scopeReadOnly' }
    fireEvent.click(screen.getByTestId('unit-answers-for-add'))
    fireEvent.click(screen.getByRole('option', { name: /Serve customers/ }))
    expect(await screen.findByText('Nothing was written: you may read this scope, but not change it. Ask somebody who may change it.')).toBeTruthy()
  })

  it('offers only this scope\'s own where it has no way to write another', () => {
    const root: HostModel = { ...ROOT, elements: [fn('serve', 'Serve customers')] }
    renderShell(<Harness root={root} commands={[]} />)
    expect((screen.getByTestId('unit-answers-for-add') as HTMLButtonElement).disabled).toBe(true)
  })

  it('says among its checks a capability of a domain it does not serve', () => {
    const shipping: HostModel = {
      name: 'Shipping', elements: [fn('price', 'Price freight')], diagrams: [],
      relations: [{ id: 'r9', type: 'assigned', sourceId: 'webshop', targetId: 'price' }],
    }
    renderShell(<Harness more={[{ path: 'shipping', model: shipping }]} commands={[]} />)
    expect(screen.getAllByTestId('unit-answers-for-row').map((one) => one.textContent)).toEqual(['Sell online', 'Price freight · kept in shipping'])
    expect(unitFindings().map((one) => one.textContent))
      .toContain('Webshop is responsible for Price freight, but neither it nor a unit above it serves shipping')
  })
})

describe('a unit\'s reporting lines (ADR-0039 §7)', () => {
  /** The team's developers report to the domain owner, and so does its product owner. */
  const lined: HostModel = {
    ...ROOT,
    unitTypes: [domain, {
      ...team,
      slots: [
        { role: 'ro-po', min: 1, max: 1, reportsTo: { role: 'ro-owner', kind: 'solid' } },
        { role: 'ro-dev', min: 2, max: 3, reportsTo: { role: 'ro-owner', kind: 'dotted' } },
      ],
    }],
  }

  it('lists each line of its roles, where it lands, its kind and whose it is, and names a manager by line', () => {
    renderShell(<Harness root={lined} commands={[]} />)
    expect(screen.getAllByTestId('unit-line').map((line) => line.textContent?.split('Override…')[0])).toEqual([
      'Product owner → Domain owner, Customerline managerthe type\'s',
      'Developer → Domain owner, Customerfunctionalthe type\'s',
    ])
    expect(screen.getAllByTestId('unit-manager').map((line) => line.textContent)).toEqual([
      'Femke Bos — Product owner, Webshop · you', 'Ada Verbeek — Domain owner, Customer · by line',
    ])
  })

  it('reports by nesting here, then uses the type\'s again, each as an update of the unit\'s own lines', async () => {
    const commands: Command[] = []
    renderShell(<Harness root={lined} commands={commands} />)
    fireEvent.click(within(screen.getAllByTestId('unit-line')[0]).getByTestId('unit-line-nesting'))
    expect(commands[0]).toEqual({ type: 'element.update', id: 'webshop', patch: { reportingLines: [{ role: 'ro-po', kind: 'solid' }] } })
    await waitFor(() => expect(screen.getAllByTestId('unit-line')[0].textContent).toContain('Product owner: by nesting here'))
    fireEvent.click(within(screen.getAllByTestId('unit-line')[0]).getByTestId('unit-line-use-type'))
    expect(commands[1]).toEqual({ type: 'element.update', id: 'webshop', patch: { reportingLines: undefined } })
  })

  it('overrides a line to a role in another unit, or to another role of this unit, which is offered first', async () => {
    const commands: Command[] = []
    renderShell(<Harness root={lined} commands={commands} />)
    fireEvent.click(within(screen.getAllByTestId('unit-line')[1]).getByTestId('unit-line-override'))
    const form = () => screen.getByTestId('unit-line-form')
    const pick = async (at: number, name: string) => {
      fireEvent.mouseDown(within(form()).getAllByRole('combobox')[at])
      fireEvent.click(await screen.findByRole('option', { name }))
    }
    // This unit first, and its own role left out of the roles offered: a role does not report to itself in the same unit.
    fireEvent.mouseDown(within(form()).getAllByRole('combobox')[0])
    expect((await screen.findAllByRole('option')).map((one) => one.textContent)).toEqual(['Webshop (this unit)', 'Customer'])
    fireEvent.click(screen.getByRole('option', { name: 'Webshop (this unit)' }))
    fireEvent.mouseDown(within(form()).getAllByRole('combobox')[1])
    expect((await screen.findAllByRole('option')).map((one) => one.textContent)).toEqual(['Product owner'])
    fireEvent.click(screen.getByRole('option', { name: 'Product owner' }))
    fireEvent.click(within(form()).getByTestId('unit-line-save'))
    expect(commands[0]).toEqual({
      type: 'element.update', id: 'webshop',
      patch: { reportingLines: [{ role: 'ro-dev', to: { scope: 'customer', unit: 'webshop', role: 'ro-po' }, kind: 'solid' }] },
    })
    await waitFor(() => expect(screen.getAllByTestId('unit-line')[1].textContent).toContain('Developer → Product owner, in this unit'))
    commands.length = 0
    fireEvent.click(within(screen.getAllByTestId('unit-line')[1]).getByTestId('unit-line-override'))
    await pick(0, 'Customer')
    await pick(1, 'Domain owner')
    await pick(2, 'functional')
    // The two days the type's slot editor takes, kept only where said.
    fireEvent.change(within(form()).getByTestId('unit-line-from'), { target: { value: '2026-01-01' } })
    fireEvent.click(within(form()).getByTestId('unit-line-save'))
    // Beside the unit's own line manager's line: one of each kind.
    expect(commands[0]).toEqual({
      type: 'element.update', id: 'webshop',
      patch: { reportingLines: [
        { role: 'ro-dev', to: { scope: 'customer', unit: 'webshop', role: 'ro-po' }, kind: 'solid' },
        { role: 'ro-dev', to: { scope: 'customer', unit: 'customer', role: 'ro-owner' }, kind: 'dotted', from: '2026-01-01' },
      ] },
    })
    await waitFor(() => expect(screen.queryByTestId('unit-line-form')).toBeNull())
    expect(screen.getAllByTestId('unit-line')[1].textContent).toContain('this unit\'s own')
  })

  it('offers nothing to change where the scope is only read', () => {
    renderShell(<Harness root={lined} readOnly commands={[]} />)
    expect(screen.getAllByTestId('unit-line')).toHaveLength(2)
    expect(screen.queryByTestId('unit-line-override')).toBeNull()
  })
})
