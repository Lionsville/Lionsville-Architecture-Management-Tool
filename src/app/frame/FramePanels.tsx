// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The frame's two panels: *Your work*, the one place for where work is kept and
 * how to keep it, whichever host is underneath, and *Activity*, what was lately
 * done. Both are the one Panel, and every act in them is a command on the same
 * stream the menu sends, so they work with nothing open.
 *
 * Six words for how work is kept sat in a menu with nothing relating them. Here
 * each act has a line saying what it does, and the place is said in a sentence
 * with what can lose it, because a person expects *Save* to be what protects them
 * and it does nothing a moment later would not have done.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { LOCALE } from '../../i18n'
import type { Language, StringKey, Translate } from '../../i18n'
import { helpAt } from '../helpAt'
import { Button } from '../../widgets/kit/Button'
import { MoreMenu } from '../../widgets/kit/Menu'
import type { MenuAct } from '../../widgets/kit/Menu'
import { Panel, PanelSection } from '../../widgets/kit/Panel'
import { ActivityLines } from '../ActivityMenu'
import { chromeProps } from '../AppPanels'
import { clockTime } from '../clockTime'
import type { ShellParts } from '../shellParts'
import { flattenScopes } from '../../projects/scope'
import type { ScopeId } from '../../projects/scopeState'
import { sourceLabel } from '../ShellToolbar'
import { statusWord } from './statusWord'
import { useFrameState } from './frameStore'
import type { OwnWork, ScreenFacts } from './frameStore'
import { PANEL_HELP } from '../../platform/helpPlaces'
import type { WriteRefusal } from '../writeRefusals'
import { notKeptSentence } from '../notKept'

/** The place each window's word first said, kept by its frame: a save there needs no more than its time. */
const firstPlace = new WeakMap<object, string>()

/** The word on row one: the work's state and, where the source has a word for it, its place. */
export function statusOf(parts: ShellParts, facts: ScreenFacts | undefined, language: Language, s: Translate, own?: OwnWork, refused?: boolean) {
  const { props, provider, source } = parts
  // A source of the provider's own says its own place, on its own chip: the word is for the three that have none.
  const named = provider.chip === undefined && !provider.ChipPanel && !provider.ChipFace && !facts?.publishesSteps
  const place = named && !props.provider?.publishesSteps ? sourceLabel(source, s, undefined, props.provider?.sayings?.labelKey) : undefined
  if (place !== undefined && !firstPlace.has(parts.frame)) firstPlace.set(parts.frame, place)
  return statusWord({
    status: facts?.status, saveFailed: facts?.saveFailed, savedAt: facts?.savedAt, publishesSteps: facts?.publishesSteps,
    sourceStatus: facts?.sourceStatus, connected: props.provider?.connected?.(), source: props.provider?.frame?.word?.(), own, refused,
    ...(place !== undefined ? { place, placeAsStarted: firstPlace.get(parts.frame) === place, transient: source.transient, visiting: props.visiting !== undefined } : {}),
  }, language, s)
}

const NONE: readonly WriteRefusal[] = []
const NEVER = () => () => {}

/** The writes outside the open session that did not land, drawn again as the list moves. */
export function useWriteRefusals(parts: ShellParts): readonly WriteRefusal[] {
  const refusals = parts.refusals
  return useSyncExternalStore(refusals?.subscribe ?? NEVER, refusals?.list ?? (() => NONE))
}

/**
 * What did not land, and the two ways out of it: made again, as it was made,
 * or put back, which lets the change go and leaves what is kept as it is.
 * A field that still shows what was typed says so beside it as well
 * (`ScopeSettingsPage`); here is where the rest are answered.
 */
function NotKept({ parts, refused }: { parts: ShellParts; refused: readonly WriteRefusal[] }) {
  const { services: { s } } = parts
  const [trying, setTrying] = useState(false)
  if (refused.length === 0 || !parts.refusals) return null
  const { retry, forget } = parts.refusals
  // The first refusal's reason: the rest were met at the same place, and nearly always for the same one.
  const said = notKeptSentence(s, parts.props.provider?.sayings?.keepFailedKey, refused[0]?.cause)
  return (
    <PanelSection title={s('work.couldNotSave')}>
      <p className="kit-work__say" data-testid="work-not-kept">{said} {s('work.notKeptWays')}</p>
      <div className="kit-work__acts">
        <Button
          size="small" variant="primary" disabled={trying} data-testid="work-retry"
          onClick={() => { setTrying(true); void retry().finally(() => setTrying(false)) }}
        >
          {s('common.tryAgain')}
        </Button>
        <Button size="small" variant="plain" onClick={() => forget()} data-testid="work-put-back">{s('work.putBack')}</Button>
      </div>
    </PanelSection>
  )
}

function day(iso: Date | string, language: Language, s: Translate): string {
  const when = new Date(iso)
  const now = new Date()
  const today = when.toDateString() === now.toDateString()
  const time = clockTime(when, language)
  return today ? s('work.today', { time }) : `${when.toLocaleDateString(LOCALE[language], { day: 'numeric', month: 'short', year: 'numeric' })}, ${time}`
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="kit-work__fact"><span className="kit-work__fact-label">{label}</span><span>{value}</span></div>
}

/** What a provider's own part of the panel is handed. */
function workProps(parts: ShellParts) {
  const { own, session, open, notify, reread, flush } = chromeProps(parts, parts.provider.openProvider)
  return { own, session, open, notify, reread, flush, copyText: parts.props.hostControls.copyText }
}

/**
 * Whether the history holds anything for this organisation, asked each time the
 * panel opens. Until it has answered it is not known, and the panel says nothing
 * rather than *Kept*: a scope being open is not a history having been started.
 */
function useHistoryStarted(parts: ShellParts, available: boolean): boolean | undefined {
  const repository = parts.props.repositories.history
  const tree = parts.organisation.tree
  const [started, setStarted] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    if (!available || !repository) return undefined
    let live = true
    const scopes = flattenScopes(tree).flatMap((scope): ScopeId[] => (scope.id === undefined ? [] : [scope.id]))
    if (scopes.length === 0) { setStarted(false); return undefined }
    repository.entries({ scopes, limit: 1 }).then(
      (page) => { if (live) setStarted(page.entries.length > 0) },
      // A history that would not answer is not one we can say anything about.
      () => { if (live) setStarted(undefined) },
    )
    return () => { live = false }
  }, [available, repository, tree])
  return started
}

/** What is wrong here, what could lose the work, and when it was last kept. */
function WorkFacts({ parts, facts, history }: { parts: ShellParts; facts: ScreenFacts | undefined; history: boolean }) {
  const { services: { s, prefs }, props, copies } = parts
  const started = useHistoryStarted(parts, history)
  const riskKey = props.provider?.sayings?.riskKey
  const trouble = facts?.workTrouble
  return (
    <>
      {trouble && (
        <PanelSection title={trouble.title}>
          <p className="kit-work__say" data-testid="work-trouble">{trouble.body}</p>
          <div className="kit-work__acts">
            {trouble.acts.map((act) => <Button key={act.label} size="small" onClick={act.run} {...(act.testId ? { 'data-testid': act.testId } : {})}>{act.label}</Button>)}
          </div>
        </PanelSection>
      )}
      {facts?.saveFailed && <PanelSection title={s('work.couldNotSave')}><p className="kit-work__say">{notKeptSentence(s, props.provider?.sayings?.keepFailedKey)}</p></PanelSection>}
      {riskKey && !trouble && <p className="kit-work__say" data-testid="work-risk">{s(riskKey as StringKey)}</p>}
      {!props.provider?.publishesSteps && (
        <PanelSection>
          {facts?.savedAt && <Fact label={s('work.lastSaved')} value={day(facts.savedAt, prefs.language, s)} />}
          <Fact label={s('work.lastCopy')} value={copies.last ? day(copies.last, prefs.language, s) : s('work.never')} />
          {history && started !== undefined && <Fact label={s('work.history')} value={s(started ? 'work.historyKept' : 'work.historyNot')} />}
        </PanelSection>
      )}
      {facts?.activity && !parts.provider.YourWork && <p className="kit-work__say">{s('frame.sessionChanges', { count: facts.activity().length })}</p>}
    </>
  )
}

/** Every act that moves work, each a command on the stream the menu sends. */
function WorkActs({ parts, facts, history }: { parts: ShellParts; facts: ScreenFacts | undefined; history: boolean }) {
  const { services: { s }, commands: { bus: { send } }, agent, provider, props, source } = parts
  const ways = provider.offered ?? []
  // A source that publishes its steps keeps the work where it is; moving it elsewhere is a rare act, under ⋯.
  const published = props.provider?.publishesSteps ?? false
  // Where the work is now is said, not pressed: a name on a button read as a way to somewhere else.
  const here = published ? undefined : sourceLabel(source, s, undefined, props.provider?.sayings?.labelKey)
  const moves: MenuAct[] = [
    { label: s('menu.open'), onSelect: () => send({ type: 'open' }), 'data-testid': 'work-open' },
    ...ways.map((way): MenuAct => ({ label: s(way.labelKey as StringKey), onSelect: way.onConnect, 'data-testid': `work-way-${way.kind}` })),
    ...ways.flatMap((way) => (way.recent ?? []).filter((held) => held.label !== source.name).map((held): MenuAct => ({
      label: s('work.workFrom', { name: held.label }), onSelect: () => way.onReopen?.(held.key), 'data-testid': 'work-recent',
    }))),
  ]
  return (
    <>
      <PanelSection title={s('frame.keepIt')}>
        <div className="kit-work__acts">
          {facts?.kind === 'workspace' && <Button size="small" onClick={() => send({ type: 'save' })} data-testid="work-save">{s('menu.save')}</Button>}
          <Button size="small" variant={facts?.saveFailed ? 'primary' : 'plain'} onClick={() => send({ type: 'export' })} data-testid="work-copy">{s('menu.exportWorkingFile')}</Button>
          {history && <Button size="small" onClick={() => send({ type: 'snapshot' })} data-testid="work-snapshot">{s('menu.snapshot')}</Button>}
          {published && <MoreMenu size="small" label={s('frame.moveIt')} items={moves} />}
        </div>
      </PanelSection>
      {!published && (
        <PanelSection title={s('frame.moveIt')}>
          {here && <Fact label={s('work.keptNow')} value={here} />}
          <div className="kit-work__acts">
            {moves.map((move, at) => (
              <Button key={`${at}-${move.label}`} size="small" variant="quiet" onClick={move.onSelect} data-testid={move['data-testid']}>{move.label}</Button>
            ))}
          </div>
        </PanelSection>
      )}
      <PanelSection title={s('frame.lookBack')}>
        <div className="kit-work__acts">
          <Button size="small" variant="quiet" onClick={() => agent.setPanel('activity')} data-testid="work-activity">{s('shell.activity')}</Button>
          {history && <Button size="small" variant="quiet" onClick={() => send({ type: 'history' })} data-testid="work-history">{s('menu.history')}</Button>}
        </div>
      </PanelSection>
    </>
  )
}

export function YourWorkPanel({ parts, facts }: { parts: ShellParts; facts: ScreenFacts | undefined }) {
  const own = useFrameState(parts.frame).work
  const refused = useWriteRefusals(parts)
  const { services: { s, prefs }, agent, props, provider } = parts
  const history = facts?.kind === 'workspace' ? props.repositories.history !== undefined : parts.home.history.available
  const Own = provider.YourWork
  const where = props.provider?.sayings?.whereKey ?? props.provider?.description
  return (
    <Panel helpAt={PANEL_HELP.work}
      kind={s('frame.yourWork')} name={statusOf(parts, facts, prefs.language, s, own, refused.length > 0).text || s('frame.yourWork')} dataGuide="frame.yourWork"
      facts={where !== undefined ? s(where as StringKey) : undefined} onClose={() => agent.setPanel(undefined)} help={s('frame.appliesToAll')}
      helpLink={{ label: s('work.manual'), onPress: () => props.hostControls.openHelp(helpAt(prefs, PANEL_HELP.whereKept)) }}
    >
      {/* What this host says of its own comes first: it is what a person opened this to read. */}
      {Own && <Own {...workProps(parts)} />}
      <NotKept parts={parts} refused={refused} />
      <WorkFacts parts={parts} facts={facts} history={history} />
      <WorkActs parts={parts} facts={facts} history={history} />
    </Panel>
  )
}

export function ActivityPanel({ parts, facts }: { parts: ShellParts; facts: ScreenFacts | undefined }) {
  const { services: { s, prefs }, commands: { bus }, agent, props } = parts
  const scopeOpen = facts?.kind === 'workspace'
  const history = scopeOpen ? props.repositories.history !== undefined : parts.home.history.available
  return (
    <Panel helpAt={PANEL_HELP.activity}
      kind={s('shell.activity')} name={facts?.name ?? s('shell.activity')} dataGuide="frame.activity"
      facts={facts?.kind === 'workspace' && !props.provider?.publishesSteps ? s('frame.activityUndo') : undefined}
      onClose={() => agent.setPanel(undefined)}
      {...(history ? { helpLink: { label: s('menu.history'), onPress: () => bus.send({ type: 'history' }) } } : {})}
    >
      <ActivityLines
        entries={facts?.activity?.() ?? []}
        {...(facts?.recentActivity ? { recent: facts.recentActivity } : {})}
        language={prefs.language} s={s}
      />
    </Panel>
  )
}
