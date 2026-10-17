// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The reporting lines drawn on the structure (ADR-0039 §7, amended 17
 * October 2026): from a role's chip on a unit type's card to the chip of the
 * role it reports to, on the card where a unit of that type would find it.
 *
 * The structure draws types, not units, so a line is drawn to every card a
 * unit's line could land on: the card itself where the line says *in the
 * same unit*; else the types above it in the structure — the ones its
 * `within` reaches, nearest first — that hold the target role, where any
 * does; else every type that holds it, which is what a unit of this type
 * would be left to choose from. A card that sits nowhere draws none: it
 * waits in the tray, with nothing to draw a line to.
 *
 * Where a line runs is measured from the chips as they ended up
 * (`StructureLanes`), never stored. Pure, and no words.
 */
import { linesHolding } from '../../model/operatingModel'
import type { LineKind, Role, RoleId, UnitType, UnitTypeId } from '../../model/operatingModel'
import type { UnitTypeLanes } from '../../model/unitOrder'
import type { CardBox } from './laneLines'

/** One end of a line on the structure: a role's chip on a type's card. */
export type RoleLineEnd = { readonly typeId: UnitTypeId; readonly roleId: RoleId }

export type RoleLine = {
  readonly key: string
  readonly kind: LineKind
  /** Where it was said: on the role, for every type that holds it, or on this type's slot. */
  readonly source: 'role' | 'type'
  /** Both ends on one card. */
  readonly within: boolean
  /** Drawn to one of several cards, none above: a unit of the type would have to say which. */
  readonly ambiguous: boolean
  readonly from: RoleLineEnd
  readonly to: RoleLineEnd
}

/** The types a type sits in, transitively, nearest first and each once. */
function above(types: readonly UnitType[], typeId: UnitTypeId): UnitTypeId[] {
  const byId = new Map(types.map((type) => [type.id, type]))
  const found: UnitTypeId[] = []
  const queue = [...(byId.get(typeId)?.within ?? [])]
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    if (next === typeId || found.includes(next)) continue
    found.push(next)
    queue.push(...(byId.get(next)?.within ?? []))
  }
  return found
}

/** The lines to draw over the structure: from every slot of every type drawn in a lane, to where each lands. */
export function roleLines(structure: UnitTypeLanes, types: readonly UnitType[], roles: readonly Role[]): RoleLine[] {
  const byRole = new Map(roles.map((role) => [role.id, role]))
  const drawn = (id: UnitTypeId) => structure.laneOf.has(id)
  const holding = (roleId: RoleId) => types.filter((type) => drawn(type.id) && type.slots.some((slot) => slot.role === roleId)).map((type) => type.id)
  const lines: RoleLine[] = []
  for (const type of types) {
    if (!drawn(type.id)) continue
    for (const slot of type.slots) {
      for (const said of linesHolding(slot, byRole.get(slot.role))) {
        const has = holding(said.role)
        let targets: UnitTypeId[]
        let ambiguous = false
        if (said.within) targets = has.includes(type.id) && said.role !== slot.role ? [type.id] : []
        else {
          const up = above(types, type.id).filter((id) => has.includes(id))
          const anywhere = has.filter((id) => id !== type.id || said.role !== slot.role)
          targets = up.length ? up : anywhere
          ambiguous = up.length === 0 && anywhere.length > 1
        }
        for (const target of targets) {
          lines.push({
            key: `${type.id}/${slot.role}/${said.kind}>${target}`, kind: said.kind, source: said.source, within: target === type.id, ambiguous,
            from: { typeId: type.id, roleId: slot.role }, to: { typeId: target, roleId: said.role },
          })
        }
      }
    }
  }
  return lines
}

/** How a chip is found on the stage: a role's on a type's card. */
export type ChipOf = (end: RoleLineEnd) => CardBox | undefined

/** A line's SVG path, from the chips as they ended up: out of the near sides, a bulge beside the card where both ends are on it. */
export function roleLinePath(from: CardBox, to: CardBox, within: boolean): string {
  const y1 = (from.top + from.bottom) / 2
  const y2 = (to.top + to.bottom) / 2
  if (within) {
    const x = Math.max(from.right, to.right)
    return `M${from.right},${y1} C${x + 16},${y1} ${x + 16},${y2} ${to.right},${y2}`
  }
  if (to.left >= from.right) {
    const mid = (from.right + to.left) / 2
    return `M${from.right},${y1} C${mid},${y1} ${mid},${y2} ${to.left},${y2}`
  }
  if (from.left >= to.right) {
    const mid = (from.left + to.right) / 2
    return `M${from.left},${y1} C${mid},${y1} ${mid},${y2} ${to.right},${y2}`
  }
  // One above the other: out of the right sides and back.
  const x = Math.max(from.right, to.right) + 24
  return `M${from.right},${y1} C${x},${y1} ${x},${y2} ${to.right},${y2}`
}

/** The lines with their paths, those whose chips are not on the stage left out. */
export function roleLinePaths(lines: readonly RoleLine[], chipOf: ChipOf): (RoleLine & { d: string; x: number; y: number })[] {
  return lines.flatMap((line) => {
    const from = chipOf(line.from)
    const to = chipOf(line.to)
    if (!from || !to) return []
    const d = roleLinePath(from, to, line.within)
    const end = line.within || !(to.left >= from.right) && !(from.left >= to.right) ? { x: to.right, y: (to.top + to.bottom) / 2 }
      : to.left >= from.right ? { x: to.left, y: (to.top + to.bottom) / 2 } : { x: to.right, y: (to.top + to.bottom) / 2 }
    return [{ ...line, d, ...end }]
  })
}
