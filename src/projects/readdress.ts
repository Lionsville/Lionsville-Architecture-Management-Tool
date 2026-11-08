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
import { carryMarkKey, checkMarkId } from '../model/checkMarks'
import type { CheckMark } from '../model/checkMarks'
import type { Cause, Observation } from '../model/observation'
import type { Assignment } from '../model/units'
import type { Citation } from '../model/citable'
import type { Principle } from '../model/principle'
import { evaluationId } from '../model/evaluation'
import type { Evaluation } from '../model/evaluation'
import type { ScopeCommand } from './scopeState'
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
 * What of a scope's model may name another scope by its path: every record
 * kind {@link carryModel} carries. A store's index answers what it reads, and
 * a field it leaves out is simply not found there.
 */
export type AddressesHeld = {
  elements: readonly DesignElement[]
  assignments?: readonly Assignment[]
  causes?: readonly Cause[]
  observations?: readonly Observation[]
  comments?: readonly Comment[]
  citations?: readonly Citation[]
  principles?: readonly Principle[]
  evaluations?: readonly Evaluation[]
  checkMarks?: readonly CheckMark[]
}

/**
 * A comment as an organisation's index holds it: only one whose `from` names
 * the scope it was written in (ADR-0037 §6) — the one address a comment
 * holds, which a move of that scope finds it by ({@link addressesNameWithin})
 * — and that without its body, as an element is indexed without its
 * description. `undefined` for every other comment, which the index leaves
 * out: a scope's threads are read where they are shown.
 */
export function commentAsIndexed(comment: Comment): Comment | undefined {
  if (comment.from?.scope === undefined) return undefined
  return { id: comment.id, about: comment.about, by: comment.by, at: comment.at, body: '', from: comment.from }
}

/** A scope's comments as its index holds them ({@link commentAsIndexed}): nothing where none names a scope. */
export function commentsIndexed(comments: readonly Comment[] | undefined): { comments?: Comment[] } {
  const held = (comments ?? []).flatMap((one) => commentAsIndexed(one) ?? [])
  return held.length ? { comments: held } : {}
}

/**
 * Every address a scope's model holds, carried by `carry` — **the one list**
 * of fields that name a scope by its path, which a scope landing somewhere new
 * whole ({@link carryAddresses}) and a move of the tree ({@link readdressHeld})
 * both read, so neither can carry a field the other forgets:
 *
 * a stand-in's `ref`; a unit's own reporting lines, the scopes it serves
 * (ADR-0036 §4), and a holder's own line (ADR-0039); a cause's links and
 * history, an observation's history (ADR-0032 §4, §5, ADR-0035), a comment's
 * `from` (ADR-0037 §6); a citation's principle and a principle's relations
 * (ADR-0041 §5, §7); an evaluation's block — and its id, which is said from
 * that block's scope (`evaluationId`) — and a building block's capability's
 * aspect (ADR-0043); and a check mark's key, where its subjects hold a
 * scope's path (`model/checkMarks.carryMarkKey`). A field added that names a
 * scope belongs here.
 *
 * Records are rebuilt where they hold an address and the rest kept as they
 * were; the scope's own `path`, and a topic's links, are the snapshot's.
 */
export function carryModel<M extends AddressesHeld>(model: M, carry: (path: ScopePath) => ScopePath): M {
  const at = <T extends { scope: string }>(held: T): T => ({ ...held, scope: carry(held.scope) })
  const maybe = <T extends { scope?: string }>(held: T): T => (held.scope === undefined ? held : { ...held, scope: carry(held.scope) })
  const elements = model.elements.map((element): DesignElement => ({
    ...element,
    ...(element.ref !== undefined ? { ref: carry(element.ref) } : {}),
    ...(element.reportingLines ? { reportingLines: element.reportingLines.map((line) => (line.to === undefined ? line : { ...line, to: at(line.to) })) } : {}),
    ...(element.scopes ? { scopes: element.scopes.map(carry) } : {}),
    ...(element.capabilities ? {
      capabilities: element.capabilities.map((one) => (one.aspect === undefined ? one : { ...one, aspect: at(one.aspect) })),
    } : {}),
  }))
  const evaluations = model.evaluations?.map((one) => {
    const block = at(one.block)
    return { ...one, id: evaluationId(block), block }
  })
  return {
    ...model,
    elements,
    ...(model.assignments ? { assignments: model.assignments.map((one) => (one.reportsTo ? { ...one, reportsTo: one.reportsTo.map((line) => ({ ...line, to: at(line.to) })) } : one)) } : {}),
    ...(model.causes ? { causes: model.causes.map((one) => ({ ...one, explains: one.explains.map(maybe), ...(one.history ? { history: one.history.map(maybe) } : {}) })) } : {}),
    ...(model.observations ? { observations: model.observations.map((one) => ({ ...one, history: one.history.map(maybe) })) } : {}),
    ...(model.comments ? { comments: model.comments.map((one) => (one.from ? { ...one, from: maybe(one.from) } : one)) } : {}),
    ...(model.citations ? { citations: model.citations.map((one) => ({ ...one, principle: at(one.principle) })) } : {}),
    ...(model.principles ? { principles: model.principles.map((one) => (one.relations ? { ...one, relations: one.relations.map((relation) => ({ ...relation, to: at(relation.to) })) } : one)) } : {}),
    ...(evaluations ? { evaluations } : {}),
    ...(model.checkMarks ? { checkMarks: model.checkMarks.map((one) => carryMarkKey(one, carry)) } : {}),
  }
}

/**
 * Every address a scope holds, carried by `carry`: its model's
 * ({@link carryModel}) and its topic's links (ADR-0042 §5) — what an example,
 * or a visit kept, filed under the organisation rather than as it carries
 * (`examples/copy`). Where it lands is the caller's.
 */
export function carryAddresses(scope: ScopeSnapshot, carry: (path: ScopePath) => ScopePath): ScopeSnapshot {
  return {
    ...scope,
    model: carryModel(scope.model, carry),
    ...(scope.relevantTo ? { relevantTo: scope.relevantTo.map((link) => ({ ...link, path: carry(link.path) })) } : {}),
  }
}

/** Whether anything a scope's model holds names an address inside the subtree at `from`; never for the root, which every address is within. */
export function addressesNameWithin(model: AddressesHeld, from: ScopePath): boolean {
  if (from === ROOT_SCOPE) return false
  let named = false
  carryModel(model, (path) => {
    if (isWithinScope(path, from)) named = true
    return path
  })
  return named
}

const differ = (one: unknown, other: unknown) => JSON.stringify(one) !== JSON.stringify(other)

/**
 * The commands that carry what a scope's model names inside the subtree at
 * `from` to `to`, as patches of the records that name one and nothing for the
 * rest — worked out from the scope as it is read, so what it holds by then is
 * what is carried. A stand-in is refreshed (`standin.refresh`); a definition's
 * lines, served scopes and capabilities are one patch of it; and an
 * evaluation, whose id is said from its block's scope, is taken and put back
 * where it stood under its new id.
 */
export function readdressHeld(model: AddressesHeld, from: ScopePath, to: ScopePath): Command[] {
  if (from === ROOT_SCOPE || from === to) return []
  const now = carryModel(model, (path) => readdressRef(path, from, to))
  const entries: { id: ElementId; ref: string; name: string }[] = []
  const units: Command[] = []
  model.elements.forEach((element, at) => {
    const next = now.elements[at]
    if (element.ref !== undefined) {
      if (next.ref !== element.ref) entries.push({ id: element.id, ref: next.ref!, name: element.name })
      // A stand-in holds none of the owner's detail.
      return
    }
    const patch: Partial<DesignElement> = {}
    for (const field of ['reportingLines', 'scopes', 'capabilities'] as const) {
      if (differ(element[field], next[field])) Object.assign(patch, { [field]: next[field] })
    }
    if (Object.keys(patch).length > 0) units.push({ type: 'element.update', id: element.id, patch })
  })
  const each = <T,>(was: readonly T[] | undefined, next: readonly T[] | undefined, say: (one: T, now: T, at: number) => Command[]): Command[] => (
    (was ?? []).flatMap((one, at) => say(one, next![at], at))
  )
  return [
    ...(entries.length ? [{ type: 'standin.refresh', entries } as const] : []),
    ...units,
    ...each(model.assignments, now.assignments, (one, next) => (
      differ(one.reportsTo, next.reportsTo) ? [{ type: 'assignment.update', id: one.id, patch: { reportsTo: next.reportsTo } }] : []
    )),
    ...each(model.causes, now.causes, (one, next) => {
      const links = differ(one.explains, next.explains)
      const history = differ(one.history, next.history)
      return links || history
        ? [{ type: 'cause.update', id: one.id, patch: { ...(links ? { explains: next.explains } : {}), ...(history ? { history: next.history } : {}) } }]
        : []
    }),
    ...each(model.observations, now.observations, (one, next) => (
      differ(one.history, next.history) ? [{ type: 'observation.update', id: one.id, patch: { history: next.history } }] : []
    )),
    // A comment is put back as it was with its `from` carried: its body and author are not touched.
    ...each(model.comments, now.comments, (one, next) => (differ(one.from, next.from) ? [{ type: 'comment.put', comment: next }] : [])),
    ...each(model.citations, now.citations, (one, next) => (
      differ(one.principle, next.principle) ? [{ type: 'citation.update', id: one.id, patch: { principle: next.principle } }] : []
    )),
    ...each(model.principles, now.principles, (one, next) => (
      differ(one.relations, next.relations) ? [{ type: 'principle.update', id: one.id, patch: { relations: next.relations } }] : []
    )),
    ...each(model.evaluations, now.evaluations, (one, next, at) => {
      if (next.id === one.id) return []
      return [{ type: 'evaluation.remove', id: one.id }, { type: 'evaluation.add', evaluation: next, at }]
    }),
    // A mark's id is its check and its key, so one whose key names a path is taken and put back where it stood, as an evaluation is.
    ...each(model.checkMarks, now.checkMarks, (one, next, at) => {
      if (next.key === one.key) return []
      return [{ type: 'checkMark.remove', id: checkMarkId(one) }, { type: 'checkMark.add', mark: next, at }]
    }),
  ]
}

/**
 * What a move writes in one scope that names an address inside the subtree at
 * `from`: its records' addresses ({@link readdressHeld}) as one change, and
 * its topic's links (ADR-0042 §5) as the topic's own record. Nothing where it
 * names none.
 */
export function readdressScope(held: Pick<ScopeSnapshot, 'model' | 'relevantTo'>, from: ScopePath, to: ScopePath): ScopeCommand[] {
  if (from === ROOT_SCOPE || from === to) return []
  const commands = readdressHeld(held.model, from, to)
  const links = held.relevantTo ?? []
  const relinked = links.map((link) => ({ ...link, path: readdressRef(link.path, from, to) }))
  const describe: ScopeCommand[] = differ(links, relinked) ? [{ type: 'scope.describe', patch: { relevantTo: relinked } }] : []
  return [...(commands.length === 0 ? [] : [commands.length === 1 ? commands[0] : { type: 'transaction' as const, commands }]), ...describe]
}
