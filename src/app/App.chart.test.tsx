// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The inspector beside an organisation chart in the app (ADR-0036 §7, 3.6.1):
 * with nothing picked it says what the chart says as a whole — in place of
 * the canvas hint, which says nothing about a chart — and a finding there goes
 * to its unit on the chart, which the editor then selects; a person's chip
 * puts their assignment in its place.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { Person } from '../people/person'
import type { ScopeSnapshot } from '../projects/scope'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

afterEach(() => cleanup())

const TODAY = '2026-10-11'

const SARA: Person = { id: 'pe-sara', name: 'Sara Kaya', pseudonym: 'DFGH', kind: 'internal', state: 'active' }

/** Acme Logistics with one team, its lead held and its one developer missing, and its chart open. */
const organisation: ScopeSnapshot = {
  path: '',
  model: {
    name: 'Acme Logistics', relations: [],
    elements: [{ id: 'webshop', kind: 'actor', name: 'Webshop', lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId: 'ut-team' }],
    unitTypes: [{ id: 'ut-team', name: 'Team', top: true, within: [], slots: [{ role: 'ro-lead', min: 1, max: 1 }, { role: 'ro-dev', min: 1 }] }],
    roles: [{ id: 'ro-lead', name: 'Team lead', duties: [] }, { id: 'ro-dev', name: 'Developer', duties: [] }],
    assignments: [{ id: 'as-1', unitId: 'webshop', roleId: 'ro-lead', person: { person: 'pe-sara' }, from: '2026-01-01' }],
    diagrams: [{ id: 'oc-1', kind: 'chart', name: 'Organisation', members: [], geometry: { nodes: [] } }],
  },
  activeDiagramId: 'oc-1',
  logoLibrary: [],
}

describe('the inspector beside the organisation chart', () => {
  it('says what the chart says as a whole while nothing is picked, and a finding there goes to its unit', async () => {
    const held = heldRepositories([organisation])
    await held.people.bringIn([SARA])
    renderApp({ repositories: held, today: () => TODAY, boot: { initialProject: organisation } })
    const summary = await screen.findByTestId('chart-summary')
    expect(within(summary).getByTestId('chart-summary-title').textContent).toBe('Acme Logistics, today')
    expect(within(summary).getByTestId('chart-summary-counts').textContent).toBe('1 unit · 1 person · 1 vacant')
    expect(screen.queryByText(/Select an element or connection/)).toBeNull()
    fireEvent.click(within(summary).getAllByTestId('chart-finding').find((line) => line.textContent?.includes('Webshop'))!)
    // The unit is selected, so the inspector is the unit's.
    await waitFor(() => expect(screen.queryByTestId('chart-summary')).toBeNull())
    expect(screen.getByDisplayValue('Webshop')).toBeTruthy()
  })

  it('puts a person\'s assignment in the summary\'s place when their chip is pressed', async () => {
    const held = heldRepositories([organisation])
    await held.people.bringIn([SARA])
    renderApp({ repositories: held, today: () => TODAY, boot: { initialProject: organisation } })
    await screen.findByTestId('chart-summary')
    await waitFor(() => expect(screen.getByTestId('chart-holder').textContent).toBe('Sara Kaya'))
    fireEvent.click(screen.getByTestId('chart-holder'))
    await screen.findByTestId('assignment-inspector')
    expect(screen.queryByTestId('chart-summary')).toBeNull()
  })
})
