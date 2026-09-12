/**
 * What changed between two versions of a landscape, in the landscape's own
 * terms.
 *
 * A text diff of the folder is available to anybody with `git diff`, and it is
 * the wrong tool for the question people actually ask: not "which lines
 * changed" but "what happened to the architecture". Those are different
 * answers. Moving forty nodes is one sentence and four hundred changed lines;
 * renaming an application is one word in a file nobody wants to read; and a
 * reordered array is a large diff that means nothing at all.
 *
 * So this compares the two models and reports the changes as changes:
 * applications added, removed and altered, connections drawn and cut, decisions
 * taken, what came onto a board and what left it, and — deliberately as a count
 * rather than a list — the geometry.
 *
 * That last split is the one ADR-0012 §6 was written for. Membership and
 * coordinates used to be one row, so "the WMS is on the roadmap board now" and
 * "somebody pressed Tidy" arrived as the same kind of news and the second
 * drowned the first. They are two files and two questions now, and this reads
 * them as two: membership by name, one sentence each, and the geometry as a
 * number.
 *
 * Pure, and no words in it. Each change names what and which; the sentence is
 * the caller's, in the caller's language.
 */
import type { HostModel } from './fromInterchange'
import type { Adr } from './adr'
import type { Transition } from './transition'
import type { DesignDiagram, DesignElement, Relation, RelationType } from './types'

export type ChangeKind = 'added' | 'removed' | 'changed'

/** What a change happened to. Ordered as the list is read, most meaningful first. */
export type ChangeSubject =
  | 'element' | 'relation' | 'diagram' | 'decision' | 'transition'
  | 'membership' | 'geometry'

export type ModelChange = {
  kind: ChangeKind
  what: ChangeSubject
  /** The id it happened to; for a geometry change, the view's. */
  id: string
  /**
   * What a person calls it, taken from whichever side still has it — a removed
   * application is only nameable from the version it was removed from.
   */
  name: string
  /** Which view a membership change is on, by name. Only on a membership row. */
  on?: string
  /**
   * For a `relation` subject: which kind of row it was (ADR-0012 §5). The fact,
   * not the word — this file says what happened and refuses to say it in words.
   */
  relationType?: RelationType
  /** That view's id, which is what files the row under it. Membership only. */
  onId?: string
  /** Which fields differ. Only on a `changed` row, and never for geometry. */
  fields?: string[]
  /** How many boxes ended up somewhere else. Only on a geometry row. */
  count?: number
  /**
   * For an `element` whose `ref` changed: what the record now IS (ADR-0012 §3).
   *
   * Present only when `ref` itself differs. "Now a stand-in of retail" is a
   * different fact from a rename, and a reader scanning a list of changed
   * field names would never pick it out from among them.
   *
   * An object rather than a bare path, because the ROOT's path is the empty
   * string: `to` absent means the record became a definition again, and `to`
   * present — empty or not — is the scope it now stands in for.
   */
  refChanged?: { to?: string }
}

/** Fields that are not a change to the landscape, or are reported separately. */
const NOT_A_FIELD = new Set(['id', 'members', 'geometry'])

function changedFields(before: object, after: object): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const held = before as Record<string, unknown>
  const now = after as Record<string, unknown>
  return [...keys]
    .filter((key) => !NOT_A_FIELD.has(key))
    .filter((key) => JSON.stringify(held[key]) !== JSON.stringify(now[key]))
    .sort()
}

function byId<T extends { id: string }>(list: readonly T[]): Map<string, T> {
  return new Map(list.map((held) => [held.id, held]))
}

/** Sorted by id, so two runs over the same pair of models read the same. */
function ids(before: Map<string, unknown>, after: Map<string, unknown>): string[] {
  return [...new Set([...before.keys(), ...after.keys()])].sort()
}

function relationName(relation: Relation, model: HostModel): string {
  const name = (id: string) => model.elements.find((held) => held.id === id)?.name ?? id
  return relation.label
    || `${name(relation.sourceId)} → ${name(relation.targetId)}`
}

/**
 * How much of the geometry differs, as one number.
 *
 * Never as a list. A tidy pass moves every node on the board, and forty rows
 * saying "moved" is not information — it is the reason people stop reading a
 * change list at all. Group boxes count too: resizing one is a drag like any
 * other, and it is not news about the architecture either. The board's own
 * size counts once, because a person who shrank the canvas did one thing.
 *
 * A row that only arrived or left does NOT count: it arrived because something
 * was put on the view and left because something was taken off it, and
 * `membershipChanges` below already says so by name. Counting it here as well
 * would report one gesture twice, in two vocabularies. `needsLayout` is not
 * counted at all — it is a note to the router, not a change to the picture.
 */
function geometryChange(before: DesignDiagram, after: DesignDiagram): number {
  return rowsThatMoved(before.geometry?.nodes, after.geometry?.nodes)
    + rowsThatMoved(before.geometry?.groups, after.geometry?.groups)
    + differs(before.geometry?.canvas, after.geometry?.canvas)
    + differs(before.geometry?.zones, after.geometry?.zones)
}

/** Rows both versions have, and that say something different in each. */
function rowsThatMoved<T extends { id: string }>(
  before: readonly T[] | undefined, after: readonly T[] | undefined,
): number {
  const held = new Map((before ?? []).map((one) => [one.id, one]))
  let moved = 0
  for (const one of after ?? []) {
    const was = held.get(one.id)
    if (was) moved += differs(was, one)
  }
  return moved
}

function differs(before: unknown, after: unknown): number {
  return JSON.stringify(before ?? null) === JSON.stringify(after ?? null) ? 0 : 1
}

/**
 * What came onto a view and what left it, one row per element (ADR-0012 §6).
 *
 * By name and never by count, which is the opposite of the geometry above and
 * for the same reason: putting the WMS on the roadmap board is a decision
 * somebody made, and a number would say nothing about it.
 */
function membershipChanges(
  before: DesignDiagram, after: DesignDiagram,
  nameOf: (elementId: string) => string, elsewhere: ReadonlySet<string>,
): ModelChange[] {
  const held = new Map(before.members.map((one) => [one.id, one]))
  const now = new Map(after.members.map((one) => [one.id, one]))
  const changes: ModelChange[] = []
  for (const elementId of [...new Set([...held.keys(), ...now.keys()])].sort()) {
    // An element that arrived in or left the landscape itself is on or off
    // every view as a consequence, and its own row already said so. Saying it
    // again per board would make deleting one application five lines.
    if (elsewhere.has(elementId)) continue
    const was = held.get(elementId)
    const is = now.get(elementId)
    const row = {
      what: 'membership' as const, id: elementId, name: nameOf(elementId),
      on: after.name, onId: after.id,
    }
    if (!was) changes.push({ kind: 'added', ...row })
    else if (!is) changes.push({ kind: 'removed', ...row })
    else if (JSON.stringify(was) !== JSON.stringify(is)) changes.push({ kind: 'changed', ...row })
  }
  return changes
}

function decisionsOf(model: HostModel): Map<string, Adr> {
  return byId(model.decisions ?? [])
}

/**
 * Every change from `before` to `after`, in reading order.
 *
 * Elements first because that is what a landscape is, then the lines between
 * them, then the boards they are drawn on, then the decisions, and last the
 * geometry — which is the largest diff and the smallest news.
 */
export function diffModels(before: HostModel, after: HostModel): ModelChange[] {
  const changes: ModelChange[] = []

  const wasElements = byId(before.elements)
  const nowElements = byId(after.elements)
  for (const id of ids(wasElements, nowElements)) {
    const was = wasElements.get(id)
    const now = nowElements.get(id)
    changes.push(...compare<DesignElement>('element', id, was, now, (held) => held.name))
  }

  const wasRelations = byId(before.relations)
  const nowRelations = byId(after.relations)
  for (const id of ids(wasRelations, nowRelations)) {
    const was = wasRelations.get(id)
    const now = nowRelations.get(id)
    changes.push(...compare<Relation>('relation', id, was, now,
      (held) => relationName(held, now ? after : before))
      .map((change) => ({ ...change, relationType: (now ?? was)!.type })))
  }

  // An element is named from whichever version still has it: one that was
  // removed is only nameable from the version it was removed from.
  const nameOfElement = (id: string) =>
    nowElements.get(id)?.name ?? wasElements.get(id)?.name ?? id
  const cameOrWent = new Set(
    ids(wasElements, nowElements).filter((id) => !wasElements.has(id) || !nowElements.has(id)))

  const wasDiagrams = byId(before.diagrams)
  const nowDiagrams = byId(after.diagrams)
  for (const id of ids(wasDiagrams, nowDiagrams)) {
    const was = wasDiagrams.get(id)
    const now = nowDiagrams.get(id)
    changes.push(...compare<DesignDiagram>('diagram', id, was, now, (held) => held.name))
    if (!was || !now) continue
    changes.push(...membershipChanges(was, now, nameOfElement, cameOrWent))
    const count = geometryChange(was, now)
    if (count > 0) changes.push({ kind: 'changed', what: 'geometry', id, name: now.name, count })
  }

  const wasDecisions = decisionsOf(before)
  const nowDecisions = decisionsOf(after)
  for (const id of ids(wasDecisions, nowDecisions)) {
    const was = wasDecisions.get(id)
    const now = nowDecisions.get(id)
    changes.push(...compare<Adr>('decision', id, was, now, (held) => held.title))
  }

  // Plans after the decisions they rest on (ADR-0009), and before the geometry.
  const wasPlans = byId(before.transitions ?? [])
  const nowPlans = byId(after.transitions ?? [])
  for (const id of ids(wasPlans, nowPlans)) {
    changes.push(...compare<Transition>(
      'transition', id, wasPlans.get(id), nowPlans.get(id), (held) => held.title))
  }

  const order: ChangeSubject[] = [
    'element', 'relation', 'diagram', 'decision', 'transition', 'membership', 'geometry',
  ]
  return changes.sort((a, b) => order.indexOf(a.what) - order.indexOf(b.what))
}

function compare<T extends object>(
  what: ChangeSubject,
  id: string,
  was: T | undefined,
  now: T | undefined,
  nameOf: (held: T) => string,
): ModelChange[] {
  if (was && !now) return [{ kind: 'removed', what, id, name: nameOf(was) }]
  if (!was && now) return [{ kind: 'added', what, id, name: nameOf(now) }]
  if (!was || !now) return []
  const fields = changedFields(was, now)
  if (fields.length === 0) return []
  const held = (now as { ref?: string }).ref
  const ref = what === 'element' && fields.includes('ref')
    ? { refChanged: held === undefined ? {} : { to: held } }
    : {}
  return [{ kind: 'changed', what, id, name: nameOf(now), fields, ...ref }]
}

/** Nothing happened, which is a perfectly ordinary answer. */
export function isUnchanged(changes: readonly ModelChange[]): boolean {
  return changes.length === 0
}

/**
 * The counts a heading wants: how much of each kind, geometry apart.
 *
 * Geometry apart because "12 changes" reading as twelve decisions when eleven
 * of them are a tidy pass is exactly the misreading this whole file exists to
 * prevent.
 */
export function countChanges(changes: readonly ModelChange[]): {
  added: number
  removed: number
  changed: number
  moved: number
} {
  const tally = { added: 0, removed: 0, changed: 0, moved: 0 }
  for (const change of changes) {
    if (change.what === 'geometry') tally.moved += change.count ?? 0
    else tally[change.kind] += 1
  }
  return tally
}
