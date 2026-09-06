/**
 * The shipped examples, checked as data.
 *
 * A container diagram nests its components inside the application boundary, and
 * the one thing that makes that happen is `parentApplicationId` — Tidy builds the
 * boundary as a compound node whose children are exactly the components parented
 * to it (`tidyContainer`), and everything else on the diagram is context placed
 * around it. A component that names no parent is therefore not "missing a
 * field": it is laid out beside the box it belongs in, and the example that is
 * meant to show what a container view looks like shows the opposite.
 *
 * Nothing but a reader's eye was checking that, and an example is the first
 * thing anyone opens.
 */
import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '.'
import { fromInterchange } from '../../model/fromInterchange'
import { fromArrays, toArrays } from '../../model/normalised'
import { projectFromDocument, toWorkingFile } from '../../projects/project'
import { syntheticModel } from '../../model/testing/synthetic'

describe.each(EXAMPLES.map((e) => [e.key, e] as const))('example %s', (_key, example) => {
  const model = fromInterchange(example.document, example.groupName)
  const byId = new Map(model.elements.map((e) => [e.id, e]))

  it('parents every component to an application that exists', () => {
    const components = model.elements.filter((e) => e.kind === 'component')
    expect(components.length).toBeGreaterThan(0)
    for (const component of components) {
      expect(
        byId.get(component.parentApplicationId ?? '')?.kind,
        `${component.id} has no parent application`,
      ).toBe('application')
    }
  })

  it.each(
    // Empty for an example without one; `describe.each` over EXAMPLES keeps the
    // suite honest when a second example arrives with no container view at all.
    model.diagrams
      .filter((d) => d.kind === 'container')
      .map((d) => [d.name, d] as const),
  )('nests the components of container diagram %s inside its boundary', (_name, diagram) => {
    const placed = diagram.placements
      .map((p) => byId.get(p.elementId))
      .filter((e) => e?.kind === 'component')

    expect(placed.length).toBeGreaterThan(0)
    for (const component of placed) {
      expect(
        component!.parentApplicationId,
        `${component!.id} would be laid out beside the boundary, not in it`,
      ).toBe(diagram.applicationElementId)
    }
  })
})

/**
 * The indexed model is an in-memory shape, not a format (ADR-0002). Opening the
 * biggest thing this repository ships, indexing it and writing it back out has
 * to produce the same file down to the byte — key order included — or the first
 * save after the reducer lands is a diff nobody asked for.
 */
describe.each(EXAMPLES.map((e) => [e.key, e] as const))('example %s as a working file', (_key, example) => {
  it('survives the indexed model byte for byte', () => {
    const project = projectFromDocument(example.document, example.ref, example.groupName)
    const indexed = { ...project, model: toArrays(fromArrays(project.model)) }

    expect(JSON.stringify(toWorkingFile(indexed))).toBe(JSON.stringify(toWorkingFile(project)))
  })
})

/**
 * The generated landscape, held against the hand-written one.
 *
 * Every perf budget in the repository is quoted against `model/testing/synthetic`,
 * so a fixture that is shaped wrong makes every one of them a statement about the
 * generator. Size it cannot be checked against — the example is thirty-three
 * elements and the point of the fixture is thousands — but the SHAPE can be, and
 * the shape is what the router's and the derive's cost depend on: a long tail of
 * two- and three-link elements with a handful of hubs.
 *
 * This lives here, in `app/`, because it is the one module allowed to read both
 * the example and the model's own test fixtures.
 */
describe('the generated landscape against the shipped one', () => {
  const degrees = (links: readonly { from: string; to: string }[]) => {
    const count = new Map<string, number>()
    for (const link of links) {
      count.set(link.from, (count.get(link.from) ?? 0) + 1)
      count.set(link.to, (count.get(link.to) ?? 0) + 1)
    }
    const all = [...count.values()].sort((a, b) => b - a)
    const mean = all.reduce((sum, n) => sum + n, 0) / all.length
    return { mean, busiest: all[0], hubRatio: all[0] / mean }
  }

  const example = EXAMPLES[0]
  const shipped = degrees((example.document.connections ?? []).map((c) => ({
    from: String(c.sourceKey), to: String(c.targetKey),
  })))
  const generated = degrees(syntheticModel('small').connections.map((c) => ({
    from: c.sourceId, to: c.targetId,
  })))

  it('links its elements about as densely', () => {
    // Within a factor of two of the example's 2.9 links per element. A landscape
    // is neither a tree nor a mesh, and a fixture that drifted to either would
    // make the router's numbers meaningless in opposite directions.
    expect(generated.mean).toBeGreaterThan(shipped.mean / 2)
    expect(generated.mean).toBeLessThan(shipped.mean * 2)
  })

  it('has hubs, in the same proportion', () => {
    // The example's busiest element carries about four times the average. The
    // generator draws by preferential attachment and lands in the same place —
    // higher, because a bigger landscape has room for a bigger bus.
    expect(shipped.hubRatio).toBeGreaterThan(3)
    expect(generated.hubRatio).toBeGreaterThan(shipped.hubRatio)
    expect(generated.hubRatio).toBeLessThan(shipped.hubRatio * 4)
  })
})
