// @vitest-environment jsdom
/**
 * The shell's side of the roadmap, a plan's page and Replace… (ADR-0009,
 * ADR-0010).
 *
 * The arithmetic — what a replacement writes, which interface moved where —
 * is pinned in `model/`. What is pinned here is the wiring: that each action
 * is one step on the session's stack, that a shift carries the elements' own
 * dates with it, that the ports are read off the live model, and that leaving
 * a page for the board or a decision closes what this hook had open first.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { laidOut } from '../model/testFixtures';
import { act, cleanup, render } from '@testing-library/react'
import { translator } from '../i18n'
import type { DesignElement, Relation, Transition } from '../model'
import type { HostModel } from '../model/fromInterchange'
import type { ProjectSnapshot } from '../projects/project'
import { useModelSession } from './useModelSession'
import type { ModelSession } from './useModelSession'
import { usePlans } from './usePlans'
import type { Plans } from './usePlans'

afterEach(() => cleanup())

function element(id: string, name: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {}, ...over }
}

const LINE: Relation = { id: 'c1', type: 'flow', sourceId: 'billing', targetId: 'wms-old', isBidirectional: false }

const PLAN: Transition = {
  id: 'tr-1', number: 1, title: 'Replace the warehouse system', status: 'agreed',
  from: '2027-01-15', to: '2028-01-31',
  elements: [{ elementId: 'wms-old', role: 'retires' }, { elementId: 'wms-new', role: 'introduces' }],
  decisions: [], milestones: [{ date: '2027-04-01', name: 'Cutover' }], body: '',
}

const model = (over: Partial<HostModel> = {}): HostModel => ({
  name: 'Landscape',
  customerName: 'Acme',
  elements: [
    element('billing', 'Billing'),
    element('wms-old', 'Warehouse', { lifecycleDates: { retiring: '2027-04-01', retired: '2028-01-31' } }),
    element('wms-new', 'Warehouse (new)', { lifecycle: 'planned', lifecycleDates: { live: '2027-04-01' } }),
  ],
  relations: [LINE],
  diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
  transitions: [PLAN],
  ...over,
})

const project = (m: HostModel = model()): ProjectSnapshot => ({
  path: 'acme/landscape',
  model: m,
  activeDiagramId: 'd1',
  logoLibrary: [],
})

/** The real session underneath, so what is pinned is the stack and the model. */
function mount(initial = project()) {
  const navigate = { toElement: vi.fn(), toDecision: vi.fn() }
  let plans!: Plans
  let session!: ModelSession
  let counter = 0
  function Host() {
    session = useModelSession({ initialProject: initial, notify: vi.fn(), s: translator('en') })
    plans = usePlans({ session, makeId: (p) => `${p}-${++counter}`, s: translator('en'), navigate })
    return null
  }
  render(<Host />)
  return {
    navigate,
    plans: () => plans,
    model: () => session.current(),
    steps: () => session.history().length,
    undo: () => act(() => session.undo()),
  }
}

describe('the roadmap', () => {
  it('writes a plan as one step, numbered after the last, and opens it', () => {
    const h = mount()
    act(() => h.plans().roadmapActions.addTransition('Move billing'))
    const written = h.model().transitions?.find((one) => one.title === 'Move billing')
    expect(written).toMatchObject({ number: 2, status: 'draft' })
    expect(h.plans().planId).toBe(written?.id)
    expect(h.plans().plan?.title).toBe('Move billing')
    expect(h.steps()).toBe(1)
  })

  it('puts the board behind the page on a day, as one coalesced step', () => {
    const h = mount()
    act(() => h.plans().roadmapActions.setAsOf('2027-06-01'))
    act(() => h.plans().roadmapActions.setAsOf('2027-07-01'))
    expect(h.model().diagrams[0]?.asOf).toBe('2027-07-01')
    expect(h.steps()).toBe(1)
  })

  it('closes before it hands over to the board', () => {
    const h = mount()
    act(() => h.plans().openRoadmap())
    act(() => h.plans().openPlan('tr-1'))
    act(() => h.plans().roadmapActions.onOpenElement('billing'))
    expect(h.navigate.toElement).toHaveBeenCalledWith('billing')
    expect(h.plans().roadmapOpen).toBe(false)
    expect(h.plans().planId).toBeUndefined()
  })
})

describe('a plan', () => {
  it('is read off the model, so one deleted under its page is gone from it', () => {
    const h = mount()
    act(() => h.plans().openPlan('tr-1'))
    expect(h.plans().plan?.title).toBe('Replace the warehouse system')
    act(() => h.plans().planActions.removeTransition('tr-1'))
    expect(h.plans().plan).toBeUndefined()
    h.undo()
    expect(h.plans().plan?.title).toBe('Replace the warehouse system')
  })

  it('shifts its window and the dates on what it introduces and retires, as one step', () => {
    const h = mount()
    act(() => h.plans().planActions.shiftTransition('tr-1', 30))
    const m = h.model()
    expect(m.transitions?.[0]).toMatchObject({ from: '2027-02-14', to: '2028-03-01' })
    expect(m.elements.find((e) => e.id === 'wms-old')?.lifecycleDates)
      .toEqual({ retiring: '2027-05-01', retired: '2028-03-01' })
    expect(m.elements.find((e) => e.id === 'wms-new')?.lifecycleDates).toEqual({ live: '2027-05-01' })
    expect(h.steps()).toBe(1)
    h.undo()
    expect(h.model().transitions?.[0]).toMatchObject({ from: '2027-01-15' })
  })

  it('ports an interface as a twin on the new end and the original closed, as one step', () => {
    const h = mount()
    act(() => h.plans().planActions.port('tr-1', 'c1', 'wms-new', '2027-04-01'))
    const lines = h.model().relations
    expect(lines).toHaveLength(2)
    expect(lines.find((c) => c.id === 'c1')?.validUntil).toBe('2027-03-31')
    expect(lines.find((c) => c.id !== 'c1')).toMatchObject({ sourceId: 'billing', targetId: 'wms-new', validFrom: '2027-04-01' })
    expect(h.steps()).toBe(1)

    act(() => h.plans().planActions.unport('tr-1', 'c1'))
    expect(h.model().relations).toHaveLength(1)
    expect(h.model().relations[0]?.validUntil).toBeUndefined()
  })

  it('ports every remaining interface in one step, and does nothing when none remain', () => {
    const h = mount()
    act(() => h.plans().planActions.portAll('tr-1', 'wms-new', '2027-04-01'))
    expect(h.model().relations).toHaveLength(2)
    expect(h.steps()).toBe(1)
    act(() => h.plans().planActions.portAll('tr-1', 'wms-new', '2027-04-01'))
    expect(h.steps()).toBe(1)
  })

  it('closes before it hands over to a decision', () => {
    const h = mount()
    act(() => h.plans().openRoadmap())
    act(() => h.plans().openPlan('tr-1'))
    act(() => h.plans().planActions.onOpenDecision?.('adr-1'))
    expect(h.navigate.toDecision).toHaveBeenCalledWith('adr-1')
    expect(h.plans().roadmapOpen).toBe(false)
    expect(h.plans().planId).toBeUndefined()
  })
})

describe('Replace…', () => {
  it('starts from an element read off the model, and can be put down', () => {
    const h = mount()
    act(() => h.plans().startReplace('billing'))
    expect(h.plans().replacing?.name).toBe('Billing')
    act(() => h.plans().cancelReplace())
    expect(h.plans().replacing).toBeUndefined()
  })

  it('writes the whole replacement as one step and lands on the plan', () => {
    const h = mount()
    act(() => h.plans().startReplace('billing'))
    act(() => h.plans().confirmReplace({
      from: [{ elementId: 'billing', role: 'retires' }],
      to: { name: 'Billing (new)' },
      shadowFrom: '2027-09-01',
      cutover: '2027-12-01',
    }))
    const m = h.model()
    const arrived = m.elements.find((e) => e.name === 'Billing (new)')
    expect(arrived).toBeDefined()
    expect(m.elements.find((e) => e.id === 'billing')?.successorId).toBe(arrived?.id)
    const plan = m.transitions?.find((one) => one.number === 2)
    expect(plan?.elements).toEqual(expect.arrayContaining([
      { elementId: 'billing', role: 'retires' }, { elementId: arrived?.id, role: 'introduces' },
    ]))
    expect(h.plans().replacing).toBeUndefined()
    expect(h.plans().planId).toBe(plan?.id)
    expect(h.steps()).toBe(1)
  })

  it('is closed with everything else by closeAll', () => {
    const h = mount()
    act(() => h.plans().openRoadmap())
    act(() => h.plans().startReplace('billing'))
    act(() => h.plans().closeAll())
    expect(h.plans().roadmapOpen).toBe(false)
    expect(h.plans().replacing).toBeUndefined()
  })
})
