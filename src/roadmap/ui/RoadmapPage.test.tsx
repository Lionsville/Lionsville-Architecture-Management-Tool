// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The roadmap, on screen (ADR-0009).
 *
 * The arithmetic is pinned in `timeline.test.ts` and `checks.test.ts`; what is
 * pinned here is what the page promises: only dated things get a row, the
 * handle on the ruler moves the board behind it, a row opens a reader beside the
 * axis, the window is remembered per person, and a landscape with no dates says
 * what belongs here instead of drawing an empty frame.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { ViewerKeepProvider } from '../../widgets/useViewerKeep'
import { RoadmapPage } from './RoadmapPage'
import type { RoadmapActions, RoadmapPageProps } from './RoadmapPage'
import { renderShell } from '../../app/testing/renderShell'
import { openFinding, pressAction, unfoldFindings } from '../../app/testing/findings'
import type { DesignElement, DesignModel, Transition } from '../../model'

afterEach(() => cleanup())

const TODAY = '2026-09-08'

function element(id: string, name: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'application', name, lifecycle: 'live',
    isManaged: true, aspects: {}, ...over,
  }
}

const PLAN: Transition = {
  id: 'tr-1', number: 1, title: 'Replace the warehouse system', status: 'agreed',
  from: '2027-01-15', to: '2028-01-31', owner: 'Logistics IT',
  elements: [{ elementId: 'wms-old', role: 'retires' }, { elementId: 'wms-new', role: 'introduces' }],
  decisions: [], milestones: [{ date: '2027-04-01', name: 'Cutover begins' }], body: '',
}

function model(over: Partial<DesignModel & { transitions: Transition[] }> = {}) {
  return {
    name: 'Acme', diagrams: [], relations: [],
    elements: [
      element('wms-old', 'Warehouse Management', {
        lifecycleDates: { retiring: '2027-04-01', retired: '2028-01-31' }, successorId: 'wms-new',
      }),
      element('wms-new', 'Warehouse Management (new)', {
        lifecycle: 'planned', lifecycleDates: { live: '2027-04-01' },
      }),
      element('billing', 'Billing'),
    ],
    transitions: [PLAN],
    ...over,
  } as DesignModel & { transitions: Transition[] }
}

function setup(over: Partial<RoadmapPageProps> & { mode?: 'light' | 'dark' } = {}) {
  const { mode, ...props } = over
  const actions: RoadmapActions = {
    addTransition: vi.fn(),
    onOpenPlan: vi.fn(),
    setAsOf: vi.fn(),
    onOpenElement: vi.fn(),
    acceptInterface: vi.fn(),
    ...over.actions,
  }
  const view = renderShell(
    <RoadmapPage
      open
      model={model()}
      today={TODAY}
      readOnly={false}
      onClose={vi.fn()}
      {...props}
      // After `props`: the fakes above already carry whatever a caller overrode.
      actions={actions}
    />,
    { mode },
  )
  return { ...view, actions }
}


const findingsBox = () => document.querySelector<HTMLElement>('[data-guide="roadmap.findings"]')!

/** One finding opened on its explanation, by its row's test id. */
function opened(row: string): HTMLElement {
  return openFinding(findingsBox(), row)
}

describe('the roadmap, as axe reads it', () => {
  it('finds nothing on the axis, in the reader, nor in the dialog a new plan is named in', async () => {
    setup()
    expect(await axeFindings()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: /TR-0001 Replace the warehouse system/ }))
    expect(await axeFindings()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'New plan' }))
    expect(await axeFindings()).toEqual([])
  })
})

describe('the axis', () => {
  it('gives a row to what has a date and to nothing else, plans first', () => {
    setup()
    expect(screen.getByTestId('row-wms-old')).toBeTruthy()
    expect(screen.queryByTestId('row-billing')).toBeNull()
    const rows = [screen.getByTestId('plan-tr-1'), screen.getByTestId('row-wms-old')]
    expect(rows[0].compareDocumentPosition(rows[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('says each phase and each status on the bar, so colour is not the only signal', () => {
    setup({ today: '2027-06-01', model: model({ transitions: [{ ...PLAN, status: 'draft' }] }) })
    expect(within(screen.getByTestId('row-wms-old')).getByText('Retiring')).toBeTruthy()
    expect(within(screen.getByTestId('plan-tr-1')).getByText('Draft')).toBeTruthy()
  })

  it('opens on three months back and nine ahead, and comes back where this person left it', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Jun 2026 to May 2027' })).toBeTruthy()
    cleanup()
    const kept: Record<string, unknown> = { 'roadmap.axis': { start: '2029-01-01', days: 365 } }
    renderShell(
      <ViewerKeepProvider value={{ read: (key) => kept[key], keep: (key, value) => { kept[key] = value } }}>
        <RoadmapPage open model={model()} today={TODAY} readOnly={false} onClose={vi.fn()} actions={{} as RoadmapActions} />
      </ViewerKeepProvider>,
    )
    expect(screen.getByRole('button', { name: 'Jan 2029 to Dec 2029' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Years' }))
    expect((kept['roadmap.axis'] as { days: number }).days).toBe(1826)
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
  })

  it('takes no kept window it cannot read', () => {
    renderShell(
      <ViewerKeepProvider value={{ read: () => 'nonsense', keep: () => undefined }}>
        <RoadmapPage open model={model()} today={TODAY} readOnly={false} onClose={vi.fn()} actions={{} as RoadmapActions} />
      </ViewerKeepProvider>,
    )
    expect(screen.getByRole('button', { name: 'Jun 2026 to May 2027' })).toBeTruthy()
  })

  it('names a shadow run on the band, read off the elements\' own dates', () => {
    const elements = [
      element('wms-old', 'Old', { lifecycleDates: { retired: '2027-06-30' } }),
      element('wms-new', 'New', { lifecycleDates: { live: '2027-01-01' } }),
    ]
    setup({ today: '2027-02-01', model: model({ elements }) })
    expect(within(screen.getByTestId('plan-tr-1')).getByRole('img', { name: /Shadow run/ })).toBeTruthy()
  })

  it('folds the dated connections, by the plan that moves them into old lines and new lines, and those in no plan', () => {
    const relations = [
      { type: 'flow', id: 'old', sourceId: 'billing', targetId: 'wms-old', isBidirectional: false, validUntil: '2027-06-01' },
      { type: 'flow', id: 'new', sourceId: 'billing', targetId: 'wms-new', isBidirectional: false, validFrom: '2027-06-02' },
      { type: 'supports', id: 'free', sourceId: 'billing', targetId: 'wms-new', isBidirectional: false, validFrom: '2027-01-01', label: 'A window of its own' },
    ] as DesignModel['relations']
    setup({ today: '2027-05-01', model: model({ relations }) })
    expect(screen.queryByTestId('relation-free')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Connections with dates 3, folded/ }))
    fireEvent.click(screen.getByRole('button', { name: /TR-0001 moves 2/ }))
    fireEvent.click(screen.getByRole('button', { name: /Old lines that end 1/ }))
    expect(screen.getByTestId('relation-old')).toBeTruthy()
    expect(screen.queryByTestId('relation-new')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /New lines that start 1/ }))
    expect(screen.getByTestId('relation-new')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /In no plan 1/ }))
    expect(screen.getByTestId('relation-free')).toBeTruthy()
  })

  it('finds a row once there are many, opening what it found', () => {
    const elements = Array.from({ length: 9 }, (_none, at) => element(`app-${at}`, `App ${at}`, { lifecycleDates: { live: '2027-01-01' } }))
    setup({ model: model({ elements, transitions: [] }) })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a row' }), { target: { value: 'app 3' } })
    expect(screen.getByTestId('row-app-3')).toBeTruthy()
    expect(screen.queryByTestId('row-app-4')).toBeNull()
  })

  it('can hide what is done and abandoned', () => {
    setup({ model: model({ transitions: [PLAN, { ...PLAN, id: 'tr-2', number: 2, title: 'Over', status: 'done' }] }) })
    expect(screen.getByTestId('plan-tr-2')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide done and abandoned' }))
    expect(screen.queryByTestId('plan-tr-2')).toBeNull()
    expect(screen.getByTestId('plan-tr-1')).toBeTruthy()
  })

  it('marks a row with a finding, and the reader says the finding', () => {
    const relations = [{ type: 'flow', id: 'c1', sourceId: 'billing', targetId: 'wms-old', isBidirectional: false }] as DesignModel['relations']
    setup({ model: model({ relations }) })
    const row = screen.getByTestId('row-wms-old')
    expect(within(row).getByLabelText('The dates of this row disagree')).toBeTruthy()
    fireEvent.click(within(row).getByRole('button', { name: 'Warehouse Management' }))
    expect(within(screen.getByRole('complementary')).getByText(/retires on/)).toBeTruthy()
  })
})

describe('the reader', () => {
  it('opens beside the axis on a first press, and the plan or the board on the second', () => {
    const { actions } = setup()
    fireEvent.click(screen.getByRole('button', { name: /TR-0001 Replace the warehouse system/ }))
    const reader = screen.getByRole('complementary')
    expect(within(reader).getByText('Cutover begins')).toBeTruthy()
    expect(screen.getByTestId('row-wms-old').getAttribute('data-picked')).toBe('related')
    expect(actions.onOpenPlan).not.toHaveBeenCalled()
    fireEvent.click(within(reader).getByRole('button', { name: 'Open plan' }))
    expect(actions.onOpenPlan).toHaveBeenCalledWith('tr-1')
    fireEvent.click(within(screen.getByTestId('row-wms-new')).getByRole('button', { name: /Warehouse Management \(new\)/ }))
    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'Open on the board' }))
    expect(actions.onOpenElement).toHaveBeenCalledWith('wms-new')
  })

  it('opens on the row an address asks for', () => {
    setup({ select: 'tr-1' })
    expect(within(screen.getByRole('complementary')).getByRole('button', { name: 'Open plan' })).toBeTruthy()
  })

  it('shows the board on a milestone\'s day', () => {
    const { actions } = setup()
    fireEvent.click(screen.getByRole('button', { name: /TR-0001 Replace the warehouse system/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Show board on…' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Cutover begins/ }))
    expect(actions.setAsOf).toHaveBeenCalledWith('2027-04-01')
  })

  it('draws the initiatives from below in words, opens one in the scope that keeps it, and plots what they change under a switch', () => {
    const onOpenInitiative = vi.fn()
    const held = element('crm', 'Customer Hub', { lifecycleDates: { live: '2027-02-01' } })
    const below = [{ scope: 'sales', label: 'Sales', plan: { ...PLAN, id: 'p-below', number: 7, title: 'New customer hub', elements: [] }, elements: [held] }]
    setup({ fromBelow: below, onOpenInitiative })
    const row = screen.getByTestId('initiative-sales-p-below')
    expect(within(row).getByText('in Sales')).toBeTruthy()
    expect(screen.getByTestId('row-crm')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show what the initiatives below change' }))
    expect(screen.queryByTestId('row-crm')).toBeNull()
    fireEvent.click(within(row).getByRole('button', { name: /TR-0007 New customer hub/ }))
    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'Open in Sales' }))
    expect(onOpenInitiative).toHaveBeenCalledWith('sales', 'p-below')
  })
})

describe('with nothing dated', () => {
  it('says what belongs here and offers a start, and no result with nothing behind it', () => {
    const { actions } = setup({ model: model({ elements: [element('billing', 'Billing')], transitions: [] }) })
    expect(screen.getByText('Nothing here has a date yet.')).toBeTruthy()
    expect(screen.queryByText('The dates agree with each other.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'New plan' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'A plan' } })
    fireEvent.click(within(screen.getByRole('dialog', { name: 'What is the plan called?' })).getByRole('button', { name: 'New plan' }))
    expect(actions.addTransition).toHaveBeenCalledWith('A plan')
  })

  it('is not empty when only the scopes below have dated plans', () => {
    setup({ model: model({ elements: [], transitions: [] }), fromBelow: [{ scope: 'sales', label: 'Sales', plan: PLAN }] })
    expect(screen.queryByText('Nothing here has a date yet.')).toBeNull()
    expect(screen.getByTestId('initiative-sales-tr-1')).toBeTruthy()
  })

  it('still draws a finding with nothing dated', () => {
    const elements = [element('a', 'A'), element('b', 'B'), element('a-c', 'Ledger', { kind: 'component', parentId: 'a' })]
    const relations = [{ type: 'flow', id: 'x1', sourceId: 'a-c', targetId: 'b', isBidirectional: false }] as DesignModel['relations']
    setup({ model: model({ elements, relations, transitions: [] }) })
    expect(screen.getByTestId('findings-group')).toBeTruthy()
  })
})

describe('the checks', () => {
  it('reports what the dates disagree about, says so when they agree, and always says what it cannot tell', () => {
    setup({
      model: model({
        relations: [{ type: 'flow', id: 'c1', sourceId: 'billing', targetId: 'wms-old', isBidirectional: false }],
      }),
    })
    expect(within(findingsBox()).getAllByTestId('findings-group').map((row) => row.textContent))
      .toEqual([expect.stringContaining('Retires while others still depend on it(1)')])
    unfoldFindings(findingsBox())
    expect(screen.getByText(/Warehouse Management retires on 31 Jan 2028 with 1 connections still live/))
      .toBeTruthy()
    cleanup()
    setup()
    expect(screen.getByText('The dates agree with each other.')).toBeTruthy()
    cleanup()
    // A list that looked thorough is exactly what would make somebody trust it
    // past what it can do.
    setup()
    expect(screen.getByText(/cannot tell you a landscape is out of date/)).toBeTruthy()
  })

  /**
   * The one finding with something to do about it (ADR-0013, redone): the
   * application interface nobody drew, offered rather than drawn, because a
   * line nobody agreed to is the clutter this step removes.
   */
  describe('an interface the container lines imply', () => {
    const implied = () => model({
      elements: [
        element('wms-old', 'Warehouse Management'), element('billing', 'Billing'),
        element('billing-ledger', 'Ledger', { kind: 'component', parentId: 'billing' }),
      ],
      transitions: [],
      relations: [
        { type: 'flow', id: 'x1', sourceId: 'billing-ledger', targetId: 'wms-old', isBidirectional: false },
      ],
    })

    it('says how many run between which two applications, and offers to accept it', async () => {
      const acceptInterface = vi.fn()
      setup({ model: implied(), actions: { acceptInterface } as never })
      const explanation = opened('finding-impliedInterface-x1')
      expect(within(explanation).getByTestId('finding-sentence').textContent).toMatch(/1 container interfaces between Billing and Warehouse Management/)
      expect(await axeFindings()).toEqual([])
      pressAction(explanation, 'Accept')
      expect(acceptInterface).toHaveBeenCalledWith('x1')
    })

    it('leaves it out where the scope marked it as intended, and lists it under Accepted to take back', async () => {
      const takeBackMark = vi.fn()
      setup({ model: implied(), marks: [{ check: 'check.impliedInterface', key: 'x1', on: '2026-10-11', reason: 'Drawn in the next plan' }], actions: { takeBackMark } as never })
      expect(screen.queryByTestId('findings-group')).toBeNull()
      expect(screen.getByText('The dates agree with each other.')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Accepted (1)' }))
      expect(screen.getByTestId('accepted-reason').textContent).toContain('“Drawn in the next plan”')
      expect(await axeFindings()).toEqual([])
      fireEvent.click(screen.getByRole('button', { name: /^Take back/ }))
      expect(takeBackMark).toHaveBeenCalledWith('check.impliedInterface x1')
    })

    it('marks it as intended from its explanation, with the reason given', () => {
      const markIntended = vi.fn()
      setup({ model: implied(), actions: { markIntended } as never })
      fireEvent.click(within(opened('finding-impliedInterface-x1')).getByRole('button', { name: 'Mark as intended…' }))
      fireEvent.change(screen.getByTestId('finding-mark-reason'), { target: { value: 'Drawn in the next plan' } })
      fireEvent.click(screen.getByTestId('finding-mark-confirm'))
      expect(markIntended).toHaveBeenCalledWith(expect.objectContaining({ kind: 'impliedInterface', id: 'x1' }), 'Drawn in the next plan')
    })

    it('offers nothing to a reader', () => {
      setup({ model: implied(), readOnly: true, marks: [{ check: 'check.impliedInterface', key: 'x9', on: '2026-10-11' }], actions: { markIntended: vi.fn(), takeBackMark: vi.fn() } as never })
      const explanation = opened('finding-impliedInterface-x1')
      expect(within(explanation).queryByTestId('finding-action-acceptInterface')).toBeNull()
      expect(within(explanation).queryByTestId('finding-mark')).toBeNull()
    })
  })

  it('opens what a finding is about: the element, or the element a line starts from', () => {
    const onOpenElement = vi.fn()
    const relations = [
      { type: 'flow', id: 'c1', sourceId: 'billing', targetId: 'wms-old', isBidirectional: false },
      { type: 'flow', id: 'c2', sourceId: 'billing', targetId: 'wms-old', isBidirectional: false, validUntil: '2029-01-01' },
    ] as DesignModel['relations']
    setup({ model: model({ relations }), actions: { onOpenElement } as never })
    pressAction(opened('finding-retiresWithDependants-wms-old'), 'Open it')
    expect(onOpenElement).toHaveBeenLastCalledWith('wms-old')
    fireEvent.click(screen.getByRole('button', { name: /All findings/ }))
    pressAction(opened('finding-lineOutlivesEnd-c2'), 'Open the connection')
    expect(onOpenElement).toHaveBeenLastCalledWith('billing')
  })
})

describe('a plan', () => {
  it('is written from its name by Enter or the button, and says what comes next', () => {
    const { actions } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'New plan' }))
    const dialog = screen.getByRole('dialog', { name: 'What is the plan called?' })
    expect(within(dialog).getByText(/starts as a draft/)).toBeTruthy()
    const name = within(dialog).getByRole('textbox', { name: 'Name' })
    fireEvent.change(name, { target: { value: 'Next plan' } })
    fireEvent.submit(name.closest('form')!)
    expect(actions.addTransition).toHaveBeenCalledWith('Next plan')
    expect(actions.addTransition).toHaveBeenCalledTimes(1)
  })
})

describe('the handle on the ruler', () => {
  it('puts the board behind the page on a day, on the ruler\'s own scale, and writes nothing', () => {
    const { actions } = setup()
    const handle = screen.getByRole('slider', { name: 'The day the board shows' })
    expect(handle.getAttribute('aria-valuetext')).toBe('8 Sept 2026')
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(actions.setAsOf).toHaveBeenCalledWith('2026-09-09')
  })

  it('says the day the board shows, and goes when no board is behind the page', () => {
    setup({ asOf: '2027-01-01' })
    expect(screen.getByText(/Board shows 1 Jan 2027/)).toBeTruthy()
    cleanup()
    setup({ boardBehind: false })
    expect(screen.queryByRole('slider')).toBeNull()
  })
})

describe('read-only', () => {
  it('offers no way to write a plan, and still reads and looks', () => {
    setup({ readOnly: true })
    expect(screen.queryByRole('button', { name: 'New plan' })).toBeNull()
    expect(screen.getByRole('slider', { name: 'The day the board shows' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /TR-0001 Replace the warehouse system/ }))
    expect(within(screen.getByRole('complementary')).getByRole('button', { name: 'Open plan' })).toBeTruthy()
  })
})
