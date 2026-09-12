/**
 * What one scope may change about one element (ADR-0012 §10).
 *
 * A session opens one scope and everything a keystroke or an agent does is a
 * `Command` against it. Three rules decide what such a command may touch, and
 * this is the one function that says so — read by the editor's inspector, by
 * the sheet's function inspector and by the agent's `element.update`, so that
 * a field greyed out on one page cannot be written from another.
 *
 * - A **definition** this scope holds: everything. That includes a
 *   *declaration* — a definition above the master, which yielded when somebody
 *   deeper took the id. It is this scope's record and this scope may edit it;
 *   what tells a person it is a copy is the drift check, not a locked field.
 * - A **stand-in** this scope holds: its `description`, which is this scope's
 *   own account of the thing and is allowed to differ from the owner's; its
 *   presentation; its membership on this scope's views; and the `parentId` /
 *   `order` of its children, which say where it sits on this scope's trees.
 * - Anything in the **owner's detail** — lifecycle, dates, vendor, aspects —
 *   on a stand-in: refused as a value, with the owning scope's path in the
 *   refusal so the screen can offer to open it. Its `name` and `ref` are
 *   refused with them, for the other half of the same sentence: they are
 *   caches, and a refresh rewrites them where a person does not.
 *
 * **A refusal, not a strip.** Nothing here deletes a field somebody wrote: the
 * write is declined and `checks.ts` reports what is already there. A file that
 * quietly loses fields is worse than a line saying which scope answers for
 * them.
 *
 * Git has no permissions, and neither does this. It is a rule about where a
 * fact belongs, enforced where a person or an agent would otherwise put it in
 * two places; a team that wants it enforced upstream uses `CODEOWNERS`.
 */
import type { DesignElement, ElementId } from '../model'
import { OWNER_DETAIL } from './checks'
import type { ScopeIndex } from './scopeIndex'
import type { ScopePath } from './scopePath'

/**
 * Why a write was declined, as a value — the shape every refusal in this
 * codebase has: a key, never a sentence.
 *
 * `owner` is absent on a dangling stand-in, where the record says it stands in
 * for something and nothing in the tree defines it. Still refused: the fields
 * belong to whoever comes to define it, and *link* (§10) is how that happens.
 */
export type EditRefusal = {
  refused: 'check.ownedElsewhere'
  owner?: ScopePath
}

/** What this scope may change about one element. */
export type EditRights = {
  /** Everything: this scope holds the definition, or the tree has never heard of the id. */
  all: boolean
  /** Which scope answers for it, when it is not this one. */
  owner?: ScopePath
}

/**
 * The rights, from the tree and — where the caller has it — from the record in
 * front of them.
 *
 * `held` is the live record, and it wins. The index is rebuilt twice: when the
 * app starts and when the folder changes, never on a keystroke — so a record
 * linked or created a second ago is not in it, and a page that consulted only
 * the index would grey out a field on a record it had just made.
 *
 * An id the tree has never heard of is this scope's own. That is the honest
 * answer for a session opened before anything listed the tree, and for an
 * element drawn a moment ago; it is also what this app did before the tree had
 * an index at all.
 */
export function mayEdit(
  id: ElementId,
  scope: ScopePath,
  index: ScopeIndex,
  held?: Pick<DesignElement, 'ref'>,
): EditRights {
  const entry = index.lookup(id)
  const standIn = held !== undefined
    ? held.ref !== undefined
    : (entry?.drawnIn.includes(scope) ?? false)
  if (!standIn) return { all: true }
  const owner = entry?.master ?? (held?.ref !== scope ? held?.ref : undefined)
  return { all: false, ...(owner !== undefined ? { owner } : {}) }
}

/**
 * May this scope write this field of this element?
 *
 * `true`, or the refusal with the owner in it. A field that is not in the
 * owner's detail is always writable — the perspective, the presentation, and
 * where the thing sits on this scope's own trees.
 */
export function mayEditField(
  field: keyof DesignElement,
  id: ElementId,
  scope: ScopePath,
  index: ScopeIndex,
  held?: Pick<DesignElement, 'ref'>,
): true | EditRefusal {
  if (!isFixedOnAStandIn(field)) return true
  const rights = mayEdit(id, scope, index, held)
  if (rights.all) return true
  return { refused: 'check.ownedElsewhere', ...(rights.owner !== undefined ? { owner: rights.owner } : {}) }
}

/**
 * The refusal for a whole patch, or nothing.
 *
 * One answer for the several fields a patch can carry, because a caller that
 * asked per field would have to decide what to do with a patch that is half
 * allowed — and the answer to that is "none of it", the way a transaction that
 * refuses anywhere changes nothing.
 */
export function mayApplyPatch(
  patch: Partial<DesignElement>,
  id: ElementId,
  scope: ScopePath,
  index: ScopeIndex,
  held?: Pick<DesignElement, 'ref'>,
): true | EditRefusal {
  const touched = Object.keys(patch).filter(isFixedOnAStandIn)
  if (touched.length === 0) return true
  return mayEditField(touched[0] as keyof DesignElement, id, scope, index, held)
}

/**
 * A stand-in's two caches (ADR-0012 §3).
 *
 * Not part of the owner's detail, because they are not the owner's detail:
 * they are this record's copy of what the tree says, and every record has a
 * name whether or not anybody wrote one. They are refused for a different
 * reason — "a refresh rewrites them; a person does not" (§10) — and they are
 * refused all the same, which is why both lists feed one predicate.
 */
const CACHED_ON_STANDIN: readonly (keyof DesignElement)[] = ['name', 'ref']

/** Is this one of the fields the owning scope answers for? See `checks.OWNER_DETAIL`. */
export function isOwnerDetail(field: string): field is keyof DesignElement {
  return (OWNER_DETAIL as readonly string[]).includes(field)
}

/**
 * Every field a stand-in may not be written by hand: the owner's detail, and
 * the two caches.
 *
 * The list an inspector greys out and the list `mayEditField` refuses, said
 * once so they cannot drift.
 */
export const FIXED_ON_A_STANDIN: readonly string[] = [...OWNER_DETAIL, ...CACHED_ON_STANDIN]

function isFixedOnAStandIn(field: string): boolean {
  return FIXED_ON_A_STANDIN.includes(field)
}
