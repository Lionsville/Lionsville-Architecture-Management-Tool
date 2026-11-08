// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The landscape on a time axis, and the plans over it (ADR-0009).
 *
 * One ruler carries the dates, the scale and the day the board shows, so a slider
 * and the rows can no longer disagree (`widgets/kit/TimeAxis`). It opens on three
 * months back and nine ahead the first time, and after that where this person left
 * it: which years somebody is looking at is theirs, and no fact about the landscape.
 *
 * Dragging the handle moves the day the open board is looked at: the same look the
 * board's Day control makes, and like that one a view state and never a write
 * (ADR-0027). A press on a row opens a reader beside the axis; opening the plan or
 * the board is the second press.
 *
 * A page in the frame's main column (ADR-0033).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isDay, transitionDays } from '../../model'
import type { DesignElement, DesignModel, ElementId, Transition } from '../../model'
import { useStrings } from '../../i18n'
import { PageDialog } from '../../widgets/PageDialog'
import { PageClose } from '../../widgets/PageClose'
import { Button, IconButton } from '../../widgets/kit/Button'
import { HelpIcon } from '../../widgets/icons'
import { Dialog } from '../../widgets/kit/Dialog'
import { TextField } from '../../widgets/kit/Field'
import { FindField } from '../../widgets/kit/FindField'
import { PageState } from '../../widgets/kit/PageState'
import { TimeAxis } from '../../widgets/kit/TimeAxis'
import { dayNumber, openingView } from '../../widgets/kit/timeScale'
import type { AxisView } from '../../widgets/kit/timeScale'
import { useSeamWidth } from '../../widgets/useSeamWidth'
import { usePlaceTab } from '../../widgets/placeTab'
import { useViewerKeep } from '../../widgets/useViewerKeep'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { findings } from '../../model/checks'
import type { Finding } from '../../model/checks'
import { CHECK_CATALOGUE, DATE_CHECK } from '../../model/checkCatalogue'
import type { CheckMark } from '../../model/checkMarks'
import type { PlatformTree } from '../../model/hosting'
import { findingTarget } from '../findingTarget'
import { connectionGroups } from '../planReading'
import { roadmapOf } from '../timeline'
import { RoadmapFindings } from './RoadmapFindings'
import { ConnectionReader, ElementReader, InitiativeReader, PlanReader } from './RoadmapReader'
import { ApplicationRows, ConnectionRows, InitiativeRows, PlanRows, initiativeId } from './RoadmapRows'
import type { RowsContext } from './RoadmapRows'
import './Roadmap.css'

export type RoadmapActions = {
  /** Write a plan. The caller mints the id and the number, and opens it. */
  addTransition(title: string): void
  /** Read a plan on its own page. */
  onOpenPlan(id: string): void
  /** Look at the board behind this page on a day; `undefined` is today. Writes nothing. */
  setAsOf(day: string | undefined): void
  /** Show an element on the canvas. */
  onOpenElement(id: ElementId): void
  /** A plan in the scope that keeps it; absent, a reader offers no way there. */
  onOpenElsewhere?(scope: string, planId: string): void
  /**
   * *Accept* an interface the container lines imply (ADR-0013): write the
   * application line and land every one of them on it, as one step. Named by
   * the first of those lines, which is what the finding carries.
   */
  acceptInterface(relationId: string): void
  /**
   * Mark a finding as intended, with the reason given (ADR-0036, amended 11
   * October 2026): a step in this scope, where the dates were checked. Absent
   * where the page may not write, and then nothing offers it.
   */
  markIntended?(finding: Finding, reason: string): void
  /** Take a mark back, by its id: the same step's inverse. */
  takeBackMark?(id: string): void
}

/**
 * A plan filed in a scope below this one and flagged as an initiative
 * (ADR-0012 §7): drawn here under its scope's name, edited there.
 */
export type Initiative = {
  scope: string
  /** What to call the scope on screen. */
  label: string
  plan: Transition
  /**
   * The elements the plan names, as its scope holds them. The dated ones are
   * plotted among this scope's applications, under the switch; absent draws
   * the band alone.
   */
  elements?: readonly DesignElement[]
}

export type RoadmapPageProps = {
  open: boolean
  model: DesignModel
  /** The initiatives of the scopes below, read off the index; absent or empty draws no band for them. */
  fromBelow?: readonly Initiative[]
  /** Open a plan where it lives. Absent = the rows are drawn and go nowhere. */
  onOpenInitiative?(scope: string, planId: string): void
  /** The day "now" is; the caller reads the clock so this stays testable. */
  today: string
  /** The platform tree where this scope holds stand-ins (ADR-0014 §2.7), for the retiring-platform finding. */
  platformTree?: PlatformTree
  /** The day the open board is showing. Absent with no look on, and the handle is on today. */
  asOf?: string
  /** Whether a board is open behind the page for the handle to move. */
  boardBehind?: boolean
  readOnly: boolean
  /**
   * The board behind is looked at on another day: nothing is written while a
   * person looks (decision 4), so the page writes nothing, and *New plan* says why.
   */
  looking?: boolean
  actions: RoadmapActions
  /** Where the session keeps what its list of findings has unfolded: the open scope's roadmap. */
  remember?: string
  /** The scope's findings marked as intended (`model/checkMarks`), which its list of findings leaves out. */
  marks?: readonly CheckMark[]
  /** The row the reader opens on, said by the address. */
  select?: string
  onClose(): void
  windowChrome?: WindowChrome
}

/** Only a view that could be one: what preferences hand back may be from anywhere. */
function asView(held: unknown): AxisView | undefined {
  const view = held as Partial<AxisView> | null | undefined
  return view && typeof view.start === 'string' && isDay(view.start) && typeof view.days === 'number' && view.days > 0
    ? { start: view.start, days: view.days } : undefined
}

/** From this many rows, the corner above the names is better spent on Find than on how the ruler works. */
const FIND_FROM_ROWS = 8

export function RoadmapPage(props: RoadmapPageProps) {
  const { model, today, actions } = props
  const looking = props.looking === true && !props.readOnly
  const readOnly = props.readOnly || looking
  const { t } = useStrings()
  const [newTitle, setNewTitle] = useState<string | null>(null)
  const [names, setNames] = useSeamWidth('roadmap.labels', 260)
  const [view, setView] = useViewerKeep<AxisView>('roadmap.axis', asView, () => openingView(today))
  const [tab] = usePlaceTab('plans')
  const findingsAt = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (tab === 'findings') findingsAt.current?.scrollIntoView?.({ block: 'start' })
  }, [tab])

  const below = props.fromBelow ?? []
  // On by default: the band alone says when and not what. Off for a reader who wants this scope's own landscape only.
  const [showBelow, setShowBelow] = useState(true)
  const [hideEnded, setHideEnded] = useState(false)
  const [find, setFind] = useState('')
  const [pickedId, setPickedId] = useState<string | undefined>(props.select)
  useEffect(() => { if (props.select !== undefined) setPickedId(props.select) }, [props.select])

  const roadmap = useMemo(() => roadmapOf(model, today, below.map(({ scope, plan, elements }) => ({
    scope, plan, elements: showBelow ? (elements ?? []) : [],
  }))), [model, today, below, showBelow])
  const platformTree = props.platformTree
  const problems = useMemo(
    () => findings({ model, today, ...(platformTree ? { platformTree } : {}) }),
    [model, today, platformTree],
  )
  const labelOf = useCallback((scope: string) => below.find((one) => one.scope === scope)?.label ?? scope, [below])

  const dated = roadmap.tracks.length > 0 || roadmap.relations.length > 0 || roadmap.transitions.length > 0 || below.length > 0
  const empty = !dated && problems.length === 0
  const everyDay = useMemo(() => [
    ...roadmap.tracks.flatMap((track) => Object.values(track.element.lifecycleDates ?? {})),
    ...roadmap.relations.flatMap(({ relation }) => [relation.validFrom, relation.validUntil]),
    ...roadmap.transitions.flatMap(transitionDays),
    ...below.flatMap(({ plan }) => transitionDays(plan)),
  ].filter(isDay), [roadmap, below])

  const marked = useMemo(() => {
    const rows = new Map<string, 'fix' | 'review'>()
    for (const problem of problems) {
      const target = findingTarget(problem, model.relations)
      if (!target) continue
      const weight = CHECK_CATALOGUE[DATE_CHECK[problem.kind]].weight === 'fix' ? 'fix' : 'review'
      if (rows.get(target.id) !== 'fix') rows.set(target.id, weight)
    }
    return rows
  }, [problems, model.relations])
  const aboutOf = (id: string) => problems.filter((problem) => findingTarget(problem, model.relations)?.id === id)

  const plan = roadmap.transitions.find((one) => one.id === pickedId)
  const track = roadmap.tracks.find((one) => one.element.id === pickedId)
  const relation = roadmap.relations.find((one) => one.relation.id === pickedId)
  const initiative = below.find((one) => initiativeId(one.scope, one.plan.id) === pickedId)
  const related = useMemo(() => {
    if (!plan) return new Set<string>()
    const lines = connectionGroups(model, [plan], roadmap.relations).byPlan[0]
    return new Set<string>([
      ...plan.elements.map((one) => one.elementId),
      ...(lines ? [...lines.ending, ...lines.starting].map((one) => one.relation.id) : []),
    ])
  }, [plan, model, roadmap.relations])
  const context: RowsContext = {
    model, picked: pickedId, related, marked, finding: find.trim().toLowerCase(),
    pick: (id) => setPickedId((was) => (was === id ? undefined : id)),
  }
  const close = () => setPickedId(undefined)
  const withElsewhere: RoadmapActions = props.onOpenInitiative ? { ...actions, onOpenElsewhere: props.onOpenInitiative } : actions
  const rowCount = roadmap.tracks.length + roadmap.transitions.length + below.length
  const asOf = isDay(props.asOf) && dayNumber(props.asOf) !== dayNumber(today) ? props.asOf : undefined

  return (
    <PageDialog open={props.open} topInset={(props.windowChrome ?? NO_WINDOW_CHROME).topInset} onClose={props.onClose} aria-label={t('roadmap.title')}>
      <div className="roadmap-page">
        <header className="roadmap-head">
          <h1 className="roadmap-title">{t('roadmap.title')}</h1>
          {(!readOnly || looking) && (
            <Button
              variant="primary" onClick={() => setNewTitle('')} data-guide="roadmap.newPlan"
              {...(looking ? { reason: t('roadmap.newPlanLooking') } : {})}
            >
              {t('roadmap.newPlan')}
            </Button>
          )}
          <PageClose onClose={props.onClose} />
        </header>
        <div className="roadmap-body">
          <div className="roadmap-main" tabIndex={0} role="region" aria-label={t('roadmap.title')}>
            {empty ? (
              <PageState
                state="empty" title={t('roadmap.empty')}
                body={<><p>{t('roadmap.emptyBody')}</p><p className="roadmap-quiet">{t('roadmap.emptyBelow')}</p></>}
              />
            ) : (
              <>
                {dated && (
                  <TimeAxis
                    view={view} onViewChange={setView} today={today} day={asOf} dates={everyDay}
                    {...(props.boardBehind === false ? {} : { onDayChange: actions.setAsOf })}
                    names={{ width: names, onWidth: setNames }}
                    data-guide="roadmap.axis"
                    head={rowCount >= FIND_FROM_ROWS
                      ? <FindField fill label={t('roadmap.find')} value={find} onChange={setFind} />
                      : <IconButton label={t('roadmap.helpName')} tip={t('roadmap.help')} size="small" data-testid="roadmap-help"><HelpIcon size={16} /></IconButton>}
                  >
                    <PlanRows plans={roadmap.transitions} hideEnded={hideEnded} onHideEnded={setHideEnded} context={context} />
                    <ApplicationRows tracks={roadmap.tracks} total={model.elements.filter((one) => one.kind === 'application').length} belowLabel={labelOf} context={context} />
                    <ConnectionRows roadmap={roadmap} plans={roadmap.transitions} context={context} />
                    <InitiativeRows below={below} showBelow={showBelow} onShowBelow={setShowBelow} context={context} />
                  </TimeAxis>
                )}
                <div ref={findingsAt}>
                  <RoadmapFindings
                    problems={problems} marks={props.marks} relations={model.relations} readOnly={readOnly} actions={actions}
                    remember={props.remember} saysNone={dated}
                  />
                </div>
              </>
            )}
          </div>
          {plan && <PlanReader plan={plan} model={model} about={aboutOf(plan.id)} actions={actions} onClose={close} />}
          {track && (
            <ElementReader
              element={track.element} about={aboutOf(track.element.id)} actions={withElsewhere} onClose={close} onPick={setPickedId}
              plans={roadmap.transitions.filter((one) => one.elements.some((row) => row.elementId === track.element.id))}
              below={track.below && !model.elements.some((one) => one.id === track.element.id) ? { ...track.below, label: labelOf(track.below.scope) } : undefined}
            />
          )}
          {relation && <ConnectionReader track={relation} about={aboutOf(relation.relation.id)} actions={actions} onClose={close} />}
          {initiative && <InitiativeReader initiative={initiative} canOpen={props.onOpenInitiative !== undefined} actions={withElsewhere} onClose={close} />}
        </div>
      </div>
      <NamePlanDialog title={newTitle} onTitle={setNewTitle} onMake={(title) => actions.addTransition(title)} />
    </PageDialog>
  )
}

/**
 * *What is the plan called?*: the plan made from its name, by the button or by
 * Enter, and the dialog says what comes next. The Enter is the form's own: closing
 * gives the focus back to *New plan*, and a key let go on would press that again.
 */
function NamePlanDialog({ title, onTitle, onMake }: {
  title: string | null; onTitle: (title: string | null) => void; onMake: (title: string) => void
}) {
  const { t } = useStrings()
  const make = () => {
    if (title?.trim()) onMake(title.trim())
    onTitle(null)
  }
  return (
    <Dialog
      open={title !== null} title={t('roadmap.newPlanTitle')} onClose={() => onTitle(null)} onSubmit={make}
      actions={(
        <>
          <Button onClick={() => onTitle(null)}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" disabled={!title?.trim()} onClick={make}>{t('roadmap.newPlan')}</Button>
        </>
      )}
    >
      <TextField label={t('roadmap.newPlanName')} hint={t('roadmap.newPlanHelp')} value={title ?? ''} onChange={onTitle} autoFocus />
    </Dialog>
  )
}
