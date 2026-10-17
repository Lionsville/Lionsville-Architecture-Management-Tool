// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Someone put in a role of a unit, or an assignment corrected or ended
 * (ADR-0036 §4).
 *
 * **One step in the unit's scope**: an assignment with an id for the person,
 * a role and a unit. A person new to the register is added there first,
 * outside the history, after the four signs have been asked (`PersonPicker`).
 * Correcting one is a patch of what changed; ending one sets its last day;
 * removing one is for an assignment made by mistake — one that ended stays,
 * because it is what the person held.
 *
 * **The unit's roles first** (ADR-0039, amended 17 October 2026): the roles
 * its slots give, and under them, apart, *Another role (an exception)* — any
 * other role of the organisation. One picked from there is allowed, said as
 * an exception to the model before it is saved, and marked wherever the
 * holder is shown.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import { FieldLabel, FieldsDialog } from '../../widgets/CompactForms'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import ListSubheader from '@mui/material/ListSubheader'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { Command } from '../../model/commands'
import type { Role } from '../../model/operatingModel'
import type { Assignment } from '../../model/units'
import { pickedPerson } from '../../model/person'
import type { PersonId } from '../../model/person'
import type { Person } from '../../people/person'
import { useSaying } from '../../people/ui/access'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { PersonPicker } from '../../people/ui/PersonPicker'
import { reportingLineColours } from '../theme'

/** What the dialog is asked to do: put someone in a role, or look again at an assignment. */
export type Assigning =
  | { mode: 'new'; roleId: string }
  | { mode: 'edit'; assignment: Assignment }

export type AssignDialogProps = {
  assigning: Assigning
  unit: { id: string; name: string }
  /** The roles the unit holds, in the order its slots list them. */
  roles: readonly Role[]
  /** The organisation's other roles, offered apart as exceptions to the model. Absent: none offered. */
  others?: readonly Role[]
  register: PeopleRegisterAccess
  /** The day a new assignment starts on: today, or the day looked at where that is still to come. */
  today: string
  /** The day *End* sets as the last: today, or the day before the day looked at. Absent: `today`. */
  endOn?: string
  makeId: (prefix: string) => string
  /** The one way in. */
  dispatch: (command: Command) => unknown
  /** What each person holds on the day, said beside their name. */
  loadOf: (person: Person) => string | undefined
  scopeName: string
  onClose: () => void
  s: Translate
}

/** A share typed in per cent, as the record keeps it: a fraction, and nothing for all of it. */
export function shareFrom(percent: string): number | undefined {
  const value = Number(percent)
  if (!Number.isFinite(value) || value <= 0 || value >= 100) return undefined
  return Math.round(value) / 100
}

/** What changed between an assignment and the one the form holds: the patch, with a field cleared as `undefined`. */
export function assignmentPatch(held: Assignment, next: Assignment): Partial<Assignment> {
  const patch: Partial<Assignment> = {}
  const keys = ['roleId', 'share', 'from', 'until', 'acting'] as const
  for (const key of keys) if (held[key] !== next[key]) Object.assign(patch, { [key]: next[key] })
  if (held.person.person !== next.person.person) patch.person = next.person
  return patch
}

/** What the form holds while it is open. */
type Form = { roleId: string; person?: PersonId; share: string; from: string; until: string; acting: boolean }

/** The form as it opens: an assignment's own values, or a new one from today in the role asked for. */
export function formOf(assigning: Assigning, today: string): Form {
  if (assigning.mode === 'new') return { roleId: assigning.roleId, share: '100', from: today, until: '', acting: false }
  const held = assigning.assignment
  return {
    roleId: held.roleId, person: held.person.person,
    share: held.share !== undefined ? String(Math.round(held.share * 100)) : '100',
    from: held.from ?? '', until: held.until ?? '', acting: held.acting === true,
  }
}

/** The assignment the form says, or nothing while it names nobody or no role. */
export function assignmentOf(form: Form, id: string, unitId: string): Assignment | undefined {
  if (!form.person || !form.roleId) return undefined
  const fraction = shareFrom(form.share)
  return {
    id, unitId, roleId: form.roleId, person: pickedPerson(form.person),
    ...(fraction !== undefined ? { share: fraction } : {}),
    ...(form.from ? { from: form.from } : {}), ...(form.until ? { until: form.until } : {}), ...(form.acting ? { acting: true as const } : {}),
  }
}

export function AssignDialog(props: AssignDialogProps) {
  const { assigning, unit, roles, register, today, makeId, dispatch, loadOf, scopeName, onClose, s } = props
  const endOn = props.endOn ?? today
  const held = assigning.mode === 'edit' ? assigning.assignment : undefined
  const saying = useSaying(s)
  const [form, setForm] = useState<Form>(() => formOf(assigning, today))
  const set = (patch: Partial<Form>) => setForm((was) => ({ ...was, ...patch }))
  const { roleId, person, share, from, until, acting } = form
  const others = (props.others ?? []).filter((one) => !roles.some((slot) => slot.id === one.id))
  const role = roles.find((one) => one.id === roleId) ?? others.find((one) => one.id === roleId)
  const exception = role !== undefined && !roles.some((one) => one.id === roleId)
  const done = (command: Command | undefined) => {
    if (command && dispatch(command) !== undefined) onClose()
  }
  const save = () => {
    const next = assignmentOf(form, held?.id ?? makeId('as'), unit.id)
    if (!next) return
    if (!held) { done({ type: 'assignment.add', assignment: next }); return }
    const patch = assignmentPatch(held, next)
    if (Object.keys(patch).length === 0) onClose()
    else done({ type: 'assignment.update', id: held.id, patch })
  }
  return (
    <FieldsDialog open onClose={onClose} maxWidth="xs" fullWidth data-testid="assign-dialog">
      <DialogTitle sx={{ fontSize: 16 }}>
        {s(held ? 'assign.editTitle' : 'assign.title', { role: role?.name ?? roleId, unit: unit.name })}
      </DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 1.25, pt: '8px !important' }}>
        <TextField select label={s('assign.role')} value={roleId} onChange={(event) => set({ roleId: event.target.value })}
          slotProps={{ htmlInput: { 'data-testid': 'assign-role' } }}>
          {roles.map((one) => <MenuItem key={one.id} value={one.id}>{one.name}</MenuItem>)}
          {others.length > 0 && <ListSubheader data-testid="assign-other-roles">{s('assign.otherRoles')}</ListSubheader>}
          {others.map((one) => <MenuItem key={one.id} value={one.id} data-exception="true">{one.name}</MenuItem>)}
        </TextField>
        {exception && (
          <Typography role="note" data-testid="assign-exception" sx={{ fontSize: 12, color: 'text.secondary', borderLeft: 3, borderColor: (theme) => reportingLineColours(theme).override, pl: 1 }}>
            {s('assign.exception', { role: role.name, unit: unit.name })}
          </Typography>
        )}
        <FieldLabel>{s('assign.person')}</FieldLabel>
        <PersonPicker register={register} saying={saying} value={person} onChange={(id) => set({ person: id })} note={loadOf} s={s} />
        {saying.said && <Typography sx={{ fontSize: 12, color: saying.said.tone === 'error' ? 'error.main' : 'text.secondary' }}>{saying.said.text}</Typography>}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField type="number" label={s('assign.share')} value={share} onChange={(event) => set({ share: event.target.value })}
            slotProps={{ htmlInput: { min: 1, max: 100, 'data-testid': 'assign-share' } }} sx={{ width: 110 }} />
          <TextField type="date" label={s('assign.from')} value={from} onChange={(event) => set({ from: event.target.value })}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'data-testid': 'assign-from' } }} />
          {held && (
            <TextField type="date" label={s('assign.until')} value={until} onChange={(event) => set({ until: event.target.value })}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'data-testid': 'assign-until' } }} />
          )}
        </Box>
        <FormControlLabel control={<Checkbox checked={acting} onChange={(event) => set({ acting: event.target.checked })} />}
          label={s('assign.acting')} />
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('assign.oneStep', { scope: scopeName })}</Typography>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {held && !held.until && !(held.from && held.from > endOn) && (
          <Button size="small" onClick={() => done({ type: 'assignment.update', id: held.id, patch: { until: endOn } })} data-testid="assign-end">
            {s('assign.endToday', { day: endOn })}
          </Button>
        )}
        {held && (
          <Button size="small" color="error" onClick={() => done({ type: 'assignment.remove', id: held.id })} data-testid="assign-remove">
            {s('assign.remove')}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={onClose}>{s('assign.cancel')}</Button>
        <Button size="small" variant="contained" disabled={!person || !roleId} onClick={save} data-testid="assign-save">
          {s(held ? 'assign.saveChange' : 'assign.save')}
        </Button>
      </DialogActions>
    </FieldsDialog>
  )
}
