// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The rules of what is there on a day, and the promise that comes with saying
 * them once: the readers that ask cannot disagree.
 *
 * The first half pins each rule by example. The second generates landscapes —
 * applications, containers, interfaces, landings and dates, from a seeded
 * generator so a failure names a seed that fails again — and holds the checks
 * to the rules over every one of them.
 */
import { describe, expect, it } from 'vitest'
import { findings } from './checks'
import { livenessOf } from './liveness'
import { addDays } from './transition'
import type { DesignElement, ElementId, Relation } from './types'

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over }
}

function flow(id: string, sourceId: string, targetId: string, over: Partial<Relation> = {}): Relation {
  return { id, type: 'flow', sourceId, targetId, ...over }
}

describe('the rules', () => {
  it('gives a landing with no window its interface\'s, and keeps a landing\'s own', () => {
    const iface = flow('i1', 'orders', 'wms', { validFrom: '2027-01-01', validUntil: '2027-12-31' })
    const landing = flow('r1', 'orders', 'wms-api', { refines: 'i1' })
    const own = flow('r2', 'orders', 'wms-api', { refines: 'i1', validUntil: '2027-06-30' })
    const live = livenessOf({ elements: [], relations: [iface, landing, own] })
    expect(live.windowOf(landing)).toBe(iface)
    expect(live.windowOf(own)).toBe(own)
    expect(live.windowHolds(landing, '2028-01-01')).toBe(false)
    expect(live.windowHolds(landing, '2027-12-31')).toBe(true)
  })

  it('takes a container with its application, on the first day the application is gone', () => {
    const live = livenessOf({
      elements: [
        element('wms', { lifecycleDates: { retired: '2028-01-31' } }),
        element('wms-api', { kind: 'component', parentId: 'wms', lifecycleDates: { retired: '2029-01-01' } }),
      ],
      relations: [],
    })
    expect(live.goneOn('wms-api', '2028-01-30')).toBe(false)
    expect(live.goneOn('wms-api', '2028-01-31')).toBe(true)
    expect(live.goneFrom('wms-api')).toBe('2028-01-31')
  })

  it('dates a stand-in by the scope that defines it, and never by what it carries', () => {
    const elements = [
      element('erp', { ref: 'finance', lifecycleDates: { retired: '2027-01-01' } }),
      element('crm', { ref: 'sales' }),
    ]
    const bare = livenessOf({ elements, relations: [] })
    expect(bare.goneOn('erp', '2030-01-01')).toBe(false)
    const told = livenessOf({ elements, relations: [] }, { retiredOf: (id) => (id === 'crm' ? '2028-01-31' : undefined) })
    expect(told.goneOn('crm', '2028-01-31')).toBe(true)
    expect(told.goneFrom('crm')).toBe('2028-01-31')
    expect(told.goneOn('erp', '2030-01-01')).toBe(false)
  })

  it('holds an id nobody here holds, and nobody dates, to be there', () => {
    const live = livenessOf({ elements: [element('orders')], relations: [] })
    const row = flow('c1', 'orders', 'elsewhere')
    expect(live.goneOn('elsewhere', '2099-01-01')).toBe(false)
    expect(live.thereOn(row, '2099-01-01')).toBe(true)
  })

  it('says a line valid until the day an end retires outlives that end', () => {
    const elements = [element('wms', { lifecycleDates: { retired: '2028-01-31' } }), element('orders')]
    const on = livenessOf({ elements, relations: [] })
    expect(on.outlivedEnd(flow('c1', 'orders', 'wms', { validUntil: '2028-01-31' }))).toBe('wms')
    expect(on.outlivedEnd(flow('c2', 'orders', 'wms', { validUntil: '2028-01-30' }))).toBeUndefined()
    // No end of its own: it follows its ends, and cannot outlive them.
    expect(on.outlivedEnd(flow('c3', 'orders', 'wms'))).toBeUndefined()
    // Starting after the end is gone is outliving it too.
    expect(on.outlivedEnd(flow('c4', 'orders', 'wms', { validFrom: '2028-03-01', validUntil: '2028-06-30' }))).toBe('wms')
  })
})

// --- generated landscapes ----------------------------------------------------

/** A small seeded generator (mulberry32): the same seed, the same landscape. */
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = '2028-01-01'
const DAYS = Array.from({ length: 12 }, (_, at) => addDays(FIRST, at))

type Landscape = { elements: DesignElement[]; relations: Relation[] }

/**
 * Four applications with a container or two each, a platform, and lines among
 * them: application interfaces, landings on some of them, unrefined container
 * lines, and a few rows onto the platform — each dated or not, at random,
 * within a dozen days so the dates collide often.
 */
function landscape(seed: number): Landscape {
  const next = random(seed)
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(next() * list.length)]
  const maybeDay = (chance: number) => (next() < chance ? pick(DAYS) : undefined)
  const dated = (chance: number) => {
    const retired = maybeDay(chance)
    return retired ? { lifecycleDates: { retired } } : {}
  }
  const elements: DesignElement[] = []
  const containers = new Map<ElementId, ElementId[]>()
  for (const app of ['wms', 'billing', 'orders', 'ledger']) {
    elements.push(element(app, dated(0.5)))
    const mine = Array.from({ length: 1 + Math.floor(next() * 2) }, (_, at) => `${app}-c${at}`)
    for (const id of mine) elements.push(element(id, { kind: 'component', parentId: app, ...dated(0.2) }))
    containers.set(app, mine)
  }
  elements.push(element('cluster', { kind: 'platform', ...dated(0.5) }))
  const window = (): Partial<Relation> => {
    const from = maybeDay(0.3)
    const until = maybeDay(0.6)
    return { ...(from ? { validFrom: from } : {}), ...(until ? { validUntil: until } : {}) }
  }
  const apps = [...containers.keys()]
  const relations: Relation[] = []
  let n = 0
  for (let at = 0; at < 6; at += 1) {
    const source = pick(apps)
    const target = pick(apps.filter((app) => app !== source))
    const iface = flow(`i${n++}`, source, target, window())
    relations.push(iface)
    // Landings: container to container under the interface's two ends,
    // most of them with no window of their own.
    for (let landing = 0; landing < Math.floor(next() * 3); landing += 1) {
      relations.push(flow(`r${n++}`, pick(containers.get(source)!), pick(containers.get(target)!), {
        refines: iface.id, ...(next() < 0.3 ? window() : {}),
      }))
    }
  }
  for (let at = 0; at < 4; at += 1) {
    const source = pick(apps)
    const target = pick(apps.filter((app) => app !== source))
    relations.push(flow(`x${n++}`, pick(containers.get(source)!), pick([target, ...containers.get(target)!]), window()))
  }
  for (let at = 0; at < 3; at += 1) {
    relations.push({ id: `h${n++}`, type: 'hostedOn', sourceId: pick(containers.get(pick(apps))!), targetId: 'cluster', ...window() })
  }
  return { elements, relations }
}

const SEEDS = Array.from({ length: 300 }, (_, at) => at + 1)

/** The application or platform, and its containers: what retires with it. */
function partsOf(model: Landscape, id: ElementId): Set<ElementId> {
  return new Set([id, ...model.elements.filter((one) => one.parentId === id).map((one) => one.id)])
}

describe('the checks, over generated landscapes', () => {
  it('clear a retirement once every line touching it closes the day before it goes', () => {
    // How many were reported before the lines closed: a property that holds
    // because nothing was ever reported would hold of anything.
    let before = 0
    for (const seed of SEEDS) {
      const model = landscape(seed)
      const open = findings({ model, today: FIRST })
      for (const retiring of model.elements.filter((one) => one.kind !== 'component' && one.lifecycleDates?.retired)) {
        const gone = retiring.lifecycleDates!.retired!
        if (open.some((one) => one.kind === 'retiresWithDependants' && one.id === retiring.id)) before += 1
        const parts = partsOf(model, retiring.id)
        const closed = model.relations.map((row) => (parts.has(row.sourceId) || parts.has(row.targetId)
          ? { ...row, validUntil: addDays(gone, -1) }
          : row))
        const list = findings({ model: { elements: model.elements, relations: closed }, today: FIRST })
        expect(
          list.find((one) => one.kind === 'retiresWithDependants' && one.id === retiring.id),
          `seed ${seed}, ${retiring.id}`,
        ).toBeUndefined()
      }
    }
    expect(before).toBeGreaterThan(SEEDS.length / 2)
  })

  it('report a line as outliving an end exactly when the rules put it on a day that end is gone', () => {
    const around = [addDays(FIRST, -1), ...DAYS, addDays(DAYS[DAYS.length - 1], 1)]
    for (const seed of SEEDS) {
      const model = landscape(seed)
      const live = livenessOf(model)
      const reported = new Set(findings({ model, today: FIRST })
        .filter((one) => one.kind === 'lineOutlivesEnd').map((one) => one.id))
      for (const row of model.relations) {
        const endless = live.windowOf(row).validUntil === undefined
        const onAGoneDay = around.some((day) => (
          live.windowHolds(row, day) && (live.goneOn(row.sourceId, day) || live.goneOn(row.targetId, day))
        ))
        expect(live.outlivedEnd(row) !== undefined, `seed ${seed}, ${row.id}`).toBe(!endless && onAGoneDay)
        // Reported itself, or — a landing that borrowed its interface's
        // window — by way of the interface it follows.
        const said = reported.has(row.id) || (live.windowOf(row) !== row && reported.has(row.refines!))
        expect(said, `seed ${seed}, ${row.id}`).toBe(live.outlivedEnd(row) !== undefined)
      }
    }
  })

  it('never count a row as still there on the day something goes that the line check calls over', () => {
    for (const seed of SEEDS) {
      const model = landscape(seed)
      const live = livenessOf(model)
      for (const retiring of model.elements.filter((one) => one.kind !== 'component' && one.lifecycleDates?.retired)) {
        const gone = retiring.lifecycleDates!.retired!
        const parts = partsOf(model, retiring.id)
        for (const row of model.relations) {
          const near = parts.has(row.sourceId) ? row.sourceId : parts.has(row.targetId) ? row.targetId : undefined
          if (near === undefined || (parts.has(row.sourceId) && parts.has(row.targetId))) continue
          const far = near === row.sourceId ? row.targetId : row.sourceId
          const stillThere = live.windowHolds(row, gone) && !live.goneOn(far, gone)
          if (stillThere && live.windowOf(row).validUntil !== undefined) {
            expect(live.outlivedEnd(row), `seed ${seed}, ${row.id}`).toBeDefined()
          }
        }
      }
    }
  })
})
