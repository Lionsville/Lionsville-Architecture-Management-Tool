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
import type { ComponentProps, ReactNode } from 'react'
import { SurfacePopover as Popover } from '../../widgets/kit/Surface'
import type { Translate } from '../../i18n'
import type { Destination, Page, Screen } from '../../agent/screen'
import { HOME_PAGES, viewPage } from '../../agent/screen'
import type { DesignDiagram } from '../../model/types'
import { matchesQuery } from '../../model/textSearch'
import { isSheetReading } from '../../model/sheetReading'
import { flattenScopes } from '../../projects/scope'
import type { ScopeSummary } from '../../projects/scope'
import { ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { AgentIcon, CaretIcon, RedoIcon, SearchIcon, UndoIcon } from '../../widgets/icons'
import { BandStack } from '../../widgets/kit/Band'
import type { StackedBand } from '../../widgets/kit/Band'
import { Button, IconButton } from '../../widgets/kit/Button'
import { Frame } from '../../widgets/kit/Frame'
import { MenuButton, MoreMenu } from '../../widgets/kit/Menu'
import { HelpPlaceProvider } from '../../widgets/kit/HelpPress'
import { helpHere, takesText } from '../helpKeys'
import type { MenuAct, MenuEntry, MenuSpacer } from '../../widgets/kit/Menu'
import { Tooltip } from '../../widgets/kit/Tooltip'
import { PlaceFacetsContext, PlaceListContext, PlaceReadingContext, PlaceTabContext } from '../../widgets/placeTab'
import type { PlaceReading, PlaceTo, ViewFacets } from '../../widgets/placeTab'
import { PageDialog } from '../../widgets/PageDialog'
import { BackForward } from '../BackForward'
import { BarEnd } from '../BarEnd'
import { frameBarButton, frameChip, frameOverflow } from '../AppPanels'
import { Crumbs, crumbsFor, SourceChipView } from '../ShellToolbar'
import type { ShellParts } from '../shellParts'
import { agentTip } from '../BarEnd'
import { lazyPart } from '../../widgets/lazyPart'
import type { FindingBandStack as FindingBandShape } from './FindingBand'
import { commandsTable, keyCap } from './commandsTable'
import { useRowFold } from '../../widgets/kit/useRowFold'
import { TextSizeControl, textSizeEntries } from '../../widgets/kit/TextSizeControl'
import { DEFAULT_TEXT_SIZE, TEXT_SIZES } from '../../platform/textSize'
import { useStrings } from '../../i18n/LanguageContext'
import type { CommandRow } from './commandsTable'
import { FrameCommandsContext, useFrameState } from './frameStore'
import type { FrameState, PaletteLine, ScreenFacts } from './frameStore'
import { FOUND_PLACES, MORE_PLACES, ORGANISATION_PLACES, placeShows, SCOPE_PLACES } from './places'
import type { FramePlace } from './places'
import { ActivityPanel, statusOf, YourWorkPanel } from './FramePanels'
import { ScopeTreePanel } from './ScopeTreePanel'
import { recentFrom, recentOf, RECENT_KEY, remembered } from './recentPlaces'
import { sourceKey } from '../../platform/workingSource'
import { holdingsOf } from '../organisation/holdings'
import { newViewChoices } from '../organisation/newViewChoices'
import { registerSummary } from '../organisation/register'
import { plural } from '../../i18n/strings'
import { ShortcutsSheet } from './ShortcutsSheet'
import { TONE_MARK } from './statusWord'
import { NewViewDialog } from '../NewViewDialog'
import { DESKTOP_APP_LINK, FILE_MENU, PREFERENCES_ITEM, WEBSITE_LINK, HELP_MENU, acceleratorMatches, offered } from '../../platform/menu'
import type { KeyPress, MenuItemSpec } from '../../platform/menu'
import { commandKey, chordHeld, isMac } from '../../widgets/kit/keys'


export function AppFrame({ parts, children }: { parts: ShellParts; children: ReactNode }) {
  const { frame } = parts
  const state = useFrameState(frame)
  // The source says its answer moved: the word is asked again, connection and all.
  const [, askAgain] = useState(0)
  const onWork = parts.props.provider?.onWork
  useEffect(() => onWork?.(() => askAgain((count) => count + 1)), [onWork])
  const facts = state.screen
  const { services: { s }, agent } = parts
  const go = agent.openSomewhere
  const at: ScopePath = facts?.path ?? parts.nav.project?.path ?? parts.nav.home
  const screen = agent.screen ?? agent.screenNow()
  const page = screen.page?.page
  const pageUp = page !== undefined
  const onHomeBare = !parts.nav.project && !pageUp
  const [sheetOpen, setSheetOpen] = useShortcutsSheet(parts)
  useExampleCommand(parts)
  useFrameKeys(parts, state)
  useRememberPlace(parts, screen)
  const lines = usePaletteLines(parts, at, go)
  const { lookAgain } = agent
  const openView = screen.open?.view
  const tabPage = page ?? (openView ? viewPage(openView.kind as DesignDiagram['kind']) : undefined)
  const tabs = useMemo(() => ({
    tab: state.tabOf === tabPage ? state.tab : undefined,
    choose: (tab: string, of?: string) => { frame.set({ tab, tabOf: (of as Page | undefined) ?? tabPage }); lookAgain() },
    record: state.record,
    recordOf: state.recordOf,
    chooseRecord: (record: string | undefined, of: string) => { frame.set({ record, recordOf: of as Page }); lookAgain() },
    look: state.tabOf === tabPage ? state.look : undefined,
    chooseLook: (look: string | undefined, of?: string) => {
      const whose = (of as Page | undefined) ?? tabPage
      frame.set({ look, tabOf: whose, ...(state.tabOf === whose ? {} : { tab: undefined }) })
      lookAgain()
    },
    chooseFor: (of: string, tab: string) => { frame.set({ tab, tabOf: of as Page }) },
    go: (to: PlaceTo) => go(to as Destination),
  }), [state.tab, state.tabOf, state.look, state.record, state.recordOf, tabPage, frame, lookAgain, go])
  const lists = useMemo(() => ({
    list: state.listOf === page ? state.list : undefined,
    pick: state.listOf === page ? state.pick : undefined,
    choose: (list: string, pick: string | undefined, of: string) => { frame.set({ list: list || undefined, pick, listOf: of as Page }); lookAgain() },
  }), [state.list, state.pick, state.listOf, page, frame, lookAgain])
  const facets = useMemo(() => ({
    of: (viewId: string) => (state.facets?.of === viewId ? state.facets : undefined),
    choose: (viewId: string, chosen: ViewFacets) => { frame.set({ facets: { ...chosen, of: viewId } }); lookAgain() },
  }), [state.facets, frame, lookAgain])
  // How a view is being read, in the frame so it is in the address; only while the view itself is up.
  const viewId = screen.page === undefined ? openView?.id : undefined
  const reading = useMemo(() => ({
    reading: state.readingOf !== undefined && state.readingOf === viewId
      ? { ...(state.colour !== undefined ? { colour: state.colour } : {}), ...(state.day !== undefined ? { day: state.day } : {}) }
      : {},
    choose: (next: PlaceReading) => { frame.set({ colour: next.colour, day: next.day, readingOf: viewId }); lookAgain() },
  }), [state.colour, state.day, state.readingOf, viewId, frame, lookAgain])
  const sourceFrame = parts.props.provider?.frame
  const holding = !parts.nav.project && (sourceFrame?.holding?.() ?? false)
  const Hold = sourceFrame?.Hold
  const Settle = sourceFrame?.Settle
  const slot = { own: parts.provider.own, session: parts.provider.openScope, open: go, copyText: parts.props.hostControls.copyText }
  // A source with no page of its own for agents keeps the dialog: the address lands there, on the home.
  const noAgentsPage = page === 'agents' && sourceFrame?.Agents === undefined
  const openAgentDialog = parts.agentServer.bar.onOpen
  useEffect(() => {
    if (!noAgentsPage) return
    go({ scope: at, page: 'home' })
    openAgentDialog()
  }, [noAgentsPage, at, go, openAgentDialog])
  const sendCommand = parts.commands.bus.send
  const openHelpAt = useMemo(() => (at: string) => sendCommand({ type: 'manual', section: at }), [sendCommand])
  const tree = (onHomeBare || state.pinned) && !facts?.bare && !holding && <TreeFor parts={parts} at={at} page={page} />
  return (
    <FrameCommandsContext.Provider value={lines}>
      <PlaceTabContext.Provider value={tabs}>
        <PlaceListContext.Provider value={lists}>
        <PlaceFacetsContext.Provider value={facets}>
      <PlaceReadingContext.Provider value={reading}>
        <HelpPlaceProvider value={openHelpAt}>
        <Frame
          pageUp={pageUp}
          rowOne={<RowOne parts={parts} state={state} at={at} />}
          rowTwoStart={<RowTwoStart parts={parts} facts={facts} at={at} pageUp={pageUp} />}
          rowTwoEnd={<RowTwoEnd parts={parts} at={at} page={page} />}
          band={<FrameBands parts={parts} facts={facts} />}
          tree={tree || undefined}
          panel={state.panel === 'work' ? <YourWorkPanel parts={parts} facts={facts} />
            : state.panel === 'activity' ? <ActivityPanel parts={parts} facts={facts} />
              : state.panel === 'settle' && Settle ? <Settle {...slot} /> : undefined}
          accented={Boolean(parts.props.provider?.accent)}
          panelName={state.panel}
        >
          {holding && Hold ? <Hold {...slot} /> : children}
          {!holding && page === 'agents' && <AgentsPlace parts={parts} at={at} />}
        </Frame>
        </HelpPlaceProvider>
        <ShortcutsSheet open={sheetOpen} onClose={() => setSheetOpen(false)} rows={commandsTable(canOf(parts, facts), isMac() ? 'darwin' : 'other')} mac={isMac()} s={s} />
      </PlaceReadingContext.Provider>
        </PlaceFacetsContext.Provider>
        </PlaceListContext.Provider>
      </PlaceTabContext.Provider>
    </FrameCommandsContext.Provider>
  )
}

/** A place worth coming back to is written down as it is arrived at, for *Continue*: a preference of this computer's. */
function useRememberPlace(parts: ShellParts, screen: Screen) {
  const { services: { prefs }, source } = parts
  const place = recentOf(screen, new Date().toISOString())
  const key = place && `${place.scope}|${place.page}|${place.id ?? ''}`
  const latest = useRef(place)
  latest.current = place
  useEffect(() => {
    const here = latest.current
    if (!here) return
    const by = sourceKey(source)
    const stored = prefs.readPreferences()[RECENT_KEY] as Record<string, unknown> | undefined
    prefs.writePreference({ [RECENT_KEY]: { ...stored, [by]: remembered(recentFrom(stored, by), here) } })
    // Once per arrival, whatever else moves on the screen.
  }, [key])
}

export function canOf(parts: ShellParts, facts: ScreenFacts | undefined) {
  return {
    history: parts.nav.project ? parts.props.repositories.history !== undefined : parts.home.history.available,
    connect: Boolean(parts.provider.offered?.some((way) => way.hostMenu)),
    scope: facts?.kind === 'workspace',
    example: exampleOffered(parts),
  }
}

/** Whether the example can be visited from here: this build offers one, and it is not being visited already. */
function exampleOffered(parts: ShellParts): boolean {
  return parts.props.onVisitExample !== undefined && parts.props.examples.length > 0 && !parts.props.visiting
}

/**
 * Help's *Look around the example*, from any screen and with nothing open: the
 * first example this build offers, visited as the first page visits it. Where
 * it cannot be — none offered, or one is being visited — the menu bar's item
 * does nothing, as every item main cannot see the screen for.
 */
function useExampleCommand(parts: ShellParts) {
  const latest = useRef(parts)
  latest.current = parts
  useEffect(() => parts.commands.bus.on((command) => {
    if (command.type !== 'example') return
    const { props } = latest.current
    if (!exampleOffered(latest.current)) return
    props.onVisitExample?.(props.examples[0])
  }), [parts.commands.bus])
}

/** The one sheet of keys, on every screen and over a board alike: `?`, the Help menu's item and a board's own ⋯ open it. */
function useShortcutsSheet(parts: ShellParts) {
  const [open, setOpen] = useState(false)
  useEffect(() => parts.commands.bus.on((command) => {
    if (command.type === 'shortcuts') setOpen(true)
  }), [parts.commands.bus])
  return [open, setOpen] as const
}

/**
 * The ⋯ menu's keys, on a host with no menu bar to hear them: the menu shows ⌘O,
 * ⇧⌘O, ⇧⌘E and ⌘, on the web as well. An item the menu would refuse is not run,
 * and Save is left to a board's own keymap while one is up, so it saves once.
 */
export function menuKeyCommand(press: KeyPress, can: ReturnType<typeof canOf>, boardUp: boolean, mac: boolean): MenuItemSpec['command'] | undefined {
  const items = [...offered(FILE_MENU, 'web', can).flatMap((entry) => (entry.kind === 'item' ? [entry] : [])), PREFERENCES_ITEM]
  const hit = items.find((entry) => entry.accelerator !== undefined && acceleratorMatches(entry.accelerator, press, mac))
  if (!hit || (hit.command.type === 'save' && boardUp)) return undefined
  return hit.command
}

/**
 * Is something modal up, that owns the keys until it is closed? A dialog that
 * says so, or MUI's. Not the on-screen guidance, which is a dialog that is not
 * modal and stands beside every screen while a path is followed: refusing the
 * keys for any dialog at all took ⌘O, ⌘S and Esc away for as long as it was up.
 */
export function modalUp(): boolean {
  return Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"], [role="alertdialog"], .MuiDialog-root'))
    .some((found) => found.closest('[aria-hidden="true"]') === null)
}

/** ⌘Z, ⇧⌘Z and ⌘Y (Ctrl on Windows and Linux), as the canvas's keymap reads them. */
export function undoKey(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>): 'undo' | 'redo' | undefined {
  if (!commandKey(event) || event.altKey) return undefined
  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  return key === 'y' && !event.shiftKey ? 'redo' : undefined
}

/** ⌘\ pins the tree and Esc shuts a panel first; `?` and F1 are the shell's, on every screen (`helpKeys.ts`). */
function useFrameKeys(parts: ShellParts, state: FrameState) {
  const { frame } = parts
  const send = parts.commands.bus.send
  const hasPanel = state.panel !== undefined
  const boardUp = state.screen?.boardUp === true
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (commandKey(event) && event.key === '\\') {
        event.preventDefault()
        const pinned = !frame.get().pinned
        frame.set({ pinned })
        parts.services.prefs.writePreference({ treePinned: pinned })
        return
      }
      const undo = undoKey(event)
      // The desktop's Edit menu has ⌘Z and ⇧⌘Z everywhere but no ⌘Y; on the web a board's keymap has all three.
      const ours = undo !== undefined && (parts.hostMenu ? event.key.toLowerCase() === 'y' : !boardUp)
      if (ours && !takesText(event.target) && !modalUp()) {
        // Row one's ↶ and ↷ by their keys.
        const facts = frame.get().screen
        const act = undo === 'redo' ? facts?.redo : facts?.undo
        if (act?.can) { event.preventDefault(); event.stopPropagation(); act.run() }
        return
      }
      if (!parts.hostMenu && chordHeld(event) && !modalUp()) {
        const command = menuKeyCommand(event, canOf(parts, frame.get().screen), boardUp, isMac())
        if (command) { event.preventDefault(); send(command); return }
      }
      if (event.key === 'Escape' && hasPanel && !modalUp() && !document.querySelector('[role="menu"]')) {
        event.preventDefault()
        parts.agent.setPanel(undefined)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [frame, send, hasPanel, boardUp, parts])
}

function usePaletteLines(parts: ShellParts, at: ScopePath, go: ShellParts['agent']['openSomewhere']) {
  const { services: { s }, commands: { bus } } = parts
  const send = bus.send
  const can = canOf(parts, parts.frame.get().screen)
  const canKey = JSON.stringify(can)
  const hasAgentsPage = parts.props.provider?.frame?.Agents !== undefined
  return useMemo(() => {
    const rows: PaletteLine[] = []
    const place = (one: FramePlace, scope: ScopePath) => rows.push({ id: `place:${one.page}`, group: s('frame.places'), label: s(one.label), run: () => go({ scope, page: one.page }) })
    rows.push({ id: 'place:home', group: s('frame.places'), label: s('frame.home'), run: () => go({ scope: at, page: 'home' }) })
    SCOPE_PLACES.forEach((one) => place(one, at))
    ORGANISATION_PLACES.forEach((one) => place(one, ROOT_SCOPE))
    MORE_PLACES.forEach((one) => place(one, ROOT_SCOPE))
    FOUND_PLACES.forEach((one) => place(one, ROOT_SCOPE))
    rows.push({ id: 'place:work', group: s('frame.places'), label: s('frame.yourWork'), run: () => go({ scope: at, page: 'work' }) })
    rows.push({ id: 'place:activity', group: s('frame.places'), label: s('shell.activity'), run: () => go({ scope: at, page: 'activity' }) })
    rows.push({ id: 'place:settings', group: s('frame.places'), label: s('settings.title'), run: () => go({ scope: at, page: 'settings' }) })
    if (hasAgentsPage) rows.push({ id: 'place:agents', group: s('frame.places'), label: s('frame.agents'), run: () => go({ scope: ROOT_SCOPE, page: 'agents' }) })
    const mac = isMac()
    commandsTable(JSON.parse(canKey), mac ? 'darwin' : 'other').forEach((row: CommandRow) => {
      // Light, Dark and System are a menu's radio under Theme; on a line of their own they need the word, and a person types it.
      const label = row.command.type === 'theme' ? `${s('prefs.theme')}: ${s(row.label)}` : s(row.label)
      rows.push({ id: row.id, group: s('frame.commands'), label, ...(row.keys ? { keys: keyCap(row.keys, mac) } : {}), run: () => send(row.command) })
    })
    return (asked: string) => (asked.trim() === '' ? rows : rows.filter((row) => matchesQuery(asked, [row.label])))
  }, [s, at, go, send, canKey, hasAgentsPage])
}

/** The source's own page for agents: a place like any other, with an address and a way in with nothing open. */
function AgentsPlace({ parts, at }: { parts: ShellParts; at: ScopePath }) {
  const Agents = parts.props.provider?.frame?.Agents
  const { agent, agentServer: { bar }, services: { s } } = parts
  if (!Agents) return null
  return (
    <PageDialog open onClose={() => agent.openSomewhere({ scope: at, page: 'home' })} aria-label={s('frame.agents')}>
      <Agents own={parts.provider.own} session={parts.provider.openScope} open={agent.openSomewhere} copyText={parts.props.hostControls.copyText} {...(parts.props.agent ? { localAgent: bar.onOpen } : {})} />
    </PageDialog>
  )
}

function TreeFor({ parts, at, page, onDone }: { parts: ShellParts; at: ScopePath; page: Page | undefined; onDone?: () => void }) {
  const { organisation, order, services: { s, prefs }, agent, nav } = parts
  const { writable } = parts
  const leave = (then: () => void) => () => { onDone?.(); then() }
  // Removal is asked by the organisation's dialog on a home; from a scope that
  // is open, that home is one move away, and that is the move.
  const onHome = (path: ScopePath) => leave(() => agent.openSomewhere({ scope: path, page: 'home' }))()
  const fromHome = (then: (scope: ScopeSummary) => void) => (scope: ScopeSummary) => {
    onDone?.()
    if (nav.project) nav.goHome(at)
    then(scope)
  }
  const { models } = parts.tree
  const holdings = useMemo(() => holdingsOf(organisation.tree, models), [organisation.tree, models])
  const atHome = (then: () => void) => { onDone?.(); if (nav.project) nav.goHome(at); then() }
  return (
    <ScopeTreePanel
      tree={organisation.tree} at={at} page={page} order={order.order} onOrderChange={order.chooseOrder} folds={organisation}
      holdings={holdings} today={parts.todayDay}
      onHome={onHome} go={(to) => { onDone?.(); agent.openSomewhere(to) }}
      onSettings={(scope) => { onDone?.(); agent.openSomewhere({ scope: scope.path, page: 'settings' }) }} onDelete={fromHome(organisation.askDelete)}
      // Filed under is one of a scope's settings, so moving a scope is asked for there.
      onMove={(scope) => { onDone?.(); agent.openSomewhere({ scope: scope.path, page: 'settings' }) }}
      onNewScopeUnder={(path) => atHome(() => organisation.addUnder(path))}
      newViewItems={(path) => newViewChoices(s, () => atHome(() => organisation.addBoard(path)), (kind) => { onDone?.(); organisation.open(path, { page: 'make', kind }) })}
      placeFact={(place) => placeFact(place, parts)}
      writable={writable} language={prefs.language} s={s}
      {...(parts.frame.get().screen?.typeLink ? { typeLink: parts.frame.get().screen?.typeLink } : {})}
    />
  )
}

/** What the foot says beside a place: the register's counts, as its card used to say them, on hover. */
function placeFact(place: Page, parts: ShellParts): { count: string; words: string } | undefined {
  const { findings, services: { s } } = parts
  if (place !== 'register') return undefined
  const counts = registerSummary(findings.register)
  if (counts.applications === 0) return undefined
  return {
    count: String(counts.applications),
    words: [
      plural(s, { one: 'register.applicationsOne', other: 'register.applicationsOther' }, counts.applications),
      plural(s, { one: 'register.ownedOne', other: 'register.ownedOther' }, counts.owned),
      plural(s, { one: 'register.outsideOne', other: 'register.outsideOther' }, counts.outside),
    ].join(' · '),
  }
}

function Trail({ parts, at, name }: { parts: ShellParts; at: ScopePath; name: string }) {
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
            {parts.writable(at) && (
              <Button variant="quiet" size="small" onClick={() => { setAnchor(null); parts.agent.openSomewhere({ scope: at, page: 'settings' }) }}>{s('settings.open')}</Button>
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
  const { prefs } = parts.services
  // What goes first when the row runs out: the words beside the work, the size last, since it is what makes room for reading.
  const { folded: gone, anchor } = useRowFold(4, `${prefs.textSize} ${prefs.language}`)
  const { t } = useStrings()
  const sizing = { size: prefs.textSize, steps: TEXT_SIZES, normal: DEFAULT_TEXT_SIZE, onChoose: prefs.chooseTextSize }
  const togglePanel = (panel: 'activity') => parts.agent.setPanel(state.panel === panel ? undefined : panel)
  const foldedEntries: MenuEntry[] = [
    ...(gone >= 1 ? [{ label: s('shell.activity'), checked: state.panel === 'activity', onSelect: () => togglePanel('activity') }] : []),
    ...(gone >= 2 ? [agentEntry(parts)] : []),
    ...(gone >= 3 ? [{ label: s('frame.help'), items: helpEntries(parts) }] : []),
    ...(gone >= 4 ? textSizeEntries(sizing, t) : []),
  ]
  const overflow = frameOverflow(parts, scopeOpen)
  return (
    <>
      <span ref={anchor} hidden />
      <BackForward s={s} />
      <TreeToggle parts={parts} pinned={state.pinned} />
      <Trail parts={parts} at={at} name={name} />
      <div className="kit-frame__grow" />
      <FindField openSearch={facts?.openSearch} s={s} />
      <div className="kit-frame__grow" />
      {/* An editor has an undo of its own, for shapes; the model's here would take back the wrong thing. */}
      {!state.work && <UndoRedo facts={facts} s={s} />}
      <SafeWords parts={parts} state={state} activity={gone < 1} />
      {gone < 2 && <AgentButton parts={parts} />}
      <BarEnd button={frameBarButton(parts, scopeOpen ? 'workspace' : 'organisation')} chip={chip && <SourceChipView {...chip} s={s} />} s={s} />
      {gone < 4 && <TextSizeControl {...sizing} />}
      {gone < 3 && <HelpMenu parts={parts} />}
      {overflow && <BarEnd overflow={{ ...overflow, folded: foldedEntries }} s={s} />}
      {/* A host with a menu bar has no ⋯ of its own, and needs one only for what has folded. */}
      {!overflow && foldedEntries.length > 0 && <MoreMenu items={foldedEntries} size="small" />}
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
      <button type="button" className="kit-frame__find" data-testid="frame-find" data-guide="frame.find" onClick={() => openSearch?.()}>
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
      <IconButton label={s('toolbar.undo')} tip={undo?.name ?? s('toolbar.undoTip')} size="small" disabled={!undo?.can} onClick={() => undo?.run()}><UndoIcon size={16} /></IconButton>
      <IconButton label={s('toolbar.redo')} tip={redo?.name ?? s('toolbar.redoTip')} size="small" disabled={!redo?.can} onClick={() => redo?.run()}><RedoIcon size={16} /></IconButton>
    </>
  )
}

/** Whether work is safe, who else is here, and what was lately done: the word and the two panels behind it. */
function SafeWords({ parts, state, activity }: { parts: ShellParts; state: FrameState; activity: boolean }) {
  const { services: { s, prefs } } = parts
  const facts = state.screen
  const word = statusOf(parts, facts, prefs.language, s, state.work)
  const togglePanel = (panel: 'work' | 'activity') => parts.agent.setPanel(state.panel === panel ? undefined : panel)
  const here = facts?.alsoHere ?? []
  return (
    <>
      {word.text !== '' && (
        <button
          type="button" className="kit-frame__status" data-testid="saved-indicator" data-guide="frame.status" data-alarm={word.alarm || undefined} data-tone={word.tone}
          aria-expanded={state.panel === 'work'} aria-label={word.text} title={word.text} onClick={() => togglePanel('work')}
        >
          <span className="kit-frame__status-mark" aria-hidden>{TONE_MARK[word.tone]}</span>
          {/* Below 1100 px the word goes to icon and count, never to a bare dot. */}
          <span className="kit-frame__status-word" aria-live="polite">{word.text}</span>
          {word.short !== undefined && <span className="kit-frame__status-short" aria-hidden>{word.short}</span>}
          <CaretIcon size={12} />
        </button>
      )}
      {here.length > 0 && <AlsoHere names={here} s={s} />}
      {activity && (
        <Tooltip title={s(facts?.activityKept ? 'shell.activityTipKept' : 'shell.activityTip')}>
          <Button variant="quiet" size="small" aria-expanded={state.panel === 'activity'} onClick={() => togglePanel('activity')} data-guide="shell.activity" data-testid="frame-activity">
            {s('shell.activity')}
          </Button>
        </Tooltip>
      )}
    </>
  )
}

/** The agent's button as a line in the row's ⋯. */
function agentEntry(parts: ShellParts): MenuAct {
  const { services: { s }, agentServer: { bar }, agent } = parts
  if (parts.props.provider?.frame?.Agents) return { label: s('frame.agents'), onSelect: () => agent.openSomewhere({ scope: ROOT_SCOPE, page: 'agents' }) }
  return { label: bar.status.kind === 'connected' ? bar.status.client.name : s('frame.agent'), onSelect: bar.onOpen }
}

function AgentButton({ parts }: { parts: ShellParts }) {
  const { services: { s }, agentServer: { bar }, agent } = parts
  const connected = bar.status.kind === 'connected'
  if (parts.props.provider?.frame?.Agents) {
    return (
      <Button
        variant="quiet" size="small" onClick={() => agent.openSomewhere({ scope: ROOT_SCOPE, page: 'agents' })} data-testid="agent-glyph" data-guide="frame.agent" data-state={bar.status.kind}
        icon={<AgentIcon size={14} filled={connected} />}
      >
        {s('frame.agents')}
      </Button>
    )
  }
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
function helpEntries(parts: ShellParts): (MenuAct | MenuSpacer)[] {
  const { services: { s }, commands: { bus } } = parts
  const help = offered(HELP_MENU, 'web', { history: false, connect: false, scope: true, example: exampleOffered(parts) })
  const here: MenuAct = { label: s('frame.helpHere'), shortcut: 'F1', onSelect: () => bus.send({ type: 'manual', section: helpHere(parts) }) }
  const items: (MenuAct | MenuSpacer)[] = [here, ...help.flatMap((entry) => (entry.kind === 'item' ? [{ label: s(entry.label), onSelect: () => bus.send(entry.command), ...(entry.command.type === 'shortcuts' ? { shortcut: '?' } : entry.accelerator ? { shortcut: keyCap(entry.accelerator, isMac()) } : {}) }] : []))]
  if (!parts.hostMenu) {
    const open = (href: string) => () => parts.props.hostControls.openExternal(href)
    items.push({ line: true }, { label: s(DESKTOP_APP_LINK.label), onSelect: open(DESKTOP_APP_LINK.href) }, { label: s(WEBSITE_LINK.label), onSelect: open(WEBSITE_LINK.href), 'data-guide': 'shell.website' })
  }
  return items
}

/**
 * The ? in row one opens the help at this screen's place (`platform/helpPlaces.ts`),
 * as F1 does; Help beside it is the whole help, the keys and the ways out.
 */
function HelpMenu({ parts }: { parts: ShellParts }) {
  const { services: { s }, commands: { bus } } = parts
  return (
    <>
      <IconButton
        label={s('frame.helpHere')} tip={`${s('frame.helpHere')} (F1)`} size="small" data-testid="frame-help-here" data-guide="frame.helpHere"
        onClick={() => bus.send({ type: 'manual', section: helpHere(parts) })}
      >
        <span aria-hidden="true" className="kit-help-press">?</span>
      </IconButton>
      <MenuButton label={s('frame.help')} variant="quiet" size="small" items={helpEntries(parts)} data-guide="frame.help" />
    </>
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
  // On a home the tree is what a person moves through, and the page beside it lists
  // this scope's views: the same names over it, changing at every press, read as
  // where you are (the owner, 7 November 2026). A page over a home keeps them.
  const views = facts?.kind === 'home' && !homeHere ? facts : undefined
  // The tabs the workspace draws for the same scope: a container diagram is a closer look at a landscape and a map
  // a reading of the sheet, neither a tab of its own.
  const tabs = (views?.views ?? []).filter((view, _at, all) => view.kind !== 'container' && !isSheetReading(view, all))
  return (
    <>
      <button type="button" className="kit-frame__tab" aria-current={homeHere ? 'page' : undefined} data-testid="frame-home" data-guide="frame.home" onClick={() => agent.openSomewhere({ scope: at, page: 'home' })}>
        {s('frame.home')}
      </button>
      {/* A home's views scroll, as a scope's tabs do, when the row has no room for them all. */}
      {tabs.length > 0 && (
        <div className="kit-frame__homeviews">
          {tabs.map((view) => (
        <button key={view.id} type="button" className="kit-frame__tab" data-testid={`frame-view-${view.id}`} onClick={() => agent.openSomewhere({ scope: at, page: viewPage(view.kind as DesignDiagram['kind']), id: view.id })}>
          {view.name}
        </button>
          ))}
        </div>
      )}
      {views?.onNewView && <HomeNewView parts={parts} at={at} onLandscape={views.onNewView} />}
    </>
  )
}

/** The + on a page over a home: the same question a scope's tabs ask, with the view then made as the scope opens on it. */
function HomeNewView({ parts, at, onLandscape }: { parts: ShellParts; at: ScopePath; onLandscape: () => void }) {
  const { services: { s }, organisation } = parts
  const [open, setOpen] = useState(false)
  const made = (kind: 'sheet' | 'map' | 'technology' | 'chart' | 'conway') => () => organisation.open(at, { page: 'make', kind })
  return (
    <>
      <IconButton label={s('frame.newView')} size="small" data-testid="frame-new-view" onClick={() => setOpen(true)}>+</IconButton>
      <NewViewDialog
        open={open} canDraw={Boolean(parts.props.provider?.drawingOrigin?.())} onClose={() => setOpen(false)}
        make={{ landscape: onLandscape, sheet: made('sheet'), map: made('map'), technology: made('technology'), chart: made('chart'), conway: made('conway') }}
        onMakeDrawing={(name) => { setOpen(false); organisation.open(at, { page: 'make', kind: 'drawing', name }) }} s={s}
      />
    </>
  )
}

function RowTwoEnd({ parts, at, page }: { parts: ShellParts; at: ScopePath; page: Page | undefined }) {
  const { services: { s }, agent } = parts
  const go = agent.openSomewhere
  const more: MenuEntry[] = [
    ...ORGANISATION_PLACES.map((one) => ({ label: s(one.label), checked: placeShows(one, page), onSelect: () => go({ scope: ROOT_SCOPE, page: one.page }) })),
    { line: true },
    ...MORE_PLACES.map((one) => ({ label: s(one.label), checked: page === one.page, onSelect: () => go({ scope: HOME_PAGES.includes(one.page) ? at : ROOT_SCOPE, page: one.page }) })),
  ]
  const shows = (one: FramePlace) => (one.page === 'documentation' ? page === 'document' || page === 'documentation' : page === one.page)
  // The places go from the end when the row runs out, into the More beside them: never out of reach, never off the window.
  const { folded: gone, anchor } = useRowFold(SCOPE_PLACES.length, `${parts.services.prefs.textSize} ${parts.services.prefs.language}`)
  const kept = SCOPE_PLACES.slice(0, SCOPE_PLACES.length - gone)
  const foldedPlaces: MenuEntry[] = SCOPE_PLACES.slice(SCOPE_PLACES.length - gone).map((one) => (
    { label: s(one.label), checked: shows(one), 'data-testid': `frame-page-${one.page}`, onSelect: () => go({ scope: at, page: one.page } as Destination & { scope: string }) }
  ))
  return (
    <>
      {/* While a place is left to fold, the views keep their width and the places go into More first (`data-row-folds`). */}
      <span ref={anchor} hidden data-row-folds={kept.length > 0 || undefined} />
      {kept.map((one) => (
        <button
          key={one.page} type="button" className="kit-frame__tab" aria-current={shows(one) ? 'page' : undefined} data-testid={`frame-page-${one.page}`}
          onClick={() => go({ scope: at, page: one.page } as Destination & { scope: string })}
        >
          {s(one.label)}
        </button>
      ))}
      <MenuButton label={s('frame.more')} variant="quiet" size="small" items={foldedPlaces.length > 0 ? [...foldedPlaces, { line: true }, ...more] : more} data-guide="frame.more" />
    </>
  )
}

const NO_BANDS: readonly StackedBand[] = []

/** Never two bands: the agent first, since it is changing what is on screen, then what the screen itself says. */
/** Mounted only while a finding is being carried, and it reads every finding: not in the first download. */
const FindingBandStack = lazyPart<ComponentProps<typeof FindingBandShape>>(() => import('./FindingBand').then((held) => held.FindingBandStack))

function FrameBands({ parts, facts }: { parts: ShellParts; facts: ScreenFacts | undefined }) {
  const agent = useAgentBand(parts, facts)
  const visit = useVisitBand(parts)
  const source = parts.props.provider?.frame?.bands?.(parts.agent.openSomewhere) ?? NO_BANDS
  const sourceKey = source.map((band) => band.id).join()
  const bands = useMemo<StackedBand[]>(() => [...(agent ? [agent] : []), ...(visit ? [visit] : []), ...source, ...(facts?.bands ?? [])], [agent, visit, sourceKey, facts?.bands])
  const { frame } = parts
  const walk = useFrameState(frame).finding
  if (walk) return <FindingBandStack walk={walk} frame={frame} parts={parts} others={bands} />
  return <BandStack bands={bands} />
}

/**
 * On every screen of the example: nothing here is kept, and the two ways out —
 * or, once *Keep* would file it under an organisation that holds work, that
 * said before anything is written, with what stays behind.
 */
function useVisitBand(parts: ShellParts): StackedBand | undefined {
  const { services: { s } } = parts
  const visiting = parts.props.visiting
  return useMemo(() => (visiting?.asking ? {
    id: 'example', tone: 'looking',
    // The decision in bold, what follows from it in the band's plain detail.
    title: <span data-testid="example-keep-question">{s('example.keepAsk')}</span>,
    detail: <span data-testid="example-keep-detail">{s('example.keepAskDetail')}</span>,
    action: (
      <>
        <Button size="small" variant="primary" onClick={visiting.asking.onKeep} data-testid="example-keep-under">{s('example.keepUnder')}</Button>
        <Button size="small" variant="quiet" onClick={visiting.asking.onCancel} data-testid="example-keep-not">{s('example.keepNot')}</Button>
      </>
    ),
  } : visiting ? {
    id: 'example', tone: 'looking',
    title: <span data-testid="example-band">{s('example.band')}</span>,
    action: (
      <>
        <Button size="small" variant="primary" onClick={visiting.onKeep} data-testid="example-keep" data-guide="example.keep">{s('example.keep')}</Button>
        <Button size="small" variant="quiet" onClick={visiting.onLeave} data-testid="example-leave" data-guide="example.leave">{s('example.leave')}</Button>
      </>
    ),
  } : undefined), [visiting, s])
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
