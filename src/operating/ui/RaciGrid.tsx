// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The crossing of responsibilities and roles, on the kit's Matrix: a press
 * selects, a letter or the picker writes, one set is one step. A filled A and a
 * soft R; the letter itself says which, so it is never colour alone. An A that does
 * the work too is A/R in its cell, and an assumed letter is dashed; a confirmed one
 * and one nobody said anything of look alike. What a row needs stands beside its
 * name and is empty on a healthy row.
 */
import { useCallback, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { accountableFor, dutyOf, raciSaid } from '../../model/operatingModel'
import type { Duty, DutySaid, Role } from '../../model/operatingModel'
import type { Command } from '../../model/commands'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { Matrix } from '../../widgets/kit/Matrix'
import type { MatrixCell, MatrixPick, MatrixRowDef } from '../../widgets/kit/Matrix'
import { cycleRaci, setRaci } from '../edit'
import { needOf } from '../raciView'
import type { RaciGrid as Grid } from '../raciView'
import type { OrganisationFacts, UnitFact } from '../organisationFacts'
import { CellPicker, letterKept, nextMark, useUnkeptOfDuty } from './CellPicker'
import { dutyWords } from './dutyWords'
import type { CellLetter } from './dutyWords'

/** The keys that write a letter: A/R has one of its own, so A stays A alone. */
const LETTER_KEYS: Readonly<Record<string, CellLetter>> = { r: 'R', a: 'A', c: 'C', i: 'I', '/': 'A/R' }

export const needWords = (count: number, t: Translate): string => (count === 0 ? t('operating.needNone') : t('operating.needMany', { count }))

const GROUP = (name: string) => `group:${name}`
/** Past this many rows the grid keeps a height of its own, and scrolls inside it with its heads stuck. */
const TALL_FROM = 8

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
  // The same function while the roles are the same, so a row nothing changed in is not drawn again.
  const cellOf = useCallback((row: string, column: string): MatrixCell | null => {
    if (row.startsWith('group:')) return null
    const role = roles.get(column)
    const duty = role && dutyOf(role, row)
    if (!duty) return null
    return {
      show: duty.alsoResponsible ? <span className="op-both">{raciSaid(duty)}</span> : raciSaid(duty), meaning: dutyWords(duty, t), tone: duty.raci === 'A' ? 'solid' : duty.raci === 'R' ? 'soft' : 'plain',
      dashed: duty.certainty === 'assumed',
    }
  }, [roles, t])
  const answer = useMemo(() => (unit
    ? { label: t('operating.aElsewhere'), of: (row: string): ReactNode => elsewhere(row, unit, allRoles, t) }
    : { label: t('operating.needs'), of: (row: string): ReactNode => needOfRow(row, allRoles, t) }), [unit, allRoles, t])
  const box = useRef<HTMLDivElement>(null)
  const sourceInput = useRef<HTMLInputElement>(null)
  const unkept = useUnkeptOfDuty()
  const roleAt = (at: MatrixPick) => (at.row.startsWith('group:') ? undefined : roles.get(at.column))
  const write = (at: MatrixPick, letter: CellLetter | undefined) => {
    const role = roleAt(at)
    const held = role && dutyOf(role, at.row)
    // The cell says it already: no step.
    if (!role || (held && raciSaid(held)) === letter) return
    const kept = letter && letterKept(letter)
    dispatch(setRaci(role, at.row, kept?.raci, kept?.said))
  }
  /** Beside the letter that is there; a cell with none has nothing to say it of. */
  const say = (at: MatrixPick, saidOf: DutySaid | ((duty: Duty) => DutySaid)) => {
    const role = roleAt(at)
    const duty = role && dutyOf(role, at.row)
    if (duty) dispatch(setRaci(role, at.row, duty.raci, typeof saidOf === 'function' ? saidOf(duty) : saidOf))
  }
  const toSource = (at: MatrixPick) => {
    const role = roleAt(at)
    if (!role || !dutyOf(role, at.row)) return
    // The field is under the cell picked, and drawn with the pick.
    flushSync(() => onPick(at))
    sourceInput.current?.focus()
  }
  const onKey = (at: MatrixPick, key: string) => {
    const role = roleAt(at)
    if (!role) return
    if (key === ' ') dispatch(cycleRaci(role, at.row))
    else if (key === 'm') say(at, nextMark)
    else if (key === 's') toSource(at)
    else write(at, LETTER_KEYS[key])
  }
  const backToCell = () => box.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus()
  return (
    <>
      <div className="op-gridBox" ref={box} data-tall={rows.length > TALL_FROM || undefined}>
      <Matrix
        label={label} rowHeading={t('operating.responsibility')} rows={rows} columns={columns} wrapRows rotateHeads={rotateNames}
        columnGroups={grid.folded.length ? [{ id: 'none', label: t('operating.noPartColumn'), short: `+${grid.folded.length}` }] : []}
        defaultFoldedGroups={['none']} cellOf={cellOf} answer={answer} selected={pick} onSelect={onPick}
        litColumn={litRole} onOpenColumn={onOpenRole} onOpenRow={onOpenRow}
        onFoldGroup={(group, folded) => { if (group === 'none') onFoldNone?.(folded) }}
        {...(readOnly ? {} : {
          keys: [
            'r', 'a', 'c', 'i', '-', ' ', 'delete', 'backspace',
            ...(unkept.also === undefined ? ['/'] : []), ...(unkept.mark === undefined ? ['m'] : []), ...(unkept.source === undefined ? ['s'] : []),
          ],
          onKey, hint: t('operating.raciHint'),
        })}
        dataGuide="operating.matrix"
      />
      </div>
      {pick && !readOnly && !pick.row.startsWith('group:') && (
        <CellPicker
          role={roles.get(pick.column)} row={pick.row} sourceInput={sourceInput}
          onLetter={(letter) => write(pick, letter)} onSaid={(said) => say(pick, said)} onDone={backToCell}
        />
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
