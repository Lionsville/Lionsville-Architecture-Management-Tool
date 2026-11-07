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
import { useRef, useState } from 'react'
import { SurfacePopover as Popover } from '../../widgets/kit/Surface'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import type { Command } from '../../model/commands'
import type { Role } from '../../model/operatingModel'
import type { Assignment } from '../../model/units'
import { pickedPerson } from '../../model/person'
import type { PersonId } from '../../model/person'
import type { Person } from '../../people/person'
import { useSaying } from '../../people/ui/access'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { PersonPicker } from '../../people/ui/PersonPicker'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { SelectField, TextField } from '../../widgets/kit/Field'
import './chart.css'

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
  /** What a person holds on the day, in per cent, for the warning before they go over. Absent: no warning. */
  shareOf?: (person: PersonId) => number
  /** What to call a person in that warning. */
  personName?: (person: PersonId) => string
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

/** What the form holds and what it does, for the dialog and the popover alike. */
function useAssignForm(props: AssignDialogProps) {
  const { assigning, unit, roles, today, makeId, dispatch, onClose } = props
  const held = assigning.mode === 'edit' ? assigning.assignment : undefined
  const [form, setForm] = useState<Form>(() => formOf(assigning, today))
  const set = (patch: Partial<Form>) => setForm((was) => ({ ...was, ...patch }))
  const others = (props.others ?? []).filter((one) => !roles.some((slot) => slot.id === one.id))
  const role = roles.find((one) => one.id === form.roleId) ?? others.find((one) => one.id === form.roleId)
  const exception = role !== undefined && !roles.some((one) => one.id === form.roleId)
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
  return { held, form, set, others, role, exception, done, save }
}

/** How far over all of their time the person chosen would go, with this share: nothing where they stay within it. */
export function shareAfter(already: number, share: string): number | undefined {
  const adding = (shareFrom(share) ?? 1) * 100
  const after = Math.round(already + adding)
  return after > 100 ? after : undefined
}

/** The fields: which role, who, for how much of their time, from when. */
function AssignFields({ props, state }: { props: AssignDialogProps; state: ReturnType<typeof useAssignForm> }) {
  const { unit, roles, register, loadOf, s } = props
  const { held, form, set, others, role, exception } = state
  const saying = useSaying(s)
  const share = useRef<HTMLInputElement>(null)
  const { roleId, person, from, until, acting } = form
  const over = person !== undefined && props.shareOf ? shareAfter(props.shareOf(person), form.share) : undefined
  return (
    <>
      <SelectField
        label={s('assign.role')} value={roleId} onChange={(next) => set({ roleId: next })} data-testid="assign-role"
        options={[
          ...roles.map((one) => ({ value: one.id, label: one.name })),
          ...others.map((one) => ({ value: one.id, label: s('assign.otherRole', { role: one.name }) })),
        ]}
      />
      {exception && role && <p className="chart-assign__note" role="note" data-testid="assign-exception">{s('assign.exception', { role: role.name, unit: unit.name })}</p>}
      <PersonPicker register={register} saying={saying} value={person} onChange={(id) => set({ person: id })} note={loadOf} s={s} />
      {saying.said && <p className="chart-assign__said" data-tone={saying.said.tone}>{saying.said.text}</p>}
      {over !== undefined && person !== undefined && (
        <p className="chart-assign__over" role="note" data-testid="assign-over">
          {s('assign.over', { person: props.personName?.(person) ?? '', share: over })}{' '}
          <button type="button" className="chart-panel__link" onClick={() => share.current?.focus()} data-testid="assign-set-share">{s('assign.setShare')}</button>
        </p>
      )}
      <div className="chart-assign__two">
        <TextField ref={share} type="number" label={s('assign.share')} value={form.share} onChange={(next) => set({ share: next })} min={1} max={100} data-testid="assign-share" />
        <TextField type="date" label={s('assign.from')} value={from} onChange={(next) => set({ from: next })} data-testid="assign-from" />
        {held && <TextField type="date" label={s('assign.until')} value={until} onChange={(next) => set({ until: next })} data-testid="assign-until" />}
      </div>
      <label className="chart-assign__check">
        <input type="checkbox" checked={acting} onChange={(event) => set({ acting: event.target.checked })} />
        {s('assign.acting')}
      </label>
    </>
  )
}

/** An assignment looked at again: a question over the page, with the two ways it can end besides being corrected. */
export function AssignDialog(props: AssignDialogProps) {
  const { unit, today, onClose, s } = props
  const { language } = useStrings()
  const endOn = props.endOn ?? today
  const state = useAssignForm(props)
  const { held, form, role, done, save } = state
  return (
    <Dialog
      open size="s" onClose={onClose} onSubmit={save} data-testid="assign-dialog"
      title={s(held ? 'assign.editTitle' : 'assign.title', { role: role?.name ?? form.roleId, unit: unit.name })}
      actions={(
        <>
          {held && !held.until && !(held.from && held.from > endOn) && (
            <Button size="small" onClick={() => done({ type: 'assignment.update', id: held.id, patch: { until: endOn } })} data-testid="assign-end">
              {s('assign.endToday', { day: formatDay(endOn, language) })}
            </Button>
          )}
          {held && <Button size="small" variant="danger" onClick={() => done({ type: 'assignment.remove', id: held.id })} data-testid="assign-remove">{s('assign.remove')}</Button>}
          <Button onClick={onClose}>{s('assign.cancel')}</Button>
          <Button type="submit" variant="primary" reason={form.person && form.roleId ? undefined : s('assign.pickFirst')} data-testid="assign-save">
            {s(held ? 'assign.saveChange' : 'assign.save')}
          </Button>
        </>
      )}
    >
      <div className="chart-assign" data-flat=""><AssignFields props={props} state={state} /></div>
    </Dialog>
  )
}

/**
 * Someone put in a vacancy, in a popover beside it: it is often one choice, and
 * the chart is why a person is here, so it stays in view. Each person's share now
 * is on their line, and going over is said before Assign, not found afterwards.
 */
export function AssignPopover({ at, ...props }: AssignDialogProps & { at: HTMLElement | null }) {
  const { unit, onClose, s } = props
  const state = useAssignForm(props)
  const { form, role, save } = state
  return (
    <Popover
      open anchorEl={at} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{ backdrop: { invisible: true } }} aria-label={s('assign.title', { role: role?.name ?? form.roleId, unit: unit.name })}
    >
      <form className="chart-assign" data-testid="assign-dialog" onSubmit={(event) => { event.preventDefault(); save() }}>
        <h2 className="chart-assign__title">{s('assign.title', { role: role?.name ?? form.roleId, unit: unit.name })}</h2>
        <AssignFields props={props} state={state} />
        <div className="chart-assign__foot">
          <p className="chart-assign__said">{s('assign.oneStepShort')}</p>
          <Button onClick={onClose}>{s('assign.cancel')}</Button>
          <Button type="submit" variant="primary" reason={form.person && form.roleId ? undefined : s('assign.pickFirst')} data-testid="assign-save">{s('assign.save')}</Button>
        </div>
      </form>
    </Popover>
  )
}
