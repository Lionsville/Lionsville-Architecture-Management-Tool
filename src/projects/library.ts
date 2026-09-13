/**
 * Drawing an application the organisation already has, on this scope's board
 * — the register used as a library (ADR-0012 §2, §3).
 *
 * A landscape rarely invents its applications: most of them exist already,
 * defined in a domain beneath it, in a sibling, or at the organisation, and
 * the honest way to put one on this board is to draw what is there rather
 * than to make a second one with the same name and a fresh id. What that
 * means for THIS scope's records is one of three things, and this file says
 * which:
 *
 * - the scope holds the id already, as a definition or a stand-in — nothing
 *   changes about the record, it is only **drawn**;
 * - another scope answers for it — this scope gets a **stand-in**, whoever
 *   that scope is. A domain beneath this one, a sibling, the organisation
 *   above: in every case somebody defines it and this scope is only drawing
 *   it, so ownership stays exactly where it was. Taking it over is *promote*
 *   or *transfer*, a different gesture with a confirmation;
 * - nobody in the tree defines it — every record is a stand-in of nothing —
 *   and that is a **question** rather than an answer. This scope may become
 *   its owner, which is a definition here and settles the finding; or it may
 *   draw it as one more stand-in carrying the same cached address, and leave
 *   the question where it was.
 *
 * Pure, like `gestures.ts` beside it: the index and this scope's records come
 * in, a plan or a refusal comes out, and `app/useLibrary.ts` is what asks the
 * person and dispatches. In `projects/` because the answer is about which
 * scope holds what, which `model/` may not know.
 */
import type { StringKey } from '../i18n'
import type { DesignDiagram, DesignElement, ElementId, Relation } from '../model'
import { canPlaceKind } from '../model/placement'
import type { IndexedRelation, IndexEntry, ScopeIndex } from './scopeIndex'
import type { ScopePath } from './scopePath'

/** One application the register offers, as a picker lists it. */
export type LibraryRow = {
  id: ElementId
  name: string
  /** The scope that answers for it; absent where nobody does. */
  master?: ScopePath
  /** This scope holds a record of it already — it is only not on this board. */
  held: boolean
}

export type LibraryPlan =
  /** Held here already, as a definition or a stand-in: only draw it. */
  | { kind: 'draw'; id: ElementId; name: string }
  /** Another scope answers for it: this scope draws a stand-in of that record. */
  | { kind: 'standIn'; element: DesignElement; owner: ScopePath }
  /**
   * Nobody defines it. `drawOnly` is what the record would be as one more
   * stand-in — absent where no stand-in anywhere carries an address to copy,
   * in which case owning it is the only answer on offer.
   */
  | { kind: 'unowned'; id: ElementId; name: string; own: DesignElement; drawOnly?: DesignElement }

export type LibraryRefusalKey =
  /** The register does not know the id — the tree changed under the picker. */
  | 'library.unknownId'
  /** It is on this board already. */
  | 'library.alreadyDrawn'
  /** The view in front of us is not one a card is drawn on. */
  | 'library.notABoard'

export type LibraryRefusal = { refused: LibraryRefusalKey }

/** The sentence for each refusal, published the way `GESTURE_REFUSAL` is. */
export const LIBRARY_REFUSAL: Record<LibraryRefusalKey, StringKey> = {
  'library.unknownId': 'library.unknownId',
  'library.alreadyDrawn': 'library.alreadyDrawn',
  'library.notABoard': 'library.notABoard',
}

export function isLibraryRefusal(answer: LibraryPlan | LibraryRefusal): answer is LibraryRefusal {
  return 'refused' in answer
}

/**
 * What the picker lists: every application in the organisation that is not on
 * this board yet, by name — the register's own order.
 *
 * Not "not in this scope": a record this scope holds and has not drawn on this
 * board is the commonest case of all, a second landscape over the same model,
 * and it is listed with `held` so the row can say so.
 */
export function libraryRows(
  index: ScopeIndex,
  model: { elements: readonly DesignElement[] },
  diagram: Pick<DesignDiagram, 'members'>,
): LibraryRow[] {
  const drawn = new Set(diagram.members.map((member) => member.id))
  const held = new Set(model.elements.map((element) => element.id))
  return index.register()
    .filter((entry) => !drawn.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      ...(entry.master !== undefined ? { master: entry.master } : {}),
      held: held.has(entry.id),
    }))
}

/**
 * What drawing one application from the register means for this scope.
 *
 * `scope` is asked for even though the plan never writes another scope,
 * because the one case that turns on it is the ordinary one: a master that IS
 * this scope is a record this scope holds, and the plan for it is to draw.
 */
export function planFromLibrary(deps: {
  id: ElementId
  scope: ScopePath
  model: { elements: readonly DesignElement[] }
  diagram: Pick<DesignDiagram, 'kind' | 'members'>
  index: ScopeIndex
}): LibraryPlan | LibraryRefusal {
  const { id, scope, model, diagram, index } = deps
  const entry = index.lookup(id)
  if (!entry) return { refused: 'library.unknownId' }
  if (!canPlaceKind(entry.kind, diagram.kind).ok) return { refused: 'library.notABoard' }
  if (diagram.members.some((member) => member.id === id)) return { refused: 'library.alreadyDrawn' }
  const held = model.elements.find((element) => element.id === id)
  if (held) return { kind: 'draw', id, name: held.name }
  if (entry.master !== undefined && entry.master !== scope) {
    return { kind: 'standIn', element: standInOf(entry, entry.master), owner: entry.master }
  }
  return {
    kind: 'unowned',
    id,
    name: entry.name,
    own: definitionOf(entry),
    ...(entry.cachedRef !== undefined ? { drawOnly: standInOf(entry, entry.cachedRef) } : {}),
  }
}

/**
 * The interfaces a stand-in brings with it: every `flow` row the tree holds
 * between it and a record this scope already has, that this scope does not
 * hold yet.
 *
 * The same row under the same id — a landscape defines the interface and an
 * overview draws it, exactly as it draws the application — so a row is one
 * fact across the tree and a refresh could rewrite it. Flows only: a
 * `supports` or `serves` row is coverage, counted once over the whole tree
 * (`rowsTo`), and a copy of one would count twice. Rows about an end this
 * scope does not hold are left where they are; they arrive when that end
 * does.
 */
export function rowsToImport(
  rows: readonly IndexedRelation[],
  id: ElementId,
  model: { elements: readonly DesignElement[]; relations: readonly Relation[] },
): Relation[] {
  const held = new Set(model.elements.map((element) => element.id))
  const have = new Set(model.relations.map((relation) => relation.id))
  const found = new Map<string, Relation>()
  for (const { relation } of rows) {
    if (relation.type !== 'flow' || have.has(relation.id) || found.has(relation.id)) continue
    const other = relation.sourceId === id ? relation.targetId : relation.sourceId
    if (other === id || !held.has(other)) continue
    found.set(relation.id, relation)
  }
  return [...found.values()]
}

/**
 * The record a scope keeps of a thing another scope defines: the two caches
 * and nothing of the owner's detail (`model/standIn.ts`).
 */
function standInOf(entry: IndexEntry, ref: string): DesignElement {
  return {
    id: entry.id, kind: entry.kind, name: entry.name, ref,
    lifecycle: 'live', isManaged: false, aspects: {},
  }
}

/**
 * The definition this scope would hold if it answered for the thing: the
 * name everybody has been using, and the defaults a fresh record gets.
 */
function definitionOf(entry: IndexEntry): DesignElement {
  return {
    id: entry.id, kind: entry.kind, name: entry.name,
    lifecycle: 'live', isManaged: true, aspects: {},
  }
}
