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
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Translate } from '../i18n'
import type { Place } from '../agent/place'
import type { Destination, MovedBy, Screen } from '../agent/screen'
import type { TreeView } from '../agent/tree'
import type { AgentServerStatus } from '../platform/agentServer'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSnapshot } from '../projects/scope'
import { ROOT_SCOPE, scopePathLabel } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import type { InitialPage, SourceOpen } from './App'
import { initialPageFor } from './bootLanding'
import { useAgentShell } from './useAgentShell'
import type { WorkspaceAgentView } from './useAgentShell'
import { landingFor } from './placeLanding'
import { usePlaceHistory } from './usePlaceHistory'
import type { Notify } from './useToasts'

export type OrgPage = 'register' | 'technologyRegister'

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
  openScopeAt: (path: ScopePath, page?: InitialPage) => void
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
  /** Somewhere to say that where a place in the history lands could not be worked out. */
  report?: (cause: unknown) => void
}) {
  const { gateway, status, tree, project, home, homeName, organisationName, goHome, openScopeAt, notify, s } = deps
  const watchScreen = deps.watchScreen ?? false
  const report = deps.report ?? NOBODY
  const [orgPage, setOrgPage] = useState<OrgPage | undefined>(undefined)
  const [orgPageRequest, setOrgPageRequest] = useState<{ page: OrgPage; nonce: number } | undefined>(
    () => (deps.initialHomePage ? { page: deps.initialHomePage, nonce: 1 } : undefined),
  )
  const agentSessionRef = useRef<WorkspaceAgentView | undefined>(undefined)
  const screenNow = useCallback(
    (): Screen => screenOf(agentSessionRef.current, project, { home, homeName, organisationName, orgPage }),
    [project, home, homeName, organisationName, orgPage],
  )
  const openFor = useCallback((to: Destination & { scope: string }) => {
    if (to.page === 'home' || to.page === 'register' || to.page === 'technologyRegister') {
      const page = to.page
      goHome(to.scope)
      setOrgPageRequest((prev) => (page === 'home' ? undefined : { page, nonce: (prev?.nonce ?? 0) + 1 }))
      return
    }
    const held = agentSessionRef.current
    if (project && project.path === to.scope && held) {
      held.show(to)
      return
    }
    openScopeAt(to.scope, initialPageFor(to))
  }, [goHome, project, openScopeAt])
  /**
   * The window's history (ADR-0033): every look below is handed to it, so a
   * move to another place is a step whoever made it, and Back opens the place
   * before through `openFor`, the way `app.open` is answered. Where a place
   * lands when it is not there any more is asked of the tree the shell holds,
   * and of the open session for the scope that is open.
   */
  const nearest = useCallback((place: Place) => landingFor(place, tree, (path) => {
    const held = agentSessionRef.current
    return held && project?.path === path ? { model: held.current(), ancestorDecisions: held.ancestorDecisions() } : undefined
  }, report), [tree, project, report])
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
  const lookAgain = useCallback(() => {
    const next = screenNow()
    lookAtPlace(next)
    if (!watchScreen) return
    const by: MovedBy = agentOpened.current || agentDriving.current ? 'agent' : 'person'
    setWhere((held) => {
      if (held && JSON.stringify(held.screen) === JSON.stringify(next)) return held
      return { screen: next, by }
    })
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
  const openSomewhere = useCallback<SourceOpen>((to) => {
    openFor({ ...to, scope: to.scope ?? project?.path ?? home })
  }, [openFor, project, home])
  const agentStopped = useCallback((client: string | undefined) => {
    notify(s('agent.stoppedToast', { name: client ?? s('agent.someone') }), 'info')
  }, [notify, s])
  const agentOpen = useCallback((to: Destination & { scope: string }) => {
    agentOpened.current = true
    openFor(to)
  }, [openFor])
  const agentShell = useAgentShell({ gateway, status, tree, screen: screenNow, open: agentOpen, onStopped: agentStopped })
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
    orgPageRequest, setOrgPage, openSomewhere, driving: agentShell.driving, stop: agentShell.stop, registerAgentSession,
    screen: where?.screen, movedBy: where?.by ?? 'person', screenNow,
  }
}

/** Where the app is, as the agent is told it: the scope that is open and its view and page, or the home. */
function screenOf(
  held: WorkspaceAgentView | undefined,
  project: ScopeSnapshot | undefined,
  at: { home: ScopePath; homeName: string | undefined; organisationName: string; orgPage: OrgPage | undefined },
): Screen {
  const { home, homeName, organisationName, orgPage } = at
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
    ...(orgPage ? { page: { page: orgPage } } : {}),
  }
}
