/**
 * What belongs on a technology view: one platform, with everything on it and
 * everything through it (ADR-0013).
 *
 * The container diagram's twin in shape and the map's twin in nature. Like
 * the map it is *laid out*, never drawn: every mark on it is derived from the
 * rows that name the platform — `hostedOn` and `uses` rows ending on it, and
 * every flow whose `via` passes it — so the page is computed on open and is
 * never stale, and there is nothing to drag. This file is that computation,
 * in lists rather than pixels; the page turns a row into a line of a table.
 *
 * **A flow is split at the platform.** An interface stays one row from source
 * to target (`DesignConnection.via` says why), and what the ESB's page wants
 * is the same row seen from the bus: what comes in from the source, and what
 * goes out to the target. So each flow here is one entry with both ends, and
 * the page draws it as two halves. A flow that runs both ways comes and goes
 * on both sides. Nothing is stored for this; a change on the landscape and a
 * change here are the same change.
 *
 * **What the rows name, this scope may not hold.** The applications hosted on
 * a shared cluster are a landscape's, and so are the flows that cross the
 * organisation's bus (ADR-0012 §2) — so the rows arrive as a second list the
 * way `mapPage` takes them, and the names come from a `describe` the caller
 * hands in. An id nobody can describe is still an end, said by its id and
 * marked as unknown: a dangling end is a fact to draw, never one to drop.
 *
 * **Time is the day the view shows.** With `today` given, a flow with a
 * window counts only if it holds on that day, and an end that is gone on
 * that day takes its rows with it; with none, every row counts.
 */
import type { HostModel } from './fromInterchange'
import { isGoneOn, relationLiveAt } from './lifecycle'
import { isTechnologyRelation, platformCategoryOf, transportOf, viaOf } from './relations'
import type { TransportPattern } from './relations'
import type { DesignDiagram, DesignElement, ElementId, PlatformCategory, Relation } from './types'

/** What the view is told about an id it may not hold: a name, and whose it is. */
export type TechnologyDescription = {
  name: string
  kind?: DesignElement['kind']
  platformCategory?: PlatformCategory
  /** What to call the scope that answers for it, where that is not this one. */
  where?: string
}

export type TechnologyDescribe = (id: ElementId) => TechnologyDescription | undefined

/** One end of a row: what the view can say about the thing it names. */
export type TechnologyEnd = {
  id: ElementId
  name: string
  kind?: DesignElement['kind']
  /** Somebody in the organisation defines it. False is a dangling end. */
  known: boolean
  /** The scope that answers for it, where that is not this one. */
  where?: string
}

/** One interface through the platform, seen from the platform. */
export type TechnologyFlow = {
  relation: Relation
  source: TechnologyEnd
  target: TechnologyEnd
  /** The whole path, so the page can say "gateway → this → kafka". */
  path: TechnologyEnd[]
  /** Where this platform is on that path, from 0. */
  at: number
  transport: TransportPattern
}

export type TechnologyOptions = {
  /** Rows written in another scope that name this platform (ADR-0012 §2). */
  elsewhere?: readonly Relation[]
  describe?: TechnologyDescribe
  /** The day the view shows; absent counts every row. */
  today?: string
}

export type LaidOutTechnology = {
  platform: TechnologyEnd & { platformCategory: PlatformCategory }
  /** The platforms filed under this one — a namespace under a cluster. */
  children: TechnologyEnd[]
  /** What this platform itself stands on and consumes. */
  standsOn: TechnologyEnd[]
  /** What runs here, by `hostedOn`. */
  hosted: TechnologyEnd[]
  /** What consumes it, by `uses`. */
  users: TechnologyEnd[]
  /** Every flow that passes through it, by source name then target name. */
  flows: TechnologyFlow[]
  counts: { hosted: number; users: number; flows: number }
}

/** The technology view already about this platform, if there is one. */
export function findTechnologyDiagram(
  model: Pick<HostModel, 'diagrams'>,
  platformId: ElementId,
): DesignDiagram | undefined {
  return model.diagrams.find((d) => d.kind === 'technology' && d.platformId === platformId)
}

/**
 * The fresh view, or `undefined` when that platform does not exist here.
 *
 * `id` and `name` come from outside, for the container seed's reason: one is
 * a counter with a clock in it, the other hangs off the shell's language.
 */
export function seedTechnologyDiagram(
  model: Pick<HostModel, 'elements'>,
  platformId: ElementId,
  make: { id: string; name: (platformName: string) => string },
): DesignDiagram | undefined {
  const platform = model.elements.find((e) => e.id === platformId && e.kind === 'platform')
  if (!platform) return undefined
  return {
    id: make.id,
    kind: 'technology',
    name: make.name(platform.name),
    platformId,
    // Nothing is ON the view the way a card is on a board: what it draws is
    // the rows, and a member row would be a second place to keep the fact.
    members: [],
    geometry: { nodes: [] },
  }
}

/**
 * The page, worked out from the rows. `undefined` when the view names no
 * platform, or one this scope does not hold at all — a page about nothing.
 */
export function technologyPage(
  model: Pick<HostModel, 'elements' | 'relations'>,
  diagram: Pick<DesignDiagram, 'platformId' | 'asOf'>,
  options: TechnologyOptions = {},
): LaidOutTechnology | undefined {
  const { platformId } = diagram
  if (platformId === undefined) return undefined
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const platform = byId.get(platformId)
  if (!platform) return undefined
  const day = diagram.asOf ?? options.today
  const describe = options.describe

  const end = (id: ElementId): TechnologyEnd => {
    const held = byId.get(id)
    const told = describe?.(id)
    // The scope's own record first, and the index's word for whose it is:
    // a stand-in's cache may have drifted, and the name that counts is the
    // master's — which is what `describe` answers.
    const name = told?.name ?? held?.name ?? id
    const kind = held?.kind ?? told?.kind
    return {
      id, name, known: held !== undefined || told !== undefined,
      ...(kind !== undefined ? { kind } : {}),
      ...(told?.where !== undefined ? { where: told.where } : {}),
    }
  }
  const categoryOf = (id: ElementId): PlatformCategory | undefined => {
    const held = byId.get(id)
    if (held?.kind === 'platform') return platformCategoryOf(held)
    return describe?.(id)?.platformCategory
  }
  /** Gone on the day the view shows: the day takes the row with it. */
  const gone = (id: ElementId) => {
    const held = byId.get(id)
    return day !== undefined && held !== undefined && isGoneOn(held, day)
  }
  const live = (relation: Relation) => (day === undefined || relationLiveAt(relation, day))
    && !gone(relation.sourceId) && !gone(relation.targetId)

  // The scope's own rows first, then the tree's, and never a row twice: an
  // overview that holds a stand-in and imported its interfaces has the same
  // row from both sides.
  const seen = new Set<string>()
  const rows: Relation[] = []
  for (const relation of [...model.relations, ...(options.elsewhere ?? [])]) {
    if (seen.has(relation.id)) continue
    seen.add(relation.id)
    if (live(relation)) rows.push(relation)
  }

  const byName = (a: TechnologyEnd, b: TechnologyEnd) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  const endsOf = (matching: (relation: Relation) => boolean, pick: (relation: Relation) => ElementId) => {
    const ids = [...new Set(rows.filter(matching).map(pick))]
    return ids.map(end).sort(byName)
  }

  const flows: TechnologyFlow[] = rows
    .filter((relation) => viaOf(relation).includes(platformId))
    .map((relation) => {
      const via = viaOf(relation)
      return {
        relation,
        source: end(relation.sourceId),
        target: end(relation.targetId),
        path: via.map(end),
        at: via.indexOf(platformId),
        transport: transportOf(relation, categoryOf),
      }
    })
    .sort((a, b) => byName(a.source, b.source) || byName(a.target, b.target) || a.relation.id.localeCompare(b.relation.id))

  const hosted = endsOf((r) => r.type === 'hostedOn' && r.targetId === platformId, (r) => r.sourceId)
  const users = endsOf((r) => r.type === 'uses' && r.targetId === platformId, (r) => r.sourceId)

  return {
    platform: { ...end(platformId), platformCategory: platformCategoryOf(platform) },
    children: model.elements
      .filter((e) => e.kind === 'platform' && e.parentId === platformId && !gone(e.id))
      .map((e) => end(e.id))
      .sort(byName),
    standsOn: endsOf((r) => isTechnologyRelation(r) && r.sourceId === platformId, (r) => r.targetId),
    hosted,
    users,
    flows,
    counts: { hosted: hosted.length, users: users.length, flows: flows.length },
  }
}
