// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * How the Responsibilities tab is looked at: which roles and which groups it
 * keeps, and in what order. A way of looking, never a change to the model —
 * the order the roles and responsibilities were added in is kept as it is.
 */
import { raciOf, responsibilityGroups } from '../model/operatingModel'
import type { Responsibility, Role, RoleId } from '../model/operatingModel'

export type MatrixOrder = 'name' | 'added'

export type MatrixView = {
  /** The roles kept, as columns; none picked keeps them all. */
  roles: readonly RoleId[]
  /** The groups kept, `''` being the responsibilities in no group; none picked keeps them all. */
  groups: readonly string[]
  order: MatrixOrder
}

export const ALL_OF_THE_MATRIX: MatrixView = {
  roles: [],
  groups: [],
  order: 'name',
}

/** A role as its column is headed. */
export const roleHeading = (role: Pick<Role, 'name' | 'short'>): string => role.short || role.name

const collator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
})

/**
 * The matrix as the view leaves it. Roles picked keep their columns and the
 * responsibilities any of them has a part in; groups picked keep their rows.
 * By name, the columns go by their heading and the groups and the rows within
 * each by name, the ungrouped last as always; as added, as the model holds them.
 */
export function matrixOf(
  model: {
    roles: readonly Role[]
    responsibilities: readonly Responsibility[]
  },
  view: MatrixView,
): {
  roles: Role[]
  groups: { group: string; responsibilities: Responsibility[] }[]
} {
  // A role or a group picked and since gone keeps nothing out.
  const pickedRoles = new Set(view.roles.filter((id) => model.roles.some((role) => role.id === id)))
  const pickedGroups = new Set(view.groups.filter((group) => groupsOf(model.responsibilities).includes(group)))
  const byName = view.order === 'name'
  let roles = pickedRoles.size ? model.roles.filter((role) => pickedRoles.has(role.id)) : [...model.roles]
  const responsibilities = model.responsibilities.filter(
    (responsibility) =>
      (pickedGroups.size === 0 || pickedGroups.has(responsibility.group?.trim() ?? '')) &&
      (pickedRoles.size === 0 || roles.some((role) => raciOf(role, responsibility.id) !== undefined)),
  )
  if (byName) roles = roles.sort((a, b) => collator.compare(roleHeading(a), roleHeading(b)))
  let groups = responsibilityGroups(responsibilities)
  if (byName) {
    groups = groups
      .map(({ group, responsibilities: held }) => ({
        group,
        responsibilities: [...held].sort((a, b) => collator.compare(a.name, b.name)),
      }))
      .sort((a, b) => (a.group === '' ? 1 : b.group === '' ? -1 : collator.compare(a.group, b.group)))
  }
  return { roles, groups }
}

/** Every group the responsibilities are in, by name, and `''` last when some are in none. */
export function groupsOf(responsibilities: readonly Responsibility[]): string[] {
  const named = [...new Set(responsibilities.map((responsibility) => responsibility.group?.trim() ?? '').filter(Boolean))].sort(collator.compare)
  return responsibilities.some((responsibility) => !responsibility.group?.trim()) ? [...named, ''] : named
}
