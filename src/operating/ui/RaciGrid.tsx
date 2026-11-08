// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The crossing of responsibilities and roles, on the kit's Matrix: a press
 * selects, a letter or the picker writes, one set is one step. A filled A and a
 * soft R; the letter itself says which, so it is never colour alone. What a row
 * needs stands beside its name and is empty on a healthy row.
 */
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { accountableFor, raciOf, RACI_LETTERS } from '../../model/operatingModel'
import type { Raci, Role } from '../../model/operatingModel'
import type { Command } from '../../model/commands'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { Matrix } from '../../widgets/kit/Matrix'
import type { MatrixCell, MatrixPick, MatrixRowDef } from '../../widgets/kit/Matrix'
import { cycleRaci, setRaci } from '../edit'
import { needOf } from '../raciView'
import type { RaciGrid as Grid } from '../raciView'
import type { OrganisationFacts, UnitFact } from '../organisationFacts'

const WORD: Record<Raci, 'operating.raci.R' | 'operating.raci.A' | 'operating.raci.C' | 'operating.raci.I'> = {
  R: 'operating.raci.R', A: 'operating.raci.A', C: 'operating.raci.C', I: 'operating.raci.I',
}

export const needWords = (count: number, t: Translate): string => (count === 0 ? t('operating.needNone') : t('operating.needMany', { count }))

const GROUP = (name: string) => `group:${name}`

export function RaciGrid({ grid, allRoles, readOnly, dispatch, pick, onPick, litRole, onOpenRole, onOpenRow, rotateNames, unit, facts, label, onFoldNone }: {
  grid: Grid; allRoles: readonly Role[]; readOnly: boolean; dispatch(command: Command): void
  pick: MatrixPick | null; onPick(pick: MatrixPick | null): void
  litRole: string | undefined; onOpenRole(id: string): void; onOpenRow(id: string): void
  /** Many roles turn their names on their side rather than shorten them: a short name left most of the row empty. */
  rotateNames: boolean
  unit: UnitFact | undefined; facts: OrganisationFacts | undefined; label: string
  /** Told when the + column of roles with no part is opened or folded again. */
  onFoldNone?: (folded: boolean) => void
}) {
  const { t } = useStrings()
  const roles = useMemo(() => new Map(allRoles.map((role) => [role.id, role])), [allRoles])
  const columns = useMemo(() => [
    ...grid.columns.map((role) => ({
      id: role.id, label: role.name,
      ...(unit ? { under: <HolderWords holders={facts?.holdersIn(unit.id, role.id) ?? []} t={t} /> } : {}),
    })),
    ...grid.folded.map((role) => ({ id: role.id, label: role.name, group: 'none' })),
  ], [grid, unit, facts, t])
  const rows = useMemo<MatrixRowDef[]>(() => {
    const out: MatrixRowDef[] = []
    let last: string | undefined
    for (const { responsibility, group } of grid.rows) {
      if (grid.headings && group !== last) {
        out.push({ id: GROUP(group), label: group || t('operating.noGroup'), heading: true })
        last = group
      }
      out.push({ id: responsibility.id, label: responsibility.name, ...(grid.headings ? { parent: GROUP(group) } : {}) })
    }
    return out
  }, [grid, t])
  const cellOf = (row: string, column: string): MatrixCell | null => {
    if (row.startsWith('group:')) return null
    const role = roles.get(column)
    const raci = role && raciOf(role, row)
    if (!raci) return null
    return { show: raci, meaning: t(WORD[raci]), tone: raci === 'A' ? 'solid' : raci === 'R' ? 'soft' : 'plain' }
  }
  const write = (at: MatrixPick, raci: Raci | undefined) => {
    const role = roles.get(at.column)
    if (role && !at.row.startsWith('group:')) dispatch(setRaci(role, at.row, raci))
  }
  const answer = unit
    ? { label: t('operating.aElsewhere'), of: (row: string): ReactNode => elsewhere(row, unit, allRoles, t) }
    : { label: t('operating.needs'), of: (row: string): ReactNode => needOfRow(row, allRoles, t) }
  return (
    <>
      <Matrix
        label={label} rowHeading={t('operating.responsibility')} rows={rows} columns={columns} wrapRows rotateHeads={rotateNames}
        columnGroups={grid.folded.length ? [{ id: 'none', label: t('operating.noPartColumn'), short: `+${grid.folded.length}` }] : []}
        defaultFoldedGroups={['none']} cellOf={cellOf} answer={answer} selected={pick} onSelect={onPick}
        litColumn={litRole} onOpenColumn={onOpenRole} onOpenRow={onOpenRow}
        onFoldGroup={(group, folded) => { if (group === 'none') onFoldNone?.(folded) }}
        {...(readOnly ? {} : {
          keys: ['r', 'a', 'c', 'i', '-', ' ', 'delete', 'backspace'],
          onKey: (at: MatrixPick, key: string) => {
            if (key === ' ') {
              const role = roles.get(at.column)
              if (role) dispatch(cycleRaci(role, at.row))
            } else write(at, key === 'r' || key === 'a' || key === 'c' || key === 'i' ? key.toUpperCase() as Raci : undefined)
          },
          hint: t('operating.raciHint'),
        })}
        dataGuide="operating.matrix"
      />
      {pick && !readOnly && !pick.row.startsWith('group:') && (
        <div className="op-picker" data-guide="operating.cell" data-testid="operating-cell-picker">
          <span className="op-picker__letters" role="group" aria-label={t('operating.setLetter')}>
            {RACI_LETTERS.map((letter) => (
              <Button key={letter} variant={roles.get(pick.column) && raciOf(roles.get(pick.column) as Role, pick.row) === letter ? 'primary' : 'plain'} size="small" aria-label={t(WORD[letter])} onClick={() => write(pick, letter)}>{letter}</Button>
            ))}
            <Button variant="plain" size="small" aria-label={t('operating.raciNone')} onClick={() => write(pick, undefined)}>–</Button>
          </span>
          <span className="op-small">{t('operating.raciLegend')}</span>
        </div>
      )}
    </>
  )
}

function HolderWords({ holders, t }: { holders: readonly { name: string; acting: boolean }[]; t: Translate }) {
  if (holders.length === 0) return <span className="op-vacant">{t('operating.vacant')}</span>
  return <>{holders.map((one) => (one.acting ? t('operating.acting', { name: one.name }) : one.name)).join(', ')}</>
}

function needOfRow(row: string, roles: readonly Role[], t: Translate): ReactNode {
  if (row.startsWith('group:')) return null
  const need = needOf(roles, row)
  return need === undefined ? null : <span className="op-need" data-testid="operating-need">{needWords(need, t)}</span>
}

/** A row whose A sits outside the unit names where it is, so it does not read as a gap. */
function elsewhere(row: string, unit: UnitFact, roles: readonly Role[], t: Translate): ReactNode {
  if (row.startsWith('group:')) return null
  const need = needOf(roles, row)
  if (need !== undefined) return <span className="op-need">{needWords(need, t)}</span>
  const [holder] = accountableFor(roles, row)
  return holder && !unit.roles.includes(holder.id) ? holder.name : null
}
