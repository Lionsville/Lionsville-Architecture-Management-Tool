/**
 * The four gestures that cross scopes (ADR-0012 §10).
 *
 * Everything else a session does is a `Command` against the scope that is
 * open. These four are the exceptions, and they are the ONLY ones: *link*,
 * *promote*, *demote*, *transfer*. Each answers the same question — which scope
 * holds the definition of this id — and three of them answer it by writing two
 * scopes.
 *
 * | gesture | what it writes |
 * |---|---|
 * | *link* | this scope only: the definition becomes a stand-in of one elsewhere |
 * | *promote* | an ancestor, then this scope |
 * | *demote* | a scope below, then this scope |
 * | *transfer* | any other scope, then this scope |
 *
 * **The other scope first, always.** Failing halfway must leave a duplicate,
 * never a hole — a definition in two places is a conflict finding somebody can
 * see and repair, and a definition in none is work that is gone. That is why a
 * plan is an ordered list of writes and one command rather than a function that
 * does them: the order is the design, and it is pinned by a test rather than by
 * the sequence of `await`s in a hook.
 *
 * **A refusal is a value with a key.** None of these is ever an exception: a
 * person asking to promote something to a scope that already answers for it is
 * asking a reasonable question with the answer "no", and the dialog says which
 * no it was.
 *
 * Pure. The tree's records come in, the writes and the command go out; who
 * loads, who saves and who dispatches is `app/useGestures.ts`.
 */
import type { StringKey } from '../i18n'
import type { Command, DesignElement, ElementId } from '../model'
import { ownerDetailOn } from './checks'
import type { ScopeModel } from './scope'
import type { ScopeIndex } from './scopeIndex'
import { ancestorScopes, isWithinScope } from './scopePath'
import type { ScopePath } from './scopePath'

export type GestureKind = 'link' | 'promote' | 'demote' | 'transfer'

export const GESTURES: readonly GestureKind[] = ['link', 'promote', 'demote', 'transfer']

export type GestureRequest = {
  gesture: GestureKind
  /** The record the gesture is about. */
  id: ElementId
  /** The scope the session has open — the one holding the record. */
  scope: ScopePath
  /**
   * Where the definition is going.
   *
   * Required for the three that move one. Optional for *link*, which does not
   * move anything: with none, the definition this record yields to is the one
   * the tree already answers with.
   */
  to?: ScopePath
  /**
   * *transfer* only: leave a stand-in behind, which is what the dialog ticks by
   * default. Without one the record goes altogether, and this scope stops
   * drawing the thing.
   */
  keepStandIn?: boolean
}

/**
 * Why a gesture was declined, as a value — the shape every refusal in this
 * codebase has: a key, never a sentence.
 */
export type GestureRefusalKey =
  /** This scope does not hold the id at all. */
  | 'gesture.unknownId'
  /** The record here is a stand-in; there is no definition to move or to link. */
  | 'gesture.notADefinition'
  /** Somebody deeper answers for it: this record is a declaration, not the thing. */
  | 'gesture.notAMaster'
  /** *Link*, with nothing in the tree to link to. */
  | 'gesture.noMaster'
  /** *Promote*, to a scope this one is not filed under. */
  | 'gesture.notAnAncestor'
  /** *Demote*, to a scope that is not filed under this one. */
  | 'gesture.notADescendant'
  /** A scope the tree has never heard of, or this scope itself. */
  | 'gesture.noSuchScope'
  /** The scope it would go to already answers for it. */
  | 'gesture.wouldConflict'
  /** Children here would be left naming a parent this scope no longer holds. */
  | 'gesture.hasChildren'

export type GestureRefusal = {
  refused: GestureRefusalKey
  /** The scope the refusal is about, where naming one helps. */
  scope?: ScopePath
}

/**
 * The sentence for each refusal, published as a table.
 *
 * The same arrangement `checks.ts` publishes `CHECK_LABEL` for, and for the
 * same reason: the page that draws a refusal reads this rather than naming a
 * key of its own, and a refusal added without words is a compile error here
 * rather than a blank dialog on somebody's screen.
 */
export const GESTURE_REFUSAL: Record<GestureRefusalKey, StringKey> = {
  'gesture.unknownId': 'gesture.unknownId',
  'gesture.notADefinition': 'gesture.notADefinition',
  'gesture.notAMaster': 'gesture.notAMaster',
  'gesture.noMaster': 'gesture.noMaster',
  'gesture.notAnAncestor': 'gesture.notAnAncestor',
  'gesture.notADescendant': 'gesture.notADescendant',
  'gesture.noSuchScope': 'gesture.noSuchScope',
  'gesture.wouldConflict': 'gesture.wouldConflict',
  'gesture.hasChildren': 'gesture.hasChildren',
}

/** One scope's model, given a record — upserted by id, load-patch-save. */
export type GestureWrite = {
  path: ScopePath
  /** The definition as that scope should hold it. */
  element: DesignElement
}

export type GesturePlan = {
  gesture: GestureKind
  /** What every OTHER scope gets, in the order it must happen. Empty for *link*. */
  writes: readonly GestureWrite[]
  /** What the open scope's session then applies, as one step. */
  command: Command
  /**
   * Two scopes were written, so the stack takes a barrier (§10): ⌘Z may undo
   * the command above, but not past it — the other scope's write is not on any
   * stack, and an undo that took back half a gesture would leave the tree
   * saying two different things.
   */
  barrier: boolean
  /** What the thing is called, for the confirmation and the line afterwards. */
  name: string
  /** Which scope answers for it once this has run — where *Open …* goes. */
  owner: ScopePath
}

export function isGestureRefusal(
  answer: GesturePlan | GestureRefusal,
): answer is GestureRefusal {
  return 'refused' in answer
}

/**
 * What one gesture would do, or why it will not.
 *
 * The open scope's records come in as `model` because the session's are newer
 * than anything a store last wrote; the rest of the tree comes in as `models`,
 * because deciding whether the target already answers for the id needs the
 * record and not just the index's summary of it.
 */
export function planGesture(deps: {
  request: GestureRequest
  /** The open scope's records, as the session has them. */
  model: { elements: readonly DesignElement[] }
  index: ScopeIndex
  /** Every scope's records, for what the target already holds. */
  models: readonly ScopeModel[]
}): GesturePlan | GestureRefusal {
  const { request, model, index, models } = deps
  const held = model.elements.find((element) => element.id === request.id)
  if (!held) return { refused: 'gesture.unknownId' }
  if (held.ref !== undefined) return { refused: 'gesture.notADefinition' }

  if (request.gesture === 'link') return planLink(request, held, index, models)

  // The three that move a definition all ask the same four questions, in the
  // same order, and differ only in which scopes they will accept as a target.
  const entry = index.lookup(request.id)
  if (entry?.master !== undefined && entry.master !== request.scope) {
    return { refused: 'gesture.notAMaster', scope: entry.master }
  }
  const to = request.to
  if (to === undefined || to === request.scope || !knows(models, to)) {
    return { refused: 'gesture.noSuchScope', ...(to !== undefined ? { scope: to } : {}) }
  }
  if (request.gesture === 'promote' && !ancestorScopes(request.scope).includes(to)) {
    return { refused: 'gesture.notAnAncestor', scope: to }
  }
  if (request.gesture === 'demote' && !isWithinScope(to, request.scope)) {
    return { refused: 'gesture.notADescendant', scope: to }
  }
  const standing = recordIn(models, to, request.id)
  if (standing && standing.ref === undefined && ownerDetailOn(standing).length > 0) {
    return { refused: 'gesture.wouldConflict', scope: to }
  }

  const keepStandIn = request.gesture !== 'transfer' || request.keepStandIn !== false
  const children = model.elements.filter((element) => element.parentId === request.id)
  if (!keepStandIn && children.length > 0) return { refused: 'gesture.hasChildren' }

  return {
    gesture: request.gesture,
    writes: [{ path: to, element: travelling(held, standing, models, to) }],
    command: keepStandIn
      ? { type: 'element.link', id: request.id, name: held.name, ref: to }
      : { type: 'element.delete', id: request.id },
    barrier: true,
    name: held.name,
    owner: to,
  }
}

/**
 * *Link*: this scope stops answering for a record somebody else already
 * defines.
 *
 * One scope, one command, an ordinary undo — which is what makes it the repair
 * for a conflict and for a dangling stand-in alike. Where the record yields TO
 * can be said explicitly (the register's conflict row offers the other scope)
 * and is otherwise the definition the tree already answers with.
 */
function planLink(
  request: GestureRequest,
  held: DesignElement,
  index: ScopeIndex,
  models: readonly ScopeModel[],
): GesturePlan | GestureRefusal {
  const entry = index.lookup(request.id)
  const elsewhere = [
    ...(entry?.conflict ?? (entry?.master !== undefined ? [entry.master] : [])),
    ...(entry?.declarations ?? []),
  ].filter((path) => path !== request.scope)
  const to = request.to ?? elsewhere[0]
  if (to === undefined) return { refused: 'gesture.noMaster' }
  if (to === request.scope || !elsewhere.includes(to)) {
    return { refused: 'gesture.noMaster', scope: to }
  }
  // The master's name, because that is what the cache is a copy OF. The tree
  // may have no answer at all while the id is only a conflict, in which case
  // the record keeps the name it has.
  const name = recordIn(models, to, request.id)?.name ?? entry?.name ?? held.name
  return {
    gesture: 'link',
    writes: [],
    command: { type: 'element.link', id: request.id, name, ref: to },
    barrier: false,
    name: held.name,
    owner: to,
  }
}

/**
 * The definition as the scope it arrives in should hold it.
 *
 * Two things are worked out rather than copied. **Where it sits** —
 * `parentId`, `order`, `lane` — says where the thing is on THIS scope's trees,
 * so it travels only where the scope it arrives in holds that parent; a record
 * that named a parent nobody there has would be a tree with a rung missing.
 * And **the account**: the owner's account travels with the definition, but a
 * scope that already had a perspective on the thing keeps it when the
 * traveller has none, because prose nobody replaced is prose somebody wrote.
 */
function travelling(
  held: DesignElement,
  standing: DesignElement | undefined,
  models: readonly ScopeModel[],
  to: ScopePath,
): DesignElement {
  const there = new Set((models.find((one) => one.path === to)?.model.elements ?? [])
    .map((element) => element.id))
  const next: DesignElement = { ...held }
  delete next.ref
  if (next.parentId !== undefined && !there.has(next.parentId)) {
    delete next.parentId
    delete next.order
  }
  if (next.lane !== undefined && !there.has(next.lane)) delete next.lane
  if (next.description === undefined && standing?.description !== undefined) {
    next.description = standing.description
  }
  return next
}

/** Does the tree know this scope at all? */
function knows(models: readonly ScopeModel[], path: ScopePath): boolean {
  return models.some((one) => one.path === path)
}

/** What one scope holds about one id, if anything. */
function recordIn(
  models: readonly ScopeModel[], path: ScopePath, id: ElementId,
): DesignElement | undefined {
  return models.find((one) => one.path === path)?.model.elements.find((element) => element.id === id)
}
