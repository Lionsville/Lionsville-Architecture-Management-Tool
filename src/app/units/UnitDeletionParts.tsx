// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a delete's confirmation says about a unit (ADR-0036, amended 12
 * October 2026; 3.6.2), under the board's or the sheet's own question.
 *
 * **Ending first.** A reorganisation ends a unit on a day and keeps its
 * history, so that is offered before anything else: *End on a day…* opens a
 * last day in place, and *End it* is one step on the unit's lifecycle. Delete
 * is for a unit made by mistake, and the lines under it say what goes with it.
 *
 * **Short lines, the default chosen, the rarer choices folded.** Who stops
 * being what, as the repair said it; the units inside it with where they go —
 * up into its parent where their type may sit there, and then the other two
 * choices are folded under *Other choices*; where it may not, another unit of
 * its type is chosen and every choice is shown, *Move them up* marked as
 * misplaced; then the applications whose team is cleared, the domains it
 * serves and what it answers for, each a line only where there is one.
 */
import { useId, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import { rolesEndedSentences } from '../../model/deletion'
import { intoOf } from '../../model/unitDeletion'
import type { UnitDeletion, UnitsChoice } from '../../model/unitDeletion'
import { usePersonNames } from '../../people/ui/names'

const LINE = { fontSize: 13.5, mt: 0.5 } as const
const QUIET = { fontSize: 12.5, color: 'text.secondary', mt: 0.5 } as const
const HEAD = { fontSize: 13, fontWeight: 600, mt: 1.5 } as const
/** How many units inside are named before the rest are counted. */
const NAMED = 3

export type UnitDeletionPartsProps = {
  plan: UnitDeletion
  choice: UnitsChoice
  onChoice(choice: UnitsChoice): void
  /** What a unit, a role and a unit type are called, and a scope. */
  names: { unit(id: string): string; role(id: string): string; type(id: string): string; scope(path: string): string }
  /** Today, the last day offered. */
  today: string
  /** End the one unit on this last day instead, where it may be. */
  onEnd?(lastDay: string): void
  s: Translate
}

export function UnitDeletionParts(props: UnitDeletionPartsProps) {
  const { plan, s } = props
  return (
    <Box data-testid="unit-deletion" sx={{ mt: 1 }}>
      <EndFirst {...props} />
      <Typography sx={{ ...LINE, mt: 1.5 }}>{s('unitDelete.mistake')}</Typography>
      <People {...props} />
      {plan.inside.length > 0 && <Inside {...props} />}
      <Also {...props} />
    </Box>
  )
}

/** Ending it on a day, offered first, and opened in place. */
function EndFirst({ plan, today, onEnd, s }: UnitDeletionPartsProps) {
  const [open, setOpen] = useState(false)
  const [last, setLast] = useState(today)
  const one = plan.units.length === 1
  return (
    <Box data-testid="unit-delete-end-first" sx={{ p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
      <Typography sx={{ fontSize: 13.5 }}>{s(one ? 'unitDelete.endFirst' : 'unitDelete.endFirstMany')}</Typography>
      {one && onEnd && !open && (
        <Button size="small" variant="outlined" sx={{ mt: 0.75, textTransform: 'none' }} data-guide="unitDelete.end" data-testid="unit-delete-end"
          onClick={() => setOpen(true)}>
          {s('unitDelete.endButton')}
        </Button>
      )}
      {one && onEnd && open && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
          <TextField size="small" type="date" label={s('unitDelete.lastDay')} value={last} onChange={(event) => setLast(event.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'data-testid': 'unit-delete-last-day' } }} />
          <Button size="small" variant="contained" sx={{ textTransform: 'none' }} disabled={!/^\d{4}-\d{2}-\d{2}$/.test(last)}
            data-testid="unit-delete-end-it" onClick={() => onEnd(last)}>
            {s('unitDelete.endIt')}
          </Button>
        </Box>
      )}
    </Box>
  )
}

/** Who stops being what, over every unit that goes. */
function People({ plan, names, s }: UnitDeletionPartsProps) {
  const persons = usePersonNames()
  const lines = rolesEndedSentences(plan, { person: (id) => persons.text({ person: id }), role: names.role, unit: names.unit }, s)
  if (lines.length === 0) return null
  return (
    <Box data-testid="roles-ended">
      <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5, fontSize: 13.5 }}>
        {lines.map((line) => <li key={line} data-testid="role-ended">{line}</li>)}
      </Box>
      <Typography sx={QUIET}>{s('unitDelete.peopleNote')}</Typography>
    </Box>
  )
}

/** The units inside it, and where they go. */
function Inside({ plan, choice, onChoice, names, s }: UnitDeletionPartsProps) {
  const [more, setMore] = useState(plan.initial !== 'up')
  const label = useId()
  const named = plan.inside.slice(0, NAMED).map((one) => one.name).join(', ')
  const rest = plan.inside.length - NAMED
  const unitType = names.type(plan.units[0].unitTypeId ?? '')
  const target = intoOf(choice) ?? plan.into[0]?.id
  const up = (
    <FormControlLabel key="up" value="up" control={<Radio size="small" />} data-testid="unit-delete-up" label={(
      <span>
        {plan.up.parentId === undefined ? s('unitDelete.upTop') : s('unitDelete.up', { parent: names.unit(plan.up.parentId) })}
        {!plan.up.fits && <Box component="span" sx={{ color: 'warning.main' }}>{` — ${s('unitDelete.misplaced')}`}</Box>}
      </span>
    )} />
  )
  const into = plan.into.length > 0 && target !== undefined && (
    <Box key="into" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <FormControlLabel value={`into:${target}`} control={<Radio size="small" />} data-testid="unit-delete-into"
        label={s('unitDelete.into', { type: unitType })} sx={{ mr: 0 }} />
      <TextField select size="small" value={target} data-testid="unit-delete-into-pick" label={s('unitDelete.intoPick', { type: unitType })}
        onChange={(event) => onChoice(`into:${event.target.value}`)} sx={{ minWidth: 160 }}>
        {plan.into.map((one) => <MenuItem key={one.id} value={one.id}>{one.name}</MenuItem>)}
      </TextField>
    </Box>
  )
  const remove = (
    <FormControlLabel key="delete" value="delete" control={<Radio size="small" />} data-testid="unit-delete-too" label={s('unitDelete.deleteToo')} />
  )
  const ordered = plan.initial === 'up' ? [up, into, remove] : [into, up, remove]
  return (
    <Box data-testid="unit-delete-inside">
      <Typography sx={HEAD} id={label}>
        {rest > 0 ? s('unitDelete.insideMore', { names: named, count: rest }) : s('unitDelete.inside', { names: named })}
      </Typography>
      <RadioGroup value={choice.startsWith('into:') ? `into:${target}` : choice} aria-labelledby={label} data-guide="unitDelete.inside"
        onChange={(event) => onChoice(event.target.value as UnitsChoice)}>
        {more ? ordered : ordered.slice(0, 1)}
      </RadioGroup>
      {!more && (
        <Button size="small" variant="text" sx={{ textTransform: 'none', px: 0.5, minWidth: 0 }} data-testid="unit-delete-more"
          aria-expanded={false} onClick={() => setMore(true)}>
          {s('unitDelete.otherChoices')}
        </Button>
      )}
    </Box>
  )
}

/** The applications whose team is cleared, the domains it serves and what it answers for. */
function Also({ plan, names, s }: UnitDeletionPartsProps) {
  const apps = plan.applications.length
  const lines = [
    apps > 0 ? s(apps === 1 ? 'unitDelete.applicationsOne' : 'unitDelete.applicationsOther', { count: apps }) : undefined,
    plan.serves.length > 0 ? s('unitDelete.serves', { domains: plan.serves.map(names.scope).join(', ') }) : undefined,
    plan.responsibleFor > 0
      ? s(plan.responsibleFor === 1 ? 'unitDelete.responsibleOne' : 'unitDelete.responsibleOther', { count: plan.responsibleFor })
      : undefined,
  ].filter((line) => line !== undefined)
  if (lines.length === 0) return null
  return (
    <Box data-testid="unit-delete-also">
      {lines.map((line) => <Typography key={line} sx={LINE}>{line}</Typography>)}
    </Box>
  )
}
