// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The model as sentences: how many a slot holds, and where its holders report.
 * Defaults read as plain text, and only what this level changes speaks up.
 */
import { linesSaid } from '../../model/operatingModel'
import type { LineKind, ReportsTo, Role, RoleSlot } from '../../model/operatingModel'
import type { Translate } from '../../i18n'

export function howManyWords(slot: Pick<RoleSlot, 'min' | 'max'>, t: Translate): string {
  const { min, max } = slot
  if (max === undefined) return min === 0 ? t('operating.manyAny') : t('operating.manyAtLeast', { count: min })
  if (min === max) return t('operating.manyExactly', { count: min })
  return min === 0 ? t('operating.manyAtMost', { count: max }) : t('operating.manyBetween', { min, max })
}

export const roleNamed = (roles: readonly Pick<Role, 'id' | 'name'>[], id: string | undefined): string => roles.find((role) => role.id === id)?.name ?? id ?? ''

/** A line as a few words: *to Product owner*, *by nesting*. */
export function lineWords(line: ReportsTo | undefined, roles: readonly Pick<Role, 'id' | 'name'>[], t: Translate): string {
  return line?.role === undefined ? t('operating.byNesting') : t('operating.toRole', { role: roleNamed(roles, line.role) })
}

export type SlotReading = {
  /** The line that holds for the slot's holders, of this kind. */
  readonly line: ReportsTo | undefined
  /** This level says it, rather than the role. */
  readonly own: boolean
}

export function slotReading(slot: Pick<RoleSlot, 'reportsTo'>, role: Pick<Role, 'reportsTo'> | undefined, kind: LineKind): SlotReading {
  const said = linesSaid(slot.reportsTo).find((one) => one.kind === kind)
  if (said) {
    const own = linesSaid(role?.reportsTo).find((one) => one.kind === kind)
    return { line: said, own: own?.role !== said.role || own?.within !== said.within }
  }
  return { line: linesSaid(role?.reportsTo).find((one) => one.kind === kind), own: false }
}

/** A role's letters counted: *2 A, 1 R*. */
export function partWords(duties: readonly { raci: string }[]): string {
  return ['A', 'R', 'C', 'I'].flatMap((letter) => {
    const count = duties.filter((duty) => duty.raci === letter).length
    return count > 0 ? [`${count} ${letter}`] : []
  }).join(', ')
}
