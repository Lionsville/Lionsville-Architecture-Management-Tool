// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The workspace's hooks that hold a rule, each mounted alone over a real
 * session: the pages beside the canvas one at a time, the requests into the
 * editor, what the tree says about this scope, and what the analysis pages
 * hand back. The workspace composes them (`ProjectWorkspace.tsx`); the App
 * suites pin the same behaviour end to end.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { translator } from '../i18n'
import { useShownDays } from '../editor'
import { laidOut } from '../model/testFixtures'
import { decisionList, solutionsOf } from '../model'
import type { DesignElement, Solution } from '../model'
import type { HostModel } from '../model/hostModel'
import type { ScopeSnapshot } from '../projects/scope'
import { indexScopes } from '../projects/scopeIndex'
import { useModelSession } from './useModelSession'
import { useAnalysisActions } from './useAnalysisActions'
import { useTreeReadings } from './useTreeReadings'
import { useWorkspacePages } from './useWorkspacePages'
import { useWorkspaceRequests } from './useWorkspaceRequests'

afterEach(() => cleanup())

const s = translator('en')

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over }
}

function model(over: Partial<HostModel> = {}): HostModel {
  return {
    name: 'Landscape',
    elements: [element('pos', { name: 'Point of sale' }), element('crm', { name: 'CRM', ref: 'north' })],
    relations: [],
    diagrams: [
      laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] }),
      laidOut({ id: 'd2', kind: 'layer7', name: 'Other', placements: [] }),
    ],
    ...over,
  }
}

const snapshot = (m: HostModel): ScopeSnapshot => ({ path: 'north/south', model: m, activeDiagramId: 'd1', logoLibrary: [] })

/** The tree around it: the scope above defines the CRM this one draws. */
const index = indexScopes([
  { path: '', model: { elements: [], relations: [] } },
  { path: 'north', model: { elements: [element('crm', { name: 'CRM' }), element('erp', { name: 'ERP' })], relations: [] } },
  { path: 'north/south', model: { elements: model().elements, relations: [] } },
])

describe('the pages beside the canvas', () => {
  function mount(m = model()) {
    const maps = { mapId: undefined, map: undefined, open: vi.fn(), create: vi.fn() }
    const landscapes = { diagramId: undefined, diagram: undefined, focus: undefined, open: vi.fn(), create: vi.fn(), showOn: vi.fn() }
    const onGoHome = vi.fn()
    const view = renderHook(() => {
      const session = useModelSession({ initialProject: snapshot(m), notify: vi.fn(), s })
      const viewing = useShownDays(() => undefined)
      const pages = useWorkspacePages({
        session, scope: 'north/south', makeId: (prefix) => `${prefix}-1`, s, viewing,
        focusElement: vi.fn(), maps, landscapes, onGoHome,
      })
      return { session, pages }
    })
    const pages = () => view.result.current.pages
    return { view, pages, maps, landscapes, onGoHome }
  }

  it('are one at a time: opening one closes whichever was up', () => {
    const { pages } = mount()
    expect(pages().page()).toBeUndefined()
    act(() => pages().openDecisions('adr-1'))
    expect(pages().page()).toEqual({ page: 'decisions', id: 'adr-1' })
    act(() => pages().openObservations('obs-1'))
    expect(pages().page()).toEqual({ page: 'observations', id: 'obs-1' })
    expect(pages().adrPage.open).toBe(false)
    act(() => pages().openRoadmap())
    expect(pages().page()).toEqual({ page: 'roadmap' })
    expect(pages().obsPage.open).toBe(false)
    act(() => pages().openServiceReport('svc'))
    expect(pages().page()).toEqual({ page: 'service', id: 'svc' })
    expect(pages().plans.roadmapOpen).toBe(false)
    act(() => pages().openDecisions())
    expect(pages().page()).toEqual({ page: 'decisions' })
    expect(pages().platformReading.serviceId).toBeUndefined()
  })

  it('close them all when a view is opened on its tab, which becomes the active one', () => {
    const { view, pages } = mount()
    act(() => pages().openRoadmap())
    act(() => pages().openView('d2'))
    expect(pages().page()).toBeUndefined()
    expect(view.result.current.session.activeDiagramId).toBe('d2')
  })

  it('close them before a map or a landscape is made', () => {
    const { pages, maps, landscapes } = mount()
    act(() => pages().openDecisions())
    act(() => pages().createMap())
    expect(maps.create).toHaveBeenCalledTimes(1)
    expect(pages().page()).toBeUndefined()
    act(() => pages().openObservations())
    act(() => pages().openTechnologyFor('pos'))
    expect(landscapes.showOn).toHaveBeenCalledWith('pos')
    expect(pages().page()).toBeUndefined()
  })

  it('leave a scope that draws nothing for its home when one closes, and stay over a board', () => {
    const drawn = mount()
    act(() => drawn.pages().leaveIfNothingToDraw())
    expect(drawn.onGoHome).not.toHaveBeenCalled()
    cleanup()
    const bare = mount(model({ diagrams: [] }))
    act(() => bare.pages().leaveIfNothingToDraw())
    expect(bare.onGoHome).toHaveBeenCalledWith('north/south')
  })
})

describe('the requests into the editor', () => {
  function mount(m = model(), onOpenScope = vi.fn()) {
    const notify = vi.fn()
    const view = renderHook(() => {
      const session = useModelSession({ initialProject: snapshot(m), notify, s })
      return useWorkspaceRequests({ session, scope: 'north/south', indexRef: { current: index }, onOpenScope, notify, s })
    })
    return { view, notify, onOpenScope }
  }

  it('are new each time they are asked, even for the same element', () => {
    const { view } = mount()
    act(() => view.result.current.focusElement('pos'))
    expect(view.result.current.focus).toEqual({ id: 'pos', nonce: 1 })
    act(() => view.result.current.focusElement('pos'))
    expect(view.result.current.focus).toEqual({ id: 'pos', nonce: 2 })
  })

  it('open a stand-in\'s page in the scope that answers for it, and a record of this scope here', () => {
    const { view, onOpenScope } = mount()
    act(() => view.result.current.openDocumentation('crm'))
    expect(onOpenScope).toHaveBeenCalledWith('north', { page: 'document', id: 'crm' })
    expect(view.result.current.documentation).toBeUndefined()
    act(() => view.result.current.openDocumentation('pos', 'd1'))
    expect(view.result.current.documentation).toEqual({ elementId: 'pos', diagramId: 'd1', nonce: 1 })
  })

  it('say so rather than open a documentation page over nothing', () => {
    const { view, notify } = mount(model({ elements: [] }))
    act(() => view.result.current.openDocumentation())
    expect(notify).toHaveBeenCalledWith(s('shell.noElements'), 'info')
    expect(view.result.current.documentation).toBeUndefined()
  })
})

describe('what the tree says about this scope', () => {
  function read(groupName: string) {
    return renderHook(() => useTreeReadings({ index, scope: 'north/south', elements: model().elements, groupName, s })).result.current
  }

  it('calls a scope by its path, and the organisation by its name or the word for one', () => {
    expect(read('Northwind').scopeLabel('north')).toBe('north')
    expect(read('Northwind').scopeLabel('')).toBe('Northwind')
    expect(read('').scopeLabel('')).toBe(s('common.organisation'))
  })

  it('says where a column is answered for only when that is another scope', () => {
    const readings = read('Northwind')
    expect(readings.describeForMap('crm')).toMatchObject({ name: 'CRM', where: 'north' })
    expect(readings.describeForMap('pos')).not.toHaveProperty('where')
    expect(readings.describeForMap('nobody')).toBeUndefined()
  })
})

describe('what the analysis pages hand back', () => {
  const solution: Solution = {
    id: 'sol-1', number: 1, title: 'One ledger', state: 'adopted', addresses: [], validatedWith: [], attempts: [],
    body: '', history: [],
  }

  function mount(held: Solution) {
    return renderHook(() => {
      const session = useModelSession({ initialProject: snapshot(model({ solutions: [held] })), notify: vi.fn(), s })
      const actions = useAnalysisActions({ session, makeId: (prefix) => `${prefix}-new`, today: () => '2026-09-26', s })
      return { session, actions }
    })
  }

  it('propose a decision for a solution as one step: the record, and the solution linked to it', () => {
    const view = mount(solution)
    act(() => view.result.current.actions.onDecideSolution('sol-1'))
    const indexed = view.result.current.session.indexed()
    expect(decisionList(indexed).map((adr) => [adr.id, adr.title])).toEqual([['adr-new', 'One ledger']])
    expect(solutionsOf(indexed)['sol-1'].decision).toBe('adr-new')
    expect(view.result.current.session.history()).toHaveLength(1)
  })

  it('propose nothing for a solution that has a decision already', () => {
    const view = mount({ ...solution, decision: 'adr-9' })
    act(() => view.result.current.actions.onDecideSolution('sol-1'))
    expect(decisionList(view.result.current.session.indexed())).toEqual([])
    expect(view.result.current.session.history()).toHaveLength(0)
  })
})
