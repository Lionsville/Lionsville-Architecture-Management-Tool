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
 * for the way up, in the address so an agent opens it too (`usePlaceReading`).
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import { isChartLines } from '../../agent/screen'
import type { ChartLines } from '../../agent/screen'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
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
import type { PageCaptureOptions, PageHandle } from '../../widgets/capturePage'
import { Band } from '../../widgets/kit/Band'
import { Button } from '../../widgets/kit/Button'
import { CanvasDock } from '../../widgets/kit/CanvasDock'
import { PageState } from '../../widgets/kit/PageState'
import { usePlaceReading } from '../../widgets/placeReading'
import { locatedRing, useLocated } from '../../widgets/useLocated'
import { useSelectRequest } from '../../widgets/useSelectRequest'
import type { SelectRequest } from '../../widgets/useSelectRequest'
import { foldKey, SessionFolds } from '../sessionFolds'
import { AddAtTop } from './AddUnit'
import { AssignDialog, AssignPopover } from './AssignDialog'
import type { Assigning } from './AssignDialog'
import { ChartBar } from './ChartBar'
import type { ChartDay } from './ChartBar'
import { AT_THE_TOP } from './choices'
import { ChartFind } from './ChartFind'
import { chartKey, stepInTree } from './chartKeys'
import { chartExceptions, chartWideLines, holderLines } from './chartLines'
import { ChartConnectors, ChartLinesLegend, ChartLinesOverlay } from './ChartLinesOverlay'
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
import { useChartZoom } from './useChartZoom'
import { movedText, UNIT_MOVE_BARRIER } from './useMoveUnit'
import { useNewUnit } from './useNewUnit'
import type { NewUnit, UnitMaking } from './useNewUnit'
import { useSiblingOrder } from './useSiblingOrder'
import './chart.css'

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
  /** The outline's width, kept with the editor's panel widths (3.7.3). Absent: the outline keeps its own while it is up. */
  outline?: { width: number; onWidth(next: number): void }
  /** Whether the inspector docked beside the chart is up. Absent: it is the host's to say. */
  onDock?: (shown: boolean) => void
  /** Looking at another day, and keeping one with the chart. Absent: no day control here. */
  day?: ChartDay
  /** A unit's *Sits under* in the inspector asks for a move here: the panel opens, with the chart in view. */
  moveAsked?: { unitId: ElementId; nonce: number }
}

export function ChartPage(props: ChartPageProps) {
  const { t, language } = useStrings()
  const theme = useTheme()
  const { here, diagram, people, today } = props
  const day = diagram.asOf ?? today
  const [assigning, setAssigning] = useState<{ unit: ChartUnit; assigning: Assigning; at: HTMLElement | null } | undefined>(undefined)
  const [note, setNote] = useState<string | undefined>(undefined)
  const [summaryAsked, setSummaryAsked] = useState(false)
  const names = usePersonNames()
  const canonical = names.canonical
  const { chart, byUnit } = useChartReading(here, day, canonical)
  const register = useMemo(() => registerOf(people?.people ?? []), [people?.people])
  const me = useMemo(() => meIn(people?.me, register)?.id, [people?.me, register])
  const folds = useFoldsOf(chart, props.scope ?? '', diagram.id, props.folds)
  const page = useRef<HTMLDivElement | null>(null)
  const stage = useRef<HTMLDivElement | null>(null)
  const zoom = useChartZoom(page, stage)
  const [reading, setReading] = usePlaceReading(diagram.id)
  const focused = useMemo(() => focusedOn(chart, reading.focus), [chart, reading.focus])
  // The Lines menu: the person picked's from the start where the organisation says any line, none where it says none.
  const asked = isChartLines(reading.lines) ? reading.lines : undefined
  const lines: ChartLines = asked ?? (hasReportingLines(here.at.organisation) ? 'person' : 'off')
  const { onChoose, chosen, onSelect } = props
  const drawnLines = useMemo(() => {
    if (lines === 'off') return []
    if (lines !== 'person') return chartWideLines(here.at.organisation, chart, day, folds.folded, lines)
    const held = props.selectedId === undefined && chosen !== undefined ? here.at.organisation.assignments.find((one) => one.id === chosen) : undefined
    return held ? holderLines(here.at.organisation, chart, day, folds.folded, held) : []
  }, [lines, props.selectedId, chosen, here, chart, day, folds.folded])
  const exceptions = useMemo(() => (lines === 'exceptions' ? chartExceptions(here.at.organisation, chart, day) : []), [lines, here, chart, day])
  // Whenever the boxes may have moved, the lines are measured again from them.
  const redraw = useMemo(
    () => ({ people: folds.people, folded: folds.folded, chart, selected: props.selectedId, chosen, focus: reading.focus }),
    [folds.people, folds.folded, chart, props.selectedId, chosen, reading.focus],
  )
  const open = useCallback((id: ElementId) => {
    if (here.heldHere(id)) { onSelect(id); return }
    const scope = here.scopeOf(id)
    if (scope !== undefined) props.onOpenElsewhere(scope, id)
  }, [here, onSelect, props.onOpenElsewhere])
  // The editor selecting anything — a unit pressed, a finding followed, a link — lets the assignment go.
  useEffect(() => { if (props.selectedId !== undefined && chosen !== undefined) onChoose?.(undefined) }, [props.selectedId, chosen, onChoose])
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
    if (reading.focus !== undefined && id !== reading.focus && !unitsAboveIn(chart, id).includes(reading.focus)) setReading({ focus: undefined })
    goToUnit(id)
  }, [reading.focus, chart, goToUnit, setReading])
  // A unit's name picks it: selected where it is kept here, gone to on this chart where it is kept elsewhere.
  const pick = useCallback((id: ElementId) => {
    setSummaryAsked(false)
    if (here.heldHere(id)) { onSelect(id); return }
    onChoose?.(undefined)
    goTo(id)
  }, [here, onSelect, onChoose, goTo])
  useSelectRequest(props.select, (id) => [...walk(chart.roots)].some((unit) => unit.id === id), goTo)
  // What a link made here selects (ADR-0033, amended 17 October 2026): the unit gone to, kept here or elsewhere, while no person is chosen.
  usePageHandle(page, diagram.id, chosen === undefined ? current : props.selectedId, props.onHandle, theme.palette.background.default)
  const order = useSiblingOrder({
    here, day, scope: props.scope ?? '', unitId: current, land: props.readOnly ? undefined : props.reorder, t,
  })
  const moving = useChartMove(props, names, goTo, t)

  const findMe = () => {
    if (me === undefined) { setNote(t('chart.findMeWho')); return }
    const found = unitsHolding(chart, me)
    const first = found[0]
    if (first === undefined) { setNote(t('chart.findMeNone', { day: formatDay(day, language) })); return }
    setNote(undefined)
    goTo(first)
  }
  const roles = useMemo(() => new Map(here.at.organisation.roles.map((role) => [role.id, role])), [here])
  const roleName = useCallback((id: string) => roles.get(id)?.name ?? id, [roles])
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
  const pickedUnit = useMemo(() => (props.selectedId === undefined ? undefined : [...walk(chart.roots)].find((unit) => unit.id === props.selectedId)), [chart, props.selectedId])
  const focus = useCallback((id: ElementId | undefined) => {
    setReading({ focus: id })
    if (id !== undefined) folds.expand(id)
  }, [setReading, folds.expand])
  const drawnTop = focused ? [focused] : chart.roots
  const onKey = (unit: ChartUnit, event: KeyboardEvent) => {
    const said = chartKey(event)
    if (said === undefined || moving.up !== undefined) return
    if (said === 'move') { if (moving.open) { event.preventDefault(); moving.open(unit.id) } return }
    if (said === 'focus') { event.preventDefault(); focus(unit.id); return }
    event.preventDefault()
    const onward = said === 'pick'
      ? (current === unit.id ? stepInTree(drawnTop, folds.folded, unit.id, 'down') : unit.id)
      : stepInTree(drawnTop, folds.folded, unit.id, said)
    if (onward === undefined) return
    if (said === 'pick') pick(onward)
    else setRoving(onward)
    focusBox(stage.current, onward)
  }
  const [roving, setRoving] = useState<ElementId | undefined>(undefined)
  const drawing: Drawing = {
    chart, roles, typeName, names, external, scopeLabel: props.scopeLabel, plansOf: here.plansOf,
    day, today, language, t, selectedId: props.selectedId, chosen, pick, open, choose, mayAssign,
    loadOf: (person) => Math.round(loadOn(here.at.organisation.assignments, person, day, canonical) * 100),
    vacancy: editable ? (unit, roleId, at) => {
      if (here.heldHere(unit.id)) setAssigning({ unit, assigning: { mode: 'new', roleId }, at })
      else open(unit.id)
    } : undefined,
    folds: { folded: folds.folded, toggle: folds.toggle, rollUp: (unit) => rollUp(unit, byUnit) },
    people: folds.people,
    focus,
    roving: roving ?? current ?? drawnTop[0]?.id,
    onKey,
    ...(newUnit.offer ? { add: { offer: newUnit.offer, open: newUnit.open } } : {}),
    ...(moving.open ? { move: moving.open } : {}),
    ...(moving.tree ? { moving: moving.tree } : {}),
  }
  useFindKey(stage)
  // The panel docked beside the chart is up for what is picked and for the summary, and otherwise the chart has the width.
  const ownPanel = moving.up !== undefined || (lines === 'exceptions' && props.selectedId === undefined && chosen === undefined)
  const docked = !ownPanel && (props.selectedId !== undefined || chosen !== undefined || summaryAsked)
  const { onDock } = props
  useEffect(() => { onDock?.(docked) }, [onDock, docked])
  useEffect(() => () => onDock?.(true), [onDock])
  const organisationName = props.scopeLabel('')
  const level = levelOfFolds(chart, folds.folded)
  const unitName = useCallback((id: ElementId) => here.name(id), [here])
  const empty = chart.roots.length === 0
  return (
    <div data-testid="chart-page" className="chart-page">
      {moving.up !== undefined
        ? <Band tone="editing" title={t('unitMove.bandTitle', { name: here.name(moving.up) })} detail={t('unitMove.bandDetail')} />
        : !empty && (
          <ChartBar
            level={level} onLevel={folds.setLevels} people={folds.people} onPeople={folds.setPeople} lines={lines} onLines={(next) => setReading({ lines: next })}
            add={addOnBar(newUnit, props.make, pickedUnit && here.heldHere(pickedUnit.id) ? pickedUnit : undefined, t)} day={props.day} shownDay={diagram.asOf} t={t}
          />
        )}
      <ShownDayBand day={props.day} asOf={diagram.asOf} language={language} t={t} />
      {focused && !moving.up && <FocusBand chart={chart} focused={focused} organisation={organisationName} onFocus={focus} t={t} />}
      <div className="chart-page__main">
        {!moving.up && !empty && (
          <ChartOutline
            chart={chart} units={drawnTop} folded={folds.outline} onToggle={folds.toggleOutline} current={current} onPick={(id) => { folds.expand(id); setSummaryAsked(false); goTo(id) }}
            order={order} moveTo={moving.open && current !== undefined ? () => moving.open?.(current) : undefined} canMove={moving.open !== undefined} {...(props.outline ? { width: props.outline } : {})}
            find={<ChartFind chart={chart} names={names} roleName={roleName} onUnit={(id) => { setSummaryAsked(false); goTo(id) }} onHolder={(holder, unit) => { goTo(unit.id); choose(holder, unit) }} onMe={findMe} note={note} t={t} />}
            t={t}
          />
        )}
        <div className="chart-page__work">
          <Box ref={zoom.attach} {...(empty ? {} : zoom.canvas)} data-testid="chart-body" className="chart-canvas" sx={locatedRing(locatedId)}>
            {empty
              ? <EmptyChart day={day} language={language} add={newUnit.offer && props.make ? <AddAtTop offer={newUnit.offer()} onAdd={() => newUnit.open()} onLink={props.make.onOpenOperating} guide="chart.addFirst" testId="chart-add-first" primary t={t} /> : undefined} t={t} />
              : (
                <div ref={stage} className="chart-stage" style={{ zoom: zoom.zoom }}>
                  <ChartConnectors stage={stage} zoom={zoom.zoom} redraw={redraw} />
                  <OrgTree organisation={organisationName} focused={focused} drawing={drawing} />
                  <ChartLinesOverlay stage={stage} lines={drawnLines} zoom={zoom.zoom} redraw={redraw} unitName={unitName} t={t} />
                </div>
              )}
          </Box>
          {!empty && <CanvasDock zoom={zoom.zoom} onZoomIn={() => zoom.target.go('in')} onZoomOut={() => zoom.target.go('out')} onFit={() => zoom.target.go('fit')} onHome={() => zoom.target.go('home')} data-testid="chart-dock" />}
          {!empty && <ChartLinesLegend t={t} />}
          {!empty && (
            <div className="chart-foot">
              <button type="button" className="chart-foot__line" data-testid="chart-count" data-guide="chart.summary" aria-expanded={summaryAsked} onClick={() => { onSelect(undefined); onChoose?.(undefined); setSummaryAsked((was) => !was) }}>
                {summaryWords({ units: chart.units, people: chart.people, vacant: vacanciesIn(chart) }, t).map((part) => part.text).join(' · ')}
                {byUnit.size > 0 ? <span className="chart-foot__part" data-warn=""> · {t('chart.rollFindingsOther', { count: [...byUnit.values()].reduce((sum, one) => sum + one, 0) })}</span> : null}
              </button>
            </div>
          )}
        </div>
        {moving.panel && <div className="chart-page__panel">{moving.panel}</div>}
        {!moving.panel && ownPanel && (
          <div className="chart-page__panel">
            <ExceptionsPanel
              exceptions={exceptions} organisation={here.at.organisation} names={names} onGoTo={goTo} onOperating={props.make?.onOpenOperating}
              onClose={() => setReading({ lines: 'person' })} t={t}
            />
          </div>
        )}
      </div>
      {assigning && people && props.assign && (
        <AssignPopover
          at={assigning.at} assigning={assigning.assigning} unit={{ id: assigning.unit.id, name: assigning.unit.name }}
          roles={assigning.unit.slots.flatMap((slot) => roles.get(slot.roleId) ?? []).filter((role) => mayAssign(assigning.unit, role.id))}
          others={here.at.organisation.roles.filter((role) => roleOn(role, day) && mayAssign(assigning.unit, role.id))}
          register={people} today={day > today ? day : today} endOn={day > today ? dayBefore(day) : today}
          makeId={props.assign.makeId} dispatch={props.assign.dispatch} scopeName={props.assign.scopeName}
          loadOf={(person) => t('assign.loadNow', { share: Math.round(loadOn(here.at.organisation.assignments, person.id, day, canonical) * 100) })}
          shareOf={(person) => Math.round(loadOn(here.at.organisation.assignments, person, day, canonical) * 100)} personName={(person) => names.text(pickedPerson(person))}
          onClose={() => setAssigning(undefined)} s={t}
        />
      )}
      {newUnit.dialog}
    </div>
  )
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
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'f') return
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
function ShownDayBand({ day, asOf, language, t }: { day: ChartDay | undefined; asOf: string | undefined; language: string; t: Translate }) {
  if (!day || asOf === undefined || day.looking) return null
  return (
    <Band
      tone="looking" title={t('chart.dayShown', { day: formatDay(asOf, language as Parameters<typeof formatDay>[1]) })} dataGuide="chart.dayBand"
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
      tone="info" dataGuide="chart.focusBand"
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
function EmptyChart({ day, language, add, t }: { day: string; language: string; add: ReactNode; t: Translate }) {
  return (
    <div className="chart-empty" data-testid="chart-empty">
      <PageState state="empty" title={t('chart.emptyTitle')} body={t('chart.emptyBody', { day: formatDay(day, language as Parameters<typeof formatDay>[1]) })} />
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
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') at.onClose() }
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
}
