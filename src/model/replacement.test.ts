/**
 * A replacement as one gesture (ADR-0010).
 *
 * What is pinned: everything the gesture writes and the order it writes it
 * in — because a transaction is applied in order and a placement needs its
 * element first — and that it applies cleanly through the reducer and undoes
 * as one step.
 */
import { describe, expect, it } from 'vitest'
import { replacementCommands } from './replacement'
import type { ReplacementRequest } from './replacement'
import { apply } from './reducer'
import { fromArrays, toArrays, transitionList } from './normalised'
import { transaction } from './commands'
import type { DesignDiagram, DesignElement, DesignModel, Relation } from './types'

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {},
    category: 'Logistics', ...over,
  }
}
function line(id: string, sourceId: string, targetId: string, over: Partial<Relation> = {}): Relation {
  return { id, type: 'flow', sourceId, targetId, isBidirectional: false, ...over }
}
function diagram(id: string, placed: string[]): DesignDiagram {
  return {
    id, kind: 'layer7', name: id,
    placements: placed.map((elementId, at) => ({ elementId, x: 100 + at * 300, y: 200, zone: 'landscape' as const, domainGroup: 'Warehouse' })),
  } as DesignDiagram
}

const MODEL: DesignModel = {
  name: 'Acme', customerName: 'Acme',
  elements: [element('wms'), element('billing'), element('erp')],
  relations: [line('a', 'wms', 'billing', { protocol: 'REST' }), line('b', 'erp', 'wms')],
  diagrams: [diagram('landscape', ['wms', 'billing']), diagram('other', ['billing'])],
}

const WORDS = {
  planTitle: 'Replace wms', tapLabel: 'shadow tap', shadowMilestone: 'Shadow run starts',
  cutoverMilestone: 'Cutover', body: '## Goal\n', owner: 'Logistics IT',
}

const IDS = { element: (name: string) => name.toLowerCase().replace(/\s+/g, '-'), connection: () => 'c-tap', transition: 'tr-1' }

const ONE_FOR_ONE: ReplacementRequest = {
  from: [{ elementId: 'wms', role: 'retires' }],
  to: { name: 'WMS next' },
  shadowFrom: '2027-03-01',
  cutover: '2027-09-01',
  words: WORDS,
}

describe('one for one, with a new application', () => {
  const { commands, planId, toId } = replacementCommands(MODEL, ONE_FOR_ONE, IDS, 1)

  it('makes the new one in the image of the old, planned and dated', () => {
    expect(toId).toBe('wms-next')
    expect(commands[0]).toMatchObject({
      type: 'element.create',
      element: {
        id: 'wms-next', name: 'WMS next', kind: 'application', category: 'Logistics',
        lifecycle: 'planned', lifecycleDates: { live: '2027-03-01' },
      },
    })
  })

  it('draws it beside the old on every board the old is on, and nowhere else', () => {
    const placements = commands.filter((c) => c.type === 'placement.set')
    expect(placements).toHaveLength(1)
    expect(placements[0]).toMatchObject({
      diagramId: 'landscape',
      placements: [{ elementId: 'wms-next', x: expect.any(Number), y: 200, zone: 'landscape', domainGroup: 'Warehouse' }],
    })
    // To the right of the original: past its width and the gap.
    expect((placements[0] as { placements: { x: number }[] }).placements[0].x).toBeGreaterThan(100)
  })

  it('dates the old one, names its successor, and taps it until the day before it is gone', () => {
    expect(commands).toContainEqual({
      type: 'element.update', id: 'wms',
      patch: { lifecycleDates: { retiring: '2027-03-01', retired: '2027-09-01' }, successorId: 'wms-next' },
    })
    expect(commands).toContainEqual({
      type: 'relation.create',
      relation: {
        id: 'c-tap', type: 'flow',
        sourceId: 'wms', targetId: 'wms-next', label: 'shadow tap', isBidirectional: false,
        lineStyle: 'dashed', validFrom: '2027-03-01', validUntil: '2027-08-31',
      },
    })
  })

  it('writes the plan last, naming both, with its two milestones', () => {
    const last = commands[commands.length - 1]
    expect(planId).toBe('tr-1')
    expect(last).toMatchObject({
      type: 'transition.add',
      transition: {
        id: 'tr-1', number: 1, title: 'Replace wms', status: 'draft', from: '2027-03-01', to: '2027-09-01', owner: 'Logistics IT',
        elements: [{ elementId: 'wms', role: 'retires' }, { elementId: 'wms-next', role: 'introduces' }],
        milestones: [{ date: '2027-03-01', name: 'Shadow run starts' }, { date: '2027-09-01', name: 'Cutover' }],
        body: '## Goal\n',
      },
    })
  })

  it('applies through the reducer as one step, and undoes as one', () => {
    const before = fromArrays(MODEL)
    const result = apply(before, transaction(commands))
    expect('model' in result).toBe(true)
    if (!('model' in result)) return
    const after = toArrays(result.model)
    expect(after.elements.map((e) => e.id)).toContain('wms-next')
    expect(after.relations).toHaveLength(3)
    expect(transitionList(result.model)).toHaveLength(1)
    const back = apply(result.model, result.inverse)
    expect('model' in back && toArrays(back.model)).toEqual(MODEL)
  })
})

describe('the other shapes', () => {
  it('a split leaves the source undated and un-succeeded, but taps it and names it as changed', () => {
    const { commands } = replacementCommands(MODEL, { ...ONE_FOR_ONE, from: [{ elementId: 'wms', role: 'changes' }] }, IDS, 1)
    expect(commands.find((c) => c.type === 'element.update' && c.id === 'wms')).toBeUndefined()
    expect(commands.filter((c) => c.type === 'relation.create')).toHaveLength(1)
    const plan = commands[commands.length - 1]
    expect(plan).toMatchObject({ transition: { elements: [{ elementId: 'wms', role: 'changes' }, { elementId: 'wms-next', role: 'introduces' }] } })
  })

  it('a merge retires each source into the one new thing, with a tap from each', () => {
    let taps = 0
    const ids = { ...IDS, connection: () => `c-tap-${++taps}` }
    const { commands } = replacementCommands(MODEL, {
      ...ONE_FOR_ONE, from: [{ elementId: 'wms', role: 'retires' }, { elementId: 'erp', role: 'retires' }],
    }, ids, 1)
    expect(commands.filter((c) => c.type === 'relation.create').map((c) => (c as { relation: Relation }).relation.sourceId))
      .toEqual(['wms', 'erp'])
    expect(commands.filter((c) => c.type === 'element.update').map((c) => (c as { patch: Partial<DesignElement> }).patch.successorId))
      .toEqual(['wms-next', 'wms-next'])
  })

  it('an existing successor is not made again, and is dated only if nobody dated it', () => {
    const { commands, toId } = replacementCommands(MODEL, { ...ONE_FOR_ONE, to: { elementId: 'billing' } }, IDS, 1)
    expect(toId).toBe('billing')
    expect(commands.find((c) => c.type === 'element.create')).toBeUndefined()
    expect(commands.find((c) => c.type === 'placement.set')).toBeUndefined()
    expect(commands).toContainEqual({ type: 'element.update', id: 'billing', patch: { lifecycleDates: { live: '2027-03-01' } } })

    const dated = { ...MODEL, elements: MODEL.elements.map((e) => (e.id === 'billing' ? { ...e, lifecycleDates: { live: '2026-01-01' } } : e)) }
    const kept = replacementCommands(dated, { ...ONE_FOR_ONE, to: { elementId: 'billing' } }, IDS, 1)
    expect(kept.commands.find((c) => c.type === 'element.update' && c.id === 'billing')).toBeUndefined()
  })

  it('ignores a source that is not in the landscape', () => {
    const { commands } = replacementCommands(MODEL, { ...ONE_FOR_ONE, from: [{ elementId: 'ghost', role: 'retires' }] }, IDS, 1)
    expect(commands.filter((c) => c.type === 'relation.create')).toHaveLength(0)
    expect(commands[commands.length - 1]).toMatchObject({ transition: { elements: [{ elementId: 'wms-next', role: 'introduces' }] } })
  })
})
