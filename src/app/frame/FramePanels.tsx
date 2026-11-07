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
import { LOCALE } from '../../i18n'
import type { Language, StringKey, Translate } from '../../i18n'
import { manualUrl } from '../../platform/manual'
import { Button } from '../../widgets/kit/Button'
import { Panel, PanelSection } from '../../widgets/kit/Panel'
import { ActivityLines } from '../ActivityMenu'
import { chromeProps } from '../AppPanels'
import { clockTime } from '../clockTime'
import type { ShellParts } from '../shellParts'
import { sourceLabel } from '../ShellToolbar'
import { statusWord } from './statusWord'
import { useFrameState } from './frameStore'
import type { OwnWork, ScreenFacts } from './frameStore'

/** The word on row one: the work's state and, where the source has a word for it, its place. */
export function statusOf(parts: ShellParts, facts: ScreenFacts | undefined, language: Language, s: Translate, own?: OwnWork) {
  const { props, provider, source } = parts
  // A source of the provider's own says its own place, on its own chip: the word is for the three that have none.
  const named = provider.chip === undefined && !provider.ChipPanel && !provider.ChipFace && !facts?.publishesSteps
  return statusWord({
    status: facts?.status, saveFailed: facts?.saveFailed, savedAt: facts?.savedAt, publishesSteps: facts?.publishesSteps,
    sourceStatus: facts?.sourceStatus, connected: props.provider?.connected?.(), source: props.provider?.frame?.word?.(), own,
    ...(named && !props.provider?.publishesSteps ? { place: sourceLabel(source, s, undefined, props.provider?.sayings?.labelKey), transient: source.transient, visiting: props.visiting !== undefined } : {}),
  }, language, s)
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

/** What is wrong here, what could lose the work, and when it was last kept. */
function WorkFacts({ parts, facts, history }: { parts: ShellParts; facts: ScreenFacts | undefined; history: boolean }) {
  const { services: { s, prefs }, props, copies } = parts
  const riskKey = props.provider?.sayings?.riskKey
  const trouble = facts?.workTrouble
  const scopeOpen = facts?.kind === 'workspace'
  return (
    <>
      {trouble && (
        <PanelSection title={trouble.title}>
          <p data-testid="work-trouble">{trouble.body}</p>
          <div className="kit-work__acts">
            {trouble.acts.map((act) => <Button key={act.label} size="small" onClick={act.run} {...(act.testId ? { 'data-testid': act.testId } : {})}>{act.label}</Button>)}
          </div>
        </PanelSection>
      )}
      {facts?.saveFailed && <PanelSection title={s('work.couldNotSave')}><p>{s('shell.keepFailed')}</p></PanelSection>}
      {riskKey && !trouble && <p data-testid="work-risk">{s(riskKey as StringKey)}</p>}
      {!props.provider?.publishesSteps && (
        <PanelSection>
          {facts?.savedAt && <Fact label={s('work.lastSaved')} value={day(facts.savedAt, prefs.language, s)} />}
          <Fact label={s('work.lastCopy')} value={copies.last ? day(copies.last, prefs.language, s) : s('work.never')} />
          {history && <Fact label={s('work.history')} value={s(scopeOpen || parts.home.history.keeping ? 'work.historyKept' : 'work.historyNot')} />}
        </PanelSection>
      )}
      {facts?.activity && !parts.provider.YourWork && <p>{s('frame.sessionChanges', { count: facts.activity().length })}</p>}
    </>
  )
}

/** Every act that moves work, each a command on the stream the menu sends. */
function WorkActs({ parts, facts, history }: { parts: ShellParts; facts: ScreenFacts | undefined; history: boolean }) {
  const { services: { s }, commands: { bus: { send } }, agent, provider } = parts
  const ways = provider.offered ?? []
  return (
    <>
      <PanelSection title={s('frame.keepIt')}>
        <div className="kit-work__acts">
          {facts?.kind === 'workspace' && <Button size="small" onClick={() => send({ type: 'save' })} data-testid="work-save">{s('menu.save')}</Button>}
          <Button size="small" variant={facts?.saveFailed ? 'primary' : 'plain'} onClick={() => send({ type: 'export' })} data-testid="work-copy">{s('menu.exportWorkingFile')}</Button>
          {history && <Button size="small" onClick={() => send({ type: 'snapshot' })} data-testid="work-snapshot">{s('menu.snapshot')}</Button>}
        </div>
      </PanelSection>
      <PanelSection title={s('frame.moveIt')}>
        <div className="kit-work__acts">
          <Button size="small" variant="quiet" onClick={() => send({ type: 'open' })} data-testid="work-open">{s('menu.open')}</Button>
          {ways.map((way) => (
            <Button key={way.kind} size="small" variant="quiet" onClick={way.onConnect} data-testid={`work-way-${way.kind}`}>{s(way.labelKey as StringKey)}</Button>
          ))}
          {ways.flatMap((way) => (way.recent ?? []).map((held) => (
            <Button key={held.key} size="small" variant="quiet" onClick={() => way.onReopen?.(held.key)} data-testid="work-recent">{held.label}</Button>
          )))}
        </div>
      </PanelSection>
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
  const { services: { s, prefs }, agent, props, provider } = parts
  const history = facts?.kind === 'workspace' ? props.repositories.history !== undefined : parts.home.history.available
  const Own = provider.YourWork
  const where = props.provider?.sayings?.whereKey ?? props.provider?.description
  return (
    <Panel
      kind={s('frame.yourWork')} name={statusOf(parts, facts, prefs.language, s, own).text || s('frame.yourWork')} dataGuide="frame.yourWork"
      facts={where !== undefined ? s(where as StringKey) : undefined} onClose={() => agent.setPanel(undefined)} help={s('frame.appliesToAll')}
      helpLink={{ label: s('work.manual'), onPress: () => props.hostControls.openExternal(manualUrl(prefs.language)) }}
    >
      {/* What this host says of its own comes first: it is what a person opened this to read. */}
      {Own && <Own {...workProps(parts)} />}
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
    <Panel
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
