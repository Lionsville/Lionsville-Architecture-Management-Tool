// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A `ref` is an address, and a move has to carry it (ADR-0012 §3).
 *
 * A stand-in says where the thing it draws is defined, and it says it as a
 * path. Nothing inside a scope names its own path — that is the rule §1 keeps —
 * but everything *else* in the tree may name it, and a folder moved from
 * `acme/rail` to `acme/freight/rail` leaves every stand-in of its masters
 * pointing at a folder that is not there. The drift check reports it, which is
 * honest and useless: nobody edited those scopes, and nobody should have to go
 * and repair them by hand.
 *
 * So a move re-addresses. `copyExampleInto` has done this since the example
 * became a tree, for exactly the reason the drift check found it; this is the
 * same arithmetic said once, for every scope in the tree rather than for the
 * files of one example.
 *
 * Pure: models in, per-scope patches out. Who loads, who saves and in what
 * order is the caller's — and the order is not arbitrary (see
 * {@link readdressRefs}).
 */
import type { Command, DesignElement, ElementId } from '../model'
import type { Comment } from '../model/comment'
import type { Cause, Observation } from '../model/observation'
import type { Assignment } from '../model/units'
import type { ScopeModel, ScopeSnapshot } from './scope'
import { isWithinScope, ROOT_SCOPE } from './scopePath'
import type { ScopePath } from './scopePath'

/** One scope's stand-ins that point into the moved subtree, at their new address. */
export type RefPatch = {
  /** Where the scope is NOW — what a store is asked to load, before anything moves. */
  path: ScopePath
  /** The records to rewrite, in the order the model holds them. */
  refs: readonly { id: ElementId; ref: ScopePath }[]
}

/**
 * One address, carried: `from` and anything under it becomes `to`.
 *
 * Anything else is left exactly as it was — including a ref that is already
 * wrong, which is a drift finding and not this pass's business to guess at.
 */
export function readdressRef(ref: ScopePath, from: ScopePath, to: ScopePath): ScopePath {
  if (from === ROOT_SCOPE || !isWithinScope(ref, from)) return ref
  const below = ref.slice(from.length)
  return `${to}${below}`
}

/**
 * Every scope in the tree that points into the subtree at `from`, with the
 * refs it should hold once that subtree sits at `to`.
 *
 * **The scopes outside the subtree come first**, then the ones inside it, and
 * the order is the point rather than a tidy detail: the scopes outside are
 * saved where they stand, and the ones inside are saved at their new addresses
 * by the move itself — which is followed by the removal of the old folder. A
 * pass that wrote the subtree first and then failed would have removed the old
 * folder before the rest of the tree learnt where it went.
 *
 * The root is never moved and never a subtree here: `isWithinScope` answers
 * true for everything against the root, so a move `from` the root would
 * re-address the whole organisation onto one path.
 */
export function readdressRefs(
  models: readonly ScopeModel[],
  from: ScopePath,
  to: ScopePath,
): RefPatch[] {
  if (from === ROOT_SCOPE || from === to) return []
  const found: RefPatch[] = []
  for (const { path, model } of models) {
    const refs = model.elements.flatMap((element) => {
      if (element.ref === undefined) return []
      const next = readdressRef(element.ref, from, to)
      return next === element.ref ? [] : [{ id: element.id, ref: next }]
    })
    if (refs.length > 0) found.push({ path, refs })
  }
  return found.sort((a, b) => order(a.path, from) - order(b.path, from) || a.path.localeCompare(b.path))
}

function order(path: ScopePath, from: ScopePath): number {
  return isWithinScope(path, from) ? 1 : 0
}

/**
 * The scope with this patch applied, or the scope itself where there is none.
 *
 * A new record per rewritten ref and the rest by reference: a save writes what
 * changed, and a model rebuilt whole would be a folder rewritten whole.
 */
export function applyRefPatch(scope: ScopeSnapshot, patch?: RefPatch): ScopeSnapshot {
  if (!patch || patch.refs.length === 0) return scope
  const wanted = new Map(patch.refs.map((held) => [held.id, held.ref]))
  const elements: DesignElement[] = scope.model.elements.map((element) => {
    const ref = wanted.get(element.id)
    return ref === undefined ? element : { ...element, ref }
  })
  return { ...scope, model: { ...scope.model, elements } }
}

/**
 * The other addresses a scope may hold, in its analysis (ADR-0032 §4, §5): a
 * cause that explains a cause of a scope below names that scope's path on
 * the link, and an observation that absorbed one of a scope below names that
 * scope's path on its `absorbed` event — and, since ADR-0035, a merged
 * observation or cause names its survivor's scope on its `merged` event, and
 * a cause the scope of what it absorbed. A move carries them as it carries a
 * stand-in's `ref`, or the link and the history point at a folder that is not
 * there. A comment that a merge or a move brought from another scope names
 * that scope on its `from` (ADR-0037 §6), and is carried the same way.
 */
type AnalysisHeld = { causes?: readonly Cause[]; observations?: readonly Observation[]; comments?: readonly Comment[] }

/** Whether a scope's analysis names an address inside the subtree at `from`. */
export function analysisNamesWithin(model: AnalysisHeld, from: ScopePath): boolean {
  if (from === ROOT_SCOPE) return false
  const within = (scope: string | undefined) => scope !== undefined && isWithinScope(scope, from)
  return (model.causes ?? []).some((one) => (
    one.explains.some((link) => within(link.scope)) || (one.history ?? []).some((event) => within(event.scope))
  ))
    || (model.observations ?? []).some((one) => one.history.some((event) => within(event.scope)))
    || (model.comments ?? []).some((one) => within(one.from?.scope))
}

/**
 * The commands that carry what a scope's analysis names inside the subtree at
 * `from` to `to`: a patch of each cause's links, and of each observation's
 * history, that names an address there — and nothing for one that names none.
 * Worked out from the scope as it is read, so what it holds by then is what
 * is carried.
 */
export function readdressAnalysis(model: AnalysisHeld, from: ScopePath, to: ScopePath): Command[] {
  if (from === ROOT_SCOPE || from === to) return []
  const carry = <T extends { scope?: string }>(held: T): T => (
    held.scope === undefined ? held : { ...held, scope: readdressRef(held.scope, from, to) }
  )
  const causes = (model.causes ?? []).flatMap((one): Command[] => {
    const explains = one.explains.map(carry)
    // A merge across the tree names the other cause's scope on both records' history (ADR-0035 §4).
    const history = one.history?.map(carry)
    const linksMoved = explains.some((link, at) => link.scope !== one.explains[at].scope)
    const historyMoved = history?.some((event, at) => event.scope !== one.history![at].scope) ?? false
    if (!linksMoved && !historyMoved) return []
    return [{ type: 'cause.update', id: one.id, patch: { ...(linksMoved ? { explains } : {}), ...(historyMoved ? { history } : {}) } }]
  })
  const observations = (model.observations ?? []).flatMap((one): Command[] => {
    const history = one.history.map(carry)
    return history.some((event, at) => event.scope !== one.history[at].scope)
      ? [{ type: 'observation.update', id: one.id, patch: { history } }]
      : []
  })
  // A comment is put back as it was with its `from` carried: its body and author are not touched.
  const comments = (model.comments ?? []).flatMap((one): Command[] => {
    if (!one.from) return []
    const from = carry(one.from)
    return from.scope !== one.from.scope ? [{ type: 'comment.put', comment: { ...one, from } }] : []
  })
  return [...causes, ...observations, ...comments]
}

/**
 * A unit's own reporting lines name the scope that keeps the unit each
 * lands on (ADR-0039 §3), and so does a holder's own line on an assignment
 * (ADR-0039, amended 17 October 2026): a move carries that address as it
 * carries a stand-in's `ref`. Only a definition's: a stand-in holds none of
 * the owner's detail.
 */
type LinesHeld = { elements: readonly DesignElement[]; assignments?: readonly Assignment[] }

/** Whether a scope's units, or the holders in them, name an address inside the subtree at `from` on a line of their own. */
export function linesNameWithin(model: LinesHeld, from: ScopePath): boolean {
  if (from === ROOT_SCOPE) return false
  return model.elements.some((element) => element.ref === undefined
    && (element.reportingLines ?? []).some((line) => line.to !== undefined && isWithinScope(line.to.scope, from)))
    || (model.assignments ?? []).some((one) => (one.reportsTo ?? []).some((line) => isWithinScope(line.to.scope, from)))
}

/**
 * The commands that carry each line naming an address inside the subtree at
 * `from` to `to`: one patch of a unit's lines, and one of a holder's, each.
 */
export function readdressLines(model: LinesHeld, from: ScopePath, to: ScopePath): Command[] {
  if (from === ROOT_SCOPE || from === to) return []
  const units = model.elements.flatMap((element): Command[] => {
    if (element.ref !== undefined || !element.reportingLines?.length) return []
    const reportingLines = element.reportingLines.map((line) => (
      line.to === undefined ? line : { ...line, to: { ...line.to, scope: readdressRef(line.to.scope, from, to) } }
    ))
    const moved = reportingLines.some((line, at) => line.to?.scope !== element.reportingLines![at].to?.scope)
    return moved ? [{ type: 'element.update', id: element.id, patch: { reportingLines } }] : []
  })
  const holders = (model.assignments ?? []).flatMap((one): Command[] => {
    if (!one.reportsTo?.length) return []
    const reportsTo = one.reportsTo.map((line) => ({ ...line, to: { ...line.to, scope: readdressRef(line.to.scope, from, to) } }))
    const moved = reportsTo.some((line, at) => line.to.scope !== one.reportsTo![at].to.scope)
    return moved ? [{ type: 'assignment.update', id: one.id, patch: { reportsTo } }] : []
  })
  return [...units, ...holders]
}

/**
 * A unit names the scopes it serves by their paths (`DesignElement.scopes`,
 * ADR-0036 §4): a move carries them as it carries a stand-in's `ref`, or the
 * moved scopes read unserved and the unit serves addresses that are not
 * there (3.7.5). Only a definition's: a stand-in holds none of the owner's
 * detail.
 */
export function servedNamesWithin(model: { elements: readonly DesignElement[] }, from: ScopePath): boolean {
  if (from === ROOT_SCOPE) return false
  return model.elements.some((element) => element.ref === undefined
    && (element.scopes ?? []).some((scope) => isWithinScope(scope, from)))
}

/** One `element.update` per unit of the scope whose served scopes name an address inside the subtree at `from`, carried to `to`. */
export function readdressServed(model: { elements: readonly DesignElement[] }, from: ScopePath, to: ScopePath): Command[] {
  if (from === ROOT_SCOPE || from === to) return []
  return model.elements.flatMap((element): Command[] => {
    if (element.ref !== undefined || !element.scopes?.length) return []
    const scopes = element.scopes.map((scope) => readdressRef(scope, from, to))
    return scopes.some((scope, at) => scope !== element.scopes![at]) ? [{ type: 'element.update', id: element.id, patch: { scopes } }] : []
  })
}
