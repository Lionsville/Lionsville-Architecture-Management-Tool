// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A large organisation on its chart (ADR-0036, amended 11 October 2026):
 * fictional Acme Logistics grown to six domains of two clusters of three
 * teams. A first open folds below the second level and says so; a folded
 * unit says what it hides; a caret folds one, *Fold all* and *Unfold all*
 * fold every one; *Find* and the outline unfold the way to a unit; the outline
 * folds on its own and leads the chart when it opens a unit (3.7.3); and the
 * folds — and *Show optional roles* — last for the session, keyed by the
 * view.
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
import { fitZoom } from './useChartZoom'
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

function Harness({ folds, viewId, selectedId, onSelect = () => {} }: { folds?: SessionFolds; viewId?: string; selectedId?: string; onSelect?: (id: string | undefined) => void }) {
  const model = useMemo(organisation, [])
  const index = useMemo(() => indexScopes([{ path: '', model }]), [model])
  const here = useMemo(() => unitViewsHere(index, '', model), [index, model])
  return (
    <ChartPage
      diagram={view(viewId)} here={here} today={TODAY} readOnly={false} people={undefined} scopeLabel={(path) => path || 'Acme Logistics'}
      onSelect={onSelect} onOpenElsewhere={() => {}} scope="" {...(folds ? { folds } : {})} {...(selectedId !== undefined ? { selectedId } : {})}
    />
  )
}

const drawn = () => screen.getAllByTestId('chart-unit').map((box) => box.getAttribute('data-element-id'))
const box = (id: string) => screen.getAllByTestId('chart-unit').find((one) => one.getAttribute('data-element-id') === id)!
const outline = () => screen.getByRole('navigation', { name: 'Units' })
const outlined = () => within(outline()).getAllByTestId('chart-outline-unit').map((row) => row.getAttribute('data-unit-id'))
const DOMAINS = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5']

describe('a large organisation on its chart', () => {
  // 3.7.3: the note no longer counts thirty units — a first open of any size folds below the second level (ChartReading.test opens a small one).
  it('folds a first open below the second level, the Levels control says so, and each folded unit says what it hides', async () => {
    renderShell(<Harness />)
    expect(screen.getByTestId('chart-count').textContent).toBe('54 units · 36 people · 72 roles vacant')
    // The domains and their clusters, and no team.
    expect(drawn()).toHaveLength(18)
    expect(drawn().filter((id) => id!.includes('t'))).toEqual([])
    expect(box('d0c0').getAttribute('data-folded')).toBe('true')
    // Each team is short of its developers, which the organisation's findings say of each — listed in the summary beside the chart (3.6.1).
    expect(within(box('d0c0')).getByTestId('chart-rollup').textContent).toBe('3 units · 6 roles vacant')
    expect(screen.getByRole('radio', { name: '2' }).getAttribute('aria-checked')).toBe('true')
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
    // Folding by hand is the person's own: no level says what is on screen any more.
    expect(screen.getAllByRole('radio').filter((one) => one.getAttribute('aria-checked') === 'true')).toEqual([])
    // A domain folds what is under it, clusters and all, and keeps its own place.
    fireEvent.click(within(box('d2')).getByRole('button', { name: 'Fold Domain 2' }))
    expect(drawn()).not.toContain('d2c1')
    expect(within(box('d2')).getByTestId('chart-rollup').textContent).toBe('8 units · 12 roles vacant')
  })

  it('shows as many levels as the Levels control says: one folds every unit, All opens every one', () => {
    renderShell(<Harness />)
    fireEvent.click(screen.getByRole('radio', { name: 'All' }))
    expect(drawn()).toHaveLength(54)
    fireEvent.click(screen.getByRole('radio', { name: '1' }))
    expect(drawn()).toEqual(DOMAINS)
    fireEvent.click(screen.getByRole('radio', { name: '2' }))
    expect(drawn()).toHaveLength(18)
    // The outline folds on its own: levels are the chart's.
    expect(outlined()).toHaveLength(18)
  })

  it('finds a unit by name as it is typed, Enter going to the first and unfolding the way to it on the chart and in the outline, and choosing it', () => {
    const onSelect = vi.fn()
    renderShell(<Harness onSelect={onSelect} />)
    const field = screen.getByTestId('chart-find-input')
    // A placeholder short enough for the narrow field, and the field's name whole.
    expect(field.getAttribute('placeholder')).toBe('Find…')
    expect(screen.getByRole('combobox', { name: 'Find a unit or person' })).toBe(field)
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'team 3.1.2' } })
    expect(screen.getAllByRole('option')[0].textContent).toBe('Team 3.1.2in Cluster 3.1')
    // The Enter is consumed (fireEvent answers false), so it cannot go on to press the next button that takes the focus.
    expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(false)
    expect(drawn()).toContain('d3c1t2')
    expect(onSelect).toHaveBeenLastCalledWith('d3c1t2')
    expect(outlined()).toContain('d3c1t2')
    expect(within(outline()).getByRole('button', { name: 'Team 3.1.2' }).getAttribute('aria-current')).toBe('true')
    // The rest stays as it was: the cluster beside it is still folded.
    expect(box('d3c0').getAttribute('data-folded')).toBe('true')
    // A miss is said in the list, and moves nothing on the chart.
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'nobody here' } })
    expect(screen.queryAllByRole('option')).toEqual([])
    expect(screen.queryByTestId('chart-note')).toBeNull()
  })

  it('brings the unit gone to on screen in the outline too', () => {
    // jsdom lays nothing out and has no scrollIntoView: a stand-in says what was brought on screen.
    const scrolled: Element[] = []
    const proto = Element.prototype as { scrollIntoView?: () => void }
    proto.scrollIntoView = function (this: Element) { scrolled.push(this) }
    try {
      renderShell(<Harness />)
      const field = screen.getByTestId('chart-find-input')
      fireEvent.focus(field)
      fireEvent.change(field, { target: { value: 'Team 4.0.1' } })
      fireEvent.keyDown(field, { key: 'Enter' })
      expect(scrolled.some((one) => one.getAttribute('data-outline-id') === 'd4c0t1')).toBe(true)
    } finally {
      delete proto.scrollIntoView
    }
  })

  it('walks the outline as a tree by the keyboard, and the chart by its arrows', () => {
    const onSelect = vi.fn()
    renderShell(<Harness onSelect={onSelect} />)
    expect(within(outline()).getByRole('tree')).toBeTruthy()
    const first = within(outline()).getByRole('button', { name: 'Domain 0' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toBe('Cluster 0.0')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    expect(outlined()).toContain('d0c0t0')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' })
    expect(outlined()).not.toContain('d0c0t0')
    const onChart = within(box('d1')).getByTestId('chart-unit-open')
    fireEvent.keyDown(onChart, { key: 'ArrowLeft' })
    expect(document.activeElement?.textContent).toBe('Domain 0')
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
    expect(onSelect).toHaveBeenLastCalledWith('d0')
  })

  // 3.7.3: unfolding in the outline unfolds on the chart too; until then the outline's caret left the chart as it was.
  it('leads the chart from the outline: a unit unfolded there is unfolded, gone to and picked on the chart; folding there folds the outline alone', () => {
    const onSelect = vi.fn()
    renderShell(<Harness onSelect={onSelect} />)
    fireEvent.click(within(outline()).getByRole('button', { name: 'Unfold Cluster 5.0' }))
    expect(outlined()).toContain('d5c0t1')
    expect(drawn()).toEqual(expect.arrayContaining(['d5c0t0', 'd5c0t1', 'd5c0t2']))
    expect(box('d5c0').getAttribute('data-folded')).not.toBe('true')
    expect(onSelect).toHaveBeenLastCalledWith('d5c0')
    // Folding it again in the outline leaves the chart open.
    fireEvent.click(within(outline()).getByRole('button', { name: 'Fold Cluster 5.0' }))
    expect(outlined()).not.toContain('d5c0t1')
    expect(drawn()).toContain('d5c0t1')
    // And a fold on the chart leaves the outline as it is.
    fireEvent.click(within(box('d5c0')).getByRole('button', { name: 'Fold Cluster 5.0' }))
    fireEvent.click(within(outline()).getByRole('button', { name: 'Unfold Cluster 5.0' }))
    expect(drawn()).toContain('d5c0t1')
  })

  it('goes to a unit picked in the outline: it and the units above it unfolded on the chart, and picked', () => {
    const onSelect = vi.fn()
    renderShell(<Harness onSelect={onSelect} />)
    // A cluster folded on the first open, picked by its name: unfolded on the chart with its teams, and picked.
    fireEvent.click(within(outline()).getByRole('button', { name: 'Cluster 2.1' }))
    expect(drawn()).toEqual(expect.arrayContaining(['d2c1t0', 'd2c1t1', 'd2c1t2']))
    expect(onSelect).toHaveBeenLastCalledWith('d2c1')
    // A domain folded on the chart by hand comes open again for a unit inside it picked in the outline.
    fireEvent.click(within(box('d4')).getByRole('button', { name: 'Fold Domain 4' }))
    expect(drawn()).not.toContain('d4c0')
    fireEvent.click(within(outline()).getByRole('button', { name: 'Unfold Cluster 4.0' }))
    fireEvent.click(within(outline()).getByRole('button', { name: 'Team 4.0.1' }))
    expect(drawn()).toContain('d4c0t1')
    expect(onSelect).toHaveBeenLastCalledWith('d4c0t1')
  })

  it('keeps its folds for the session, keyed by the view: a second open is as it was left, another view opens on its own', () => {
    const folds = new SessionFolds()
    renderShell(<Harness folds={folds} />)
    fireEvent.click(within(box('d1c0')).getByRole('button', { name: 'Unfold Cluster 1.0' }))
    cleanup()
    renderShell(<Harness folds={folds} />)
    expect(drawn()).toContain('d1c0t0')
    expect(box('d0c0').getAttribute('data-folded')).toBe('true')
    cleanup()
    renderShell(<Harness folds={folds} viewId="oc-2" />)
    expect(drawn()).not.toContain('d1c0t0')
  })

  it('keeps who it draws for the session, keyed by the view, as it keeps the folds', () => {
    const folds = new SessionFolds()
    const leads = () => screen.queryAllByTestId('chart-slot-ro-lead')
    const say = (word: string, item: string) => {
      fireEvent.click(screen.getByRole('button', { name: word }))
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: item }))
    }
    renderShell(<Harness folds={folds} />)
    fireEvent.click(screen.getByRole('radio', { name: 'All' }))
    // Every team's lead is optional and nobody holds one: none is drawn.
    say('People: Leaders', 'Required roles')
    expect(leads()).toEqual([])
    say('People: Required roles', 'All roles')
    expect(leads()).toHaveLength(36)
    cleanup()
    renderShell(<Harness folds={folds} />)
    expect(screen.getByRole('button', { name: 'People: All roles' })).toBeTruthy()
    expect(leads()).toHaveLength(36)
    cleanup()
    renderShell(<Harness folds={folds} viewId="oc-2" />)
    expect(screen.getByRole('button', { name: 'People: Leaders' })).toBeTruthy()
  })

  it('focuses on a unit with the way up on one line, and comes back to the whole chart', () => {
    const onSelect = vi.fn()
    renderShell(<Harness onSelect={onSelect} selectedId="d2c1" />)
    fireEvent.click(screen.getByTestId('chart-focus'))
    expect(drawn()).toEqual(['d2c1', 'd2c1t0', 'd2c1t1', 'd2c1t2'])
    expect(screen.getByTestId('chart-focus-way').textContent).toBe('Focus: Acme Logistics › Domain 2 › Cluster 2.1')
    // Under a focus the units hang in a grid, and the outline is of what is drawn.
    expect(box('d2c1t0').closest('[data-tree-under]')?.getAttribute('data-shape')).toBe('grid')
    expect(outlined()).toEqual(['d2c1', 'd2c1t0', 'd2c1t1', 'd2c1t2'])
    fireEvent.click(screen.getByTestId('chart-focus-back'))
    expect(drawn().length).toBeGreaterThan(4)
    expect(screen.queryByTestId('chart-focus-way')).toBeNull()
  })

  it('zooms by its dock, and Fit stops where a name can still be read', () => {
    renderShell(<Harness />)
    const stage = () => document.querySelector<HTMLElement>('.chart-stage')!
    expect(stage().style.getPropertyValue('zoom')).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }))
    expect(stage().style.getPropertyValue('zoom')).toBe('1.1')
    expect(fitZoom({ width: 500, height: 400 }, { width: 2000, height: 400 })).toBe(0.6)
    expect(fitZoom({ width: 1000, height: 800 }, { width: 1250, height: 400 })).toBe(0.8)
    expect(fitZoom({ width: 1000, height: 800 }, { width: 400, height: 300 })).toBe(1)
  })
})
