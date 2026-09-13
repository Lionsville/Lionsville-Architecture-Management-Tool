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
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { SheetPage } from '../business'
import { renderShell } from './testing/renderShell'
import { laidOut } from '../model/testFixtures'
import { translator } from '../i18n'
import { shippingScope } from '../business/testFixtures'
import type { HostModel } from '../model/fromInterchange'
import type { ScopeSnapshot } from '../projects/scope'
import { useModelSession } from './useModelSession'
import type { ModelSession } from './useModelSession'
import { useSheet } from './useSheet'
import type { Sheets } from './useSheet'

afterEach(() => cleanup())

const model = (over: Partial<HostModel> = {}): HostModel => {
  const { elements, relations } = shippingScope()
  return {
    name: 'Landscape',
    elements,
    relations,
    // The warehouse system is ON the board, because where a coverage link
    // lands is a question about what a board draws.
    diagrams: [laidOut({
      id: 'd1', kind: 'layer7', name: 'L7', placements: [{ id: 'wms', x: 0, y: 0 }],
    })],
    ...over,
  }
}

const project = (m: HostModel = model()): ScopeSnapshot => ({
  path: 'acme/landscape',
  model: m,
  activeDiagramId: 'd1',
  logoLibrary: [],
})

/** The real session underneath, so what is pinned is the stack and the model. */
function mount(initial = project()) {
  const showElement = vi.fn()
  const notify = vi.fn()
  let sheets!: Sheets
  let session!: ModelSession
  let counter = 0
  function Host() {
    session = useModelSession({ initialProject: initial, notify: vi.fn(), s: translator('en') })
    sheets = useSheet({
      session,
      makeId: (p) => `${p}-${++counter}`,
      s: translator('en'),
      showElement,
    })
    return null
  }
  render(<Host />)
  return {
    showElement,
    notify,
    sheets: () => sheets,
    model: () => session.current(),
    activeId: () => session.currentActiveId(),
    steps: () => session.history().length,
    undo: () => act(() => session.undo()),
    element: (id: string) => session.current().elements.find((e) => e.id === id),
    sheetOf: (id: string) => session.current().diagrams.find((d) => d.id === id),
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

  it('hands a coverage link to the shell, with its own closing as what to do on the way out', () => {
    const host = opened()
    act(() => host.sheets().actions.onOpenElement('wms'))
    expect(host.showElement).toHaveBeenCalledWith('wms', expect.any(Function))
    // Not closed yet: the shell closes it only when a board here is about
    // to show, and leaves it up under a page or a choice.
    expect(host.sheets().sheetId).toBe('sh-1')
    act(() => (host.showElement.mock.calls[0][1] as () => void)())
    expect(host.sheets().sheetId).toBeUndefined()
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

/**
 * The gestures that make something (step 3c).
 *
 * What is pinned here is the command each one lands, that it is one step, and
 * that the sheet's own fields move with it — the page's side is pinned in
 * `SheetPage.test.tsx`, over the same vocabulary.
 */
describe('making something', () => {
  const opened = () => {
    const host = mount()
    act(() => host.sheets().create())
    return host
  }

  it('adds a phase at the end of the row, with the id its name would have', () => {
    const host = opened()
    let id: string | undefined
    act(() => { id = host.sheets().actions.addElement({ kind: 'step', name: 'Aftercare', parentId: 'ship' }) })
    expect(id).toBe('aftercare')
    expect(host.element('aftercare')).toMatchObject({ kind: 'step', parentId: 'ship', order: 5 })
  })

  it('adds a capability with no order, because its row has none', () => {
    const host = opened()
    act(() => host.sheets().actions.addElement({
      kind: 'function', name: 'Bulk picking', parentId: 'warehousing',
    }))
    expect(host.element('bulk-picking')).toMatchObject({ parentId: 'warehousing' })
    expect(host.element('bulk-picking')?.order).toBeUndefined()
  })

  it('gives a step the lane of the row it was made in', () => {
    const host = opened()
    act(() => host.sheets().actions.addElement({
      kind: 'step', name: 'Chase the quote', parentId: 'quote', lane: 'key-account',
    }))
    expect(host.element('chase-the-quote')?.lane).toBe('key-account')
  })

  it('starts a stakeholder outside the organisation when it is one', () => {
    const host = opened()
    act(() => host.sheets().actions.addElement({ kind: 'actor', name: 'Auditor', outside: true }))
    expect(host.element('auditor')).toMatchObject({ kind: 'actor', outside: true })
  })

  it('makes a journey with its first phase, and points an empty sheet at it', () => {
    // A model with two journeys seeds none (`seedSheet`), which is the sheet
    // this gesture has to fill.
    const host = mount(project(model({ elements: [] })))
    act(() => host.sheets().create())
    act(() => host.sheets().actions.addJourney({ journey: 'Onboard a client', phase: 'Start' }))

    expect(host.element('onboard-a-client')).toMatchObject({ kind: 'step' })
    expect(host.element('start')).toMatchObject({ kind: 'step', parentId: 'onboard-a-client' })
    expect(host.sheetOf('sh-1')?.journeyId).toBe('onboard-a-client')
    // One step: the journey, its phase and the sheet's own field.
    expect(host.steps()).toBe(2)
    host.undo()
    expect(host.element('onboard-a-client')).toBeUndefined()
    expect(host.sheetOf('sh-1')?.journeyId).toBeUndefined()
  })

  it('leaves a sheet that already draws one pointing where it pointed', () => {
    const host = opened()
    act(() => host.sheets().actions.addJourney({ journey: 'Onboard a client', phase: 'Start' }))
    expect(host.sheetOf('sh-1')?.journeyId).toBe('ship')
  })

  it('adds an area and draws it on this sheet in the same step', () => {
    const host = opened()
    act(() => host.sheets().actions.addArea('Compliance'))
    expect(host.element('compliance')).toMatchObject({ kind: 'function' })
    expect(host.sheetOf('sh-1')?.areas).toEqual(['fulfilment', 'billing', 'compliance'])
    host.undo()
    expect(host.element('compliance')).toBeUndefined()
    expect(host.sheetOf('sh-1')?.areas).toEqual(['fulfilment', 'billing'])
  })

  it('makes a lane out of a stakeholder the scope already holds', () => {
    const host = opened()
    let id: string | undefined
    act(() => {
      id = host.sheets().actions.addLane({
        actorId: 'partner', phaseId: 'order', stepName: 'Take the bulk order',
      })
    })
    expect(id).toBe('take-the-bulk-order')
    expect(host.element('take-the-bulk-order')).toMatchObject({ parentId: 'order', lane: 'partner' })
    // `lanes` is the ORDER of the rows and nothing else: the row exists
    // because a step names the actor.
    expect(host.sheetOf('sh-1')?.lanes).toBeUndefined()
  })

  it('makes the stakeholder too when the person typed a name', () => {
    const host = opened()
    act(() => host.sheets().actions.addLane({
      name: 'Auditor', outside: true, phaseId: 'order', stepName: 'Ask for the file',
    }))
    expect(host.element('auditor')).toMatchObject({ kind: 'actor', outside: true })
    expect(host.element('ask-for-the-file')?.lane).toBe('auditor')
    // The actor and its first step are one thing that happened.
    expect(host.steps()).toBe(2)
  })
})

describe('taking something away', () => {
  const opened = () => {
    const host = mount()
    act(() => host.sheets().create())
    return host
  }

  it('refuses while something is inside it', () => {
    const host = opened()
    act(() => host.sheets().actions.removeElement('warehousing'))
    expect(host.element('warehousing')).toBeDefined()
    expect(host.steps()).toBe(1)
  })

  it('takes a leaf and the rows that ended on it', () => {
    const host = opened()
    act(() => host.sheets().actions.removeElement('picking'))
    expect(host.element('picking')).toBeUndefined()
    expect(host.model().relations.some((r) => r.targetId === 'picking')).toBe(false)
    host.undo()
    expect(host.element('picking')).toBeDefined()
    expect(host.model().relations.filter((r) => r.targetId === 'picking')).toHaveLength(2)
  })

  it('clears the sheet’s journey in the same step as the journey', () => {
    const host = opened()
    // Emptied first, because nothing cascades.
    for (const id of ['take-order', 'standard-rate', 'negotiate', 'pick-goods', 'partner-fulfils',
      'hand-over', 'sign-off', 'order', 'quote', 'pick', 'deliver']) {
      act(() => host.sheets().actions.removeElement(id))
    }
    act(() => host.sheets().actions.removeElement('ship'))
    expect(host.element('ship')).toBeUndefined()
    expect(host.sheetOf('sh-1')?.journeyId).toBeUndefined()
    host.undo()
    expect(host.sheetOf('sh-1')?.journeyId).toBe('ship')
  })

  it('takes an area off the sheet in the same step', () => {
    const host = opened()
    act(() => host.sheets().actions.removeElement('invoice'))
    act(() => host.sheets().actions.removeElement('dunning'))
    act(() => host.sheets().actions.removeElement('invoicing'))
    act(() => host.sheets().actions.removeElement('billing'))
    expect(host.sheetOf('sh-1')?.areas).toEqual(['fulfilment'])
  })
})

describe('coverage, ticked', () => {
  const opened = () => {
    const host = mount()
    act(() => host.sheets().create())
    return host
  }
  const rows = (host: ReturnType<typeof mount>, target: string, type: string) =>
    host.model().relations.filter((r) => r.type === type && r.targetId === target)

  it('writes a supports row from an application', () => {
    const host = opened()
    act(() => host.sheets().actions.setCoverage({
      type: 'supports', sourceId: 'erp', functionId: 'dunning', on: true,
    }))
    expect(rows(host, 'dunning', 'supports').map((r) => r.sourceId)).toEqual(['erp'])
    host.undo()
    expect(rows(host, 'dunning', 'supports')).toEqual([])
  })

  it('writes an assigned row from an actor', () => {
    const host = opened()
    act(() => host.sheets().actions.setCoverage({
      type: 'assigned', sourceId: 'warehouse-team', functionId: 'dunning', on: true,
    }))
    expect(rows(host, 'dunning', 'assigned').map((r) => r.sourceId)).toEqual(['warehouse-team'])
  })

  it('takes a row away again', () => {
    const host = opened()
    act(() => host.sheets().actions.setCoverage({
      type: 'supports', sourceId: 'wms', functionId: 'picking', on: false,
    }))
    expect(rows(host, 'picking', 'supports').map((r) => r.sourceId)).toEqual(['scanner'])
  })

  it('takes every row that says the same thing, as one step', () => {
    const host = opened()
    act(() => host.sheets().actions.setCoverage({
      type: 'supports', sourceId: 'erp', functionId: 'dunning', on: true,
    }))
    act(() => host.sheets().actions.setCoverage({
      type: 'supports', sourceId: 'erp', functionId: 'dunning', on: true,
    }))
    expect(rows(host, 'dunning', 'supports')).toHaveLength(2)
    act(() => host.sheets().actions.setCoverage({
      type: 'supports', sourceId: 'erp', functionId: 'dunning', on: false,
    }))
    expect(rows(host, 'dunning', 'supports')).toEqual([])
    host.undo()
    expect(rows(host, 'dunning', 'supports')).toHaveLength(2)
  })
})

/**
 * The whole thing, by clicking and typing (step 3c's own "done when").
 *
 * The page over the real session, on a project with a landscape and nothing
 * else: a journey, an area, a capability and what covers it, each one named
 * by typing over what it was made as, and ⌘Z walking back one step at a time.
 * The two halves are pinned apart above and in `SheetPage.test.tsx`; this is
 * the one test that says they add up to the gesture a person makes.
 */
describe('from nothing to a covered capability', () => {
  const landscapeOnly = () => project(model({
    elements: [{
      id: 'wms',
      kind: 'application',
      name: 'Warehouse system',
      lifecycle: 'live',
      isManaged: true,
      aspects: {},
    }],
    relations: [],
    diagrams: [laidOut({
      id: 'd1', kind: 'layer7', name: 'Landscape', placements: [{ id: 'wms', x: 0, y: 0 }],
    })],
  }))

  function page() {
    let sheets!: Sheets
    let session!: ModelSession
    function Host() {
      session = useModelSession({
        initialProject: landscapeOnly(), notify: vi.fn(), s: translator('en'),
      })
      sheets = useSheet({
        session,
        makeId: (p) => `${p}-1`,
        s: translator('en'),
        showElement: vi.fn(),
      })
      return sheets.sheet ? (
        <SheetPage
          open
          model={session.model}
          sheet={sheets.sheet}
          readOnly={false}
          actions={sheets.actions}
          onClose={sheets.close}
        />
      ) : null
    }
    renderShell(<Host />)
    act(() => sheets.create())
    return {
      model: () => session.current(),
      steps: () => session.history().length,
      undo: () => act(() => session.undo()),
    }
  }

  /** Type over what the thing was made as — the cursor is already in the box. */
  const rename = (to: string) => {
    const field = within(screen.getByTestId('sheet-inspector')).getByLabelText('Name')
    expect(document.activeElement).toBe(field)
    fireEvent.change(field, { target: { value: to } })
  }

  it('makes one by clicking and typing, and ⌘Z walks it back', () => {
    const host = page()

    fireEvent.click(screen.getByLabelText('New journey'))
    rename('Ship a consignment')
    expect(screen.getByTestId('sheet-phase-start').textContent).toBe('Start')

    fireEvent.click(screen.getByLabelText('New area'))
    rename('Fulfilment')

    fireEvent.click(screen.getByLabelText('Add a capability to Fulfilment'))
    rename('Picking')

    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Supported by/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Warehouse system' }))

    // One covered capability, drawn as a card in the area it was made in.
    const card = screen.getByTestId('sheet-capability-new-capability')
    expect(within(card).getByText('Picking')).toBeTruthy()
    expect(screen.getByTestId('sheet-coverage-new-capability').textContent).toBe('1 app')
    expect(host.model().elements.map((e) => e.name)).toEqual(
      ['Warehouse system', 'Ship a consignment', 'Start', 'Fulfilment', 'Picking'],
    )

    // Back out, one decision at a time: the row, the name, the capability.
    host.undo()
    expect(host.model().relations).toEqual([])
    host.undo()
    expect(host.model().elements.find((e) => e.id === 'new-capability')?.name)
      .toBe('New capability')
    host.undo()
    expect(host.model().elements.some((e) => e.id === 'new-capability')).toBe(false)
  })

  it('leaves the journey and the area behind when it is walked all the way back', () => {
    const host = page()
    fireEvent.click(screen.getByLabelText('New journey'))
    fireEvent.click(screen.getByLabelText('New area'))
    expect(host.steps()).toBe(3)

    host.undo()
    host.undo()
    expect(host.model().elements.map((e) => e.id)).toEqual(['wms'])
    // The sheet itself is the step before, and it is still there.
    expect(host.model().diagrams.some((d) => d.kind === 'sheet')).toBe(true)
  })
})
