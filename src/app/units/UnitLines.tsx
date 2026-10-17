// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A unit's reporting lines, in its inspector (ADR-0039 §3, §7): each line of
 * its roles on the day looked at — where it lands, solid or dotted, whether it
 * is the role's, the type's or the unit's own — who reports into it from
 * elsewhere, and, where the unit is kept here and may
 * be written, *Override…*, *Report by nesting here* and *Use the type's*, and
 * a line for a role that has none.
 *
 * A line of its own is an override of the model (ADR-0039, amended 17
 * October 2026), marked as one: a step on the unit (`reportingLines`),
 * addressed to the unit it lands on by the path of the scope that keeps it —
 * to whoever holds the role there, or to one of them by name
 * (`LineTargetForm`). Who reports into it from elsewhere includes one
 * holder's own line, named. A line to the
 * same role in the same unit, and a solid one that would close a loop over
 * the organisation on the day looked at, are refused here and said why, as
 * the agent's are (ADR-0039 §5).
 */
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { LineKind, UnitType } from '../../model/operatingModel'
import { pickedPerson } from '../../model/person'
import { refuseUnitLine, unitLinesWith, unitLinesWithout } from '../../model/reporting'
import type { DesignElement, UnitReportingLine } from '../../model/types'
import { everyLineOn, holdersAt, personOf, reportingLinesOn, slotsOf } from '../../model/units'
import type { Organisation, ReportingLineOn } from '../../model/units'
import { usePersonNames } from '../../people/ui/names'
import type { PersonNames } from '../../people/ui/names'
import { reportingLineColours } from '../theme'
import { LineTargetForm } from './LineTargetForm'
import { refusalWords } from './lineWords'

export type UnitLinesProps = {
  element: DesignElement
  organisation: Organisation
  type: UnitType | undefined
  /** The day looked at. */
  day: string
  editable: boolean
  /** The path of the scope that keeps a unit, as the tree has it. */
  scopeOf: (unitId: string) => string | undefined
  update: (patch: Partial<DesignElement>) => void
  s: Translate
}

const SECTION = { fontSize: 12, fontWeight: 700, color: 'text.secondary', mt: 1.25, mb: 0.25 } as const
const LINE = { fontSize: 13 } as const
const QUIET = { fontSize: 12, color: 'text.secondary' } as const
const ACTION = { minWidth: 0, px: 0.5, py: 0, fontSize: 12, textTransform: 'none' } as const

/** The mark an override wears: a unit's own line, a holder's own, in the override colour (ADR-0039, amended 17 October 2026). */
export function OverrideMark({ s, testId = 'line-override-mark' }: { s: Translate; testId?: string }) {
  return (
    <Chip variant="outlined" label={s('unit.lineOverrideMark')} data-testid={testId}
      sx={{ height: 18, fontSize: 10, ml: 0.5, borderColor: (theme) => reportingLineColours(theme).override, borderWidth: 2, borderStyle: 'dashed' }} />
  )
}

export function UnitLines(props: UnitLinesProps) {
  const { element, organisation, type, day, editable, update, s } = props
  const names = usePersonNames()
  const lines = useMemo(() => reportingLinesOn(organisation, day).filter((line) => line.unitId === element.id), [organisation, day, element.id])
  const [editing, setEditing] = useState<string | undefined>(undefined)
  const [refused, setRefused] = useState<string | undefined>(undefined)
  const own = element.reportingLines ?? []
  const roleName = (id: string) => organisation.roles.find((one) => one.id === id)?.name ?? id
  const write = (line: UnitReportingLine) => {
    const refusal = refuseUnitLine(organisation, element.id, line, day)
    setRefused(refusal && refusalWords(refusal, organisation, s))
    if (refusal) return
    update({ reportingLines: unitLinesWith(own, line) })
    setEditing(undefined)
  }
  const useType = (role: string, kind: LineKind) => {
    const next = unitLinesWithout(own, role, kind)
    setRefused(undefined)
    update({ reportingLines: next.length ? next : undefined })
  }
  const solid = new Set(lines.filter((line) => line.kind === 'solid').map((line) => line.roleId))
  const free = slotsOf(element, type).map((slot) => slot.role).filter((role) => !solid.has(role))
  // Who reports into this unit (ADR-0039 §7, amended): every line of another unit's role that lands on one of its roles today.
  const into = useMemo(() => everyLineOn(organisation, day).filter((line) => line.state === 'lands' && line.to?.unitId === element.id && line.unitId !== element.id), [organisation, day, element.id])
  const holderOf = (line: ReportingLineOn) => {
    const one = line.assignmentId === undefined ? undefined : organisation.assignments.find((held) => held.id === line.assignmentId)
    return one ? names.text(pickedPerson(personOf(one))) : undefined
  }
  const unitName = (id: string) => organisation.units.find((one) => one.id === id)?.name ?? id
  return (
    <Box data-testid="unit-lines">
      <Typography sx={SECTION}>{s('unit.lines')}</Typography>
      {lines.length === 0 && <Typography sx={QUIET}>{s('unit.linesNone')}</Typography>}
      {lines.map((line) => (
        <Box key={`${line.roleId}/${line.kind}`} data-testid="unit-line" data-role={line.roleId} data-kind={line.kind} data-state={line.state}>
          <Typography component="div" sx={LINE}>
            {lineWords(line, organisation, day, s, names)}
            <Chip variant="outlined" label={s(line.kind === 'solid' ? 'unit.lineSolid' : 'unit.lineDotted')}
              sx={{ height: 18, fontSize: 10, ml: 0.5, ...(line.kind === 'dotted' ? { borderStyle: 'dotted' } : {}) }} />
            <Box component="span" sx={{ ...QUIET, ml: 0.5 }}>
              {s(line.source === 'type' ? 'unit.lineFromType' : line.source === 'role' ? 'unit.lineFromRole' : 'unit.lineOwn')}
              {(line.from !== undefined || line.until !== undefined) ? ` · ${s('unit.lineDays', { from: line.from ?? '…', until: line.until ?? '…' })}` : ''}
            </Box>
            {line.override && <OverrideMark s={s} />}
          </Typography>
          {editable && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              <Button size="small" sx={ACTION} data-testid="unit-line-override" onClick={() => { setRefused(undefined); setEditing(line.roleId) }}>
                {s('unit.lineOverride')}
              </Button>
              {line.kind === 'solid' && line.state !== 'nesting' && (
                <Button size="small" sx={ACTION} data-testid="unit-line-nesting" onClick={() => write({ role: line.roleId, kind: 'solid' })}>
                  {s('unit.lineByNesting')}
                </Button>
              )}
              {line.source === 'unit' && (
                <Button size="small" sx={ACTION} data-testid="unit-line-use-type" onClick={() => useType(line.roleId, line.kind)}>
                  {s('unit.lineUseType')}
                </Button>
              )}
            </Box>
          )}
        </Box>
      ))}
      {editable && editing === undefined && free.length > 0 && (
        <TextField select fullWidth label={s('unit.lineAdd')} value="" sx={{ mt: 0.75 }}
          onChange={(event) => { setRefused(undefined); setEditing(event.target.value) }}
          slotProps={{ htmlInput: { 'data-testid': 'unit-line-add' } }}>
          {free.map((role) => <MenuItem key={role} value={role}>{roleName(role)}</MenuItem>)}
        </TextField>
      )}
      {editable && editing !== undefined && (
        <LineTargetForm
          organisation={organisation} day={day} scopeOf={props.scopeOf} names={names} title={roleName(editing)} fromUnit={element.id}
          leaveOut={{ unitId: element.id, roleId: editing }} testId="unit-line" s={s}
          onSave={(said) => write({ role: editing, ...said })} onCancel={() => { setEditing(undefined); setRefused(undefined) }}
        />
      )}
      {refused && <Typography role="alert" sx={{ fontSize: 12, color: 'error.main' }} data-testid="unit-line-refused">{refused}</Typography>}
      {into.length > 0 && (
        <>
          <Typography sx={SECTION}>{s('unit.reportedToBy')}</Typography>
          {into.map((line) => {
            const holder = holderOf(line)
            const words = { role: roleName(line.roleId), unit: unitName(line.unitId), target: roleName(line.to!.roleId) }
            return (
              <Typography key={`${line.unitId}/${line.roleId}/${line.kind}/${line.assignmentId ?? ''}`} component="div" sx={LINE} data-testid="unit-line-into" data-kind={line.kind}>
                {holder !== undefined ? s('unit.reportedToByHolder', { ...words, person: holder }) : s('unit.reportedToByLine', words)}
                <Chip variant="outlined" label={s(line.kind === 'solid' ? 'unit.lineSolid' : 'unit.lineDotted')}
                  sx={{ height: 18, fontSize: 10, ml: 0.5, ...(line.kind === 'dotted' ? { borderStyle: 'dotted' } : {}) }} />
                {line.override && <OverrideMark s={s} />}
              </Typography>
            )
          })}
        </>
      )}
    </Box>
  )
}

/** One line as a sentence: where it lands — on one person where it names one — by nesting here, or why it lands nowhere. */
export function lineWords(line: ReportingLineOn, organisation: Organisation, day: string, s: Translate, names: PersonNames): string {
  const role = (id: string) => organisation.roles.find((one) => one.id === id)?.name ?? id
  const unit = (id: string) => organisation.units.find((one) => one.id === id)?.name ?? id
  const target = role(line.reportsTo ?? '')
  switch (line.state) {
    case 'nesting': return s('unit.lineNesting', { role: role(line.roleId) })
    case 'dangling': return s('unit.lineDangling', { role: role(line.roleId), target })
    case 'ambiguous': return s('unit.lineAmbiguous', { role: role(line.roleId), target, count: line.candidates?.length ?? 0 })
    case 'lands': {
      const to = line.to!
      const vacant = holdersAt(organisation.assignments, to, day).length === 0
      const words = { role: role(line.roleId), target: role(to.roleId), unit: unit(to.unitId) }
      const person = to.person === undefined ? undefined : names.text(pickedPerson(to.person))
      const where = person !== undefined
        ? s(to.unitId === line.unitId ? 'unit.lineToPersonHere' : 'unit.lineToPerson', { ...words, person })
        : s(to.unitId === line.unitId ? 'unit.lineToHere' : 'unit.lineTo', words)
      const missing = person !== undefined ? s('unit.lineNotHeld', { person }) : s('unit.lineVacant')
      return `${where}${vacant ? ` (${missing})` : ''}`
    }
  }
}
