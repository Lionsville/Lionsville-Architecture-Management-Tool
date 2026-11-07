// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent at the shell (ADR-0019): where the app is, moving it, and the
 * driving session with its Stop. Which of the organisation screen's two pages
 * is up is the one fact about that screen the shell has to hold, because an
 * agent may ask for either and may ask where it stands.
 *
 * And the window's history (ADR-0033), because it is made of the same two
 * things: the look at the screen after every move, and `openFor`, the one way
 * a destination is opened — by an agent, by a provider's chrome, and by Back.
 */
import { readFinding, writeFinding } from '../agent/place'
import type { CheckKey } from '../model/checkCatalogue'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Translate } from '../i18n'
import { viewFacetsOf } from '../agent/place'
import type { Place } from '../agent/place'
import { arrived, FRAME_PAGES, HOME_PAGES, isFramePanel, isPageTab, landed, scopeOf, VIEW_PAGES, viewFor, viewPage } from '../agent/screen'
import type { DesignDiagram } from '../model/types'
import type { PeopleView } from '../agent/people'
import type { ScopesView } from '../agent/scopeTree'
import type { Destination, FramePanel, MovedBy, Page, Screen } from '../agent/screen'
import type { FrameState, FrameStore } from './frame/frameStore'
import { boardsDrawing } from '../model'
import type { TreeView } from '../agent/tree'
import type { AgentServerStatus } from '../platform/agentServer'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSnapshot } from '../projects/scope'
import { ROOT_SCOPE, scopePathLabel } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import type { InitialPage, SourceOpen } from './App'
import { initialPageFor } from './bootLanding'
import type { OpenEnds } from './useShellNavigation'
import { useAgentShell } from './useAgentShell'
import type { WorkspaceAgentView } from './useAgentShell'
import { landingFor } from './placeLanding'
import { usePlaceHistory } from './usePlaceHistory'
import type { Notify } from './useToasts'

export type OrgPage = 'register' | 'technologyRegister' | 'people' | 'checks' | 'topics' | 'blocks'

/**
 * What the shell asks of the organisation screen: one of its pages, or the
 * home itself with none over it. With a nonce, because the same thing
 * asked for twice is two requests and a prop that did not change is none.
 * `select` is the person the People page picks, where one was asked for:
 * not part of the place, as an element selected on a view is not.
 */
export type OrgPageRequest = {
  page: OrgPage | 'home'; nonce: number; select?: string
  /** On the Checks page, the finding to come back to under the check picked. */
  finding?: string
  /** The tab a request lands on, where a page with tabs is asked for by a way in to one of them. */
  tab?: string
  /** On a block's page, the scope whose evaluation to open on (ADR-0043). */
  evaluation?: string
  /** Opened from another screen — a reader, a reference — so closing it goes back there (ADR-0033), not to the register. */
  returns?: true
}

/** Where a failure goes when the caller gave nowhere: a history that cannot say where a place lands still opens it. */
const NOBODY = () => {}

export type ShellAgent = ReturnType<typeof useShellAgent>

export function useShellAgent(deps: {
  gateway: AgentGateway | undefined
  status: AgentServerStatus
  tree: TreeView
  project: ScopeSnapshot | undefined
  home: ScopePath
  /** What the home that is up is called, where the listing names it. */
  homeName: string | undefined
  organisationName: string
  goHome: (to: ScopePath) => void
  openScopeAt: (path: ScopePath, page?: InitialPage, ends?: OpenEnds) => void
  notify: Notify
  s: Translate
  /**
   * Keep {@link ShellAgent}'s `screen` as the screen moves, for a source
   * provider's chrome to be handed. Off where no provider draws one, which is
   * every build in this repository: nobody then pays a render per move. The
   * look itself is taken either way, because the history needs it (ADR-0033):
   * a screen and a place compared, which costs nothing worth saving.
   */
  watchScreen?: boolean
  /** The organisation screen's page the first paint opens over the home, where the address named one. */
  initialHomePage?: OrgPage
  /** The record the address picked on that page. */
  initialPick?: string
  /** Somewhere to say that where a place in the history lands could not be worked out. */
  report?: (cause: unknown) => void
  /** The people register, lent to the agent (ADR-0036 §13). */
  people?: PeopleView
  /** The tree of scopes, lent to the agent (ADR-0040 §3). */
  scopes?: ScopesView
  /** What the frame holds beside the screen: its panel, and the tab of the page that is up. */
  frame?: FrameStore
  /** The window's preferences, an address and an agent asking for them. */
  openPreferences?: () => void
  /** One of the frame's own places the address named, opened once as the app comes up. */
  initialFramePage?: 'work' | 'activity' | 'settings' | 'preferences'
  /** The tab and the look of the page the address arrived on: what the frame holds for it. */
  initialPageLook?: { page: Page; tab?: string; look?: string }
}) {
  const { gateway, status, tree, project, home, homeName, organisationName, goHome, openScopeAt, notify, s } = deps
  const watchScreen = deps.watchScreen ?? false
  const report = deps.report ?? NOBODY
  const { orgPage, orgRecord, setOrgPage } = useOrgPage()
  const [orgPageRequest, setOrgPageRequest] = useState<OrgPageRequest | undefined>(
    () => (deps.initialHomePage ? { page: deps.initialHomePage, nonce: 1, ...(deps.initialPick !== undefined ? { select: deps.initialPick } : {}) } : undefined),
  )
  /**
   * A home is opened as itself: the home asked for, and the page over it said
   * every time — closed for `home` — because the screen may be up with a page
   * open over its cards, and a move to the home that left that page up would
   * not have arrived where it was sent.
   */
  const homeAt = useCallback((scope: ScopePath, page: OrgPage | 'home', select?: string, evaluation?: string, returns?: true, finding?: string) => {
    goHome(scope)
    const picks = page === 'people' || page === 'checks' || page === 'topics' || page === 'blocks' || page === 'register'
    setOrgPageRequest((prev) => ({
      page, nonce: (prev?.nonce ?? 0) + 1, ...(picks && select !== undefined ? { select } : {}),
      ...(page === 'blocks' && evaluation !== undefined ? { evaluation } : {}),
      ...(returns ? { returns } : {}),
      ...(finding !== undefined ? { finding } : {}),
    }))
  }, [goHome])
  /** A building block's page over the organisation's home, on a scope's evaluation where one is named (ADR-0043 §8). */
  const openBlock = useCallback((block: string, evaluation?: string) => homeAt(ROOT_SCOPE, 'blocks', block, evaluation, true), [homeAt])
  // A request is for the screen that is up. Once a scope is open that screen
  // is gone, and the home that comes back later — by a crumb, or a scope with
  // nothing to show — comes back as itself, not with the page last asked for.
  useEffect(() => { if (project) setOrgPageRequest(undefined) }, [project])
  const agentSessionRef = useRef<WorkspaceAgentView | undefined>(undefined)
  /** The screen the last look found: what an open that ends on a home compares that home with. */
  const lastLook = useRef<Screen | undefined>(undefined)
  const { frame } = deps
  const screenNow = useCallback(
    (): Screen => inFrame(screenOf(agentSessionRef.current, project, { home, homeName, organisationName, orgPage, orgRecord }), frame),
    [project, home, homeName, organisationName, orgPage, orgRecord, frame],
  )
  /** The element selected on the view on screen, where one is: what a link selects again (ADR-0033, amended). */
  const selectedNow = useCallback(() => agentSessionRef.current?.renderer?.selected?.(), [])
  /** The open scope's session, as the workspace registered it: what leaving writes its part through. */
  const openSession = useCallback(() => agentSessionRef.current, [])
  /**
   * Open a destination; `nothing` is told where the open ended without
   * moving the app — nothing there to open, a scope that could not be read,
   * or a fallback onto the home that was already up with nothing over it.
   */
  const openPreferences = useRef(deps.openPreferences)
  openPreferences.current = deps.openPreferences
  const openFor = useCallback((to: Destination & { scope: string }, nothing: () => void = NOBODY) => {
    if (to.page !== undefined && FRAME_PAGES.includes(to.page)) {
      openInFrame(to.page, to.scope === (project?.path ?? home) ? undefined : () => homeAt(to.scope, 'home'), frame, openPreferences.current)
      return
    }
    const listPage = holdInFrame(frame, to)
    const record = to.page === 'people' ? to.id ?? to.select : undefined
    if (to.page !== undefined && HOME_PAGES.includes(to.page)) {
      // The Checks page picks the check its id names; the People page the person in the frame, set above.
      homeAt(to.scope, listPage as OrgPage | 'home', to.page === 'checks' || to.page === 'topics' || to.page === 'blocks' ? to.id : to.page === 'people' ? record : to.select, undefined, undefined, to.page === 'checks' ? to.select : undefined)
      return
    }
    const open = agentSessionRef.current
    if (project && project.path === to.scope && open) {
      // A view's page with no id opens the one of its kind that is there, and
      // the scope's home where there is none: an open never makes a view.
      if (to.page !== undefined && VIEW_PAGES.includes(to.page)) {
        const id = viewFor(to.page, to.id, open.current().diagrams, open.activeDiagramId())
        if (id === undefined) { homeAt(to.scope, 'home'); return }
        open.show({ ...to, id })
        return
      }
      open.show(to)
      return
    }
    // Where it lands on the home, the home as itself, as above.
    openScopeAt(to.scope, initialPageFor(to), {
      home: (path) => {
        const before = lastLook.current
        if (before !== undefined && arrived(before, { page: 'home' }, path)) nothing()
        homeAt(path, 'home')
      },
      nothing,
    })
  }, [homeAt, project, home, openScopeAt, frame])
  /**
   * The window's history (ADR-0033): every look below is handed to it, so a
   * move to another place is a step whoever made it, and Back opens the place
   * before through `openFor`, the way `app.open` is answered. Where a place
   * lands when it is not there any more is asked of the tree the shell holds,
   * and of the open session for the scope that is open.
   */
  const nearest = useCallback(async (place: Place) => {
    const near = await landingFor(place, tree, (path) => {
      const held = agentSessionRef.current
      return held && project?.path === path ? { model: held.current(), ancestorDecisions: held.ancestorDecisions() } : undefined
    }, report)
    // Back to a place that is gone lands on the nearest one, and says so (ADR-0033).
    if (near.page !== place.page || near.id !== place.id || near.scope !== place.scope) notify(s('shell.placeGone'), 'info')
    return near
  }, [tree, project, report, notify, s])
  const lookAtPlace = usePlaceHistory({ open: openFor, nearest, failed: report })
  /**
   * Where the app is, as `app.current` says it (ADR-0019), held as state so a
   * provider's chrome is drawn again when it moves — `screenNow` is read at
   * call time and moves nothing.
   *
   * Looked at again whenever what the shell holds about it changes (the scope,
   * the home, the home's page) and whenever the workspace registers its view,
   * which it does again when the page over the canvas or the view on show
   * changes. A look that finds the same screen keeps the one already held, so
   * a registration that moved nothing draws nothing.
   */
  const [where, setWhere] = useState<{ screen: Screen; by: MovedBy } | undefined>(
    () => (watchScreen ? { screen: screenNow(), by: 'person' } : undefined),
  )
  /**
   * Whether the move being looked at is an agent's ({@link MovedBy}): its
   * `app.open` raised the first, and the second is whether its driving session
   * is up — both read when the look is taken, which is after the render the
   * move caused.
   */
  const agentOpened = useRef(false)
  const agentDriving = useRef(false)
  /**
   * A move a provider said was its own (`SourceOpen`'s `by: 'provider'`):
   * where it sent the app. Every screen the app shows in that scope is the
   * provider's until the app lands where it was sent (`landed`) and the page
   * there has settled on what it shows, and a screen in any other scope lets
   * it go — that move was somebody else's.
   */
  const providerMove = useRef<ProviderMove | undefined>(undefined)
  const shown = useRef(where)
  const lookAgain = useCallback(() => {
    const next = screenNow()
    lastLook.current = next
    lookAtPlace(next)
    if (!watchScreen) return
    const same = shown.current !== undefined && JSON.stringify(shown.current.screen) === JSON.stringify(next)
    const theirs = lookWithMark(providerMove, next, same, agentSessionRef.current?.settled() ?? true)
    if (same) return
    const by: MovedBy = theirs ? 'provider' : agentOpened.current || agentDriving.current ? 'agent' : 'person'
    shown.current = { screen: next, by }
    setWhere(shown.current)
  }, [watchScreen, screenNow, lookAtPlace])
  useEffect(lookAgain, [lookAgain])
  // Through a ref, so registering the view does not change identity with the
  // screen: the workspace re-registers whenever this function changes.
  const lookAgainRef = useRef(lookAgain)
  lookAgainRef.current = lookAgain
  /**
   * The same move, for a source provider's own chrome and its own menu lines
   * ({@link SourceOpen}).
   *
   * `openFor` wants a scope because the agent has already resolved one by the
   * time it calls, and a provider has not: a notice that says *open the board*
   * is usually about the scope the person is looking at. So the one word that
   * can be left out is filled in here the way `app.open` fills it in — the scope
   * that is open, and with nothing open the home that is up — and everything
   * after that is the one path the agent takes.
   */
  const openSomewhere = useCallback<SourceOpen>((to, options) => {
    const sent = { ...to, scope: to.scope ?? project?.path ?? home }
    if (options?.by !== 'provider') { openFor(sent); return }
    const move = movesTheApp(screenNow(), sent, agentSessionRef.current) ? { to: sent, reached: false } : undefined
    providerMove.current = move
    // An open that ends having moved nothing leaves no mark on the next move
    // somebody else makes, as one to where the app already is leaves none.
    openFor(sent, () => { if (move !== undefined && providerMove.current === move) providerMove.current = undefined })
  }, [openFor, project, home, screenNow])
  // Said by the frame's band, which stays until it is dismissed, rather than by a toast that goes.
  const agentStopped = useCallback(() => {}, [])
  const agentOpen = useCallback((to: Destination & { scope: string }) => {
    agentOpened.current = true
    // An agent's move after a provider's is the agent's, wherever it goes.
    providerMove.current = undefined
    openFor(to)
  }, [openFor])
  const agentShell = useAgentShell({ gateway, status, tree, people: deps.people, scopes: deps.scopes, screen: screenNow, open: agentOpen, onStopped: agentStopped, translate: deps.s })
  const driving = agentShell.driving.session !== undefined
  agentDriving.current = driving
  // A session that ends — Stop, `session.end`, the client gone — may end in the
  // same render as the move it made last: that move is looked at as the agent's
  // before the mark is let go, and every move after it is the person's.
  useEffect(() => {
    if (driving) return
    agentDriving.current = true
    lookAgainRef.current()
    agentDriving.current = false
    agentOpened.current = false
  }, [driving])
  const setPanel = useFrameMoves(frame, deps.initialFramePage, openFor, project?.path ?? home, lookAgainRef, deps.initialPageLook)
  const registerAgent = agentShell.register
  const registerAgentSession = useCallback((view: WorkspaceAgentView | undefined) => {
    agentSessionRef.current = view
    registerAgent(view)
    // Only a view arriving: the workspace lets its view go before handing a
    // new one over, and a look in between would be a different screen every
    // time — a new value, a render, a new view, for ever. Leaving for good
    // moves the scope, which the effect above looks at.
    if (view) lookAgainRef.current()
  }, [registerAgent])
  return {
    orgPageRequest, setOrgPage, openSomewhere, openBlock, driving: agentShell.driving, stop: agentShell.stop, registerAgentSession,
    screen: where?.screen, movedBy: where?.by ?? 'person', screenNow, selectedNow, openSession, setPanel,
    lookAgain: useCallback(() => lookAgainRef.current(), []),
  }
}

/**
 * A provider's move under way: where it sent the app, and whether the app has
 * landed there while the page it landed on was still picking what to show.
 */
type ProviderMove = { readonly to: Destination & { scope: string }; reached: boolean }

/**
 * A look at the screen while a provider's move may be under way: is the
 * screen the provider's, and is the move over.
 *
 * A screen in another scope is somebody else's, and so is a screen off the
 * destination once the app had landed on it. On the destination the move is
 * over once the page there has settled: a record's page names the record
 * asked for until it has picked one, and what it picks — the newest
 * observation, the first decision, the tab that is up — is the provider's
 * too. A look that finds the screen as it was labels nothing, but a page that
 * was seen picking may have settled on what it already showed, and then the
 * move is over all the same: the person's next move on that page is theirs.
 */
function lookWithMark(mark: { current: ProviderMove | undefined }, next: Screen, same: boolean, settled: boolean): boolean {
  const move = mark.current
  if (move === undefined) return false
  const on = landed(next, move.to)
  if (same) {
    if (on && !settled) move.reached = true
    else if (on && move.reached) mark.current = undefined
    return false
  }
  if (on && settled) mark.current = undefined
  else if (on) move.reached = true
  const theirs = scopeOf(next) === move.to.scope && (on || !move.reached)
  if (!theirs) mark.current = undefined
  return theirs
}

/**
 * Will a provider's move change what is on screen? A destination the app is
 * already at moves nothing, and a move that moves nothing must not leave its
 * mark on the next move somebody else makes. Most pages say on the screen
 * whether they are up (`arrived`); in the scope that is open, three kinds are
 * judged on what the open will do instead. A view's page is resolved first,
 * as `openFor` resolves it: the view it names or the one of its kind there
 * is, and the scope's home where there is none, which from an open scope is
 * always a move. A record's page asked for again picks again — the record
 * asked for, the newest observation, the first decision — so it is always a
 * move, over once the page has settled. An element and a document are not on
 * the screen's face: it is whether a page over the view closes, or — for an
 * element — whether another board comes up to show it.
 */
function movesTheApp(screen: Screen, to: Destination & { scope: string }, open: WorkspaceAgentView | undefined): boolean {
  if (screen.open?.path !== to.scope || !open) return !arrived(screen, to, to.scope)
  if (to.page !== undefined && VIEW_PAGES.includes(to.page)) {
    const id = viewFor(to.page, to.id, open.current().diagrams, open.activeDiagramId())
    return id === undefined || !arrived(screen, { ...to, id }, to.scope)
  }
  if (to.page === 'decisions' || to.page === 'observations') return true
  const silent = to.page === 'element' || to.page === 'document' || to.page === 'documentation'
  if (!silent) return !arrived(screen, to, to.scope)
  if (screen.page !== undefined) return true
  if (to.page !== 'element' || to.id === undefined) return false
  const boards = boardsDrawing(open.current(), to.id)
  return boards.length === 1 && boards[0].id !== open.activeDiagramId()
}

/** Which of a home's pages is up, as it says, and the record on it. */
function useOrgPage() {
  const [orgPage, setOrgPageNow] = useState<OrgPage | undefined>(undefined)
  const [orgRecord, setOrgRecord] = useState<string | undefined>(undefined)
  const setOrgPage = useCallback((page: OrgPage | undefined, record?: string) => { setOrgPageNow(page); setOrgRecord(record) }, [])
  return { orgPage, orgRecord, setOrgPage }
}

/**
 * The frame's own places move nothing but what they say: over the scope you
 * are in, and over the home of the scope named where that is another.
 */
function openInFrame(page: Page, leave: (() => void) | undefined, frame: FrameStore | undefined, preferences: (() => void) | undefined): void {
  leave?.()
  if (isFramePanel(page)) frame?.set({ panel: page })
  else if (page === 'settings') frame?.set({ asks: 'settings' })
  else preferences?.()
}

/**
 * What an address asked of the frame itself, once as the app comes up; a panel
 * or a tab that moved, which is a place of its own, so Back shuts it and a
 * reload keeps it; and the press that opens or shuts a panel.
 */
function useFrameMoves(
  frame: FrameStore | undefined, initial: 'work' | 'activity' | 'settings' | 'preferences' | undefined,
  openFor: (to: Destination & { scope: string }) => void, here: ScopePath, lookAgain: { current: () => void },
  arrivedOn?: { page: Page; tab?: string; look?: string },
) {
  const asked = useRef(initial)
  // A page opened by its address on a tab, or on what it looks at: held here from the first look, since the page reads it from here.
  useState(() => {
    if (frame && arrivedOn) frame.set({ tab: arrivedOn.tab, look: arrivedOn.look, tabOf: arrivedOn.page })
    return undefined
  })
  useEffect(() => {
    const page = asked.current
    if (page === undefined) return
    asked.current = undefined
    openFor({ scope: here, page })
  }, [openFor, here])
  useEffect(() => {
    if (!frame) return undefined
    let { panel, tab, look, list, pick, finding, lookOf, lookDay, facets, colour, day } = frame.get()
    return frame.subscribe(() => {
      const now = frame.get()
      if (now.panel === panel && now.tab === tab && now.look === look && now.list === list && now.pick === pick && now.finding === finding && now.lookOf === lookOf && now.lookDay === lookDay && now.facets === facets && now.colour === colour && now.day === day) return
      ({ panel, tab, look, list, pick, finding, lookOf, lookDay, facets, colour, day } = now)
      lookAgain.current()
    })
  }, [frame, lookAgain])
  return useCallback((panel: FramePanel | undefined) => { frame?.set({ panel }) }, [frame])
}

/** What a destination says of the view it opens, beyond which view: nothing for a page, or a view with no id to keep it under. */
function facetsOf(to: Destination): FrameState['facets'] {
  if (to.id === undefined || to.page === undefined || !VIEW_PAGES.includes(to.page)) return undefined
  return viewFacetsOf(to, to.id)
}

/** A view with what the frame keeps of it laid over it, where that is this view's. */
function viewInFrame(open: NonNullable<Screen['open']>, held: FrameState): NonNullable<Screen['open']> {
  const { view } = open
  const said = held.facets
  if (!view || said?.of !== view.id) return open
  return {
    ...open,
    view: {
      ...view,
      ...(said.tab !== undefined ? { tab: said.tab } : {}), ...(said.group !== undefined ? { group: said.group } : {}), ...(said.pair !== undefined ? { pair: said.pair } : {}),
    },
  }
}

/**
 * What a destination says that the frame keeps: its panel, its tab, what its list
 * shows and the record picked there, and a finding being carried. Answers the page
 * it lands on, since the technology register's address is the register, on its tab.
 */
function holdInFrame(frame: FrameStore | undefined, to: Destination): Destination['page'] {
  const merged = to.page === 'technologyRegister'
  const listPage = merged ? 'register' : to.page
  const tab = merged ? to.tab ?? 'services' : to.tab
  const pick = (to.page === 'register' || merged) ? to.id ?? to.select : to.page === 'checks' ? to.id : undefined
  // A person is the People page's record, by the path or by the shell's own *Open in People*.
  const record = to.page === 'people' ? to.id ?? to.select : undefined
  const carried = to.finding !== undefined ? readFinding(to.finding) : undefined
  if (carried) frame?.set({ finding: { home: carried.home, check: carried.check as CheckKey, id: carried.id } })
  const readsDay = to.day !== undefined && to.day !== 'today' && (to.page === 'sheet' || to.page === 'map')
  frame?.set({
    panel: to.panel, tab, look: to.look, tabOf: tab === undefined && to.look === undefined ? undefined : listPage,
    record, recordOf: record === undefined ? undefined : 'people',
    facets: facetsOf(to),
    list: to.list, pick, listOf: to.list !== undefined || pick !== undefined ? listPage : undefined,
    // A sheet and a map read a dated day themselves (`usePlaceReading`); anything else is the window's look.
    colour: to.colour, day: readsDay ? to.day : undefined, readingOf: to.colour !== undefined || readsDay ? to.id : undefined,
    ...(to.day !== undefined && !readsDay ? { asksLook: { ...(to.id !== undefined ? { view: to.id } : {}), day: to.day } } : {}),
  })
  return listPage
}

/** The screen with what the frame holds laid over it: its panel, a tab the page keeps there, and what the view keeps there. */
function inFrame(screen: Screen, frame: FrameStore | undefined): Screen {
  const held = frame?.get()
  if (!held) return screen
  const page = screen.page
  // A view may have readings as a page has tabs, and they go in its address the same way.
  const view = screen.open?.view
  const reading = !page && view && isPageTab(held.tabOf, held.tab) && held.tabOf === viewPage(view.kind as DesignDiagram['kind']) ? held.tab : undefined
  const tab = page && held.tabOf === page.page && !('tab' in page && page.tab !== undefined) && isPageTab(page.page, held.tab) ? held.tab : undefined
  const look = page && held.tabOf === page.page ? held.look : undefined
  const record = page?.page === 'people' && held.recordOf === 'people' ? held.record : undefined
  const listed = page && held.listOf === page.page
  const pick = listed && held.pick !== undefined ? held.pick : record
  const open = screen.open
  const looked = open?.view && held.lookOf === open.view.id && held.lookDay !== undefined
    ? { ...open, view: { ...open.view, day: held.lookDay } }
    : open
  const opened = looked && (page ? looked : readingIn(viewInFrame(looked, held), held))
  return {
    ...screen,
    ...(opened ? { open: reading !== undefined && opened.view ? { ...opened, view: { ...opened.view, tab: reading } } : opened } : {}),
    ...(page && (tab !== undefined || pick !== undefined || look !== undefined)
      ? { page: { ...page, ...(tab !== undefined ? { tab } : {}), ...(look !== undefined ? { look } : {}), ...(pick !== undefined ? { id: pick } : {}) } as Screen['page'] }
      : {}),
    ...(held.panel !== undefined ? { panel: held.panel } : {}),
    ...(listed && held.list ? { list: held.list } : {}),
    ...(held.finding ? { finding: writeFinding({ check: held.finding.check, home: held.finding.home, id: held.finding.id }) } : {}),
  }
}

/** How the view on screen is being read, as the frame holds it, on the screen and so in the address. */
function readingIn(open: NonNullable<Screen['open']>, held: FrameState): NonNullable<Screen['open']> {
  const view = open.view
  if (!view || held.readingOf !== view.id) return open
  return { ...open, view: { ...view, ...(held.colour !== undefined ? { colour: held.colour } : {}), ...(held.day !== undefined ? { day: held.day } : {}) } }
}

/** Where the app is, as the agent is told it: the scope that is open and its view and page, or the home. */
function screenOf(
  held: WorkspaceAgentView | undefined,
  project: ScopeSnapshot | undefined,
  at: { home: ScopePath; homeName: string | undefined; organisationName: string; orgPage: OrgPage | undefined; orgRecord: string | undefined },
): Screen {
  const { home, homeName, organisationName, orgPage, orgRecord } = at
  if (project && held) {
    const model = held.current()
    const active = model.diagrams.find((diagram) => diagram.id === held.activeDiagramId())
    const page = held.page()
    return {
      open: { path: project.path, name: model.name, ...(active ? { view: { id: active.id, name: active.name, kind: active.kind } } : {}) },
      ...(page ? { page } : {}),
    }
  }
  if (project) return { open: { path: project.path, name: project.model.name } }
  return {
    home: { path: home, name: home === ROOT_SCOPE ? organisationName : (homeName ?? scopePathLabel(home)) },
    ...(orgPage ? { page: (orgPage === 'blocks' && orgRecord !== undefined ? { page: orgPage, id: orgRecord } : { page: orgPage }) as Screen['page'] } : {}),
  }
}
