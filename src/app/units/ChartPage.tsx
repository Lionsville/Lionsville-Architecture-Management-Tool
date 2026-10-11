// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation chart, drawn in its tab (ADR-0036 §7, ADR-0016).
 *
 * **Laid out from the units.** Every box is a unit, nested in the unit above
 * it; every row in a box is a role the unit holds, with the people who hold it
 * on the view's day, the vacancies its slot leaves, the people over all of
 * their time, and — on a unit that has ended — the people still assigned to
 * it. The arithmetic is `model/orgChart`; what is on the page is the register's
 * name for each person and *you* where the person is this install's own.
 *
 * **On a day.** The day is the view's, as a board's is: today, or the day the
 * bar's control looks at or saves (ADR-0027). Looking at next year shows the
 * units a plan brings and the people a reorganisation leaves behind.
 *
 * **A unit opens where it is kept.** Choosing one this scope holds selects it,
 * and the inspector docked beside the page edits it — its type, the people in
 * its roles, the interactions it declares. One kept in another scope opens
 * there, on its record. A vacancy in a unit kept here assigns someone at once.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import type { Language } from '../../i18n'
import type { Command } from '../../model/commands'
import type { Role } from '../../model/operatingModel'
import { orgChart, unitsHolding, walk } from '../../model/orgChart'
import type { ChartHolder, ChartSlot, ChartUnit, OrgChart } from '../../model/orgChart'
import { pickedPerson } from '../../model/person'
import type { DesignDiagram, ElementId } from '../../model/types'
import { loadOn } from '../../model/units'
import { meIn } from '../../people/me'
import { personText, registerOf, resolvePerson } from '../../people/shown'
import type { Register } from '../../people/shown'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { findingSentence, findingsOfOrganisation } from '../../projects/checks'
import type { ScopePath } from '../../projects/scopePath'
import { captureSheet } from '../../widgets/capturePage'
import type { PageCaptureOptions, PageHandle } from '../../widgets/capturePage'
import { locatedRing, useLocated } from '../../widgets/useLocated'
import { useSelectRequest } from '../../widgets/useSelectRequest'
import type { SelectRequest } from '../../widgets/useSelectRequest'
import { AssignDialog } from './AssignDialog'
import type { Assigning } from './AssignDialog'
import type { UnitViewsHere } from './unitViewsHere'

export type ChartPageProps = {
  /** The view, with the day it is looked at on (`asOf`; absent is today). */
  diagram: DesignDiagram
  here: UnitViewsHere
  today: string
  readOnly: boolean
  people: PeopleRegisterAccess | undefined
  scopeLabel: (path: ScopePath) => string
  /** The editor's selected element, where it is one this scope holds. */
  selectedId?: ElementId
  onSelect(id: ElementId | undefined): void
  /** A unit kept in another scope, opened there on its record. */
  onOpenElsewhere(scope: ScopePath, id: ElementId): void
  /** Where a unit kept here may be assigned to from a vacancy. Absent: vacancies are not buttons. */
  assign?: { dispatch: (command: Command) => unknown; makeId: (prefix: string) => string; scopeName: string }
  select?: SelectRequest
  onHandle?(handle: PageHandle | undefined): void
}

/** Everything the boxes read, worked out once per render of the page. */
type Drawing = {
  chart: OrgChart
  roles: ReadonlyMap<string, Role>
  typeName: (id: string | undefined) => string
  register: Register
  me: string | undefined
  day: string
  today: string
  language: Language
  t: Translate
  selectedId: ElementId | undefined
  open: (id: ElementId) => void
  vacancy: ((unit: ChartUnit, roleId: string) => void) | undefined
}

export function ChartPage(props: ChartPageProps) {
  const { t, language } = useStrings()
  const theme = useTheme()
  const { here, diagram, people, today } = props
  const day = diagram.asOf ?? today
  const [root, setRoot] = useState<ElementId | undefined>(undefined)
  const [assigning, setAssigning] = useState<{ unit: ChartUnit; assigning: Assigning } | undefined>(undefined)
  const [note, setNote] = useState<string | undefined>(undefined)
  const register = useMemo(() => registerOf(people?.people ?? []), [people?.people])
  const canonical = useCallback((id: string) => resolvePerson(id, register)?.id ?? id, [register])
  const whole = useMemo(
    () => orgChart(here.at.organisation, day, { include: here.includes, canonical }),
    [here, day, canonical],
  )
  const shown = useMemo(
    () => (root === undefined ? whole : orgChart(here.at.organisation, day, { root, canonical })),
    [whole, here, day, root, canonical],
  )
  const me = meIn(people?.me, register)?.id
  const page = useRef<HTMLDivElement | null>(null)
  const open = useCallback((id: ElementId) => {
    if (here.heldHere(id)) { props.onSelect(id); return }
    const scope = here.scopeOf(id)
    if (scope !== undefined) props.onOpenElsewhere(scope, id)
  }, [here, props.onSelect, props.onOpenElsewhere])
  const { locatedId, locate } = useLocated(page, (id) => { if (here.heldHere(id)) props.onSelect(id) })
  useSelectRequest(props.select, (id) => [...walk(shown.roots)].some((unit) => unit.id === id), locate)
  usePageHandle(page, diagram.id, props.selectedId, props.onHandle, theme.palette.background.default)

  const findMe = () => {
    if (me === undefined) { setNote(t('chart.findMeWho')); return }
    const found = unitsHolding(whole, me)
    if (found.length === 0) { setNote(t('chart.findMeNone', { day: formatDay(day, language) })); return }
    setNote(undefined)
    if (root !== undefined && !unitsHolding(shown, me).includes(found[0])) setRoot(undefined)
    locate(found[0])
  }
  const roles = new Map(here.at.organisation.roles.map((role) => [role.id, role]))
  const types = new Map(here.at.organisation.unitTypes.map((type) => [type.id, type.name]))
  const editable = !props.readOnly && props.assign !== undefined && people !== undefined && !people.readOnly
  const drawing: Drawing = {
    chart: shown, roles, typeName: (id) => types.get(id ?? '') ?? '', register, me, day, today, language, t,
    selectedId: props.selectedId, open,
    vacancy: editable ? (unit, roleId) => {
      if (here.heldHere(unit.id)) setAssigning({ unit, assigning: { mode: 'new', roleId } })
      else open(unit.id)
    } : undefined,
  }
  return (
    <Box data-testid="chart-page" sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <ChartBar whole={whole} shown={shown} root={root} onRoot={setRoot} onFindMe={findMe} drawing={drawing} note={note} />
      <Box ref={page} data-testid="chart-body" sx={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', p: 2, bgcolor: 'background.default', ...locatedRing(locatedId) }}>
        {shown.roots.length === 0
          ? <Typography sx={{ fontSize: 12.5, color: 'text.secondary', py: 6, textAlign: 'center' }}>{t('chart.empty', { day: formatDay(day, language) })}</Typography>
          : <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>{shown.roots.map((unit) => <UnitBox key={unit.id} unit={unit} depth={0} drawing={drawing} />)}</Box>}
        <ChartFindings {...props} chart={shown} day={day} register={register} onFinding={locate} />
      </Box>
      {assigning && people && props.assign && (
        <AssignDialog
          assigning={assigning.assigning} unit={{ id: assigning.unit.id, name: assigning.unit.name }}
          roles={assigning.unit.slots.flatMap((slot) => roles.get(slot.roleId) ?? [])}
          register={people} today={today} makeId={props.assign.makeId} dispatch={props.assign.dispatch} scopeName={props.assign.scopeName}
          loadOf={(person) => t('assign.load', { share: Math.round(loadOn(here.at.organisation.assignments, person.id, day) * 100), day })}
          onClose={() => setAssigning(undefined)} s={t}
        />
      )}
    </Box>
  )
}

/** The page as the agent's renderer reaches it: a picture of what is drawn, and what is selected. */
function usePageHandle(
  page: { current: HTMLDivElement | null }, diagramId: string, selectedId: ElementId | undefined,
  onHandle: ((handle: PageHandle | undefined) => void) | undefined, background: string,
) {
  const capture = useCallback(async (options: PageCaptureOptions) => {
    const node = page.current
    if (!node) throw new Error('ChartPage: the page is not on screen')
    return captureSheet(node, { ...options, background })
  }, [page, background])
  useEffect(() => {
    if (!onHandle) return undefined
    onHandle({ diagramId, capture, ...(selectedId !== undefined ? { selectedId } : {}) })
    return () => onHandle(undefined)
  }, [onHandle, diagramId, capture, selectedId])
}

/** The bar over the chart: how much is on it, which unit it is of, and *Find me*. */
function ChartBar({ whole, shown, root, onRoot, onFindMe, drawing, note }: {
  whole: OrgChart; shown: OrgChart; root: ElementId | undefined; onRoot: (id: ElementId | undefined) => void
  onFindMe: () => void; drawing: Drawing; note: string | undefined
}) {
  const { t } = drawing
  const options = [...walkWithDepth(whole.roots, 0)]
  return (
    <Box data-testid="chart-bar" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <TextField
        select size="small" label={t('chart.show')} value={root ?? ''} onChange={(event) => onRoot(event.target.value || undefined)}
        sx={{ minWidth: 220 }} slotProps={{ htmlInput: { 'data-testid': 'chart-root' } }}
      >
        <MenuItem value="">{t('chart.everything')}</MenuItem>
        {options.map(({ unit, depth }) => (
          <MenuItem key={unit.id} value={unit.id} sx={{ pl: 2 + depth * 1.5 }}>{unit.name}</MenuItem>
        ))}
      </TextField>
      <Button size="small" variant="outlined" onClick={onFindMe} data-testid="chart-find-me">{t('chart.findMe')}</Button>
      <Typography data-testid="chart-count" sx={{ fontSize: 11.5, color: 'text.secondary' }}>
        {t('chart.count', { units: shown.units, people: shown.people })}
      </Typography>
      {note && <Typography data-testid="chart-note" sx={{ fontSize: 11.5, color: 'warning.main' }}>{note}</Typography>}
      <Box sx={{ flex: 1 }} />
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('chart.legend')}</Typography>
    </Box>
  )
}

function* walkWithDepth(units: readonly ChartUnit[], depth: number): Generator<{ unit: ChartUnit; depth: number }> {
  for (const unit of units) {
    yield { unit, depth }
    yield* walkWithDepth(unit.children, depth + 1)
  }
}

/** One unit, its roles and the units under it. */
function UnitBox({ unit, depth, drawing }: { unit: ChartUnit; depth: number; drawing: Drawing }) {
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

/** What is worth saying about a unit beside its name: the domains it serves, its days, that it has ended. */
function UnitBadges({ unit, drawing }: { unit: ChartUnit; drawing: Drawing }) {
  const { t, language, day, today } = drawing
  const badges: string[] = []
  if (unit.serves.length > 1) badges.push(t('chart.serves', { count: unit.serves.length }))
  if (unit.begins !== undefined && unit.begins > today) badges.push(t('chart.begins', { day: formatDay(unit.begins, language) }))
  if (unit.ended && unit.ends !== undefined) badges.push(t('chart.ended', { day: formatDay(unit.ends, language) }))
  else if (unit.ends !== undefined && unit.ends >= day) badges.push(t('chart.ends', { day: formatDay(unit.ends, language) }))
  if (badges.length === 0) return null
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, my: 0.25 }}>
      {badges.map((badge) => <Chip key={badge} size="small" variant="outlined" label={badge} sx={{ height: 18, fontSize: 10 }} />)}
    </Box>
  )
}

/** One role of a unit: who holds it, and what its slot still asks for. */
function SlotRow({ unit, slot, drawing }: { unit: ChartUnit; slot: ChartSlot; drawing: Drawing }) {
  const { t } = drawing
  const role = drawing.roles.get(slot.roleId)
  const vacancy = drawing.vacancy
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

/** One person in a role: the register's name, their share, acting, *you*, and a red edge when over all of their time. */
function HolderChip({ holder, drawing, unit, prefix = '' }: { holder: ChartHolder; drawing: Drawing; unit: ChartUnit; prefix?: string }) {
  const { t } = drawing
  const you = drawing.me !== undefined && holder.person === drawing.me
  const label = [
    `${prefix}${personText(pickedPerson(holder.person), drawing.register, t)}`,
    holder.share < 1 ? `${Math.round(holder.share * 100)}%` : undefined,
    holder.assignment.acting ? t('unit.acting') : undefined,
    you ? t('unit.you') : undefined,
  ].filter(Boolean).join(' · ')
  const chip = (
    <Chip
      size="small" label={label} color={you ? 'primary' : 'default'} variant={you ? 'filled' : 'outlined'}
      data-testid="chart-holder" data-you={you ? 'true' : undefined} data-over={holder.overloaded ? 'true' : undefined}
      onClick={() => drawing.open(unit.id)}
      sx={{ height: 22, ...(holder.overloaded ? { borderColor: 'error.main', borderWidth: 2, borderStyle: 'solid' } : {}) }}
    />
  )
  return holder.overloaded ? <Tooltip title={t('chart.over')}>{chip}</Tooltip> : chip
}

/**
 * What the organisation contradicts on the day, about the units drawn and the
 * people in them — each a link to what it is about on the chart: the unit, or
 * the first unit the person holds a role in.
 */
function ChartFindings({ here, scopeLabel, chart, day, register, onFinding }: ChartPageProps & {
  chart: OrgChart; day: string; register: Register; onFinding: (unitId: ElementId) => void
}) {
  const { t, language } = useStrings()
  const units = new Set([...walk(chart.roots)].map((unit) => unit.id))
  const persons = new Set([...walk(chart.roots)].flatMap((unit) => [...unit.slots.flatMap((slot) => slot.holders), ...unit.others].map((one) => one.person)))
  const findings = findingsOfOrganisation(here.at, day)
    .filter((finding) => (finding.person !== undefined ? persons.has(resolvePerson(finding.person, register)?.id ?? finding.person) : units.has(finding.id)))
  const name = (person: string) => personText(pickedPerson(person), register, t)
  return (
    <Box data-testid="chart-findings" sx={{ mt: 3 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>{t('chart.on', { day: formatDay(day, language) })}</Typography>
      {findings.length === 0
        ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('chart.nothing')}</Typography>
        : findings.map((finding, at) => {
          const about = finding.person !== undefined
            ? unitsHolding(chart, resolvePerson(finding.person, register)?.id ?? finding.person)[0]
            : finding.id
          return (
            <ButtonBase
              key={`${finding.key}/${finding.id}/${at}`} data-testid="chart-finding" onClick={() => { if (about !== undefined) onFinding(about) }}
              sx={{ display: 'block', textAlign: 'left', fontSize: 12, color: 'warning.main', '&:hover': { textDecoration: 'underline' } }}
            >
              {findingSentence(finding, t, scopeLabel, name)}
            </ButtonBase>
          )
        })}
    </Box>
  )
}
