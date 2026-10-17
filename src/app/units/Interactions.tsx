// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which units a unit works with (ADR-0036 §7): the `interacts` rows it is an
 * end of, in its inspector, and the dialog that declares one, changes its
 * mode or its days, or takes it away.
 *
 * **One row, one step, in the scope that keeps it.** A row is filed in the
 * scope of either unit; one this scope keeps is changed here, and one another
 * scope keeps is listed with where it is kept. The mode is one of Team
 * Topologies' three, in this project's own words; the days are the row's own
 * window, as every row has.
 *
 * The Conway map holds the interfaces between the two units' applications
 * against these rows, and offers this dialog where it finds one with none.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import { FieldsDialog } from '../../widgets/CompactForms'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { Command } from '../../model/commands'
import { INTERACTION_MODES, INTERACTION_MODE_LABEL } from '../../model/relations'
import type { ElementId, InteractionMode, Relation } from '../../model/types'
import type { StringKey } from '../../i18n'

/** A unit, as the dialog offers it. */
export type UnitChoice = { id: ElementId; name: string }

/** What the dialog is asked to do: declare a row from a unit, or look again at one this scope keeps. */
export type Interacting =
  | { mode: 'new'; from: UnitChoice; with?: ElementId }
  | { mode: 'edit'; row: Relation; from: UnitChoice }

export type InteractDialogProps = {
  interacting: Interacting
  /** Every other unit it may work with, by name. */
  units: readonly UnitChoice[]
  /** A new row's id. */
  newRowId: () => string
  dispatch: (command: Command) => unknown
  scopeName: string
  onClose: () => void
  s: Translate
}

/** Each mode in a sentence, in this project's own words. */
const MODE_HELP: Record<InteractionMode, StringKey> = {
  collaboration: 'interacts.help.collaboration',
  service: 'interacts.help.service',
  facilitating: 'interacts.help.facilitating',
}

type Form = { with: ElementId; mode: InteractionMode; from: string; until: string }

function formOf(interacting: Interacting): Form {
  if (interacting.mode === 'new') return { with: interacting.with ?? '', mode: 'collaboration', from: '', until: '' }
  const { row, from } = interacting
  return {
    with: row.sourceId === from.id ? row.targetId : row.sourceId,
    mode: row.mode ?? 'collaboration', from: row.validFrom ?? '', until: row.validUntil ?? '',
  }
}

/** The row the form says, from the unit it was opened on. */
export function interactionOf(form: Form, id: string, from: ElementId): Relation {
  return {
    id, type: 'interacts', sourceId: from, targetId: form.with, mode: form.mode,
    ...(form.from ? { validFrom: form.from } : {}), ...(form.until ? { validUntil: form.until } : {}),
  }
}

/** What changed between a row and the one the form says: the patch, with a field cleared as `undefined`. */
export function interactionPatch(held: Relation, next: Relation): Partial<Relation> {
  const patch: Partial<Relation> = {}
  for (const key of ['mode', 'validFrom', 'validUntil'] as const) if (held[key] !== next[key]) Object.assign(patch, { [key]: next[key] })
  const other = held.sourceId === next.sourceId ? held.targetId : held.sourceId
  if (other !== next.targetId) Object.assign(patch, held.sourceId === next.sourceId ? { targetId: next.targetId } : { sourceId: next.targetId })
  return patch
}

export function InteractDialog({ interacting, units, newRowId, dispatch, scopeName, onClose, s }: InteractDialogProps) {
  const held = interacting.mode === 'edit' ? interacting.row : undefined
  const [form, setForm] = useState<Form>(() => formOf(interacting))
  const set = (patch: Partial<Form>) => setForm((was) => ({ ...was, ...patch }))
  const done = (command: Command) => { if (dispatch(command) !== undefined) onClose() }
  const backwards = form.from !== '' && form.until !== '' && form.until < form.from
  const save = () => {
    const next = interactionOf(form, held?.id ?? newRowId(), interacting.from.id)
    if (!held) { done({ type: 'relation.create', relation: next }); return }
    const patch = interactionPatch(held, next)
    if (Object.keys(patch).length === 0) onClose()
    else done({ type: 'relation.update', id: held.id, patch })
  }
  const others = units.filter((unit) => unit.id !== interacting.from.id)
  return (
    <FieldsDialog open onClose={onClose} maxWidth="xs" fullWidth data-testid="interact-dialog">
      <DialogTitle sx={{ fontSize: 16 }}>{s('interacts.dialogTitle', { unit: interacting.from.name })}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 1.25, pt: '8px !important' }}>
        <TextField select label={s('interacts.with')} value={form.with} onChange={(event) => set({ with: event.target.value })}
          slotProps={{ htmlInput: { 'data-testid': 'interact-with' } }}>
          {others.map((unit) => <MenuItem key={unit.id} value={unit.id}>{unit.name}</MenuItem>)}
        </TextField>
        <TextField select label={s('interacts.mode')} value={form.mode} onChange={(event) => set({ mode: event.target.value as InteractionMode })}
          slotProps={{ htmlInput: { 'data-testid': 'interact-mode' } }}>
          {INTERACTION_MODES.map((mode) => <MenuItem key={mode} value={mode}>{s(INTERACTION_MODE_LABEL[mode])}</MenuItem>)}
        </TextField>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s(MODE_HELP[form.mode])}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField type="date" label={s('interacts.from')} value={form.from} onChange={(event) => set({ from: event.target.value })}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'data-testid': 'interact-from' } }} />
          <TextField type="date" label={s('interacts.until')} value={form.until} onChange={(event) => set({ until: event.target.value })}
            error={backwards} slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'data-testid': 'interact-until' } }} />
        </Box>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('interacts.oneStep', { scope: scopeName })}</Typography>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {held && (
          <Button size="small" color="error" onClick={() => done({ type: 'relation.delete', id: held.id })} data-testid="interact-remove">
            {s('interacts.remove')}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={onClose}>{s('interacts.cancel')}</Button>
        <Button size="small" variant="contained" disabled={!form.with || backwards} onClick={save} data-testid="interact-save">
          {s(held ? 'interacts.saveChange' : 'interacts.save')}
        </Button>
      </DialogActions>
    </FieldsDialog>
  )
}

/** One row a unit is an end of, as its inspector lists it: the other unit, and where the row is kept. */
export type InteractionLine = { row: Relation; other: string; keptIn?: string; editable: boolean }

/** The rows a unit is an end of, under *Works with*, and the way to declare one. */
export function InteractionsSection({ lines, onDeclare, onEdit, s }: {
  lines: readonly InteractionLine[]
  /** Absent: nothing can be declared here. */
  onDeclare?: () => void
  onEdit: (row: Relation) => void
  s: Translate
}) {
  return (
    <Box data-testid="unit-interactions">
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mt: 1.25, mb: 0.25 }}>{s('interacts.title')}</Typography>
      {lines.length === 0 && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('interacts.none')}</Typography>}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {lines.map(({ row, other, keptIn, editable }) => (
          <Chip
            key={row.id} data-testid="unit-interaction"
            label={[
              other, row.mode ? s(INTERACTION_MODE_LABEL[row.mode]) : undefined,
              row.validFrom || row.validUntil ? `${row.validFrom ?? '…'} – ${row.validUntil ?? '…'}` : undefined,
              keptIn ? s('interacts.keptIn', { scope: keptIn }) : undefined,
            ].filter(Boolean).join(' · ')}
            {...(editable ? { onClick: () => onEdit(row) } : {})}
          />
        ))}
      </Box>
      {onDeclare && (
        <Button size="small" sx={{ mt: 0.5, fontSize: 12 }} onClick={onDeclare} data-testid="unit-interaction-add">{s('interacts.add')}</Button>
      )}
    </Box>
  )
}
