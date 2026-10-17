// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The item picked on the page, edited: a unit type's name, purpose, place,
 * slots and limit; a role's names, purpose and whether it manages its unit; a
 * responsibility's name, description and group. Every keystroke is live and
 * one undo step per field (`edit.ts`).
 *
 * **Over time** (ADR-0036 §6): a unit type and a role have a first and a last
 * day and name what follows them. A new name is an edit; a thing that stops
 * existing ends on a day. The people that leaves to decide are the host's to
 * say (`aside`), since this page knows the model and nobody's name — and so
 * are the people a role taken out of a unit type leaves (`onRemoveSlot`,
 * `slotAside`), said under the slots before it is taken out.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Command } from '../../model/commands'
import { linesInto, linesSaid, typesHolding } from '../../model/operatingModel'
import type { BasedOn, ReportsTo, Responsibility, Role, RoleId, RoleSlot, UnitType } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import { CloseIcon } from '../../widgets/icons'
import { CompactForms, SectionHeading } from '../../widgets/CompactForms'
import {
  addSlot, editResponsibility, editRole, editUnitType, removeSlot, setDay, setFlag, setLimit, setReportsTo, setRoleReportsTo, setSlot, setSuccessors,
  setWithin,
} from '../edit'
import type { OperatingItem, OperatingModel } from '../edit'
import { entryOf } from '../library'
import { libraryById } from '../libraries'
import { LinesEditor } from './LinesEditor'
import { ResponsibilityOrder, RoleOrder } from './OwnOrder'
import { TypePlace } from './TypePlace'

type Props = {
  model: OperatingModel
  picked: OperatingItem | undefined
  readOnly: boolean
  dispatch(command: Command): void
  onRemove(id: string): void
  /** What the host says beside the item: for one that ends, the people it leaves to decide. */
  aside?: ReactNode
  /** A slot's ✕ pressed: the page decides whether it goes at once. Absent, it does. */
  onRemoveSlot?(type: UnitType, index: number): void
  /** What the host says under the slots of a role being taken out: the people it leaves. */
  slotAside?: ReactNode
  /**
   * Why a slot's solid reporting line would be refused (ADR-0039 §5): the
   * sentence, where it would close a loop over the organisation, which the
   * host knows and this page does not. Absent: nothing is refused.
   */
  refuseLine?: RefuseLine
}

/** A change of lines about to be written: a slot's, with the slots as they would be, or a role's own. */
export type LineChange =
  | { on: 'slot'; type: UnitType; slots: readonly RoleSlot[]; roleId: RoleId; said: readonly ReportsTo[] | undefined }
  | { on: 'role'; roleId: RoleId; said: readonly ReportsTo[] | undefined }

/** Why the lines as they would be are refused: a sentence, or nothing. */
export type RefuseLine = (change: LineChange) => string | undefined

/** How a unit type's slots are taken out, and what is said under them while one is; and why a slot's line is refused. */
type SlotTaking = Pick<Props, 'onRemoveSlot' | 'slotAside' | 'refuseLine'>


export function Inspector({ model, picked, readOnly, dispatch, onRemove, aside, onRemoveSlot, slotAside, refuseLine }: Props) {
  const { t } = useStrings()
  if (!picked) return <Typography variant="body2" color="text.secondary">{t('operating.pick')}</Typography>
  const kindWord = { unitType: 'operating.unitType', role: 'operating.role', responsibility: 'operating.responsibility' } as const
  return (
    <CompactForms>
    <Box data-testid="operating-inspector">
      <Typography variant="caption" color="text.secondary">{t(kindWord[picked.kind])}</Typography>
      {picked.kind === 'unitType' && (
        <UnitTypeFields type={picked.item} model={model} readOnly={readOnly} dispatch={dispatch} taking={{ onRemoveSlot, slotAside, refuseLine }} />
      )}
      {picked.kind === 'role' && (
        <>
          <RoleFields role={picked.item} model={model} readOnly={readOnly} dispatch={dispatch} />
          <RoleLines role={picked.item} model={model} readOnly={readOnly} dispatch={dispatch} refuseLine={refuseLine} />
          <RoleOrder role={picked.item} model={model} readOnly={readOnly} dispatch={dispatch} />
        </>
      )}
      {picked.kind === 'responsibility' && (
        <>
          <ResponsibilityFields responsibility={picked.item} readOnly={readOnly} dispatch={dispatch} />
          <ResponsibilityOrder responsibility={picked.item} model={model} readOnly={readOnly} dispatch={dispatch} />
        </>
      )}
      {picked.kind !== 'responsibility' && (
        <OverTime kind={picked.kind} item={picked.item} others={picked.kind === 'role' ? model.roles : model.unitTypes} readOnly={readOnly} dispatch={dispatch} />
      )}
      {aside}
      <BasedOnLine basedOn={picked.item.basedOn} />
      {!readOnly && (
        <Button color="error" size="small" sx={{ mt: 2, textTransform: 'none', px: 0 }} onClick={() => onRemove(picked.item.id)}>
          {t('operating.remove')}
        </Button>
      )}
    </Box>
    </CompactForms>
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

function UnitTypeFields({ type, model, readOnly, dispatch, taking }: {
  type: UnitType; model: OperatingModel; readOnly: boolean; dispatch(command: Command): void; taking: SlotTaking
}) {
  const { t } = useStrings()
  const others = model.unitTypes.filter((one) => one.id !== type.id)
  return (
    <Box>
      <TextField fullWidth size="small" margin="dense" label={t('operating.name')} value={type.name} disabled={readOnly}
        onChange={(event) => dispatch(editUnitType(type.id, 'name', event.target.value))} />
      <TextField fullWidth size="small" margin="dense" multiline minRows={2} label={t('operating.purpose')} value={type.purpose ?? ''} disabled={readOnly}
        onChange={(event) => dispatch(editUnitType(type.id, 'purpose', event.target.value))} />
      <SectionHeading sx={{ mt: 2, mb: 0.5 }}>{t('operating.whereItSits')}</SectionHeading>
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
      <TypePlace type={type} model={model} readOnly={readOnly} dispatch={dispatch} />
      <Slots type={type} model={model} readOnly={readOnly} dispatch={dispatch} taking={taking} />
      <TextField size="small" margin="dense" type="number" label={t('operating.limit')} value={type.limit ?? ''} disabled={readOnly}
        helperText={t('operating.limitHint')} slotProps={{ htmlInput: { min: 0 } }} sx={{ mt: 2 }} fullWidth
        onChange={(event) => dispatch(setLimit(type, event.target.value === '' ? undefined : Number(event.target.value)))} />
    </Box>
  )
}

function Slots({ type, model, readOnly, dispatch, taking }: {
  type: UnitType; model: OperatingModel; readOnly: boolean; dispatch(command: Command): void; taking: SlotTaking
}) {
  const { t } = useStrings()
  const [adding, setAdding] = useState('')
  const takeOut = (index: number) => (taking.onRemoveSlot ? taking.onRemoveSlot(type, index) : dispatch(removeSlot(type, index)))
  const free = model.roles.filter((role) => !type.slots.some((slot) => slot.role === role.id))
  const number = (value: string) => (value === '' ? undefined : Math.max(0, Number(value)))
  return (
    <Box>
      <SectionHeading sx={{ mt: 2, mb: 0.5 }}>{t('operating.slots')}</SectionHeading>
      {type.slots.length > 0 && (
        // What the two boxes on every row hold, said once above them.
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }} aria-hidden="true">
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ width: 68, textAlign: 'center' }}>{t('operating.slotMin')}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ width: 68, textAlign: 'center' }}>{t('operating.slotMax')}</Typography>
          {!readOnly && <Box sx={{ width: 30 }} />}
        </Box>
      )}
      {type.slots.map((slot, index) => {
        const name = model.roles.find((role) => role.id === slot.role)?.name ?? slot.role
        return (
          <Box key={`${slot.role}-${index}`} data-testid="operating-slot">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, my: 0.5 }}>
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>{name}</Typography>
            <TextField size="small" type="number" value={slot.min} disabled={readOnly} sx={{ width: 68 }}
              slotProps={{ htmlInput: { min: 0, 'aria-label': `${name}: ${t('operating.slotMin')}` } }}
              onChange={(event) => dispatch(setSlot(type, index, { min: number(event.target.value) ?? 0 }))} />
            <TextField size="small" type="number" value={slot.max ?? ''} placeholder="∞" disabled={readOnly} sx={{ width: 68 }}
              slotProps={{ htmlInput: { min: 0, 'aria-label': `${name}: ${t('operating.slotMax')}` } }}
              onChange={(event) => dispatch(setSlot(type, index, { max: number(event.target.value) }))} />
            {!readOnly && (
              <IconButton size="small" aria-label={t('operating.slotRemove', { role: name })} onClick={() => takeOut(index)}>
                <CloseIcon />
              </IconButton>
            )}
          </Box>
          <SlotLine type={type} index={index} name={name} model={model} readOnly={readOnly} dispatch={dispatch} refuseLine={taking.refuseLine} />
          </Box>
        )
      })}
      {taking.slotAside}
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

/**
 * Where a slot's holders report (ADR-0039 §2, §7, amended): the role's own
 * lines hold for every unit of the type until the slot says otherwise — a
 * role, in the same unit or found above, solid or dotted, with its days — or
 * *by nesting*, which takes the role's line away for this type. A line the
 * host says would close a loop is refused, said why, and not written.
 */
function SlotLine({ type, index, name, model, readOnly, dispatch, refuseLine }: {
  type: UnitType; index: number; name: string; model: OperatingModel; readOnly: boolean; dispatch(command: Command): void
  refuseLine: RefuseLine | undefined
}) {
  const slot = type.slots[index]
  const role = model.roles.find((one) => one.id === slot.role)
  return (
    <Box sx={{ pl: 1, mb: 0.75 }} data-testid="operating-slot-line">
      <LinesEditor
        roleId={slot.role} name={name} said={linesSaid(slot.reportsTo)} inherited={linesSaid(role?.reportsTo)} roles={model.roles} readOnly={readOnly}
        testId="operating-slot-lines"
        onChange={(next) => {
          const { slots, command } = setReportsTo(type, index, next)
          const why = refuseLine?.({ on: 'slot', type, slots, roleId: slot.role, said: next })
          if (!why) dispatch(command)
          return why
        }}
      />
    </Box>
  )
}

/** Where a role's holders report wherever it is held (ADR-0039 §2, amended), and who reports to it across the model. */
function RoleLines({ role, model, readOnly, dispatch, refuseLine }: {
  role: Role; model: OperatingModel; readOnly: boolean; dispatch(command: Command): void; refuseLine: RefuseLine | undefined
}) {
  const { t } = useStrings()
  const into = linesInto(model.unitTypes, model.roles, role.id)
  const roleName = (id: string) => model.roles.find((one) => one.id === id)?.name ?? id
  const typeName = (id: string | undefined) => model.unitTypes.find((one) => one.id === id)?.name ?? id ?? ''
  return (
    <Box>
      <SectionHeading sx={{ mt: 2, mb: 0.5 }}>{t('operating.reportsTo')}</SectionHeading>
      <LinesEditor
        roleId={role.id} name={role.name} said={linesSaid(role.reportsTo)} roles={model.roles} readOnly={readOnly} testId="operating-role-lines"
        onChange={(next) => {
          const why = refuseLine?.({ on: 'role', roleId: role.id, said: next })
          if (!why) dispatch(setRoleReportsTo(role, next))
          return why
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{t('operating.reportsToHint')}</Typography>
      <SectionHeading sx={{ mt: 2, mb: 0.5 }}>{t('operating.reportedToBy')}</SectionHeading>
      {into.length === 0
        ? <Typography variant="body2" color="text.secondary">{t('operating.reportedToByNone')}</Typography>
        : into.map((line, at) => (
          <Typography key={`${line.from}/${line.typeId ?? ''}/${line.kind}/${at}`} variant="body2" data-testid="operating-reported-by">
            {line.source === 'role'
              ? t('operating.reportedByRole', { role: roleName(line.from) })
              : t('operating.reportedBySlot', { role: roleName(line.from), type: typeName(line.typeId) })}
            {' · '}{t(line.kind === 'solid' ? 'operating.lineSolid' : 'operating.lineDotted').toLowerCase()}
            {line.within ? ` · ${t('operating.lineWithinShort')}` : ''}
          </Typography>
        ))}
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
      <SectionHeading sx={{ mt: 2, mb: 0.5 }}>{t('operating.manages')}</SectionHeading>
      <FormControlLabel
        control={<Checkbox size="small" checked={role.manages === true} disabled={readOnly} onChange={(_event, on) => dispatch(setFlag('role', role.id, 'manages', on))} />}
        label={t('operating.manages')}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{t('operating.managesHint')}</Typography>
      <SectionHeading sx={{ mt: 2, mb: 0.5 }}>{t('operating.duties')}</SectionHeading>
      {role.duties.length === 0
        ? <Typography variant="body2" color="text.secondary">{t('operating.noDuties')}</Typography>
        : role.duties.map((duty) => (
          <Typography key={duty.responsibility} variant="body2">
            <Box component="span" sx={{ fontWeight: 700, mr: 1 }}>{duty.raci}</Box>
            {model.responsibilities.find((one) => one.id === duty.responsibility)?.name ?? duty.responsibility}
          </Typography>
        ))}
      <SectionHeading sx={{ mt: 2, mb: 0.5 }}>{t('operating.heldIn')}</SectionHeading>
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

/**
 * A unit type's or a role's days and what follows it (ADR-0036 §6): the first
 * day, the last day, and the successors a reorganisation suggests in its
 * place. Each change is one step.
 */
function OverTime({ kind, item, others, readOnly, dispatch }: {
  kind: 'unitType' | 'role'
  item: UnitType | Role
  others: readonly { id: string; name: string }[]
  readOnly: boolean
  dispatch(command: Command): void
}) {
  const { t } = useStrings()
  const candidates = others.filter((one) => one.id !== item.id)
  const successors = item.successors ?? []
  return (
    <Box data-testid="operating-over-time">
      <SectionHeading sx={{ mt: 2, mb: 0.5 }}>{t('operating.overTime')}</SectionHeading>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField size="small" type="date" label={t('operating.from')} value={item.from ?? ''} disabled={readOnly} sx={{ flex: 1 }}
          onChange={(event) => dispatch(setDay(kind, item.id, 'from', event.target.value))}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'data-testid': 'operating-from' } }} />
        <TextField size="small" type="date" label={t('operating.until')} value={item.until ?? ''} disabled={readOnly} sx={{ flex: 1 }}
          onChange={(event) => dispatch(setDay(kind, item.id, 'until', event.target.value))}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'data-testid': 'operating-until' } }} />
      </Box>
      {candidates.length > 0 && (
        <TextField select size="small" fullWidth margin="dense" label={t('operating.successors')} value={successors} disabled={readOnly}
          onChange={(event) => {
            const value = event.target.value as unknown
            dispatch(setSuccessors(kind, item.id, Array.isArray(value) ? value as string[] : String(value).split(',')))
          }}
          slotProps={{ select: { multiple: true }, htmlInput: { 'data-testid': 'operating-successors' } }}>
          {candidates.map((one) => <MenuItem key={one.id} value={one.id}>{one.name}</MenuItem>)}
        </TextField>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{t('operating.overTimeHint')}</Typography>
    </Box>
  )
}
