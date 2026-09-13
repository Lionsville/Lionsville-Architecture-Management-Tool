/**
 * The enterprise map: functions against the applications that support them
 * (ADR-0012 §6, §9).
 *
 * A `map` is the second laid-out view, and it is laid out for the same reason
 * a sheet is: everything on it is arithmetic over the function tree and the
 * `supports` and `assigned` rows, so the page is *computed* and there is
 * nothing to drag. This file is that computation, in rows and columns rather
 * than in pixels — a page turns a row into a line of a table and a column
 * into a heading; nothing here has an opinion about how wide one is.
 *
 * What it answers, per function: **which applications support it, rolled up**
 * — a grouping's marks are the union of its capabilities', and an area's the
 * union of everything under it, so a reader sees at the top of a section what
 * the section as a whole leans on and, under it, which capability leans on
 * what. *People* is one column rather than one per actor: the map is about
 * which system covers what, and "somebody does this by hand" is one answer
 * (`coverage.ts`) rather than an organisation chart. *Uncovered* is the gap,
 * counted on the leaves — a grouping with one uncovered capability is a
 * grouping with a gap, not a grouping that is uncovered.
 *
 * **The columns are the applications the rows name**, and not every
 * application the scope holds: a map of a hundred systems and forty
 * capabilities would be a page that is mostly empty, and an application that
 * supports nothing is the register's business rather than the map's. They are
 * ordered by first appearance down the rows, so a tidy tree reads as a
 * diagonal, and grouped by where they are owned — a landscape's systems under
 * the landscape's name — because "across domains" is what the map exists to
 * show and a column that does not say whose it is has said half.
 *
 * **What the rows name, this scope may not hold.** The applications that
 * support the organisation's capabilities live in a landscape's model
 * (ADR-0012 §2), so the rows arrive as a second list the way `sheetPage`
 * takes them, and the names come from a `describe` the caller hands in —
 * `business` may not import `projects`, and the index is what knows an id's
 * name and owner. An id nobody can describe is still a column, said by its id
 * and marked as unknown: a dangling end is a fact to draw, never one to drop.
 *
 * **Time is the day the map shows.** A row may carry a window (§5), and a map
 * with `asOf` counts the rows live on that day, so "supported by the WMS from
 * March" is a mark on the March map and a gap on February's. With no day
 * given, every row counts — which is what a sheet does, and what a map with
 * nothing dated should do.
 */
import type { DesignDiagram, DesignElement, DesignModel, ElementId, ElementKind, Relation } from '../model'
import { relationLiveAt } from '../model/lifecycle'
import { coverageOf, type Coverage, type FunctionCoverage } from './coverage'
import { rootsOfKind } from './sheetDiagram'
import { inOrder } from './tree'

/** What the map is told about an id it may not hold: a name, and whose it is. */
export type MapDescription = {
  name: string
  kind?: ElementKind
  /**
   * What to call the scope that answers for it, where that is not the scope
   * the map is drawn in. Absent is "this scope's own", and columns with the
   * same answer are grouped under it.
   */
  where?: string
}

export type MapDescribe = (id: ElementId) => MapDescription | undefined

export type MapRow = {
  element: DesignElement
  /** 0 is a section (an area); deeper is drawn one step in per level. */
  depth: number
  /** Nothing under it: its marks are its own, and the gap is counted here. */
  leaf: boolean
  /** The applications supporting it or anything under it, deduplicated, in the order the rows are in. */
  supportedBy: ElementId[]
  /** The actors it, or anything under it, is assigned to — likewise. */
  assignedTo: ElementId[]
  /** The verdict over the sets above: a rolled-up row is covered when anything under it is. */
  coverage: Coverage
  /** Uncovered leaves under it, itself included when it is one. */
  gaps: number
}

export type MapColumn = {
  id: ElementId
  name: string
  /** As {@link MapDescription.where}. */
  where?: string
  /** Somebody could say what it is. False is a row naming an id nobody in the tree defines. */
  known: boolean
}

/** The columns owned in one place, drawn under one heading. */
export type MapColumnGroup = {
  where?: string
  columns: MapColumn[]
}

export type LaidOutMap = {
  rows: MapRow[]
  /** The columns, grouped by owner in order of first appearance; `columns` is the same list flat. */
  groups: MapColumnGroup[]
  columns: MapColumn[]
  /** Over the leaves — the capabilities — and not the sections above them. */
  counts: { covered: number; manual: number; uncovered: number }
}

export type MapOptions = {
  /** Rows written in another scope of the same organisation (ADR-0012 §2); see `sheetPage`. */
  elsewhere?: readonly Relation[]
  /** Names and owners for ids the model does not hold, or holds only as a stand-in. */
  describe?: MapDescribe
  /**
   * The day to count rows on, when the map itself names none. Absent with no
   * `asOf` counts every row regardless of its window.
   */
  today?: string
}

const UNCOVERED: FunctionCoverage = { supportedBy: [], assignedTo: [], coverage: 'uncovered' }

/**
 * The page, from the model and the map that says what it is of.
 *
 * One pass over the rows, one over the functions, and a walk of each drawn
 * section — a page that asked per row would walk the model once per
 * capability, which is the shape ADR-0004 keeps catching.
 */
export function mapPage(
  model: Pick<DesignModel, 'elements' | 'relations'>,
  map: Pick<DesignDiagram, 'areas' | 'asOf'>,
  options: MapOptions = {},
): LaidOutMap {
  const { elements } = model
  const byId = new Map(elements.map((element) => [element.id, element]))
  const day = map.asOf ?? options.today
  const live = (rows: readonly Relation[]) => (day === undefined
    ? rows
    : rows.filter((row) => relationLiveAt(row, day)))
  const coverage = coverageOf(live(model.relations), live(options.elsewhere ?? []))

  const functions = elements.filter((element) => element.kind === 'function')
  // The children of every function once, rather than a filter over the whole
  // list per node: a tree of a few thousand capabilities is walked once.
  const children = new Map<ElementId | undefined, DesignElement[]>()
  for (const element of functions) {
    const held = children.get(element.parentId) ?? []
    held.push(element)
    children.set(element.parentId, held)
  }
  const childrenOf = (id: ElementId) => inOrder(children.get(id) ?? [])

  const rows: MapRow[] = []
  const seen = new Set<ElementId>()
  /** Post-order under the hood, pre-order in the list: a section's row is pushed first and filled last. */
  const walk = (element: DesignElement, depth: number): MapRow => {
    seen.add(element.id)
    const own = coverage.get(element.id) ?? UNCOVERED
    const row: MapRow = {
      element, depth, leaf: true,
      supportedBy: [...own.supportedBy], assignedTo: [...own.assignedTo],
      coverage: own.coverage, gaps: 0,
    }
    rows.push(row)
    const below = childrenOf(element.id).filter((child) => !seen.has(child.id))
    if (below.length === 0) {
      row.gaps = own.coverage === 'uncovered' ? 1 : 0
      return row
    }
    row.leaf = false
    for (const child of below) {
      const under = walk(child, depth + 1)
      for (const id of under.supportedBy) if (!row.supportedBy.includes(id)) row.supportedBy.push(id)
      for (const id of under.assignedTo) if (!row.assignedTo.includes(id)) row.assignedTo.push(id)
      row.gaps += under.gaps
    }
    row.coverage = row.supportedBy.length > 0 ? 'covered' : row.assignedTo.length > 0 ? 'manual' : 'uncovered'
    return row
  }

  const drawn = map.areas ?? rootsOfKind(elements, 'function').map((element) => element.id)
  for (const id of drawn) {
    const root = byId.get(id)
    if (root && root.kind === 'function' && !seen.has(root.id)) walk(root, 0)
  }

  const columns = columnsOf(rows, byId, options.describe)
  const groups: MapColumnGroup[] = []
  for (const column of columns) {
    const group = groups.find((held) => held.where === column.where)
    if (group) group.columns.push(column)
    else groups.push({ ...(column.where !== undefined ? { where: column.where } : {}), columns: [column] })
  }

  const counts = { covered: 0, manual: 0, uncovered: 0 }
  for (const row of rows) if (row.leaf) counts[row.coverage] += 1

  return { rows, groups, columns, counts }
}

/** The applications the rows name, by first appearance, each said by whoever can say it. */
function columnsOf(
  rows: readonly MapRow[],
  byId: ReadonlyMap<ElementId, DesignElement>,
  describe: MapDescribe | undefined,
): MapColumn[] {
  const found: MapColumn[] = []
  const held = new Set<ElementId>()
  for (const row of rows) {
    // Leaves rather than sections: a section's set is the union of its
    // leaves', so walking it too would say every column twice.
    if (!row.leaf) continue
    for (const id of row.supportedBy) {
      if (held.has(id)) continue
      held.add(id)
      // The caller's description first, because it knows the master's name
      // where this scope holds a stand-in whose cache may have drifted.
      const said = describe?.(id)
      const own = byId.get(id)
      if (said) {
        found.push({ id, name: said.name, ...(said.where !== undefined ? { where: said.where } : {}), known: true })
      } else if (own) {
        found.push({ id, name: own.name, known: true })
      } else {
        found.push({ id, name: id, known: false })
      }
    }
  }
  return found
}

/**
 * A fresh map over what the scope already holds.
 *
 * No `areas`: absent draws every function root in the model's own order, and
 * a map that named them all would stop drawing an area made after it — a
 * curated order is a decision somebody makes on the page afterwards. `id` and
 * `name` come from outside, as the sheet seed's do.
 */
export function seedMap(make: { id: string; name: string }): DesignDiagram {
  return {
    id: make.id,
    kind: 'map',
    name: make.name,
    // Nothing is ON a map the way a card is on a board: what it draws is the
    // tree and the rows, and a member row would be a second place to keep
    // the same fact.
    members: [],
    geometry: { nodes: [] },
  }
}
