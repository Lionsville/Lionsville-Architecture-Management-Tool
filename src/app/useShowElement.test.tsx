// @vitest-environment jsdom
/**
 * Where a link to an element lands (the first beta tester's second finding,
 * and the fourth's).
 *
 * A project with two landscapes over one model on two days is the shipped
 * example's own shape, and the board somebody last had open is not
 * necessarily one that draws the thing they clicked — and when two boards
 * do, the person is asked rather than landed on the first. A thing this
 * scope does not hold at all is another scope's to show.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import { translator } from '../i18n'
import { shippingScope } from '../business/testFixtures'
import type { HostModel } from '../model/fromInterchange'
import type { ScopeSnapshot } from '../projects/scope'
import { useModelSession } from './useModelSession'
import type { ModelSession } from './useModelSession'
import { useShowElement } from './useShowElement'
import type { ShowElement } from './useShowElement'
import type { InitialPage } from './App'

afterEach(() => cleanup())

function model(): HostModel {
  const { elements, relations } = shippingScope()
  return {
    name: 'Acme Logistics',
    elements: elements.map((element) => (element.id === 'scanner'
      ? { ...element, lifecycleDates: { retired: '2027-01-01' } }
      : element)),
    relations,
    diagrams: [
      laidOut({
        id: 'd1', kind: 'layer7', name: 'Landscape',
        placements: [{ id: 'wms', x: 0, y: 0 }, { id: 'scanner', x: 10, y: 0 }],
      }),
      laidOut({
        id: 'd2', kind: 'layer7', name: 'Landscape in 2027', asOf: '2027-06-01',
        placements: [{ id: 'erp', x: 0, y: 0 }, { id: 'scanner', x: 10, y: 0 }, { id: 'wms', x: 20, y: 0 }],
      }),
      // A board drawing none of them, to be on when neither landscape is up.
      laidOut({ id: 'd3', kind: 'layer7', name: 'Empty', placements: [] }),
    ],
  }
}

function mount(over: {
  masterOf?: (id: string) => string | undefined
  onOpenScope?: (path: string, page?: InitialPage) => void
  activeDiagramId?: string
} = {}) {
  const focus = vi.fn()
  const toDocumentation = vi.fn()
  const notify = vi.fn()
  let shown!: ShowElement
  let session!: ModelSession
  function Host() {
    session = useModelSession({
      initialProject: {
        path: 'acme/landscape', model: model(), activeDiagramId: over.activeDiagramId ?? 'd1', logoLibrary: [],
      } as ScopeSnapshot,
      notify: vi.fn(), s: translator('en'),
    })
    shown = useShowElement({
      session, scope: 'acme/landscape', notify, s: translator('en'), focus, toDocumentation,
      ...(over.masterOf ? { masterOf: over.masterOf } : {}),
      ...(over.onOpenScope ? { onOpenScope: over.onOpenScope } : {}),
    })
    return null
  }
  render(<Host />)
  return { focus, toDocumentation, notify, shown: () => shown, activeId: () => session.currentActiveId() }
}

/** The question as the hook currently puts it. */
function choice(host: ReturnType<typeof mount>) {
  return host.shown().choice
}

describe('useShowElement', () => {
  it('stays on the board a person is on when that board draws it, and leaves first', () => {
    const host = mount()
    const leave = vi.fn()
    act(() => host.shown().show('wms', leave))
    expect(host.activeId()).toBe('d1')
    expect(leave).toHaveBeenCalled()
    expect(host.notify).not.toHaveBeenCalled()
    expect(host.focus).toHaveBeenCalledWith('wms')
  })

  it('switches to the one board that draws it, and says which', () => {
    const host = mount()
    act(() => host.shown().show('erp'))
    expect(host.activeId()).toBe('d2')
    expect(host.notify).toHaveBeenCalledWith('Showing Landscape in 2027, which draws it', 'info')
    expect(host.focus).toHaveBeenCalledWith('erp')
  })

  it('asks which board when more than one draws it and none is up, and lands where the person says', () => {
    const host = mount({ activeDiagramId: 'd3' })
    const leave = vi.fn()
    act(() => host.shown().show('wms', leave))
    // Nothing yet: not left, not focused, not switched — asked.
    expect(leave).not.toHaveBeenCalled()
    expect(host.focus).not.toHaveBeenCalled()
    expect(host.activeId()).toBe('d3')
    expect(choice(host)).toMatchObject({ id: 'wms', name: 'Warehouse system' })
    expect(choice(host)?.boards.map((board) => board.id)).toEqual(['d1', 'd2'])
    act(() => host.shown().choose('d2'))
    expect(host.activeId()).toBe('d2')
    expect(leave).toHaveBeenCalled()
    expect(host.focus).toHaveBeenCalledWith('wms')
    expect(choice(host)).toBeUndefined()
  })

  it('does not count a board that draws it on a day it is gone, so one board is no question', () => {
    // The scanner retires in 2027: today's board draws it, the 2027 one does not.
    const host = mount({ activeDiagramId: 'd3' })
    act(() => host.shown().show('scanner'))
    expect(choice(host)).toBeUndefined()
    expect(host.activeId()).toBe('d1')
  })

  it('lets the question go unanswered', () => {
    const host = mount({ activeDiagramId: 'd3' })
    const leave = vi.fn()
    act(() => host.shown().show('wms', leave))
    act(() => host.shown().dismiss())
    expect(choice(host)).toBeUndefined()
    expect(leave).not.toHaveBeenCalled()
  })

  it('opens the page of a thing drawn nowhere, without leaving', () => {
    const host = mount()
    const leave = vi.fn()
    act(() => host.shown().show('dunning', leave))
    expect(host.toDocumentation).toHaveBeenCalledWith('dunning')
    expect(leave).not.toHaveBeenCalled()
    expect(host.focus).not.toHaveBeenCalled()
  })

  it('opens the scope that answers for a thing this scope does not hold, on the same request', () => {
    const onOpenScope = vi.fn<(path: string, page?: InitialPage) => void>()
    const host = mount({ masterOf: (id) => (id === 'crews-lts' ? 'rg5/crews' : undefined), onOpenScope })
    const leave = vi.fn()
    act(() => host.shown().show('crews-lts', leave))
    expect(onOpenScope).toHaveBeenCalledWith('rg5/crews', { page: 'element', id: 'crews-lts' })
    expect(leave).toHaveBeenCalled()
    expect(host.toDocumentation).not.toHaveBeenCalled()
    // Nobody answers for it: its page, which says so.
    act(() => host.shown().show('ghost'))
    expect(host.toDocumentation).toHaveBeenCalledWith('ghost')
  })
})
