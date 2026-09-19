// @vitest-environment jsdom
/**
 * Everything the editor's tab bar asks of the shell.
 *
 * The arithmetic is in `core/` and tested there; what is pinned here is the
 * order of operations, which is where these go wrong. Duplicating without
 * switching to the copy, deleting the diagram you are standing on without
 * moving off it, or creating a container view for an application that already
 * has one are all silent, and all read as "it did nothing".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { laidOut } from '../model/testFixtures';
import { act, cleanup, render } from '@testing-library/react'
import { translator } from '../i18n'
import type { DesignElement, PlacedNode } from '../model'
import type { HostModel } from '../model/hostModel'
import type { ScopeSnapshot } from '../projects/scope'
import { useDiagramActions } from './useDiagramActions'
import type { DiagramActions } from './useDiagramActions'
import { useModelSession } from './useModelSession'

/** The full shape, so a test does not have to repeat five fields it never reads. */
function element(id: string, name: string): DesignElement {
  return { id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {} }
}

const at = (id: string): PlacedNode => ({ id, x: 0, y: 0 })


beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.useRealTimers(); cleanup() })

const model = (over: Partial<HostModel> = {}): HostModel => ({
  name: 'Landscape',
  elements: [element('billing', 'Billing')],
  relations: [],
  diagrams: [
    laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [at('billing')] }),
    laidOut({ id: 'd2', kind: 'layer7', name: 'Second', placements: [] }),
  ],
  ...over,
})

const project = (m: HostModel = model()): ScopeSnapshot => ({
  path: 'acme/landscape',
  model: m,
  activeDiagramId: 'd1',
  logoLibrary: [],
})

/** The real session underneath: these actions talk to it constantly, and a
    fake would only pin the fake. */
function mount(initial = project()) {
  const notify = vi.fn()
  let actions!: DiagramActions
  let current!: () => HostModel
  let activeId!: () => string
  let history!: () => readonly { summary: { key: string; name?: string } }[]
  let undo!: () => void
  let dispatch!: ReturnType<typeof useModelSession>['dispatch']
  function Host() {
    const session = useModelSession({ initialProject: initial, notify, s: translator('en') })
    actions = useDiagramActions({ session, notify, s: translator('en'), makeId: (p) => `${p}-new` })
    current = session.current
    activeId = session.currentActiveId
    history = session.history
    undo = session.undo
    dispatch = session.dispatch
    return null
  }
  render(<Host />)
  return {
    notify, actions: () => actions, model: () => current(), activeId: () => activeId(),
    history: () => history(), undo: () => undo(), dispatch: (...args: Parameters<typeof dispatch>) => dispatch(...args),
  }
}

describe('creating a landscape', () => {
  it('asks for a name first, with a sensible one already in the box', () => {
    const view = mount()
    act(() => view.actions().onCreateLayer7Diagram())
    expect(view.actions().newDiagramName).toBe('New landscape')
  })

  it('adds it and switches to it once confirmed', () => {
    const view = mount()
    act(() => view.actions().onCreateLayer7Diagram())
    act(() => view.actions().setNewDiagramName('Third'))
    act(() => view.actions().confirmNewDiagram())
    expect(view.model().diagrams.map((d) => d.name)).toContain('Third')
    expect(view.activeId()).toBe('l7-new')
  })

  it('refuses a name that is only spaces, rather than making an unnameable tab', () => {
    const view = mount()
    act(() => view.actions().onCreateLayer7Diagram())
    act(() => view.actions().setNewDiagramName('   '))
    act(() => view.actions().confirmNewDiagram())
    expect(view.model().diagrams).toHaveLength(2)
  })

  it('copies the project`s columns rather than pointing at them', () => {
    const view = mount(project(model({ defaultAspectConfig: [{ key: 'a', label: 'A' }] as never })))
    act(() => view.actions().onCreateLayer7Diagram())
    act(() => view.actions().confirmNewDiagram())
    const made = view.model().diagrams.find((d) => d.id === 'l7-new')!
    expect(made.aspectConfig).toEqual(view.model().defaultAspectConfig)
    expect(made.aspectConfig).not.toBe(view.model().defaultAspectConfig)
  })
})

describe('a container view', () => {
  it('is made and opened for an application that has none', () => {
    const view = mount()
    act(() => view.actions().onCreateContainerDiagram('billing'))
    expect(view.model().diagrams.map((d) => d.id)).toContain('cd-new')
    expect(view.activeId()).toBe('cd-new')
  })

  it('is a step like any other: named in Activity, and taken back by undo', () => {
    // Made on purpose, from the menu or the inspector — and because it goes
    // through the same command as every change, it is one line in the
    // Activity list and one ⌘Z, which a view made silently by a double-click
    // never was.
    const view = mount()
    act(() => view.actions().onCreateContainerDiagram('billing'))
    const last = view.history().at(-1)
    expect(last?.summary).toEqual({ key: 'activity.diagramAdded', name: 'Billing · containers' })
    act(() => view.undo())
    expect(view.model().diagrams.map((d) => d.id)).toEqual(['d1', 'd2'])
  })

  it('is deleted with its containers, and the application can go afterwards', () => {
    // The containers are the view's detail, not the application's: they leave
    // with it, so the application stands with nothing inside and the delete
    // dialog no longer says "delete or re-parent its components first".
    const held = model()
    held.elements = [
      ...held.elements,
      { id: 'billing-api', kind: 'component', name: 'API', parentId: 'billing', lifecycle: 'live', isManaged: true, aspects: {} },
    ]
    held.diagrams = [
      ...held.diagrams,
      laidOut({ id: 'cd1', kind: 'container', name: 'Billing — containers', applicationElementId: 'billing', placements: [at('billing-api')] }),
    ]
    const view = mount(project(held))
    act(() => view.actions().requestDeleteDiagram('cd1'))
    act(() => view.actions().confirmDeleteDiagram())
    expect(view.model().diagrams.map((d) => d.id)).toEqual(['d1', 'd2'])
    expect(view.model().elements.some((e) => e.parentId === 'billing')).toBe(false)
    expect(view.notify).toHaveBeenCalledWith('“Billing — containers” deleted.', 'success')
    let gone: HostModel | undefined
    act(() => { gone = view.dispatch({ type: 'element.delete', id: 'billing' }) })
    expect(gone?.elements.some((e) => e.id === 'billing')).toBe(false)
  })

  it('is not made twice: the second ask just opens the one that exists', () => {
    const view = mount()
    act(() => view.actions().onCreateContainerDiagram('billing'))
    act(() => view.actions().setNewDiagramName(null))
    const before = view.model().diagrams.length
    act(() => view.actions().onCreateContainerDiagram('billing'))
    expect(view.model().diagrams).toHaveLength(before)
    expect(view.activeId()).toBe('cd-new')
  })
})

describe('renaming and duplicating', () => {
  it('renames in place', () => {
    const view = mount()
    act(() => view.actions().onRenameDiagram('d1', 'Renamed'))
    expect(view.model().diagrams[0].name).toBe('Renamed')
  })

  it('duplicates, switches to the copy, and says which one it copied', () => {
    const view = mount()
    act(() => view.actions().onDuplicateDiagram('d1'))
    expect(view.model().diagrams.map((d) => d.name)).toContain('L7 (copy)')
    expect(view.activeId()).toBe('l7-new')
    expect(view.notify).toHaveBeenCalledWith('“L7” duplicated.', 'success')
  })

  it('does nothing at all for a diagram that is not there', () => {
    const view = mount()
    act(() => view.actions().onDuplicateDiagram('nope'))
    expect(view.model().diagrams).toHaveLength(2)
    expect(view.notify).not.toHaveBeenCalled()
  })
})

describe('deleting', () => {
  it('asks first, and tells the dialog which one', () => {
    const view = mount()
    act(() => view.actions().requestDeleteDiagram('d2'))
    expect(view.actions().diagramToDelete?.name).toBe('Second')
    expect(view.actions().isLastLandscape).toBe(false)
  })

  it('refuses to lose the last landscape — nothing would be left to work on', () => {
    const view = mount(project(model({
      diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
    })))
    act(() => view.actions().requestDeleteDiagram('d1'))
    expect(view.actions().isLastLandscape).toBe(true)
  })

  it('deletes on confirmation, moves off it, and says so', () => {
    const view = mount()
    act(() => view.actions().requestDeleteDiagram('d1'))
    act(() => view.actions().confirmDeleteDiagram())
    expect(view.model().diagrams.map((d) => d.id)).toEqual(['d2'])
    expect(view.activeId()).toBe('d2')
    expect(view.notify).toHaveBeenCalledWith('“L7” deleted.', 'success')
  })

  it('leaves everything alone when the dialog is cancelled', () => {
    const view = mount()
    act(() => view.actions().requestDeleteDiagram('d1'))
    act(() => view.actions().cancelDeleteDiagram())
    expect(view.actions().diagramToDelete).toBeUndefined()
    expect(view.model().diagrams).toHaveLength(2)
  })
})
