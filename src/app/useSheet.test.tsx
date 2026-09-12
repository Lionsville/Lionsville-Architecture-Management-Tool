// @vitest-environment jsdom
/**
 * The shell's side of the business architecture sheet (ADR-0012 §6).
 *
 * The layout is pinned in `business/sheet.test.ts` and the page in
 * `SheetPage.test.tsx`. What is pinned here is the wiring: that a sheet is a
 * diagram but never the active one, that every change it makes is one step on
 * the session's stack, and that leaving the page for the board closes it
 * first.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import { translator } from '../i18n'
import { shippingScope } from '../business/testFixtures'
import type { HostModel } from '../model/fromInterchange'
import type { ProjectSnapshot } from '../projects/project'
import { useModelSession } from './useModelSession'
import type { ModelSession } from './useModelSession'
import { useSheet } from './useSheet'
import type { Sheets } from './useSheet'

afterEach(() => cleanup())

const model = (over: Partial<HostModel> = {}): HostModel => {
  const { elements, relations } = shippingScope()
  return {
    name: 'Landscape',
    customerName: 'Acme',
    elements,
    relations,
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
    ...over,
  }
}

const project = (m: HostModel = model()): ProjectSnapshot => ({
  ref: { group: 'acme', project: 'landscape' },
  model: m,
  activeDiagramId: 'd1',
  logoLibrary: [],
})

/** The real session underneath, so what is pinned is the stack and the model. */
function mount(initial = project()) {
  const toElement = vi.fn()
  let sheets!: Sheets
  let session!: ModelSession
  let counter = 0
  function Host() {
    session = useModelSession({ initialProject: initial, notify: vi.fn(), s: translator('en') })
    sheets = useSheet({ session, makeId: (p) => `${p}-${++counter}`, s: translator('en'), toElement })
    return null
  }
  render(<Host />)
  return {
    toElement,
    sheets: () => sheets,
    model: () => session.current(),
    activeId: () => session.currentActiveId(),
    steps: () => session.history().length,
    undo: () => act(() => session.undo()),
  }
}

describe('making one', () => {
  it('seeds it from what the scope already holds, and opens it', () => {
    const host = mount()
    act(() => host.sheets().create())

    const made = host.model().diagrams.find((d) => d.kind === 'sheet')!
    expect(made).toMatchObject({ id: 'sh-1', journeyId: 'ship', areas: ['fulfilment', 'billing'] })
    expect(host.sheets().sheetId).toBe('sh-1')
  })

  it('leaves the canvas on the board it was on', () => {
    // A sheet has no geometry: making it active would hand the editor a view
    // it cannot draw, and unmount the canvas an agent may be rendering.
    const host = mount()
    act(() => host.sheets().create())
    expect(host.activeId()).toBe('d1')
  })

  it('is one step, and undoing it takes the sheet back off', () => {
    const host = mount()
    act(() => host.sheets().create())
    expect(host.steps()).toBe(1)
    host.undo()
    expect(host.model().diagrams.some((d) => d.kind === 'sheet')).toBe(false)
  })
})

describe('what the page may do', () => {
  const opened = () => {
    const host = mount()
    act(() => host.sheets().create())
    return host
  }
  const held = (host: ReturnType<typeof mount>, id: string) =>
    host.model().elements.find((e) => e.id === id)!

  it('writes a field as one command, and a run of them as one step', () => {
    const host = opened()
    act(() => host.sheets().actions.updateElement('picking', { name: 'Order pickin' }, 'sheet.name:picking'))
    act(() => host.sheets().actions.updateElement('picking', { name: 'Order picking' }, 'sheet.name:picking'))
    expect(held(host, 'picking').name).toBe('Order picking')
    // The sheet itself was one step; the two keystrokes are the second.
    expect(host.steps()).toBe(2)
  })

  it('re-parents through the same command a keystroke takes', () => {
    const host = opened()
    act(() => host.sheets().actions.updateElement('picking', { parentId: 'invoicing' }))
    expect(held(host, 'picking').parentId).toBe('invoicing')
  })

  it('moves one among its neighbours as a single step, and ⌘Z puts the row back', () => {
    const host = opened()
    act(() => host.sheets().actions.moveElement('packing', -1))
    expect([held(host, 'picking').order, held(host, 'packing').order]).toEqual([2, 1])
    host.undo()
    expect(held(host, 'packing').order).toBeUndefined()
  })

  it('writes nothing at the end of the row', () => {
    const host = opened()
    const before = host.steps()
    act(() => host.sheets().actions.moveElement('picking', -1))
    expect(host.steps()).toBe(before)
  })

  it('changes the sheet’s own fields, like the rail', () => {
    const host = opened()
    act(() => host.sheets().actions.updateSheet({ showActors: false }))
    expect(host.model().diagrams.find((d) => d.id === 'sh-1')?.showActors).toBe(false)
  })

  it('closes the page on its way to an element on the board', () => {
    const host = opened()
    act(() => host.sheets().actions.onOpenElement('wms'))
    expect(host.sheets().sheetId).toBeUndefined()
    expect(host.toElement).toHaveBeenCalledWith('wms')
  })
})

describe('opening and closing', () => {
  it('opens one by id and hands the page the diagram', () => {
    const host = mount()
    act(() => host.sheets().create())
    act(() => host.sheets().close())
    expect(host.sheets().sheet).toBeUndefined()

    act(() => host.sheets().open('sh-1'))
    expect(host.sheets().sheet?.name).toBe('Business architecture')
  })

  it('hands the page nothing when the sheet was deleted under it', () => {
    const host = mount()
    act(() => host.sheets().open('never-made'))
    expect(host.sheets().sheetId).toBe('never-made')
    expect(host.sheets().sheet).toBeUndefined()
  })
})
