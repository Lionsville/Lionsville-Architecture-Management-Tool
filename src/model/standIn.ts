/**
 * What a stand-in may carry, and what belongs to whoever defines the thing
 * (ADR-0012 §3).
 *
 * One record shape serves a definition and a stand-in, told apart by `ref` and
 * never by a type field — so the difference between the two is a list of
 * fields, and this is that list. It lives in `model/` because three modules
 * need the same answer and would otherwise each keep their own:
 *
 * - `projects/checks.ts` **reports** the owner's detail when it appears on a
 *   stand-in — reported rather than stripped on save, because somebody wrote
 *   it and a file quietly losing fields is worse than a line saying which
 *   scope answers for them;
 * - `projects/mayEdit.ts` **refuses** a write to one;
 * - the reducer's `element.link` **drops** them, which is the one moment a
 *   record deliberately stops answering for itself.
 *
 * A field in one of those lists and not the others would be a field the
 * inspector greys out and the agent accepts, or one a link leaves behind for
 * the checks to complain about for ever.
 */
import type { DesignElement } from './types'

/**
 * Everything on a record that belongs to whoever DEFINES the thing.
 *
 * What is deliberately NOT here: `description`, which is not stripped on a
 * link and not reported on a stand-in, but is not the stand-in's to show
 * either — a card and a panel show the owner's, read from the owning scope,
 * and `mayEdit` refuses writing it here; the four presentation fields, which
 * are about this scope's drawing of it; and `parentId` / `order` / `lane`,
 * which say where it sits on THIS scope's trees.
 */
export const OWNER_DETAIL = [
  'lifecycle', 'lifecycleDates', 'successorId', 'owner', 'outside', 'partyId',
  'category', 'vendor', 'technology', 'aspects', 'isManaged', 'scopes',
] as const satisfies readonly (keyof DesignElement)[]

export type OwnerDetailField = typeof OWNER_DETAIL[number]

/**
 * The record as a stand-in of the scope that answers for it — *link*
 * (ADR-0012 §10).
 *
 * Three of the owner's detail fields are required on the type and present on
 * every record, so they are put back to what a record says when it has nothing
 * to say rather than deleted: a `lifecycle` of `live`, unmanaged, no aspects.
 * The other nine are deleted outright, because a saved file should look like a
 * hand-written one and a field present and empty is not what a person would
 * have typed.
 *
 * What survives is what this scope answers for: the presentation, and where
 * the thing sits on this scope's own trees — and the text it held, left in
 * the file rather than stripped, though the owner's is what is shown. The
 * children are not touched at all — their `parentId` still names this id, and
 * a refinement is precisely a stand-in with children under it.
 */
export function asStandIn(
  element: DesignElement,
  cache: { name: string; ref: string },
): DesignElement {
  const next: DesignElement = {
    ...element,
    name: cache.name,
    ref: cache.ref,
    lifecycle: 'live',
    isManaged: false,
    aspects: {},
  }
  for (const field of OWNER_DETAIL) {
    if (field === 'lifecycle' || field === 'isManaged' || field === 'aspects') continue
    delete next[field]
  }
  return next
}

/**
 * Is this record already exactly the stand-in a link would make of it?
 *
 * What keeps a link that changes nothing off the undo stack — the same rule a
 * refresh follows. Exact rather than "the ref matches": a stand-in still
 * carrying the owner's detail is one a link has something to do about, and
 * saying otherwise would leave a finding nothing could clear.
 */
export function isLinked(
  element: DesignElement,
  cache: { name: string; ref: string },
): boolean {
  if (element.ref !== cache.ref || element.name !== cache.name) return false
  if (element.lifecycle !== 'live' || element.isManaged) return false
  if (Object.keys(element.aspects ?? {}).length > 0) return false
  return !OWNER_DETAIL.some((field) => (
    field !== 'lifecycle' && field !== 'isManaged' && field !== 'aspects'
    && element[field] !== undefined
  ))
}
