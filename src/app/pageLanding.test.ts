// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where opening a scope on a page lands: a view by id, the one on the tab or
 * the first of its kind, the home where there is none — never a view made —
 * and an element on the board that draws it.
 */
import { describe, expect, it } from 'vitest'
import { laidOut } from '../model/testFixtures'
import type { DesignDiagram, DesignElement } from '../model'
import { pageLanding } from './pageLanding'

const app = (id: string): DesignElement => ({ id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {} })
const view = (id: string, kind: DesignDiagram['kind']): DesignDiagram => ({ id, kind, name: id, members: [], geometry: { nodes: [] } })
const scope = (diagrams: DesignDiagram[], activeDiagramId = '') => ({
  model: { name: 'Landscape', elements: [app('billing'), app('crm')], relations: [], diagrams },
  activeDiagramId,
})

describe('pageLanding', () => {
  const boards = [
    laidOut({ id: 'b1', kind: 'layer7', name: 'One', placements: [{ id: 'billing', x: 0, y: 0 }] }),
    laidOut({ id: 'b2', kind: 'layer7', name: 'Two', placements: [{ id: 'crm', x: 0, y: 0 }] }),
  ]

  /** Opened with no page named, a scope that draws nothing has only its home to show. */
  it('lands a scope with no views on its home when no page is named', () => {
    expect(pageLanding(scope([]), undefined)).toEqual({ home: true })
    expect(pageLanding(scope(boards, 'b1'), undefined)).toEqual({})
  })

  it('opens a view it names, and starts the session on it', () => {
    expect(pageLanding(scope([view('s1', 'sheet'), view('s2', 'sheet')]), { page: 'sheet', id: 's2', select: 'x' }))
      .toEqual({ page: { page: 'sheet', id: 's2', select: 'x' }, activeDiagramId: 's2' })
  })

  it('opens the one on the tab, else the first of its kind, for a view’s page with no id', () => {
    const sheets = [view('s1', 'sheet'), view('m1', 'map'), view('s2', 'sheet')]
    expect(pageLanding(scope(sheets, 's2'), { page: 'sheet' })).toEqual({ page: { page: 'sheet', id: 's2' }, activeDiagramId: 's2' })
    expect(pageLanding(scope(sheets, 'm1'), { page: 'sheet' })).toEqual({ page: { page: 'sheet', id: 's1' }, activeDiagramId: 's1' })
    expect(pageLanding(scope([...boards, view('t1', 'technology')], 'b2'), { page: 'board' }))
      .toEqual({ page: { page: 'board', id: 'b2' }, activeDiagramId: 'b2' })
  })

  it('lands on the home where the scope has no view of that kind, and makes none', () => {
    expect(pageLanding(scope([view('s1', 'sheet')]), { page: 'map' })).toEqual({ home: true })
    expect(pageLanding(scope([view('s1', 'sheet')]), { page: 'technology' })).toEqual({ home: true })
    expect(pageLanding(scope([view('s1', 'sheet')]), { page: 'board' })).toEqual({ home: true })
  })

  it('leaves the person’s own make as it was asked', () => {
    expect(pageLanding(scope([]), { page: 'make', kind: 'map' })).toEqual({ page: { page: 'make', kind: 'map' } })
  })

  it('starts an element’s page on the one board that draws it, where the tab’s does not', () => {
    expect(pageLanding(scope(boards, 'b1'), { page: 'element', id: 'crm' }))
      .toEqual({ page: { page: 'element', id: 'crm' }, activeDiagramId: 'b2' })
    expect(pageLanding(scope(boards, 'b1'), { page: 'element', id: 'billing' })).toEqual({ page: { page: 'element', id: 'billing' } })
    expect(pageLanding(scope(boards, 'b1'), { page: 'element', id: 'nowhere' })).toEqual({ page: { page: 'element', id: 'nowhere' } })
  })

  it('leaves every other page as it was, and no page as none', () => {
    expect(pageLanding(scope(boards), { page: 'observations', tab: 'analysis' })).toEqual({ page: { page: 'observations', tab: 'analysis' } })
    expect(pageLanding(scope(boards), undefined)).toEqual({})
  })
})
