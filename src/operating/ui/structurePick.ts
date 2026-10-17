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

/**
 * What is picked on the structure: a unit type or a role, by id. A role
 * picked by its chip on a type's card says which card (`inType`); one picked
 * anywhere else — the tray, the matrix, a link — says none.
 */
export type StructurePick = { readonly kind: 'unitType' | 'role'; readonly id: string; readonly inType?: UnitTypeId }

/** How a card stands to what is picked: nothing is, it is the pick, the pick reaches it, or it does not. */
export type Look = 'plain' | 'picked' | 'lit' | 'dim'

export type PickLooks = {
  /** A unit type's card. */
  type(id: UnitTypeId): Look
  /** The organisation's own card, in lane 0. */
  readonly organisation: Look
  /** A role, wherever it is drawn: a slot on a card (`typeId`), or the tray. It never dims; its card does. */
  role(id: RoleId, typeId?: UnitTypeId): Exclude<Look, 'dim'>
  /** A line between two places: lit where it reaches the picked type, dimmed where not. */
  line(edge: SitsIn): Exclude<Look, 'picked'>
  /**
   * The reporting lines to draw (ADR-0039 §7, amended 17 October 2026): only
   * a role's, and only while it is picked. Picked by its chip on a card, the
   * lines from and into that chip; picked anywhere else, its lines on every
   * card that holds it. Nothing picked, or a type, draws none: every line at
   * once is more than a structure can carry.
   */
  readonly roleLines: readonly RoleLine[]
}

const NO_LINES: readonly RoleLine[] = []
const NOTHING_PICKED: PickLooks = { type: () => 'plain', organisation: 'plain', role: () => 'plain', line: () => 'plain', roleLines: NO_LINES }

/** Whether a line has an end at a role's chip — on one card, or on any where no card is said. */
const endsAt = (line: RoleLine, roleId: RoleId, typeId: UnitTypeId | undefined) =>
  [line.from, line.to].some((end) => end.roleId === roleId && (typeId === undefined || end.typeId === typeId))

/**
 * What a pick lights: a role lights the types that hold it, the roles it
 * reports to and the roles that report to it, and draws its reporting lines;
 * picked on one card, it lights that card and the chips its lines reach.
 */
export function pickLooks(types: readonly UnitType[], pick: StructurePick | undefined, roles: readonly Role[] = [], lines: readonly RoleLine[] = NO_LINES): PickLooks {
  if (!pick) return NOTHING_PICKED
  if (pick.kind === 'role' && pick.inType !== undefined) return chipLooks(pick.id, pick.inType, lines)
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
      roleLines: lines.filter((line) => endsAt(line, pick.id, undefined)),
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
    roleLines: NO_LINES,
  }
}

/** A role picked by its chip on one card: that card, and the cards and chips at the far end of the lines from and into that chip. */
function chipLooks(roleId: RoleId, typeId: UnitTypeId, lines: readonly RoleLine[]): PickLooks {
  const drawn = lines.filter((line) => endsAt(line, roleId, typeId))
  const far = drawn.map((line) => (line.from.roleId === roleId && line.from.typeId === typeId ? line.to : line.from))
  const cards = new Set([typeId, ...far.map((end) => end.typeId)])
  const chips = new Set(far.map((end) => `${end.typeId}/${end.roleId}`))
  return {
    type: (id) => (id === typeId ? 'picked' : cards.has(id) ? 'lit' : 'dim'),
    organisation: 'dim',
    role: (id, card) => (id === roleId && card === typeId ? 'picked' : chips.has(`${card}/${id}`) ? 'lit' : 'plain'),
    line: () => 'plain',
    roleLines: drawn,
  }
}
