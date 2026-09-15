/**
 * One platform, and what would be left standing if it went (ADR-0013, redone).
 *
 * Not a view. The first cut made this the fourth laid-out view kind and it was
 * wrong: a table of text is not a picture, and offering it beside the sheet and
 * the map promised one. The question it answers is a real one and a second one
 * — *the bus is being retired; what is on it* — so it stays as a report,
 * reached from the platform\'s own card and from the finding that names it, and
 * nowhere else.
 *
 * Every mark on it is derived from the rows that name the platform, so it is
 * computed on open and never stale. What stands on it is the containers hosted
 * there, each named beside the application it belongs to, and the applications
 * that have no containers and say where they run themselves. What crosses it is
 * the container interfaces landing on those containers, each with the
 * application interface it is part of — which is what makes a retirement
 * legible: not "eleven rows" but "these interfaces, between these
 * applications".
 *
 * **What the rows name, this scope may not hold.** The applications hosted on a
 * shared cluster are a landscape\'s, not the platform scope\'s (ADR-0012 §2) —
 * so the rows arrive as a second list the way `mapPage` takes them, and the
 * names come from a `describe` the caller hands in. An id nobody can describe
 * is still an end, said by its id and marked as unknown: a dangling end is a
 * fact to draw, never one to drop.
 *
 * **Time is the day it is read.** With `today` given, a row with a window
 * counts only if it holds on that day, and an end that is gone on that day
 * takes its rows with it; with none, every row counts.
 *
 * **The tree is walked** (ADR-0014 §2.7). A cluster's report is about the
 * cluster and everything filed under it: what is hosted in its namespaces,
 * what uses them, and every interface landing there — each row naming the
 * descendant it actually sits on, because "retire the cluster" is a question
 * about all of it. What the platform stands on is the chain above it, since
 * `parentId` is the one containment.
 */
import type { HostModel } from './fromInterchange'
import { ancestorPlatforms, descendantPlatforms } from './hosting'
import type { PlatformTree } from './hosting'
import { isGoneOn, relationLiveAt } from './lifecycle'
import { platformArchetypeOf } from './relations'
import { isContainerLine } from './refines'
import type { DesignElement, ElementId, PlatformArchetype, Relation } from './types'

/** What the report is told about an id it may not hold: a name, and whose it is. */
export type PlatformDescription = {
  name: string
  kind?: DesignElement['kind']
  /** What to call the scope that answers for it, where that is not this one. */
  where?: string
  /**
   * What the platform is, as the scope that defines it says (ADR-0014). A
   * stand-in carries nothing the owner answers for, so a report read in the
   * landscape that stands on the cluster is told this the way it is told the
   * name — and what it is filed under, and whether it is the organisation's,
   * for the same reason.
   */
  platformArchetype?: PlatformArchetype
  parentId?: ElementId
  outside?: true
}

export type PlatformDescribe = (id: ElementId) => PlatformDescription | undefined

/** One end of a row: what the report can say about the thing it names. */
export type PlatformEnd = {
  id: ElementId
  name: string
  kind?: DesignElement['kind']
  /** Somebody in the organisation defines it. False is a dangling end. */
  known: boolean
  /** The scope that answers for it, where that is not this one. */
  where?: string
  /** For a container: the application it is part of, named. */
  application?: { id: ElementId; name: string }
  /**
   * The descendant it actually sits on, where that is not the platform the
   * report is about (ADR-0014 §2.7): a container in the namespace, on the
   * cluster's report.
   */
  place?: { id: ElementId; name: string }
}

/**
 * One container interface crossing the platform: the line, where it lands, and
 * the application interface it is part of.
 */
export type PlatformLanding = {
  relation: Relation
  source: PlatformEnd
  target: PlatformEnd
  /** The container hosted here that it arrives on or leaves from. */
  on: PlatformEnd
  /** The interface it is part of, where it says so. */
  partOf?: { id: string; label?: string }
}

export type PlatformReportOptions = {
  /** Rows written in another scope that name this platform (ADR-0012 §2). */
  elsewhere?: readonly Relation[]
  describe?: PlatformDescribe
  /** The day it is read; absent counts every row. */
  today?: string
}

export type PlatformReport = {
  platform: PlatformEnd & { platformArchetype: PlatformArchetype }
  /** The platforms filed under this one — a namespace under a cluster. */
  children: PlatformEnd[]
  /** The platforms this one sits in, nearest first: the chain above it. */
  standsOn: PlatformEnd[]
  /**
   * What runs here or under here: the containers, each named beside its
   * application and the descendant it sits on, and the applications that have
   * no containers and say where they run themselves.
   */
  hosted: PlatformEnd[]
  /** What consumes it or anything under it, by `uses`. */
  users: PlatformEnd[]
  /** The container interfaces that cross it or anything under it, by the container they land on. */
  landings: PlatformLanding[]
  counts: { hosted: number; users: number; landings: number }
}

/**
 * The report, or `undefined` for a platform this scope does not hold at all —
 * a report about nothing.
 */
export function platformReport(
  model: Pick<HostModel, 'elements' | 'relations'>,
  platformId: ElementId,
  options: PlatformReportOptions = {},
): PlatformReport | undefined {
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const platform = byId.get(platformId)
  if (!platform) return undefined
  const day = options.today
  const describe = options.describe
  // The tree, where this scope holds a stand-in that carries no `parentId`.
  const tree: PlatformTree = { parentOf: (id) => describe?.(id)?.parentId }
  // The platform and everything filed under it: what the report is about.
  const under = descendantPlatforms(model.elements, platformId, tree)
  const about = new Set<ElementId>([platformId, ...under.map((one) => one.id)])

  const end = (id: ElementId, on?: ElementId): PlatformEnd => {
    const held = byId.get(id)
    const told = describe?.(id)
    // The scope's own record first, and the index's word for whose it is: a
    // stand-in's cache may have drifted, and the name that counts is the
    // master's — which is what `describe` answers.
    const name = told?.name ?? held?.name ?? id
    const kind = held?.kind ?? told?.kind
    const parentId = held?.kind === 'component' ? held.parentId : undefined
    const parent = parentId === undefined ? undefined : byId.get(parentId)
    const place = on === undefined || on === platformId ? undefined : byId.get(on)
    return {
      id, name, known: held !== undefined || told !== undefined,
      ...(kind !== undefined ? { kind } : {}),
      ...(told?.where !== undefined ? { where: told.where } : {}),
      ...(parentId !== undefined
        ? { application: { id: parentId, name: describe?.(parentId)?.name ?? parent?.name ?? parentId } }
        : {}),
      ...(place !== undefined ? { place: { id: place.id, name: describe?.(place.id)?.name ?? place.name } } : {}),
    }
  }
  /** Gone on the day it is read: the day takes the row with it. */
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

  const byName = (a: PlatformEnd, b: PlatformEnd) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  /**
   * The sources of the rows of one type ending on the platform or anything
   * under it, each once — the first row wins where a thing sits in two
   * places — named with the descendant it sits on.
   */
  const endsOf = (type: Relation['type']) => {
    const where = new Map<ElementId, ElementId>()
    for (const row of rows) {
      if (row.type !== type || !about.has(row.targetId) || where.has(row.sourceId)) continue
      where.set(row.sourceId, row.targetId)
    }
    return [...where].map(([id, on]) => end(id, on)).sort(byName)
  }

  const hosted = endsOf('hostedOn')
  const users = endsOf('uses')

  // What crosses it: the container lines that touch something hosted here or
  // under here. Read from the landings rather than from anything stored on
  // the line, which is what makes "what goes over the bus" answerable without
  // asking anybody to say it twice.
  const here = new Map(hosted.map((one) => [one.id, one]))
  const held = (id: ElementId) => byId.get(id)
  const landings: PlatformLanding[] = rows
    .filter((relation) => isContainerLine(relation, held))
    .filter((relation) => here.has(relation.sourceId) || here.has(relation.targetId))
    .map((relation) => {
      const on = here.get(relation.sourceId) ?? here.get(relation.targetId)!
      const partOf = relation.refines === undefined
        ? undefined
        : rows.find((row) => row.id === relation.refines)
      return {
        relation,
        source: end(relation.sourceId),
        target: end(relation.targetId),
        on,
        ...(relation.refines !== undefined
          ? { partOf: { id: relation.refines, ...(partOf?.label !== undefined ? { label: partOf.label } : {}) } }
          : {}),
      }
    })
    .sort((a, b) => byName(a.source, b.source) || byName(a.target, b.target)
      || a.relation.id.localeCompare(b.relation.id))

  return {
    platform: {
      ...end(platformId),
      // The owner's answer where the tree has one: this scope's record may be
      // a stand-in, which says nothing about what the thing is.
      platformArchetype: describe?.(platformId)?.platformArchetype ?? platformArchetypeOf(platform),
    },
    children: under
      .filter((e) => (e.parentId ?? tree.parentOf?.(e.id)) === platformId && !gone(e.id))
      .map((e) => end(e.id))
      .sort(byName),
    // The chain above it, nearest first: `parentId` is the one containment.
    standsOn: ancestorPlatforms(model.elements, platformId, tree).map((e) => end(e.id)),
    hosted,
    users,
    landings,
    counts: { hosted: hosted.length, users: users.length, landings: landings.length },
  }
}
