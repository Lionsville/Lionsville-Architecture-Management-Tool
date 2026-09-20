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
 * `technology.list` and `service.report` answer across the tree. The one
 * thing read off the tree is the **shared row** (ADR-0020): every offering
 * another scope marks shared, as the page shows it, so an agent sees what a
 * `technology.use` may name.
 */
import type { Diagram, Model } from '../model/normalised'
import { toArrays } from '../model/normalised'
import { landscapeEdges, technologyLandscape } from '../model/technologyLandscape'
import type { LandscapeEdge, LandscapePlatform, LandscapeService, SharedElsewhere } from '../model/technologyLandscape'
import type { ElementId } from '../model/types'
import type { TreeView } from './tree'

/** The shared row as the tree knows it: every shared offering a scope other than this one answers for. */
export function sharedElsewhereOf(tree: Pick<TreeView, 'technology'> | undefined, scopePath: string): SharedElsewhere[] {
  return (tree?.technology?.() ?? [])
    .filter((row) => row.kind === 'platformService' && row.shared === true && row.master !== undefined && row.master !== scopePath)
    .map((row) => ({ id: row.id, name: row.name, where: row.master!, realisedBy: row.realisedBy.map((one) => one.id) }))
}

/** How many of each band's cards and how many lines the report carries. The totals beside them are whole. */
export const TECHNOLOGY_LIMIT = 200

export type TechnologyReport = {
  diagramId: string
  name: string
  kind: 'technology'
  groups: { total: number; some: { scope: string | undefined; applications: { id: ElementId; name: string; known: boolean; uses: ElementId[]; implied: ElementId[]; binds: ElementId[]; hostedOn: ElementId[] }[] }[] }
  /** The services, this scope's own first; a shared offering from elsewhere says `where`, and whether a stand-in of it is held here. */
  services: { total: number; some: { id: ElementId; name: string; depth: number; shared: boolean; consumers: number; realisedBy: ElementId[]; where?: string; standIn?: boolean }[] }
  platforms: { total: number; some: { id: ElementId; name: string; depth: number; archetype: LandscapePlatform['archetype']; outside: boolean; realises: ElementId[]; applications: number }[] }
  /** Every line the page would draw at rest — the service band open, hosting drawn and not folded (ADR-0020) — as rows. */
  edges: { total: number; some: { from: string; to: string; kind: LandscapeEdge['kind']; count: number; via?: ElementId[]; implied?: true }[] }
}

export function inspectTechnology(model: Model, diagram: Diagram, limit = TECHNOLOGY_LIMIT, sharedElsewhere: readonly SharedElsewhere[] = []): TechnologyReport {
  const page = technologyLandscape(toArrays(model), diagram, { sharedElsewhere })
  const services: TechnologyReport['services']['some'] = []
  const walkServices = (nodes: LandscapeService[], depth: number) => {
    for (const node of nodes) {
      services.push({
        id: node.id, name: node.name, depth, shared: node.shared === true, consumers: node.consumers, realisedBy: node.realisedBy,
        ...(node.where !== undefined ? { where: node.where, standIn: node.standIn === true } : {}),
      })
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
  const edges = landscapeEdges(page, { services: true, foldHosting: false, folded: new Set() })
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
