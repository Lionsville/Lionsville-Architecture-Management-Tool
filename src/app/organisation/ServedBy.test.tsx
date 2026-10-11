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
    expect(await screen.findByText('Fulfilment now serves Shipping: one step in Warehouse.')).toBeTruthy()
    await waitFor(() => expect(rows()).toContain('Cluster · Fulfilmentnobody manages it today · filed in Warehouse✕'))
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
