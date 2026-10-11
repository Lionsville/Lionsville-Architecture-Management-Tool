// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * What an organisation chart says as a whole, in the inspector beside it
 * while nothing is picked (ADR-0036 §7, 3.6.1), over one fictional
 * organisation — Acme Logistics, with a shipping domain: whose chart and on
 * which day, its units, people and vacancies; the findings, moved here from
 * under the chart, each going to the unit it is about; and how to read it,
 * moved here from the chart's bar.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { useMemo } from 'react'
import { renderShell } from '../testing/renderShell'
import { axeFindings } from '../testing/axe'
import { translator } from '../../i18n'
import type { HostModel } from '../../model/hostModel'
import type { Role, UnitType } from '../../model/operatingModel'
import type { DesignDiagram, DesignElement } from '../../model/types'
import type { Assignment } from '../../model/units'
import type { Person } from '../../people/person'
import { DEFAULT_POLICY } from '../../people/policy'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { PersonNamesProvider, personNames } from '../../people/ui/names'
import { indexScopes } from '../../projects/scopeIndex'
import { ChartSummary } from './ChartSummary'

afterEach(() => cleanup())

const TODAY = '2026-10-11'

const domain: UnitType = { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [{ role: 'ro-owner', min: 1, max: 1 }] }
const cluster: UnitType = { id: 'ut-cluster', name: 'Cluster', top: true, within: ['ut-domain'], slots: [{ role: 'ro-lead', min: 1, max: 1 }] }
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

const ROOT: HostModel = { name: 'Acme Logistics', elements: [], relations: [], diagrams: [], unitTypes: [domain, cluster, team], roles }
const SHIPPING: HostModel = {
  name: 'Shipping',
  elements: [
    actor('shipping', 'Shipping', { unitTypeId: 'ut-domain' }),
    actor('pf', 'Parcel & Freight', { unitTypeId: 'ut-cluster', parentId: 'shipping' }),
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
  { id: 'pe-tim', name: 'Tim de Boer', pseudonym: 'GHJK', kind: 'internal', state: 'active' },
]

function register(people: readonly Person[]): PeopleRegisterAccess {
  const refused = () => Promise.resolve({ refused: 'people.unknown' as const })
  return {
    people, policy: DEFAULT_POLICY, me: undefined, readOnly: false, today: TODAY,
    add: refused, change: refused, leave: refused, forget: refused, remove: refused, merge: refused,
    setPolicy: () => Promise.resolve(), setMe: () => Promise.resolve(), mentionsOf: () => Promise.resolve([]),
  }
}

const LABELS: Record<string, string> = { '': 'Acme Logistics', shipping: 'Shipping' }
const chart = (asOf?: string): DesignDiagram => ({ id: 'oc-1', kind: 'chart', name: 'Organisation', members: [], ...(asOf ? { asOf } : {}) })

function Harness({ asOf, shipping = SHIPPING, people = PEOPLE, onGoTo = () => {} }: {
  asOf?: string; shipping?: HostModel; people?: readonly Person[]; onGoTo?: (unitId: string) => void
}) {
  const index = useMemo(() => indexScopes([{ path: '', model: ROOT }, { path: 'shipping', model: SHIPPING }]), [])
  const names = useMemo(() => personNames(register(people), translator('en')), [people])
  return (
    <PersonNamesProvider names={names}>
      <ChartSummary
        diagram={chart(asOf)} index={index} scope="shipping" model={shipping} today={TODAY}
        scopeLabel={(path) => LABELS[path] ?? path} onGoTo={onGoTo}
      />
    </PersonNamesProvider>
  )
}

const text = (id: string) => screen.getByTestId(id).textContent

describe('the chart\'s summary, beside it while nothing is picked', () => {
  it('says whose chart and on which day, its units and people, and the vacancies in the warning colour', async () => {
    renderShell(<Harness />)
    expect(text('chart-summary-title')).toBe('Shipping, today')
    // Track & Trace has one developer of the two its type asks for.
    expect(text('chart-summary-counts')).toBe('3 units · 3 people · 1 vacant')
    expect(screen.getByTestId('chart-summary-counts').querySelector('[data-part="vacant"]')).not.toBeNull()
    expect(await axeFindings()).toEqual([])
    cleanup()
    renderShell(<Harness asOf="2027-01-01" />)
    expect(text('chart-summary-title')).toBe('Shipping on 1 Jan 2027')
  })

  it('lists the findings, each going to the unit it is about: a person\'s to the first unit they hold a role in', () => {
    const onGoTo = vi.fn()
    renderShell(<Harness onGoTo={onGoTo} />)
    const findings = within(screen.getByTestId('chart-findings')).getAllByTestId('chart-finding')
    const sara = findings.find((line) => line.textContent?.includes('Sara Kaya holds 120% across their roles'))!
    fireEvent.click(sara)
    expect(onGoTo).toHaveBeenLastCalledWith('tt')
    const short = findings.find((line) => line.textContent?.includes('Track & Trace'))!
    fireEvent.click(short)
    expect(onGoTo).toHaveBeenLastCalledWith('tt')
  })

  /** Moved here from the chart page with the findings (3.6.1). */
  it('counts a person kept under an id merged into theirs as one person over all of their time', () => {
    const people: Person[] = [...PEOPLE, { id: 'pe-noor2', pseudonym: 'KLMN', kind: 'internal', state: 'active', mergedInto: 'pe-noor' }]
    const shipping: HostModel = { ...SHIPPING, assignments: [...SHIPPING.assignments!, as('as-5', 'pf', 'ro-dev', 'pe-noor2', { share: 0.5 })] }
    renderShell(<Harness shipping={shipping} people={people} />)
    expect(within(screen.getByTestId('chart-findings')).getByText(/Noor Haddad holds 150% across their roles/)).toBeTruthy()
    expect(text('chart-summary-counts')).toBe('3 units · 3 people · 1 vacant')
  })

  it('says when there is nothing to say, and how to read the chart wherever it is', () => {
    const shipping: HostModel = {
      ...SHIPPING,
      assignments: [
        as('as-1', 'shipping', 'ro-owner', 'pe-noor'), as('as-2', 'pf', 'ro-lead', 'pe-omar'),
        as('as-3', 'tt', 'ro-po', 'pe-sara', { share: 0.5 }), as('as-4', 'tt', 'ro-dev', 'pe-sara', { share: 0.5 }), as('as-5', 'tt', 'ro-dev', 'pe-tim'),
      ],
    }
    renderShell(<Harness shipping={shipping} />)
    expect(text('chart-summary-counts')).toBe('3 units · 4 people')
    expect(text('chart-findings')).toBe('Nothing to say about these units on this day.')
    const read = screen.getByTestId('chart-how-to-read')
    expect([...read.querySelectorAll('[data-mark]')].map((mark) => mark.getAttribute('data-mark'))).toEqual(['vacant', 'over', 'manages', 'ended'])
    expect(within(read).getByText('+ vacant')).toBeTruthy()
    expect(text('chart-read-optional')).toMatch(/Show optional roles draws it here/)
  })
})
