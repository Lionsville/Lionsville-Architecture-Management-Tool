// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * *Served by* on a scope's home and in its settings (ADR-0036, amended 11
 * October 2026), through the whole shell over held repositories: the units
 * whose `scopes` name the scope, the domain's owner worked out from the rule,
 * and each edit a step in the scope that keeps the unit — read back from that
 * scope, where it landed.
 *
 * Acme Logistics, fictional: Shipping keeps its domain, a cluster naming it
 * and a team under that; Warehouse keeps Fulfilment, a cluster that may serve
 * several domains, and Robotics, a team that serves one; Data & Integration is
 * kept at the organisation and serves Shipping by name.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { DesignElement } from '../../model'
import type { Role, UnitType } from '../../model/operatingModel'
import type { Assignment } from '../../model/units'
import type { ScopeSnapshot } from '../../projects/scope'
import { axeFindings } from '../testing/axe'
import { heldRepositories } from '../testing/heldRepositories'
import type { HeldRepositories } from '../testing/heldRepositories'
import { renderApp } from '../testing/renderShell'
import { controlSelector } from '../../platform/controlNames'

afterEach(() => cleanup())

const TODAY = () => '2026-10-11'

const types: UnitType[] = [
  { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [{ role: 'ro-lead', min: 1, max: 1 }] },
  { id: 'ut-cluster', name: 'Cluster', top: true, within: ['ut-domain'], spans: true, slots: [{ role: 'ro-lead', min: 1, max: 1 }] },
  { id: 'ut-team', name: 'Team', within: ['ut-cluster'], slots: [] },
]
const roles: Role[] = [{ id: 'ro-lead', name: 'Lead', duties: [], manages: true }]
const unit = (id: string, name: string, unitTypeId: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, unitTypeId, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})
const lead = (id: string, unitId: string, person: string): Assignment => ({ id, unitId, roleId: 'ro-lead', person: { person } })

function scope(path: string, name: string, elements: DesignElement[], over: Partial<ScopeSnapshot['model']> = {}): ScopeSnapshot {
  return { path, model: { name, elements, relations: [], diagrams: [], ...over }, activeDiagramId: '', logoLibrary: [] }
}

function tree(): ScopeSnapshot[] {
  return [
    scope('', 'Acme Logistics', [unit('data', 'Data & Integration', 'ut-cluster', { scopes: ['shipping'] })], {
      unitTypes: types, roles, operatingRules: [{ id: 'domainOwner', role: 'ro-lead' }],
      assignments: [lead('as-1', 'data', 'pe-lisa')],
    }),
    scope('shipping', 'Shipping', [
      unit('shipping', 'Shipping', 'ut-domain'),
      unit('parcels', 'Parcel & Freight', 'ut-cluster', { parentId: 'shipping', scopes: ['shipping'] }),
      unit('tracking', 'Track & Trace', 'ut-team', { parentId: 'parcels' }),
    ], { assignments: [lead('as-2', 'shipping', 'pe-noor'), lead('as-3', 'parcels', 'pe-omar')] }),
    scope('warehouse', 'Warehouse', [
      unit('fulfilment', 'Fulfilment', 'ut-cluster'),
      unit('robotics', 'Robotics', 'ut-team', { parentId: 'fulfilment' }),
    ]),
  ]
}

async function held(): Promise<HeldRepositories> {
  const repositories = heldRepositories(tree())
  await repositories.people.bringIn([
    { id: 'pe-noor', name: 'Noor Haddad', pseudonym: 'BCDF', kind: 'internal', state: 'active' },
    { id: 'pe-omar', name: 'Omar Benali', pseudonym: 'CDFG', kind: 'internal', state: 'active' },
    { id: 'pe-lisa', name: 'Lisa Brandt', pseudonym: 'DFGH', kind: 'internal', state: 'active' },
  ])
  return repositories
}

/** Shipping's home, once *Served by* has read the tree. */
async function shippingHome() {
  fireEvent.click(await screen.findByTestId('home-shipping'))
  await waitFor(() => expect(screen.getAllByTestId('served-by-row')).toHaveLength(3))
  return screen.getByTestId('served-by')
}

const rows = () => screen.getAllByTestId('served-by-row').map((one) => one.textContent)

describe('who serves a scope, on its home', () => {
  // Flipped 13 October 2026: a unit kept at the organisation that says
  // nothing no longer serves it, so the organisation's home, which is no
  // domain, has no *Served by* at all.
  it('is never drawn on the organisation\'s own home, which is no domain, even with a unit kept there that says nothing', async () => {
    const served = tree().map((one) => (one.path === '' ? { ...one, model: { ...one.model, elements: [...one.model.elements, unit('ops', 'Operations', 'ut-domain')] } } : one))
    renderApp({ repositories: heldRepositories(served), today: TODAY })
    await screen.findByTestId('home-shipping')
    expect(screen.queryByTestId('served-by')).toBeNull()
  })

  it('links a one-domain unit kept at the organisation that says nothing to the domain, as a step at the organisation', async () => {
    const served = tree().map((one) => (one.path === '' ? { ...one, model: { ...one.model, elements: [...one.model.elements, unit('ops', 'Operations', 'ut-domain')] } } : one))
    const repositories = heldRepositories(served)
    renderApp({ repositories, today: TODAY })
    await shippingHome()
    fireEvent.click(screen.getByTestId('served-by-add'))
    const operations = screen.getByRole('option', { name: /Operations/ })
    expect(operations.getAttribute('aria-disabled')).not.toBe('true')
    fireEvent.click(operations)
    await waitFor(async () => {
      const kept = (await repositories.read(''))?.model.elements.find((one) => one.id === 'ops')
      expect(kept?.scopes).toEqual(['shipping'])
    })
    await waitFor(() => expect(rows()).toContain('Domain · Operationsnobody manages it today · filed in the organisation✕'))
  })

  it('lists the units in the order of their types, each with its lead and where it is filed, and works the domain owner out', async () => {
    renderApp({ repositories: await held(), today: TODAY })
    const servedBy = await shippingHome()
    expect(rows()).toEqual([
      'Domain · ShippingNoor Haddad',
      'Cluster · Data & IntegrationLisa Brandt · filed in the organisation✕',
      'Cluster · Parcel & FreightOmar Benali',
    ])
    expect(servedBy.textContent).toContain('1 unit under them serves it through them.')
    expect(screen.getByTestId('served-by-owner').textContent)
      .toBe('Domain owner: Noor Haddad, the Lead of Shipping, the serving unit filed highest here.')
    expect(await axeFindings()).toEqual([])
  })

  it('adds a unit kept in another scope as a step there, keeping the scope it served, and offers a one-domain unit as unable', async () => {
    const repositories = await held()
    renderApp({ repositories, today: TODAY })
    await shippingHome()
    fireEvent.click(screen.getByTestId('served-by-add'))
    const field = screen.getByRole('combobox', { name: 'Find a unit' })
    expect(screen.getByRole('option', { name: /Robotics/ }).getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('option', { name: /Robotics/ }).textContent).toBe('Roboticsa Team serves one domain')
    // Shipping's own and those under the units serving it already serve it, and are not offered.
    expect(screen.queryByRole('option', { name: /Track & Trace/ })).toBeNull()
    fireEvent.change(field, { target: { value: 'fulf' } })
    fireEvent.click(await screen.findByRole('option', { name: /Fulfilment/ }))
    await waitFor(async () => {
      const kept = (await repositories.read('warehouse'))?.model.elements.find((one) => one.id === 'fulfilment')
      expect(kept?.scopes).toEqual(['warehouse', 'shipping'])
    })
    expect((await repositories.read('shipping'))?.model.elements.some((one) => one.id === 'fulfilment')).toBe(false)
    expect(await screen.findByText(/Fulfilment now serves Shipping: one step in Warehouse\./)).toBeTruthy()
    await waitFor(() => expect(rows()).toContain('Cluster · Fulfilmentnobody manages it today · filed in Warehouse✕'))
  })

  /** The type follows the unit (ADR-0036, amended 17 October 2026): in the same apply as the link, and left where a unit is taken off. */
  it('gives the scope the type of the unit linked to it, in the same apply, says so, and leaves it when a unit is taken off', async () => {
    const repositories = await held()
    renderApp({ repositories, today: TODAY })
    await shippingHome()
    // Nothing typed yet: the line says what serves it instead.
    expect(screen.getByTestId('served-by-type').textContent).toBe('Not typed from the operating model; the units that serve it are: Domain, Cluster.')
    expect(screen.getByTestId('served-by-type').getAttribute('data-link')).toBe('unsaid')
    fireEvent.click(screen.getByTestId('served-by-add'))
    fireEvent.change(screen.getByRole('combobox', { name: 'Find a unit' }), { target: { value: 'fulf' } })
    fireEvent.click(await screen.findByRole('option', { name: /Fulfilment/ }))
    await waitFor(async () => expect((await repositories.read('shipping'))?.unitTypeId).toBe('ut-cluster'))
    expect((await repositories.read('warehouse'))?.model.elements.find((one) => one.id === 'fulfilment')?.scopes).toEqual(['warehouse', 'shipping'])
    expect(await screen.findByText('Fulfilment now serves Shipping: one step in Warehouse. Shipping is now a Cluster.')).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('served-by-type').textContent).toBe('Typed Cluster, as a unit that serves it is.'))
    expect(screen.getByTestId('served-by-type').getAttribute('data-link')).toBe('agrees')
    // Taking a cluster off leaves the type: another cluster still serves it, and the type says what the scope is.
    fireEvent.click(screen.getByRole('button', { name: 'Stop Data & Integration serving Shipping' }))
    await waitFor(() => expect(rows()).toHaveLength(3))
    expect((await repositories.read('shipping'))?.unitTypeId).toBe('ut-cluster')
  })

  it('takes off a unit that names the scope and has somewhere else to serve, as a step where it is kept', async () => {
    const repositories = await held()
    renderApp({ repositories, today: TODAY })
    await shippingHome()
    expect(screen.queryByRole('button', { name: 'Stop Parcel & Freight serving Shipping' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Stop Data & Integration serving Shipping' }))
    await waitFor(async () => {
      const kept = (await repositories.read(''))?.model.elements.find((one) => one.id === 'data')
      expect(kept).toBeDefined()
      expect(kept?.scopes).toBeUndefined()
    })
    await waitFor(() => expect(rows()).toHaveLength(2))
  })

  it('offers a unit kept where the person may only read, and says so', async () => {
    renderApp({ repositories: await held(), today: TODAY, provider: { readOnlyAt: (path: string) => path === 'warehouse' } })
    await shippingHome()
    fireEvent.click(screen.getByTestId('served-by-add'))
    const fulfilment = screen.getByRole('option', { name: /Fulfilment/ })
    expect(fulfilment.getAttribute('aria-disabled')).toBe('true')
    expect(fulfilment.textContent).toBe('Fulfilmentkept where you may only read')
  })

  it('is in the scope\'s settings too, the same field from the same end', async () => {
    renderApp({ repositories: await held(), today: TODAY })
    await shippingHome()
    fireEvent.click(screen.getByRole('button', { name: 'Settings for Shipping' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getAllByTestId('served-by-row').map((one) => one.textContent)[0]).toBe('Domain · ShippingNoor Haddad')
    expect(within(dialog).getByTestId('served-by-add')).toBeTruthy()
  })
})

describe('the links between a unit and the scopes it serves', { timeout: 20_000 }, () => {
  /** Shipping with an organisation chart: a unit kept there lands on it, chosen. */
  function charted(): ScopeSnapshot[] {
    return tree().map((one) => (one.path === 'shipping' ? {
      ...one,
      model: { ...one.model, diagrams: [{ id: 'oc-shipping', kind: 'chart' as const, name: 'Shipping chart', members: [], geometry: { nodes: [] } }] },
      activeDiagramId: 'oc-shipping',
    } : one))
  }
  const inspector = () => document.querySelector<HTMLElement>(controlSelector('board.inspector'))!

  it('opens a unit named on a home where it is kept, on that scope\'s chart, chosen, and its domain goes back to that home', async () => {
    renderApp({ repositories: heldRepositories(charted()), today: TODAY })
    await shippingHome()
    fireEvent.click(screen.getByRole('button', { name: 'Parcel & Freight' }))
    await waitFor(() => expect(within(inspector()).queryByTestId('unit-section')).not.toBeNull())
    expect(screen.getByTestId('chart-page')).toBeTruthy()
    expect(within(inspector()).getByDisplayValue('Parcel & Freight')).toBeTruthy()
    // From the other end: the domain it serves opens that domain's home.
    fireEvent.click(within(inspector()).getByRole('button', { name: 'Shipping' }))
    await waitFor(() => expect(screen.getAllByTestId('served-by-row')).toHaveLength(3))
  })

  it('opens a unit from the scope\'s settings too, leaving the dialog', async () => {
    renderApp({ repositories: heldRepositories(charted()), today: TODAY })
    await shippingHome()
    fireEvent.click(screen.getByRole('button', { name: 'Settings for Shipping' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Parcel & Freight' }))
    await waitFor(() => expect(within(inspector()).queryByTestId('unit-section')).not.toBeNull())
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('a new scope, served from the start', { timeout: 20_000 }, () => {
  /** The tree with Operations kept at the organisation, a one-domain unit that serves nothing yet. */
  function withOperations(): ScopeSnapshot[] {
    return tree().map((one) => (one.path === '' ? { ...one, model: { ...one.model, elements: [...one.model.elements, unit('ops', 'Operations', 'ut-domain')] } } : one))
  }

  async function newScope(name: string) {
    fireEvent.click(await screen.findByTestId('new-scope'))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: name } })
    // A domain, which draws nothing: what a scope served by a unit usually is.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Start with a landscape board' }))
    return screen.getByRole('dialog')
  }

  it('offers the units as Served by does, and writes the one picked where it is kept once the scope is made', async () => {
    const repositories = heldRepositories(withOperations())
    renderApp({ repositories, today: TODAY })
    await screen.findByTestId('home-shipping')
    const dialog = await newScope('Customer')
    fireEvent.click(within(dialog).getByTestId('new-scope-served-by-add'))
    // A one-domain unit already serving one is shown, and why it cannot take a second.
    expect(screen.getByRole('option', { name: /Robotics/ }).textContent).toBe('Roboticsa Team serves one domain')
    fireEvent.click(screen.getByRole('option', { name: /Operations/ }))
    expect(within(dialog).getByTestId('new-scope-served-by-unit').textContent).toBe('Operations')
    expect(await axeFindings(dialog)).toEqual([])
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))
    await waitFor(async () => {
      expect(await repositories.read('customer')).toBeDefined()
      const kept = (await repositories.read(''))?.model.elements.find((one) => one.id === 'ops')
      expect(kept?.scopes).toEqual(['customer'])
    })
  })

  it('keeps the scope and says the link was not made when the unit\'s scope refuses it', async () => {
    let locked = false
    const repositories = heldRepositories(withOperations())
    renderApp({ repositories, today: TODAY, provider: { readOnlyAt: (path: string) => locked && path === 'warehouse' } })
    await screen.findByTestId('home-shipping')
    const dialog = await newScope('Customer')
    fireEvent.click(within(dialog).getByTestId('new-scope-served-by-add'))
    fireEvent.click(screen.getByRole('option', { name: /Fulfilment/ }))
    // Somebody takes the right to write Warehouse away before Create is pressed.
    locked = true
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))
    expect(await screen.findByText(/Customer was made, but Fulfilment was not linked to it/)).toBeTruthy()
    expect(await repositories.read('customer')).toBeDefined()
    expect((await repositories.read('warehouse'))?.model.elements.find((one) => one.id === 'fulfilment')?.scopes).toBeUndefined()
  })
})
