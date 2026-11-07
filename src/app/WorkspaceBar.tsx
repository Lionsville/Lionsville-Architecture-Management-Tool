// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The bar over an open scope, and the notices under it: a scope whose files
 * did not all read, and a folder somebody else changed.
 */
import { useContext, useEffect, useMemo } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import type { StringKey } from '../i18n'
import { formatDay } from '../i18n/dates'
import { isDay, transitionLabel } from '../model'
import type { Transition } from '../model'
import { NO_WINDOW_CHROME } from '../platform/windowChrome'
import type { WindowChrome } from '../platform/windowChrome'
import { scopeActivity } from './activityMoves'
import { ChangedElsewhereNotice } from './ChangedElsewhereNotice'
import { isLookingAway, shownAsOf } from '../editor'
import { agentRun, putBackRun } from '../agent/agentRun'
import type { StackedBand } from '../widgets/kit/Band'
import { Button as KitButton } from '../widgets/kit/Button'
import { FrameStoreContext, useFrameFacts } from './frame/frameStore'
import type { WorkTrouble } from './frame/frameStore'
import type { DesignDiagram } from '../model/types'
import type { WorkspaceParts } from './workspaceParts'

/**
 * What a page is told of the window: nothing of the rows' duties, since the
 * frame's row one keeps clear of the window's controls and is what it is dragged by.
 */
export function usePageChrome(windowChrome: WindowChrome | undefined) {
  const pageChrome = useMemo<WindowChrome>(
    () => ({ ...(windowChrome ?? NO_WINDOW_CHROME), controlsInset: 0, draggable: false, topInset: 0 }),
    [windowChrome],
  )
  return { pageChrome, windowChrome: windowChrome ?? NO_WINDOW_CHROME }
}

/** What is wrong with the work here, for *Your work*: the same two strips say it, with the same acts. */
function workTrouble(parts: WorkspaceParts): WorkTrouble | undefined {
  const { props, document: { document }, files, snapshots, pickers, unreadable } = parts
  const { s } = props.shell
  const status = document.state.status
  if (status === 'external-changed' || status === 'conflict') {
    return {
      title: s('shell.changedElsewhere'),
      body: s(status === 'conflict' ? 'shell.conflictThere' : 'shell.changedThere'),
      acts: [
        { label: s('shell.takeTheirs'), run: document.takeTheirs, testId: 'work-take-theirs' },
        { label: s('shell.keepMine'), run: document.keepMine, testId: 'work-keep-mine' },
        { label: s('shell.saveACopy'), run: () => { void files.saveWorkingFile() }, testId: 'work-copy-first' },
      ],
    }
  }
  if (unreadable.length > 0) {
    return {
      title: s('work.unreadableTitle'),
      body: s('work.unreadableBody', { files: unreadable.join(', ') }),
      acts: props.project.later ? [] : [
        ...(props.snapshots.history ? [{ label: s('shell.putBackFromHistory'), run: () => snapshots.openPage(), testId: 'work-put-back' }] : []),
        { label: s('shell.bringInWorkingFile'), run: pickers.document.open, testId: 'work-bring-in' },
      ],
    }
  }
  return undefined
}

/**
 * What this scope tells the frame, and the strips under the rows. The rows
 * themselves are the frame's: what a screen owes them is these facts.
 */
/** What a board's band says about the plan it was opened from: its number, the milestone on this day, and the next and previous. */
function carriedPlan(plan: Transition, day: string, go: (day: string) => void) {
  const days = plan.milestones.filter((one) => isDay(one.date)).sort((a, b) => a.date.localeCompare(b.date))
  const at = days.findIndex((one) => one.date === day)
  const here = days[at]
  const before = [...days].reverse().find((one) => one.date < day)
  const after = days.find((one) => one.date > day)
  return {
    detail: `${transitionLabel(plan)} ${plan.title}${here ? `: ${here.name}` : ''}`,
    ...(days.length > 0 ? {
      position: {
        at: (at >= 0 ? at : days.filter((one) => one.date < day).length) + 1, total: days.length,
        ...(before ? { onPrevious: () => go(before.date) } : {}),
        ...(after ? { onNext: () => go(after.date) } : {}),
      },
    } : {}),
  }
}

export function WorkspaceBar({ parts }: { parts: WorkspaceParts }) {
  const { props, session, document: { document, savedAt, saveFailed }, alsoHere, pages, requests, dialogs } = parts
  const { s } = props.shell
  /**
   * The source's own log of the open scope, bound to it — held by scope, so the
   * list asks once per opening rather than once per render of this bar.
   * Nothing where the source keeps no log, and the list is the session's.
   */
  const keptLog = props.source.recentActivity
  const scope = props.project.id
  const history = props.snapshots.history
  // By the scope's identity, so the list follows it through a move and says
  // the move (`activityMoves.ts`).
  const recentActivity = useMemo(() => scopeActivity(scope, keptLog, history), [scope, keptLog, history])
  const active = session.model.diagrams.find((one) => one.id === session.activeDiagramId)
  const boardUp = pages.page() === undefined && requests.documentationShown === undefined
    && (active?.kind === 'layer7' || active?.kind === 'container')
  const looking = active !== undefined && isLookingAway(active, parts.viewing.days)
  const bands = useLookBand(parts, active, looking)
  useLookInAddress(parts, active, looking)
  // The look ended, by the band or by the Day control: the board no longer carries the plan.
  const { carried, letGo } = pages.plans
  useEffect(() => { if (!looking && carried) letGo() }, [looking, carried, letGo])
  const publishes = props.source.publishesSteps
  useFrameFacts({
    kind: 'workspace', path: props.project.path, name: session.model.name,
    openSearch: () => dialogs.setSearchOpen(true),
    // A look writes nothing, so nothing takes back from under it; the band says so.
    ...(session.readOnly || looking ? {} : {
      undo: { can: session.canUndo, run: session.undo },
      redo: { can: session.canRedo, run: session.redo },
    }),
    status: document.state.status, savedAt, saveFailed,
    ...(publishes !== undefined ? { publishesSteps: publishes } : {}),
    sourceStatus: props.source.status !== undefined,
    alsoHere,
    activity: session.history,
    ...(recentActivity ? { recentActivity } : {}),
    activityKept: keptLog !== undefined,
    bands, boardUp,
    ...(workTrouble(parts) ? { workTrouble: workTrouble(parts) } : {}),
    showShortcuts: parts.renderer.editorHandle.current ? () => parts.renderer.editorHandle.current?.showShortcuts() : undefined,
    agentRun: () => {
      const run = agentRun(session.history())
      if (run.steps.length === 0) return undefined
      if (publishes) return { steps: run.steps.length, putBack: () => { session.dispatch(putBackRun(run, s('agent.someone'), parts.todayDay)) } }
      return { steps: run.steps.length, undo: () => { session.undoRun(run) } }
    },
  })
  return (
    <>
      {parts.unreadable.length > 0 && <UnreadableNotice parts={parts} />}
      <ChangedElsewhereNotice
        status={document.state.status}
        onTakeTheirs={document.takeTheirs}
        onKeepMine={document.keepMine}
        onSaveCopy={() => { void parts.files.saveWorkingFile() }}
        s={s}
      />
    </>
  )
}

const NO_BANDS: readonly StackedBand[] = []

/**
 * Looking at another day as a state of the whole window (ADR-0027, amended): what
 * day, who sees it, the one press back to the view's own day, and the deliberate
 * step of making the day its own, which is one edit and one line in Activity.
 */
function useLookBand(parts: WorkspaceParts, active: DesignDiagram | undefined, looking: boolean): readonly StackedBand[] {
  const { props, session, viewing, pages } = parts
  const { s, language } = props.shell
  const { carried, carryTo, letGo, backToPlan } = pages.plans
  return useMemo<readonly StackedBand[]>(() => {
    if (!looking || !active) return NO_BANDS
    const day = shownAsOf(active, viewing.days)
    const say = (value: string | undefined) => (value ? formatDay(value, language) : s('frame.lookingDayToday'))
    const back = () => { viewing.forget(active.id); letGo() }
    const keep = () => {
      session.dispatch({ type: 'diagram.update', id: active.id, patch: { asOf: day } })
      back()
    }
    // A board opened from a plan carries it: the plan's own days to step between, and the way back.
    const carrying = carried ? carriedPlan(carried, day ?? '', (next) => carryTo(active.id, next)) : undefined
    return [{
      id: 'looking', tone: 'looking', dataGuide: 'board.look',
      title: s('frame.lookingAt', { day: say(day) }),
      detail: carrying ? carrying.detail : s('frame.lookingDetail'),
      ...(carrying?.position ? { position: carrying.position } : {}),
      action: (
        <>
          {carried && <KitButton size="small" onClick={() => { back(); backToPlan() }} data-testid="looking-plan">{s('plan.backToPlan')}</KitButton>}
          <KitButton size="small" variant="primary" onClick={back} data-testid="looking-back">
            {active.asOf ? s('frame.lookingBack', { day: say(active.asOf) }) : s('frame.lookingToday')}
          </KitButton>
          {!session.readOnly && <KitButton size="small" onClick={keep} data-testid="looking-keep">{s('frame.lookingKeep')}</KitButton>}
        </>
      ),
    }]
  }, [looking, active, viewing, session, s, language, carried, carryTo, letGo, backToPlan])
}

/** The look said to the frame, so the address carries it; and one the address or an agent asked for, taken up. */
function useLookInAddress(parts: WorkspaceParts, active: DesignDiagram | undefined, looking: boolean): void {
  const store = useContext(FrameStoreContext)
  const { viewing } = parts
  const day = looking && active ? shownAsOf(active, viewing.days) ?? 'today' : undefined
  const view = looking ? active?.id : undefined
  useEffect(() => {
    store?.set({ lookOf: view, lookDay: day })
  }, [store, view, day])
  useEffect(() => () => { store?.set({ lookOf: undefined, lookDay: undefined }) }, [store])
  const asked = store?.get().asksLook
  useEffect(() => {
    if (!asked || !store) return
    const target = asked.view ?? active?.id
    if (target === undefined) return
    store.set({ asksLook: undefined })
    viewing.show(target, asked.day === 'today' ? undefined : asked.day)
  })
}

/**
 * A scope that could not be read whole: what could not, and — where the
 * source may be written — the two ways to put it back whole
 * (`ScopeState.unreadable`), from the history where one is kept and from a
 * working file brought in. In the source's own words where it has more to
 * say (`WorkspaceSource.unreadableKey`).
 */
function UnreadableNotice({ parts }: { parts: WorkspaceParts }) {
  const { props, snapshots, pickers, recovering } = parts
  const { s } = props.shell
  // A later version's scope is somebody's newer work: nothing here puts it
  // back, and the notice says what does.
  const key = props.project.later ? 'shell.unreadableLater' : (props.source.unreadableKey ?? 'shell.unreadableScope') as StringKey
  return (
    <Alert
      severity="warning"
      square
      sx={{ py: 0.25, fontSize: 'var(--t-body)', borderRadius: 0, '& .MuiAlert-action': { alignItems: 'center', pt: 0 } }}
      data-testid="unreadable-notice"
      action={recovering ? (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {snapshots.available && (
            <Button size="small" color="inherit" onClick={() => snapshots.openPage()} data-testid="unreadable-put-back">
              {s('shell.putBackFromHistory')}
            </Button>
          )}
          <Button size="small" color="inherit" onClick={pickers.document.open} data-testid="unreadable-bring-in">
            {s('shell.bringInWorkingFile')}
          </Button>
        </Box>
      ) : undefined}
    >
      {s(key, { files: parts.unreadable.join(', ') })}
    </Alert>
  )
}
