import { describe, expect, it } from 'vitest'
import { apply, fromArrays, toArrays } from '../model'
import type { HostModel } from '../model/fromInterchange'
import { BUDGET, measure } from '../model/testing/measure'
import { syntheticModel } from '../model/testing/synthetic'
import type { SyntheticSpec } from '../model/testing/synthetic'
import { buildEdges, buildNodes } from './graph'
import type { FloatingEdgeModel } from './graph'
import type { ElementNode } from './nodes/nodeData'

/**
 * What one move costs the canvas: the nodes and the edges re-derived for a
 * board of six hundred elements.
 *
 * The cold derive is what opening a diagram costs; the warm one is what every
 * commit costs — a drag, a keystroke in an inspector, an undo. They are close,
 * and that is expected: reconciling against the previous list costs about what
 * building it did, so the budget here is a guard against the projection itself
 * growing rather than a claim that reuse made it faster.
 *
 * What the reuse is actually for is downstream, and no timer here can see it:
 * until this phase every commit handed all six hundred boxes a brand-new `data`
 * object saying exactly what the old one said, so `React.memo` on the node
 * components had nothing to compare and the whole board re-rendered.
 * `nodes/nodeRenders.test.tsx` is where that is pinned.
 */

/** Six hundred elements on one landscape, which is the board the budget names. */
const SPEC: SyntheticSpec = {
  elements: 700, connections: 1_600, diagrams: 8, descriptionBytes: 2048, decisions: 12, seed: 5,
}

const base = fromArrays(syntheticModel(SPEC))
const argsOf = (model: HostModel) => ({
  model,
  diagram: model.diagrams[0],
  readOnly: false,
  edgeColor: '#888',
})

/** The model with one card moved — a different one on every run. */
function moved(step: number): HostModel {
  const diagram = base.diagrams.landscape
  const id = diagram.order.placements[step % diagram.order.placements.length]
  const held = diagram.placements[id]
  const result = apply(base, {
    type: 'placement.set',
    diagramId: 'landscape',
    placements: [{ ...held, x: held.x + 40, y: held.y + 40 }],
  })
  if (!result.ok) throw new Error(`the reducer refused: ${result.reason}`)
  return toArrays(result.model)
}

describe('deriving a board', () => {
  it('has the six hundred nodes the budget is written for', () => {
    expect(base.diagrams.landscape.order.placements.length).toBeGreaterThan(550)
    expect(base.diagrams.landscape.order.placements.length).toBeLessThan(650)
  })

  it('derives it cold, for the record', () => {
    const host = toArrays(base)
    measure('derive: a 600-node board, cold', () => {
      buildNodes(argsOf(host))
      buildEdges(argsOf(host))
    })
  })

  it('re-derives it after one element moved', () => {
    let host = toArrays(base)
    let step = 0
    let nodes: ElementNode[] = buildNodes(argsOf(host))
    let edges: FloatingEdgeModel[] = buildEdges(argsOf(host))
    const ms = measure('derive: a 600-node board after one move', () => {
      nodes = buildNodes(argsOf(host), nodes)
      edges = buildEdges(argsOf(host), edges)
    }, { prepare: () => { host = moved(step++) } })
    expect(ms).toBeLessThan(BUDGET.derive)
  })

  it('hands back the same object for every card that did not move', () => {
    // The property the budget above is about. Measured separately from the
    // timing, because a derive that got faster by drawing less would still be
    // green up there.
    const host = toArrays(base)
    const nodes = buildNodes(argsOf(host))
    const after = moved(3)
    const next = buildNodes(argsOf(after), nodes)
    const changed = next.filter((node, n) => node !== nodes[n])
    expect(changed).toHaveLength(1)
  })
})
