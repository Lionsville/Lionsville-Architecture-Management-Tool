// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The Conway map, drawn in its tab (ADR-0036 §7, ADR-0016): do the teams and the
 * systems line up? It says the answer in a sentence with one sum that
 * reconciles, shows every two units once in a grid (`ConwayGrid`), and puts what
 * to do next in the panel beside it (`ConwayReader`). The columns and lines stay
 * as a second reading (`ConwayLines`) and as the picture of the pair chosen.
 *
 * **Where owners are few the map says it cannot answer**: half the applications
 * without one and the first thing it asks for is owners, in place, each one step.
 *
 * **Nothing here writes until a button in the panel is pressed**, each press one
 * step in the scope that keeps the row: an interaction, an owner, a type on a
 * party, a mark as intended, a plan. The arithmetic is `model/conway` and
 * `model/conwayReading`. The reading, the grouping and the pair are in the
 * address (`useViewFacets`), so an agent and a link reach this state of it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '@mui/material/styles'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { plural } from '../../i18n/strings'
import type { Command } from '../../model/commands'
import { conwayMap } from '../../model/conway'
import type { ConwayLine } from '../../model/conway'
import { conwayPairs, conwaySum, groupingRollsUp, linesOfPair, pairId, readPairId } from '../../model/conwayReading'
import type { ConwaySum } from '../../model/conwayReading'
import type { HostModel } from '../../model/hostModel'
import { pickedPerson } from '../../model/person'
import type { UnitType } from '../../model/operatingModel'
import type { DesignDiagram, ElementId } from '../../model/types'
import { compareUnits, unitTypeRank } from '../../model/unitOrder'
import { isUnit, organisationOn, personOf, runsOn, unitsAbove } from '../../model/units'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { usePersonNames } from '../../people/ui/names'
import { checkMarksHere } from '../../projects/checkMarks'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { captureSheet } from '../../widgets/capturePage'
import type { PageCaptureOptions, PageHandle } from '../../widgets/capturePage'
import { Button } from '../../widgets/kit/Button'
import { PageState } from '../../widgets/kit/PageState'
import { Segmented } from '../../widgets/kit/Segmented'
import { ViewBar, ViewBarMenu } from '../../widgets/kit/ViewBar'
import { useViewFacets } from '../../widgets/placeTab'
import { locatedSelector } from '../../widgets/useLocated'
import { useSelectRequest } from '../../widgets/useSelectRequest'
import type { SelectRequest } from '../../widgets/useSelectRequest'
import { useFindingMarks } from '../checkMarking'
import { foldKey } from '../sessionFolds'
import { ConwayGrid, ConwayKey } from './ConwayGrid'
import { ConwayLines, ConwayPairDrawing } from './ConwayLines'
import type { ConwayShow } from './ConwayLines'
import { ConwayPlanDialog } from './ConwayPlanDialog'
import { ConwayReader } from './ConwayReader'
import type { ConwayActing, ConwayChosen } from './ConwayReader'
import { findingText } from './conwayWords'
import { InteractDialog } from './Interactions'
import type { Interacting } from './Interactions'
import { conwayInputHere } from './unitViewsHere'
import type { UnitViewsHere } from './unitViewsHere'
import type { WriteIn } from './writeIn'
import { refusalKey } from './writeIn'
import type { StringKey } from '../../i18n'
import './ConwayPage.css'

export type ConwayPageProps = {
  diagram: DesignDiagram
  here: UnitViewsHere
  index: ScopeIndex
  scope: ScopePath
  model: HostModel
  today: string
  readOnly: boolean
  people: PeopleRegisterAccess | undefined
  scopeLabel: (path: ScopePath) => string
  selectedId?: ElementId
  onSelect(id: ElementId | undefined): void
  /** Leave for where a record is kept: a unit on its chart, an application on its page. */
  onOpen(id: ElementId): void
  /** Where a change may be made from this page. Absent: the map offers none. */
  declare?: {
    dispatch: (command: Command) => unknown
    newRowId: () => string
    newPlanId: () => string
    planBody: () => string
    scopeName: string
    /** A change to a record another scope keeps, as that scope's own step. */
    writeIn?: WriteIn
    writable?: (path: ScopePath) => boolean
    onRefused?: (key: StringKey) => void
  }
  onOpenPlan?(id: string): void
  onOpenOperating?(): void
  onOpenLandscape?(): void
  onReadMore?(): void
  /** The toolbar's row, where the bar stands beside the day. Absent: it stands over the page. */
  pageBar?: HTMLElement | null
  select?: SelectRequest
  onHandle?(handle: PageHandle | undefined): void
}

/** The units to declare an interaction with, in the order every list of units reads. */
function unitsInOrder(here: UnitViewsHere): { id: ElementId; name: string }[] {
  const { units, unitTypes } = here.at.organisation
  return units.filter(isUnit).sort(compareUnits(unitTypeRank(unitTypes))).map((unit) => ({ id: unit.id, name: unit.name }))
}

/** The units this install's person holds a role in on the day, and every unit above each: where *you* are marked. */
function useMine(here: UnitViewsHere, day: string): ReadonlySet<ElementId> {
  const names = usePersonNames()
  return useMemo(() => {
    const { units, assignments } = organisationOn(here.at.organisation, day)
    const held = assignments
      .filter((one) => runsOn(one, day) && names.isMe(pickedPerson(personOf(one))))
      .map((one) => one.unitId)
    return new Set(held.flatMap((id) => [id, ...unitsAbove(units, id)]))
  }, [names, here, day])
}

/** The page as the agent's renderer reaches it: what is drawn is the reading that is up, without the panel. */
function usePageHandle(
  page: { current: HTMLDivElement | null }, diagramId: string, selectedId: ElementId | undefined,
  onHandle: ((handle: PageHandle | undefined) => void) | undefined, background: string,
) {
  const capture = useCallback(async (options: PageCaptureOptions) => {
    const node = page.current
    if (!node) throw new Error('ConwayPage: the page is not on screen')
    return captureSheet(node, { ...options, background })
  }, [page, background])
  useEffect(() => {
    if (!onHandle) return undefined
    onHandle({ diagramId, capture, ...(selectedId !== undefined ? { selectedId } : {}) })
    return () => onHandle(undefined)
  }, [onHandle, diagramId, capture, selectedId])
}

/** The sentence, and the sum under it. */
function Verdict({ sum, day, rollsUp, typeName, t, language }: { sum: ConwaySum; day: string; rollsUp: boolean; typeName: string | undefined; t: Translate; language: Parameters<typeof formatDay>[1] }) {
  const on = formatDay(day, language)
  const head = sum.lowCoverage
    ? t('conway.verdict.low', { noOwner: sum.noOwner, applications: sum.applications })
    : sum.attention > 0
      ? plural(t, { one: 'conway.verdict.attention.one', other: 'conway.verdict.attention.other' }, sum.attention)
      : t('conway.verdict.linesUp', { day: on })
  const parts = sum.lowCoverage
    ? [
        t('conway.sum.low', { noOwner: sum.noOwner, applications: sum.applications, unjudged: sum.unjudged, interfaces: sum.interfaces }),
        sum.judged === 0 ? undefined : t('conway.sum.judged', { judged: sum.judged, unsaid: sum.judgedUnsaid }),
      ]
    : [
        sum.agree > 0 ? plural(t, { one: 'conway.sum.agree.one', other: 'conway.sum.agree.other' }, sum.agree) : undefined,
        sum.unused > 0 ? plural(t, { one: 'conway.sum.unused.one', other: 'conway.sum.unused.other' }, sum.unused) : undefined,
        sum.accepted > 0 ? plural(t, { one: 'conway.sum.accepted.one', other: 'conway.sum.accepted.other' }, sum.accepted) : undefined,
        sum.noOwner > 0 ? t('conway.sum.noOwner', { noOwner: sum.noOwner, unjudged: sum.unjudged, interfaces: sum.interfaces }) : undefined,
      ]
  return (
    <div data-testid="conway-verdict" data-guide="conway.verdict">
      <h2 className="conway__verdict">{head}</h2>
      <p className="conway__sum" data-testid="conway-count">{parts.filter(Boolean).join(' ')}</p>
      {sum.bothEnds > 0 && <p className="conway__sum">{plural(t, { one: 'conway.sum.bothEnds.one', other: 'conway.sum.bothEnds.other' }, sum.bothEnds, { unjudged: sum.unjudged })}</p>}
      {!rollsUp && typeName !== undefined && <p className="conway__said" data-testid="conway-no-rollup">{t('conway.noRollUp', { type: typeName })}</p>}
    </div>
  )
}

/** What this page can change, each press one step where the record is kept; nothing where it is only read. */
function useActing(props: ConwayPageProps, setInteracting: (one: Interacting) => void, setPlanning: (ids: readonly ElementId[]) => void): ConwayActing | undefined {
  const { declare, readOnly, here, model } = props
  return useMemo(() => {
    if (!declare || readOnly) return undefined
    /** An element changed where it is kept: the session's step here, that scope's own elsewhere. */
    const change = (id: ElementId, patch: Record<string, unknown>) => {
      if (here.heldHere(id)) { declare.dispatch({ type: 'element.update', id, patch }); return }
      const scope = here.scopeOf(id)
      if (scope === undefined || !declare.writeIn) return
      void declare.writeIn(scope, () => [{ type: 'element.update', id, patch }]).then(
        (written) => { const key = refusalKey(written); if (key) declare.onRefused?.(key) },
        () => declare.onRefused?.('pick.notWritten'),
      )
    }
    return {
      sayHow: (a, b) => {
        const unit = (id: ElementId) => here.at.organisation.units.some((one) => one.id === id && isUnit(one))
        if (b === undefined) {
          if (!here.heldHere(a) || !unit(a)) return undefined
          return () => setInteracting({ mode: 'new', from: { id: a, name: here.name(a) } })
        }
        const held = [a, b].find((id) => here.heldHere(id) && unit(id))
        if (held === undefined || !unit(a) || !unit(b)) return undefined
        return () => setInteracting({ mode: 'new', from: { id: held, name: here.name(held) }, with: held === a ? b : a })
      },
      change: (row) => {
        const held = model.relations.find((one) => one.id === row.id && one.type === 'interacts')
        if (!held) return undefined
        return () => setInteracting({ mode: 'edit', row: held, from: { id: held.sourceId, name: here.name(held.sourceId) } })
      },
      remove: (id) => (model.relations.some((row) => row.id === id && row.type === 'interacts') ? () => { declare.dispatch({ type: 'relation.delete', id }) } : undefined),
      setOwner: (appId, unitId) => change(appId, { partyId: unitId }),
      makeUnits: (types) => { for (const [id, unitTypeId] of types) if (unitTypeId) change(id, { unitTypeId }) },
      planAway: setPlanning,
    }
  }, [declare, readOnly, here, model, setInteracting, setPlanning])
}

/** Which two columns a pair of ends draws, and the applications of each. */
function sideOf(map: ReturnType<typeof conwayMap>, unit: ElementId | undefined) {
  const group = map.groups.find((one) => one.unitId === unit)
  const apps = group?.applications ?? map.groups.flatMap((one) => one.applications.filter((app) => app.partyId === unit && unit !== undefined))
  return { unitId: unit, apps }
}

/** The bar: the reading, what it is grouped by with its value said, and Find me with its reason where it cannot. */
function ConwayBar({ flush, reading, groupBy, types, firstMine, onReading, onGroup, onFindMe, t }: {
  flush: boolean; reading: string; groupBy: string | undefined; types: readonly UnitType[]; firstMine: ElementId | undefined
  onReading: (tab: string) => void; onGroup: (group: string | undefined) => void; onFindMe: (id: ElementId) => void; t: Translate
}) {
  const groupWord = groupBy === undefined ? t('conway.byOwner') : types.find((type) => type.id === groupBy)?.name ?? ''
  return (
    <ViewBar
      flush={flush} label={t('conway.barLabel')}
      reading={(
        <Segmented
          label={t('conway.readingLabel')} value={reading} data-guide="conway.reading" onChange={onReading}
          options={[{ value: 'grid', label: t('conway.grid') }, { value: 'lines', label: t('conway.lines') }]}
        />
      )}
      show={(
        <ViewBarMenu
          label={t('conway.groupByValue', { value: groupWord })} menuLabel={t('conway.groupBy')} data-guide="conway.groupBy"
          items={[
            { label: t('conway.byOwner'), checked: groupBy === undefined, onSelect: () => onGroup(undefined) },
            ...types.map((type) => ({ label: type.name, checked: type.id === groupBy, onSelect: () => onGroup(type.id) })),
          ]}
        />
      )}
      find={(
        <Button
          variant="quiet" data-testid="conway-find-me" data-guide="conway.findMe"
          {...(firstMine === undefined ? { reason: t('conway.findMeNone') } : {})}
          onClick={() => { if (firstMine !== undefined) onFindMe(firstMine) }}
        >
          {t('chart.findMe')}
        </Button>
      )}
    />
  )
}

/** What the reader is on, from the pair in the address and the element chosen. */
function chosenOf(asked: ReturnType<typeof readPairId>, element: ElementId | undefined, drawn: (id: string) => boolean, isUnitId: (id: ElementId) => boolean): ConwayChosen {
  if (asked) return { kind: 'pair', ...asked }
  if (element === undefined || !drawn(element)) return { kind: 'none' }
  return isUnitId(element) ? { kind: 'unit', id: element } : { kind: 'app', id: element }
}

export function ConwayPage(props: ConwayPageProps) {
  const { t, language } = useStrings()
  const theme = useTheme()
  const { here, diagram, today, scope } = props
  const day = diagram.asOf ?? today
  const [facets, setFacets] = useViewFacets(diagram.id)
  const types = here.at.organisation.unitTypes
  const groupBy = types.some((type) => type.id === facets.group) ? facets.group : undefined
  const reading = facets.tab === 'lines' ? 'lines' : 'grid'
  const asked = readPairId(facets.pair)
  const [element, setElement] = useState<ElementId | undefined>(undefined)
  const [show, setShow] = useState<ConwayShow>('all')
  const [showUnowned, setShowUnowned] = useState(false)
  const [interacting, setInteracting] = useState<Interacting | undefined>(undefined)
  const [planning, setPlanning] = useState<readonly ElementId[] | undefined>(undefined)
  const input = useMemo(() => conwayInputHere(props.index, scope, props.model, here, day), [props.index, scope, props.model, here, day])
  const map = useMemo(() => conwayMap(input, day, groupBy !== undefined ? { groupBy } : {}), [input, day, groupBy])
  const marks = useMemo(() => checkMarksHere(props.index, scope, props.model), [props.index, scope, props.model])
  const mine = useMine(here, day)
  const remember = foldKey(scope, diagram.id, 'findings')
  const slots = useFindingMarks(map.findings, { findingOf: (one) => one, sentence: (one) => findingText(one, here, t), marks, remember })
  const pairs = useMemo(() => conwayPairs(map, slots.shown), [map, slots.shown])
  const sum = useMemo(() => conwaySum(map, pairs), [map, pairs])
  const page = useRef<HTMLDivElement | null>(null)
  usePageHandle(page, diagram.id, props.selectedId, props.onHandle, theme.palette.background.default)
  const acting = useActing(props, setInteracting, setPlanning)
  const { onSelect } = props

  const chooseElement = useCallback((id: ElementId) => {
    setElement(id)
    setFacets({ pair: undefined })
    onSelect(here.heldHere(id) ? id : undefined)
  }, [here, onSelect, setFacets])
  const choosePair = useCallback((a: ElementId | undefined, b: ElementId | undefined) => {
    setElement(undefined)
    setFacets({ pair: pairId(a, b) })
    onSelect(undefined)
  }, [onSelect, setFacets])
  const chooseNothing = useCallback(() => {
    setElement(undefined)
    setFacets({ pair: undefined })
    onSelect(undefined)
  }, [onSelect, setFacets])
  const drawn = useCallback((id: string) => map.groups.some((group) => group.unitId === id || group.applications.some((app) => app.id === id)), [map])
  /** Chosen, and on the second reading brought into view: columns scroll sideways, and what was asked for may be off to the right. */
  const goTo = useCallback((id: ElementId) => {
    chooseElement(id)
    page.current?.querySelector(locatedSelector(id))?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [chooseElement])
  // Until the index has been read the map draws nothing yet, and a request spent then would find nothing to select.
  useSelectRequest(props.select, map.groups.length > 0 ? drawn : undefined, goTo)
  // Selected from outside the page, by an agent's `?select=` once it has landed: the reader follows.
  useEffect(() => {
    if (props.selectedId !== undefined && drawn(props.selectedId)) setElement(props.selectedId)
  }, [props.selectedId, drawn])

  const isUnitId = (id: ElementId) => map.groups.some((group) => group.unitId === id) || here.at.organisation.units.some((unit) => unit.id === id)
  const chosen = chosenOf(asked, element, drawn, isUnitId)
  const chosenPair = chosen.kind === 'pair' ? chosen : undefined
  const [pairA, pairB] = [chosenPair?.a, chosenPair?.b]
  const chosenLines = useMemo(() => (pairA !== undefined || pairB !== undefined ? linesOfPair(map, pairA, pairB) : []), [map, pairA, pairB])
  const kindOf = (id: ElementId) => {
    const unit = here.at.organisation.units.find((one) => one.id === id)
    return types.find((type) => type.id === unit?.unitTypeId)?.name
  }
  const overLimit = useMemo(() => new Set(slots.shown.flatMap((one) => (one.kind === 'overLimit' ? [one.unitId] : []))), [slots.shown])
  const firstMine = map.groups.find((group) => group.unitId !== undefined && mine.has(group.unitId))?.unitId
  const onLine = (line: ConwayLine) => { if (line.from !== undefined || line.to !== undefined) choosePair(line.from, line.to) }
  const bar = (
    <ConwayBar
      flush={props.pageBar !== undefined} reading={reading} groupBy={groupBy} types={types} firstMine={firstMine} t={t}
      onReading={(tab) => setFacets({ tab: tab === 'lines' ? 'lines' : undefined })}
      onGroup={(group) => { setFacets({ group, pair: undefined }); setElement(undefined) }}
      onFindMe={goTo}
    />
  )
  const reader = (
    <ConwayReader
      map={map} pairs={pairs} sum={sum} shown={slots.shown} accepted={slots.accepted} chosen={chosen} here={here} day={day} you={mine}
      acting={acting}
      mayChange={(id) => here.heldHere(id) || (props.declare?.writable?.(here.scopeOf(id) ?? '') ?? false)}
      onPair={choosePair} onUnit={chooseElement} onApp={chooseElement} onAll={chooseNothing} onOpen={props.onOpen}
      onOpenOperating={props.onOpenOperating} onReadMore={props.onReadMore} remember={remember}
    />
  )
  const grid = (
    <>
      <ConwayGrid
        map={map} pairs={pairs} chosen={chosenPair} nameOf={here.name} you={mine} overLimit={overLimit}
        onPair={choosePair} onUnit={chooseElement} t={t}
      />
      {chosenPair
        ? (
          <ConwayPairDrawing
            a={sideOf(map, chosenPair.a)} b={sideOf(map, chosenPair.b)} lines={chosenLines}
            kindOf={kindOf} nameOf={here.name} pickedApp={undefined} grouped={groupBy !== undefined}
            onUnit={chooseElement} onApp={chooseElement} onLine={onLine} t={t}
          />
        )
        : <ConwayKey t={t} />}
      {!chosenPair && !sum.lowCoverage && <p className="conway__about">{t('conway.about')}</p>}
    </>
  )
  const lines = (
    <ConwayLines
      map={map} kindOf={kindOf} nameOf={here.name} show={show} onShow={setShow} showUnowned={showUnowned} onShowUnowned={setShowUnowned}
      chosenLines={chosenLines} pickedUnit={chosen.kind === 'unit' ? chosen.id : undefined} pickedApp={chosen.kind === 'app' ? chosen.id : undefined}
      grouped={groupBy !== undefined} onUnit={chooseElement} onApp={chooseElement} onLine={onLine} t={t}
    />
  )
  return (
    <>
      {props.pageBar ? createPortal(bar, props.pageBar) : props.pageBar === undefined ? bar : null}
      <div className="conway" data-testid="conway-page">
        {sum.applications === 0
          ? (
            <div className="conway__main" ref={page}>
              <PageState
                state="empty" title={t('conway.empty.title')} body={t('conway.empty.body')}
                {...(props.onOpenLandscape ? { action: { label: t('conway.empty.open'), onPress: props.onOpenLandscape } } : {})}
              />
            </div>
          )
          : (
            <>
              <div className="conway__main" ref={page} data-testid="conway-body">
                <Verdict sum={sum} day={day} rollsUp={groupingRollsUp(map, input.units, groupBy)} typeName={types.find((type) => type.id === groupBy)?.name} t={t} language={language} />
                {reading === 'grid' ? grid : lines}
              </div>
              {reader}
            </>
          )}
      </div>
      {interacting && props.declare && (
        <InteractDialog
          interacting={interacting} units={unitsInOrder(here)}
          newRowId={props.declare.newRowId} dispatch={props.declare.dispatch} scopeName={props.declare.scopeName}
          onClose={() => setInteracting(undefined)} s={t}
        />
      )}
      {planning && props.declare && (
        <ConwayPlanDialog
          ids={planning} model={props.model} here={here} declare={props.declare}
          onClose={() => setPlanning(undefined)} onOpenPlan={props.onOpenPlan} t={t}
        />
      )}
    </>
  )
}

