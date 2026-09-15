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
 */
import type { HostModel } from './fromInterchange'
import { isGoneOn, relationLiveAt } from './lifecycle'
import { isTechnologyRelation, platformCategoryOf } from './relations'
import { isContainerLine } from './refines'
import type { DesignElement, ElementId, PlatformCategory, Relation } from './types'

/** What the report is told about an id it may not hold: a name, and whose it is. */
export type PlatformDescription = {
  name: string
  kind?: DesignElement['kind']
  /** What to call the scope that answers for it, where that is not this one. */
  where?: string
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
  platform: PlatformEnd & { platformCategory: PlatformCategory }
  /** The platforms filed under this one — a namespace under a cluster. */
  children: PlatformEnd[]
  /** What this platform itself stands on and consumes. */
  standsOn: PlatformEnd[]
  /**
   * What runs here: the containers, each named beside its application, and the
   * applications that have no containers and say where they run themselves.
   */
  hosted: PlatformEnd[]
  /** What consumes it, by `uses`. */
  users: PlatformEnd[]
  /** The container interfaces that cross it, by the container they land on. */
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

  const end = (id: ElementId): PlatformEnd => {
    const held = byId.get(id)
    const told = describe?.(id)
    // The scope's own record first, and the index's word for whose it is: a
    // stand-in's cache may have drifted, and the name that counts is the
    // master's — which is what `describe` answers.
    const name = told?.name ?? held?.name ?? id
    const kind = held?.kind ?? told?.kind
    const parentId = held?.kind === 'component' ? held.parentId : undefined
    const parent = parentId === undefined ? undefined : byId.get(parentId)
    return {
      id, name, known: held !== undefined || told !== undefined,
      ...(kind !== undefined ? { kind } : {}),
      ...(told?.where !== undefined ? { where: told.where } : {}),
      ...(parentId !== undefined
        ? { application: { id: parentId, name: describe?.(parentId)?.name ?? parent?.name ?? parentId } }
        : {}),
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
  const endsOf = (matching: (relation: Relation) => boolean, pick: (relation: Relation) => ElementId) => {
    const ids = [...new Set(rows.filter(matching).map(pick))]
    return ids.map(end).sort(byName)
  }

  const hosted = endsOf((r) => r.type === 'hostedOn' && r.targetId === platformId, (r) => r.sourceId)
  const users = endsOf((r) => r.type === 'uses' && r.targetId === platformId, (r) => r.sourceId)

  // What crosses it: the container lines that touch something hosted here.
  // Read from the landings rather than from anything stored on the line, which
  // is what makes "what goes over the bus" answerable without asking anybody
  // to say it twice.
  const here = new Set(hosted.map((one) => one.id))
  const held = (id: ElementId) => byId.get(id)
  const landings: PlatformLanding[] = rows
    .filter((relation) => isContainerLine(relation, held))
    .filter((relation) => here.has(relation.sourceId) || here.has(relation.targetId))
    .map((relation) => {
      const on = here.has(relation.sourceId) ? relation.sourceId : relation.targetId
      const partOf = relation.refines === undefined
        ? undefined
        : rows.find((row) => row.id === relation.refines)
      return {
        relation,
        source: end(relation.sourceId),
        target: end(relation.targetId),
        on: end(on),
        ...(relation.refines !== undefined
          ? { partOf: { id: relation.refines, ...(partOf?.label !== undefined ? { label: partOf.label } : {}) } }
          : {}),
      }
    })
    .sort((a, b) => byName(a.source, b.source) || byName(a.target, b.target)
      || a.relation.id.localeCompare(b.relation.id))

  return {
    platform: { ...end(platformId), platformCategory: platformCategoryOf(platform) },
    children: model.elements
      .filter((e) => e.kind === 'platform' && e.parentId === platformId && !gone(e.id))
      .map((e) => end(e.id))
      .sort(byName),
    standsOn: endsOf((r) => isTechnologyRelation(r) && r.sourceId === platformId, (r) => r.targetId),
    hosted,
    users,
    landings,
    counts: { hosted: hosted.length, users: users.length, landings: landings.length },
  }
}
