// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Pressing a unit on the organisation chart, in the app (ADR-0036 §7, 3.6.2):
 * one the open scope keeps is selected and the inspector docked beside the
 * chart is the unit's, unit first; one another scope keeps opens there, on
 * that scope's chart, selected, with the same inspector. Neither ever shows
 * the panel for several things selected.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { DesignElement } from '../model/types'
import { controlSelector } from '../platform/controlNames'
import type { ScopeSnapshot } from '../projects/scope'
import { axeFindings } from './testing/axe'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

configure({ asyncUtilTimeout: 5_000 })
afterEach(() => cleanup())

const TODAY = '2026-10-12'

const actor = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})

/** Acme Logistics: a team kept at the organisation, and a domain with a cluster kept in its own scope; a chart in each. */
const organisation: ScopeSnapshot = {
  path: '',
  model: {
    name: 'Acme Logistics', relations: [],
    elements: [actor('webshop', 'Webshop', { unitTypeId: 'ut-domain' })],
    unitTypes: [
      { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [{ role: 'ro-lead', min: 1, max: 1 }] },
      { id: 'ut-cluster', name: 'Cluster', within: ['ut-domain'], slots: [{ role: 'ro-lead', min: 1, max: 1 }] },
    ],
    roles: [{ id: 'ro-lead', name: 'Lead', duties: [] }],
    diagrams: [{ id: 'oc-root', kind: 'chart', name: 'Organisation', members: [], geometry: { nodes: [] } }],
  },
  activeDiagramId: 'oc-root',
  logoLibrary: [],
}
const customer: ScopeSnapshot = {
  path: 'customer',
  model: {
    name: 'Customer', relations: [],
    elements: [actor('customer', 'Customer', { unitTypeId: 'ut-domain' }), actor('sales', 'Sales', { unitTypeId: 'ut-cluster', parentId: 'customer' })],
    assignments: [{ id: 'as-sales', unitId: 'sales', roleId: 'ro-lead', person: { person: 'pe-ines' }, from: '2026-01-05' }],
    diagrams: [{ id: 'oc-customer', kind: 'chart', name: 'Customer chart', members: [], geometry: { nodes: [] } }],
  },
  activeDiagramId: 'oc-customer',
  logoLibrary: [],
}

const inspector = () => document.querySelector<HTMLElement>(controlSelector('board.inspector'))!
const unitOpen = (id: string) => document.querySelector<HTMLElement>(`[data-testid="chart-unit"][data-element-id="${id}"] [data-testid="chart-unit-open"]`)

async function press(id: string, twice = false) {
  const button = await waitFor(() => {
    const found = unitOpen(id)
    expect(found, id).not.toBeNull()
    return found!
  })
  fireEvent.click(button)
  if (twice) {
    fireEvent.click(button)
    fireEvent.doubleClick(button)
  }
}

describe('pressing a unit on the organisation chart', { timeout: 20_000 }, () => {
  it('selects one this scope keeps, and the inspector beside the chart is the unit\'s', async () => {
    renderApp({ repositories: heldRepositories([organisation, customer]), today: () => TODAY, boot: { initialProject: organisation } })
    await screen.findByTestId('chart-summary')
    await press('webshop')
    const section = await within(inspector()).findByTestId('unit-section')
    expect(section).toBeTruthy()
    expect(within(inspector()).queryByText(/selected/)).toBeNull()
    expect(await axeFindings(inspector())).toEqual([])
  })

  it('goes to one another scope keeps on a click, and opens it there on a double-click, on its chart, selected, with the unit\'s inspector', async () => {
    renderApp({ repositories: heldRepositories([organisation, customer]), today: () => TODAY, boot: { initialProject: organisation } })
    await screen.findByTestId('chart-summary')
    await press('sales')
    // A click stays on this chart: the summary is still the inspector's.
    expect(within(inspector()).getByTestId('chart-summary')).toBeTruthy()
    expect(within(inspector()).queryByTestId('unit-section')).toBeNull()
    await press('sales', true)
    await waitFor(() => expect(within(inspector()).queryByTestId('unit-section')).not.toBeNull())
    expect(within(inspector()).getByDisplayValue('Sales')).toBeTruthy()
    expect(within(inspector()).queryByText(/selected/)).toBeNull()
    expect(screen.getByTestId('chart-page')).toBeTruthy()
    expect(await axeFindings(inspector())).toEqual([])
  })

  it('chooses a person in a unit another scope keeps by a click, without leaving the chart: the inspector reads the assignment and opens it there on request', async () => {
    renderApp({ repositories: heldRepositories([organisation, customer]), today: () => TODAY, boot: { initialProject: organisation } })
    await screen.findByTestId('chart-summary')
    const chip = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-testid="chart-unit"][data-element-id="sales"] [data-testid="chart-holder"]')
      expect(found).not.toBeNull()
      return found!
    })
    fireEvent.click(chip)
    const read = await within(inspector()).findByTestId('assignment-inspector')
    expect(within(read).getByTestId('assignment-role').textContent).toContain('Lead in Sales')
    expect(within(read).getByTestId('assignment-kept-in').textContent).toBe('Kept in Customer: it is changed there.')
    expect(within(read).queryByTestId('assignment-end')).toBeNull()
    expect(screen.getByTestId('chart-page')).toBeTruthy()
    expect(document.querySelector('[data-testid="chart-holder"][data-chosen="true"]')).toBe(chip)
    fireEvent.click(within(read).getByTestId('assignment-open-there'))
    await waitFor(() => expect(within(inspector()).queryByTestId('unit-section')).not.toBeNull())
    expect(within(inspector()).getByDisplayValue('Sales')).toBeTruthy()
  })
})
