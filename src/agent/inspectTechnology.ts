/**
 * What an agent is told when it asks about a technology view (ADR-0013).
 *
 * The map's sibling (`inspectMap.ts`), and for the same reason: the view has
 * no geometry, so the report is the laid-out page — the platform, what runs
 * on it, what uses it and what it stands on — and never a pixel.
 *
 * Over the scope's own model, as the map's report is: the rows another scope
 * wrote arrive on a person's screen through the index, which this module may
 * not reach.
 */
import type { Diagram, Model } from '../model/normalised'
import { toArrays } from '../model/normalised'
import { technologyPage } from '../model/technologyDiagram'
import type { TechnologyEnd } from '../model/technologyDiagram'
import type { ElementId, PlatformCategory } from '../model/types'

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
  counts: { hosted: number; users: number }
}

const end = ({ id, name, known }: TechnologyEnd): End => ({ id, name, known })

export function inspectTechnology(model: Model, diagram: Diagram, today?: string): TechnologyReport {
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
    counts: page?.counts ?? { hosted: 0, users: 0 },
  }
}
