import { describe, expect, it } from 'vitest'
import { SIZES, syntheticModel } from './synthetic'
import type { SyntheticSpec } from './synthetic'
import { fromArrays, toArrays } from '../normalised'
import { KEY_RE } from '../keys'

/**
 * The fixture is a measuring instrument, so what is tested here is that it says
 * the same thing twice and that what it says is a landscape rather than a pile
 * of rows. A budget quoted against a model that drifted between runs would be a
 * number about the generator.
 */

const tiny: SyntheticSpec = {
  elements: 120, connections: 200, diagrams: 4, descriptionBytes: 300, decisions: 6, seed: 42,
}

describe('the synthetic landscape', () => {
  it('gives the same landscape for the same spec', () => {
    const once = syntheticModel({ ...tiny })
    const again = syntheticModel({ ...tiny, seed: tiny.seed })
    expect(JSON.stringify(once)).toBe(JSON.stringify(again))
  })

  it('gives a different one for a different seed', () => {
    const other = syntheticModel({ ...tiny, seed: tiny.seed + 1 })
    expect(JSON.stringify(other)).not.toBe(JSON.stringify(syntheticModel({ ...tiny })))
  })

  it('builds the sizes it advertises', () => {
    const model = syntheticModel({ ...tiny })
    expect(model.elements).toHaveLength(tiny.elements)
    expect(model.connections).toHaveLength(tiny.connections)
    expect(model.diagrams).toHaveLength(tiny.diagrams)
    expect(model.decisions).toHaveLength(tiny.decisions)
  })

  it('has one landscape and the rest container views, each about an application', () => {
    const model = syntheticModel({ ...tiny })
    const [landscape, ...containers] = model.diagrams
    expect(landscape.kind).toBe('layer7')
    const byId = new Map(model.elements.map((e) => [e.id, e]))
    for (const diagram of containers) {
      expect(diagram.kind).toBe('container')
      expect(byId.get(diagram.applicationElementId ?? '')?.kind).toBe('application')
    }
  })

  it('places every landscape element on the landscape, and no component', () => {
    const model = syntheticModel({ ...tiny })
    const placed = new Set(model.diagrams[0].placements.map((p) => p.elementId))
    const byId = new Map(model.elements.map((e) => [e.id, e]))
    for (const element of model.elements) {
      expect(placed.has(element.id)).toBe(element.kind !== 'component')
    }
    for (const id of placed) expect(byId.get(id)?.kind).not.toBe('component')
  })

  it('gives every component a parent that has a view of its own', () => {
    const model = syntheticModel({ ...tiny })
    const hosts = new Set(model.diagrams.map((d) => d.applicationElementId))
    for (const element of model.elements) {
      if (element.kind !== 'component') continue
      expect(hosts.has(element.parentApplicationId)).toBe(true)
    }
  })

  it('wires a long tail and a few hubs rather than a uniform degree', () => {
    const model = syntheticModel('small')
    const degree = new Map<string, number>()
    for (const c of model.connections) {
      degree.set(c.sourceId, (degree.get(c.sourceId) ?? 0) + 1)
      degree.set(c.targetId, (degree.get(c.targetId) ?? 0) + 1)
    }
    const degrees = [...degree.values()].sort((a, b) => b - a)
    const mean = degrees.reduce((a, b) => a + b, 0) / degrees.length
    // Preferential attachment, not a shuffle: the busiest element carries many
    // times the average. A uniform draw would put this at barely above 1.
    expect(degrees[0]).toBeGreaterThan(mean * 4)
  })

  it('never connects an element to itself, and never twice the same way', () => {
    const model = syntheticModel({ ...tiny })
    const seen = new Set<string>()
    for (const c of model.connections) {
      expect(c.sourceId).not.toBe(c.targetId)
      const key = `${c.sourceId} ${c.targetId}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('gives every element an id a folder can file its page under', () => {
    const model = syntheticModel({ ...tiny })
    for (const element of model.elements) expect(element.id).toMatch(KEY_RE)
  })

  it('writes a page on every element, about the size asked for', () => {
    const model = syntheticModel({ ...tiny })
    for (const element of model.elements) {
      expect(element.description?.length).toBeGreaterThanOrEqual(tiny.descriptionBytes)
      expect(element.description?.length).toBeLessThan(tiny.descriptionBytes * 3)
    }
  })

  it('numbers decisions from one within each list', () => {
    const model = syntheticModel({ ...tiny })
    const perList = new Map<string, number[]>()
    for (const adr of model.decisions ?? []) {
      const list = adr.applicationId ?? 'landscape'
      perList.set(list, [...(perList.get(list) ?? []), adr.number])
    }
    for (const numbers of perList.values()) {
      expect(numbers).toEqual(numbers.map((_, n) => n + 1))
    }
  })

  it('survives the trip through the indexed model unchanged', () => {
    const model = syntheticModel({ ...tiny })
    expect(toArrays(fromArrays(model))).toEqual(model)
  })

  it('quotes the three sizes the budgets are written against', () => {
    expect(SIZES.small.elements).toBe(200)
    expect(SIZES.large.elements).toBe(2_000)
    expect(SIZES.xl.elements).toBe(5_000)
  })
})
