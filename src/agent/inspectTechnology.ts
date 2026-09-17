/**
 * What an agent is told when it asks about the technology landscape.
 *
 * The map's sibling (`inspectMap.ts`), and for the same reason: the view has
 * no geometry (ADR-0015), so the report is the laid-out page — the
 * applications by the scope that answers for each, the services nested by
 * parent, the platforms nested where the tree nests, and the lines between
 * them — and never a pixel. Bounded where the page grows.
 *
 * Over the scope's own model, as the map's report is: the rows another scope
 * wrote reach a person's screen through the index, which this module may not
 * reach. A landscape read here at the platform scope therefore shows the
 * offerings and the tree and whatever consumers this scope's own rows name;
 * `technology.list` and `service.report` answer across the tree.
 */
import type { Diagram, Model } from '../model/normalised'
import { toArrays } from '../model/normalised'
import { landscapeEdges, technologyLandscape } from '../model/technologyLandscape'
import type { LandscapeEdge, LandscapePlatform, LandscapeService } from '../model/technologyLandscape'
import type { ElementId } from '../model/types'

/** How many of each band's cards and how many lines the report carries. The totals beside them are whole. */
export const TECHNOLOGY_LIMIT = 200

export type TechnologyReport = {
  diagramId: string
  name: string
  kind: 'technology'
  groups: { total: number; some: { scope: string | undefined; applications: { id: ElementId; name: string; known: boolean; uses: ElementId[]; implied: ElementId[]; binds: ElementId[]; hostedOn: ElementId[] }[] }[] }
  services: { total: number; some: { id: ElementId; name: string; depth: number; shared: boolean; consumers: number; realisedBy: ElementId[] }[] }
  platforms: { total: number; some: { id: ElementId; name: string; depth: number; archetype: LandscapePlatform['archetype']; outside: boolean; realises: ElementId[]; applications: number }[] }
  /** Every line the page would draw with the service band open and hosting shown, as rows. */
  edges: { total: number; some: { from: string; to: string; kind: LandscapeEdge['kind']; count: number; via?: ElementId[]; implied?: true }[] }
}

export function inspectTechnology(model: Model, diagram: Diagram, limit = TECHNOLOGY_LIMIT): TechnologyReport {
  const page = technologyLandscape(toArrays(model), diagram)
  const services: TechnologyReport['services']['some'] = []
  const walkServices = (nodes: LandscapeService[], depth: number) => {
    for (const node of nodes) {
      services.push({ id: node.id, name: node.name, depth, shared: node.shared === true, consumers: node.consumers, realisedBy: node.realisedBy })
      walkServices(node.children, depth + 1)
    }
  }
  walkServices(page.services, 0)
  const platforms: TechnologyReport['platforms']['some'] = []
  const walkPlatforms = (nodes: LandscapePlatform[], depth: number) => {
    for (const node of nodes) {
      platforms.push({ id: node.id, name: node.name, depth, archetype: node.archetype, outside: node.outside === true, realises: node.realises, applications: node.applications })
      walkPlatforms(node.children, depth + 1)
    }
  }
  walkPlatforms(page.platforms, 0)
  const edges = landscapeEdges(page, { services: true, hosting: true, folded: new Set() })
  return {
    diagramId: diagram.id,
    name: diagram.name,
    kind: 'technology',
    groups: {
      total: page.groups.length,
      some: page.groups.slice(0, limit).map((group) => ({
        scope: group.label,
        applications: group.applications.slice(0, limit).map(({ id, name, known, uses, implied, binds, hostedOn }) => ({ id, name, known, uses, implied, binds, hostedOn })),
      })),
    },
    services: { total: services.length, some: services.slice(0, limit) },
    platforms: { total: platforms.length, some: platforms.slice(0, limit) },
    edges: { total: edges.length, some: edges.slice(0, limit) },
  }
}
