/**
 * What covers a function, and what it means when nothing does.
 *
 * ADR-0012 §9 makes this a derived fact with three answers, and the third is
 * the one the record exists for: a function supported by 0..n applications
 * (`supports`) and assigned to 0..n actors (`assigned`) is **covered**; one
 * with people and no systems is **manual**, which is a complete answer and not
 * a finding; and one with neither is **uncovered**, which is.
 *
 * "A function that is only people doing things is a complete answer, not a
 * gap" is the whole reason this is three values rather than a boolean — a map
 * that drew an unsupported capability in red would be telling an organisation
 * to buy software for the thing it does by hand.
 *
 * Time is left where ADR-0009 put it. A `supports` row may carry a window, and
 * a caller that cares which day it is asks for the rows that are live then
 * (`model/lifecycle`) and hands those in; this counts what it is given.
 *
 * **Rows written in another scope arrive as a second list** (ADR-0012 §2). The
 * applications that support a capability the ORGANISATION defines live in a
 * landscape's model, so a sheet drawn at the root has to count rows it does
 * not hold; the index is what knows where they are, and `business` may not
 * import `projects`, so they are handed in. Deduplicated by row id, because
 * the whole tree includes the caller's own scope.
 */
import type { ElementId, Relation } from '../model'

/** What the map draws under a function. */
export type Coverage = 'covered' | 'manual' | 'uncovered'

export type FunctionCoverage = {
  /** The applications that support it, in the order the rows are in. */
  supportedBy: ElementId[]
  /** The actors it is assigned to, likewise. */
  assignedTo: ElementId[]
  coverage: Coverage
}

const NOTHING: FunctionCoverage = { supportedBy: [], assignedTo: [], coverage: 'uncovered' }

/**
 * Coverage for every function in one pass.
 *
 * A map rather than a function per id, because a page draws every row and
 * asking per row is the shape ADR-0004 caught four times over. Ids the
 * relations name and the scope does not hold are counted anyway — a relation
 * end this scope does not have is ordinary (§5), and dropping it here would
 * make a domain's own sheet say its capabilities are uncovered.
 */
export function coverageOf(
  relations: readonly Relation[],
  elsewhere: readonly Relation[] = [],
): Map<ElementId, FunctionCoverage> {
  const found = new Map<ElementId, { supportedBy: ElementId[]; assignedTo: ElementId[] }>()
  const held = new Set(relations.map((relation) => relation.id))
  const at = (id: ElementId) => {
    const held = found.get(id) ?? { supportedBy: [], assignedTo: [] }
    found.set(id, held)
    return held
  }
  for (const relation of [...relations, ...elsewhere]) {
    // A row this scope also holds is one row, not two: `elsewhere` is a whole
    // tree's worth and the open scope's own rows are in it.
    if (elsewhere.includes(relation) && held.has(relation.id)) continue
    if (relation.type === 'supports') at(relation.targetId).supportedBy.push(relation.sourceId)
    if (relation.type === 'assigned') at(relation.targetId).assignedTo.push(relation.sourceId)
  }
  return new Map(
    [...found].map(([id, rows]) => [id, { ...rows, coverage: verdict(rows) }]),
  )
}

/** One function's answer, including for an id no row names. */
export function coverageFor(
  relations: readonly Relation[],
  id: ElementId,
): FunctionCoverage {
  return coverageOf(relations).get(id) ?? NOTHING
}

function verdict(rows: { supportedBy: ElementId[]; assignedTo: ElementId[] }): Coverage {
  if (rows.supportedBy.length > 0) return 'covered'
  return rows.assignedTo.length > 0 ? 'manual' : 'uncovered'
}
