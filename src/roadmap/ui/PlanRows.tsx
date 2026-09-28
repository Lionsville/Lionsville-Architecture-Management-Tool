// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One row of what a plan names, and one of what it rests on — apart from
 * `PlanPage.tsx` so the facts column stays a list of fields.
 *
 * Each row says the three things its gate line cannot clear without: a record
 * or an element deleted since is *no longer here*, rather than an id nobody
 * can place, beside the button that takes it off the plan; a record not yet
 * accepted says its status; and a stand-in says where its dates are kept,
 * rather than offering three date fields its scope would refuse to write
 * (ADR-0012 §3).
 */
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { DATED_PHASES, isDay } from '../../model'
import type { DesignElement, ElementId, LifecycleDates, Transition, TransitionRole } from '../../model'
import type { Adr } from '../../model/adr'
import { STATUS_LABEL as ADR_STATUS_LABEL, formatAdrNumber } from '../../decisions'
import { useStrings } from '../../i18n'
import type { StringKey } from '../../i18n'
import type { DescribeElsewhere } from '../planGateHints'
import { ROLES, namedSelect } from './PlanFacts'

/** A row naming what is no longer there, in the words its gate hint uses. */
function Gone({ children }: { children: string }) {
  return (
    <Typography data-gone sx={{ fontSize: 13, flex: 1, minWidth: 0, color: 'text.secondary', fontStyle: 'italic' }}>
      {children}
    </Typography>
  )
}

/** One element the plan names: its role, its name, and the dates on it where the role has any. */
export function ElementRow({ row, element, readOnly, describe, onRole, onRemove, onOpen, onDates }: {
  row: Transition['elements'][number]
  /** Absent when the element was deleted since. */
  element: DesignElement | undefined
  readOnly: boolean
  describe?: DescribeElsewhere
  onRole(role: TransitionRole): void
  onRemove(): void
  onOpen(): void
  onDates(dates: LifecycleDates | undefined): void
}) {
  const { t } = useStrings()
  return (
    <Box data-testid={`plan-element-${row.elementId}`} sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TextField
          select size="small" value={row.role} disabled={readOnly} sx={{ width: 130 }}
          slotProps={namedSelect(t('plan.role'))}
          onChange={(e) => onRole(e.target.value as TransitionRole)}
        >
          {ROLES.map((role) => <MenuItem key={role} value={role}>{t(`plan.${role}` as StringKey)}</MenuItem>)}
        </TextField>
        {element ? (
          <Typography
            sx={{ fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
            onClick={onOpen}
          >
            {element.name}
          </Typography>
        ) : <Gone>{t('plan.goneElement')}</Gone>}
        {!readOnly && <Button size="small" onClick={onRemove}>{t('plan.remove')}</Button>}
      </Box>
      {element && row.role !== 'changes' && (element.ref === undefined
        ? <ElementDates element={element} readOnly={readOnly} onChange={onDates} />
        : <StandInDates id={element.id} role={row.role} describe={describe} />)}
    </Box>
  )
}

/**
 * Where a stand-in's dates are kept, and — for one the plan retires — the
 * day gone its scope gives it, which is the one date that reaches this one.
 */
function StandInDates({ id, role, describe }: { id: ElementId; role: TransitionRole; describe?: DescribeElsewhere }) {
  const { t } = useStrings()
  const told = describe?.(id)
  const scope = told?.where
  return (
    <Typography variant="caption" color="text.secondary" data-testid={`plan-standin-${id}`}>
      {role === 'retires' && scope && isDay(told?.retired)
        ? t('plan.standInGoneOn', { day: told.retired, scope })
        : scope ? t('plan.standInDates', { scope }) : t('plan.standInDatesSomewhere')}
    </Typography>
  )
}

/** The three dates on an element the plan introduces or retires. */
function ElementDates({ element, readOnly, onChange }: {
  element: DesignElement
  readOnly: boolean
  onChange(dates: LifecycleDates | undefined): void
}) {
  const { t } = useStrings()
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {DATED_PHASES.map((phase) => (
        <TextField
          key={phase}
          type="date" size="small" fullWidth
          label={t(`plan.date.${phase}` as StringKey)}
          value={element.lifecycleDates?.[phase] ?? ''}
          disabled={readOnly}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': `${element.name}: ${t(`plan.date.${phase}` as StringKey)}` } }}
          onChange={(e) => {
            const next = { ...element.lifecycleDates }
            if (e.target.value) next[phase] = e.target.value
            else delete next[phase]
            onChange(Object.keys(next).length ? next : undefined)
          }}
        />
      ))}
    </Box>
  )
}

/** One record the plan rests on: its number and title, and its status while it is not accepted. */
export function DecisionRow({ id, adr, readOnly, onOpen, onRemove }: {
  id: string
  /** Absent when the record was deleted since. */
  adr: Adr | undefined
  readOnly: boolean
  onOpen?(): void
  onRemove(): void
}) {
  const { t } = useStrings()
  return (
    <Box data-testid={`plan-decision-${id}`} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      {adr ? (
        <Typography sx={{ fontSize: 13, flex: 1, cursor: onOpen ? 'pointer' : undefined }} onClick={onOpen}>
          {formatAdrNumber(adr.number)} {adr.title}
          {adr.status !== 'accepted' && (
            <Box component="span" sx={{ color: 'text.secondary' }}> · {t(ADR_STATUS_LABEL[adr.status]).toLowerCase()}</Box>
          )}
        </Typography>
      ) : <Gone>{t('plan.goneDecision')}</Gone>}
      {!readOnly && <Button size="small" onClick={onRemove}>{t('plan.remove')}</Button>}
    </Box>
  )
}
