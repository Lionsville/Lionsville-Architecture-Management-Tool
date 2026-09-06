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
