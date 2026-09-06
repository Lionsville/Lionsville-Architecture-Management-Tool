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
 * taken, and — deliberately as a count rather than a list — the geometry.
 *
 * Pure, and no words in it. Each change names what and which; the sentence is
 * the caller's, in the caller's language.
 */
import type { HostModel } from './fromInterchange'
import type { Adr } from './adr'
import type { DesignConnection, DesignDiagram, DesignElement, DiagramPlacement } from './types'

export type ChangeKind = 'added' | 'removed' | 'changed'

/** What a change happened to. Ordered as the list is read, most meaningful first. */
export type ChangeSubject = 'element' | 'connection' | 'diagram' | 'decision' | 'placement'

export type ModelChange = {
  kind: ChangeKind
  what: ChangeSubject
  /** The id it happened to; for a placement change, the diagram's. */
  id: string
  /**
   * What a person calls it, taken from whichever side still has it — a removed
   * application is only nameable from the version it was removed from.
   */
  name: string
  /** Which fields differ. Only on a `changed` row, and never for geometry. */
  fields?: string[]
  /** How many elements moved, arrived or left, on a placement row. */
  count?: number
}

/** Fields that are not a change to the landscape, or are reported separately. */
const NOT_A_FIELD = new Set(['id', 'placements', 'edgeRoutes'])

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

function connectionName(connection: DesignConnection, model: HostModel): string {
  const name = (id: string) => model.elements.find((held) => held.id === id)?.name ?? id
  return connection.label
    || `${name(connection.sourceId)} → ${name(connection.targetId)}`
}

/**
 * How the geometry differs, as three counts.
 *
 * Never as a list. A tidy pass moves every node on the board, and forty rows
 * saying "moved" is not information — it is the reason people stop reading a
 * change list at all.
 */
function placementChange(
  before: readonly DiagramPlacement[], after: readonly DiagramPlacement[],
): { moved: number; placed: number; removed: number } {
  const held = new Map(before.map((one) => [one.elementId, one]))
  const now = new Map(after.map((one) => [one.elementId, one]))
  let moved = 0
  for (const [id, one] of now) {
    const was = held.get(id)
    if (was && JSON.stringify(was) !== JSON.stringify(one)) moved += 1
  }
  return {
    moved,
    placed: [...now.keys()].filter((id) => !held.has(id)).length,
    removed: [...held.keys()].filter((id) => !now.has(id)).length,
  }
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

  const wasConnections = byId(before.connections)
  const nowConnections = byId(after.connections)
  for (const id of ids(wasConnections, nowConnections)) {
    const was = wasConnections.get(id)
    const now = nowConnections.get(id)
    changes.push(...compare<DesignConnection>('connection', id, was, now,
      (held) => connectionName(held, now ? after : before)))
  }

  const wasDiagrams = byId(before.diagrams)
  const nowDiagrams = byId(after.diagrams)
  for (const id of ids(wasDiagrams, nowDiagrams)) {
    const was = wasDiagrams.get(id)
    const now = nowDiagrams.get(id)
    changes.push(...compare<DesignDiagram>('diagram', id, was, now, (held) => held.name))
    if (!was || !now) continue
    const geometry = placementChange(was.placements, now.placements)
    const count = geometry.moved + geometry.placed + geometry.removed
    if (count > 0) {
      changes.push({ kind: 'changed', what: 'placement', id, name: now.name, count })
    }
  }

  const wasDecisions = decisionsOf(before)
  const nowDecisions = decisionsOf(after)
  for (const id of ids(wasDecisions, nowDecisions)) {
    const was = wasDecisions.get(id)
    const now = nowDecisions.get(id)
    changes.push(...compare<Adr>('decision', id, was, now, (held) => held.title))
  }

  const order: ChangeSubject[] = ['element', 'connection', 'diagram', 'decision', 'placement']
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
  return [{ kind: 'changed', what, id, name: nameOf(now), fields }]
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
    if (change.what === 'placement') tally.moved += change.count ?? 0
    else tally[change.kind] += 1
  }
  return tally
}
