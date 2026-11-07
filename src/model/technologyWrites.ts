// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One use, or where something runs, said as commands on the scope that keeps
 * the application (ADR-0012 §7, ADR-0020): the technology landscape is usually
 * open on the platform scope and the application is a landscape's, so the row
 * belongs there and not in the scope the person happens to be reading.
 */
import type { Command } from './commands'
import type { DesignElement, ElementId, Relation } from './types'

type Held = { elements: readonly DesignElement[]; relations: readonly Relation[] }

/** Say or take back that an application uses one thing. Nothing, where that is already so. */
export function useCommands(
  held: Held, make: { rowId(): string; standIn?: DesignElement },
  applicationId: ElementId, targetId: ElementId, on: boolean,
): Command[] {
  const rows = held.relations.filter((row) => row.type === 'uses' && row.sourceId === applicationId && row.targetId === targetId)
  if (!on) return rows.map((row) => ({ type: 'relation.delete', id: row.id }))
  if (rows.length > 0) return []
  return [
    ...arrives(held, make.standIn, targetId),
    { type: 'relation.create', relation: { id: make.rowId(), type: 'uses', sourceId: applicationId, targetId } },
  ]
}

/** Say where an application runs, moving the row it has, or take the row away. */
export function hostCommands(
  held: Held, make: { rowId(): string; standIn?: DesignElement },
  applicationId: ElementId, platformId: ElementId | undefined,
): Command[] {
  const row = held.relations.find((one) => one.type === 'hostedOn' && one.sourceId === applicationId)
  if (platformId === undefined) return row ? [{ type: 'relation.delete', id: row.id }] : []
  if (row?.targetId === platformId) return []
  return [
    ...arrives(held, make.standIn, platformId),
    row
      ? { type: 'relation.update', id: row.id, patch: { targetId: platformId } }
      : { type: 'relation.create', relation: { id: make.rowId(), type: 'hostedOn', sourceId: applicationId, targetId: platformId } },
  ]
}

function arrives(held: Held, standIn: DesignElement | undefined, id: ElementId): Command[] {
  return standIn?.id === id && !held.elements.some((one) => one.id === id) ? [{ type: 'element.create', element: standIn }] : []
}
