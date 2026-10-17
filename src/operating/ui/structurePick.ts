// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What picking something on the structure lights (ADR-0036, amended 11
 * October 2026): a unit type lights the places it may sit — the types its
 * `within` names, and the organisation where it may sit at the top — the
 * types that may sit in it, and the roles it holds; a role lights the types
 * that hold it. Everything else dims, so what is left is what the pick is
 * about.
 *
 * Read off plain types, so the library's own structure, drawn the same way,
 * lights the same way. Pure, and no words.
 */
import { linesInto, linesSaid } from '../../model/operatingModel'
import type { Role, RoleId, UnitType, UnitTypeId } from '../../model/operatingModel'
import type { SitsIn } from '../../model/unitOrder'
import type { RoleLine } from './roleLines'

/** What is picked on the structure: a unit type or a role, by id. */
export type StructurePick = { readonly kind: 'unitType' | 'role'; readonly id: string }

/** How a card stands to what is picked: nothing is, it is the pick, the pick reaches it, or it does not. */
export type Look = 'plain' | 'picked' | 'lit' | 'dim'

export type PickLooks = {
  /** A unit type's card. */
  type(id: UnitTypeId): Look
  /** The organisation's own card, in lane 0. */
  readonly organisation: Look
  /** A role, wherever it is drawn: a slot on a card, or the tray. It never dims; its card does. */
  role(id: RoleId): Exclude<Look, 'dim'>
  /** A line between two places: lit where it reaches the picked type, dimmed where not. */
  line(edge: SitsIn): Exclude<Look, 'picked'>
  /** A reporting line between two roles' chips (ADR-0039 §7, amended): lit where it runs from or to the pick, dimmed where not. */
  roleLine(line: RoleLine): Exclude<Look, 'picked'>
}

const NOTHING_PICKED: PickLooks = { type: () => 'plain', organisation: 'plain', role: () => 'plain', line: () => 'plain', roleLine: () => 'plain' }

/**
 * What a pick lights: a role lights the types that hold it, the roles it
 * reports to and the roles that report to it, and the reporting lines at
 * either end of it; a type lights the lines from and to its cards' chips.
 */
export function pickLooks(types: readonly UnitType[], pick: StructurePick | undefined, roles: readonly Role[] = []): PickLooks {
  if (!pick) return NOTHING_PICKED
  if (pick.kind === 'role') {
    const holding = new Set(types.filter((type) => type.slots.some((slot) => slot.role === pick.id)).map((type) => type.id))
    const picked = roles.find((role) => role.id === pick.id)
    const related = new Set<RoleId>([
      ...linesSaid(picked?.reportsTo).flatMap((line) => (line.role === undefined ? [] : [line.role])),
      ...types.flatMap((type) => type.slots.filter((slot) => slot.role === pick.id)
        .flatMap((slot) => linesSaid(slot.reportsTo).flatMap((line) => (line.role === undefined ? [] : [line.role])))),
      ...linesInto(types, roles, pick.id).map((line) => line.from),
    ])
    related.delete(pick.id)
    return {
      type: (id) => (holding.has(id) ? 'lit' : 'dim'),
      organisation: 'dim',
      role: (id) => (id === pick.id ? 'picked' : related.has(id) ? 'lit' : 'plain'),
      line: () => 'plain',
      roleLine: (line) => (line.from.roleId === pick.id || line.to.roleId === pick.id ? 'lit' : 'dim'),
    }
  }
  const picked = types.find((type) => type.id === pick.id)
  if (!picked) return NOTHING_PICKED
  const lit = new Set([...picked.within, ...types.filter((type) => type.within.includes(picked.id)).map((type) => type.id)])
  const held = new Set(picked.slots.map((slot) => slot.role))
  return {
    type: (id) => (id === picked.id ? 'picked' : lit.has(id) ? 'lit' : 'dim'),
    organisation: picked.top === true ? 'lit' : 'dim',
    role: (id) => (held.has(id) ? 'lit' : 'plain'),
    line: (edge) => (edge.type === picked.id || edge.sitsIn === picked.id ? 'lit' : 'dim'),
    roleLine: (line) => (line.from.typeId === picked.id || line.to.typeId === picked.id ? 'lit' : 'dim'),
  }
}
