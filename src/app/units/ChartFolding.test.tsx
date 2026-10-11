// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A large organisation on its chart (ADR-0036, amended 11 October 2026):
 * fictional Acme Logistics grown to six domains of two clusters of three
 * teams. A first open folds below the second level and says so; a folded
 * unit says what it hides; a caret folds one, *Fold all* and *Unfold all*
 * fold every one; *Find* and the outline unfold the way to a unit; the outline
 * folds on its own; and the folds — and *Show optional roles* — last for the
 * session, keyed by the view.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { useMemo } from 'react'
import { renderShell } from '../testing/renderShell'
import type { HostModel } from '../../model/hostModel'
import type { Role, UnitType } from '../../model/operatingModel'
import type { DesignDiagram, DesignElement } from '../../model/types'
import type { Assignment } from '../../model/units'
import { indexScopes } from '../../projects/scopeIndex'
import { axeFindings } from '../testing/axe'
import { SessionFolds } from '../sessionFolds'
import { ChartPage } from './ChartPage'
import { unitViewsHere } from './unitViewsHere'

afterEach(() => cleanup())

const TODAY = '2026-10-11'

const domain: UnitType = { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [] }
const cluster: UnitType = { id: 'ut-cluster', name: 'Cluster', top: true, within: ['ut-domain'], slots: [] }
const team: UnitType = {
  id: 'ut-team', name: 'Team', within: ['ut-cluster'], slots: [{ role: 'ro-po', min: 1, max: 1 }, { role: 'ro-dev', min: 2 }, { role: 'ro-lead', min: 0, max: 1 }],
}
const roles: Role[] = [
  { id: 'ro-po', name: 'Product owner', duties: [], manages: true }, { id: 'ro-dev', name: 'Developer', duties: [] },
  { id: 'ro-lead', name: 'Team lead', duties: [] },
]

const actor = (id: string, name: string, unitTypeId: string, parentId?: string): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId, ...(parentId ? { parentId } : {}),
})

/** Six domains of two clusters of three teams, each team with its product owner and short of both developers. */
function organisation(): HostModel {
  const elements: DesignElement[] = []
  const assignments: Assignment[] = []
  for (let d = 0; d < 6; d += 1) {
    elements.push(actor(`d${d}`, `Domain ${d}`, 'ut-domain'))
    for (let c = 0; c < 2; c += 1) {
      elements.push(actor(`d${d}c${c}`, `Cluster ${d}.${c}`, 'ut-cluster', `d${d}`))
      for (let t = 0; t < 3; t += 1) {
        const id = `d${d}c${c}t${t}`
        elements.push(actor(id, `Team ${d}.${c}.${t}`, 'ut-team', `d${d}c${c}`))
        assignments.push({ id: `as-${id}`, unitId: id, roleId: 'ro-po', person: { person: `pe-${id}` } })
      }
    }
  }
  return { name: 'Acme Logistics', elements, relations: [], diagrams: [], unitTypes: [domain, cluster, team], roles, assignments }
}

const view = (id = 'oc-1'): DesignDiagram => ({ id, kind: 'chart', name: 'Organisation', members: [] })

function Harness({ folds, viewId, onSelect = () => {} }: { folds?: SessionFolds; viewId?: string; onSelect?: (id: string | undefined) => void }) {
  const model = useMemo(organisation, [])
  const index = useMemo(() => indexScopes([{ path: '', model }]), [model])
  const here = useMemo(() => unitViewsHere(index, '', model), [index, model])
  return (
    <ChartPage
      diagram={view(viewId)} here={here} today={TODAY} readOnly={false} people={undefined} scopeLabel={(path) => path || 'Acme Logistics'}
      onSelect={onSelect} onOpenElsewhere={() => {}} scope="" {...(folds ? { folds } : {})}
    />
  )
}

const drawn = () => screen.getAllByTestId('chart-unit').map((box) => box.getAttribute('data-element-id'))
const box = (id: string) => screen.getAllByTestId('chart-unit').find((one) => one.getAttribute('data-element-id') === id)!
const outline = () => screen.getByRole('navigation', { name: 'Units' })
const outlined = () => within(outline()).getAllByTestId('chart-outline-unit').map((row) => row.getAttribute('data-unit-id'))
const DOMAINS = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5']

describe('a large organisation on its chart', () => {
  it('folds a first open of more than thirty units below the second level, says so, and each folded unit says what it hides', async () => {
    renderShell(<Harness />)
    expect(screen.getByTestId('chart-count').textContent).toBe('54 units · 36 people')
    // The domains and their clusters, and no team.
    expect(drawn()).toHaveLength(18)
    expect(drawn().filter((id) => id!.includes('t'))).toEqual([])
    expect(box('d0c0').getAttribute('data-folded')).toBe('true')
    // Each team is short of its developers, which the organisation's findings say of each — listed in the summary beside the chart (3.6.1).
    expect(within(box('d0c0')).getByTestId('chart-rollup').textContent).toBe('3 units · 3 people · 6 vacant · 3 to look at')
    expect(screen.getByTestId('chart-folded-note').textContent).toMatch(/More than 30 units: folded below the second level for this session/)
    // The outline folds the same on a first open.
    expect(outlined()).toHaveLength(18)
    expect(await axeFindings()).toEqual([])
  })

  it('folds and unfolds one unit by its caret, a button that names it and says whether it is open', () => {
    renderShell(<Harness />)
    const caret = within(box('d2c1')).getByRole('button', { name: 'Unfold Cluster 2.1' })
    expect(caret.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(caret)
    expect(drawn()).toEqual(expect.arrayContaining(['d2c1t0', 'd2c1t1', 'd2c1t2']))
    expect(within(box('d2c1')).queryByTestId('chart-rollup')).toBeNull()
    expect(within(box('d2c1')).getByRole('button', { name: 'Fold Cluster 2.1' }).getAttribute('aria-expanded')).toBe('true')
    // Folding by hand is the person's own: the page no longer says why it opened folded.
    expect(screen.queryByTestId('chart-folded-note')).toBeNull()
    // A domain folds what is under it, clusters and all, and keeps its own place.
    fireEvent.click(within(box('d2')).getByRole('button', { name: 'Fold Domain 2' }))
    expect(drawn()).not.toContain('d2c1')
    expect(within(box('d2')).getByTestId('chart-rollup').textContent).toBe('8 units · 6 people · 12 vacant · 6 to look at')
  })

  it('folds every unit with units under it by Fold all, and opens every one by Unfold all', () => {
    renderShell(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Unfold all' }))
    expect(drawn()).toHaveLength(54)
    fireEvent.click(screen.getByRole('button', { name: 'Fold all' }))
    expect(drawn()).toEqual(DOMAINS)
    // The outline folds on its own: Fold all is the chart's.
    expect(outlined()).toHaveLength(18)
  })

  it('finds a unit by name — Enter or Find — unfolding the way to it on the chart and in the outline, and choosing it', () => {
    const onSelect = vi.fn()
    renderShell(<Harness onSelect={onSelect} />)
    const field = screen.getByRole('textbox', { name: 'Find a unit' })
    fireEvent.change(field, { target: { value: 'team 3.1.2' } })
    // The Enter is consumed (fireEvent answers false), so it cannot go on to press the next button that takes the focus.
    expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(false)
    expect(drawn()).toContain('d3c1t2')
    expect(onSelect).toHaveBeenLastCalledWith('d3c1t2')
    expect(outlined()).toContain('d3c1t2')
    expect(within(outline()).getByRole('button', { name: 'Team Team 3.1.2' }).getAttribute('aria-current')).toBe('true')
    // The rest stays as it was: the cluster beside it is still folded.
    expect(box('d3c0').getAttribute('data-folded')).toBe('true')
    fireEvent.change(field, { target: { value: 'nobody here' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find' }))
    expect(screen.getByTestId('chart-note').textContent).toBe('No unit on this chart is called that.')
  })

  it('brings the unit gone to on screen in the outline too', () => {
    // jsdom lays nothing out and has no scrollIntoView: a stand-in says what was brought on screen.
    const scrolled: Element[] = []
    const proto = Element.prototype as { scrollIntoView?: () => void }
    proto.scrollIntoView = function (this: Element) { scrolled.push(this) }
    try {
      renderShell(<Harness />)
      const field = screen.getByRole('textbox', { name: 'Find a unit' })
      fireEvent.change(field, { target: { value: 'Team 4.0.1' } })
      fireEvent.click(screen.getByRole('button', { name: 'Find' }))
      expect(scrolled.some((one) => one.getAttribute('data-outline-id') === 'd4c0t1')).toBe(true)
    } finally {
      delete proto.scrollIntoView
    }
  })

  it('goes to a unit picked in the outline, unfolding its way on the chart; the outline folds on its own', () => {
    const onSelect = vi.fn()
    renderShell(<Harness onSelect={onSelect} />)
    const caret = within(outline()).getByRole('button', { name: 'Unfold Cluster 5.0' })
    fireEvent.click(caret)
    // The outline unfolded, the chart did not.
    expect(outlined()).toContain('d5c0t1')
    expect(drawn()).not.toContain('d5c0t1')
    fireEvent.click(within(outline()).getByRole('button', { name: 'Team Team 5.0.1' }))
    expect(drawn()).toContain('d5c0t1')
    expect(onSelect).toHaveBeenLastCalledWith('d5c0t1')
  })

  it('keeps its folds for the session, keyed by the view: a second open is as it was left, another view opens on its own', () => {
    const folds = new SessionFolds()
    renderShell(<Harness folds={folds} />)
    fireEvent.click(within(box('d1c0')).getByRole('button', { name: 'Unfold Cluster 1.0' }))
    cleanup()
    renderShell(<Harness folds={folds} />)
    expect(drawn()).toContain('d1c0t0')
    expect(box('d0c0').getAttribute('data-folded')).toBe('true')
    expect(screen.queryByTestId('chart-folded-note')).toBeNull()
    cleanup()
    renderShell(<Harness folds={folds} viewId="oc-2" />)
    expect(drawn()).not.toContain('d1c0t0')
    expect(screen.getByTestId('chart-folded-note')).toBeTruthy()
  })

  it('keeps Show optional roles for the session, keyed by the view, as it keeps the folds', () => {
    const folds = new SessionFolds()
    const leads = () => screen.queryAllByTestId('chart-slot-ro-lead')
    renderShell(<Harness folds={folds} />)
    fireEvent.click(screen.getByRole('button', { name: 'Unfold all' }))
    // Every team's lead is optional and nobody holds one: none is drawn.
    expect(leads()).toEqual([])
    fireEvent.click(screen.getByRole('switch', { name: 'Show optional roles' }))
    expect(leads()).toHaveLength(36)
    cleanup()
    renderShell(<Harness folds={folds} />)
    expect((screen.getByRole('switch', { name: 'Show optional roles' }) as HTMLInputElement).checked).toBe(true)
    expect(leads()).toHaveLength(36)
    cleanup()
    renderShell(<Harness folds={folds} viewId="oc-2" />)
    expect((screen.getByRole('switch', { name: 'Show optional roles' }) as HTMLInputElement).checked).toBe(false)
  })
})
