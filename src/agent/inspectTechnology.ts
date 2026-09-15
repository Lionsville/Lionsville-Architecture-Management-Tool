/**
 * What an agent is told when it asks about a technology view (ADR-0013).
 *
 * The map's sibling (`inspectMap.ts`), and for the same reason: the view has
 * no geometry, so the report is the laid-out page — the platform, what runs
 * on it, what uses it, what it stands on, and every interface through it
 * with both ends and the pattern read off its path — and never a pixel.
 * Bounded where the page grows: the flows.
 *
 * Over the scope's own model, as the map's report is: the rows another scope
 * wrote arrive on a person's screen through the index, which this module may
 * not reach.
 */
import type { Diagram, Model } from '../model/normalised'
import { toArrays } from '../model/normalised'
import { technologyPage } from '../model/technologyDiagram'
import type { TechnologyEnd } from '../model/technologyDiagram'
import type { TransportPattern } from '../model/relations'
import type { ElementId, PlatformCategory } from '../model/types'

/** How many flows the report carries. The total beside them is whole. */
export const TECHNOLOGY_LIMIT = 200

type End = { id: ElementId; name: string; known: boolean }

export type TechnologyReport = {
  diagramId: string
  name: string
  kind: 'technology'
  platform: { id: ElementId; name: string; platformCategory: PlatformCategory } | undefined
  children: End[]
  standsOn: End[]
  hosted: End[]
  users: End[]
  flows: {
    total: number
    some: {
      id: string
      source: End
      target: End
      label?: string
      protocol?: string
      isBidirectional?: boolean
      /** The whole path, by id, and where this platform is on it. */
      via: ElementId[]
      at: number
      transport: TransportPattern
    }[]
  }
  counts: { hosted: number; users: number; flows: number }
}

const end = ({ id, name, known }: TechnologyEnd): End => ({ id, name, known })

export function inspectTechnology(model: Model, diagram: Diagram, limit = TECHNOLOGY_LIMIT, today?: string): TechnologyReport {
  const page = technologyPage(toArrays(model), diagram, today !== undefined ? { today } : {})
  return {
    diagramId: diagram.id,
    name: diagram.name,
    kind: 'technology',
    platform: page ? { id: page.platform.id, name: page.platform.name, platformCategory: page.platform.platformCategory } : undefined,
    children: (page?.children ?? []).map(end),
    standsOn: (page?.standsOn ?? []).map(end),
    hosted: (page?.hosted ?? []).map(end),
    users: (page?.users ?? []).map(end),
    flows: {
      total: page?.flows.length ?? 0,
      some: (page?.flows ?? []).slice(0, limit).map((flow) => ({
        id: flow.relation.id,
        source: end(flow.source),
        target: end(flow.target),
        ...(flow.relation.label !== undefined ? { label: flow.relation.label } : {}),
        ...(flow.relation.protocol !== undefined ? { protocol: flow.relation.protocol } : {}),
        ...(flow.relation.isBidirectional ? { isBidirectional: true } : {}),
        via: flow.path.map((one) => one.id),
        at: flow.at,
        transport: flow.transport,
      })),
    },
    counts: page?.counts ?? { hosted: 0, users: 0, flows: 0 },
  }
}
