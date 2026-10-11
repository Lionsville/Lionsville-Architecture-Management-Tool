// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One unit of the organisation chart (ADR-0036 §7): its type and name, what
 * is worth saying beside them, a row per role with the people in it on the
 * chart's day, and the units under it, each a box of its own.
 *
 * **A chip is a person's assignment.** Pressing one in a unit this scope keeps
 * chooses that assignment, and the inspector beside the chart shows it; in a
 * unit kept elsewhere it opens that unit there, as pressing the unit does. A
 * vacancy assigns someone. The chip says who — the register's name, *you* —
 * their share where it is not all of their time, *acting*, and *ext* for
 * someone from outside the organisation. A leaver's name stays plain: the
 * register says when a name goes (`people/shown.ts`).
 */
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Language, Translate } from '../../i18n'
import type { Role } from '../../model/operatingModel'
import type { ChartHolder, ChartSlot, ChartUnit, OrgChart } from '../../model/orgChart'
import { pickedPerson } from '../../model/person'
import type { PersonId } from '../../model/person'
import type { ElementId } from '../../model/types'
import type { PersonNames } from '../../people/ui/names'
import type { ScopePath } from '../../projects/scopePath'
import { unitBadges } from './chartWords'
import type { UnitPlans } from './unitViewsHere'

/** Everything the boxes read, worked out once per render of the page. */
export type Drawing = {
  chart: OrgChart
  roles: ReadonlyMap<string, Role>
  typeName: (id: string | undefined) => string
  names: PersonNames
  /** Whether the register says a person is from outside the organisation. */
  external: (person: PersonId) => boolean
  scopeLabel: (path: ScopePath) => string
  plansOf: (unitId: ElementId) => UnitPlans
  day: string
  today: string
  language: Language
  t: Translate
  selectedId: ElementId | undefined
  /** The assignment chosen on this chart, while nothing else is selected. */
  chosen: string | undefined
  open: (id: ElementId) => void
  /** A holder's chip pressed: their assignment chosen, or the unit opened where it is kept. */
  choose: (holder: ChartHolder, unit: ChartUnit) => void
  vacancy: ((unit: ChartUnit, roleId: string) => void) | undefined
  /** Whether a vacancy of this unit and role is one to press: every one where the scope may be written, a managed unit's where it is only read. */
  mayAssign: (unit: ChartUnit, roleId: string) => boolean
}

/** One unit, its roles and the units under it. */
export function UnitBox({ unit, depth, drawing }: { unit: ChartUnit; depth: number; drawing: Drawing }) {
  const { t } = drawing
  const selected = drawing.selectedId === unit.id
  return (
    <Box
      data-testid="chart-unit" data-element-id={unit.id} data-ended={unit.ended ? 'true' : undefined}
      sx={{
        border: 1, borderRadius: 1.5, p: 1, minWidth: 220, bgcolor: depth % 2 === 0 ? 'background.paper' : 'background.default',
        borderColor: selected ? 'primary.main' : 'divider', borderStyle: unit.ended ? 'dashed' : 'solid',
        boxShadow: selected ? 2 : 0,
      }}
    >
      <ButtonBase onClick={() => drawing.open(unit.id)} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%', borderRadius: 1 }} data-testid="chart-unit-open">
        <Typography sx={{ fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>{drawing.typeName(unit.unitTypeId)}</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{unit.name}</Typography>
      </ButtonBase>
      <UnitBadges unit={unit} drawing={drawing} />
      {unit.slots.map((slot) => <SlotRow key={slot.roleId} unit={unit} slot={slot} drawing={drawing} />)}
      {unit.others.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
          {unit.others.map((other, at) => (
            <HolderChip
              key={`${other.assignment.id}/${at}`} holder={other} drawing={drawing} unit={unit}
              prefix={`${drawing.roles.get(other.assignment.roleId)?.name ?? other.assignment.roleId}${other.endedRole ? ` (${t('chart.roleEnded')})` : ''}: `}
            />
          ))}
        </Box>
      )}
      {unit.children.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start', mt: 1 }}>
          {unit.children.map((child) => <UnitBox key={child.id} unit={child} depth={depth + 1} drawing={drawing} />)}
        </Box>
      )}
    </Box>
  )
}

/** What is worth saying about a unit beside its name: the domains it serves, its days and the plans that set them, that it has ended. */
function UnitBadges({ unit, drawing }: { unit: ChartUnit; drawing: Drawing }) {
  const badges = unitBadges(unit, { ...drawing, plans: drawing.plansOf(unit.id) })
  if (badges.length === 0) return null
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, my: 0.25 }}>
      {badges.map((badge) => {
        const chip = <Chip key={badge.key} size="small" variant="outlined" label={badge.text} data-testid={`chart-badge-${badge.key}`} sx={{ height: 18, fontSize: 10 }} />
        return badge.full ? <Tooltip key={badge.key} title={badge.full}>{chip}</Tooltip> : chip
      })}
    </Box>
  )
}

/** One role of a unit: who holds it, and what its slot still asks for. */
function SlotRow({ unit, slot, drawing }: { unit: ChartUnit; slot: ChartSlot; drawing: Drawing }) {
  const { t } = drawing
  const role = drawing.roles.get(slot.roleId)
  const vacancy = drawing.vacancy && drawing.mayAssign(unit, slot.roleId) ? drawing.vacancy : undefined
  return (
    <Box data-testid={`chart-slot-${slot.roleId}`} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
      <Typography sx={{ fontSize: 11.5, minWidth: 110, color: 'text.secondary' }}>
        {role?.name ?? slot.roleId}
        {role?.manages && <Box component="span" sx={{ ml: 0.5, fontSize: 9.5 }}>{t('unit.managesBadge')}</Box>}
      </Typography>
      {slot.holders.map((holder, at) => <HolderChip key={`${holder.assignment.id}/${at}`} holder={holder} drawing={drawing} unit={unit} />)}
      {Array.from({ length: slot.vacant }, (_, at) => (
        <Chip
          key={`vacant-${at}`} size="small" variant="outlined" color="warning" label={t('unit.vacant')} data-testid="chart-vacant"
          sx={{ borderStyle: 'dashed', height: 22 }} {...(vacancy ? { onClick: () => vacancy(unit, slot.roleId) } : {})}
        />
      ))}
      {vacancy && slot.vacant === 0 && slot.room && slot.holders.length === 0 && (
        <Chip size="small" variant="outlined" label={t('unit.assign')} sx={{ borderStyle: 'dashed', height: 22 }} onClick={() => vacancy(unit, slot.roleId)} data-testid="chart-assign" />
      )}
    </Box>
  )
}

/**
 * One person in a role: the register's name, their share, acting, *ext*,
 * *you*, a red edge when over all of their time, and the ring a chosen
 * assignment has — the one a chosen unit's box has.
 */
function HolderChip({ holder, drawing, unit, prefix = '' }: { holder: ChartHolder; drawing: Drawing; unit: ChartUnit; prefix?: string }) {
  const { t } = drawing
  const you = drawing.names.isMe(pickedPerson(holder.person))
  const chosen = drawing.chosen === holder.assignment.id && drawing.selectedId === undefined
  const label = [
    `${prefix}${drawing.names.text(pickedPerson(holder.person))}`,
    holder.share < 1 ? `${Math.round(holder.share * 100)}%` : undefined,
    holder.assignment.acting ? t('unit.acting') : undefined,
    drawing.external(holder.person) ? t('chart.external') : undefined,
    you ? t('unit.you') : undefined,
  ].filter(Boolean).join(' · ')
  const chip = (
    <Chip
      size="small" label={label} color={you ? 'primary' : 'default'} variant={you ? 'filled' : 'outlined'}
      data-testid="chart-holder" data-assignment-id={holder.assignment.id} data-you={you ? 'true' : undefined}
      data-over={holder.overloaded ? 'true' : undefined} data-chosen={chosen ? 'true' : undefined} aria-pressed={chosen}
      onClick={() => drawing.choose(holder, unit)}
      sx={{
        height: 22,
        ...(holder.overloaded ? { borderColor: 'error.main', borderWidth: 2, borderStyle: 'solid' } : {}),
        ...(chosen ? { boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}` } : {}),
      }}
    />
  )
  return holder.overloaded ? <Tooltip title={t('chart.over')}>{chip}</Tooltip> : chip
}
