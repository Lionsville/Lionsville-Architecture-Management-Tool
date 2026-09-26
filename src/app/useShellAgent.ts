// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent at the shell (ADR-0019): where the app is, moving it, and the
 * driving session with its Stop. Which of the organisation screen's two pages
 * is up is the one fact about that screen the shell has to hold, because an
 * agent may ask for either and may ask where it stands.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Translate } from '../i18n'
import type { Destination, Screen } from '../agent/screen'
import type { TreeView } from '../agent/tree'
import type { AgentServerStatus } from '../platform/agentServer'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSnapshot } from '../projects/scope'
import { ROOT_SCOPE, scopePathLabel } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import type { InitialPage, SourceOpen } from './App'
import { useAgentShell } from './useAgentShell'
import type { WorkspaceAgentView } from './useAgentShell'
import type { Notify } from './useToasts'

type OrgPage = 'register' | 'technologyRegister'

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
   * every build in this repository: nobody then pays a look per render.
   */
  watchScreen?: boolean
}) {
  const { gateway, status, tree, project, home, homeName, organisationName, goHome, openScopeAt, notify, s } = deps
  const watchScreen = deps.watchScreen ?? false
  const [orgPage, setOrgPage] = useState<OrgPage | undefined>(undefined)
  const [orgPageRequest, setOrgPageRequest] = useState<{ page: OrgPage; nonce: number } | undefined>(undefined)
  const agentSessionRef = useRef<WorkspaceAgentView | undefined>(undefined)
  const screenNow = useCallback(
    (): Screen => screenOf(agentSessionRef.current, project, { home, homeName, organisationName, orgPage }),
    [project, home, homeName, organisationName, orgPage],
  )
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
  const [screen, setScreen] = useState<Screen | undefined>(() => (watchScreen ? screenNow() : undefined))
  const lookAgain = useCallback(() => {
    if (!watchScreen) return
    const next = screenNow()
    setScreen((held) => (held && JSON.stringify(held) === JSON.stringify(next) ? held : next))
  }, [watchScreen, screenNow])
  useEffect(lookAgain, [lookAgain])
  // Through a ref, so registering the view does not change identity with the
  // screen: the workspace re-registers whenever this function changes.
  const lookAgainRef = useRef(lookAgain)
  lookAgainRef.current = lookAgain
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
  const agentShell = useAgentShell({ gateway, status, tree, screen: screenNow, open: openFor, onStopped: agentStopped })
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
    screen, screenNow,
  }
}

/**
 * The page a scope opens on for an agent's destination (ADR-0019): the same
 * three words, so the two vocabularies cannot drift. A home page is the
 * shell's own business and never reaches here.
 */
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

export function initialPageFor(to: Destination): InitialPage | undefined {
  switch (to.page) {
    case 'board': return to.id !== undefined ? { page: 'board', id: to.id } : undefined
    case 'sheet': return { page: 'sheet', ...(to.id !== undefined ? { id: to.id } : {}) }
    case 'map': return { page: 'map', ...(to.id !== undefined ? { id: to.id } : {}) }
    case 'technology': return { page: 'technology', ...(to.id !== undefined ? { id: to.id } : {}) }
    case 'decisions': return { page: 'decisions', ...(to.id !== undefined ? { id: to.id } : {}) }
    case 'observations': return { page: 'observations', ...(to.id !== undefined ? { id: to.id } : {}) }
    case 'roadmap': return { page: 'roadmap' }
    case 'plan': return to.id !== undefined ? { page: 'plan', id: to.id } : { page: 'roadmap' }
    case 'element': return to.id !== undefined ? { page: 'element', id: to.id } : undefined
    case 'document': return to.id !== undefined ? { page: 'document', id: to.id } : { page: 'documentation' }
    case 'documentation': return { page: 'documentation' }
    case 'platform': return to.id !== undefined ? { page: 'platform', id: to.id } : undefined
    case 'service': return to.id !== undefined ? { page: 'service', id: to.id } : undefined
    default: return undefined
  }
}
