// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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

describe('a platform that retires before what stands on it (ADR-0013)', () => {
  const platform = (id: string, over: Partial<DesignElement> = {}) => element(id, { kind: 'platform', ...over })
  const row = (id: string, type: Relation['type'], sourceId: string, targetId: string, over: Partial<Relation> = {}): Relation =>
    ({ id, type, sourceId, targetId, ...over })

  it('is reported on the application, for what it runs on and what it uses', () => {
    const list = check(
      [platform('cluster', { lifecycleDates: { retired: '2027-06-30' }, successorId: 'cluster2' }), platform('cluster2'), element('orders'), element('kafka', { kind: 'platform' })],
      [row('h1', 'hostedOn', 'orders', 'cluster'), row('u1', 'uses', 'orders', 'kafka')],
    )
    const found = list.filter((one) => one.kind === 'platformRetiresFirst')
    expect(found).toEqual([{
      kind: 'platformRetiresFirst', subject: 'element', id: 'orders', name: 'orders', detail: 'cluster', relationType: 'hostedOn',
    }])
  })

  it('is reported on the application and names the container that is left standing on nothing', () => {
    // Hosting is a container-level fact (ADR-0013, redone), and a person
    // looking for the problem is looking for the application.
    const list = check(
      [
        platform('cluster', { lifecycleDates: { retired: '2027-06-30' }, successorId: 'cluster2' }), platform('cluster2'),
        element('wms'), element('wms-db', { kind: 'component', parentId: 'wms' }),
      ],
      [row('h1', 'hostedOn', 'wms-db', 'cluster')],
    )
    expect(list.filter((one) => one.kind === 'platformRetiresFirst')).toEqual([{
      kind: 'platformRetiresFirst', subject: 'element', id: 'wms', name: 'wms',
      detail: 'cluster · wms-db', relationType: 'hostedOn',
    }])
  })

  it('is not reported when the thing goes first, or the row closes in time, or the platform is not dated', () => {
    const list = check(
      [
        platform('cluster', { lifecycleDates: { retired: '2027-06-30' }, successorId: 'cluster2' }), platform('cluster2'),
        platform('undated', { lifecycle: 'retired' }),
        element('gone', { lifecycleDates: { retired: '2027-01-01' }, successorId: 'stays' }),
        element('stays'), element('moved'),
      ],
      [
        row('h1', 'hostedOn', 'gone', 'cluster'),
        row('h2', 'hostedOn', 'moved', 'cluster', { validUntil: '2027-06-01' }),
        row('h3', 'hostedOn', 'stays', 'undated'),
      ],
    )
    expect(kinds(list)).not.toContain('platformRetiresFirst')
  })

  /**
   * A platform goes when anything above it goes (ADR-0014 §2.7): retire the
   * cluster and the containers in its namespaces are flagged, naming the
   * cluster — and the namespace drawn here as a stand-in is told by the tree
   * what it sits in.
   */
  it('flags what sits under a retiring platform, naming the platform that actually goes', () => {
    const tree = [
      platform('cluster', { lifecycleDates: { retired: '2027-06-30' }, successorId: 'cluster2' }), platform('cluster2'),
      platform('ns', { parentId: 'cluster' }),
      platform('later', { parentId: 'cluster', lifecycleDates: { retired: '2028-01-01' }, successorId: 'cluster2' }),
      element('wms'), element('wms-db', { kind: 'component', parentId: 'wms' }), element('orders'),
    ]
    const list = check(tree, [row('h1', 'hostedOn', 'wms-db', 'ns'), row('h2', 'hostedOn', 'orders', 'later')])
    expect(list.filter((one) => one.kind === 'platformRetiresFirst')).toEqual([
      { kind: 'platformRetiresFirst', subject: 'element', id: 'orders', name: 'orders', detail: 'cluster', relationType: 'hostedOn' },
      { kind: 'platformRetiresFirst', subject: 'element', id: 'wms', name: 'wms', detail: 'cluster · wms-db', relationType: 'hostedOn' },
    ])
    // A stand-in of the namespace carries no parent: the tree says.
    const standIn = tree.map((e) => (e.id === 'ns' ? { ...e, ref: 'platforms', parentId: undefined } : e))
    expect(kinds(findings({ model: { elements: standIn, relations: [row('h1', 'hostedOn', 'wms-db', 'ns')] }, today: TODAY })))
      .not.toContain('platformRetiresFirst')
    const told = findings({
      model: { elements: standIn, relations: [row('h1', 'hostedOn', 'wms-db', 'ns')] }, today: TODAY,
      platformTree: { parentOf: (id) => (id === 'ns' ? 'cluster' : undefined) },
    })
    expect(told.filter((one) => one.kind === 'platformRetiresFirst').map((one) => one.detail)).toEqual(['cluster · wms-db'])
  })

  /**
   * A stand-in carries no dates of its own (ADR-0012 §3): a landscape standing
   * on another scope's cluster learns the day it goes from the tree, as it
   * learns what the cluster is filed under.
   */
  it('dates a platform this scope holds only as a stand-in by the scope that defines it', () => {
    const elements = [
      platform('cluster', { ref: 'platforms' }), platform('ns', { ref: 'platforms' }),
      element('wms'), element('wms-db', { kind: 'component', parentId: 'wms' }), element('orders'),
    ]
    const relations = [row('h1', 'hostedOn', 'wms-db', 'ns'), row('h2', 'hostedOn', 'orders', 'cluster')]
    expect(kinds(findings({ model: { elements, relations }, today: TODAY }))).not.toContain('platformRetiresFirst')
    const told = findings({
      model: { elements, relations }, today: TODAY,
      platformTree: {
        parentOf: (id) => (id === 'ns' ? 'cluster' : undefined),
        retiredOf: (id) => (id === 'cluster' ? '2027-06-30' : undefined),
      },
    })
    expect(told.filter((one) => one.kind === 'platformRetiresFirst').map((one) => [one.id, one.detail]))
      .toEqual([['orders', 'cluster'], ['wms', 'cluster · wms-db']])
  })

  it('ranks under a retirement with dependants and above a line that outlives an end', () => {
    const list = check(
      [
        platform('cluster', { lifecycleDates: { retired: '2027-06-30' }, successorId: 'cluster2' }), platform('cluster2'),
        element('orders'), element('old', { lifecycleDates: { retired: '2027-01-01' }, successorId: 'orders' }),
      ],
      [row('h1', 'hostedOn', 'orders', 'cluster'), connection('c1', 'old', 'orders', { validUntil: '2027-03-01' })],
    )
    const order = kinds(list)
    expect(order.indexOf('retiresWithDependants')).toBeLessThan(order.indexOf('platformRetiresFirst'))
    expect(order.indexOf('platformRetiresFirst')).toBeLessThan(order.indexOf('lineOutlivesEnd'))
  })
})

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

  it('does not count what it runs on or uses: that row goes with it', () => {
    const list = check(
      [
        element('wms', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'wms2' }),
        element('wms2'), element('cloud', { kind: 'platform' }),
      ],
      [{ id: 'u1', type: 'uses', sourceId: 'wms', targetId: 'cloud' } as Relation],
    )
    expect(kinds(list)).not.toContain('retiresWithDependants')
  })

  it('counts a container line by the interface it is part of, and a container with its application', () => {
    const elements = [
      element('wms', { lifecycleDates: { retired: '2031-03-31' }, successorId: 'x' }), element('x'),
      element('billing', { lifecycleDates: { retired: '2028-12-31' }, successorId: 'x' }),
      element('ledger', { kind: 'component', parentId: 'billing' }),
      element('orders'), element('orders-api', { kind: 'component', parentId: 'orders' }),
    ]
    const dated = connection('i1', 'wms', 'orders', { validUntil: '2028-12-30' })
    // The landing has no dates; the interface it is part of ends in time.
    const landed = connection('r1', 'wms', 'orders-api', { refines: 'i1' })
    // A container of an application that is gone by then goes with it.
    const toGone = connection('r2', 'wms', 'ledger')
    const found = check(elements, [dated, landed, toGone]).filter((one) => one.kind === 'retiresWithDependants')
    // Only the application that goes first: the line is plugged into ITS container.
    expect(found.map((one) => one.id)).toEqual(['billing'])
    // Undated, the interface — and so its landing — is still live, and it is
    // one interface: the landing is where it arrives, not a second one.
    const open = check(elements, [{ ...dated, validUntil: undefined }, landed])
    expect(open.find((one) => one.kind === 'retiresWithDependants' && one.id === 'wms')?.count).toBe(1)
  })

  it('counts one interface once, however many landings it has', () => {
    const elements = [
      element('wms', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'x' }), element('x'),
      element('wms-api', { kind: 'component', parentId: 'wms' }), element('wms-events', { kind: 'component', parentId: 'wms' }),
      element('orders'),
    ]
    const list = check(elements, [
      connection('i1', 'orders', 'wms'),
      connection('r1', 'orders', 'wms-api', { refines: 'i1' }),
      connection('r2', 'orders', 'wms-events', { refines: 'i1' }),
    ])
    expect(list.find((one) => one.kind === 'retiresWithDependants')?.count).toBe(1)
    // Two landings with the interface's own line closed in time are still one
    // interface, and still plugged in by the landings that are not.
    const landingsOnly = check(elements, [
      connection('i1', 'orders', 'wms', { validUntil: '2027-12-31' }),
      connection('r1', 'orders', 'wms-api', { refines: 'i1', validUntil: '2028-06-30' }),
      connection('r2', 'orders', 'wms-events', { refines: 'i1', validUntil: '2028-06-30' }),
    ])
    expect(landingsOnly.find((one) => one.kind === 'retiresWithDependants')?.count).toBe(1)
  })

  it('counts a line into one of its containers that has landed nowhere', () => {
    const list = check(
      [
        element('wms', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'x' }), element('x'),
        element('wms-api', { kind: 'component', parentId: 'wms' }), element('orders'),
      ],
      [connection('c1', 'orders', 'wms-api')],
    )
    expect(list.find((one) => one.kind === 'retiresWithDependants')).toMatchObject({ id: 'wms', count: 1 })
  })

  it('does not count a container of its own that was gone before it', () => {
    const list = check(
      [
        element('wms', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'x' }), element('x'),
        element('wms-api', { kind: 'component', parentId: 'wms', lifecycleDates: { retired: '2027-01-01' } }),
        element('orders'),
      ],
      [connection('c1', 'orders', 'wms-api')],
    )
    expect(list.find((one) => one.kind === 'retiresWithDependants' && one.id === 'wms')).toBeUndefined()
  })

  it('counts only rows that depend on it: not who answers for it, and not what it supports or is supported by', () => {
    const row = (id: string, type: Relation['type'], sourceId: string, targetId: string): Relation =>
      ({ id, type, sourceId, targetId })
    const goes = { lifecycleDates: { retired: '2028-01-31' }, successorId: 'x' }
    const elements = [
      element('x'), element('team', { kind: 'actor' }), element('orders'),
      element('broker', { kind: 'platformService', ...goes }),
      element('picking', { kind: 'function', ...goes }),
      element('cluster', { kind: 'platform', ...goes }),
    ]
    const list = check(elements, [
      row('a1', 'assigned', 'team', 'broker'),
      row('s1', 'supports', 'orders', 'picking'),
    ])
    expect(list.filter((one) => one.kind === 'retiresWithDependants')).toEqual([])
    // Standing on it is depending on it.
    const stood = check(elements, [row('u1', 'uses', 'orders', 'broker'), row('h1', 'hostedOn', 'orders', 'cluster')])
    expect(stood.filter((one) => one.kind === 'retiresWithDependants').map((one) => one.id).sort()).toEqual(['broker', 'cluster'])
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
  it('is reported when it arrives after the thing it replaces has gone, but not on the day', () => {
    const list = check([
      element('wms', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'wms2' }),
      element('wms2', { lifecycle: 'planned', lifecycleDates: { live: '2028-06-01' } }),
    ])
    expect(list.find((one) => one.kind === 'successorTooLate'))
      .toMatchObject({ id: 'wms', detail: 'wms2' })
    // Same-day is the plan working, not a gap.
    const sameDay = check([
      element('wms', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'wms2' }),
      element('wms2', { lifecycle: 'planned', lifecycleDates: { live: '2028-01-31' } }),
    ])
    expect(kinds(sameDay)).not.toContain('successorTooLate')
  })

  it('is reported as missing when a retirement names nobody, and not asked for otherwise', () => {
    const list = check([element('wms', { lifecycleDates: { retired: '2028-01-31' } })])
    expect(kinds(list)).toContain('successorMissing')
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

describe('a successor named by a plan', () => {
  const plan = (status: 'draft' | 'agreed' | 'abandoned', introduces = 'wms-new') => ({
    id: `tr-${status}`, number: 1, title: 'Replace', status,
    elements: [{ elementId: 'wms', role: 'retires' as const }, { elementId: introduces, role: 'introduces' as const }],
    decisions: [], milestones: [], body: '',
  })

  it('is not named by a plan that was abandoned', () => {
    const list = check([element('wms', { lifecycleDates: { retired: '2028-01-31' } }), element('wms-new')], [], [plan('abandoned')])
    expect(kinds(list)).toContain('successorMissing')
    // A draft still says what is meant to take over.
    expect(kinds(check([element('wms', { lifecycleDates: { retired: '2028-01-31' } }), element('wms-new')], [], [plan('draft')])))
      .not.toContain('successorMissing')
  })

  it('is too late when nothing the plan introduces is live by the day it goes', () => {
    const late = element('wms-new', { lifecycle: 'planned', lifecycleDates: { live: '2028-06-01' } })
    const list = check([element('wms', { lifecycleDates: { retired: '2028-01-31' } }), late], [], [plan('agreed')])
    expect(list.find((one) => one.kind === 'successorTooLate')).toMatchObject({ id: 'wms', detail: 'wms-new' })
    const onTime = { ...late, lifecycleDates: { live: '2028-01-31' } }
    expect(kinds(check([element('wms', { lifecycleDates: { retired: '2028-01-31' } }), onTime], [], [plan('agreed')])))
      .not.toContain('successorTooLate')
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
      // `relation`, and which kind of row it was, since ADR-0012 §5 — a row
      // between two things is not always a connection.
      .toMatchObject({ subject: 'relation', relationType: 'flow', id: 'c1', name: 'sync', detail: 'wms' })
  })

  it('is reported when it is valid until the day an end is gone: that is a day it is there and the end is not', () => {
    const list = check(
      [element('wms', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'x' }), element('x')],
      [connection('c1', 'wms', 'x', { validUntil: '2028-01-31' })],
    )
    expect(list.find((one) => one.kind === 'lineOutlivesEnd')).toMatchObject({ id: 'c1', detail: 'wms' })
    const dayBefore = check(
      [element('wms', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'x' }), element('x')],
      [connection('c1', 'wms', 'x', { validUntil: '2028-01-30' })],
    )
    expect(kinds(dayBefore)).not.toContain('lineOutlivesEnd')
  })

  it('is reported for a container whose application goes, and once for an interface and its landing', () => {
    const elements = [
      element('wms', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'x' }), element('x'),
      element('wms-api', { kind: 'component', parentId: 'wms' }), element('orders'),
    ]
    // The container carries no date; its application does.
    const alone = check(elements, [connection('c1', 'orders', 'wms-api', { validUntil: '2028-06-30' })])
    expect(alone.find((one) => one.kind === 'lineOutlivesEnd')).toMatchObject({ id: 'c1', detail: 'wms-api' })
    // A landing with no window follows its interface: the interface is the
    // one contradiction, and the landing is not a second.
    const landed = check(elements, [
      connection('i1', 'orders', 'wms', { validUntil: '2028-06-30' }),
      connection('r1', 'orders', 'wms-api', { refines: 'i1' }),
    ])
    expect(landed.filter((one) => one.kind === 'lineOutlivesEnd').map((one) => one.id)).toEqual(['i1'])
    // A landing whose container goes before its interface ends is its own.
    const early = check(
      [...elements.filter((one) => one.id !== 'wms-api'), element('wms-api', { kind: 'component', parentId: 'wms', lifecycleDates: { retired: '2027-06-30' } })],
      [connection('i1', 'orders', 'wms', { validUntil: '2028-01-30' }), connection('r1', 'orders', 'wms-api', { refines: 'i1' })],
    )
    expect(early.filter((one) => one.kind === 'lineOutlivesEnd').map((one) => one.id)).toEqual(['r1'])
  })

  it('agrees with the retirement about every row: counted as still there on the day is reported as outliving it', () => {
    const elements = [
      element('wms', { lifecycleDates: { retired: '2028-01-31' }, successorId: 'x' }), element('x'),
      element('wms-api', { kind: 'component', parentId: 'wms' }), element('orders'),
    ]
    for (const until of ['2028-01-29', '2028-01-30', '2028-01-31', '2028-02-01']) {
      const rows = [
        connection('i1', 'orders', 'wms', { validUntil: until }),
        connection('r1', 'orders', 'wms-api', { refines: 'i1' }),
      ]
      const list = check(elements, rows)
      const counted = list.some((one) => one.kind === 'retiresWithDependants' && one.id === 'wms')
      const outlives = list.some((one) => one.kind === 'lineOutlivesEnd')
      expect(outlives, `valid until ${until}`).toBe(counted)
      expect(counted).toBe(until >= '2028-01-31')
    }
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

  it('is reported when its window closed and it is still running, and left alone while open', () => {
    const list = check([], [], [plan({ to: '2026-06-01' })])
    expect(list.find((one) => one.kind === 'planOverdue'))
      .toMatchObject({ subject: 'transition', id: 'tr-1', detail: '2026-06-01' })
    expect(kinds(check([], [], [plan({ to: '2027-06-01' })]))).toEqual([])
  })

  it('is left alone once it is done or abandoned', () => {
    expect(kinds(check([], [], [plan({ to: '2026-06-01', status: 'done' as const })]))).toEqual([])
    expect(kinds(check([], [], [plan({ to: '2026-06-01', status: 'abandoned' as const })]))).toEqual([])
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

/**
 * Container lines that add up to an interface nobody drew (ADR-0013, redone).
 *
 * Not a contradiction in the dates but a picture that is missing, and the
 * cases that matter are the ones that must NOT fire: work that has landed
 * properly, and two containers of one application talking to each other.
 */
describe('an interface the container lines imply', () => {
  const component = (id: string, parentId: string) => element(id, { kind: 'component', parentId })
  const held = [
    element('wms'), element('billing'), element('orders'),
    component('wms-api', 'wms'), component('wms-events', 'wms'), component('billing-ledger', 'billing'),
  ]

  it('says how many lines run between which two applications, once for the pair', () => {
    const list = check(held, [
      connection('x1', 'billing-ledger', 'wms-api'),
      connection('x2', 'billing', 'wms-events'),
    ]).filter((one) => one.kind === 'impliedInterface')
    expect(list).toEqual([{
      kind: 'impliedInterface', subject: 'relation', relationType: 'flow',
      id: 'x1', name: 'billing', detail: 'wms', count: 2,
    }])
  })

  it('says nothing about lines that have landed, or about two containers of one application', () => {
    const list = check(held, [
      connection('c16', 'orders', 'wms'),
      connection('r1', 'orders', 'wms-api', { refines: 'c16' }),
      connection('r2', 'wms-api', 'wms-events'),
    ])
    expect(kinds(list)).not.toContain('impliedInterface')
  })

  it('says nothing about a pair that already has an application interface, either way round', () => {
    const list = check(held, [
      connection('i1', 'wms', 'billing'),
      connection('x1', 'billing-ledger', 'wms-api'),
    ])
    expect(kinds(list)).not.toContain('impliedInterface')
    // One that is over by today answers for nothing.
    const over = check(held, [
      connection('i1', 'wms', 'billing', { validUntil: '2026-01-01' }),
      connection('x1', 'billing-ledger', 'wms-api'),
    ])
    expect(kinds(over)).toContain('impliedInterface')
  })

  it('says nothing about container lines that are over by today', () => {
    const list = check(held, [
      connection('x1', 'billing-ledger', 'wms-api', { validUntil: '2026-09-07' }),
    ])
    expect(kinds(list)).not.toContain('impliedInterface')
    const gone = check(
      [...held, element('old', { lifecycleDates: { retired: '2026-01-01' } }), component('old-api', 'old')],
      [connection('x1', 'old-api', 'wms-api')],
    )
    expect(kinds(gone)).not.toContain('impliedInterface')
    // Still there today, it still counts.
    const open = check(held, [connection('x1', 'billing-ledger', 'wms-api', { validUntil: '2026-09-08' })])
    expect(kinds(open)).toContain('impliedInterface')
  })

  it('comes last: nothing is broken, a line is missing', () => {
    const list = check(
      [...held, element('gone', { lifecycleDates: { retired: '2026-10-01' } })],
      [connection('d1', 'gone', 'wms'), connection('x1', 'billing-ledger', 'wms-api')],
    )
    expect(kinds(list).indexOf('impliedInterface')).toBe(kinds(list).length - 1)
  })
})
