/**
 * What the dates contradict, and what they do not (ADR-0009).
 *
 * The negative cases matter more than the positive ones here. A check that
 * fires on a landscape that is correct teaches people to ignore the list, and
 * the list is the only thing standing between a dated landscape and a confident
 * wrong answer.
 */
import { describe, expect, it } from 'vitest'
import { findings } from './checks'
import type { CheckContext } from './checks'
import type { DesignElement, Relation } from './types'

const TODAY = '2026-09-08'

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'application', name: id, lifecycle: 'live',
    isManaged: true, aspects: {}, ...over,
  }
}

function connection(id: string, sourceId: string, targetId: string, over: Partial<Relation> = {}): Relation {
  return { id, type: 'flow', sourceId, targetId, isBidirectional: false, ...over }
}

function check(
  elements: DesignElement[],
  relations: Relation[] = [],
  transitions: CheckContext['model']['transitions'] = [],
): ReturnType<typeof findings> {
  return findings({ model: { elements, relations, transitions }, today: TODAY })
}

const kinds = (list: ReturnType<typeof findings>) => list.map((one) => one.kind)

describe('a retirement with things still plugged into it', () => {
  it('is reported, with how many', () => {
    const list = check(
      [
        element('wms', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'wms2' }),
        element('wms2', { lifecycle: 'planned', lifecycleDates: { live: '2027-04-01' } }),
        element('billing'),
        element('orders'),
      ],
      [connection('c1', 'billing', 'wms'), connection('c2', 'wms', 'orders')],
    )
    const found = list.find((one) => one.kind === 'retiresWithDependants')!
    expect(found).toMatchObject({ subject: 'element', id: 'wms', count: 2, detail: '2028-01-31' })
  })

  it('is not reported when the lines close in time', () => {
    // A line with a window that ends with the application is the correct answer
    // to this problem, not an instance of it.
    const list = check(
      [
        element('wms', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'wms2' }),
        element('wms2', { lifecycle: 'planned', lifecycleDates: { live: '2027-04-01' } }),
        element('billing'),
      ],
      [connection('c1', 'billing', 'wms', { validUntil: '2028-01-30' })],
    )
    expect(kinds(list)).not.toContain('retiresWithDependants')
  })

  it('is not reported when the neighbour goes at the same time', () => {
    const list = check(
      [
        element('wms', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'x' }),
        element('x'),
        element('sidecar', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'x' }),
      ],
      [connection('c1', 'sidecar', 'wms')],
    )
    expect(kinds(list)).not.toContain('retiresWithDependants')
  })
})

describe('a successor', () => {
  it('is reported when it arrives after the thing it replaces has gone', () => {
    const list = check([
      element('wms', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'wms2' }),
      element('wms2', { lifecycle: 'planned', lifecycleDates: { live: '2028-06-01' } }),
    ])
    expect(list.find((one) => one.kind === 'successorTooLate'))
      .toMatchObject({ id: 'wms', detail: 'wms2' })
  })

  it('is accepted on the very day of the cutover', () => {
    // Same-day is the plan working, not a gap.
    const list = check([
      element('wms', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'wms2' }),
      element('wms2', { lifecycle: 'planned', lifecycleDates: { live: '2028-01-31' } }),
    ])
    expect(kinds(list)).not.toContain('successorTooLate')
  })

  it('is reported as missing when a retirement names nobody', () => {
    const list = check([element('wms', { lifecycleDates: { retired: '2028-01-31' } })])
    expect(kinds(list)).toContain('successorMissing')
  })

  it('is not asked for at all when nothing retires', () => {
    expect(check([element('wms'), element('billing')])).toEqual([])
  })

  it('is answered by a plan that retires it and introduces something (ADR-0010)', () => {
    // A merge names one successor for three sources in the plan; the field on
    // each source is the shorthand, not the only way to say it.
    const list = check(
      [element('wms', { lifecycleDates: { retired: '2028-01-31' } }), element('wms-new')],
      [],
      [{
        id: 'tr', number: 1, title: 'Replace', status: 'agreed',
        elements: [{ elementId: 'wms', role: 'retires' }, { elementId: 'wms-new', role: 'introduces' }],
        decisions: [], milestones: [], body: '',
      }],
    )
    expect(kinds(list)).not.toContain('successorMissing')
  })
})

describe('a line that outlives one of its ends', () => {
  it('is reported', () => {
    const list = check(
      [
        element('wms', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'x' }),
        element('x'),
      ],
      [connection('c1', 'wms', 'x', { label: 'sync', validUntil: '2028-06-01' })],
    )
    expect(list.find((one) => one.kind === 'lineOutlivesEnd'))
      .toMatchObject({ subject: 'connection', id: 'c1', name: 'sync', detail: 'wms' })
  })

  it('is not reported for a line with no window of its own', () => {
    // A line with no window follows its ends by definition, so it cannot
    // contradict them.
    const list = check(
      [element('wms', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'x' }), element('x')],
      [connection('c1', 'wms', 'x')],
    )
    expect(kinds(list)).not.toContain('lineOutlivesEnd')
  })
})

describe('a plan', () => {
  const plan = (over = {}) => ({
    id: 'tr-1', number: 1, title: 'Replace the warehouse system', status: 'running' as const,
    elements: [], decisions: [], milestones: [], body: '', ...over,
  })

  it('is reported when its window closed and it is still running', () => {
    const list = check([], [], [plan({ to: '2026-06-01' })])
    expect(list.find((one) => one.kind === 'planOverdue'))
      .toMatchObject({ subject: 'transition', id: 'tr-1', detail: '2026-06-01' })
  })

  it('is left alone once it is done or abandoned', () => {
    expect(kinds(check([], [], [plan({ to: '2026-06-01', status: 'done' as const })]))).toEqual([])
    expect(kinds(check([], [], [plan({ to: '2026-06-01', status: 'abandoned' as const })]))).toEqual([])
  })

  it('is left alone while its window is still open', () => {
    expect(kinds(check([], [], [plan({ to: '2027-06-01' })]))).toEqual([])
  })
})

describe('the list as a whole', () => {
  it('says nothing at all about a landscape with no dates on it', () => {
    // The whole feature is additive: a project that ignores dates gets an empty
    // findings list rather than a page of advice.
    expect(check(
      [element('a'), element('b')],
      [connection('c1', 'a', 'b')],
    )).toEqual([])
  })

  it('puts an outage above a conversation', () => {
    const list = check(
      [
        element('wms', { lifecycleDates: { retired: '2028-01-31' } }),
        element('billing'),
      ],
      [connection('c1', 'billing', 'wms')],
    )
    // A retirement with dependants is an outage; a missing successor is a
    // question for the next meeting.
    expect(kinds(list)).toEqual(['retiresWithDependants', 'successorMissing'])
  })
})
