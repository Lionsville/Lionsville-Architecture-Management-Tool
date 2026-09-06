import { describe, expect, it } from 'vitest'
import { routeWithLibavoidInProcess } from './libavoidRouter'
import type { RouterConnection, RouterInput, RouterNode } from './libavoidRouter'
import { placementSize } from '../model/placement'
import { measureAsync } from '../model/testing/measure'
import { syntheticModel } from '../model/testing/synthetic'
import type { DesignElement, DomainGroupRect } from '../model/types'

/**
 * What routing a real landscape costs, and what it declines to attempt.
 *
 * There is no budget here, and that is the finding rather than an omission. The
 * router's cost is driven by channel competition rather than by the size of the
 * board — `MAX_CONNECTORS_PER_TIER` carries the measurements — so a number for
 * "the large fixture" is a number about this fixture's group structure and not
 * a threshold anything should be held to. What is worth having in the report is
 * the shape of the answer: how the board divides into tiers, how much of it the
 * cap refuses, and what the part it accepts costs.
 *
 * The two together are the input to ADR-0004's routing section.
 */

function inputFor(size: 'small' | 'large'): RouterInput {
  const model = syntheticModel(size)
  const landscape = model.diagrams[0]
  const byId = new Map(model.elements.map((e) => [e.id, e] as const))
  const nodes: RouterNode[] = []
  const groupOf = new Map<string, string>()
  for (const placement of landscape.placements) {
    const element = byId.get(placement.elementId) as DesignElement | undefined
    if (!element) continue
    const size = placementSize(element.kind, placement)
    nodes.push({
      id: placement.elementId,
      rect: { x: placement.x, y: placement.y, width: size.width, height: size.height },
      domainGroup: placement.domainGroup,
    })
    if (placement.domainGroup) groupOf.set(placement.elementId, placement.domainGroup)
  }
  const groups: DomainGroupRect[] = landscape.layoutConfig?.domainGroups ?? []
  const placed = new Set(nodes.map((n) => n.id))
  const connections: RouterConnection[] = model.connections
    .filter((c) => placed.has(c.sourceId) && placed.has(c.targetId))
    .map((c) => ({ id: c.id, sourceId: c.sourceId, targetId: c.targetId }))
  return { nodes, groups, connections }
}

describe('routing a landscape', () => {
  for (const size of ['small', 'large'] as const) {
    it(`routes what it can of the ${size} board and declines the rest`, async () => {
      const input = inputFor(size)
      const first = await routeWithLibavoidInProcess(input)

      const declined = first.skipped.reduce((sum, tier) => sum + tier.connectorCount, 0)
      process.stdout.write(
        `  routing: ${size} — ${input.nodes.length} nodes, ${input.connections.length} lines, `
        + `${input.groups.length} groups -> ${first.routes.size} routed, `
        + `${declined} declined in ${first.skipped.length} tier(s)\n`,
      )

      // Both boards route something, and both meet the cap: a generated landscape
      // has far more inter-group lines than one pass will take, and those come
      // back declined rather than silently absent — which is the distinction
      // `SkippedTier` exists to make.
      expect(first.routes.size).toBeGreaterThan(0)
      expect(declined).toBeGreaterThan(0)

      await measureAsync(`routing: one whole-board pass (${size})`, async () => {
        await routeWithLibavoidInProcess(input)
      }, { runs: 3, warmup: 0 })
    }, 300_000)
  }
})
