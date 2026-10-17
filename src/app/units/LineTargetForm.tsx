// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Override…*: where an exception to the model says a line runs (ADR-0039,
 * amended 17 October 2026) — the one form a unit's own line and a holder's own
 * are said with.
 *
 * Said one of two ways. **To a role in a unit**: any unit in the
 * organisation, by its name and the units above it, the one the line is said
 * from first; its role; and, where somebody holds it there, *whoever holds
 * it* or one of them by name. **To one person**: anybody who holds a role on
 * the day, by name; where they hold one role it is filled in, and where they
 * hold several, the form asks which. Either way the kind — a line manager's or
 * a functional line — and its days.
 *
 * The line a form saves is addressed by the path of the scope that keeps the
 * unit it lands on; whether it may be written (to itself, round a loop) is
 * the caller's to ask, and to say.
 */
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { LineKind } from '../../model/operatingModel'
import { pickedPerson } from '../../model/person'
import type { ElementId, UnitLineTarget } from '../../model/types'
import { holdersOn, isUnit, personOf, runsOn, slotsOf, unitOn, unitsAbove } from '../../model/units'
import type { Organisation, UnitLike } from '../../model/units'
import type { PersonNames } from '../../people/ui/names'

/** A line an override says: where it lands, its kind, its days. */
export type SaidLine = { to: UnitLineTarget; kind: LineKind; from?: string; until?: string }

export type LineTargetFormProps = {
  organisation: Organisation
  day: string
  /** The path of the scope that keeps a unit, as the tree has it. */
  scopeOf: (unitId: string) => string | undefined
  names: PersonNames
  /** What the line is said for: a role in a unit, or a holder. */
  title: string
  /** The unit the line is said from, offered first. */
  fromUnit: ElementId
  /** The kind a line opens at, where only one kind is said here. */
  kind?: LineKind
  /** The person the line is said for, not offered as the one they report to. */
  leavePerson?: string
  /** A role in a unit not offered: a unit's line from a role does not report to that role there, whoever holds it. */
  leaveOut?: { unitId: ElementId; roleId: string }
  /** The test id every field's starts with. */
  testId: string
  onSave: (line: SaidLine) => void
  onCancel: () => void
  s: Translate
}

/** A unit's name and the units above it, nearest last: how a unit is told apart from another of the same name. */
export function unitPath(units: readonly UnitLike[], unitId: ElementId): string {
  const name = (id: ElementId) => units.find((one) => one.id === id)?.name ?? id
  return [...unitsAbove(units, unitId).reverse(), unitId].map(name).join(' / ')
}

/** The roles a unit has on the day: its slots', then the roles held there outside them. */
function rolesIn(organisation: Organisation, unit: UnitLike, day: string): string[] {
  const type = organisation.unitTypes.find((one) => one.id === unit.unitTypeId)
  const held = organisation.assignments.filter((one) => one.unitId === unit.id && runsOn(one, day)).map((one) => one.roleId)
  return [...new Set([...slotsOf(unit, type).map((slot) => slot.role), ...held])]
}

// Not a register id: an id is never this, and an empty value would show the field as unfilled.
const ANY = '*'

export function LineTargetForm(props: LineTargetFormProps) {
  const { organisation, day, scopeOf, names, s, testId } = props
  const [mode, setMode] = useState<'role' | 'person'>('role')
  const [unitId, setUnitId] = useState('')
  const [target, setTarget] = useState('')
  const [holder, setHolder] = useState(ANY)
  const [person, setPerson] = useState('')
  const [position, setPosition] = useState('')
  const [kind, setKind] = useState<LineKind>(props.kind ?? 'solid')
  const [from, setFrom] = useState('')
  const [until, setUntil] = useState('')
  const roleName = (id: string) => organisation.roles.find((one) => one.id === id)?.name ?? id
  // The unit said from first, named as such: a developer reports to the team's own tech lead more often than to one elsewhere.
  const units = useMemo(() => organisation.units.filter((one) => isUnit(one) && unitOn(one, day))
    .map((one) => ({ unit: one, path: unitPath(organisation.units, one.id) }))
    .sort((a, b) => (a.unit.id === props.fromUnit ? -1 : b.unit.id === props.fromUnit ? 1 : a.path.localeCompare(b.path))), [organisation, day, props.fromUnit])
  const picked = units.find((one) => one.unit.id === unitId)?.unit
  const roles = picked ? rolesIn(organisation, picked, day).filter((role) => picked.id !== props.leaveOut?.unitId || role !== props.leaveOut.roleId) : []
  const holders = picked && target ? holdersOn(organisation.assignments, picked.id, target, day) : []
  // Everybody who holds a role on the day, by name, and the roles in units each holds.
  const people = useMemo(() => {
    const there = new Set(units.map((one) => one.unit.id))
    const held = new Map<string, { unitId: string; roleId: string }[]>()
    for (const one of organisation.assignments) {
      const who = personOf(one)
      if (!runsOn(one, day) || !there.has(one.unitId) || who === props.leavePerson) continue
      const at = held.get(who) ?? []
      if (!at.some((place) => place.unitId === one.unitId && place.roleId === one.roleId)) at.push({ unitId: one.unitId, roleId: one.roleId })
      held.set(who, at)
    }
    return [...held].map(([id, places]) => ({ id, name: names.text(pickedPerson(id)), places })).sort((a, b) => a.name.localeCompare(b.name))
  }, [organisation, day, names, units, props.leavePerson])
  const whose = people.find((one) => one.id === person)
  const place = whose ? (whose.places.length === 1 ? whose.places[0] : whose.places.find((one) => `${one.unitId}\u0000${one.roleId}` === position)) : undefined
  const placeLabel = (one: { unitId: string; roleId: string }) => `${roleName(one.roleId)} · ${unitPath(organisation.units, one.unitId)}`
  const to: UnitLineTarget | undefined = (() => {
    if (mode === 'person') {
      const scope = place ? scopeOf(place.unitId) : undefined
      return place && scope !== undefined ? { scope, unit: place.unitId, role: place.roleId, person } : undefined
    }
    const scope = unitId ? scopeOf(unitId) : undefined
    if (!target || scope === undefined) return undefined
    return { scope, unit: unitId, role: target, ...(holder !== ANY ? { person: holder } : {}) }
  })()
  const field = (name: string) => ({ htmlInput: { 'data-testid': `${testId}-${name}` } })
  return (
    <Box data-testid={`${testId}-form`} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1, mt: 0.75, display: 'grid', gap: 0.75 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{props.title}</Typography>
      <TextField select label={s('line.toWhat')} value={mode} onChange={(event) => setMode(event.target.value === 'person' ? 'person' : 'role')} slotProps={field('mode')}>
        <MenuItem value="role">{s('line.toRole')}</MenuItem>
        <MenuItem value="person">{s('line.toPerson')}</MenuItem>
      </TextField>
      {mode === 'role' && (
        <>
          <TextField select label={s('line.unit')} value={unitId} onChange={(event) => { setUnitId(event.target.value); setTarget(''); setHolder(ANY) }} slotProps={field('unit')}>
            {units.map(({ unit, path }) => (
              <MenuItem key={unit.id} value={unit.id}>{unit.id === props.fromUnit ? s('unit.lineThisUnit', { unit: path }) : path}</MenuItem>
            ))}
          </TextField>
          <TextField select label={s('unit.lineTargetRole')} value={target} disabled={!picked} onChange={(event) => { setTarget(event.target.value); setHolder(ANY) }} slotProps={field('role')}>
            {roles.map((role) => <MenuItem key={role} value={role}>{roleName(role)}</MenuItem>)}
          </TextField>
          {holders.length > 0 && (
            <TextField select label={s('line.holder')} value={holder} onChange={(event) => setHolder(event.target.value)} slotProps={field('holder')}>
              <MenuItem value={ANY}>{s('line.anyHolder')}</MenuItem>
              {[...new Set(holders.map((one) => personOf(one)))].map((id) => <MenuItem key={id} value={id}>{names.text(pickedPerson(id))}</MenuItem>)}
            </TextField>
          )}
        </>
      )}
      {mode === 'person' && (
        <>
          <TextField select label={s('line.person')} value={person} onChange={(event) => { setPerson(event.target.value); setPosition('') }} slotProps={field('person')}>
            {people.map((one) => <MenuItem key={one.id} value={one.id}>{one.name}</MenuItem>)}
          </TextField>
          {whose && whose.places.length === 1 && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }} data-testid={`${testId}-place`}>{placeLabel(whose.places[0])}</Typography>
          )}
          {whose && whose.places.length > 1 && (
            <TextField select label={s('line.position')} value={position} onChange={(event) => setPosition(event.target.value)} slotProps={field('position')}>
              {whose.places.map((one) => <MenuItem key={`${one.unitId}/${one.roleId}`} value={`${one.unitId}\u0000${one.roleId}`}>{placeLabel(one)}</MenuItem>)}
            </TextField>
          )}
        </>
      )}
      <TextField select label={s('unit.lineKind')} value={kind} onChange={(event) => setKind(event.target.value === 'dotted' ? 'dotted' : 'solid')} slotProps={field('kind')}>
        <MenuItem value="solid">{s('unit.lineSolid')}</MenuItem>
        <MenuItem value="dotted">{s('unit.lineDotted')}</MenuItem>
      </TextField>
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        <TextField type="date" label={s('unit.lineFrom')} value={from} onChange={(event) => setFrom(event.target.value)} sx={{ flex: 1 }}
          slotProps={{ inputLabel: { shrink: true }, ...field('from') }} />
        <TextField type="date" label={s('unit.lineUntil')} value={until} onChange={(event) => setUntil(event.target.value)} sx={{ flex: 1 }}
          slotProps={{ inputLabel: { shrink: true }, ...field('until') }} />
      </Box>
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button size="small" onClick={props.onCancel}>{s('common.cancel')}</Button>
        <Button size="small" variant="contained" disabled={to === undefined} data-testid={`${testId}-save`}
          onClick={() => { if (to) props.onSave({ to, kind, ...(from ? { from } : {}), ...(until ? { until } : {}) }) }}>
          {s('common.save')}
        </Button>
      </Box>
    </Box>
  )
}
