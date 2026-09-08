// @vitest-environment jsdom
/**
 * The roadmap, on screen (ADR-0009).
 *
 * The arithmetic is pinned in `timeline.test.ts` and `checks.test.ts`; what is
 * pinned here is what the page promises: only dated things get a row, the
 * scrubber moves the board behind it, a band opens its plan, a window cuts the
 * axis to a period, and a landscape with no dates says so instead of drawing
 * an empty frame.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { RoadmapPage } from './RoadmapPage'
import type { RoadmapActions, RoadmapPageProps } from './RoadmapPage'
import { renderShell } from '../../app/testing/renderShell'
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
    name: 'Acme', customerName: 'Acme', diagrams: [], connections: [],
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

function setup(over: Partial<RoadmapPageProps> = {}) {
  const actions: RoadmapActions = {
    addTransition: vi.fn(),
    onOpenPlan: vi.fn(),
    setAsOf: vi.fn(),
    onOpenElement: vi.fn(),
    ...over.actions,
  }
  const view = renderShell(
    <RoadmapPage
      open
      model={model()}
      today={TODAY}
      readOnly={false}
      onClose={vi.fn()}
      {...over}
      // After `over`: the fakes above already carry whatever a caller overrode.
      actions={actions}
    />,
  )
  return { ...view, actions }
}

/**
 * The page is a fullscreen `Dialog`, which portals to `document.body` rather
 * than into the render container — so the DOM queries look at the document.
 */
const find = (selector: string) => document.body.querySelector(selector)

describe('the axis', () => {
  it('gives a row to what has a date and to nothing else', () => {
    setup()
    expect(find('[data-testid="track-wms-old"]')).not.toBeNull()
    expect(find('[data-testid="track-wms-new"]')).not.toBeNull()
    // Billing has no dates: it is on the canvas, not on the roadmap.
    expect(find('[data-testid="track-billing"]')).toBeNull()
  })

  it('draws a span per phase the element passes through', () => {
    setup()
    const track = find('[data-testid="track-wms-old"]')!
    expect([...track.querySelectorAll('[data-phase]')].map((el) => el.getAttribute('data-phase')))
      .toEqual(['live', 'retiring', 'retired'])
  })

  it('draws a plan as a band with its milestones on it', () => {
    setup()
    expect(within(find('[data-testid="plan-tr-1"]') as HTMLElement).getAllByTestId('milestone'))
      .toHaveLength(1)
  })

  it('says so plainly when nothing has a date yet', () => {
    setup({ model: model({ elements: [element('billing', 'Billing')], transitions: [] }) })
    expect(screen.getByText('Nothing here has a date yet.')).toBeTruthy()
  })
})

describe('the checks', () => {
  it('reports what the dates disagree about', () => {
    setup({
      model: model({
        connections: [{ id: 'c1', sourceId: 'billing', targetId: 'wms-old', isBidirectional: false }],
      }),
    })
    expect(screen.getByText(/Warehouse Management retires on 2028-01-31 with 1 connections still live/))
      .toBeTruthy()
  })

  it('says the dates agree when they do', () => {
    setup()
    expect(screen.getByText('The dates agree with each other.')).toBeTruthy()
  })

  it('always says what it cannot tell you', () => {
    // A list that looked thorough is exactly what would make somebody trust it
    // past what it can do.
    setup()
    expect(screen.getByText(/cannot tell you a landscape is out of date/)).toBeTruthy()
  })
})

describe('a plan', () => {
  it('is opened from its band', () => {
    const { actions } = setup()
    fireEvent.click(screen.getByText(/Replace the warehouse system/))
    expect(actions.onOpenPlan).toHaveBeenCalledWith('tr-1')
  })

  it('is written with a title and left to the caller to open', () => {
    const { actions } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'New plan' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Move billing' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(actions.addTransition).toHaveBeenCalledWith('Move billing')
  })
})

describe('the window', () => {
  it('cuts the axis to the period chosen, once both ends are set', () => {
    setup()
    fireEvent.change(screen.getByLabelText('Show from'), { target: { value: '2029-01-01' } })
    // One end alone changes nothing: the whole axis still shows.
    expect(find('[data-testid="track-wms-old"]')).not.toBeNull()
    fireEvent.change(screen.getByLabelText('Show to'), { target: { value: '2029-12-31' } })
    // Both applications have settled by 2029 — the old one gone, the new one
    // live with nothing left to change — and the plan ended in 2028.
    expect(find('[data-testid="track-wms-old"]')).toBeNull()
    expect(find('[data-testid="track-wms-new"]')).not.toBeNull()
    expect(find('[data-testid="plan-tr-1"]')).toBeNull()
    expect(screen.getAllByText('2029-01-01').length).toBeGreaterThan(0)
  })

  it('goes back to the whole axis in one click', () => {
    setup()
    fireEvent.change(screen.getByLabelText('Show from'), { target: { value: '2029-01-01' } })
    fireEvent.change(screen.getByLabelText('Show to'), { target: { value: '2029-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Whole axis' }))
    expect(find('[data-testid="track-wms-old"]')).not.toBeNull()
  })
})

describe('the scrubber', () => {
  it('puts the board behind the page on a day', () => {
    const { actions } = setup()
    const slider = screen.getByLabelText('Showing') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '200' } })
    expect(actions.setAsOf).toHaveBeenCalledTimes(1)
    // A real day, not a day count: the command carries what the diagram stores.
    expect(actions.setAsOf).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  })
})

describe('read-only', () => {
  it('offers no way to write a plan, move one or scrub', () => {
    setup({ readOnly: true })
    expect(screen.queryByRole('button', { name: 'New plan' })).toBeNull()
    expect((screen.getByLabelText('Showing') as HTMLInputElement).disabled).toBe(true)
  })
})
