// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * One assignment chosen on the organisation chart, in the inspector beside it
 * (ADR-0036 §4, §7), over one fictional organisation — Acme Logistics: who,
 * the role and the unit, the days and the share, the note when the person
 * holds more than all of their time, *End on* a day the person chooses, a
 * correction through the unit's dialog, and *Open in People*.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useMemo, useState } from 'react'
import { renderShell } from '../testing/renderShell'
import { axeFindings } from '../testing/axe'
import { translator } from '../../i18n'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import { managesPeople } from '../../model/managing'
import type { ManagesPeople } from '../../model/managing'
import { fromArrays, toArrays } from '../../model/normalised'
import type { Role, UnitType } from '../../model/operatingModel'
import { apply } from '../../model/reducer'
import type { DesignDiagram, DesignElement } from '../../model/types'
import type { Assignment } from '../../model/units'
import type { Person } from '../../people/person'
import { DEFAULT_POLICY } from '../../people/policy'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { PersonNamesProvider, personNames } from '../../people/ui/names'
import { indexScopes } from '../../projects/scopeIndex'
import { AssignmentInspector, endDay } from './AssignmentInspector'

afterEach(() => cleanup())

const TODAY = '2026-10-11'

const cluster: UnitType = { id: 'ut-cluster', name: 'Cluster', top: true, within: [], slots: [{ role: 'ro-lead', min: 1, max: 1 }] }
const team: UnitType = { id: 'ut-team', name: 'Team', within: ['ut-cluster'], slots: [{ role: 'ro-po', min: 1, max: 1 }, { role: 'ro-dev', min: 2 }] }
const roles: Role[] = [
  { id: 'ro-lead', name: 'Cluster lead', duties: [], manages: true },
  { id: 'ro-po', name: 'Product owner', duties: [], manages: true },
  { id: 'ro-dev', name: 'Developer', duties: [] },
]
const actor = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})
const as = (id: string, unitId: string, roleId: string, person: string, over: Partial<Assignment> = {}): Assignment => ({
  id, unitId, roleId, person: { person }, ...over,
})

const ROOT: HostModel = { name: 'Acme Logistics', elements: [], relations: [], diagrams: [], unitTypes: [cluster, team], roles }
const SHIPPING: HostModel = {
  name: 'Shipping',
  elements: [actor('pf', 'Parcel & Freight', { unitTypeId: 'ut-cluster' }), actor('tt', 'Track & Trace', { unitTypeId: 'ut-team', parentId: 'pf' })],
  relations: [], diagrams: [],
  assignments: [
    as('as-1', 'pf', 'ro-lead', 'pe-omar', { from: '2026-06-01' }),
    as('as-2', 'tt', 'ro-po', 'pe-sara', { share: 0.6, from: '2026-01-01', until: '2027-03-31' }),
    as('as-3', 'tt', 'ro-dev', 'pe-sara', { share: 0.6, acting: true }),
    as('as-4', 'tt', 'ro-dev', 'pe-old'),
  ],
}
const PEOPLE: Person[] = [
  { id: 'pe-omar', name: 'Omar Benali', pseudonym: 'CDFG', kind: 'external', state: 'active' },
  { id: 'pe-sara', name: 'Sara Kaya', pseudonym: 'DFGH', kind: 'internal', state: 'active' },
]

function register(people: readonly Person[] = PEOPLE, manages?: ManagesPeople): PeopleRegisterAccess {
  const refused = () => Promise.resolve({ refused: 'people.unknown' as const })
  return {
    people, policy: DEFAULT_POLICY, me: 'pe-sara', readOnly: false, today: TODAY,
    add: refused, change: refused, leave: refused, forget: refused, remove: refused, merge: refused,
    setPolicy: () => Promise.resolve(), setMe: () => Promise.resolve(), mentionsOf: () => Promise.resolve([]),
    ...(manages ? { manages } : {}),
  }
}

const chart = (asOf?: string): DesignDiagram => ({ id: 'oc-1', kind: 'chart', name: 'Organisation', members: [], ...(asOf ? { asOf } : {}) })

/** The inspector over the shipping scope's session, changed by the model's own writer. */
function Harness({ id, commands, asOf, readOnly = false, people = PEOPLE, manages, onOpenPeople }: {
  id: string; commands: Command[]; asOf?: string; readOnly?: boolean; people?: readonly Person[]; manages?: ManagesPeople
  onOpenPeople?: (person: string) => void
}) {
  const [model, setModel] = useState(SHIPPING)
  const index = useMemo(() => indexScopes([{ path: '', model: ROOT }, { path: 'shipping', model: SHIPPING }]), [])
  const access = useMemo(() => register(people, manages), [people, manages])
  const names = useMemo(() => personNames(access, translator('en')), [access])
  const dispatch = (command: Command) => {
    commands.push(command)
    const result = apply(fromArrays(model), command)
    if (!result.ok) return undefined
    const next = toArrays(result.model)
    setModel(next)
    return next
  }
  return (
    <PersonNamesProvider names={names}>
      <AssignmentInspector
        assignmentId={id} diagram={chart(asOf)} index={index} scope="shipping" model={model} today={TODAY} readOnly={readOnly}
        people={access} dispatch={dispatch} makeId={(prefix) => `${prefix}-new`} scopeName="Shipping"
        {...(onOpenPeople ? { onOpenPeople } : {})}
      />
    </PersonNamesProvider>
  )
}

const text = (id: string) => screen.getByTestId(id).textContent

describe('an assignment chosen on the chart', () => {
  it('says who holds it, the role and the unit, the share, the days, and that they hold more than all of their time', async () => {
    renderShell(<Harness id="as-3" commands={[]} />)
    expect(text('assignment-person')).toBe('Sara Kaya · you')
    expect(text('assignment-role')).toBe('Developer in Track & Trace · 60% of their time · acting')
    expect(text('assignment-days')).toBe('No first or last day')
    expect(text('assignment-over')).toBe('Holds 120% across their roles on 11 Oct 2026.')
    expect(await axeFindings()).toEqual([])
  })

  it('says its days as far as they are known, ext for someone from outside, and no note where they hold no more than all of their time', () => {
    renderShell(<Harness id="as-1" commands={[]} />)
    expect(text('assignment-person')).toBe('Omar Benali · ext')
    expect(text('assignment-role')).toBe('Cluster lead in Parcel & Freight')
    expect(text('assignment-days')).toBe('From 1 Jun 2026')
    expect(screen.queryByTestId('assignment-over')).toBeNull()
    cleanup()
    renderShell(<Harness id="as-2" commands={[]} />)
    expect(text('assignment-days')).toBe('From 1 Jan 2026 until 31 Mar 2027')
  })

  it('ends on the day the person chooses, as one step, and then says its last day', async () => {
    const commands: Command[] = []
    renderShell(<Harness id="as-1" commands={commands} />)
    const until = within(screen.getByTestId('assignment-end')).getByTestId('assignment-until') as HTMLInputElement
    expect(until.value).toBe(TODAY)
    fireEvent.change(until, { target: { value: '2026-11-30' } })
    fireEvent.click(screen.getByTestId('assignment-end-on'))
    expect(commands).toEqual([{ type: 'assignment.update', id: 'as-1', patch: { until: '2026-11-30' } }])
    await waitFor(() => expect(text('assignment-days')).toBe('From 1 Jun 2026 until 30 Nov 2026'))
    expect(screen.queryByTestId('assignment-end')).toBeNull()
  })

  it('offers the day before a later chart day, and refuses a last day before its first', () => {
    renderShell(<Harness id="as-1" commands={[]} asOf="2027-01-01" />)
    const until = screen.getByTestId('assignment-until') as HTMLInputElement
    expect(until.value).toBe('2026-12-31')
    fireEvent.change(until, { target: { value: '2026-05-01' } })
    expect((screen.getByTestId('assignment-end-on') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Its last day cannot be before its first, 1 Jun 2026.')).toBeTruthy()
  })

  it('corrects it through the unit\'s dialog', async () => {
    const commands: Command[] = []
    renderShell(<Harness id="as-1" commands={commands} />)
    fireEvent.click(screen.getByTestId('assignment-correct'))
    const dialog = await screen.findByTestId('assign-dialog')
    fireEvent.change(within(dialog).getByTestId('assign-share'), { target: { value: '50' } })
    fireEvent.click(within(dialog).getByTestId('assign-save'))
    expect(commands).toEqual([{ type: 'assignment.update', id: 'as-1', patch: { share: 0.5 } }])
  })

  it('is only read where the scope is, unless the person manages the unit', () => {
    renderShell(<Harness id="as-3" commands={[]} readOnly onOpenPeople={() => {}} />)
    expect(screen.queryByTestId('assignment-end')).toBeNull()
    expect(screen.queryByTestId('assignment-correct')).toBeNull()
    expect(screen.getByTestId('assignment-people')).toBeTruthy()
    cleanup()
    const organisation = indexScopes([{ path: '', model: ROOT }, { path: 'shipping', model: SHIPPING }]).organisation()
    renderShell(<Harness id="as-3" commands={[]} readOnly manages={managesPeople(organisation, 'pe-omar', TODAY)} />)
    expect(screen.getByTestId('assignment-end')).toBeTruthy()
    expect(screen.getByTestId('assignment-correct')).toBeTruthy()
  })

  it('opens the People page on the entry that answers for the person, and offers nothing for one the register no longer holds', () => {
    const onOpenPeople = vi.fn()
    const people: Person[] = [...PEOPLE.map((one) => (one.id === 'pe-sara' ? { ...one, id: 'pe-sara2' } : one)),
      { id: 'pe-sara', pseudonym: 'KLMN', kind: 'internal', state: 'active', mergedInto: 'pe-sara2' }]
    renderShell(<Harness id="as-3" commands={[]} people={people} onOpenPeople={onOpenPeople} />)
    fireEvent.click(screen.getByTestId('assignment-people'))
    expect(onOpenPeople).toHaveBeenCalledWith('pe-sara2')
    cleanup()
    renderShell(<Harness id="as-4" commands={[]} onOpenPeople={onOpenPeople} />)
    expect(text('assignment-person')).toBe('A former colleague')
    expect(screen.queryByTestId('assignment-people')).toBeNull()
  })

  it('draws nothing for an assignment that is not there', () => {
    renderShell(<Harness id="as-gone" commands={[]} />)
    expect(screen.queryByTestId('assignment-inspector')).toBeNull()
  })
})

describe('the last day End offers first', () => {
  it('is today, or the day before a later day looked at, and never before the first day', () => {
    expect(endDay({}, TODAY, TODAY)).toBe(TODAY)
    expect(endDay({}, '2027-01-01', TODAY)).toBe('2026-12-31')
    expect(endDay({ from: '2026-06-01' }, '2026-03-01', TODAY)).toBe(TODAY)
    expect(endDay({ from: '2027-02-01' }, '2027-01-01', TODAY)).toBe('2027-02-01')
  })
})

describe('where the holder reports (ADR-0039, amended 17 October 2026)', () => {
  const combo = (at: number) => within(screen.getByTestId('holder-line-form')).getAllByRole('combobox')[at]
  const pick = async (at: number, name: string) => {
    fireEvent.mouseDown(combo(at))
    fireEvent.click(await screen.findByRole('option', { name }))
  }

  it('says the model\'s answer — by nesting, and who manages them — and sets a line of their own to one person, marked as an override', async () => {
    const commands: Command[] = []
    renderShell(<Harness id="as-3" commands={commands} />)
    expect(text('holder-line-nesting')).toBe('By nesting: to whoever manages this unit or one above it')
    expect(screen.getAllByTestId('holder-manager').map((one) => [one.textContent, one.dataset.via])).toEqual([
      ['Sara Kaya — Product owner, Track & Trace', 'nesting'], ['Omar Benali — Cluster lead, Parcel & Freight', 'nesting'],
    ])
    fireEvent.click(screen.getByTestId('holder-line-override'))
    await pick(0, 'One person')
    await pick(1, 'Omar Benali')
    // One role held: filled in, by its place in the tree.
    expect(text('holder-line-place')).toBe('Cluster lead · Parcel & Freight')
    fireEvent.click(screen.getByTestId('holder-line-save'))
    expect(commands).toEqual([{
      type: 'assignment.update', id: 'as-3',
      patch: { reportsTo: [{ to: { scope: 'shipping', unit: 'pf', role: 'ro-lead', person: 'pe-omar' }, kind: 'solid' }] },
    }])
    await waitFor(() => expect(screen.getByTestId('holder-line').dataset.source).toBe('person'))
    expect(text('holder-line')).toContain('Developer → Omar Benali (Cluster lead, Parcel & Freight)')
    expect(within(screen.getByTestId('holder-line')).getByTestId('line-override-mark').textContent).toBe('override')
    expect(screen.getAllByTestId('holder-manager').map((one) => one.dataset.via)).toEqual(['override'])
    expect(text('holder-model')).toBe('The model says: by nesting')
    expect(await axeFindings()).toEqual([])
    fireEvent.click(screen.getByTestId('holder-line-use-model'))
    expect(commands.at(-1)).toEqual({ type: 'assignment.update', id: 'as-3', patch: { reportsTo: undefined } })
    await waitFor(() => expect(screen.queryByTestId('holder-model')).toBeNull())
  })

  it('refuses a line to their own role in their own unit, and says why', async () => {
    const commands: Command[] = []
    renderShell(<Harness id="as-2" commands={commands} />)
    fireEvent.click(screen.getByTestId('holder-line-override'))
    await pick(1, 'Parcel & Freight / Track & Trace (this unit)')
    await pick(2, 'Product owner')
    fireEvent.click(screen.getByTestId('holder-line-save'))
    expect(commands).toEqual([])
    expect(text('holder-line-refused')).toBe('Not written: a role does not report to itself in the same unit, nor a holder to their own role there.')
  })

  it('offers nothing to change where the scope is only read', () => {
    renderShell(<Harness id="as-3" commands={[]} readOnly />)
    expect(screen.getByTestId('holder-lines')).toBeTruthy()
    expect(screen.queryByTestId('holder-line-override')).toBeNull()
  })
})
