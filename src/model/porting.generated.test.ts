// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Porting never proposes what the writer refuses (ADR-0010, ADR-0013).
 *
 * A port is offered as a button and as an agent tool, and a *port all* is one
 * transaction: one command the reducer refuses takes every other down with
 * it, and the person is told only that something could not be done. So the
 * promise is held over generated landscapes rather than examples — interfaces
 * with and without landings, landings on either side and on both, two-way
 * interfaces drawn either way round, twins already drawn with landings of
 * their own, lines already closed by hand — from a seeded generator, so a
 * failure names a seed that fails again. Every write porting proposes is
 * applied whole and must land, must leave every landing sitting under its
 * interface, and must take the plan's gate where the plan says it should.
 */
import { describe, expect, it } from 'vitest'
import { applyAll } from './reducer'
import { fromArrays, toArrays } from './normalised'
import type { Model } from './normalised'
import { portCommands, portsOf, unplannedPorts, unportCommands } from './porting'
import type { Port } from './porting'
import { refinementRefusal } from './refines'
import { addDays } from './transition'
import type { Transition } from './transition'
import type { DesignElement, DesignModel, ElementId, Relation } from './types'

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
const PROTOCOLS = [undefined, 'REST', 'AMQP'] as const

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over }
}

type Case = { model: DesignModel; plan: Transition; targets: ElementId[] }

/**
 * The old application, one or two new ones, and two that stay, each with
 * containers; interfaces between the old one and those that stay, each
 * landed zero to three times on either side or both, some two-way and drawn
 * either way round; some already twinned on a new one, the twin dated or not
 * and landed or not; some closed by hand; a container line that is an
 * interface of its own; and the shadow run's tap, which porting leaves alone.
 */
function generated(seed: number): Case {
  const next = random(seed)
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(next() * list.length)]
  const maybe = (chance: number) => next() < chance
  const targets = maybe(0.5) ? ['wms2'] : ['wms2', 'wms3']
  const containers = new Map<ElementId, ElementId[]>()
  const elements: DesignElement[] = []
  for (const app of ['wms', ...targets, 'billing', 'orders']) {
    elements.push(element(app))
    const mine = Array.from({ length: Math.floor(next() * 3) }, (_, at) => `${app}-c${at}`)
    for (const id of mine) elements.push(element(id, { kind: 'component', parentId: app }))
    containers.set(app, mine)
  }
  const sideOf = (app: ElementId) => [app, ...containers.get(app)!]
  const relations: Relation[] = []
  let n = 0
  const flow = (sourceId: ElementId, targetId: ElementId, over: Partial<Relation> = {}): Relation => {
    const row: Relation = { id: `l${n++}`, type: 'flow', sourceId, targetId, isBidirectional: false, ...over }
    relations.push(row)
    return row
  }
  // Landings under an interface: a container on at least one side, the
  // direction the interface's or — two-way — either.
  const land = (iface: Relation, count: number) => {
    for (let at = 0; at < count; at += 1) {
      const source = pick(sideOf(iface.sourceId))
      const target = pick(sideOf(iface.targetId))
      if (source === iface.sourceId && target === iface.targetId) continue
      const reversed = iface.isBidirectional && maybe(0.5)
      flow(reversed ? target : source, reversed ? source : target, {
        refines: iface.id,
        isBidirectional: iface.isBidirectional,
        ...(maybe(0.7) ? { protocol: pick(PROTOCOLS.filter(Boolean)) } : {}),
        ...(maybe(0.2) ? { validFrom: pick(DAYS) } : {}),
      })
    }
  }

  for (let at = 0; at < 5; at += 1) {
    const counterpart = pick(['billing', 'orders'])
    const outward = maybe(0.5)
    const shape = {
      isBidirectional: maybe(0.3),
      ...(maybe(0.5) ? { protocol: pick(PROTOCOLS) } : {}),
    }
    const closedByHand = maybe(0.2) ? { validUntil: pick(DAYS) } : {}
    const iface = flow(outward ? 'wms' : counterpart, outward ? counterpart : 'wms', { ...shape, ...closedByHand })
    land(iface, Math.floor(next() * 4))
    if (maybe(0.3)) {
      const to = pick(targets)
      const twin = flow(outward ? to : counterpart, outward ? counterpart : to, {
        ...shape, ...(maybe(0.6) ? { validFrom: pick(DAYS) } : {}),
      })
      land(twin, Math.floor(next() * 3))
    }
  }
  // A container line that is an interface of its own, off the old one.
  const counterpart = pick(['billing', 'orders'])
  flow('wms', pick(sideOf(counterpart)))
  // The tap, and a line that has nothing to do with the plan.
  flow('wms', targets[0], { validFrom: DAYS[0], validUntil: DAYS[10] })
  flow('billing', 'orders')

  const plan: Transition = {
    id: 'tr', number: 1, title: 'Replace', status: 'running', decisions: [], milestones: [], body: '',
    elements: [
      { elementId: 'wms', role: maybe(0.8) ? 'retires' : 'changes' },
      ...targets.map((elementId) => ({ elementId, role: 'introduces' as const })),
    ],
  }
  return { model: { name: 'generated', elements, relations, diagrams: [] }, plan, targets }
}

const SEEDS = Array.from({ length: 300 }, (_, at) => at + 1)

/** Every landing sits under the interface it names, and names one that is there. */
function landingsHold(model: Model): string[] {
  const held = (id: ElementId) => model.elements[id]
  return Object.values(model.relations)
    .filter((row) => row.refines !== undefined)
    .filter((row) => {
      const refined = model.relations[row.refines!]
      return !refined || refinementRefusal(row, refined, held) !== undefined
    })
    .map((row) => row.id)
}

function minter(): () => string {
  let n = 0
  return () => `new-${++n}`
}

function landed(model: Model, commands: Parameters<typeof applyAll>[1], label: string): Model {
  const result = applyAll(model, commands)
  expect(result.ok ? 'ok' : result.reason, label).toBe('ok')
  if (!result.ok) throw new Error(label)
  expect(landingsHold(result.model), label).toEqual([])
  return result.model
}

const portsIn = (model: Model, plan: Transition): Port[] => {
  const arrays = toArrays(model)
  return portsOf({ elements: arrays.elements, relations: arrays.relations }, plan)
}

describe('porting, over generated landscapes', () => {
  it('generates landscapes the writer itself would hold', () => {
    for (const seed of SEEDS) expect(landingsHold(fromArrays(generated(seed).model)), `seed ${seed}`).toEqual([])
  })

  it('ports all that is left in one step the writer accepts, and the gate then has nothing left', () => {
    for (const seed of SEEDS) {
      const { model, plan, targets } = generated(seed)
      for (const toId of targets) {
        const label = `seed ${seed}, to ${toId}`
        const before = fromArrays(model)
        const remaining = unplannedPorts(portsIn(before, plan))
        const mint = minter()
        const after = landed(before, remaining.flatMap((port) => portCommands(port, toId, '2028-06-01', mint)), label)
        expect(unplannedPorts(portsIn(after, plan)).map((port) => port.from.id), label).toEqual([])
      }
    }
  })

  it('writes each port on its own, to each new application, and the writer accepts it', () => {
    for (const seed of SEEDS) {
      const { model, plan, targets } = generated(seed)
      const before = fromArrays(model)
      for (const port of portsIn(before, plan)) {
        for (const toId of targets) {
          landed(before, portCommands(port, toId, '2028-06-01', minter()), `seed ${seed}, ${port.from.id} to ${toId}`)
        }
      }
    }
  })

  it('takes back each port it wrote, and a fresh one exactly', () => {
    for (const seed of SEEDS) {
      const { model, plan, targets } = generated(seed)
      const before = fromArrays(model)
      for (const port of portsIn(before, plan)) {
        const label = `seed ${seed}, ${port.from.id}`
        const ported = landed(before, portCommands(port, targets[0], '2028-06-01', minter()), label)
        const again = portsIn(ported, plan).find((one) => one.from.id === port.from.id)!
        const back = landed(ported, unportCommands(again), label)
        // A twin porting drew goes with everything it drew on it, and an
        // original nobody had closed is open again: the landscape as it was.
        if (!port.to && port.from.validUntil === undefined) {
          expect(toArrays(back).relations, label).toEqual(model.relations)
        }
      }
    }
  })

  it('takes back a twin somebody drew, with what landed on it, and the writer accepts it', () => {
    for (const seed of SEEDS) {
      const { model, plan } = generated(seed)
      const before = fromArrays(model)
      for (const port of portsIn(before, plan).filter((one) => one.to !== undefined)) {
        landed(before, unportCommands(port), `seed ${seed}, ${port.from.id}`)
      }
    }
  })
})
