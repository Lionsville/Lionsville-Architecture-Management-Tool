// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An area as one list of one-line rows: a parent is a row with a count, a child
 * is indented, and nothing is a box in a box. Most second-level items of a real
 * sheet end there, so two looks for siblings read as disorder.
 *
 * A row knows what it holds and how much of that is answered, so a folded one
 * keeps its count, and the area's meter is the same arithmetic as its rows'.
 */
import type { DesignElement, ElementId } from '../model'
import type { SheetArea, SheetCapability } from './sheet'

export type SheetRow = {
  element: DesignElement
  /** 0 straight in the area; deeper is one step in per level. */
  depth: number
  /** The row it folds under. */
  parentId?: ElementId
  /** Something sits under it. */
  parent: boolean
  /** The capabilities at the ends of what it holds, itself where it holds nothing. */
  leaves: readonly ElementId[]
}

/** The rows of the capabilities under one heading, at their own depth, with the refinements under the row above. */
function capabilityRows(capabilities: readonly SheetCapability[], under: ElementId, base: number): SheetRow[] {
  const rows: SheetRow[] = []
  const line: SheetRow[] = []
  for (const capability of capabilities) {
    const depth = base + capability.depth - 1
    while (line.length > 0 && line[line.length - 1].depth >= depth) line.pop()
    const above = line[line.length - 1]
    const row: SheetRow = { element: capability.element, depth, parentId: above?.element.id ?? under, parent: false, leaves: [] }
    rows.push(row)
    line.push(row)
  }
  // Read backwards: a row's leaves are its children's, and they stand after it.
  const leaves = new Map<ElementId, ElementId[]>()
  for (let at = rows.length - 1; at >= 0; at -= 1) {
    const row = rows[at]
    const held = leaves.get(row.element.id)
    row.parent = held !== undefined
    row.leaves = held ?? [row.element.id]
    if (row.parentId !== undefined) leaves.set(row.parentId, [...row.leaves, ...(leaves.get(row.parentId) ?? [])])
  }
  return rows
}

/** The rows of one area, groupings first and in the sheet's own order. The area's own row is the heading, and not here. */
export function rowsOfArea(area: SheetArea): SheetRow[] {
  const rows: SheetRow[] = []
  for (const group of area.groupings) {
    const under = capabilityRows(group.capabilities, group.element.id, 1)
    rows.push({
      element: group.element, depth: 0, parentId: area.element.id, parent: true,
      leaves: under.filter((row) => row.parentId === group.element.id).flatMap((row) => row.leaves),
    }, ...under)
  }
  rows.push(...capabilityRows(area.capabilities, area.element.id, 0))
  return rows
}

/** The capabilities at the ends of an area: what its meter counts. */
export function leavesOfArea(rows: readonly SheetRow[]): ElementId[] {
  return rows.filter((row) => !row.parent).map((row) => row.element.id)
}

/** The rows left once what is folded is taken out: a folded row stays, with what is under it gone. */
export function unfoldedRows(rows: readonly SheetRow[], folded: ReadonlySet<ElementId>): SheetRow[] {
  const shown: SheetRow[] = []
  const hidden = new Set<ElementId>()
  for (const row of rows) {
    if (row.parentId !== undefined && (hidden.has(row.parentId) || folded.has(row.parentId))) hidden.add(row.element.id)
    else shown.push(row)
  }
  return shown
}

/** The row's siblings above it, as a parent to file it under: what Tab does to a row just made. */
export function rowAbove(rows: readonly SheetRow[], id: ElementId): SheetRow | undefined {
  const at = rows.findIndex((row) => row.element.id === id)
  const row = rows[at]
  if (!row) return undefined
  for (let back = at - 1; back >= 0; back -= 1) {
    if (rows[back].depth === row.depth) return rows[back]
    if (rows[back].depth < row.depth) return undefined
  }
  return undefined
}
