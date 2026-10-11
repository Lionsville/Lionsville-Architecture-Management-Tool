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
 * **A unit opens where it is kept.** Choosing one this scope holds selects it,
 * and the inspector docked beside the page edits it — its type, the people in
 * its roles, the interactions it declares. One kept in another scope opens
 * there, on its record. A vacancy in a unit kept here assigns someone at once.
 *
 * **A person's chip opens their assignment.** In a unit kept here it chooses
 * the assignment, and the inspector shows it (`AssignmentInspector`, through
 * `useChartChoice`); in one kept elsewhere it opens the unit there. The
 * editor selecting anything lets the choice go, so the inspector shows one
 * thing at a time. The boxes themselves are `ChartUnitBox`.
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
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import type { Command } from '../../model/commands'
import { FOLD_OVER, findingsByUnit, orgChart, rollUp, unitsHolding, unitsNamed, walk } from '../../model/orgChart'
import type { ChartHolder, ChartUnit, OrgChart } from '../../model/orgChart'
import { pickedPerson } from '../../model/person'
import type { PersonId } from '../../model/person'
import type { DesignDiagram, ElementId } from '../../model/types'
import { dayBefore, loadOn } from '../../model/units'
import { mayChangeIn } from '../../model/managing'
import { meIn } from '../../people/me'
import { registerOf, resolvePerson } from '../../people/shown'
import { usePersonNames } from '../../people/ui/names'
import type { PersonNames } from '../../people/ui/names'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { findingSentence, findingsOfOrganisation } from '../../projects/checks'
import type { Finding } from '../../projects/checks'
import type { ScopePath } from '../../projects/scopePath'
import { captureSheet } from '../../widgets/capturePage'
import type { PageCaptureOptions, PageHandle } from '../../widgets/capturePage'
import { locatedRing, useLocated } from '../../widgets/useLocated'
import { useSelectRequest } from '../../widgets/useSelectRequest'
import type { SelectRequest } from '../../widgets/useSelectRequest'
import { foldKey, SessionFolds } from '../sessionFolds'
import { AssignDialog } from './AssignDialog'
import type { Assigning } from './AssignDialog'
import { ChartOutline } from './ChartOutline'
import { UnitBox } from './ChartUnitBox'
import type { Drawing } from './ChartUnitBox'
import type { LandPeopleMoves } from './landPeopleMoves'
import type { UnitViewsHere } from './unitViewsHere'
import { useChartFolds } from './useChartFolds'
import type { ChartFolds } from './useChartFolds'
import { useSiblingOrder } from './useSiblingOrder'

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
  /** How a unit's move among its siblings lands, a step in each scope that keeps one (`landPeopleMoves`). Absent: the outline moves nothing. */
  reorder?: LandPeopleMoves
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
  const chart = useMemo(
    () => orgChart(here.at.organisation, day, { include: here.includes, canonical }),
    [here, day, canonical],
  )
  const register = useMemo(() => registerOf(people?.people ?? []), [people?.people])
  const me = useMemo(() => meIn(people?.me, register)?.id, [people?.me, register])
  const findings = useChartFindings(here, chart, day, canonical)
  const folds = useFoldsOf(chart, props.scope ?? '', diagram.id, props.folds)
  const page = useRef<HTMLDivElement | null>(null)
  const open = useCallback((id: ElementId) => {
    if (here.heldHere(id)) { props.onSelect(id); return }
    const scope = here.scopeOf(id)
    if (scope !== undefined) props.onOpenElsewhere(scope, id)
  }, [here, props.onSelect, props.onOpenElsewhere])
  const { onChoose, chosen } = props
  // The editor selecting anything — a unit pressed, a finding followed, a link — lets the assignment go.
  useEffect(() => { if (props.selectedId !== undefined && chosen !== undefined) onChoose?.(undefined) }, [props.selectedId, chosen, onChoose])
  const choose = useCallback((holder: ChartHolder, unit: ChartUnit) => {
    if (!onChoose || !here.heldHere(unit.id)) { open(unit.id); return }
    props.onSelect(undefined)
    onChoose(holder.assignment.id)
  }, [onChoose, here, open, props.onSelect])
  const { locatedId, locate } = useLocated(page, (id) => { if (here.heldHere(id)) props.onSelect(id) })
  const { current, goTo } = useGoTo(chart, folds, locate, props)
  useSelectRequest(props.select, (id) => [...walk(chart.roots)].some((unit) => unit.id === id), goTo)
  usePageHandle(page, diagram.id, props.selectedId, props.onHandle, theme.palette.background.default)
  const order = useSiblingOrder({
    here, day, scope: props.scope ?? '', unitId: current, land: props.readOnly ? undefined : props.reorder, t,
  })

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
  const types = new Map(here.at.organisation.unitTypes.map((type) => [type.id, type.name]))
  const typeName = (id: string | undefined) => types.get(id ?? '') ?? ''
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
    day, today, language, t, selectedId: props.selectedId, chosen, open, choose, mayAssign,
    vacancy: editable ? (unit, roleId) => {
      if (here.heldHere(unit.id)) setAssigning({ unit, assigning: { mode: 'new', roleId } })
      else open(unit.id)
    } : undefined,
    folds: { folded: folds.folded, toggle: folds.toggle, rollUp: (unit) => rollUp(unit, findings.byUnit) },
  }
  return (
    <Box data-testid="chart-page" sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <ChartBar chart={chart} folds={folds} onFind={find} onFindMe={findMe} note={note} t={t} />
      <Box sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
        <ChartOutline
          chart={chart} folded={folds.outline} onToggle={folds.toggleOutline} current={current} onPick={goTo} typeName={typeName} order={order} t={t}
        />
        <Box ref={page} data-testid="chart-body" sx={{ flex: '1 1 auto', minWidth: 0, minHeight: 0, overflow: 'auto', p: 2, bgcolor: 'background.default', ...locatedRing(locatedId) }}>
          {chart.roots.length === 0
            ? <Typography sx={{ fontSize: 12.5, color: 'text.secondary', py: 6, textAlign: 'center' }}>{t('chart.empty', { day: formatDay(day, language) })}</Typography>
            : <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>{chart.roots.map((unit) => <UnitBox key={unit.id} unit={unit} depth={0} drawing={drawing} />)}</Box>}
          <ChartFindings findings={findings.listed} scopeLabel={props.scopeLabel} chart={chart} day={day} names={names} onFinding={goTo} />
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
    </Box>
  )
}

/**
 * What the organisation contradicts on the day about the units drawn and the
 * people in them: the lines said under the chart, and how many are about each
 * unit, for what a folded unit says it hides.
 */
function useChartFindings(here: UnitViewsHere, chart: OrgChart, day: string, canonical: (id: PersonId) => PersonId) {
  return useMemo(() => {
    const units = new Set([...walk(chart.roots)].map((unit) => unit.id))
    const persons = new Set([...walk(chart.roots)].flatMap((unit) => [...unit.slots.flatMap((slot) => slot.holders), ...unit.others].map((one) => canonical(one.person))))
    const listed = findingsOfOrganisation(here.at, day, canonical)
      .filter((finding) => (finding.person !== undefined ? persons.has(canonical(finding.person)) : units.has(finding.id)))
    return { listed, byUnit: findingsByUnit(chart, listed, canonical) }
  }, [here, chart, day, canonical])
}

/** The chart's folds, kept where the shell keeps them for the session, or — where it keeps none — for as long as the page is up. */
function useFoldsOf(chart: OrgChart, scope: ScopePath, viewId: string, kept: SessionFolds | undefined): ChartFolds {
  const [own] = useState(() => new SessionFolds())
  const memory = kept ?? own
  const keys = useMemo(() => ({ chart: foldKey(scope, viewId, 'chart'), outline: foldKey(scope, viewId, 'outline') }), [scope, viewId])
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
 * and *Fold all* and *Unfold all* — and, under it, why a first open of a large
 * chart is folded, until a fold is changed.
 */
function ChartBar({ chart, folds, onFind, onFindMe, note, t }: {
  chart: OrgChart; folds: ChartFolds; onFind: (query: string) => void; onFindMe: () => void; note: string | undefined; t: Translate
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
          onKeyDown={(event) => { if (event.key === 'Enter') onFind(query) }}
          sx={{ width: 200 }} slotProps={{ htmlInput: { 'data-testid': 'chart-find-input' } }}
        />
        <Button size="small" variant="outlined" onClick={() => onFind(query)} data-testid="chart-find">{t('chart.find')}</Button>
        <Button size="small" variant="outlined" onClick={onFindMe} data-testid="chart-find-me">{t('chart.findMe')}</Button>
        {note && <Typography data-testid="chart-note" role="status" sx={{ fontSize: 11.5, color: 'warning.main' }}>{note}</Typography>}
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={folds.foldAll} data-testid="chart-fold-all" data-guide="chart.foldAll">{t('chart.foldAll')}</Button>
        <Button size="small" onClick={folds.unfoldAll} data-testid="chart-unfold-all" data-guide="chart.unfoldAll">{t('chart.unfoldAll')}</Button>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('chart.legend')}</Typography>
      </Box>
      {folds.foldedOnOpen && (
        <Typography data-testid="chart-folded-note" sx={{ fontSize: 12, px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', color: 'text.secondary' }}>
          {t('chart.foldedOnOpen', { count: FOLD_OVER })}
        </Typography>
      )}
    </>
  )
}

/**
 * What the organisation contradicts on the day, about the units drawn and the
 * people in them — each a link to what it is about on the chart: the unit, or
 * the first unit the person holds a role in, unfolded to where it is.
 */
function ChartFindings({ findings, scopeLabel, chart, day, names, onFinding }: {
  findings: readonly Finding[]; scopeLabel: (path: ScopePath) => string; chart: OrgChart; day: string; names: PersonNames
  onFinding: (unitId: ElementId) => void
}) {
  const { t, language } = useStrings()
  const name = (person: string) => names.text(pickedPerson(person))
  return (
    <Box data-testid="chart-findings" sx={{ mt: 3 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>{t('chart.on', { day: formatDay(day, language) })}</Typography>
      {findings.length === 0
        ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('chart.nothing')}</Typography>
        : findings.map((finding, at) => {
          const about = finding.person !== undefined
            ? unitsHolding(chart, names.canonical(finding.person))[0]
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
