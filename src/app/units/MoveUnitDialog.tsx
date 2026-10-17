// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Move to…* a unit (ADR-0036, amended 17 October 2026; 3.7.1): where it
 * sits now, the unit to sit under — anywhere in the organisation, by its
 * path, or *At the top* — and the units beside it under the same parent to
 * move along, off until ticked. Before anything lands it says what the move
 * does (`model/unitMove`): a place its type may not sit in, which is allowed
 * and leaves the unit misplaced; a plan's move of it that overrides the
 * place from its own day; and who manages it from above, now and after, by
 * nesting or by a line. A loop is refused here, with why.
 *
 * Landing is the caller's (`useMoveUnit`): one step in each scope that keeps
 * a unit moved, all or none. A refusal is said here and the dialog stays.
 */
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { Command } from '../../model/commands'
import type { PersonId } from '../../model/person'
import type { ElementId } from '../../model/types'
import { unitFits, unitMove, unitsBeside } from '../../model/unitMove'
import type { ManagersMoved, UnitMovePlan, UnitMoveRefusal } from '../../model/unitMove'
import { organisationOn } from '../../model/units'
import type { Manager, Organisation } from '../../model/units'
import type { ScopePath } from '../../projects/scopePath'
import { FieldLabel, FieldsDialog, FieldText } from '../../widgets/CompactForms'
import { GroupedPicker } from '../../widgets/PickToAdd'
import { AT_THE_TOP, parentChoices } from './choices'

export type MoveUnitDialogProps = {
  unitId: ElementId
  organisation: Organisation
  scopeOf: (id: ElementId) => ScopePath | undefined
  scopeLabel: (path: ScopePath) => string
  /** What to call a unit. */
  name: (id: ElementId) => string
  /** What to call a person: the register's name. */
  personName: (person: PersonId) => string
  today: string
  /** Land the move: nothing where it landed, otherwise what to say. */
  onMove: (steps: ReadonlyMap<ScopePath, readonly Command[]>) => Promise<string | undefined>
  onClose: () => void
  s: Translate
}

export function MoveUnitDialog(props: MoveUnitDialogProps) {
  const { unitId, organisation, today, s, onClose } = props
  const [parent, setParent] = useState<string | null>(null)
  const [along, setAlong] = useState<ReadonlySet<ElementId>>(new Set())
  const [said, setSaid] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const current = useMemo(() => organisationOn(organisation, today).units.find((one) => one.id === unitId)?.parentId, [organisation, today, unitId])
  const beside = useMemo(() => unitsBeside(organisation, unitId, today), [organisation, unitId, today])
  const unitIds = useMemo(() => [unitId, ...beside.filter((one) => along.has(one.id)).map((one) => one.id)], [unitId, beside, along])
  const options = useMemo(() => parentChoices({
    organisation, unitIds, current, day: today, scopeName: props.scopeLabel, s,
    fits: (parentId) => unitIds.every((id) => {
      const unit = organisation.units.find((one) => one.id === id)
      return unit === undefined || unitFits(organisation, unit, parentId)
    }),
  }), [organisation, unitIds, current, today, props.scopeLabel, s])
  const parentId = parent === null || parent === AT_THE_TOP ? undefined : parent
  const plan = useMemo(
    () => (parent === null ? undefined : unitMove({ organisation, scopeOf: props.scopeOf, unitIds, ...(parentId !== undefined ? { parentId } : {}), day: today })),
    [parent, organisation, props.scopeOf, unitIds, parentId, today],
  )
  const ready = plan?.ok === true && plan.moved.length > 0 && !busy
  const move = () => {
    if (!ready || !plan?.ok) return
    setBusy(true)
    setSaid(undefined)
    void props.onMove(plan.steps).then((refused) => {
      setBusy(false)
      if (refused === undefined) onClose()
      else setSaid(refused)
    })
  }
  const toggle = (id: ElementId) => setAlong((held) => {
    const next = new Set(held)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  return (
    <FieldsDialog open onClose={onClose} maxWidth="sm" fullWidth data-testid="move-unit-dialog" data-guide="chart.moveUnit">
      <DialogTitle sx={{ fontSize: 16 }}>{s('unitMove.title', { name: props.name(unitId) })}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 1.25, pt: '8px !important' }}>
        <FieldText quiet testId="move-unit-now">
          {current === undefined ? s('unitMove.atTopNow') : s('unitMove.sitsNow', { parent: props.name(current) })}
        </FieldText>
        <GroupedPicker
          options={options} field={s('unitMove.parent')} nothing={s('unitMove.nothing')} value={parent}
          onPick={(id) => { setParent(id); setSaid(undefined) }} testId="move-unit-parent"
        />
        {beside.length > 0 && (
          <Box data-testid="move-unit-along">
            <FieldLabel>{s('unitMove.along')}</FieldLabel>
            <FieldText quiet>{s('unitMove.alongHint')}</FieldText>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {beside.map((one) => (
                <FormControlLabel
                  key={one.id} label={<Typography sx={{ fontSize: 12.5 }}>{one.name}</Typography>}
                  control={<Checkbox checked={along.has(one.id)} onChange={() => toggle(one.id)} slotProps={{ input: { 'aria-label': one.name } }} data-testid="move-unit-along-unit" data-unit-id={one.id} />}
                />
              ))}
            </Box>
          </Box>
        )}
        {plan && <WhatItDoes {...props} plan={plan} parentId={parentId} />}
        <FieldText quiet>{s('unitMove.keeps')}</FieldText>
        {said && <Typography role="status" data-testid="move-unit-said" sx={{ fontSize: 12, color: 'error.main' }}>{said}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose}>{s('unitMove.cancel')}</Button>
        <Button size="small" variant="contained" disabled={!ready} onClick={move} data-testid="move-unit-move">{s('unitMove.move')}</Button>
      </DialogActions>
    </FieldsDialog>
  )
}

/** Why a move is refused, said. */
function refusalText(refusal: UnitMoveRefusal, name: (id: ElementId) => string, s: Translate, parentId: ElementId | undefined): string {
  if (refusal.reason === 'itself') return s('unitMove.refusedItself')
  if (refusal.reason === 'loop' && parentId !== undefined) return s('unitMove.refusedLoop', { parent: name(parentId), unit: name(refusal.unitId), day: refusal.day })
  return s('unitMove.refusedOther')
}

/** What the move does, before it lands: refused, already there, a misfit, a plan's move, and who manages. */
function WhatItDoes({ plan, parentId, name, organisation, s, ...props }: MoveUnitDialogProps & {
  plan: UnitMovePlan | UnitMoveRefusal; parentId: ElementId | undefined
}) {
  if (!plan.ok) {
    return <Typography role="status" data-testid="move-unit-refused" sx={{ fontSize: 12.5, color: 'error.main' }}>{refusalText(plan, name, s, parentId)}</Typography>
  }
  if (plan.moved.length === 0) return <FieldText quiet testId="move-unit-already">{s('unitMove.already')}</FieldText>
  const typeName = (id: string | undefined) => organisation.unitTypes.find((one) => one.id === id)?.name ?? id ?? ''
  const typeOf = (id: ElementId) => organisation.units.find((one) => one.id === id)?.unitTypeId
  return (
    <>
      {plan.fits.filter((one) => !one.fits).map((one) => (
        <Typography key={one.unitId} sx={{ fontSize: 12.5, color: 'warning.main' }} data-testid="move-unit-misfit">
          {s('unitMove.misfit', { unit: name(one.unitId), type: typeName(typeOf(one.unitId)) })}
        </Typography>
      ))}
      {plan.planned.map((one) => (
        <Typography key={`${one.unitId}/${one.on}`} sx={{ fontSize: 12.5, color: 'text.secondary' }} data-testid="move-unit-planned">
          {s(one.reached ? 'unitMove.plannedReached' : 'unitMove.plannedLater', { unit: name(one.unitId), day: one.on })}
        </Typography>
      ))}
      <ManagedBy managers={plan.managers.filter((one) => plan.moved.includes(one.unitId))} name={name} organisation={organisation} s={s} {...props} />
    </>
  )
}

/** Who manages each unit moved from above it, today, before and after. */
function ManagedBy({ managers, name, organisation, personName, s }: Pick<MoveUnitDialogProps, 'name' | 'organisation' | 'personName' | 's'> & {
  managers: readonly ManagersMoved[]
}) {
  const roleName = (id: string) => organisation.roles.find((one) => one.id === id)?.name ?? id
  const said = (list: readonly Manager[]) => (list.length === 0
    ? s('unitMove.managedNobody')
    : list.map((one) => `${s('unit.managedByLine', { person: personName(one.person), role: roleName(one.roleId), unit: name(one.unitId) })}${one.via === 'line' ? ` · ${s('unit.byLine')}` : one.via === 'override' ? ` · ${s('unit.byOverride')}` : ''}`).join('; '))
  return (
    <Box data-testid="move-unit-managed">
      <FieldLabel>{s('unitMove.managedBy')}</FieldLabel>
      <FieldText quiet>{s('unitMove.managedHint')}</FieldText>
      {managers.map((one) => (
        <Box key={one.unitId} sx={{ mt: 0.5 }} data-testid="move-unit-managed-unit" data-unit-id={one.unitId}>
          {managers.length > 1 && <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{name(one.unitId)}</Typography>}
          <Typography sx={{ fontSize: 12.5 }} data-testid="move-unit-managed-before">{s('unitMove.managedNow', { managers: said(one.before) })}</Typography>
          <Typography sx={{ fontSize: 12.5 }} data-testid="move-unit-managed-after">{s('unitMove.managedAfter', { managers: said(one.after) })}</Typography>
        </Box>
      ))}
    </Box>
  )
}
