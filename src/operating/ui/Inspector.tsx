// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The item picked on the page, edited: a unit type's name, purpose, place,
 * slots and limit; a role's names, purpose and whether it manages its unit; a
 * responsibility's name, description and group. Every keystroke is live and
 * one undo step per field (`edit.ts`).
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Command } from '../../model/commands'
import { typesHolding } from '../../model/operatingModel'
import type { BasedOn, Responsibility, Role, UnitType } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import { CloseIcon } from '../../widgets/icons'
import {
  addSlot, editResponsibility, editRole, editUnitType, removeSlot, setFlag, setLimit, setSlot, setWithin,
} from '../edit'
import type { OperatingItem, OperatingModel } from '../edit'
import { entryOf } from '../library'
import { libraryById } from '../libraries'

type Props = {
  model: OperatingModel
  picked: OperatingItem | undefined
  readOnly: boolean
  dispatch(command: Command): void
  onRemove(id: string): void
}

const heading = { fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mt: 2, mb: 0.5 } as const

export function Inspector({ model, picked, readOnly, dispatch, onRemove }: Props) {
  const { t } = useStrings()
  if (!picked) return <Typography variant="body2" color="text.secondary">{t('operating.pick')}</Typography>
  const kindWord = { unitType: 'operating.unitType', role: 'operating.role', responsibility: 'operating.responsibility' } as const
  return (
    <Box data-testid="operating-inspector">
      <Typography variant="caption" color="text.secondary">{t(kindWord[picked.kind])}</Typography>
      {picked.kind === 'unitType' && <UnitTypeFields type={picked.item} model={model} readOnly={readOnly} dispatch={dispatch} />}
      {picked.kind === 'role' && <RoleFields role={picked.item} model={model} readOnly={readOnly} dispatch={dispatch} />}
      {picked.kind === 'responsibility' && <ResponsibilityFields responsibility={picked.item} readOnly={readOnly} dispatch={dispatch} />}
      <BasedOnLine basedOn={picked.item.basedOn} />
      {!readOnly && (
        <Button color="error" size="small" sx={{ mt: 2, textTransform: 'none', px: 0 }} onClick={() => onRemove(picked.item.id)}>
          {t('operating.remove')}
        </Button>
      )}
    </Box>
  )
}

function BasedOnLine({ basedOn }: { basedOn: BasedOn | undefined }) {
  const { t } = useStrings()
  if (!basedOn) return <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>{t('operating.ownItem')}</Typography>
  const library = libraryById(basedOn.library)
  const entry = library && entryOf(library, basedOn.entry)
  const language = basedOn.language === 'nl' || basedOn.language === 'de' ? basedOn.language : 'en'
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
      {t('operating.basedOn', { library: library?.name ?? basedOn.library, entry: entry?.item.name[language] ?? basedOn.entry })}
    </Typography>
  )
}

function UnitTypeFields({ type, model, readOnly, dispatch }: { type: UnitType; model: OperatingModel; readOnly: boolean; dispatch(command: Command): void }) {
  const { t } = useStrings()
  const others = model.unitTypes.filter((one) => one.id !== type.id)
  return (
    <Box>
      <TextField fullWidth size="small" margin="dense" label={t('operating.name')} value={type.name} disabled={readOnly}
        onChange={(event) => dispatch(editUnitType(type.id, 'name', event.target.value))} />
      <TextField fullWidth size="small" margin="dense" multiline minRows={2} label={t('operating.purpose')} value={type.purpose ?? ''} disabled={readOnly}
        onChange={(event) => dispatch(editUnitType(type.id, 'purpose', event.target.value))} />
      <Typography sx={heading}>{t('operating.whereItSits')}</Typography>
      <FormControlLabel
        control={<Checkbox size="small" checked={type.top === true} disabled={readOnly} onChange={(_event, on) => dispatch(setFlag('unitType', type.id, 'top', on))} />}
        label={t('operating.top')}
      />
      {others.map((other) => (
        <FormControlLabel key={other.id} sx={{ display: 'flex' }}
          control={<Checkbox size="small" checked={type.within.includes(other.id)} disabled={readOnly} onChange={(_event, on) => dispatch(setWithin(type, other.id, on))} />}
          label={other.name}
        />
      ))}
      <FormControlLabel
        control={<Checkbox size="small" checked={type.spans === true} disabled={readOnly} onChange={(_event, on) => dispatch(setFlag('unitType', type.id, 'spans', on))} />}
        label={t('operating.spans')}
      />
      <Slots type={type} model={model} readOnly={readOnly} dispatch={dispatch} />
      <TextField size="small" margin="dense" type="number" label={t('operating.limit')} value={type.limit ?? ''} disabled={readOnly}
        helperText={t('operating.limitHint')} slotProps={{ htmlInput: { min: 0 } }} sx={{ mt: 2 }} fullWidth
        onChange={(event) => dispatch(setLimit(type, event.target.value === '' ? undefined : Number(event.target.value)))} />
    </Box>
  )
}

function Slots({ type, model, readOnly, dispatch }: { type: UnitType; model: OperatingModel; readOnly: boolean; dispatch(command: Command): void }) {
  const { t } = useStrings()
  const [adding, setAdding] = useState('')
  const free = model.roles.filter((role) => !type.slots.some((slot) => slot.role === role.id))
  const number = (value: string) => (value === '' ? undefined : Math.max(0, Number(value)))
  return (
    <Box>
      <Typography sx={heading}>{t('operating.slots')}</Typography>
      {type.slots.map((slot, index) => {
        const name = model.roles.find((role) => role.id === slot.role)?.name ?? slot.role
        return (
          <Box key={`${slot.role}-${index}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, my: 0.5 }}>
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>{name}</Typography>
            <TextField size="small" type="number" value={slot.min} disabled={readOnly} sx={{ width: 68 }}
              slotProps={{ htmlInput: { min: 0, 'aria-label': `${name}: ${t('operating.slotMin')}` } }}
              onChange={(event) => dispatch(setSlot(type, index, { min: number(event.target.value) ?? 0 }))} />
            <TextField size="small" type="number" value={slot.max ?? ''} placeholder="∞" disabled={readOnly} sx={{ width: 68 }}
              slotProps={{ htmlInput: { min: 0, 'aria-label': `${name}: ${t('operating.slotMax')}` } }}
              onChange={(event) => dispatch(setSlot(type, index, { max: number(event.target.value) }))} />
            {!readOnly && (
              <IconButton size="small" aria-label={t('operating.slotRemove', { role: name })} onClick={() => dispatch(removeSlot(type, index))}>
                <CloseIcon />
              </IconButton>
            )}
          </Box>
        )
      })}
      {!readOnly && free.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
          <TextField select size="small" value={adding} sx={{ flex: 1 }} label={t('operating.addSlotPick')}
            onChange={(event) => setAdding(event.target.value)}>
            {free.map((role) => <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>)}
          </TextField>
          <Button size="small" variant="outlined" disabled={!adding} sx={{ textTransform: 'none' }}
            onClick={() => { dispatch(addSlot(type, adding)); setAdding('') }}>
            {t('operating.addSlot')}
          </Button>
        </Box>
      )}
    </Box>
  )
}

function RoleFields({ role, model, readOnly, dispatch }: { role: Role; model: OperatingModel; readOnly: boolean; dispatch(command: Command): void }) {
  const { t } = useStrings()
  const holding = typesHolding(model.unitTypes, role.id)
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField size="small" margin="dense" label={t('operating.name')} value={role.name} disabled={readOnly} sx={{ flex: 1 }}
          onChange={(event) => dispatch(editRole(role.id, 'name', event.target.value))} />
        <TextField size="small" margin="dense" label={t('operating.short')} value={role.short ?? ''} disabled={readOnly} sx={{ width: 90 }}
          onChange={(event) => dispatch(editRole(role.id, 'short', event.target.value))} />
      </Box>
      <TextField fullWidth size="small" margin="dense" multiline minRows={3} label={t('operating.purpose')} value={role.purpose ?? ''} disabled={readOnly}
        onChange={(event) => dispatch(editRole(role.id, 'purpose', event.target.value))} />
      <Typography sx={heading}>{t('operating.manages')}</Typography>
      <FormControlLabel
        control={<Checkbox size="small" checked={role.manages === true} disabled={readOnly} onChange={(_event, on) => dispatch(setFlag('role', role.id, 'manages', on))} />}
        label={t('operating.manages')}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{t('operating.managesHint')}</Typography>
      <Typography sx={heading}>{t('operating.duties')}</Typography>
      {role.duties.length === 0
        ? <Typography variant="body2" color="text.secondary">{t('operating.noDuties')}</Typography>
        : role.duties.map((duty) => (
          <Typography key={duty.responsibility} variant="body2">
            <Box component="span" sx={{ fontWeight: 700, mr: 1 }}>{duty.raci}</Box>
            {model.responsibilities.find((one) => one.id === duty.responsibility)?.name ?? duty.responsibility}
          </Typography>
        ))}
      <Typography sx={heading}>{t('operating.heldIn')}</Typography>
      <Typography variant="body2">{holding.length ? holding.map((type) => type.name).join(', ') : t('operating.inNoType')}</Typography>
    </Box>
  )
}

function ResponsibilityFields({ responsibility, readOnly, dispatch }: { responsibility: Responsibility; readOnly: boolean; dispatch(command: Command): void }) {
  const { t } = useStrings()
  return (
    <Box>
      <TextField fullWidth size="small" margin="dense" label={t('operating.name')} value={responsibility.name} disabled={readOnly}
        onChange={(event) => dispatch(editResponsibility(responsibility.id, 'name', event.target.value))} />
      <TextField fullWidth size="small" margin="dense" multiline minRows={2} label={t('operating.description')} value={responsibility.description ?? ''} disabled={readOnly}
        onChange={(event) => dispatch(editResponsibility(responsibility.id, 'description', event.target.value))} />
      <TextField fullWidth size="small" margin="dense" label={t('operating.group')} value={responsibility.group ?? ''} disabled={readOnly}
        onChange={(event) => dispatch(editResponsibility(responsibility.id, 'group', event.target.value))} />
    </Box>
  )
}
