/**
 * What an agent is told when it asks about the enterprise map.
 *
 * The sheet's sibling (`inspectSheet.ts`), and for the same reason: a map has
 * no geometry (ADR-0012 §6), so the report is the laid-out page — the rows in
 * tree order with what each leans on, rolled up, and the columns the rows
 * name — and never a pixel. Bounded in the two places the page grows.
 *
 * Over the scope's own model, as the sheet's report is: the rows another
 * scope wrote and the names of the systems it holds are the index's, which
 * this module may not reach, and threading them through is step 13's — the
 * agent at every scope. Until then a map at the organisation reads through a
 * person's screen, and through this tool as the scope's own rows say.
 */
import { mapPage } from '../business'
import type { Coverage } from '../business'
import type { Diagram, Model } from '../model/normalised'
import { toArrays } from '../model/normalised'
import type { ElementId } from '../model/types'

/** How many rows and columns the report carries. The totals beside them are whole. */
export const MAP_LIMIT = 200

export type MapReport = {
  diagramId: string
  name: string
  kind: 'map'
  /** The applications the rows name, in the order the page draws them. */
  columns: { total: number; some: { id: ElementId; name: string; known: boolean }[] }
  rows: {
    total: number
    some: {
      id: ElementId
      name: string
      depth: number
      /** Nothing under it: the marks are its own and the gap is counted here. */
      leaf: boolean
      /** Rolled up on a section: everything under it. */
      supportedBy: ElementId[]
      assignedTo: ElementId[]
      coverage: Coverage
      gaps: number
    }[]
  }
  /** Over the leaves — the capabilities. */
  counts: { covered: number; manual: number; uncovered: number }
}

export function inspectMap(model: Model, diagram: Diagram, limit = MAP_LIMIT, today?: string): MapReport {
  const page = mapPage(toArrays(model), diagram, today !== undefined ? { today } : {})
  return {
    diagramId: diagram.id,
    name: diagram.name,
    kind: 'map',
    columns: {
      total: page.columns.length,
      some: page.columns.slice(0, limit).map(({ id, name, known }) => ({ id, name, known })),
    },
    rows: {
      total: page.rows.length,
      some: page.rows.slice(0, limit).map((row) => ({
        id: row.element.id,
        name: row.element.name,
        depth: row.depth,
        leaf: row.leaf,
        supportedBy: row.supportedBy,
        assignedTo: row.assignedTo,
        coverage: row.coverage,
        gaps: row.gaps,
      })),
    },
    counts: page.counts,
  }
}
