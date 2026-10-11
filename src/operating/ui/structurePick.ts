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
import type { RoleId, UnitType, UnitTypeId } from '../../model/operatingModel'
import type { SitsIn } from '../../model/unitOrder'

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
}

const NOTHING_PICKED: PickLooks = { type: () => 'plain', organisation: 'plain', role: () => 'plain', line: () => 'plain' }

export function pickLooks(types: readonly UnitType[], pick: StructurePick | undefined): PickLooks {
  if (!pick) return NOTHING_PICKED
  if (pick.kind === 'role') {
    const holding = new Set(types.filter((type) => type.slots.some((slot) => slot.role === pick.id)).map((type) => type.id))
    return {
      type: (id) => (holding.has(id) ? 'lit' : 'dim'),
      organisation: 'dim',
      role: (id) => (id === pick.id ? 'picked' : 'plain'),
      line: () => 'plain',
    }
  }
  const picked = types.find((type) => type.id === pick.id)
  if (!picked) return NOTHING_PICKED
  const lit = new Set([...picked.within, ...types.filter((type) => type.within.includes(picked.id)).map((type) => type.id)])
  const roles = new Set(picked.slots.map((slot) => slot.role))
  return {
    type: (id) => (id === picked.id ? 'picked' : lit.has(id) ? 'lit' : 'dim'),
    organisation: picked.top === true ? 'lit' : 'dim',
    role: (id) => (roles.has(id) ? 'lit' : 'plain'),
    line: (edge) => (edge.type === picked.id || edge.sitsIn === picked.id ? 'lit' : 'dim'),
  }
}
