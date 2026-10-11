// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The Conway map in its tab (ADR-0036 §7), over one fictional organisation —
 * Acme Logistics — with a platform cluster at the root and a customer domain
 * below: the columns, the findings in words, grouping by a unit type, *you*,
 * an interaction declared from a finding, which answers it, and the table of
 * what runs and what is declared between each two units. The findings are the
 * one list since 3.6.1, grouped and folded with the notes hidden: a test that
 * reads them unfolds them, and one that answers a finding opens it and
 * presses the action in its explanation, where it pressed a button beside it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useMemo, useState } from 'react'
import { axeFindings } from '../testing/axe'
import { pressAction, unfoldFindings } from '../testing/findings'
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
import { ConwayPage } from './ConwayPage'
import { conwayInputHere, unitViewsHere } from './unitViewsHere'

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

function Harness({ commands, root = ROOT, customer = CUSTOMER, onSelect = () => {}, onOpenElsewhere = () => {} }: {
  commands: Command[]; root?: HostModel; customer?: HostModel; onSelect?: (id: string | undefined) => void; onOpenElsewhere?: (scope: string, id: string) => void
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
      diagram={VIEW} here={here} index={index} scope="customer" model={model} today={TODAY} readOnly={false} people={REGISTER}
      scopeLabel={(path) => ({ '': 'the organisation', customer: 'Customer', shipping: 'Shipping' })[path] ?? path} onSelect={onSelect} onOpenElsewhere={onOpenElsewhere}
      declare={{ dispatch, newRowId: () => 'i-new', scopeName: 'Customer' }}
    />
    </PersonNamesProvider>
  )
}

/** Every finding's sentence, the list unfolded and its notes shown. */
const said = () => {
  unfoldFindings(screen.getByTestId('conway-findings'))
  return screen.getAllByTestId('conway-finding').map((line) => line.textContent)
}

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

  it('draws a column per unit and one for what nobody owns, and says what it finds', () => {
    renderShell(<Harness commands={[]} />)
    expect(screen.getAllByTestId('conway-column').map((column) => column.getAttribute('data-element-id'))).toEqual(['ip', 'mob', 'web', null])
    expect(said()).toEqual([
      'Phone app → Orders runs from Mobile App to Webshop, and no interaction is declared between them.',
      'Billing has no unit: nobody owns it.',
      'Webshop owns 3 applications, and a Team owns at most 2',
    ])
    expect(screen.getByTestId('conway-count').textContent).toBe('3 interfaces cross a unit · 1 with nothing declared')
  })

  it('marks the units you hold a role in, and the units above them', () => {
    renderShell(<Harness commands={[]} />)
    const mobile = screen.getAllByTestId('conway-column').find((column) => column.getAttribute('data-element-id') === 'mob')!
    expect(within(mobile).getByTestId('conway-you')).toBeTruthy()
    expect(screen.getAllByTestId('conway-you')).toHaveLength(1)
  })

  it('groups by a unit type, where the person asks', async () => {
    renderShell(<Harness commands={[]} />)
    fireEvent.mouseDown(within(screen.getByTestId('conway-bar')).getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: 'Cluster' }))
    expect(screen.getAllByTestId('conway-column').map((column) => column.getAttribute('data-element-id'))).toEqual(['data', 'sales', null])
    // A unit serving several domains names them, as the chart does; one serving one says its type.
    expect(screen.getAllByTestId('conway-unit-kind').map((kind) => kind.textContent)).toEqual(['serves Customer · Shipping', 'Cluster'])
    expect(said()).toEqual(['Billing has no unit: nobody owns it.', 'Webshop owns 3 applications, and a Team owns at most 2'])
  })

  it('declares an interaction from a crossing with none, as one row, and the finding goes', async () => {
    const commands: Command[] = []
    renderShell(<Harness commands={commands} />)
    unfoldFindings(screen.getByTestId('conway-findings'))
    fireEvent.click(screen.getByText(/^Phone app → Orders/))
    pressAction(screen.getByTestId('finding-explanation'), 'Declare an interaction…')
    const dialog = await screen.findByTestId('interact-dialog')
    // The units it may be declared with, in the order every list of units reads: the clusters, then the teams.
    fireEvent.mouseDown(within(dialog).getAllByRole('combobox')[0])
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((one) => one.textContent))
      .toEqual(['Data & Integration', 'Digital Sales', 'Integration Platform', 'Webshop'])
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
    fireEvent.click(within(dialog).getByTestId('interact-save'))
    expect(commands).toEqual([{
      type: 'relation.create', relation: { id: 'i-new', type: 'interacts', sourceId: 'mob', targetId: 'web', mode: 'collaboration' },
    }])
    await waitFor(() => expect(screen.queryByTestId('interact-dialog')).toBeNull())
    expect(said().some((line) => line?.startsWith('Phone app'))).toBe(false)
    expect(screen.getByTestId('conway-count').textContent).toBe('3 interfaces cross a unit · 0 with nothing declared')
  })

  it('counts the interfaces between each pair of units in a table, with every interaction declared between them', async () => {
    renderShell(<Harness commands={[]} />)
    const table = screen.getByTestId('conway-matrix')
    expect(within(table).getAllByRole('row')).toHaveLength(5)
    // Rows and columns: Integration Platform, Mobile App, Webshop, no unit. Data & Integration works with Digital
    // Sales as a service, which covers both its teams — Mobile App too, where no interface runs.
    expect(cells()).toEqual([
      ['·', 'S declared', '1S declared', ''],
      ['S declared', '·', '1 undeclared', ''],
      ['1S declared', '1 undeclared', '·', '1 unowned'],
      ['', '', '1 unowned', '·'],
    ])
    expect(within(table).getAllByTestId('conway-cell')[0].getAttribute('title')).toBe('As a service')
    expect(within(table).getByText(/a shaded cell with only a letter has an interaction declared that no interface needs/)).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })

  it('shades a cell apart where an interaction is declared that no interface needs, as the findings say', () => {
    const root: HostModel = {
      ...ROOT, relations: [...ROOT.relations, { id: 'i-2', type: 'interacts', sourceId: 'ip', targetId: 'mob', mode: 'facilitating', isBidirectional: false }],
    }
    renderShell(<Harness commands={[]} root={root} />)
    expect(cells()[0]).toEqual(['·', 'SF unused', '1S declared', ''])
    // A note, hidden behind its switch until asked for.
    expect(screen.getAllByTestId('findings-group').map((row) => row.textContent)).not.toContainEqual(expect.stringContaining('Interaction not used'))
    expect(screen.getByRole('switch', { name: 'Show notes (1)' })).toBeTruthy()
    expect(said()).toContain('Integration Platform and Mobile App declare Facilitating, and no interface runs between them.')
  })

  it('settles an interaction no interface needs: taken away where this scope keeps it, the interface modelled, or the two units opened', async () => {
    const commands: Command[] = []
    const onSelect = vi.fn()
    const onOpenElsewhere = vi.fn()
    const customer: HostModel = {
      ...CUSTOMER, relations: [...CUSTOMER.relations, { id: 'i-3', type: 'interacts', sourceId: 'mob', targetId: 'ip', mode: 'facilitating', isBidirectional: false }],
    }
    renderShell(<Harness commands={commands} customer={customer} onSelect={onSelect} onOpenElsewhere={onOpenElsewhere} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Show notes (1)' }))
    fireEvent.click(screen.getByRole('button', { name: /Interaction not used by any interface/ }))
    fireEvent.click(screen.getByText('Mobile App and Integration Platform declare Facilitating, and no interface runs between them.'))
    const explanation = screen.getByTestId('finding-explanation')
    expect(within(explanation).getAllByTestId(/^finding-action-/).map((one) => one.textContent))
      .toEqual(['Remove the declaration', 'Model the missing interface…', 'Open the two units'])
    expect(await axeFindings()).toEqual([])
    // The interface is modelled from either unit's applications, each under its unit.
    pressAction(explanation, 'Model the missing interface…')
    expect(within(await screen.findByRole('menu')).getAllByRole('menuitem').map((one) => one.textContent))
      .toEqual(['Phone appMobile App', 'Integration HubIntegration Platform'])
    fireEvent.click(screen.getByRole('menuitem', { name: /Integration Hub/ }))
    expect(onOpenElsewhere).toHaveBeenCalledWith('', 'hub')
    pressAction(explanation, 'Open the two units')
    fireEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Mobile App' }))
    expect(onSelect).toHaveBeenCalledWith('mob')
    // Taken away as one step, and the finding goes with it.
    pressAction(explanation, 'Remove the declaration')
    expect(commands).toEqual([{ type: 'relation.delete', id: 'i-3' }])
    await waitFor(() => expect(screen.queryByTestId('finding-explanation')).toBeNull())
    expect(screen.queryByRole('switch', { name: /Show notes/ })).toBeNull()
  })

  it('leaves out an interaction marked as intended, wherever the mark is kept', () => {
    const root: HostModel = {
      ...ROOT, relations: [...ROOT.relations, { id: 'i-2', type: 'interacts', sourceId: 'ip', targetId: 'mob', mode: 'facilitating', isBidirectional: false }],
    }
    const customer: HostModel = { ...CUSTOMER, checkMarks: [{ check: 'check.interactionUnused', key: 'i-2 ip mob', reason: 'They design together', on: TODAY }] }
    renderShell(<Harness commands={[]} root={root} customer={customer} />)
    expect(screen.queryByRole('switch', { name: /Show notes/ })).toBeNull()
    expect(said()).not.toContain('Integration Platform and Mobile App declare Facilitating, and no interface runs between them.')
  })

  it('offers no Remove for an interaction another scope keeps', () => {
    const root: HostModel = {
      ...ROOT, relations: [...ROOT.relations, { id: 'i-2', type: 'interacts', sourceId: 'ip', targetId: 'mob', mode: 'facilitating', isBidirectional: false }],
    }
    renderShell(<Harness commands={[]} root={root} />)
    unfoldFindings(screen.getByTestId('conway-findings'))
    fireEvent.click(screen.getByText(/^Integration Platform and Mobile App declare/))
    expect(within(screen.getByTestId('finding-explanation')).getAllByTestId(/^finding-action-/).map((one) => one.textContent))
      .toEqual(['Model the missing interface…', 'Open the two units'])
  })
})

/** The table's cells by row, each its words and how the two units stand. */
function cells(): string[][] {
  return within(screen.getByTestId('conway-matrix')).getAllByRole('row').slice(1)
    .map((row) => [...row.querySelectorAll('td')].map((cell) => [cell.textContent, cell.getAttribute('data-state')].filter(Boolean).join(' ')))
}
