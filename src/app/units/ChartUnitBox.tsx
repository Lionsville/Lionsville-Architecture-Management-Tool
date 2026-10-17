// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One unit of the organisation chart (ADR-0036 §7): its type and name, what
 * is worth saying beside them, a row per role with the people in it on the
 * chart's day, and the units under it, each a box of its own.
 *
 * **A click picks, a double-click opens** (17 October 2026), as on a board.
 * Pressing a person's chip chooses their assignment, wherever the unit is
 * kept, and the inspector beside the chart shows it; pressing a unit's name
 * picks the unit. Double-clicking either opens a unit kept in another scope
 * there; nothing leaves the chart on a single click. A vacancy assigns
 * someone. The chip says who — the register's name, *you* —
 * their share where it is not all of their time, *acting*, and *ext* for
 * someone from outside the organisation. A leaver's name stays plain: the
 * register says when a name goes (`people/shown.ts`).
 *
 * **A unit with units under it folds** (3.6.1): the caret beside its name
 * hides the units under it, and the unit says what it hides — its units and
 * people, and its vacancies and findings where there are any. Its own roles
 * stay: a fold hides what is below a unit, never the unit.
 *
 * **The width is used, and only what needs attention is drawn** (3.6.1). A
 * unit's units share a grid of columns at least 220 pixels wide
 * (`UnitGrid`), so a cluster's teams fill the row instead of wrapping at a
 * third of it; one drawn with units under it takes a whole row, so its own
 * have the width in turn. A role nobody holds and nobody needs to — an
 * optional one — is not drawn until *Show optional roles* is on: it is a
 * choice, not a gap, and the unit's inspector always lists it. A vacancy is
 * always drawn.
 *
 * **A unit is made inside one from its name row** (3.6.2): a quiet *+* that
 * shows on hover, on focus and on the unit picked (`AddUnit.tsx`), never on a
 * chart that is only read. **And moved from there** (3.7.1): *Move to…*
 * beside it, as quiet, opens the dialog that puts the unit under another
 * anywhere in the organisation (`useMoveUnit`).
 */
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Language, Translate } from '../../i18n'
import type { Role } from '../../model/operatingModel'
import { drawsUnitsBelow, emptyOptional } from '../../model/orgChart'
import type { ChartHolder, ChartRollUp, ChartSlot, ChartUnit, OrgChart } from '../../model/orgChart'
import { pickedPerson } from '../../model/person'
import type { PersonId } from '../../model/person'
import type { ElementId } from '../../model/types'
import type { PersonNames } from '../../people/ui/names'
import type { ScopePath } from '../../projects/scopePath'
import { CaretIcon, MoveToIcon } from '../../widgets/icons'
import { ADD_INSIDE, AddInside, showsAddInside } from './AddUnit'
import { rollUpWords, unitBadges } from './chartWords'
import type { RollUpPart } from './chartWords'
import type { UnitPlans } from './unitViewsHere'
import type { UnitOffer } from './useNewUnit'

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
  /** A unit's name pressed: the unit picked, on the chart. */
  pick: (id: ElementId) => void
  /** A unit or a chip in it double-clicked: a unit kept in another scope opened there, one kept here picked. */
  open: (id: ElementId) => void
  /** A holder's chip pressed: their assignment chosen. */
  choose: (holder: ChartHolder, unit: ChartUnit) => void
  vacancy: ((unit: ChartUnit, roleId: string) => void) | undefined
  /** Whether a vacancy of this unit and role is one to press: every one where the scope may be written, a managed unit's where it is only read. */
  mayAssign: (unit: ChartUnit, roleId: string) => boolean
  /** The chart's folds: absent, every unit is drawn open. */
  folds?: ChartBoxFolds
  /** Whether a role nobody holds and nobody needs to is drawn: *Show optional roles*. */
  optional: boolean
  /** *+ Unit* inside a unit: what it offers there, and the dialog it opens. Absent: nothing is made from the chart. */
  add?: { offer: (unit: ChartUnit) => UnitOffer; open: (unit: ChartUnit) => void }
  /** *Move to…* a unit: the dialog that puts it somewhere else in the organisation (3.7.1). Absent: nothing is moved from the chart. */
  move?: (unit: ChartUnit) => void
}

/** What the boxes read of the chart's folds. */
export type ChartBoxFolds = {
  folded: ReadonlySet<ElementId>
  toggle: (id: ElementId) => void
  /** What a unit hides when it is folded. */
  rollUp: (unit: ChartUnit) => ChartRollUp
}

const NONE_FOLDED: ReadonlySet<ElementId> = new Set()

/**
 * Units beside each other — the chart's top units, or a unit's own — in a
 * grid that uses the width: as many columns of at least 220 pixels as fit,
 * each a unit drawn without units under it, and a whole row for each one
 * drawn with them. In the chart's order, read across.
 */
export function UnitGrid({ units, depth, drawing }: { units: readonly ChartUnit[]; depth: number; drawing: Drawing }) {
  const folded = drawing.folds?.folded ?? NONE_FOLDED
  return (
    <Box
      data-testid="chart-units"
      sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: depth === 0 ? 1.5 : 1, alignItems: 'start', mt: depth === 0 ? 0 : 1 }}
    >
      {units.map((unit) => <UnitBox key={unit.id} unit={unit} depth={depth} drawing={drawing} wide={drawsUnitsBelow(unit, folded)} />)}
    </Box>
  )
}

/** One unit, its roles and the units under it; `wide` where it takes a whole row of its grid. */
function UnitBox({ unit, depth, drawing, wide }: { unit: ChartUnit; depth: number; drawing: Drawing; wide: boolean }) {
  const { t, folds } = drawing
  const selected = drawing.selectedId === unit.id
  const folded = folds !== undefined && unit.children.length > 0 && folds.folded.has(unit.id)
  return (
    <Box
      data-testid="chart-unit" data-element-id={unit.id} data-unit-name={unit.name} data-ended={unit.ended ? 'true' : undefined} data-folded={folded ? 'true' : undefined}
      data-wide={wide ? 'true' : undefined}
      sx={{
        border: 1, borderRadius: 1.5, p: 1, minWidth: 0, bgcolor: depth % 2 === 0 ? 'background.paper' : 'background.default',
        borderColor: selected ? 'primary.main' : 'divider', borderStyle: unit.ended ? 'dashed' : 'solid',
        boxShadow: selected ? 2 : 0, ...(wide ? { gridColumn: '1 / -1' } : {}),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, ...showsAddInside }}>
        {folds && unit.children.length > 0 && (
          <IconButton
            size="small" aria-label={t(folded ? 'chart.unfold' : 'chart.fold', { name: unit.name })} aria-expanded={!folded}
            onClick={() => folds.toggle(unit.id)} data-testid="chart-fold"
            sx={{ width: 22, height: 22, mt: 0.25, color: 'text.secondary', transform: folded ? 'rotate(-90deg)' : undefined }}
          >
            <CaretIcon />
          </IconButton>
        )}
        <ButtonBase onClick={() => drawing.pick(unit.id)} onDoubleClick={() => drawing.open(unit.id)} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', flex: 1, borderRadius: 1 }} data-testid="chart-unit-open">
          <Typography sx={{ fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>{drawing.typeName(unit.unitTypeId)}</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{unit.name}</Typography>
        </ButtonBase>
        {drawing.add && <AddInside name={unit.name} offer={drawing.add.offer(unit)} picked={selected} onAdd={() => drawing.add?.open(unit)} t={t} />}
        {drawing.move && <MoveTo name={unit.name} picked={selected} onMove={() => drawing.move?.(unit)} t={t} />}
      </Box>
      {folded && <RollUp parts={rollUpWords(folds.rollUp(unit), t)} />}
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
      {unit.children.length > 0 && !folded && <UnitGrid units={unit.children} depth={depth + 1} drawing={drawing} />}
    </Box>
  )
}

/** A unit's own *Move to…*, quiet as its *+* is: shown on hover, on focus and on the unit picked. */
function MoveTo({ name, picked, onMove, t }: { name: string; picked: boolean; onMove: () => void; t: Translate }) {
  return (
    <Tooltip title={t('unitMove.openNamed', { name })}>
      <IconButton
        size="small" aria-label={t('unitMove.openNamed', { name })} onClick={onMove}
        data-guide="chart.moveTo" data-testid="chart-move-to" {...{ [ADD_INSIDE]: '', 'data-shown': picked ? 'true' : undefined }}
        sx={{ width: 22, height: 22, mt: 0.25, color: 'text.secondary' }}
      >
        <MoveToIcon size={14} />
      </IconButton>
    </Tooltip>
  )
}

/** What a folded unit hides, said where its units would be: the vacancies and findings in the warning colour. */
function RollUp({ parts }: { parts: readonly RollUpPart[] }) {
  return (
    <Typography data-testid="chart-rollup" sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.25, ml: 3.5 }}>
      {parts.map((part, at) => (
        <Box component="span" key={part.key} data-part={part.key} sx={part.warn ? { color: 'warning.main', fontWeight: 600 } : undefined}>
          {at > 0 ? ' · ' : ''}{part.text}
        </Box>
      ))}
    </Typography>
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

/** One role of a unit: who holds it, and what its slot still asks for. Nothing, for an empty optional one the chart is not showing. */
function SlotRow({ unit, slot, drawing }: { unit: ChartUnit; slot: ChartSlot; drawing: Drawing }) {
  const { t } = drawing
  if (!drawing.optional && emptyOptional(slot)) return null
  const role = drawing.roles.get(slot.roleId)
  const vacancy = drawing.vacancy && drawing.mayAssign(unit, slot.roleId) ? drawing.vacancy : undefined
  return (
    <Box data-testid={`chart-slot-${slot.roleId}`} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
      <Typography sx={{ fontSize: 11.5, minWidth: 110, color: 'text.secondary' }} data-testid="chart-role-name">
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
      onClick={() => drawing.choose(holder, unit)} onDoubleClick={() => drawing.open(unit.id)}
      sx={{
        height: 22,
        ...(holder.overloaded ? { borderColor: 'error.main', borderWidth: 2, borderStyle: 'solid' } : {}),
        ...(chosen ? { boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}` } : {}),
      }}
    />
  )
  return holder.overloaded ? <Tooltip title={t('chart.over')}>{chip}</Tooltip> : chip
}
