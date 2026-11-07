// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the Responsibilities tab shows: a part of the organisation's
 * responsibilities, picked in a tree of its groups, with only the roles that have
 * a part there; or the whole organisation; and either narrowed to one unit's
 * roles. A way of looking, written in the address, never a change to the model.
 *
 * What needs one A is read over every role and every row, whatever is kept: a
 * filter must not hide the row an audit is looking for. Letters belong to the
 * role, so a unit's grid reads what its roles do everywhere.
 *
 * Pure, and no words.
 */
import { accountableFor, inOwnOrder, raciOf, responsibilityGroups } from '../model/operatingModel'
import type { Responsibility, Role, RoleId } from '../model/operatingModel'
import { matrixOf } from './matrixView'
import type { MatrixView } from './matrixView'

/** What is looked at, as the address says it. */
export type RaciLook = {
  /** A group's name, `''` being the responsibilities in no group. Absent: the first, or a unit's all. */
  readonly part?: string
  /** One responsibility picked in the tree. */
  readonly row?: string
  readonly whole?: boolean
  readonly unit?: string
  /** An item open beside the grid or over a list. */
  readonly select?: string
  /** Only the rows that need one A. */
  readonly needs?: boolean
}

const WHOLE = '*'

export function readLook(look: string | undefined): RaciLook {
  const said = new URLSearchParams(look ?? '')
  const part = said.get('part')
  return {
    ...(part !== null && part !== WHOLE ? { part } : {}),
    ...(part === WHOLE ? { whole: true } : {}),
    ...(said.get('row') ? { row: said.get('row') as string } : {}),
    ...(said.get('unit') ? { unit: said.get('unit') as string } : {}),
    ...(said.get('select') ? { select: said.get('select') as string } : {}),
    ...(said.get('needs') ? { needs: true } : {}),
  }
}

export function writeLook(look: RaciLook): string | undefined {
  const said = new URLSearchParams()
  if (look.whole) said.set('part', WHOLE)
  else if (look.part !== undefined) said.set('part', look.part)
  if (look.row) said.set('row', look.row)
  if (look.unit) said.set('unit', look.unit)
  if (look.select) said.set('select', look.select)
  if (look.needs) said.set('needs', '1')
  return said.toString() === '' ? undefined : said.toString()
}

/** A row that is not exactly one role's A: how many it has. Nothing on a healthy row. */
export function needOf(roles: readonly Role[], responsibility: string): number | undefined {
  const count = accountableFor(roles, responsibility).length
  return count === 1 ? undefined : count
}

/** Every row of the organisation that needs one A: the count that never narrows. */
export function rowsNeeding(model: { roles: readonly Role[]; responsibilities: readonly Responsibility[] }): Responsibility[] {
  return model.responsibilities.filter((one) => needOf(model.roles, one.id) !== undefined)
}

export type RaciRow = { readonly responsibility: Responsibility; readonly group: string }

export type RaciGrid = {
  /** The roles drawn, in the view's order: those with a part, and any added by hand. */
  readonly columns: readonly Role[]
  /** The roles with no part in what is shown, folded into one column. */
  readonly folded: readonly Role[]
  readonly rows: readonly RaciRow[]
  /** Group headings over the rows: in the whole organisation and under a unit; a part is one group already. */
  readonly headings: boolean
}

type Lists = { roles: readonly Role[]; responsibilities: readonly Responsibility[] }

/**
 * The grid the look leaves. `unitRoles` are the roles of the unit looked at;
 * `added` the roles somebody took out of the fold for this view.
 */
export function raciGrid(model: Lists, look: RaciLook, view: MatrixView, unitRoles: readonly RoleId[] | undefined, added: readonly RoleId[]): RaciGrid {
  const { roles, groups } = matrixOf(model, view)
  const inUnit = unitRoles ? roles.filter((role) => unitRoles.includes(role.id)) : roles
  let rows: RaciRow[] = groups.flatMap(({ group, responsibilities }) => responsibilities.map((responsibility) => ({ responsibility, group })))
  if (unitRoles) rows = rows.filter(({ responsibility }) => inUnit.some((role) => raciOf(role, responsibility.id) !== undefined))
  if (look.needs) rows = rows.filter(({ responsibility }) => needOf(model.roles, responsibility.id) !== undefined)
  else if (look.row) rows = rows.filter(({ responsibility }) => responsibility.id === look.row)
  else if (!look.whole && look.part !== undefined) rows = rows.filter(({ group }) => group === look.part)
  else if (!look.whole && !unitRoles) rows = rows.filter(({ group }) => group === rows[0]?.group)
  const hasPart = (role: Role) => rows.some(({ responsibility }) => raciOf(role, responsibility.id) !== undefined)
  const narrowed = view.roles.length > 0
  const candidates = unitRoles ? inUnit : roles
  return {
    columns: candidates.filter((role) => narrowed || hasPart(role) || added.includes(role.id)),
    folded: narrowed ? [] : candidates.filter((role) => !hasPart(role) && !added.includes(role.id)),
    rows,
    headings: look.whole === true || look.needs === true || (unitRoles !== undefined && look.part === undefined && look.row === undefined),
  }
}

export type RaciPart = {
  readonly group: string
  readonly responsibilities: readonly Responsibility[]
  /** How many below it need one A. */
  readonly needing: number
}

/** The tree: the groups in their order, each with its rows and what needs one A below it. */
export function raciParts(model: Lists, unitRoles?: readonly RoleId[]): RaciPart[] {
  const inUnit = unitRoles ? model.roles.filter((role) => unitRoles.includes(role.id)) : undefined
  return responsibilityGroups(inOwnOrder(model.responsibilities)).map(({ group, responsibilities }) => {
    const kept = inUnit ? responsibilities.filter((one) => inUnit.some((role) => raciOf(role, one.id) !== undefined)) : responsibilities
    return { group, responsibilities: kept, needing: kept.filter((one) => needOf(model.roles, one.id) !== undefined).length }
  })
}

/** The cells of a CSV: quoted where a comma, a quote or a line would break it. */
function cell(text: string): string {
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** A grid as a spreadsheet takes it: a row per responsibility, a column per role, and what it needs last. */
export function raciCsv(roles: readonly Role[], rows: readonly RaciRow[], words: { group: string; responsibility: string; needs: string; need: (count: number) => string; noGroup: string }, allRoles: readonly Role[]): string {
  const lines = [[words.group, words.responsibility, ...roles.map((role) => role.name), words.needs]]
  for (const { responsibility, group } of rows) {
    const need = needOf(allRoles, responsibility.id)
    lines.push([group || words.noGroup, responsibility.name, ...roles.map((role) => raciOf(role, responsibility.id) ?? ''), need === undefined ? '' : words.need(need)])
  }
  return `${lines.map((line) => line.map(cell).join(',')).join('\n')}\n`
}
