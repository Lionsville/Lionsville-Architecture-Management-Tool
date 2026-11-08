// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation chart, drawn in its tab (ADR-0036 §7, ADR-0016).
 *
 * **Laid out from the units, as a tree.** The organisation at the top, a box per
 * unit with a line per role, connectors between them (`ChartUnitBox`,
 * `ChartLinesOverlay`). The arithmetic is `model/orgChart`; what is on the page
 * is the register's name for each person and *you* where the person is this
 * install's own, read through the names the shell provides (`usePersonNames`).
 *
 * **On a day.** The day is the view's, as a board's is: today, or the day the
 * bar's control looks at or saves (ADR-0027). Looking at next year shows the
 * units a plan brings and the people a reorganisation leaves behind, and a chart
 * of another day says so over it.
 *
 * **A click picks, a double-click opens** (17 October 2026), as on a board. The
 * panel beside the chart is up while something is picked or asked for, and gone
 * otherwise, so a chart at rest has the window's width (`onDock`).
 *
 * **Overview.** Levels fold the whole chart, a caret one unit, and neither is
 * saved (`useChartFolds`). The canvas zooms as every canvas does (`useCanvasZoom`,
 * `CanvasDock`), and a focus draws one unit and what is under it, with one line
 * for the way up, in the address so an agent opens it too (`useViewFacets`).
 * Going to a unit from anywhere unfolds the way to it and scrolls to it.
 *
 * **Lines.** One menu, in the address: none, the person picked's, every dotted
 * line, or every exception, which lists them in a panel as well
 * (`ChartLinesOverlay`, `ExceptionsPanel`). It opens on the person picked where
 * the organisation says any line at all.
 *
 * **Writing with the chart in view.** *Move to…* is a panel beside it with its
 * places lit, and a drag opens the same panel filled in (`MovePanel`); assigning
 * is a popover beside the vacancy (`AssignPopover`). None of it on a chart that
 * is only read, but for a vacancy in a unit the person manages (ADR-0036 §12).
 *
 * **Finding** is one box for units and people, on the outline (`ChartFind`), and
 * ⌘F comes to it, because on a chart of people the search of the design finds
 * the wrong things.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import { isChartLines } from '../../agent/screen'
import type { ChartLines } from '../../agent/screen'
import { useStrings } from '../../i18n'
import type { Language, Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import type { Command } from '../../model/commands'
import { focusedOn, levelOfFolds, rollUp, unitsAboveIn, unitsHolding, vacanciesIn, walk } from '../../model/orgChart'
import type { ChartHolder, ChartUnit, OrgChart } from '../../model/orgChart'
import { pickedPerson } from '../../model/person'
import type { PersonId } from '../../model/person'
import type { DesignDiagram, ElementId } from '../../model/types'
import { unitFits } from '../../model/unitMove'
import { dayBefore, hasReportingLines, loadOn, roleOn } from '../../model/units'
import { mayChangeIn } from '../../model/managing'
import { meIn } from '../../people/me'
import { registerOf, resolvePerson } from '../../people/shown'
import { usePersonNames } from '../../people/ui/names'
import type { PersonNames } from '../../people/ui/names'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import type { ScopePath } from '../../projects/scopePath'
import { captureSheet } from '../../widgets/capturePage'
import { PictureDialog } from '../../widgets/kit/PictureDialog'
import type { PageCaptureOptions, PageHandle } from '../../widgets/capturePage'
import { Band } from '../../widgets/kit/Band'
import { Button } from '../../widgets/kit/Button'
import { CanvasDock } from '../../widgets/kit/CanvasDock'
import { FIT_GAP } from '../../widgets/kit/zoom'
import type { Insets } from '../../widgets/kit/zoom'
import { PageState } from '../../widgets/kit/PageState'
import { useViewFacets } from '../../widgets/placeTab'
import { locatedRing, useLocated } from '../../widgets/useLocated'
import { useSelectRequest } from '../../widgets/useSelectRequest'
import type { SelectRequest } from '../../widgets/useSelectRequest'
import { foldKey, SessionFolds } from '../sessionFolds'
import { AddAtTop } from './AddUnit'
import { AssignPopover } from './AssignDialog'
import type { Assigning } from './AssignDialog'
import { ChartBar } from './ChartBar'
import type { ChartDay } from './ChartBar'
import { AT_THE_TOP } from './choices'
import { ChartFind } from './ChartFind'
import { chartKey, stepInTree } from './chartKeys'
import { chartExceptions, chartWideLines, holderLines } from './chartLines'
import { ChartConnectors, ChartLinesLegend, ChartLinesOverlay, ChartMoveLegend } from './ChartLinesOverlay'
import { ChartOutline } from './ChartOutline'
import { ORGANISATION, OrgTree } from './ChartUnitBox'
import type { Drawing, DropState, TreeMove } from './ChartUnitBox'
import { useChartReading } from './chartReading'
import { summaryWords } from './chartWords'
import { ExceptionsPanel } from './ExceptionsPanel'
import type { LandPeopleMoves } from './landPeopleMoves'
import { MovePanel } from './MovePanel'
import { useMovePlan } from './MoveUnitDialog'
import type { UnitViewsHere } from './unitViewsHere'
import { useChartFolds } from './useChartFolds'
import type { ChartFolds } from './useChartFolds'
import { useChartRoom, useChartZoom } from './useChartZoom'
import { movedText, UNIT_MOVE_BARRIER } from './useMoveUnit'
import { useNewUnit } from './useNewUnit'
import type { NewUnit, UnitMaking } from './useNewUnit'
import { useSiblingOrder } from './useSiblingOrder'
import { claimKey, commandKey, keyClaimed } from '../../widgets/kit/keys'
import { Menu } from '../../widgets/kit/Menu'
import type { MenuEntry } from '../../widgets/kit/Menu'
import './chart.css'

/** As large a picture as the landscape's: a chart of a large organisation is wide. */
const EXPORT_PIXELS = 16_000_000

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
  /** Export…: the chart as a PNG picture, handed to the host to save. Absent = no Export…. */
  onExport?(name: string, png: Uint8Array): void
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
  /** The outline's width, kept with the editor's panel widths (3.7.3). Absent: the outline keeps its own while it is up. */
  outline?: { width: number; onWidth(next: number): void }
  /** Whether the inspector docked beside the chart is up. Absent: it is the host's to say. */
  onDock?: (shown: boolean) => void
  /** Looking at another day, and keeping one with the chart. Absent: no day control here. */
  day?: ChartDay
  /** A unit's *Sits under* in the inspector asks for a move here: the panel opens, with the chart in view. */
  moveAsked?: { unitId: ElementId; nonce: number }
}

/** The end of the chart scrolls clear of the dock and the key, so nothing under them is out of reach. */
function clearOfFloats(insets: Insets): CSSProperties {
  return {
    ...(insets.bottom > FIT_GAP ? { paddingBottom: insets.bottom } : {}),
    ...(insets.right > FIT_GAP ? { paddingRight: insets.right } : {}),
  }
}

export function ChartPage(props: ChartPageProps) {
  const { t, language } = useStrings()
  const { here, diagram, today } = props
  const day = diagram.asOf ?? today
  const names = usePersonNames()
  const { chart, byUnit } = useChartReading(here, day, names.canonical)
  const folds = useFoldsOf(chart, props.scope ?? '', diagram.id, props.folds)
  const page = useRef<HTMLDivElement | null>(null)
  const stage = useRef<HTMLDivElement | null>(null)
  const zoom = useChartZoom(page, stage)
  const work = useRef<HTMLDivElement | null>(null)
  const insets = useChartRoom(page, work, stage, zoom.zoom)
  const [reading, setReading] = useViewFacets(diagram.id)
  const focused = useMemo(() => focusedOn(chart, reading.focus), [chart, reading.focus])
  const lines = useChartLines(props, chart, day, folds, reading.lines)
  const going = useChartGoing(props, chart, folds, page, reading.focus, setReading)
  const moving = useChartMove(props, names, going.goTo, t)
  const [assigning, setAssigning] = useState<HeldAssigning | undefined>(undefined)
  const typeName = useTypeName(here)
  const newUnit = useNewUnit({
    make: props.make, readOnly: props.readOnly, here, chart, day, scope: props.scope ?? '', scopeLabel: props.scopeLabel, typeName, goTo: going.goTo, t,
  })
  const drawnTop = focused ? [focused] : chart.roots
  const menu = useUnitMenu(props.here, folds, going, moving, newUnit, t)
  const drawing = useDrawing({ props, chart, day, folds, byUnit, going, moving, newUnit, names, typeName, drawnTop, stage, setAssigning, unitMenu: menu.open, language, t })
  useFindKey(stage)
  const organisationName = props.scopeLabel('')
  const empty = chart.roots.length === 0
  const redraw = useMemo(
    () => ({ people: folds.people, folded: folds.folded, chart, selected: props.selectedId, chosen: props.chosen, focus: reading.focus, zoom: zoom.zoom }),
    [folds.people, folds.folded, chart, props.selectedId, props.chosen, reading.focus, zoom.zoom],
  )
  const ownPanel = useChartDock(props, moving.up !== undefined, lines.lines === 'exceptions', going.summaryAsked)
  useSteadyOnDock(page, stage, props.selectedId ?? going.current, props.selectedId !== undefined || props.chosen !== undefined || going.summaryAsked || ownPanel)
  const closeExceptions = () => setReading({ lines: 'person' })
  const [exportAsked, setExportAsked] = useState(false)
  const onExport = props.onExport
  return (
    <div data-testid="chart-page" className="chart-page" data-own-walk="">
      <ChartHead
        props={props} chart={chart} folds={folds} lines={lines.lines} onLines={(next) => setReading({ lines: next })} moving={moving.up} empty={empty}
        focused={moving.up === undefined ? focused : undefined} organisation={organisationName} onFocus={going.focus} newUnit={newUnit} language={language} t={t}
        onExport={onExport ? () => setExportAsked(true) : undefined}
      />
      <div className="chart-page__main">
        {moving.up === undefined && !empty && (
          <ChartOutlinePane props={props} chart={chart} units={drawnTop} folds={folds} going={going} moving={moving} names={names} day={day} language={language} t={t} />
        )}
        <div className="chart-page__work" ref={work}>
          <Box
            ref={zoom.attach} {...(empty ? {} : { ...zoom.canvas, style: { ...zoom.canvas.style, ...clearOfFloats(insets) } })}
            data-testid="chart-body" className="chart-canvas" sx={locatedRing(going.locatedId)}
          >
            {empty
              ? <EmptyChart day={day} language={language} add={firstUnit(newUnit, props.make, t)} t={t} />
              : (
                <div ref={stage} className="chart-stage" data-people={folds.people} style={{ zoom: zoom.zoom }}>
                  <ChartConnectors stage={stage} zoom={zoom.zoom} redraw={redraw} />
                  <OrgTree organisation={organisationName} focused={focused} drawing={drawing} />
                  <ChartLinesOverlay stage={stage} lines={lines.drawn} zoom={zoom.zoom} redraw={redraw} unitName={here.name} t={t} />
                </div>
              )}
          </Box>
          {!empty && (
            <>
              <CanvasDock zoom={zoom.zoom} onZoomIn={() => zoom.target.go('in')} onZoomOut={() => zoom.target.go('out')} onFit={() => zoom.target.go('fit')} onHome={() => zoom.target.go('home')} data-testid="chart-dock" />
              {moving.up === undefined ? <ChartLinesLegend t={t} /> : <ChartMoveLegend t={t} />}
              <SummaryLine chart={chart} byUnit={byUnit} asked={going.summaryAsked} onPress={going.toggleSummary} t={t} />
            </>
          )}
        </div>
        {moving.panel && <div className="chart-page__panel">{moving.panel}</div>}
        {!moving.panel && ownPanel && (
          <div className="chart-page__panel">
            <ExceptionsPanel
              exceptions={lines.exceptions} organisation={here.at.organisation} names={names} onGoTo={going.goTo} onOperating={props.make?.onOpenOperating}
              onClose={closeExceptions} t={t}
            />
          </div>
        )}
      </div>
      {menu.drawn}
      {assigning && <AssignThere held={assigning} props={props} day={day} names={names} onClose={() => setAssigning(undefined)} t={t} />}
      {newUnit.dialog}
      {exportAsked && onExport && (
        <PictureDialog
          name={diagram.name} onClose={() => setExportAsked(false)} about={<p>{t('chart.exportAbout')}</p>} data-testid="chart-export-dialog"
          onSave={async () => { const shot = await going.capture({ maxPixels: EXPORT_PIXELS }); onExport(`${diagram.name}.png`, shot.png) }}
        />
      )}
    </div>
  )
}

/** A vacancy pressed: where, and in which role. */
type HeldAssigning = { unit: ChartUnit; assigning: Assigning; at: HTMLElement | null }

/** The Lines menu: which it says, and what that draws. The person picked's from the start where the organisation says any line, none where it says none. */
function useChartLines(props: ChartPageProps, chart: OrgChart, day: string, folds: ChartFolds, said: string | undefined) {
  const { here, selectedId, chosen } = props
  const lines: ChartLines = isChartLines(said) ? said : hasReportingLines(here.at.organisation) ? 'person' : 'off'
  const drawn = useMemo(() => {
    if (lines === 'off') return []
    if (lines !== 'person') return chartWideLines(here.at.organisation, chart, day, folds.folded, lines)
    const held = selectedId === undefined && chosen !== undefined ? here.at.organisation.assignments.find((one) => one.id === chosen) : undefined
    return held ? holderLines(here.at.organisation, chart, day, folds.folded, held) : []
  }, [lines, selectedId, chosen, here, chart, day, folds.folded])
  const exceptions = useMemo(() => (lines === 'exceptions' ? chartExceptions(here.at.organisation, chart, day) : []), [lines, here, chart, day])
  return { lines, drawn, exceptions }
}

/** The panel docked beside the chart is up for what is picked and for the summary, and otherwise the chart has the width. Says whether the page draws a panel of its own. */
function useChartDock(props: ChartPageProps, moving: boolean, exceptions: boolean, summaryAsked: boolean): boolean {
  const { onDock, selectedId, chosen } = props
  const somethingPicked = selectedId !== undefined || chosen !== undefined
  const ownPanel = moving || (exceptions && !somethingPicked)
  const docked = !ownPanel && (somethingPicked || summaryAsked)
  useEffect(() => { onDock?.(docked) }, [onDock, docked])
  useEffect(() => () => onDock?.(true), [onDock])
  return ownPanel
}

/** Going about the chart: what a press picks, where a unit is gone to, and the focus that lets go of what it does not draw. */
function useChartGoing(
  props: ChartPageProps, chart: OrgChart, folds: ChartFolds, page: { current: HTMLDivElement | null }, focus: string | undefined,
  setReading: (patch: { focus?: string | undefined }) => void,
) {
  const theme = useTheme()
  const { here, onSelect, onChoose, chosen, selectedId, diagram } = props
  const [summaryAsked, setSummaryAsked] = useState(false)
  const open = useCallback((id: ElementId) => {
    if (here.heldHere(id)) { onSelect(id); return }
    const scope = here.scopeOf(id)
    if (scope !== undefined) props.onOpenElsewhere(scope, id)
  }, [here, onSelect, props.onOpenElsewhere])
  // The editor selecting anything — a unit pressed, a finding followed, a link — lets the assignment go.
  useEffect(() => { if (selectedId !== undefined && chosen !== undefined) onChoose?.(undefined) }, [selectedId, chosen, onChoose])
  // A person pressed picks their assignment, wherever the unit is kept: nothing leaves the chart on a single click.
  const choose = useCallback((holder: ChartHolder, unit: ChartUnit) => {
    if (!onChoose) { if (here.heldHere(unit.id)) onSelect(unit.id); return }
    onSelect(undefined)
    onChoose(holder.assignment.id)
  }, [onChoose, here, onSelect])
  const { locatedId, locate } = useLocated(page, (id) => { if (here.heldHere(id)) onSelect(id) })
  const { current, goTo: goToUnit } = useGoTo(chart, folds, locate, props)
  // Going somewhere a focus does not draw lets the focus go, so the unit is on screen.
  const goTo = useCallback((id: ElementId) => {
    setSummaryAsked(false)
    if (focus !== undefined && id !== focus && !unitsAboveIn(chart, id).includes(focus)) setReading({ focus: undefined })
    goToUnit(id)
  }, [focus, chart, goToUnit, setReading])
  // A unit's name picks it: selected where it is kept here, gone to on this chart where it is kept elsewhere.
  const pick = useCallback((id: ElementId) => {
    setSummaryAsked(false)
    if (here.heldHere(id)) { onSelect(id); return }
    onChoose?.(undefined)
    goTo(id)
  }, [here, onSelect, onChoose, goTo])
  useSelectRequest(props.select, (id) => [...walk(chart.roots)].some((unit) => unit.id === id), goTo)
  // What a link made here selects (ADR-0033, amended 17 October 2026): the unit gone to, kept here or elsewhere, while no person is chosen.
  const capture = usePageHandle(page, diagram.id, chosen === undefined ? current : selectedId, props.onHandle, theme.palette.background.default)
  const focusOn = useCallback((id: ElementId | undefined) => {
    setReading({ focus: id })
    if (id !== undefined) folds.expandBoth(id)
  }, [setReading, folds.expandBoth])
  const toggleSummary = useCallback(() => {
    onSelect(undefined)
    onChoose?.(undefined)
    setSummaryAsked((was) => !was)
  }, [onSelect, onChoose])
  return { open, choose, locatedId, current, goTo, pick, focus: focusOn, summaryAsked, toggleSummary, capture }
}

type Going = ReturnType<typeof useChartGoing>

/** What the boxes read, worked out once per render of the page. */
function useDrawing({ props, chart, day, folds, byUnit, going, moving, newUnit, names, typeName, drawnTop, stage, setAssigning, unitMenu, language, t }: {
  props: ChartPageProps; chart: OrgChart; day: string; folds: ChartFolds; byUnit: ReadonlyMap<ElementId, number>; going: Going
  moving: ReturnType<typeof useChartMove>; newUnit: NewUnit; names: PersonNames; typeName: (id: string | undefined) => string
  drawnTop: readonly ChartUnit[]; stage: { current: HTMLElement | null }; setAssigning: (held: HeldAssigning) => void
  unitMenu: ((unit: ChartUnit, at: HTMLElement) => void) | undefined; language: Language; t: Translate
}): Drawing {
  const { here, people, today } = props
  const { current, pick, open, choose } = going
  const register = useMemo(() => registerOf(people?.people ?? []), [people?.people])
  const roles = useMemo(() => new Map(here.at.organisation.roles.map((role) => [role.id, role])), [here])
  const [roving, setRoving] = useState<ElementId | undefined>(undefined)
  const writes = props.assign !== undefined && people !== undefined && !people.readOnly
  // Where the scope is only read, a vacancy in a unit kept here that the person manages
  // still assigns — a managing role's only strictly below one they hold (ADR-0036 §12).
  const manages = people?.manages
  const editable = writes && (!props.readOnly || manages !== undefined)
  const onKey = (unit: ChartUnit, event: KeyboardEvent) => {
    const said = chartKey(event)
    if (said === undefined || moving.up !== undefined) return
    if (said === 'move') { if (moving.open) { event.preventDefault(); moving.open(unit.id) } return }
    event.preventDefault()
    if (said === 'focus') { going.focus(unit.id); return }
    const onward = said === 'pick'
      ? (current === unit.id ? stepInTree(drawnTop, folds.folded, unit.id, 'down') : unit.id)
      : stepInTree(drawnTop, folds.folded, unit.id, said)
    if (onward === undefined) return
    if (said === 'pick') pick(onward)
    else setRoving(onward)
    focusBox(stage.current, onward)
  }
  const pickedId = props.selectedId ?? (props.chosen === undefined && current !== undefined && !here.heldHere(current) ? current : undefined)
  const holdsPicked = useMemo(() => new Set(pickedId === undefined ? [] : unitsAboveIn(chart, pickedId)), [chart, pickedId])
  return {
    chart, roles, typeName, names, scopeLabel: props.scopeLabel, plansOf: here.plansOf, holdsPicked,
    day, today, language, t, selectedId: props.selectedId, chosen: props.chosen, pick, open, choose,
    external: (person: PersonId) => {
      const entry = resolvePerson(person, register)
      return entry?.kind === 'external' && entry.state !== 'forgotten'
    },
    mayAssign: (unit, roleId) => !props.readOnly || (here.heldHere(unit.id) && mayChangeIn(manages, unit.id, roleId)),
    // A unit kept elsewhere cannot be the editor's selection: gone to, it is picked as far as this chart goes.
    pickedId,
    loadOf: (person) => Math.round(loadOn(here.at.organisation.assignments, person, day, names.canonical) * 100),
    vacancy: editable ? (unit, roleId, at) => {
      if (here.heldHere(unit.id)) setAssigning({ unit, assigning: { mode: 'new', roleId }, at })
      else open(unit.id)
    } : undefined,
    folds: { folded: folds.folded, toggle: folds.toggle, rollUp: (unit) => rollUp(unit, byUnit) },
    people: folds.people,
    focus: going.focus,
    roving: roving ?? current ?? drawnTop[0]?.id,
    onKey,
    ...(newUnit.offer ? { add: { offer: newUnit.offer, open: newUnit.open } } : {}),
    ...(moving.open ? { move: moving.open } : {}),
    ...(moving.tree ? { moving: moving.tree } : {}),
    ...(unitMenu ? { menu: unitMenu } : {}),
  }
}

/** What is over the chart: the bar, or the word that a move is under way; and the bands for another day and a focus. */
function ChartHead({ props, chart, folds, lines, onLines, moving, empty, focused, organisation, onFocus, newUnit, onExport, language, t }: {
  props: ChartPageProps; chart: OrgChart; folds: ChartFolds; lines: ChartLines; onLines: (lines: ChartLines) => void; moving: ElementId | undefined; empty: boolean
  focused: ChartUnit | undefined; organisation: string; onFocus: (id: ElementId | undefined) => void; newUnit: NewUnit; onExport: (() => void) | undefined; language: Language; t: Translate
}) {
  const { here, selectedId, diagram } = props
  const picked = selectedId !== undefined && here.heldHere(selectedId) ? [...walk(chart.roots)].find((unit) => unit.id === selectedId) : undefined
  return (
    <>
      {moving !== undefined && <Band tone="editing" title={t('unitMove.bandTitle', { name: here.name(moving) })} detail={t('unitMove.bandDetail')} />}
      {moving === undefined && !empty && (
        <ChartBar
          level={levelOfFolds(chart, folds.folded)} onLevel={folds.setLevels} people={folds.people} onPeople={folds.setPeople} lines={lines} onLines={onLines}
          add={addOnBar(newUnit, props.make, picked, t)} day={props.day} shownDay={diagram.asOf} t={t}
          {...(onExport ? { onExport } : {})}
        />
      )}
      <ShownDayBand day={props.day} asOf={diagram.asOf} language={language} t={t} />
      {focused && <FocusBand chart={chart} focused={focused} organisation={organisation} onFocus={onFocus} t={t} />}
    </>
  )
}

/** The outline, with the find on top of it. */
function ChartOutlinePane({ props, chart, units, folds, going, moving, names, day, language, t }: {
  props: ChartPageProps; chart: OrgChart; units: readonly ChartUnit[]; folds: ChartFolds; going: Going; moving: ReturnType<typeof useChartMove>
  names: PersonNames; day: string; language: Language; t: Translate
}) {
  const { here, people } = props
  const [note, setNote] = useState<string | undefined>(undefined)
  const register = useMemo(() => registerOf(people?.people ?? []), [people?.people])
  const me = useMemo(() => meIn(people?.me, register)?.id, [people?.me, register])
  const { current, goTo, choose } = going
  const order = useSiblingOrder({ here, day, scope: props.scope ?? '', unitId: current, land: props.readOnly ? undefined : props.reorder, t })
  const roleName = useCallback((id: string) => here.at.organisation.roles.find((role) => role.id === id)?.name ?? id, [here])
  const findMe = () => {
    if (me === undefined) { setNote(t('chart.findMeWho')); return }
    const first = unitsHolding(chart, me)[0]
    if (first === undefined) { setNote(t('chart.findMeNone', { day: formatDay(day, language) })); return }
    setNote(undefined)
    goTo(first)
  }
  const { open: moveOpen } = moving
  return (
    <ChartOutline
      chart={chart} units={units} folded={folds.outline} onToggle={folds.toggleOutline} current={current} onPick={(id) => { folds.expand(id); goTo(id) }}
      order={order} moveTo={moveOpen && current !== undefined ? () => moveOpen(current) : undefined} canMove={moveOpen !== undefined} {...(props.outline ? { width: props.outline } : {})}
      find={<ChartFind chart={chart} names={names} roleName={roleName} onUnit={goTo} onHolder={(holder, unit) => { goTo(unit.id); choose(holder, unit) }} onMe={findMe} note={note} t={t} />}
      t={t}
    />
  )
}

/** The line under the chart: what it holds, and the way to the panel that says the rest. */
function SummaryLine({ chart, byUnit, asked, onPress, t }: { chart: OrgChart; byUnit: ReadonlyMap<ElementId, number>; asked: boolean; onPress: () => void; t: Translate }) {
  const findings = [...byUnit.values()].reduce((sum, one) => sum + one, 0)
  return (
    <div className="chart-foot">
      <button type="button" className="chart-foot__line" data-testid="chart-summary-line" data-guide="chart.summary" aria-expanded={asked} onClick={onPress}>
        <span data-testid="chart-count">{summaryWords({ units: chart.units, people: chart.people, vacant: vacanciesIn(chart) }, t).map((part) => part.text).join(' · ')}</span>
        {findings > 0 && <span className="chart-foot__part" data-warn=""> · {t('chart.rollFindingsOther', { count: findings })}</span>}
      </button>
    </div>
  )
}

/** Someone put in the vacancy pressed, in the popover beside it. */
function AssignThere({ held, props, day, names, onClose, t }: { held: HeldAssigning; props: ChartPageProps; day: string; names: PersonNames; onClose: () => void; t: Translate }) {
  const { here, people, assign, today } = props
  if (!people || !assign) return null
  const { organisation } = here.at
  const manages = people.manages
  const mayAssign = (roleId: string) => !props.readOnly || (here.heldHere(held.unit.id) && mayChangeIn(manages, held.unit.id, roleId))
  const share = (person: PersonId) => Math.round(loadOn(organisation.assignments, person, day, names.canonical) * 100)
  return (
    <AssignPopover
      at={held.at} assigning={held.assigning} unit={{ id: held.unit.id, name: held.unit.name }}
      roles={held.unit.slots.flatMap((slot) => organisation.roles.find((role) => role.id === slot.roleId) ?? []).filter((role) => mayAssign(role.id))}
      others={organisation.roles.filter((role) => roleOn(role, day) && mayAssign(role.id))}
      register={people} today={day > today ? day : today} endOn={day > today ? dayBefore(day) : today}
      makeId={assign.makeId} dispatch={assign.dispatch} scopeName={assign.scopeName}
      loadOf={(person) => t('assign.loadNow', { share: share(person.id) })} shareOf={share} personName={(person) => names.text(pickedPerson(person))}
      onClose={onClose} s={t}
    />
  )
}

/** *+ Unit at the top* on an empty chart, or why none can be made yet. */
function firstUnit(newUnit: NewUnit, make: UnitMaking | undefined, t: Translate): ReactNode {
  if (!newUnit.offer || !make) return undefined
  return <AddAtTop offer={newUnit.offer()} onAdd={() => newUnit.open()} onLink={make.onOpenOperating} guide="chart.addFirst" testId="chart-add-first" primary t={t} />
}

/** The box a key moved to takes the focus, on the render after the one that made it tabbable. */
function focusBox(stage: HTMLElement | null, id: ElementId) {
  const box = stage?.querySelector<HTMLElement>(`[data-tree-box="${id.replace(/["\\]/g, '\\$&')}"] [data-testid="chart-unit-open"]`)
  box?.focus()
  box?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
}

/** ⌘F on a chart goes to its own box: the search of the design finds elements, and a chart is of units and people. */
function useFindKey(stage: { current: HTMLElement | null }) {
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!commandKey(event) || event.altKey || event.key.toLowerCase() !== 'f') return
      if (document.activeElement?.closest('[aria-modal="true"]')) return
      const box = stage.current?.closest('[data-testid="chart-page"]')?.querySelector<HTMLInputElement>('[data-testid="chart-find-input"]')
      if (!box) return
      event.preventDefault()
      event.stopPropagation()
      box.focus()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [stage])
}

/** A chart saved on a day says so while nobody is looking away from it; a look says so in the frame's own band. */
function ShownDayBand({ day, asOf, language, t }: { day: ChartDay | undefined; asOf: string | undefined; language: Language; t: Translate }) {
  if (!day || asOf === undefined || day.looking) return null
  return (
    <Band
      tone="looking" title={t('chart.dayShown', { day: formatDay(asOf, language) })}
      action={<Button size="small" onClick={() => day.onChange(undefined)} data-testid="chart-day-back">{t('chart.dayBack')}</Button>}
    />
  )
}

/** The way up from a focus, on one line, and the way out of it. */
function FocusBand({ chart, focused, organisation, onFocus, t }: {
  chart: OrgChart; focused: ChartUnit; organisation: string; onFocus: (id: ElementId | undefined) => void; t: Translate
}) {
  const units = [...walk(chart.roots)]
  const above = unitsAboveIn(chart, focused.id).map((id) => units.find((unit) => unit.id === id)).filter((unit): unit is ChartUnit => unit !== undefined)
  return (
    <Band
      tone="info"
      title={(
        <span data-testid="chart-focus-way">
          {t('chart.focusLabel')}{' '}
          <button type="button" className="chart-panel__link" onClick={() => onFocus(undefined)}>{organisation}</button>
          {above.map((unit) => (
            <span key={unit.id}> › <button type="button" className="chart-panel__link" onClick={() => onFocus(unit.id)}>{unit.name}</button></span>
          ))}
          {' › '}{focused.name}
        </span>
      )}
      action={<Button size="small" onClick={() => onFocus(undefined)} data-testid="chart-focus-back">{t('chart.focusBack')}</Button>}
    />
  )
}

/** A chart with no units: what it is, and the first step, or why none can be taken yet. */
function EmptyChart({ day, language, add, t }: { day: string; language: Language; add: ReactNode; t: Translate }) {
  return (
    <div className="chart-empty" data-testid="chart-empty">
      <PageState state="empty" title={t('chart.emptyTitle')} body={t('chart.emptyBody', { day: formatDay(day, language) })} />
      {add}
    </div>
  )
}

/**
 * *Move to…* on the chart (3.7.1, a panel in 4.0.0): from a picked box, the
 * outline, a drag, M and the inspector's *Sits under*; written as a move among
 * siblings is, in one step per scope; nothing on a chart that is only read. The
 * chart goes to the unit in its new place.
 */
function useChartMove(props: ChartPageProps, names: PersonNames, goTo: (id: ElementId) => void, t: Translate) {
  const { here, today } = props
  const land = props.readOnly ? undefined : props.reorder
  const [held, setHeld] = useState<{ unitId: ElementId; parent: string | null; nonce: number } | undefined>(undefined)
  const open = useCallback((unitId: ElementId, onto?: ElementId) => {
    setHeld((was) => ({ unitId, parent: onto ?? null, nonce: (was?.nonce ?? 0) + 1 }))
  }, [])
  const asked = props.moveAsked
  useEffect(() => { if (asked && land) open(asked.unitId) }, [asked?.nonce, land !== undefined])
  const close = useCallback(() => setHeld(undefined), [])
  const moved = useCallback(async (steps: Parameters<LandPeopleMoves>[0]) => {
    if (!land) return t('move.refused')
    try {
      const refused = movedText(await land(steps, UNIT_MOVE_BARRIER), t)
      if (refused === undefined && held) goTo(held.unitId)
      return refused
    } catch {
      return t('move.refused')
    }
  }, [land, held, goTo, t])
  const planned = useMoving(held, { organisation: here.at.organisation, today, scopeOf: here.scopeOf, scopeLabel: props.scopeLabel, onMove: moved, onClose: close, s: t, name: here.name, personName: (person) => names.text(pickedPerson(person)) })
  return { up: held?.unitId, open: land ? open : undefined, tree: planned?.tree, panel: planned?.panel }
}

type Moving = { organisation: UnitViewsHere['at']['organisation']; today: string; scopeOf: UnitViewsHere['scopeOf']; scopeLabel: (path: ScopePath) => string; onMove: (steps: Parameters<LandPeopleMoves>[0]) => Promise<string | undefined>; onClose: () => void; s: Translate; name: (id: ElementId) => string; personName: (person: PersonId) => string }

/** The move under way, as the tree lights it and the panel says it. Its plan starts afresh with each one opened. */
function useMoving(held: { unitId: ElementId; parent: string | null; nonce: number } | undefined, at: Moving): { tree: TreeMove; panel: ReactNode } | undefined {
  const planning = useMovePlan({ ...at, unitId: held?.unitId ?? '' }, held?.parent ?? null)
  const { setParent } = planning
  useEffect(() => { setParent(held?.parent ?? null) }, [held?.nonce])
  useEffect(() => {
    if (!held) return undefined
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape' && !keyClaimed(event)) { claimKey(event); at.onClose() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [held !== undefined, at.onClose])
  if (!held) return undefined
  const stateOf = (id: ElementId): DropState => {
    if (id === held.unitId) return 'moving'
    if (id === planning.current) return 'current'
    const option = planning.options.find((one) => one.id === id)
    if (!option || option.disabled) return 'none'
    const unit = at.organisation.units.find((one) => one.id === held.unitId)
    return unit === undefined || unitFits(at.organisation, unit, id) ? 'ok' : 'warn'
  }
  const top = planning.options.find((one) => one.id === AT_THE_TOP)
  const unit = at.organisation.units.find((one) => one.id === held.unitId)
  const tree: TreeMove = {
    stateOf,
    target: planning.parent === null ? undefined : planning.parent === AT_THE_TOP ? ORGANISATION : planning.parent,
    choose: (id) => setParent(id ?? AT_THE_TOP),
    atTop: !top || top.disabled ? 'current' : unit === undefined || unitFits(at.organisation, unit, undefined) ? 'ok' : 'warn',
    words: { newPlace: at.s('unitMove.newPlace'), sitsNow: at.s('unitMove.sitsNowShort') },
  }
  return {
    tree,
    panel: <MovePanel key={held.nonce} unitId={held.unitId} organisation={at.organisation} name={at.name} personName={at.personName} planning={planning} onClose={at.onClose} s={at.s} />,
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

/** *+ Unit* on the bar: inside the unit picked where one is and it is kept here, else at the top. Nothing where the chart makes no units. */
function addOnBar(newUnit: NewUnit, make: UnitMaking | undefined, inside: ChartUnit | undefined, t: Translate) {
  if (!newUnit.offer || !make) return undefined
  const { offer, open } = newUnit
  if (inside) {
    return <Button variant="plain" onClick={() => open(inside)} title={t('chart.addInside', { name: inside.name })} data-guide="chart.addAtTop" data-testid="chart-add-top">{t('chart.addShort')}</Button>
  }
  return <AddAtTop offer={offer()} onAdd={() => open()} onLink={make.onOpenOperating} guide="chart.addAtTop" testId="chart-add-top" label={t('chart.addShort')} tip={t('chart.addAtTop')} t={t} />
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
  return capture
}

/**
 * A unit's own menu, from a right-click on its box or the menu key on its name:
 * what its picked box offers, and its fold. Nothing while a move is under way.
 */
function useUnitMenu(here: UnitViewsHere, folds: ChartFolds, going: Going, moving: ReturnType<typeof useChartMove>, newUnit: NewUnit, t: Translate) {
  const [held, setHeld] = useState<{ unit: ChartUnit; at: HTMLElement } | undefined>(undefined)
  const open = useCallback((unit: ChartUnit, at: HTMLElement) => setHeld({ unit, at }), [])
  const close = useCallback(() => setHeld(undefined), [])
  if (!held) return { open, drawn: null }
  const { unit } = held
  const offer = newUnit.offer?.()
  const items: MenuEntry[] = [
    ...(offer && newUnit.open ? [{
      label: t('chart.addInsideShort'), 'data-testid': 'chart-menu-add',
      ...(offer.ok ? {} : { refused: offer.reason }), onSelect: () => newUnit.open(unit),
    }] : []),
    ...(moving.open ? [{ label: t('unitMove.open'), 'data-testid': 'chart-menu-move', onSelect: () => moving.open?.(unit.id) }] : []),
    { label: t('chart.focusHere'), 'data-testid': 'chart-menu-focus', onSelect: () => going.focus(unit.id) },
    ...(unit.children.length > 0 ? [{
      label: t(folds.folded.has(unit.id) ? 'chart.unfold' : 'chart.fold', { name: unit.name }), 'data-testid': 'chart-menu-fold', onSelect: () => folds.toggle(unit.id),
    }] : []),
    ...(here.heldHere(unit.id) ? [] : [{ label: t('chart.openWhereKept'), 'data-testid': 'chart-menu-open', onSelect: () => going.open(unit.id) }]),
  ]
  return { open, drawn: <Menu open anchorEl={held.at} label={unit.name} items={items} onClose={close} /> }
}

/**
 * The chart keeps still when the panel docks beside it. The tree is centred in
 * the room it has, so the panel opening on a pick, and the key and the dock
 * finding their places again beside it, moved every box sideways by half of
 * what they took. For a moment after the panel comes or goes, wherever the
 * tree has been moved to by the room changing, it is put back where it stood;
 * it pans only where the box picked would then be under the panel. Once the
 * panel has gone, the tree is centred again.
 */
function useSteadyOnDock(pane: { current: HTMLElement | null }, stage: { current: HTMLElement | null }, picked: ElementId | undefined, docked: boolean) {
  const latest = useRef(picked)
  latest.current = picked
  const said = useRef({ x: undefined as number | undefined, until: 0, offset: 0 })
  const treeOf = useCallback(() => stage.current?.querySelector<HTMLElement>('.org-tree') ?? null, [stage])
  // The tree spans the stage; what moves is the boxes centred in it, so the first box is what is measured.
  const xOf = (tree: HTMLElement) => tree.querySelector('[data-tree-box]')?.getBoundingClientRect().left
  // Where the tree stood before the panel moved: read on every render that is not the panel moving.
  useLayoutEffect(() => {
    const tree = treeOf()
    if (tree && Date.now() > said.current.until) said.current.x = xOf(tree)
  })
  useLayoutEffect(() => {
    said.current.until = Date.now() + STEADY_FOR_MS
    if (!docked) {
      said.current.offset = 0
      const tree = treeOf()
      if (tree) tree.style.left = ''
    }
  }, [docked, treeOf])
  useEffect(() => {
    const element = pane.current
    const board = stage.current
    if (!element || !board || typeof ResizeObserver === 'undefined') return undefined
    const settle = () => {
      const tree = treeOf()
      const held = said.current
      if (!tree || held.x === undefined || Date.now() > held.until || held.until - Date.now() > STEADY_FOR_MS || !docked) return
      const now = xOf(tree)
      if (now === undefined) return
      const moved = now - held.x
      if (Math.abs(moved) < 1) return
      const scale = Number.parseFloat(getComputedStyle(board).zoom) || 1
      held.offset -= moved
      tree.style.left = `${held.offset / scale}px`
      const id = latest.current
      const box = id === undefined ? undefined : board.querySelector<HTMLElement>(`[data-tree-box="${id.replace(/["\\]/g, '\\$&')}"]`)
      box?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    }
    const watch = new ResizeObserver(settle)
    watch.observe(element)
    watch.observe(board)
    return () => watch.disconnect()
  }, [pane, stage, treeOf, docked])
}

/** How long after the panel comes or goes the chart is held where it stood. */
const STEADY_FOR_MS = 800
