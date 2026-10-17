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
 * name for each person and *you* where the person is this install's own, read
 * through the names the shell provides (`usePersonNames`).
 *
 * **On a day.** The day is the view's, as a board's is: today, or the day the
 * bar's control looks at or saves (ADR-0027). Looking at next year shows the
 * units a plan brings and the people a reorganisation leaves behind.
 *
 * **A click picks, a double-click opens** (17 October 2026), as on a board.
 * Pressing a unit this scope holds selects it, and the inspector docked beside
 * the page edits it — its type, the people in its roles, the interactions it
 * declares. Pressing one kept in another scope goes to it on this chart;
 * double-clicking it opens it there, on that scope's chart, chosen, with the
 * same inspector. A vacancy in a unit kept here assigns someone at once.
 *
 * **A person's chip chooses their assignment**, wherever the unit is kept,
 * and the inspector shows it (`AssignmentInspector`, through
 * `useChartChoice`), with the way to the scope that keeps it where that is
 * another. The editor selecting anything lets the choice go, so the inspector
 * shows one thing at a time. The boxes themselves are `ChartUnitBox`.
 *
 * **A large organisation folds** (ADR-0036, amended 11 October 2026). A unit
 * with units under it folds, and says what it hides; a first open of more
 * than thirty units folds everything below the second level; *Fold all* and
 * *Unfold all* are on the bar. Folds are the screen's, for the session and
 * keyed by the view (`useChartFolds`), never the model's. Beside the chart,
 * the outline (`ChartOutline`) lists the same units as a tree that folds on
 * its own, and moves a unit among its siblings (`useSiblingOrder`). Going to
 * a unit — a pick in the outline, *Find*, *Find me*, a finding, a request
 * from outside — unfolds the way to it and scrolls to it.
 *
 * **Each thing in one place** (3.6.1). The chart draws the units, in a grid
 * that uses the width, and what needs attention in them; an optional role
 * nobody holds waits for *Show optional roles* on the bar. What the chart
 * says as a whole — the day, the counts, the findings and how to read it —
 * is the inspector's while nothing is picked (`ChartSummary`, through
 * `EditorPages.inspector`); a finding there goes to its unit here as any
 * request from outside does (`select`).
 *
 * **Reporting lines** (ADR-0039 §7, amended 17 October 2026): with a person
 * picked, a solid or a dotted line from their chip to whoever holds the role
 * they report to, and from the chips of the people who report to them, on
 * the chart's day — ending at the fold for a unit folded away (`chartLines`,
 * `ChartLinesOverlay`). Nothing picked, or a unit, draws none. *Reporting
 * lines* on the bar turns them off altogether; it is on from the start where
 * the organisation says any line.
 *
 * **Units are made where they are seen** (3.6.2): *+ Unit at the top* on the
 * bar, in the outline's header and on an empty chart, and *+* on a unit's
 * name row for a unit inside it (`useNewUnit`, `AddUnit.tsx`). Only where
 * the workspace hands the chart a way to write (`make`), and never on a chart
 * that is only read.
 *
 * **And moved where they are seen** (3.7.1): *Move to…* on a unit's name row
 * and in the outline beside *Move up* and *Move down* puts it under another
 * unit anywhere in the organisation, or at the top (`useMoveUnit`), landed
 * the way a move among siblings is (`reorder`); the chart then goes to it in
 * its new place.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import type { Command } from '../../model/commands'
import { FOLD_OVER, rollUp, unitsHolding, unitsNamed, walk } from '../../model/orgChart'
import type { ChartHolder, ChartUnit, OrgChart } from '../../model/orgChart'
import { pickedPerson } from '../../model/person'
import type { PersonId } from '../../model/person'
import type { DesignDiagram, ElementId } from '../../model/types'
import { dayBefore, hasReportingLines, loadOn } from '../../model/units'
import { mayChangeIn } from '../../model/managing'
import { meIn } from '../../people/me'
import { registerOf, resolvePerson } from '../../people/shown'
import { usePersonNames } from '../../people/ui/names'
import type { PersonNames } from '../../people/ui/names'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import type { ScopePath } from '../../projects/scopePath'
import { captureSheet } from '../../widgets/capturePage'
import type { PageCaptureOptions, PageHandle } from '../../widgets/capturePage'
import { locatedRing, useLocated } from '../../widgets/useLocated'
import { useSelectRequest } from '../../widgets/useSelectRequest'
import type { SelectRequest } from '../../widgets/useSelectRequest'
import { foldKey, SessionFolds } from '../sessionFolds'
import { AddAtTop } from './AddUnit'
import { AssignDialog } from './AssignDialog'
import type { Assigning } from './AssignDialog'
import { chartLines, linesOf } from './chartLines'
import { ChartLinesOverlay } from './ChartLinesOverlay'
import { ChartOutline } from './ChartOutline'
import { UnitGrid } from './ChartUnitBox'
import type { Drawing } from './ChartUnitBox'
import { useChartReading } from './chartReading'
import type { LandPeopleMoves } from './landPeopleMoves'
import type { UnitViewsHere } from './unitViewsHere'
import { useChartFolds } from './useChartFolds'
import type { ChartFolds } from './useChartFolds'
import { useNewUnit } from './useNewUnit'
import type { NewUnit, UnitMaking } from './useNewUnit'
import { useSiblingOrder } from './useSiblingOrder'
import { useMoveUnit } from './useMoveUnit'

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
  /** A unit kept in another scope, opened there: on its chart, chosen, where that scope has one. */
  onOpenElsewhere(scope: ScopePath, id: ElementId): void
  /** Where a unit kept here may be assigned to from a vacancy. Absent: vacancies are not buttons. */
  assign?: { dispatch: (command: Command) => unknown; makeId: (prefix: string) => string; scopeName: string }
  /** The assignment chosen on this chart, which the inspector beside it shows. */
  chosen?: string
  /** Choose an assignment of a unit kept here, or let the choice go. Absent: a chip opens its unit. */
  onChoose?(assignmentId: string | undefined): void
  select?: SelectRequest
  onHandle?(handle: PageHandle | undefined): void
  /** The scope open in this window: what the chart's folds are kept under with the view, and whose step a move writes through its session. */
  scope?: ScopePath
  /** Where the chart's folds are kept for the session (`sessionFolds.ts`). Absent: they last while the page is on screen. */
  folds?: SessionFolds
  /**
   * How a unit's move among its siblings, or to another place in the
   * organisation (3.7.1), lands: a step in each scope that keeps one
   * (`landPeopleMoves`). Absent: the chart moves nothing.
   */
  reorder?: LandPeopleMoves
  /** How a unit is made from the chart: a step in the scope it is filed in (`useNewUnit`). Absent: no *+ Unit*. */
  make?: UnitMaking
}

export function ChartPage(props: ChartPageProps) {
  const { t, language } = useStrings()
  const theme = useTheme()
  const { here, diagram, people, today } = props
  const day = diagram.asOf ?? today
  const [assigning, setAssigning] = useState<{ unit: ChartUnit; assigning: Assigning } | undefined>(undefined)
  const [note, setNote] = useState<string | undefined>(undefined)
  const names = usePersonNames()
  const canonical = names.canonical
  const { chart, byUnit } = useChartReading(here, day, canonical)
  const register = useMemo(() => registerOf(people?.people ?? []), [people?.people])
  const me = useMemo(() => meIn(people?.me, register)?.id, [people?.me, register])
  const folds = useFoldsOf(chart, props.scope ?? '', diagram.id, props.folds)
  const page = useRef<HTMLDivElement | null>(null)
  // The Reporting lines overlay (ADR-0039 §7, amended): on from the start where the organisation says any line, off where it
  // says none; the switch lasts while the page is up.
  const stage = useRef<HTMLDivElement | null>(null)
  const [showLines, setShowLines] = useState(() => hasReportingLines(here.at.organisation))
  const lines = useMemo(
    () => (showLines ? chartLines(here.at.organisation, chart, day, folds.folded) : []),
    [showLines, here, chart, day, folds.folded],
  )
  // Whenever the boxes may have moved, the lines are measured again from the chips.
  const redraw = useMemo(() => ({ optional: folds.optional, folded: folds.folded }), [folds.optional, folds.folded])
  // The person picked, whose lines alone are drawn: the assignment chosen, while the editor selects nothing.
  const chosenLines = useMemo(() => {
    const held = props.selectedId === undefined && props.chosen !== undefined
      ? here.at.organisation.assignments.find((one) => one.id === props.chosen) : undefined
    if (!held) return undefined
    const place = { unitId: held.unitId, roleId: held.roleId }
    return { chosen: { id: held.id, place }, lines: linesOf(lines, place) }
  }, [props.selectedId, props.chosen, here, lines])
  const open = useCallback((id: ElementId) => {
    if (here.heldHere(id)) { props.onSelect(id); return }
    const scope = here.scopeOf(id)
    if (scope !== undefined) props.onOpenElsewhere(scope, id)
  }, [here, props.onSelect, props.onOpenElsewhere])
  const { onChoose, chosen } = props
  // The editor selecting anything — a unit pressed, a finding followed, a link — lets the assignment go.
  useEffect(() => { if (props.selectedId !== undefined && chosen !== undefined) onChoose?.(undefined) }, [props.selectedId, chosen, onChoose])
  // A person's chip picks their assignment, wherever the unit is kept: nothing leaves the chart on a single click.
  const choose = useCallback((holder: ChartHolder, unit: ChartUnit) => {
    if (!onChoose) { if (here.heldHere(unit.id)) props.onSelect(unit.id); return }
    props.onSelect(undefined)
    onChoose(holder.assignment.id)
  }, [onChoose, here, props.onSelect])
  const { locatedId, locate } = useLocated(page, (id) => { if (here.heldHere(id)) props.onSelect(id) })
  const { current, goTo } = useGoTo(chart, folds, locate, props)
  // A unit's name picks it: selected where it is kept here, gone to on this chart where it is kept elsewhere.
  const pick = useCallback((id: ElementId) => {
    if (here.heldHere(id)) { props.onSelect(id); return }
    onChoose?.(undefined)
    goTo(id)
  }, [here, props.onSelect, onChoose, goTo])
  useSelectRequest(props.select, (id) => [...walk(chart.roots)].some((unit) => unit.id === id), goTo)
  // What a link made here selects (ADR-0033, amended 17 October 2026): the unit gone to, kept here or elsewhere, while no person is chosen.
  usePageHandle(page, diagram.id, chosen === undefined ? current : props.selectedId, props.onHandle, theme.palette.background.default)
  const order = useSiblingOrder({
    here, day, scope: props.scope ?? '', unitId: current, land: props.readOnly ? undefined : props.reorder, t,
  })
  const moving = useChartMove(props, names, goTo, current, t)

  const findMe = () => {
    if (me === undefined) { setNote(t('chart.findMeWho')); return }
    const found = unitsHolding(chart, me)
    if (found.length === 0) { setNote(t('chart.findMeNone', { day: formatDay(day, language) })); return }
    setNote(undefined)
    goTo(found[0])
  }
  const find = (query: string) => {
    const found = unitsNamed(chart, query)
    if (found.length === 0) { setNote(query.trim() ? t('chart.findNone') : undefined); return }
    setNote(undefined)
    goTo(found[0])
  }
  const roles = new Map(here.at.organisation.roles.map((role) => [role.id, role]))
  const typeName = useTypeName(here)
  const newUnit = useNewUnit({
    make: props.make, readOnly: props.readOnly, here, chart, day, scope: props.scope ?? '', scopeLabel: props.scopeLabel, typeName, goTo, t,
  })
  const writes = props.assign !== undefined && people !== undefined && !people.readOnly
  // Where the scope is only read, a vacancy in a unit kept here that the person manages
  // still assigns — a managing role's only strictly below one they hold (ADR-0036 §12).
  const manages = people?.manages
  const editable = writes && (!props.readOnly || manages !== undefined)
  const mayAssign = (unit: ChartUnit, roleId: string) => !props.readOnly || (here.heldHere(unit.id) && mayChangeIn(manages, unit.id, roleId))
  const external = (person: PersonId) => {
    const entry = resolvePerson(person, register)
    return entry?.kind === 'external' && entry.state !== 'forgotten'
  }
  const drawing: Drawing = {
    chart, roles, typeName, names, external, scopeLabel: props.scopeLabel, plansOf: here.plansOf,
    day, today, language, t, selectedId: props.selectedId, chosen, pick, open, choose, mayAssign,
    vacancy: editable ? (unit, roleId) => {
      if (here.heldHere(unit.id)) setAssigning({ unit, assigning: { mode: 'new', roleId } })
      else open(unit.id)
    } : undefined,
    folds: { folded: folds.folded, toggle: folds.toggle, rollUp: (unit) => rollUp(unit, byUnit) },
    optional: folds.optional,
    ...(newUnit.offer ? { add: { offer: newUnit.offer, open: newUnit.open } } : {}),
    ...moving.drawing,
  }
  const atTop = (guide: string, testId: string, variant?: 'outlined' | 'contained') => addAtTop(newUnit, props.make, guide, testId, t, variant)
  return (
    <Box data-testid="chart-page" sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <ChartBar
        chart={chart} folds={folds} onFind={find} onFindMe={findMe} note={note} add={atTop('chart.addAtTop', 'chart-add-top')}
        lines={{ on: showLines, toggle: () => setShowLines((on) => !on) }} t={t}
      />
      <Box sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
        <ChartOutline
          chart={chart} folded={folds.outline} onToggle={folds.toggleOutline} current={current} onPick={goTo} typeName={typeName} order={order}
          addAtTop={atTop('chart.outlineAdd', 'chart-outline-add')} moveTo={moving.outline} t={t}
        />
        <Box ref={page} data-testid="chart-body" sx={{ flex: '1 1 auto', minWidth: 0, minHeight: 0, overflow: 'auto', p: 2, bgcolor: 'background.default', ...locatedRing(locatedId) }}>
          {chart.roots.length === 0
            ? (
              <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                <Typography sx={{ fontSize: 12.5, color: 'text.secondary', textAlign: 'center' }}>{t('chart.empty', { day: formatDay(day, language) })}</Typography>
                {atTop('chart.addFirst', 'chart-add-first', 'contained')}
              </Box>
            )
            : (
              <Box ref={stage} sx={{ position: 'relative' }}>
                <UnitGrid units={chart.roots} depth={0} drawing={drawing} />
                {showLines && chosenLines && <ChartLinesOverlay stage={stage} lines={chosenLines.lines} redraw={redraw} chosen={chosenLines.chosen} />}
              </Box>
            )}
        </Box>
      </Box>
      {assigning && people && props.assign && (
        <AssignDialog
          assigning={assigning.assigning} unit={{ id: assigning.unit.id, name: assigning.unit.name }}
          roles={assigning.unit.slots.flatMap((slot) => roles.get(slot.roleId) ?? []).filter((role) => mayAssign(assigning.unit, role.id))}
          register={people} today={day > today ? day : today} endOn={day > today ? dayBefore(day) : today}
          makeId={props.assign.makeId} dispatch={props.assign.dispatch} scopeName={props.assign.scopeName}
          loadOf={(person) => t('assign.load', { share: Math.round(loadOn(here.at.organisation.assignments, person.id, day, canonical) * 100), day })}
          onClose={() => setAssigning(undefined)} s={t}
        />
      )}
      {newUnit.dialog}
      {moving.dialog}
    </Box>
  )
}

/**
 * *Move to…* on the chart (3.7.1): on a unit's box, and in the outline for
 * the current unit, landed as a move among siblings is; nothing on a chart
 * that is only read. The chart goes to the unit in its new place.
 */
function useChartMove(props: ChartPageProps, names: PersonNames, goTo: (id: ElementId) => void, current: ElementId | undefined, t: Translate) {
  const { here, today } = props
  const moving = useMoveUnit({
    organisation: here.at.organisation, scopeOf: here.scopeOf, scopeLabel: props.scopeLabel, name: here.name, today, t, onMoved: goTo,
    personName: (person) => names.text(pickedPerson(person)), land: props.readOnly ? undefined : props.reorder,
  })
  const open = moving.open
  return {
    dialog: moving.dialog,
    drawing: open ? { move: (unit: ChartUnit) => open(unit.id) } : {},
    outline: open && current !== undefined ? () => open(current) : undefined,
  }
}

/** A unit type's name by its id, worked out once per organisation. */
function useTypeName(here: UnitViewsHere): (id: string | undefined) => string {
  const { unitTypes } = here.at.organisation
  return useMemo(() => {
    const types = new Map(unitTypes.map((type) => [type.id, type.name]))
    return (id: string | undefined) => types.get(id ?? '') ?? ''
  }, [unitTypes])
}

/** *+ Unit at the top* where the chart makes units, carrying its stable name; nothing where it makes none. */
function addAtTop(newUnit: NewUnit, make: UnitMaking | undefined, guide: string, testId: string, t: Translate, variant?: 'outlined' | 'contained') {
  if (!newUnit.offer || !make) return undefined
  return <AddAtTop offer={newUnit.offer()} onAdd={() => newUnit.open()} onLink={make.onOpenOperating} guide={guide} testId={testId} t={t} {...(variant ? { variant } : {})} />
}

/** The chart's folds, kept where the shell keeps them for the session, or — where it keeps none — for as long as the page is up. */
function useFoldsOf(chart: OrgChart, scope: ScopePath, viewId: string, kept: SessionFolds | undefined): ChartFolds {
  const [own] = useState(() => new SessionFolds())
  const memory = kept ?? own
  const keys = useMemo(() => ({
    chart: foldKey(scope, viewId, 'chart'), outline: foldKey(scope, viewId, 'outline'), optional: foldKey(scope, viewId, 'optional'),
  }), [scope, viewId])
  return useChartFolds(chart, memory, keys)
}

/**
 * Going to a unit: the way to it unfolded, on the chart and in the outline,
 * then scrolled to and ringed, and chosen where the open scope keeps it. The
 * unit gone to is the outline's current one — the editor's selection where it
 * is a unit on the chart, otherwise the last one gone to — so a unit kept
 * elsewhere can be gone to and moved without leaving the scope.
 */
function useGoTo(chart: OrgChart, folds: ChartFolds, locate: (id: ElementId) => void, props: ChartPageProps) {
  const [went, setWent] = useState<ElementId | undefined>(undefined)
  const { here, onSelect, selectedId } = props
  const { reveal } = folds
  const goTo = useCallback((id: ElementId) => {
    setWent(id)
    // A unit kept elsewhere cannot be the editor's selection: what was selected lets go, so the outline marks this one.
    if (!here.heldHere(id)) onSelect(undefined)
    reveal(id)
    locate(id)
  }, [here, onSelect, reveal, locate])
  const onChart = selectedId !== undefined && [...walk(chart.roots)].some((unit) => unit.id === selectedId)
  return { current: onChart ? selectedId : went, goTo }
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

/**
 * The bar over the chart: how much is on it, *Find* a unit by name, *Find me*,
 * *Show optional roles*, and *Fold all* and *Unfold all* — and, under it, why
 * a first open of a large chart is folded, until a fold is changed. How to
 * read the chart is said in its summary, beside it.
 */
function ChartBar({ chart, folds, onFind, onFindMe, note, add, lines, t }: {
  chart: OrgChart; folds: ChartFolds; onFind: (query: string) => void; onFindMe: () => void; note: string | undefined; add: ReactNode
  lines: { on: boolean; toggle: () => void }; t: Translate
}) {
  const [query, setQuery] = useState('')
  return (
    <>
      <Box data-testid="chart-bar" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography data-testid="chart-count" sx={{ fontSize: 11.5, color: 'text.secondary' }}>
          {t('chart.count', { units: chart.units, people: chart.people })}
        </Typography>
        <TextField
          size="small" label={t('chart.findUnit')} value={query} onChange={(event) => setQuery(event.target.value)}
          // Consumed: an Enter left to the browser becomes a press of whatever button takes the focus next.
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onFind(query) } }}
          sx={{ width: 200 }} slotProps={{ htmlInput: { 'data-testid': 'chart-find-input' } }}
        />
        <Button size="small" variant="outlined" onClick={() => onFind(query)} data-testid="chart-find">{t('chart.find')}</Button>
        <Button size="small" variant="outlined" onClick={onFindMe} data-testid="chart-find-me">{t('chart.findMe')}</Button>
        {note && <Typography data-testid="chart-note" role="status" sx={{ fontSize: 11.5, color: 'warning.main' }}>{note}</Typography>}
        <Box sx={{ flex: 1 }} />
        {add}
        <FormControlLabel
          data-guide="chart.showOptional" data-testid="chart-show-optional"
          control={<Switch size="small" checked={folds.optional} onChange={folds.toggleOptional} />}
          label={<Typography sx={{ fontSize: 12 }}>{t('chart.showOptional')}</Typography>}
          sx={{ mr: 0.5 }}
        />
        <FormControlLabel
          data-guide="chart.showLines" data-testid="chart-show-lines"
          control={<Switch size="small" checked={lines.on} onChange={lines.toggle} />}
          label={<Typography sx={{ fontSize: 12 }}>{t('chart.showLines')}</Typography>}
          sx={{ mr: 0.5 }}
        />
        <Button size="small" onClick={folds.foldAll} data-testid="chart-fold-all" data-guide="chart.foldAll">{t('chart.foldAll')}</Button>
        <Button size="small" onClick={folds.unfoldAll} data-testid="chart-unfold-all" data-guide="chart.unfoldAll">{t('chart.unfoldAll')}</Button>
      </Box>
      {folds.foldedOnOpen && (
        <Typography data-testid="chart-folded-note" sx={{ fontSize: 12, px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', color: 'text.secondary' }}>
          {t('chart.foldedOnOpen', { count: FOLD_OVER })}
        </Typography>
      )}
    </>
  )
}
