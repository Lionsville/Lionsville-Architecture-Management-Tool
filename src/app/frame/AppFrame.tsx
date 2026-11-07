// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The frame the app's screens are places in (decision 1): row one says where
 * you are and whether your work is safe, row two every place in this scope.
 *
 * It stands above whichever screen is up, so the rows do not change shape from
 * a home to a board to a page. What only the screen knows it publishes
 * (`frameStore`); where to go is always the one way an agent goes,
 * `openSomewhere`, so a person's press and `app.open` cannot land in different
 * places. How a screen plugs in is written down in `widgets/kit/README.md`.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Popover from '@mui/material/Popover'
import type { Translate } from '../../i18n'
import type { Destination, Page } from '../../agent/screen'
import { HOME_PAGES, viewPage } from '../../agent/screen'
import type { DesignDiagram } from '../../model/types'
import { matchesQuery } from '../../model/textSearch'
import { flattenScopes } from '../../projects/scope'
import type { ScopeSummary } from '../../projects/scope'
import { ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { AgentIcon, CaretIcon, RedoIcon, SearchIcon, UndoIcon } from '../../widgets/icons'
import { BandStack } from '../../widgets/kit/Band'
import type { StackedBand } from '../../widgets/kit/Band'
import { Button, IconButton } from '../../widgets/kit/Button'
import { Frame } from '../../widgets/kit/Frame'
import { MenuButton } from '../../widgets/kit/Menu'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { Tooltip } from '../../widgets/kit/Tooltip'
import { PlaceTabContext } from '../../widgets/placeTab'
import { BackForward } from '../BackForward'
import { BarEnd } from '../BarEnd'
import { frameBarButton, frameChip, frameOverflow } from '../AppPanels'
import { Crumbs, crumbsFor, SourceChipView } from '../ShellToolbar'
import type { ShellParts } from '../shellParts'
import { agentTip } from '../BarEnd'
import { commandsTable, keyCap } from './commandsTable'
import type { CommandRow } from './commandsTable'
import { FrameCommandsContext, useFrameState } from './frameStore'
import type { FrameState, PaletteLine, ScreenFacts } from './frameStore'
import { MORE_PLACES, ORGANISATION_PLACES, SCOPE_PLACES } from './places'
import type { FramePlace } from './places'
import { ActivityPanel, YourWorkPanel } from './FramePanels'
import { ScopeTreePanel } from './ScopeTreePanel'
import { ShortcutsSheet } from './ShortcutsSheet'
import { statusWord } from './statusWord'
import { DESKTOP_APP_LINK, WEBSITE_LINK, HELP_MENU, offered } from '../../platform/menu'

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export function AppFrame({ parts, children }: { parts: ShellParts; children: ReactNode }) {
  const { frame } = parts
  const state = useFrameState(frame)
  // The source says its answer moved: the word is asked again, connection and all.
  const [, askAgain] = useState(0)
  const onWork = parts.props.provider?.onWork
  useEffect(() => onWork?.(() => askAgain((count) => count + 1)), [onWork])
  const facts = state.screen
  const { services: { s }, agent, windowChrome } = parts
  const go = agent.openSomewhere
  const at: ScopePath = facts?.path ?? parts.nav.project?.path ?? parts.nav.home
  const screen = agent.screen ?? agent.screenNow()
  const page = screen.page?.page
  const pageUp = page !== undefined
  const onHomeBare = !parts.nav.project && !pageUp
  const [sheetOpen, setSheetOpen] = useShortcutsSheet(parts, facts)
  useFrameKeys(parts, state)
  const lines = usePaletteLines(parts, at, go)
  const { lookAgain } = agent
  const tabs = useMemo(() => ({
    tab: state.tabOf === page ? state.tab : undefined,
    choose: (tab: string) => { frame.set({ tab, tabOf: page }); lookAgain() },
  }), [state.tab, state.tabOf, page, frame, lookAgain])
  // Settings asked for by an address or an agent: answered by the screen of that scope, once it is up.
  useEffect(() => {
    if (state.asks !== 'settings' || facts?.openSettings === undefined) return
    frame.set({ asks: undefined })
    facts.openSettings()
  }, [state.asks, facts, frame])
  const tree = (onHomeBare || state.pinned) && <TreeFor parts={parts} at={at} page={page} />
  return (
    <FrameCommandsContext.Provider value={lines}>
      <PlaceTabContext.Provider value={tabs}>
        <Frame
          pageUp={pageUp}
          controlsInset={windowChrome.controlsInset}
          draggable={windowChrome.draggable}
          rowOne={<RowOne parts={parts} state={state} at={at} />}
          rowTwoStart={<RowTwoStart parts={parts} facts={facts} at={at} pageUp={pageUp} />}
          rowTwoEnd={<RowTwoEnd parts={parts} at={at} page={page} />}
          band={<FrameBands parts={parts} facts={facts} />}
          tree={tree || undefined}
          panel={state.panel === 'work' ? <YourWorkPanel parts={parts} facts={facts} /> : state.panel === 'activity' ? <ActivityPanel parts={parts} facts={facts} /> : undefined}
        >
          {children}
        </Frame>
        <ShortcutsSheet open={sheetOpen} onClose={() => setSheetOpen(false)} rows={commandsTable(canOf(parts, facts), isMac() ? 'darwin' : 'other')} mac={isMac()} s={s} />
      </PlaceTabContext.Provider>
    </FrameCommandsContext.Provider>
  )
}

export function canOf(parts: ShellParts, facts: ScreenFacts | undefined) {
  return {
    history: parts.nav.project ? parts.props.repositories.history !== undefined : parts.home.history.available,
    connect: Boolean(parts.provider.offered?.some((way) => way.hostMenu)),
    scope: facts?.kind === 'workspace',
  }
}

/** The `?` key and the menu's item, on every screen: a board's own sheet where a board is up, this one elsewhere. */
function useShortcutsSheet(parts: ShellParts, facts: ScreenFacts | undefined) {
  const [open, setOpen] = useState(false)
  const boardUp = useRef(false)
  boardUp.current = facts?.boardUp === true
  const showBoard = useRef(facts?.showShortcuts)
  showBoard.current = facts?.showShortcuts
  useEffect(() => parts.commands.bus.on((command) => {
    if (command.type !== 'shortcuts') return
    if (boardUp.current && showBoard.current) showBoard.current()
    else setOpen(true)
  }), [parts.commands.bus])
  return [open, setOpen] as const
}

/** ⌘\ pins the tree, `?` opens the sheet where no canvas has its own, and Esc shuts a panel first. */
function useFrameKeys(parts: ShellParts, state: FrameState) {
  const { frame } = parts
  const send = parts.commands.bus.send
  const hasPanel = state.panel !== undefined
  const boardUp = state.screen?.boardUp === true
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target !== null && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
        event.preventDefault()
        const pinned = !frame.get().pinned
        frame.set({ pinned })
        parts.services.prefs.writePreference({ treePinned: pinned })
        return
      }
      if (event.key === '?' && !typing && !boardUp && !document.querySelector('[role="dialog"]')) { send({ type: 'shortcuts' }); return }
      if (event.key === 'Escape' && hasPanel && !document.querySelector('[role="dialog"], [role="menu"]')) {
        event.preventDefault()
        parts.agent.setPanel(undefined)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [frame, send, hasPanel, boardUp, parts.agent, parts.services.prefs])
}

function usePaletteLines(parts: ShellParts, at: ScopePath, go: ShellParts['agent']['openSomewhere']) {
  const { services: { s }, commands: { bus } } = parts
  const send = bus.send
  const can = canOf(parts, parts.frame.get().screen)
  const canKey = JSON.stringify(can)
  return useMemo(() => {
    const rows: PaletteLine[] = []
    const place = (one: FramePlace, scope: ScopePath) => rows.push({ id: `place:${one.page}`, group: s('frame.places'), label: s(one.label), run: () => go({ scope, page: one.page }) })
    rows.push({ id: 'place:home', group: s('frame.places'), label: s('frame.home'), run: () => go({ scope: at, page: 'home' }) })
    SCOPE_PLACES.forEach((one) => place(one, at))
    ORGANISATION_PLACES.forEach((one) => place(one, ROOT_SCOPE))
    MORE_PLACES.forEach((one) => place(one, ROOT_SCOPE))
    rows.push({ id: 'place:work', group: s('frame.places'), label: s('frame.yourWork'), run: () => go({ scope: at, page: 'work' }) })
    rows.push({ id: 'place:activity', group: s('frame.places'), label: s('shell.activity'), run: () => go({ scope: at, page: 'activity' }) })
    rows.push({ id: 'place:settings', group: s('frame.places'), label: s('settings.title'), run: () => go({ scope: at, page: 'settings' }) })
    const mac = isMac()
    commandsTable(JSON.parse(canKey), mac ? 'darwin' : 'other').forEach((row: CommandRow) => {
      rows.push({ id: row.id, group: s('frame.commands'), label: s(row.label), ...(row.keys ? { keys: keyCap(row.keys, mac) } : {}), run: () => send(row.command) })
    })
    return (asked: string) => (asked.trim() === '' ? rows : rows.filter((row) => matchesQuery(asked, [row.label])))
  }, [s, at, go, send, canKey])
}

function TreeFor({ parts, at, page, onDone }: { parts: ShellParts; at: ScopePath; page: Page | undefined; onDone?: () => void }) {
  const { organisation, order, services: { s, prefs }, agent, nav } = parts
  const { writable } = parts
  const leave = (then: () => void) => () => { onDone?.(); then() }
  // Settings and removal are asked by the organisation's dialogs on a home; from
  // a scope that is open, the home's dialogs are one move away, and that is the move.
  const onHome = (path: ScopePath) => leave(() => agent.openSomewhere({ scope: path, page: 'home' }))()
  const fromHome = (then: (scope: ScopeSummary) => void) => (scope: ScopeSummary) => {
    onDone?.()
    if (nav.project) nav.goHome(at)
    then(scope)
  }
  return (
    <ScopeTreePanel
      tree={organisation.tree} at={at} page={page} order={order.order} onOrderChange={order.chooseOrder} folds={organisation}
      onHome={onHome} go={(to) => { onDone?.(); agent.openSomewhere(to) }}
      onSettings={fromHome(organisation.editScope)} onDelete={fromHome(organisation.askDelete)}
      onNewScope={writable(at) ? () => { onDone?.(); if (nav.project) nav.goHome(at); organisation.addUnder(at) } : undefined}
      writable={writable} language={prefs.language} s={s}
      {...(parts.frame.get().screen?.typeLink ? { typeLink: parts.frame.get().screen?.typeLink } : {})}
    />
  )
}

function Trail({ parts, facts, at, name }: { parts: ShellParts; facts: ScreenFacts | undefined; at: ScopePath; name: string }) {
  const { organisation: { tree }, services: { s } } = parts
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const crumbs = useMemo(() => crumbsFor(at, flattenScopes(tree), s), [at, tree, s])
  const page = parts.agent.screen?.page?.page
  return (
    <>
      <Crumbs crumbs={crumbs} current={name} currentPath={at} onGoHome={(path) => parts.agent.openSomewhere({ scope: path, page: 'home' })} s={s} />
      <IconButton
        label={s('frame.switchScope')} size="small" data-testid="scope-switcher-open" data-guide="frame.switcher"
        aria-haspopup="dialog" aria-expanded={anchor !== null} onClick={(event) => setAnchor(event.currentTarget)}
      >
        <CaretIcon size={14} />
      </IconButton>
      <Popover
        open={anchor !== null} anchorEl={anchor} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {anchor && (
          <div className="kit-switcher" data-testid="scope-switcher">
            {facts?.openSettings && (
              <Button variant="quiet" size="small" onClick={() => { setAnchor(null); facts.openSettings?.() }}>{s('settings.open')}</Button>
            )}
            <TreeFor parts={parts} at={at} page={page} onDone={() => setAnchor(null)} />
          </div>
        )}
      </Popover>
    </>
  )
}

/** Who else has this scope open, names only; said only while somebody has. */
export function AlsoHere({ names, s }: { names: readonly string[]; s: Translate }) {
  return <span className="kit-frame__also" data-testid="also-here" data-guide="shell.alsoHere">{s('shell.alsoHere', { names: names.join(', ') })}</span>
}

function RowOne({ parts, state, at }: { parts: ShellParts; state: FrameState; at: ScopePath }) {
  const { services: { s }, organisation: { tree } } = parts
  const facts = state.screen
  const name = facts?.name ?? (at === ROOT_SCOPE ? (tree.name.trim() || s('common.organisation')) : (flattenScopes(tree).find((one) => one.path === at)?.name ?? at))
  const chip = frameChip(parts)
  const scopeOpen = facts?.kind === 'workspace'
  return (
    <>
      <BackForward s={s} />
      <TreeToggle parts={parts} pinned={state.pinned} />
      <Trail parts={parts} facts={facts} at={at} name={name} />
      <div className="kit-frame__grow" />
      <FindField openSearch={facts?.openSearch} s={s} />
      <div className="kit-frame__grow" />
      <UndoRedo facts={facts} s={s} />
      <SafeWords parts={parts} state={state} />
      <AgentButton parts={parts} />
      <BarEnd button={frameBarButton(parts, scopeOpen ? 'workspace' : 'organisation')} chip={chip && <SourceChipView {...chip} s={s} />} s={s} />
      <HelpMenu parts={parts} />
      <BarEnd overflow={frameOverflow(parts, scopeOpen)} s={s} />
    </>
  )
}

function TreeToggle({ parts, pinned }: { parts: ShellParts; pinned: boolean }) {
  const { frame, services: { s, prefs } } = parts
  return (
    <IconButton
      label={s('frame.treeToggle')} size="small" aria-pressed={pinned} data-testid="frame-tree-toggle" data-guide="frame.tree"
      onClick={() => { frame.set({ pinned: !pinned }); prefs.writePreference({ treePinned: !pinned }) }}
    >
      <TreeGlyph />
    </IconButton>
  )
}

function FindField({ openSearch, s }: { openSearch: (() => void) | undefined; s: Translate }) {
  return (
    <Tooltip title={s('frame.findTip')}>
      <button type="button" className="kit-frame__find" aria-label={s('frame.find')} data-testid="frame-find" data-guide="frame.find" onClick={() => openSearch?.()}>
        <SearchIcon size={14} />
        <span>{s('frame.find')}</span>
        <span className="kit-frame__kbd">{isMac() ? '⌘K' : 'Ctrl K'}</span>
      </button>
    </Tooltip>
  )
}

/** Undo and redo, on every place: ⌘Z covers a decision accepted on a page, so they cannot live in a board's bar. */
function UndoRedo({ facts, s }: { facts: ScreenFacts | undefined; s: Translate }) {
  const { undo, redo } = facts ?? {}
  return (
    <>
      <Tooltip title={undo?.name ?? s('toolbar.undoTip')}>
        <span><IconButton label={s('toolbar.undo')} size="small" disabled={!undo?.can} onClick={() => undo?.run()}><UndoIcon size={16} /></IconButton></span>
      </Tooltip>
      <Tooltip title={redo?.name ?? s('toolbar.redoTip')}>
        <span><IconButton label={s('toolbar.redo')} size="small" disabled={!redo?.can} onClick={() => redo?.run()}><RedoIcon size={16} /></IconButton></span>
      </Tooltip>
    </>
  )
}

/** Whether work is safe, who else is here, and what was lately done: the word and the two panels behind it. */
function SafeWords({ parts, state }: { parts: ShellParts; state: FrameState }) {
  const { services: { s, prefs } } = parts
  const facts = state.screen
  const word = statusWord({
    status: facts?.status, saveFailed: facts?.saveFailed, savedAt: facts?.savedAt, publishesSteps: facts?.publishesSteps,
    sourceStatus: facts?.sourceStatus, connected: parts.props.provider?.connected?.(),
  }, prefs.language, s)
  const togglePanel = (panel: 'work' | 'activity') => parts.agent.setPanel(state.panel === panel ? undefined : panel)
  const here = facts?.alsoHere ?? []
  return (
    <>
      {word.text !== '' && (
        <button
          type="button" className="kit-frame__status" data-testid="saved-indicator" data-guide="frame.status" data-alarm={word.alarm || undefined}
          aria-expanded={state.panel === 'work'} title={word.text} onClick={() => togglePanel('work')}
        >
          {word.text}
        </button>
      )}
      {here.length > 0 && <AlsoHere names={here} s={s} />}
      <Tooltip title={s(facts?.activityKept ? 'shell.activityTipKept' : 'shell.activityTip')}>
        <Button variant="quiet" size="small" aria-expanded={state.panel === 'activity'} onClick={() => togglePanel('activity')} data-guide="shell.activity" data-testid="frame-activity">
          {s('shell.activity')}
        </Button>
      </Tooltip>
    </>
  )
}

function AgentButton({ parts }: { parts: ShellParts }) {
  const { services: { s }, agentServer: { bar } } = parts
  const connected = bar.status.kind === 'connected'
  return (
    <Tooltip title={agentTip(bar.status, s)}>
      <Button
        variant="quiet" size="small" onClick={bar.onOpen} data-testid="agent-glyph" data-guide="frame.agent" data-state={bar.status.kind}
        icon={<AgentIcon size={14} filled={connected} />}
      >
        {bar.status.kind === 'connected' ? bar.status.client.name : s('frame.agent')}
      </Button>
    </Tooltip>
  )
}

/** The ? in row one: the manual, the keys, and the two ways out of this build on a host with no menu bar. */
function HelpMenu({ parts }: { parts: ShellParts }) {
  const { services: { s }, commands: { bus } } = parts
  const help = offered(HELP_MENU, 'web', { history: false, connect: false, scope: true })
  const items: MenuEntry[] = help.flatMap((entry) => (entry.kind === 'item' ? [{ label: s(entry.label), onSelect: () => bus.send(entry.command) }] : []))
  if (!parts.hostMenu) {
    const open = (href: string) => () => parts.props.hostControls.openExternal(href)
    items.push({ line: true }, { label: s(DESKTOP_APP_LINK.label), onSelect: open(DESKTOP_APP_LINK.href) }, { label: s(WEBSITE_LINK.label), onSelect: open(WEBSITE_LINK.href), 'data-guide': 'shell.website' })
  }
  return (
    <MenuButton label={s('frame.help')} variant="quiet" size="small" items={items} data-guide="frame.help" />
  )
}

function TreeGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.2}>
      <rect x={1.5} y={2.5} width={13} height={11} rx={1} />
      <line x1={6} y1={2.5} x2={6} y2={13.5} />
    </svg>
  )
}

function RowTwoStart({ parts, facts, at, pageUp }: { parts: ShellParts; facts: ScreenFacts | undefined; at: ScopePath; pageUp: boolean }) {
  const { services: { s }, agent } = parts
  const homeHere = !parts.nav.project && !pageUp
  return (
    <>
      <button type="button" className="kit-frame__tab" aria-current={homeHere ? 'page' : undefined} data-testid="frame-home" data-guide="frame.home" onClick={() => agent.openSomewhere({ scope: at, page: 'home' })}>
        {s('frame.home')}
      </button>
      {facts?.kind === 'home' && (facts.views ?? []).map((view) => (
        <button key={view.id} type="button" className="kit-frame__tab" data-testid={`frame-view-${view.id}`} onClick={() => agent.openSomewhere({ scope: at, page: viewPage(view.kind as DesignDiagram['kind']), id: view.id })}>
          {view.name}
        </button>
      ))}
      {facts?.kind === 'home' && facts.onNewView && (
        <IconButton label={s('frame.newView')} size="small" data-testid="frame-new-view" onClick={facts.onNewView}>+</IconButton>
      )}
    </>
  )
}

function RowTwoEnd({ parts, at, page }: { parts: ShellParts; at: ScopePath; page: Page | undefined }) {
  const { services: { s }, agent } = parts
  const go = agent.openSomewhere
  const more: MenuEntry[] = [
    ...ORGANISATION_PLACES.map((one) => ({ label: s(one.label), checked: page === one.page, onSelect: () => go({ scope: ROOT_SCOPE, page: one.page }) })),
    { line: true },
    ...MORE_PLACES.map((one) => ({ label: s(one.label), checked: page === one.page, onSelect: () => go({ scope: HOME_PAGES.includes(one.page) ? at : ROOT_SCOPE, page: one.page }) })),
  ]
  const shows = (one: FramePlace) => (one.page === 'documentation' ? page === 'document' || page === 'documentation' : page === one.page)
  return (
    <>
      {SCOPE_PLACES.map((one) => (
        <button
          key={one.page} type="button" className="kit-frame__tab" aria-current={shows(one) ? 'page' : undefined} data-testid={`frame-page-${one.page}`}
          onClick={() => go({ scope: at, page: one.page } as Destination & { scope: string })}
        >
          {s(one.label)}
        </button>
      ))}
      <MenuButton label={s('frame.more')} variant="quiet" size="small" items={more} data-guide="frame.more" />
    </>
  )
}

/** Never two bands: the agent first, since it is changing what is on screen, then what the screen itself says. */
function FrameBands({ parts, facts }: { parts: ShellParts; facts: ScreenFacts | undefined }) {
  const agent = useAgentBand(parts, facts)
  const bands = useMemo<StackedBand[]>(() => [...(agent ? [agent] : []), ...(facts?.bands ?? [])], [agent, facts?.bands])
  return <BandStack bands={bands} />
}

/**
 * The agent on the frame: who is at work and why, how far it has come, Stop;
 * and once it stops or finishes, that said in the same place until dismissed,
 * with the way to take the run back while its steps are the newest.
 */
function useAgentBand(parts: ShellParts, facts: ScreenFacts | undefined): StackedBand | undefined {
  const { services: { s }, agent } = parts
  const session = agent.driving.session
  const stopped = agent.driving.stopped
  const [ended, setEnded] = useState<{ name: string; stopped: boolean } | undefined>()
  const was = useRef(session)
  const name = (client: string | undefined) => client ?? s('agent.someone')
  useEffect(() => {
    if (session) setEnded(undefined)
    else if (was.current) setEnded({ name: name(was.current.client), stopped: stopped !== undefined })
    was.current = session
    // A session's start and end, and nothing else.
  }, [session, stopped])
  const run = facts?.agentRun?.()
  if (session) {
    const who = name(session.client)
    return {
      id: 'agent', tone: 'agent',
      title: <span data-testid="agent-driving">{session.purpose ? s('agent.drivingFor', { name: who, purpose: session.purpose }) : s('agent.driving', { name: who })}</span>,
      detail: <>{run ? `${s('frame.agentCount', { count: run.steps })} ` : ''}{s('agent.drivingHint')}</>,
      action: <Button size="small" onClick={agent.stop} data-testid="agent-stop">{s('agent.stop')}</Button>,
    }
  }
  if (!ended) return undefined
  return {
    id: 'agent', tone: 'agent',
    title: <span data-testid="agent-ended">{ended.stopped ? s('frame.agentStopped', { name: ended.name }) : s('frame.agentFinished', { name: ended.name, count: run?.steps ?? 0 })}</span>,
    action: (
      <>
        {run?.undo && <Button size="small" variant="quiet" onClick={run.undo} data-testid="agent-undo-run">{s('frame.undoThem')}</Button>}
        {run?.putBack && <Button size="small" variant="quiet" onClick={run.putBack} data-testid="agent-put-back-run">{s('frame.putThemBack')}</Button>}
        <Button size="small" variant="quiet" onClick={() => setEnded(undefined)} data-testid="agent-dismiss">{s('frame.dismiss')}</Button>
      </>
    ),
  }
}
