// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The frame's two panels: *Your work*, the one place for where work is kept and
 * how to keep it, whichever host is underneath, and *Activity*, what was lately
 * done. Both are the one Panel, and every act in them is a command on the same
 * stream the menu sends, so they work with nothing open.
 */
import type { StringKey } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { Panel, PanelSection } from '../../widgets/kit/Panel'
import { ActivityLines } from '../ActivityMenu'
import type { ShellParts } from '../shellParts'
import { statusWord } from './statusWord'
import type { ScreenFacts } from './frameStore'

export function YourWorkPanel({ parts, facts }: { parts: ShellParts; facts: ScreenFacts | undefined }) {
  const { services: { s, prefs }, commands: { bus }, agent, props, provider } = parts
  const send = bus.send
  const word = statusWord({
    status: facts?.status, saveFailed: facts?.saveFailed, savedAt: facts?.savedAt, publishesSteps: facts?.publishesSteps,
    sourceStatus: facts?.sourceStatus, connected: props.provider?.connected?.(),
  }, prefs.language, s)
  const where = props.provider?.sayings?.whereKey ?? props.provider?.description
  const scopeOpen = facts?.kind === 'workspace'
  const history = scopeOpen ? props.repositories.history !== undefined : parts.home.history.available
  const Own = provider.YourWork
  return (
    <Panel
      kind={s('frame.yourWork')} name={word.text || s('frame.yourWork')} dataGuide="frame.yourWork"
      facts={where !== undefined ? s(where as StringKey) : undefined} onClose={() => agent.setPanel(undefined)} help={s('frame.appliesToAll')}
    >
      {facts?.activity && <p>{s('frame.sessionChanges', { count: facts.activity().length })}</p>}
      <PanelSection title={s('frame.keepIt')}>
        {scopeOpen && <Button size="small" onClick={() => send({ type: 'save' })} data-testid="work-save">{s('menu.save')}</Button>}
        <Button size="small" onClick={() => send({ type: 'export' })} data-testid="work-copy">{s('menu.exportWorkingFile')}</Button>
        {history && <Button size="small" onClick={() => send({ type: 'snapshot' })} data-testid="work-snapshot">{s('menu.snapshot')}</Button>}
      </PanelSection>
      <PanelSection title={s('frame.moveIt')}>
        <Button size="small" variant="quiet" onClick={() => send({ type: 'open' })} data-testid="work-open">{s('menu.open')}</Button>
        {(provider.offered ?? []).map((way) => (
          <Button key={way.kind} size="small" variant="quiet" onClick={way.onConnect} data-testid={`work-way-${way.kind}`}>{s(way.labelKey as StringKey)}</Button>
        ))}
      </PanelSection>
      <PanelSection title={s('frame.lookBack')}>
        <Button size="small" variant="quiet" onClick={() => agent.setPanel('activity')} data-testid="work-activity">{s('shell.activity')}</Button>
        {history && <Button size="small" variant="quiet" onClick={() => send({ type: 'history' })} data-testid="work-history">{s('menu.history')}</Button>}
      </PanelSection>
      {/* What this host says of its own about where work is kept. */}
      {Own && <Own own={provider.own} session={provider.openScope} open={agent.openSomewhere} />}
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
