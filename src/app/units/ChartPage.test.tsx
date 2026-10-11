// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The organisation chart in its tab (ADR-0036 §7), over one fictional
 * organisation — Acme Logistics — with its operating model at the root and a
 * shipping domain below: what the chart draws on a day, *you* and *Find me*,
 * a unit opened where it is kept, and a vacancy filled — the chart changing
 * as the assignment lands; a person's chip choosing their assignment, *ext*
 * on someone from outside, and the badges naming the domains a unit serves
 * and the plans that bring and end it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useMemo, useState } from 'react'
import { renderShell } from '../testing/renderShell'
import type { Command } from '../../model/commands'
import { managesPeople } from '../../model/managing'
import type { ManagesPeople } from '../../model/managing'
import type { HostModel } from '../../model/hostModel'
import { fromArrays, toArrays } from '../../model/normalised'
import type { Role, UnitType } from '../../model/operatingModel'
import { apply } from '../../model/reducer'
import type { DesignDiagram, DesignElement } from '../../model/types'
import type { Assignment } from '../../model/units'
import type { Person } from '../../people/person'
import { DEFAULT_POLICY } from '../../people/policy'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { PersonNamesProvider, personNames } from '../../people/ui/names'
import { translator } from '../../i18n'
import { indexScopes } from '../../projects/scopeIndex'
import { axeFindings } from '../testing/axe'
import { ChartPage } from './ChartPage'
import { unitViewsHere } from './unitViewsHere'

afterEach(() => cleanup())

const TODAY = '2026-10-11'

const domain: UnitType = { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [{ role: 'ro-owner', min: 1, max: 1 }] }
const cluster: UnitType = { id: 'ut-cluster', name: 'Cluster', top: true, within: ['ut-domain'], spans: true, slots: [{ role: 'ro-lead', min: 1, max: 1 }] }
const team: UnitType = { id: 'ut-team', name: 'Team', within: ['ut-cluster'], slots: [{ role: 'ro-po', min: 1, max: 1 }, { role: 'ro-dev', min: 2 }] }
const roles: Role[] = [
  { id: 'ro-owner', name: 'Domain owner', duties: [], manages: true },
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

const ROOT: HostModel = {
  name: 'Acme Logistics', elements: [actor('data', 'Data & Integration', { unitTypeId: 'ut-cluster', scopes: ['shipping', 'warehouse'] })],
  relations: [], diagrams: [], unitTypes: [domain, cluster, team], roles,
  assignments: [as('as-9', 'data', 'ro-lead', 'pe-kees')],
}
const SHIPPING: HostModel = {
  name: 'Shipping',
  elements: [
    actor('shipping', 'Shipping', { unitTypeId: 'ut-domain' }),
    actor('pf', 'Parcel & Freight', { unitTypeId: 'ut-cluster', parentId: 'shipping', lifecycleDates: { retired: '2027-01-01' } }),
    actor('tt', 'Track & Trace', { unitTypeId: 'ut-team', parentId: 'pf' }),
  ],
  relations: [], diagrams: [],
  assignments: [
    as('as-1', 'shipping', 'ro-owner', 'pe-noor'),
    as('as-2', 'pf', 'ro-lead', 'pe-omar'),
    as('as-3', 'tt', 'ro-po', 'pe-sara', { share: 0.6 }),
    as('as-4', 'tt', 'ro-dev', 'pe-sara', { share: 0.6 }),
  ],
}
const PEOPLE: Person[] = [
  { id: 'pe-noor', name: 'Noor Haddad', pseudonym: 'BCDF', kind: 'internal', state: 'active' },
  { id: 'pe-omar', name: 'Omar Benali', pseudonym: 'CDFG', kind: 'internal', state: 'active' },
  { id: 'pe-sara', name: 'Sara Kaya', pseudonym: 'DFGH', kind: 'internal', state: 'active' },
  { id: 'pe-kees', name: 'Kees Vos', pseudonym: 'FGHJ', kind: 'internal', state: 'active' },
  { id: 'pe-tim', name: 'Tim de Boer', pseudonym: 'GHJK', kind: 'internal', state: 'active' },
]

function register(me: string | undefined, people: readonly Person[] = PEOPLE): PeopleRegisterAccess {
  const refused = () => Promise.resolve({ refused: 'people.unknown' as const })
  return {
    people, policy: DEFAULT_POLICY, me, readOnly: false, today: TODAY,
    add: refused, change: refused, leave: refused, forget: refused, remove: refused, merge: refused,
    setPolicy: () => Promise.resolve(), setMe: () => Promise.resolve(), mentionsOf: () => Promise.resolve([]),
  }
}

const view = (asOf?: string): DesignDiagram => ({ id: 'oc-1', kind: 'chart', name: 'Organisation', members: [], ...(asOf ? { asOf } : {}) })

const LABELS: Record<string, string> = { '': 'the organisation', shipping: 'Shipping', warehouse: 'Warehouse' }

/** The chart over the shipping scope's session, changed by the model's own writer, with the editor's selection and the chart's choice held as the workspace holds them. */
function Harness({ asOf, me = 'pe-sara', commands, onSelect = () => {}, onOpenElsewhere = () => {}, scope = 'shipping', shipping = SHIPPING, people: held = PEOPLE, readOnly = false, manages, selectedId, choosing = true }: {
  asOf?: string; me?: string | null; commands: Command[]; onSelect?: (id: string | undefined) => void
  onOpenElsewhere?: (scope: string, id: string) => void; scope?: string; shipping?: HostModel; people?: readonly Person[]
  readOnly?: boolean; manages?: ManagesPeople; selectedId?: string; choosing?: boolean
}) {
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const [model, setModel] = useState(scope === '' ? ROOT : shipping)
  const index = useMemo(() => indexScopes([{ path: '', model: ROOT }, { path: 'shipping', model: SHIPPING }]), [])
  const here = useMemo(() => unitViewsHere(index, scope, model), [index, scope, model])
  const dispatch = (command: Command) => {
    commands.push(command)
    const result = apply(fromArrays(model), command)
    if (!result.ok) return undefined
    const next = toArrays(result.model)
    setModel(next)
    return next
  }
  const people = { ...register(me ?? undefined, held), ...(manages ? { manages } : {}) }
  // The names the shell provides at its root (`people/ui/names`): the register's, *you* among them.
  const names = useMemo(() => personNames(people, translator('en')), [people])
  return (
    <PersonNamesProvider names={names}>
    <ChartPage
      diagram={view(asOf)} here={here} today={TODAY} readOnly={readOnly} people={people}
      scopeLabel={(path) => LABELS[path] ?? path} {...(selectedId !== undefined ? { selectedId } : {})}
      onSelect={onSelect} onOpenElsewhere={onOpenElsewhere}
      {...(choosing ? { onChoose: setChosen, ...(chosen !== undefined ? { chosen } : {}) } : {})}
      assign={{ dispatch, makeId: (prefix) => `${prefix}-new`, scopeName: 'Shipping' }}
    />
    </PersonNamesProvider>
  )
}

const units = () => screen.getAllByTestId('chart-unit').map((box) => box.getAttribute('data-element-id'))
const unitBox = (id: string) => screen.getAllByTestId('chart-unit').find((box) => box.getAttribute('data-element-id') === id)!

describe('the organisation chart', () => {
  it('draws the units of its scope as a tree, and a unit serving it from above', () => {
    renderShell(<Harness commands={[]} />)
    // A domain's lane is above a cluster's, which may sit in one: Shipping first.
    expect(units()).toEqual(['shipping', 'pf', 'tt', 'data'])
    expect(within(unitBox('pf')).getAllByTestId('chart-unit').map((box) => box.getAttribute('data-element-id'))).toEqual(['tt'])
    expect(within(unitBox('data')).getByTestId('chart-badge-serves').textContent).toBe('serves Shipping · Warehouse')
    expect(screen.getByTestId('chart-count').textContent).toBe('4 units · 4 people')
  })

  it('names each holder through the register, marks you, the people over all of their time, and the vacancies', () => {
    renderShell(<Harness commands={[]} />)
    const tt = unitBox('tt')
    const holders = within(tt).getAllByTestId('chart-holder')
    expect(holders.map((one) => one.textContent)).toEqual(['Sara Kaya · 60% · you', 'Sara Kaya · 60% · you'])
    expect(holders.every((one) => one.getAttribute('data-you') === 'true' && one.getAttribute('data-over') === 'true')).toBe(true)
    expect(within(within(tt).getByTestId('chart-slot-ro-dev')).getAllByTestId('chart-vacant')).toHaveLength(1)
    const said = screen.getAllByTestId('chart-finding').map((line) => line.textContent)
    expect(said.some((line) => line?.includes('Sara Kaya'))).toBe(true)
  })

  it('is on its day: a unit ended with somebody still in it is drawn ended, its badge says when', () => {
    renderShell(<Harness asOf="2027-01-01" commands={[]} />)
    expect(unitBox('pf').getAttribute('data-ended')).toBe('true')
    expect(within(unitBox('pf')).getByText(/ended 31 Dec 2026/)).toBeTruthy()
    cleanup()
    renderShell(<Harness commands={[]} />)
    expect(within(unitBox('pf')).getByText(/ends 31 Dec 2026/)).toBeTruthy()
  })

  it('finds you, and says so when it cannot', () => {
    renderShell(<Harness commands={[]} />)
    fireEvent.click(screen.getByTestId('chart-find-me'))
    expect(screen.queryByTestId('chart-note')).toBeNull()
    cleanup()
    renderShell(<Harness me="pe-tim" commands={[]} />)
    fireEvent.click(screen.getByTestId('chart-find-me'))
    expect(screen.getByTestId('chart-note').textContent).toMatch(/You hold no role here/)
    cleanup()
    renderShell(<Harness me={null} commands={[]} />)
    fireEvent.click(screen.getByTestId('chart-find-me'))
    expect(screen.getByTestId('chart-note').textContent).toMatch(/This is me/)
  })

  it('opens a unit kept here by choosing it, and one kept elsewhere where it is kept', () => {
    const onSelect = vi.fn()
    const onOpenElsewhere = vi.fn()
    renderShell(<Harness commands={[]} onSelect={onSelect} onOpenElsewhere={onOpenElsewhere} />)
    fireEvent.click(within(unitBox('tt')).getAllByTestId('chart-unit-open')[0])
    expect(onSelect).toHaveBeenCalledWith('tt')
    fireEvent.click(within(unitBox('data')).getAllByTestId('chart-unit-open')[0])
    expect(onOpenElsewhere).toHaveBeenCalledWith('', 'data')
  })

  it('chooses a person\'s assignment by their chip in a unit kept here, the editor\'s selection let go, and marks it', async () => {
    const onSelect = vi.fn()
    renderShell(<Harness commands={[]} onSelect={onSelect} />)
    const chip = () => within(within(unitBox('pf')).getByTestId('chart-slot-ro-lead')).getByTestId('chart-holder')
    expect(chip().getAttribute('data-chosen')).toBeNull()
    fireEvent.click(chip())
    expect(onSelect).toHaveBeenCalledWith(undefined)
    expect(onSelect).not.toHaveBeenCalledWith('pf')
    expect(chip().getAttribute('data-chosen')).toBe('true')
    expect(chip().getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByTestId('chart-holder').filter((one) => one.getAttribute('data-chosen') === 'true')).toHaveLength(1)
    expect(await axeFindings()).toEqual([])
  })

  it('opens the unit where it is kept from a chip in a unit kept elsewhere, and the unit here where nothing chooses', () => {
    const onSelect = vi.fn()
    const onOpenElsewhere = vi.fn()
    renderShell(<Harness commands={[]} onSelect={onSelect} onOpenElsewhere={onOpenElsewhere} />)
    fireEvent.click(within(unitBox('data')).getByTestId('chart-holder'))
    expect(onOpenElsewhere).toHaveBeenCalledWith('', 'data')
    expect(screen.getAllByTestId('chart-holder').some((one) => one.getAttribute('data-chosen') === 'true')).toBe(false)
    cleanup()
    renderShell(<Harness commands={[]} onSelect={onSelect} choosing={false} />)
    fireEvent.click(within(within(unitBox('pf')).getByTestId('chart-slot-ro-lead')).getByTestId('chart-holder'))
    expect(onSelect).toHaveBeenLastCalledWith('pf')
  })

  it('lets the assignment go when the editor selects anything', () => {
    const { rerender } = renderShell(<Harness commands={[]} />)
    const chip = () => within(within(unitBox('pf')).getByTestId('chart-slot-ro-lead')).getByTestId('chart-holder')
    fireEvent.click(chip())
    expect(chip().getAttribute('data-chosen')).toBe('true')
    rerender(<Harness commands={[]} selectedId="tt" />)
    expect(chip().getAttribute('data-chosen')).toBeNull()
    rerender(<Harness commands={[]} />)
    expect(chip().getAttribute('data-chosen')).toBeNull()
  })

  it('marks someone from outside the organisation ext, and leaves a leaver\'s name plain', () => {
    const people = PEOPLE.map((one) => (one.id === 'pe-omar' ? { ...one, kind: 'external' as const }
      : one.id === 'pe-noor' ? { ...one, kind: 'external' as const, state: 'left' as const, leftOn: '2026-12-31' } : one))
    renderShell(<Harness commands={[]} people={people} />)
    expect(within(unitBox('pf')).getAllByTestId('chart-holder')[0].textContent).toBe('Omar Benali · ext')
    expect(within(within(unitBox('shipping')).getByTestId('chart-slot-ro-owner')).getByTestId('chart-holder').textContent).toBe('Noor Haddad · ext')
    expect(within(unitBox('tt')).getAllByTestId('chart-holder')[0].textContent).toBe('Sara Kaya · 60% · you')
  })

  it('names the plan that brings a unit and the one that ends it, beside the day', () => {
    const plan = (id: string, number: number, elements: { elementId: string; role: 'introduces' | 'retires' }[]) => ({
      id, number, title: id, status: 'agreed' as const, elements, decisions: [], milestones: [], body: '',
    })
    const shipping: HostModel = {
      ...SHIPPING,
      elements: [...SHIPPING.elements, actor('parcel', 'Parcel', { unitTypeId: 'ut-cluster', parentId: 'shipping', lifecycle: 'planned', lifecycleDates: { live: '2027-01-01' } })],
      transitions: [plan('tr-7', 7, [{ elementId: 'parcel', role: 'introduces' }, { elementId: 'pf', role: 'retires' }])],
    }
    renderShell(<Harness commands={[]} shipping={shipping} />)
    expect(within(unitBox('pf')).getByTestId('chart-badge-ends').textContent).toBe('ends 31 Dec 2026 · TR-0007')
    cleanup()
    renderShell(<Harness commands={[]} shipping={shipping} asOf="2027-01-01" />)
    expect(within(unitBox('parcel')).getByTestId('chart-badge-begins').textContent).toBe('from 1 Jan 2027 · TR-0007')
    expect(within(unitBox('pf')).getByTestId('chart-badge-ended').textContent).toBe('ended 31 Dec 2026 · TR-0007 · people still assigned')
  })

  it('says each finding as a link to the unit on the chart it is about', () => {
    const onSelect = vi.fn()
    renderShell(<Harness commands={[]} onSelect={onSelect} />)
    const over = screen.getAllByTestId('chart-finding').find((line) => line.textContent?.includes('Sara Kaya'))!
    fireEvent.click(over)
    expect(onSelect).toHaveBeenCalledWith('tt')
  })

  /** The outline replaced 3.6.0's *Show* select (3.6.1): it goes to a unit and leaves the chart whole. */
  it('lists its units in an outline beside it, in the chart\'s order, and goes to one without narrowing the chart', () => {
    const onSelect = vi.fn()
    renderShell(<Harness commands={[]} onSelect={onSelect} />)
    const outline = screen.getByRole('navigation', { name: 'Units' })
    expect(within(outline).getAllByTestId('chart-outline-unit').map((row) => row.getAttribute('data-unit-id'))).toEqual(['shipping', 'pf', 'tt', 'data'])
    fireEvent.click(within(outline).getByRole('button', { name: 'Cluster Parcel & Freight' }))
    expect(onSelect).toHaveBeenLastCalledWith('pf')
    expect(units()).toEqual(['shipping', 'pf', 'tt', 'data'])
  })

  it('counts a person kept under an id merged into theirs as one person over all of their time', () => {
    const people: Person[] = [...PEOPLE, { id: 'pe-noor2', pseudonym: 'KLMN', kind: 'internal', state: 'active', mergedInto: 'pe-noor' }]
    const shipping: HostModel = { ...SHIPPING, assignments: [...SHIPPING.assignments!, as('as-5', 'pf', 'ro-dev', 'pe-noor2', { share: 0.5 })] }
    renderShell(<Harness commands={[]} shipping={shipping} people={people} />)
    expect(within(screen.getByTestId('chart-findings')).getByText(/Noor Haddad holds 150% across their roles/)).toBeTruthy()
  })

  it('fills a vacancy on a day still to come from that day', async () => {
    const commands: Command[] = []
    renderShell(<Harness commands={commands} asOf="2026-12-01" />)
    fireEvent.click(within(within(unitBox('tt')).getByTestId('chart-slot-ro-dev')).getByTestId('chart-vacant'))
    const dialog = await screen.findByTestId('assign-dialog')
    fireEvent.click(within(dialog).getByTestId('person-pick-pe-tim'))
    fireEvent.click(within(dialog).getByTestId('assign-save'))
    expect(commands).toEqual([{
      type: 'assignment.add',
      assignment: { id: 'as-new', unitId: 'tt', roleId: 'ro-dev', person: { person: 'pe-tim' }, from: '2026-12-01' },
    }])
  })

  it('fills a vacancy as one step, and the chart changes with it', async () => {
    const commands: Command[] = []
    renderShell(<Harness commands={commands} />)
    fireEvent.click(within(within(unitBox('tt')).getByTestId('chart-slot-ro-dev')).getByTestId('chart-vacant'))
    const dialog = await screen.findByTestId('assign-dialog')
    fireEvent.click(within(dialog).getByTestId('person-pick-pe-tim'))
    fireEvent.click(within(dialog).getByTestId('assign-save'))
    expect(commands).toEqual([{
      type: 'assignment.add',
      assignment: { id: 'as-new', unitId: 'tt', roleId: 'ro-dev', person: { person: 'pe-tim' }, from: TODAY },
    }])
    await waitFor(() => expect(screen.queryByTestId('assign-dialog')).toBeNull())
    const devs = within(within(unitBox('tt')).getByTestId('chart-slot-ro-dev'))
    expect(devs.getAllByTestId('chart-holder').map((one) => one.textContent)).toContain('Tim de Boer')
    expect(devs.queryByTestId('chart-vacant')).toBeNull()
    expect(screen.getByTestId('chart-count').textContent).toBe('4 units · 5 people')
  })

  /** A manager where the scope is only read and the source grants that right (ADR-0036 §12). */
  it('fills a vacancy in a unit the person manages where the scope is only read, and none elsewhere', async () => {
    const index = indexScopes([{ path: '', model: ROOT }, { path: 'shipping', model: SHIPPING }])
    const commands: Command[] = []
    renderShell(<Harness commands={commands} readOnly manages={managesPeople(index.organisation(), 'pe-omar', TODAY)} />)
    fireEvent.click(within(within(unitBox('tt')).getByTestId('chart-slot-ro-dev')).getByTestId('chart-vacant'))
    const dialog = await screen.findByTestId('assign-dialog')
    fireEvent.click(within(dialog).getByTestId('person-pick-pe-tim'))
    fireEvent.click(within(dialog).getByTestId('assign-save'))
    expect(commands).toEqual([{
      type: 'assignment.add', assignment: { id: 'as-new', unitId: 'tt', roleId: 'ro-dev', person: { person: 'pe-tim' }, from: TODAY },
    }])
    cleanup()
    renderShell(<Harness commands={commands} readOnly manages={managesPeople(index.organisation(), 'pe-kees', TODAY)} />)
    fireEvent.click(within(within(unitBox('tt')).getByTestId('chart-slot-ro-dev')).getByTestId('chart-vacant'))
    expect(screen.queryByTestId('assign-dialog')).toBeNull()
    cleanup()
    renderShell(<Harness commands={commands} readOnly />)
    fireEvent.click(within(within(unitBox('tt')).getByTestId('chart-slot-ro-dev')).getByTestId('chart-vacant'))
    expect(screen.queryByTestId('assign-dialog')).toBeNull()
  })
})
