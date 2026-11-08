// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The Conway map in its tab (ADR-0036 §7), over one fictional organisation —
 * Acme Logistics — with a platform cluster at the root and a customer domain
 * below: the verdict and its sum, the pair grid and what its cells say, the
 * panel on nothing, a pair, a unit and an application, each of its answers one
 * step, grouping by a unit type, *you*, and the lines as a second reading.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useMemo, useState } from 'react'
import { axeFindings } from '../testing/axe'
import { renderShell } from '../testing/renderShell'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import { fromArrays, toArrays } from '../../model/normalised'
import type { Role, UnitType } from '../../model/operatingModel'
import { apply } from '../../model/reducer'
import type { DesignDiagram, DesignElement, Relation } from '../../model/types'
import type { Person } from '../../people/person'
import { DEFAULT_POLICY } from '../../people/policy'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { PersonNamesProvider, personNames } from '../../people/ui/names'
import { translator } from '../../i18n'
import { indexScopes } from '../../projects/scopeIndex'
import type { SelectRequest } from '../../widgets/useSelectRequest'
import { ConwayPage } from './ConwayPage'
import { conwayInputHere, unitViewsHere } from './unitViewsHere'
import { chooseValue } from '../../widgets/kit/testing/select'

afterEach(() => cleanup())

const TODAY = '2026-10-11'
const cluster: UnitType = { id: 'ut-cluster', name: 'Cluster', top: true, within: [], spans: true, slots: [] }
const team: UnitType = { id: 'ut-team', name: 'Team', within: ['ut-cluster'], limit: 2, slots: [{ role: 'ro-po', min: 1, max: 1 }] }
const roles: Role[] = [{ id: 'ro-po', name: 'Product owner', duties: [], manages: true }]
const actor = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})
const app = (id: string, name: string, partyId?: string): DesignElement => ({
  id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {}, ...(partyId ? { partyId } : {}),
})
const flow = (id: string, sourceId: string, targetId: string): Relation => ({ id, type: 'flow', sourceId, targetId, isBidirectional: false })

const ROOT: HostModel = {
  name: 'Acme Logistics',
  elements: [actor('data', 'Data & Integration', { unitTypeId: 'ut-cluster', scopes: ['customer', 'shipping'] }), actor('ip', 'Integration Platform', { unitTypeId: 'ut-team', parentId: 'data' }), app('hub', 'Integration Hub', 'ip')],
  relations: [{ id: 'i-1', type: 'interacts', sourceId: 'data', targetId: 'sales', mode: 'service' }],
  diagrams: [], unitTypes: [cluster, team], roles,
}
const CUSTOMER: HostModel = {
  name: 'Customer',
  elements: [
    actor('sales', 'Digital Sales', { unitTypeId: 'ut-cluster' }),
    actor('web', 'Webshop', { unitTypeId: 'ut-team', parentId: 'sales' }),
    actor('mob', 'Mobile App', { unitTypeId: 'ut-team', parentId: 'sales' }),
    app('shop', 'Shop', 'web'), app('orders', 'Orders', 'web'), app('crm', 'CRM', 'web'), app('phone', 'Phone app', 'mob'), app('billing', 'Billing'),
  ],
  relations: [flow('f-1', 'shop', 'orders'), flow('f-2', 'phone', 'orders'), flow('f-3', 'orders', 'hub'), flow('f-4', 'orders', 'billing')],
  diagrams: [],
  assignments: [{ id: 'as-1', unitId: 'mob', roleId: 'ro-po', person: { person: 'pe-sara' } }],
}
const PEOPLE: Person[] = [{ id: 'pe-sara', name: 'Sara Kaya', pseudonym: 'DFGH', kind: 'internal', state: 'active' }]
const refused = () => Promise.resolve({ refused: 'people.unknown' as const })
const REGISTER: PeopleRegisterAccess = {
  people: PEOPLE, policy: DEFAULT_POLICY, me: 'pe-sara', readOnly: false, today: TODAY,
  add: refused, change: refused, leave: refused, forget: refused, remove: refused, merge: refused,
  setPolicy: () => Promise.resolve(), setMe: () => Promise.resolve(), mentionsOf: () => Promise.resolve([]),
}
/** The names the shell provides at its root (`people/ui/names`): the register's, *you* among them. */
const NAMES = personNames(REGISTER, translator('en'))
const VIEW: DesignDiagram = { id: 'cw-1', kind: 'conway', name: 'Teams and systems', members: [] }

function Harness({ commands, root = ROOT, customer = CUSTOMER, onOpen = () => {}, onOpenPlan, readOnly = false, today = TODAY, select }: {
  commands: Command[]; root?: HostModel; customer?: HostModel; onOpen?: (id: string) => void; onOpenPlan?: (id: string) => void; readOnly?: boolean; today?: string; select?: SelectRequest
}) {
  const [model, setModel] = useState(customer)
  const index = useMemo(() => indexScopes([{ path: '', model: root }, { path: 'customer', model: customer }]), [root, customer])
  const here = useMemo(() => unitViewsHere(index, 'customer', model), [index, model])
  const dispatch = (command: Command) => {
    commands.push(command)
    const result = apply(fromArrays(model), command)
    if (!result.ok) return undefined
    const next = toArrays(result.model)
    setModel(next)
    return next
  }
  return (
    <PersonNamesProvider names={NAMES}>
    <ConwayPage
      diagram={VIEW} here={here} index={index} scope="customer" model={model} today={today} readOnly={readOnly} people={REGISTER}
      scopeLabel={(path) => ({ '': 'the organisation', customer: 'Customer', shipping: 'Shipping' })[path] ?? path} onSelect={() => {}} onOpen={onOpen}
      {...(onOpenPlan ? { onOpenPlan } : {})} {...(select ? { select } : {})}
      declare={{ dispatch, newRowId: () => 'i-new', newPlanId: () => 'tr-new', planBody: () => 'Goal', scopeName: 'Customer' }}
    />
    </PersonNamesProvider>
  )
}


/** A cell of the grid, by its row and column as they read out. */
const cell = (name: RegExp) => within(screen.getByTestId('conway-matrix')).getAllByRole('gridcell', { name }).find((one) => !one.hasAttribute('data-absent')) ?? within(screen.getByTestId('conway-matrix')).getByRole('gridcell', { name })
/** Every row of the panel's list of what to look at. */
const looking = () => within(screen.getByTestId('conway-findings')).getAllByRole('row').map((row) => row.textContent)

describe('the Conway map', () => {
  it('reads the applications of its scope and of the units serving it, with the interfaces between them', () => {
    const index = indexScopes([{ path: '', model: ROOT }, { path: 'customer', model: CUSTOMER }])
    const here = unitViewsHere(index, 'customer', CUSTOMER)
    const input = conwayInputHere(index, 'customer', CUSTOMER, here)
    expect(input.applications.map((one) => one.id).sort()).toEqual(['billing', 'crm', 'hub', 'orders', 'phone', 'shop'])
    expect(input.flows.map((one) => one.id).sort()).toEqual(['f-1', 'f-2', 'f-3', 'f-4'])
    expect(input.interactions.map((one) => one.id)).toEqual(['i-1'])
  })

  it('reads the applications of a unit a plan moves under one of its units, from the day of the move', () => {
    const SHIPPING: HostModel = {
      name: 'Shipping', relations: [], diagrams: [],
      elements: [actor('parcel', 'Parcel', { unitTypeId: 'ut-team' }), app('track', 'Track & Trace', 'parcel')],
    }
    const moved: HostModel = {
      ...CUSTOMER,
      transitions: [{
        id: 'tr-1', number: 1, title: 'Parcel joins Digital Sales', status: 'agreed', elements: [], decisions: [], milestones: [], body: '',
        moves: [{ unitId: 'parcel', parentId: 'sales', on: '2027-01-01' }],
      }],
    }
    const index = indexScopes([{ path: '', model: ROOT }, { path: 'customer', model: moved }, { path: 'shipping', model: SHIPPING }])
    const here = unitViewsHere(index, 'customer', moved)
    expect(conwayInputHere(index, 'customer', moved, here, '2026-12-31').applications.map((one) => one.id)).not.toContain('track')
    expect(conwayInputHere(index, 'customer', moved, here, '2027-01-01').applications.map((one) => one.id)).toContain('track')
  })

  it('says a verdict with one sum that reconciles, and lists what to look at beside the grid', () => {
    renderShell(<Harness commands={[]} />)
    expect(screen.getByRole('heading', { name: '1 pair of units shares systems but has not said how they work together' })).toBeTruthy()
    // Of three crossing interfaces two are judged and one has no owner at an end.
    expect(screen.getByTestId('conway-count').textContent).toContain('1 of the 3')
    expect(looking()).toEqual(expect.arrayContaining([
      expect.stringContaining('Mobile App and Webshop'),
      expect.stringContaining('Billing'),
      expect.stringContaining('Webshop owns 3 applications'),
    ]))
  })

  it('draws each two units once, a mismatch by a mark and a border, those nobody owns as a row of their own', async () => {
    renderShell(<Harness commands={[]} />)
    const grid = within(screen.getByTestId('conway-matrix'))
    expect(grid.getAllByRole('rowheader').map((row) => row.textContent)).toEqual(['Mobile App' + 'you', 'Webshop', 'No owner yet'])
    expect(grid.getAllByRole('columnheader').slice(1).map((one) => one.textContent)).toEqual(['Integration Platform', 'Mobile App' + 'you', 'Webshop'])
    const mismatch = cell(/^Webshop, Mobile App/)
    expect(mismatch.getAttribute('data-attention')).toBe('true')
    expect(mismatch.getAttribute('aria-label')).toContain('systems connect, nothing said, 1 interface')
    expect(cell(/^Webshop, Integration Platform/).getAttribute('aria-label')).toContain('both agree, 1 interface, As a service')
    expect(cell(/^No owner yet, Webshop/).getAttribute('aria-label')).toContain('cannot judge, no owner, 1 interface')
    // The other half of the triangle is not there to press.
    expect(cell(/^Mobile App, Mobile App/).hasAttribute('data-absent')).toBe(true)
    expect(screen.getByTestId('conway-key').textContent).toContain('said, but no system connects')
    expect(await axeFindings()).toEqual([])
  })

  it('reads a pair in the panel from its cell, draws it under the grid, and goes back to all', async () => {
    renderShell(<Harness commands={[]} />)
    fireEvent.click(cell(/^Webshop, Mobile App/))
    const panel = screen.getByRole('complementary', { name: 'Mobile App and Webshop' })
    expect(within(panel).getByText('1 system connection between them. They have not said how they work together.')).toBeTruthy()
    expect(within(panel).getByText('A change on one side can break the other without a conversation.')).toBeTruthy()
    expect(within(panel).getByRole('button', { name: 'Interface: Phone app → Orders' })).toBeTruthy()
    const drawing = screen.getByTestId('conway-pair-drawing')
    expect(within(drawing).getByText('Phone app → Orders')).toBeTruthy()
    expect(within(drawing).getAllByTestId('conway-app').filter((one) => one.hasAttribute('data-marked')).map((one) => one.dataset.app).sort()).toEqual(['orders', 'phone'])
    expect(await axeFindings()).toEqual([])
    fireEvent.click(within(panel).getByTestId('conway-all'))
    expect(screen.queryByTestId('conway-pair-drawing')).toBeNull()
    expect(screen.getByRole('complementary', { name: 'What to look at' })).toBeTruthy()
  })

  it('says how two units work as one row with nothing chosen first, and the finding goes', async () => {
    const commands: Command[] = []
    renderShell(<Harness commands={commands} />)
    fireEvent.click(cell(/^Webshop, Mobile App/))
    fireEvent.click(screen.getByRole('button', { name: 'Say how they work together…' }))
    const dialog = await screen.findByTestId('interact-dialog')
    expect(within(dialog).getByText('How do Mobile App and Webshop work together?')).toBeTruthy()
    expect((within(dialog).getByTestId('interact-save') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(dialog).getByRole('radio', { name: /As a service/ }))
    fireEvent.click(within(dialog).getByTestId('interact-save'))
    expect(commands).toEqual([{ type: 'relation.create', relation: { id: 'i-new', type: 'interacts', sourceId: 'mob', targetId: 'web', mode: 'service' } }])
    await waitFor(() => expect(screen.queryByTestId('interact-dialog')).toBeNull())
    expect(cell(/^Webshop, Mobile App/).getAttribute('data-attention')).toBeNull()
    expect(screen.getByRole('heading', { name: /line up on/ })).toBeTruthy()
  })

  it('settles an interaction no interface needs: taken away where this scope keeps it, the interface drawn, or the two units read', async () => {
    const commands: Command[] = []
    const onOpen = vi.fn()
    const customer: HostModel = {
      ...CUSTOMER, relations: [...CUSTOMER.relations, { id: 'i-3', type: 'interacts', sourceId: 'mob', targetId: 'ip', mode: 'facilitating', isBidirectional: false }],
    }
    renderShell(<Harness commands={commands} customer={customer} onOpen={onOpen} />)
    // A note, behind its switch; its ring in the grid regardless.
    expect(cell(/^Mobile App, Integration Platform/).getAttribute('aria-label')).toContain('said, but no system connects')
    expect(looking().join()).not.toContain('Mobile App and Integration Platform')
    fireEvent.click(screen.getByTestId('conway-show-notes'))
    expect(looking().join()).toContain('Mobile App and Integration Platform')
    fireEvent.click(cell(/^Mobile App, Integration Platform/))
    const panel = screen.getByRole('complementary', { name: 'Integration Platform and Mobile App' })
    fireEvent.click(within(panel).getByRole('button', { name: 'Draw the missing interface…' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Integration Hub' }))
    expect(onOpen).toHaveBeenCalledWith('hub')
    fireEvent.click(within(panel).getByRole('button', { name: 'Remove what was said' }))
    expect(commands).toEqual([{ type: 'relation.delete', id: 'i-3' }])
  })

  it('offers no Remove for an interaction another scope keeps', () => {
    const root: HostModel = {
      ...ROOT, relations: [...ROOT.relations, { id: 'i-2', type: 'interacts', sourceId: 'ip', targetId: 'mob', mode: 'facilitating', isBidirectional: false }],
    }
    renderShell(<Harness commands={[]} root={root} />)
    fireEvent.click(cell(/^Mobile App, Integration Platform/))
    expect(screen.queryByRole('button', { name: 'Remove what was said' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Draw the missing interface…' })).toBeTruthy()
  })

  it('leaves out an interaction marked as intended, wherever the mark is kept, and calls the pair accepted', () => {
    const root: HostModel = {
      ...ROOT, relations: [...ROOT.relations, { id: 'i-2', type: 'interacts', sourceId: 'ip', targetId: 'mob', mode: 'facilitating', isBidirectional: false }],
    }
    const customer: HostModel = { ...CUSTOMER, checkMarks: [{ check: 'check.interactionUnused', key: 'i-2 ip mob', reason: 'They design together', on: TODAY }] }
    renderShell(<Harness commands={[]} root={root} customer={customer} />)
    expect(screen.queryByTestId('conway-show-notes')).toBeNull()
    expect(cell(/^Mobile App, Integration Platform/).getAttribute('aria-label')).toContain('marked as intended')
  })

  it('names what holds a pair that is no unit yet, and makes them units in one press', () => {
    const commands: Command[] = []
    const customer: HostModel = {
      ...CUSTOMER,
      elements: [...CUSTOMER.elements, actor('ops', 'Operations'), actor('fin', 'Finance'), app('stock', 'Stock', 'ops'), app('ledger', 'Ledger', 'fin')],
      relations: [...CUSTOMER.relations, flow('f-9', 'stock', 'ledger')],
    }
    renderShell(<Harness commands={commands} customer={customer} />)
    fireEvent.click(cell(/^Operations, Finance|^Finance, Operations/))
    expect(screen.getByTestId('conway-held').textContent).toContain('not a unit yet')
    expect(screen.queryByRole('button', { name: 'Say how they work together…' })).toBeNull()
    const make = screen.getByTestId('conway-make-units')
    chooseValue(within(make).getByRole('combobox', { name: 'Finance is a' }), 'ut-team')
    expect((within(make).getByTestId('conway-make-units-go') as HTMLButtonElement).disabled).toBe(true)
    chooseValue(within(make).getByRole('combobox', { name: 'Operations is a' }), 'ut-team')
    fireEvent.click(within(make).getByTestId('conway-make-units-go'))
    expect(commands).toEqual(expect.arrayContaining([
      { type: 'element.update', id: 'ops', patch: { unitTypeId: 'ut-team' } },
      { type: 'element.update', id: 'fin', patch: { unitTypeId: 'ut-team' } },
    ]))
  })

  it('says a party outside the organisation cannot say how it works, and leaves marking and planning', () => {
    const customer: HostModel = {
      ...CUSTOMER,
      elements: [...CUSTOMER.elements, actor('gov', 'Customs authority', { outside: true }), app('form', 'Declarations', 'gov')],
      relations: [...CUSTOMER.relations, flow('f-9', 'orders', 'form')],
    }
    renderShell(<Harness commands={[]} customer={customer} />)
    fireEvent.click(cell(/Customs authority.*Webshop|Webshop.*Customs authority/))
    expect(screen.getByTestId('conway-held').textContent).toContain('Customs authority is outside this organisation')
    expect(screen.queryByTestId('conway-make-units')).toBeNull()
    expect(screen.getByRole('button', { name: 'They should not depend on each other: plan it away…' })).toBeTruthy()
  })

  it('plans a mismatch away onto a new plan, as one step, and opens it', async () => {
    const commands: Command[] = []
    const onOpenPlan = vi.fn()
    renderShell(<Harness commands={commands} onOpenPlan={onOpenPlan} />)
    fireEvent.click(cell(/^Webshop, Mobile App/))
    fireEvent.click(screen.getByRole('button', { name: 'They should not depend on each other: plan it away…' }))
    const field = await screen.findByRole('combobox', { name: 'Which plan' })
    fireEvent.change(field, { target: { value: 'Split orders' } })
    fireEvent.click(await screen.findByRole('option', { name: /New plan/ }))
    expect(commands).toEqual([{
      type: 'transition.add',
      transition: {
        id: 'tr-new', number: 1, title: 'Split orders', status: 'draft', decisions: [], milestones: [], body: 'Goal',
        elements: [{ elementId: 'phone', role: 'changes' }, { elementId: 'orders', role: 'changes' }],
      },
    }])
    expect(onOpenPlan).toHaveBeenCalledWith('tr-new')
  })

  it('reads a unit from its heading, with what it owns and who it works with, and leaves only by a link', () => {
    const onOpen = vi.fn()
    renderShell(<Harness commands={[]} onOpen={onOpen} />)
    fireEvent.click(within(screen.getByTestId('conway-matrix')).getByRole('rowheader', { name: /Webshop/ }))
    const panel = screen.getByRole('complementary', { name: 'Webshop' })
    expect(within(panel).getByText('Team')).toBeTruthy()
    expect(within(panel).getByText('Webshop owns 3 applications, and a Team owns at most 2', { exact: false })).toBeTruthy()
    expect(within(panel).getAllByRole('row').map((row) => row.textContent)).toEqual(expect.arrayContaining(['CRM', 'Orders', 'Shop']))
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.click(within(panel).getByTestId('conway-open-unit'))
    expect(onOpen).toHaveBeenCalledWith('web')
  })

  it('reads a column heading the same way, and an application from the list with its owner to set', async () => {
    const commands: Command[] = []
    renderShell(<Harness commands={commands} />)
    fireEvent.click(within(screen.getByTestId('conway-matrix')).getByRole('columnheader', { name: /Integration Platform/ }))
    expect(screen.getByRole('complementary', { name: 'Integration Platform' })).toBeTruthy()
    fireEvent.click(screen.getByTestId('conway-all'))
    fireEvent.click(within(screen.getByTestId('conway-findings')).getByText('Billing'))
    const panel = screen.getByRole('complementary', { name: 'Billing' })
    const field = within(panel).getByRole('combobox', { name: 'Owner of Billing' })
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'Webshop' } })
    fireEvent.click(await screen.findByRole('option', { name: /Webshop/ }))
    expect(commands).toEqual([{ type: 'element.update', id: 'billing', patch: { partyId: 'web' } }])
    expect(await axeFindings()).toEqual([])
  })

  it('says it cannot answer while half the applications have no owner, and asks for owners first', () => {
    const customer: HostModel = {
      ...CUSTOMER,
      elements: CUSTOMER.elements.map((one) => (one.kind === 'application' && one.id !== 'shop' ? { ...one, partyId: undefined } as DesignElement : one)),
    }
    renderShell(<Harness commands={[]} customer={customer} />)
    expect(screen.getByRole('heading', { name: /This map cannot answer yet: \d+ of 6 applications have no owner/ })).toBeTruthy()
    const owners = screen.getByTestId('conway-owners')
    expect(within(owners).getAllByTestId('conway-owner-row').length).toBeGreaterThan(2)
  })

  it('shows every button that writes only to whoever may write', () => {
    renderShell(<Harness commands={[]} readOnly />)
    fireEvent.click(cell(/^Webshop, Mobile App/))
    expect(screen.queryByRole('button', { name: 'Say how they work together…' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'They should not depend on each other: plan it away…' })).toBeNull()
    fireEvent.click(screen.getByTestId('conway-all'))
    fireEvent.click(within(screen.getByTestId('conway-findings')).getByText('Billing'))
    expect(screen.queryByRole('combobox', { name: 'Owner of Billing' })).toBeNull()
  })

  it('marks the units you hold a role in, and Find me goes to the first, refused with its reason where you hold none', () => {
    renderShell(<Harness commands={[]} />)
    expect(screen.getAllByTestId('conway-you').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByTestId('conway-find-me'))
    expect(screen.getByRole('complementary', { name: 'Mobile App' })).toBeTruthy()
    cleanup()
    const customer: HostModel = { ...CUSTOMER, assignments: [] }
    renderShell(<Harness commands={[]} customer={customer} />)
    fireEvent.click(screen.getByTestId('conway-find-me'))
    expect(screen.getByRole('complementary', { name: 'What to look at' })).toBeTruthy()
    expect(screen.getByTestId('conway-find-me').getAttribute('aria-disabled')).toBe('true')
  })

  it('groups by a unit type and says the value; a press on a rolled-up cell lists the units beneath it', async () => {
    renderShell(<Harness commands={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /Group by: The unit that owns each/ }))
    fireEvent.click(await screen.findByText('Cluster'))
    expect(screen.getByRole('button', { name: /Group by: Cluster/ })).toBeTruthy()
    const grid = within(screen.getByTestId('conway-matrix'))
    expect(grid.getAllByRole('columnheader').slice(1).map((one) => one.textContent)).toEqual(expect.arrayContaining(['Data & Integration']))
    fireEvent.click(cell(/^Digital Sales, Data & Integration/))
    const panel = screen.getByRole('complementary', { name: 'Data & Integration and Digital Sales' })
    expect(within(panel).getByRole('grid', { name: 'The units beneath this pair' })).toBeTruthy()
    expect(within(panel).getAllByRole('row')[0]?.textContent).toContain('Integration Platform and Webshop')
  })

  it('draws the lines as a second reading, those to no owner only when asked, and a press on a card reads it', () => {
    renderShell(<Harness commands={[]} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Lines' }))
    expect(screen.getAllByTestId('conway-column').map((column) => column.getAttribute('data-element-id'))).toEqual(['ip', 'mob', 'web'])
    expect(screen.getByTestId('conway-strip').textContent).toContain('1 application has no owner.')
    fireEvent.click(screen.getByTestId('conway-show-unowned'))
    expect(screen.getAllByTestId('conway-column')).toHaveLength(4)
    fireEvent.click(screen.getAllByTestId('conway-app').find((one) => one.dataset.app === 'orders') as HTMLElement)
    expect(screen.getByRole('complementary', { name: 'Orders' })).toBeTruthy()
  })

  it('reads in the panel what a link or an agent selects, unit or application', () => {
    renderShell(<Harness commands={[]} select={{ id: 'web', nonce: 1 }} />)
    expect(screen.getByRole('complementary', { name: 'Webshop' })).toBeTruthy()
    cleanup()
    renderShell(<Harness commands={[]} select={{ id: 'orders', nonce: 1 }} />)
    expect(screen.getByRole('complementary', { name: 'Orders' })).toBeTruthy()
  })

  it('reads the lines by keyboard and passes axe', async () => {
    renderShell(<Harness commands={[]} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Lines' }))
    const card = screen.getAllByTestId('conway-app').find((one) => one.dataset.app === 'orders') as HTMLElement
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(screen.getByRole('complementary', { name: 'Orders' })).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })

  it('offers Open the landscape where there is nothing to compare', () => {
    const none: HostModel = { name: 'Empty', elements: [], relations: [], diagrams: [] }
    const root: HostModel = { ...ROOT, elements: ROOT.elements.filter((one) => one.kind !== 'application') }
    renderShell(<Harness commands={[]} root={root} customer={none} />)
    expect(screen.getByText('No applications to compare yet')).toBeTruthy()
  })
})
