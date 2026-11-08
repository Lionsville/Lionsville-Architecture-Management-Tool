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
import useMediaQuery from '@mui/material/useMediaQuery'
import type { ComponentProps, ReactNode } from 'react'
import { SurfacePopover as Popover } from '../../widgets/kit/Surface'
import type { StringKey, Translate } from '../../i18n'
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
import { takesText } from '../helpKeys'
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
import { reasonIn } from '../messageFor'
import { lazyPart } from '../../widgets/lazyPart'
import type { FindingBandStack as FindingBandShape } from './FindingBand'
import { commandsTable, keyCap } from './commandsTable'
import { useRowFold } from '../../widgets/kit/useRowFold'
import { TextSizeControl, textSizeEntries } from '../../widgets/kit/TextSizeControl'
import { DEFAULT_TEXT_SIZE, TEXT_SIZES } from '../../platform/textSize'
import { useStrings } from '../../i18n/LanguageContext'
import type { CommandRow } from './commandsTable'
import { scopeLines, startsWords, viewLines } from './paletteFind'
import type { TreeView } from './paletteFind'
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
import type { KeyPress, MenuItemSpec, MenuNeed } from '../../platform/menu'
import { chordHeld, claimKey, commandKey, isMac, keyClaimed } from '../../widgets/kit/keys'


/** A window a phone gives: under it the row keeps the place, the word and ⋯, and the tree stands over the page. */
const PHONE = '(max-width: 600px)'

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
  // A phone has no room for the tree beside a home: it is the toggle's to bring, over the page. Asked here so a turn of the phone draws again.
  useMediaQuery(PHONE, { noSsr: true })
  const onHomeBare = treeAlwaysOn(parts, pageUp)
  const [sheetOpen, setSheetOpen] = useShortcutsSheet(parts)
  useExampleCommand(parts)
  useFrameKeys(parts, state)
  usePanelFocus(state.panel)
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
  useAgentDialogFollowsPlace(parts, placeKey(at, screen))
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
        <ShortcutsSheet open={sheetOpen} onClose={() => setSheetOpen(false)} rows={commandsTable(canOf(parts, facts), isMac() ? 'darwin' : 'other')} mac={isMac()} language={parts.services.prefs.language} s={s} />
      </PlaceReadingContext.Provider>
        </PlaceFacetsContext.Provider>
        </PlaceListContext.Provider>
      </PlaceTabContext.Provider>
    </FrameCommandsContext.Provider>
  )
}

/** A place worth coming back to is written down as it is arrived at, for *Continue*: a preference of this computer's. */
/**
 * The agent dialog belongs to the place it was opened on. An address that lands
 * on the agents page opens it over the home, and a person who then goes
 * anywhere else — Back, a link, a tab — has left it: it shuts rather than
 * staying over every page until Close is pressed.
 */
/** A place as one key: the scope, the page over it and the view open. */
function placeKey(at: ScopePath, screen: Screen): string {
  return `${at}\u0000${screen.page?.page ?? ''}\u0000${screen.open?.view?.id ?? ''}`
}

export function useAgentDialogFollowsPlace(parts: Pick<ShellParts, 'agentServer'>, place: string) {
  const { dialogOpen, closeDialog } = parts.agentServer
  const openedOn = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!dialogOpen) { openedOn.current = undefined; return }
    if (openedOn.current === undefined) { openedOn.current = place; return }
    if (openedOn.current !== place) closeDialog()
  }, [dialogOpen, place, closeDialog])
}

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

/** Every item the web's ⋯ can show with a key, whatever it would refuse now. */
const WEB_KEYED = [
  ...offered(FILE_MENU, 'web', { history: true, connect: true, scope: true, picture: true, example: true }).flatMap((entry) => (entry.kind === 'item' && entry.accelerator !== undefined ? [entry] : [])),
  PREFERENCES_ITEM,
]

/**
 * What one of the ⋯ menu's keys does, on a host with no menu bar to hear them:
 * the menu shows ⌘O, ⌘S, ⇧⌘O, ⇧⌘E and ⌘, on the web as well, and every one is
 * the app's in every state, so the browser's Open, Save Page As or Settings
 * never comes up over it. An item the menu would refuse now is not run and
 * says why where the menu does; while a dialog is up the key does nothing;
 * Save is left to a board's own keymap while one is up, so it saves once.
 * `undefined` is a key that is none of the menu's.
 */
export function menuKey(
  press: KeyPress, can: ReturnType<typeof canOf>, at: { boardUp: boolean; modal: boolean }, mac: boolean,
): { run?: MenuItemSpec['command']; refused?: StringKey } | undefined {
  const hit = WEB_KEYED.find((entry) => entry.accelerator !== undefined && acceleratorMatches(entry.accelerator, press, mac))
  if (!hit || (hit.command.type === 'save' && at.boardUp && !at.modal)) return undefined
  if (at.modal) return {}
  if (hit.needs?.some((need) => !(can as Partial<Record<MenuNeed, boolean>>)[need])) return hit.needs.includes('scope') && !can.scope ? { refused: 'menu.saveNothingOpen' } : { refused: 'menu.notNow' }
  return { run: hit.command }
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

/**
 * A panel opened from row one takes the focus, so the keyboard is where the
 * eye goes rather than sixty Tabs away, and gives it back to what opened it
 * when it shuts by its ×, as Escape already does. One an agent or an address
 * opened while the person was elsewhere leaves their focus alone.
 */
function usePanelFocus(panel: string | undefined) {
  const opener = useRef<HTMLElement | null>(null)
  const was = useRef(panel)
  useEffect(() => {
    const before = was.current
    was.current = panel
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (panel !== undefined && before === undefined) {
      const fromRowOne = active === null || active === document.body || active.closest('[data-testid="shell-toolbar"]') !== null
      if (!fromRowOne) return
      opener.current = active
      document.querySelector<HTMLElement>('[data-testid="frame-panel"]')?.focus()
      return
    }
    if (panel === undefined && before !== undefined) {
      const back = opener.current
      opener.current = null
      const lost = active === null || active === document.body
      if (lost && back?.isConnected) back.focus()
    }
  }, [panel])
}

/** ⌘\ pins the tree and Esc shuts a panel before the page and the board; `?` and F1 are the shell's, on every screen (`helpKeys.ts`). */
function useFrameKeys(parts: ShellParts, state: FrameState) {
  const { frame } = parts
  const send = parts.commands.bus.send
  const hasPanel = state.panel !== undefined
  const boardUp = state.screen?.boardUp === true
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (commandKey(event) && event.key === '\\') {
        event.preventDefault()
        // Behind a dialog, or on a home where the tree is always open, it would flip what nobody sees.
        if (modalUp() || treeAlwaysOn(parts)) return
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
      // ⌘P over a board prints it through the picture's own paper, not the window around it.
      if (!parts.hostMenu && boardUp && commandKey(event) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'p' && !modalUp()) {
        event.preventDefault()
        send({ type: 'exportPicture' })
        return
      }
      if (!parts.hostMenu && chordHeld(event)) {
        const key = menuKey(event, canOf(parts, frame.get().screen), { boardUp, modal: modalUp() }, isMac())
        if (!key) return
        event.preventDefault()
        if (key.run) send(key.run)
        else if (key.refused) parts.services.toasts.notify(parts.services.s(key.refused), 'info')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [frame, send, boardUp, parts])
  usePanelEscape(parts, hasPanel)
  useScreenUndo(parts)
}

/**
 * Undo and Redo on a screen that is not a workspace: the home's own steps, such
 * as a scope's settings, which it says in its facts (`ScreenFacts.undo`). The
 * Edit menu's item reaches them as it reaches a session's stack in a workspace
 * (`useWorkspaceCommands`), a focused text field keeping its own; on the web
 * the frame's keys above run them by ⌘Z and ⌘Y.
 */
function useScreenUndo(parts: ShellParts) {
  const { frame } = parts
  const { bus } = parts.commands
  const hostControls = parts.props.hostControls
  useEffect(() => bus.on((command) => {
    if (command.type !== 'undo' && command.type !== 'redo') return
    const screen = frame.get().screen
    if (!screen || screen.kind === 'workspace' || hostControls.editInField(command.type)) return
    const step = command.type === 'undo' ? screen.undo : screen.redo
    if (step?.can) step.run()
    else parts.services.toasts.notify(parts.services.s(command.type === 'undo' ? 'shell.nothingToUndo' : 'shell.nothingToRedo'))
  }), [bus, frame, hostControls, parts.services])
}

/**
 * Esc shuts the panel, once whatever is further in has had it: heard on the
 * document as it bubbles, so a field, a menu or a popover inside has claimed
 * it first (`widgets/kit/keys.ts`), and before the page and the board, which
 * hear it on the window. From a field in the panel it leaves the field and
 * keeps the panel, so what was typed is not shut away with it; from a field
 * anywhere else it is that field's, and the panel stays.
 */
function usePanelEscape(parts: ShellParts, hasPanel: boolean) {
  useEffect(() => {
    if (!hasPanel) return undefined
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || keyClaimed(event) || modalUp() || document.querySelector('[role="menu"]')) return
      const target = event.target instanceof HTMLElement ? event.target : null
      const typing = target !== null && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      const panel = target?.closest<HTMLElement>('[data-testid="frame-panel"]') ?? null
      if (typing && !panel) return
      claimKey(event)
      if (typing && target) {
        target.blur()
        panel?.focus({ preventScroll: true })
        return
      }
      parts.agent.setPanel(undefined)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [parts, hasPanel])
}

/**
 * Every view of the tree by name, for ⌘K. The index reads no view, so the
 * scopes that hold one are read the first time something is asked, as
 * `views.list` reads them, and again only once the tree has moved.
 */
function useTreeViews(parts: ShellParts): { views: readonly TreeView[]; want: () => void } {
  const { organisation: { tree }, writes: { readScope }, services: { failed } } = parts
  const [held, setHeld] = useState<{ of: ScopeSummary; views: readonly TreeView[] } | undefined>(undefined)
  const asked = useRef<ScopeSummary | undefined>(undefined)
  const want = useMemo(() => () => {
    if (asked.current === tree) return
    asked.current = tree
    const holding = flattenScopes(tree).filter((scope) => scope.diagrams > 0)
    Promise.all(holding.map(async (scope) => {
      const read = await readScope(scope.path)
      return (read?.model.diagrams ?? []).map((view): TreeView => ({ scope: scope.path, id: view.id, name: view.name, kind: view.kind }))
    }))
      .then((each) => { if (asked.current === tree) setHeld({ of: tree, views: each.flat() }) })
      .catch((failure: unknown) => { asked.current = undefined; failed('paletteViews', failure) })
  }, [tree, readScope, failed])
  return { views: held?.of === tree ? held.views : [], want }
}

function usePaletteLines(parts: ShellParts, at: ScopePath, go: ShellParts['agent']['openSomewhere']) {
  const { services: { s }, commands: { bus }, organisation, writable } = parts
  const { tree } = organisation
  const mayFile = writable(at)
  const latest = useRef(parts)
  latest.current = parts
  const { views, want } = useTreeViews(parts)
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
    // The frame's own acts, which are on no menu: the tree's key, and a scope filed under the one here.
    const mac = isMac()
    rows.push({ id: 'frame:tree', group: s('frame.commands'), label: s('frame.treeToggle'), keys: mac ? '⌘\\' : 'Ctrl \\', run: () => {
      const now = latest.current
      if (treeAlwaysOn(now)) return
      const pinned = !now.frame.get().pinned
      now.frame.set({ pinned })
      now.services.prefs.writePreference({ treePinned: pinned })
    } })
    if (mayFile) rows.push({ id: 'frame:newScope', group: s('frame.commands'), label: s('picker.newScope'), run: () => { go({ scope: at, page: 'home' }); organisation.addUnder(at) } })
    commandsTable(JSON.parse(canKey), mac ? 'darwin' : 'other').forEach((row: CommandRow) => {
      // Light, Dark and System are a menu's radio under Theme; on a line of their own they need the word, and a person types it.
      const label = row.command.type === 'theme' ? `${s('prefs.theme')}: ${s(row.label)}` : s(row.label)
      rows.push({ id: row.id, group: s('frame.commands'), label, ...(row.keys ? { keys: keyCap(row.keys, mac, language) } : {}), run: () => send(row.command) })
    })
    return (asked: string) => {
      if (asked.trim() === '') return rows
      want()
      const named = rows.filter((row) => matchesQuery(asked, [row.label])).map((row) => (startsWords(asked, row.label) ? { ...row, lead: true } : row))
      // A command whose name starts with the words leads a scope that only contains them: "light" is Theme: Light.
      return [
        ...named.filter((row) => row.lead),
        ...scopeLines(tree, asked, s('org.treeScopes'), go),
        ...viewLines(views, tree, asked, s('gsearch.kind.view'), go),
        ...named.filter((row) => !row.lead),
      ]
    }
  }, [s, at, go, send, canKey, hasAgentsPage, tree, views, want, organisation, mayFile])
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

function TreeFor({ parts, at, page, onDone, findFirst = false }: { parts: ShellParts; at: ScopePath; page: Page | undefined; onDone?: () => void; findFirst?: boolean }) {
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
      writable={writable} language={prefs.language} s={s} findFirst={findFirst}
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
        // It says it opens a dialog, so it is one, named; and it keeps its edge on a dark page beside a docked tree of the same colour.
        slotProps={{ paper: { role: 'dialog', 'aria-label': s('frame.switchScope'), className: 'kit-switcher__paper' } }}
      >
        {anchor && (
          <div className="kit-switcher" data-testid="scope-switcher">
            <TreeFor parts={parts} at={at} page={page} onDone={() => setAnchor(null)} findFirst />
            {parts.writable(at) && (
              <div className="kit-switcher__foot">
                <Button variant="quiet" size="small" onClick={() => { setAnchor(null); parts.agent.openSomewhere({ scope: at, page: 'settings' }) }}>{s('frame.settingsOf', { name })}</Button>
              </div>
            )}
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
      {/* A phone's row has no room for them: the browser has its own ‹ ›, and its ⌘Z is a menu away. */}
      <span className="kit-frame__steps"><BackForward s={s} /></span>
      <TreeToggle parts={parts} pinned={state.pinned} onHome={treeAlwaysOn(parts)} />
      <Trail parts={parts} at={at} name={name} />
      <div className="kit-frame__grow" />
      <FindField openSearch={facts?.openSearch} s={s} />
      <div className="kit-frame__grow" />
      {/* An editor has an undo of its own, for shapes; the model's here would take back the wrong thing. */}
      {!state.work && <span className="kit-frame__steps"><UndoRedo facts={facts} s={s} /></span>}
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

/** A home with no page over it docks the tree whatever the preference says — but on a phone, which has no room beside it. */
function treeAlwaysOn(parts: ShellParts, pageUp = (parts.agent.screen ?? parts.agent.screenNow()).page !== undefined): boolean {
  return !parts.nav.project && !pageUp && !(window.matchMedia?.(PHONE).matches ?? false)
}

/**
 * A home always shows the tree, so there the toggle would flip a preference
 * nobody sees until the next view: it shows as pressed and says why it does
 * nothing, and ⌘\ is left alone there too (`useFrameKeys`).
 */
function TreeToggle({ parts, pinned, onHome }: { parts: ShellParts; pinned: boolean; onHome: boolean }) {
  const { frame, services: { s, prefs } } = parts
  const label = s('frame.treeToggle')
  return (
    <IconButton
      label={label} size="small" pressed={onHome || pinned} data-testid="frame-tree-toggle" data-guide="frame.tree"
      reason={onHome ? s('frame.treeOnHome') : undefined}
      tip={`${label} (${isMac() ? '⌘\\' : 'Ctrl \\'})`}
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
  const items: (MenuAct | MenuSpacer)[] = [...help.flatMap((entry) => (entry.kind === 'item' ? [{ label: s(entry.label), onSelect: () => bus.send(entry.command), ...(entry.command.type === 'shortcuts' ? { shortcut: '?' } : entry.accelerator ? { shortcut: keyCap(entry.accelerator, isMac(), parts.services.prefs.language) } : {}) }] : []))]
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
        onClick={() => bus.send({ type: 'manualHere' })}
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
  const { services: { s, toasts } } = parts
  const visiting = parts.props.visiting
  // The keep reads the visit from where it is held, so what the open scope has
  // not written yet — the change of a moment ago — is written first, or it is
  // left behind with nothing said. A write that fails keeps nothing, and says why.
  const flushing = useRef(parts.provider.openScope)
  flushing.current = parts.provider.openScope
  const afterWrites = useMemo(() => (keep: () => void) => () => {
    void (flushing.current?.flush?.() ?? Promise.resolve()).then(keep, (cause: unknown) => {
      toasts.notify(s('example.keepUnwritten', { reason: reasonIn(cause, s) }), 'error')
    })
  }, [toasts, s])
  return useMemo(() => (visiting?.asking ? {
    id: 'example', tone: 'looking',
    // The decision in bold, what follows from it in the band's plain detail.
    title: <span data-testid="example-keep-question">{s('example.keepAsk')}</span>,
    detail: <span data-testid="example-keep-detail">{s('example.keepAskDetail')}</span>,
    action: (
      <>
        <Button size="small" variant="primary" onClick={afterWrites(visiting.asking.onKeep)} data-testid="example-keep-under">{s('example.keepUnder')}</Button>
        <Button size="small" variant="quiet" onClick={visiting.asking.onCancel} data-testid="example-keep-not">{s('example.keepNot')}</Button>
      </>
    ),
  } : visiting ? {
    id: 'example', tone: 'looking',
    title: <span data-testid="example-band">{s('example.band')}</span>,
    action: (
      <>
        <Button size="small" variant="primary" onClick={afterWrites(visiting.onKeep)} data-testid="example-keep" data-guide="example.keep">{s('example.keep')}</Button>
        <Button size="small" variant="quiet" onClick={visiting.onLeave} data-testid="example-leave" data-guide="example.leave">{s('example.leave')}</Button>
      </>
    ),
  } : undefined), [visiting, s, afterWrites])
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
