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
 * A line of its own is a step on the unit (`reportingLines`), addressed to
 * the unit it lands on by the path of the scope that keeps it. A line to the
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
import { refuseUnitLine, unitLinesWith, unitLinesWithout } from '../../model/reporting'
import type { DesignElement, UnitReportingLine } from '../../model/types'
import { holdersOn, isUnit, reportingLinesOn, slotsOf, unitOn } from '../../model/units'
import type { Organisation, ReportingLineOn } from '../../model/units'
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

export function UnitLines(props: UnitLinesProps) {
  const { element, organisation, type, day, editable, update, s } = props
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
  const into = useMemo(() => reportingLinesOn(organisation, day).filter((line) => line.state === 'lands' && line.to?.unitId === element.id && line.unitId !== element.id), [organisation, day, element.id])
  const unitName = (id: string) => organisation.units.find((one) => one.id === id)?.name ?? id
  return (
    <Box data-testid="unit-lines">
      <Typography sx={SECTION}>{s('unit.lines')}</Typography>
      {lines.length === 0 && <Typography sx={QUIET}>{s('unit.linesNone')}</Typography>}
      {lines.map((line) => (
        <Box key={`${line.roleId}/${line.kind}`} data-testid="unit-line" data-role={line.roleId} data-kind={line.kind} data-state={line.state}>
          <Typography component="div" sx={LINE}>
            {lineWords(line, organisation, day, s)}
            <Chip size="small" variant="outlined" label={s(line.kind === 'solid' ? 'unit.lineSolid' : 'unit.lineDotted')}
              sx={{ height: 18, fontSize: 10, ml: 0.5, ...(line.kind === 'dotted' ? { borderStyle: 'dotted' } : {}) }} />
            <Box component="span" sx={{ ...QUIET, ml: 0.5 }}>
              {s(line.source === 'type' ? 'unit.lineFromType' : line.source === 'role' ? 'unit.lineFromRole' : 'unit.lineOwn')}
              {(line.from !== undefined || line.until !== undefined) ? ` · ${s('unit.lineDays', { from: line.from ?? '…', until: line.until ?? '…' })}` : ''}
            </Box>
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
        <TextField size="small" select fullWidth label={s('unit.lineAdd')} value="" sx={{ mt: 0.75 }}
          onChange={(event) => { setRefused(undefined); setEditing(event.target.value) }}
          slotProps={{ htmlInput: { 'data-testid': 'unit-line-add' } }}>
          {free.map((role) => <MenuItem key={role} value={role}>{roleName(role)}</MenuItem>)}
        </TextField>
      )}
      {editable && editing !== undefined && (
        <LineForm role={editing} roleName={roleName(editing)} {...props} onSave={write} onCancel={() => { setEditing(undefined); setRefused(undefined) }} />
      )}
      {refused && <Typography role="alert" sx={{ fontSize: 12, color: 'error.main' }} data-testid="unit-line-refused">{refused}</Typography>}
      {into.length > 0 && (
        <>
          <Typography sx={SECTION}>{s('unit.reportedToBy')}</Typography>
          {into.map((line) => (
            <Typography key={`${line.unitId}/${line.roleId}/${line.kind}`} component="div" sx={LINE} data-testid="unit-line-into" data-kind={line.kind}>
              {s('unit.reportedToByLine', { role: roleName(line.roleId), unit: unitName(line.unitId), target: roleName(line.to!.roleId) })}
              <Chip size="small" variant="outlined" label={s(line.kind === 'solid' ? 'unit.lineSolid' : 'unit.lineDotted')}
                sx={{ height: 18, fontSize: 10, ml: 0.5, ...(line.kind === 'dotted' ? { borderStyle: 'dotted' } : {}) }} />
            </Typography>
          ))}
        </>
      )}
    </Box>
  )
}

/** One line as a sentence: where it lands, by nesting here, or why it lands nowhere. */
function lineWords(line: ReportingLineOn, organisation: Organisation, day: string, s: Translate): string {
  const role = (id: string) => organisation.roles.find((one) => one.id === id)?.name ?? id
  const unit = (id: string) => organisation.units.find((one) => one.id === id)?.name ?? id
  const target = role(line.reportsTo ?? '')
  switch (line.state) {
    case 'nesting': return s('unit.lineNesting', { role: role(line.roleId) })
    case 'dangling': return s('unit.lineDangling', { role: role(line.roleId), target })
    case 'ambiguous': return s('unit.lineAmbiguous', { role: role(line.roleId), target, count: line.candidates?.length ?? 0 })
    case 'lands': {
      const to = line.to!
      const vacant = holdersOn(organisation.assignments, to.unitId, to.roleId, day).length === 0
      const where = to.unitId === line.unitId
        ? s('unit.lineToHere', { role: role(line.roleId), target: role(to.roleId) })
        : s('unit.lineTo', { role: role(line.roleId), target: role(to.roleId), unit: unit(to.unitId) })
      return `${where}${vacant ? ` (${s('unit.lineVacant')})` : ''}`
    }
  }
}

/** *Override…*: the unit reported to, its role, and the kind — written as the unit's own line for the role. */
function LineForm(props: UnitLinesProps & { role: string; roleName: string; onSave: (line: UnitReportingLine) => void; onCancel: () => void }) {
  const { organisation, day, scopeOf, s } = props
  const [unitId, setUnitId] = useState('')
  const [target, setTarget] = useState('')
  const [kind, setKind] = useState<LineKind>('solid')
  // The same two days the type's slot editor takes, and the agent sets.
  const [from, setFrom] = useState('')
  const [until, setUntil] = useState('')
  // This unit first, named as such: a developer reports to the team's own tech lead more often than to one elsewhere.
  const units = useMemo(() => organisation.units.filter((one) => isUnit(one) && unitOn(one, day))
    .sort((a, b) => (a.id === props.element.id ? -1 : b.id === props.element.id ? 1 : a.name.localeCompare(b.name))), [organisation, day, props.element.id])
  const types = new Map(organisation.unitTypes.map((one) => [one.id, one]))
  const picked = units.find((one) => one.id === unitId)
  // A role does not report to itself in the same unit: the unit's own list leaves it out.
  const roles = picked ? slotsOf(picked, types.get(picked.unitTypeId ?? '')).map((slot) => slot.role).filter((role) => picked.id !== props.element.id || role !== props.role) : []
  const roleName = (id: string) => organisation.roles.find((one) => one.id === id)?.name ?? id
  const scope = unitId ? scopeOf(unitId) : undefined
  return (
    <Box data-testid="unit-line-form" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1, mt: 0.75, display: 'grid', gap: 0.75 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{props.roleName}</Typography>
      <TextField size="small" select label={s('unit.lineTarget')} value={unitId} onChange={(event) => { setUnitId(event.target.value); setTarget('') }}
        slotProps={{ htmlInput: { 'data-testid': 'unit-line-unit' } }}>
        {units.map((one) => <MenuItem key={one.id} value={one.id}>{one.id === props.element.id ? s('unit.lineThisUnit', { unit: one.name }) : one.name}</MenuItem>)}
      </TextField>
      <TextField size="small" select label={s('unit.lineTargetRole')} value={target} disabled={!picked} onChange={(event) => setTarget(event.target.value)}
        slotProps={{ htmlInput: { 'data-testid': 'unit-line-role' } }}>
        {roles.map((role) => <MenuItem key={role} value={role}>{roleName(role)}</MenuItem>)}
      </TextField>
      <TextField size="small" select label={s('unit.lineKind')} value={kind} onChange={(event) => setKind(event.target.value === 'dotted' ? 'dotted' : 'solid')}
        slotProps={{ htmlInput: { 'data-testid': 'unit-line-kind' } }}>
        <MenuItem value="solid">{s('unit.lineSolid')}</MenuItem>
        <MenuItem value="dotted">{s('unit.lineDotted')}</MenuItem>
      </TextField>
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        <TextField size="small" type="date" label={s('unit.lineFrom')} value={from} onChange={(event) => setFrom(event.target.value)} sx={{ flex: 1 }}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'data-testid': 'unit-line-from' } }} />
        <TextField size="small" type="date" label={s('unit.lineUntil')} value={until} onChange={(event) => setUntil(event.target.value)} sx={{ flex: 1 }}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'data-testid': 'unit-line-until' } }} />
      </Box>
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button size="small" onClick={props.onCancel}>{s('common.cancel')}</Button>
        <Button size="small" variant="contained" disabled={!target || scope === undefined} data-testid="unit-line-save"
          onClick={() => props.onSave({
            role: props.role, to: { scope: scope ?? '', unit: unitId, role: target }, kind,
            ...(from ? { from } : {}), ...(until ? { until } : {}),
          })}>
          {s('common.save')}
        </Button>
      </Box>
    </Box>
  )
}
