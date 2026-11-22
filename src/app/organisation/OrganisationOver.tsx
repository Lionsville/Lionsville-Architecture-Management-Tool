// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation's pages over the scope that is open (ADR-0033, amended 22
 * November 2026): its register, its people and its checks, drawn over the
 * workspace as its history is, so the scope stays open under them — its tabs in
 * row two, its undo, its name in the trail — and leaving the page shows the
 * scope again as it was.
 *
 * They are the pages a home draws (`HomePages`), over the organisation, off
 * what the shell already read of the tree. Drawn inside the workspace, so a
 * finding marked here about the open scope is that scope's step through its
 * session (`CheckMarkingContext`), and never a write behind it.
 *
 * **A way on from one of them is a move like any other**: it goes through the
 * one way the app is moved (`openSomewhere`), which leaves the page first —
 * onto the open scope where that is where it leads, with nothing read again
 * and nothing lost. A page of a home that does not stand over a scope (the
 * topics, the building blocks) is asked of the shell, which goes to the
 * organisation's home for it as before.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Destination } from '../../agent/screen'
import { flattenScopes } from '../../projects/scope'
import type { ScopeSnapshot } from '../../projects/scope'
import { readScope } from '../../projects/scopeAccess'
import { scopeDisplayName } from '../../projects/scopeLabel'
import { ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import type { InitialPage } from '../initialPage'
import { useCheckMarking } from '../checkMarking'
import type { ShellParts } from '../shellParts'
import { OVER_THE_SCOPE } from '../useShellAgent'
import type { OrgPage } from '../homePages'
import { usePageChrome } from '../WorkspaceBar'
import { HomePages } from './HomePages'
import { useHomeChecks } from './useHomeChecks'
import { useHomePages } from './useHomePages'
import type { HomePagesState } from './useHomePages'

/** A page asked of a scope as a place the app is moved to, where it is one: making a view and a link asked for are not. */
function destinationOf(path: ScopePath, page: InitialPage | undefined): (Destination & { scope: string }) | undefined {
  if (page === undefined) return { scope: path }
  if (page.page === 'make' || page.page === 'link') return undefined
  return { scope: path, ...page } as Destination & { scope: string }
}

export function OrganisationOver({ parts }: { parts: ShellParts }) {
  const { agent } = parts
  // Only a page asked for while this scope is open: one asked of the home it was opened from is that home's, and is not brought along.
  const before = useRef(agent.orgPageRequest)
  const held = useHomePages(agent.orgPageRequest === before.current ? undefined : agent.orgPageRequest, agent.setOrgPage)
  // Nothing of the tree is read or counted for it while none is up: a workspace is open far longer than any of these pages.
  return held.openPage === undefined ? null : <OverPages parts={parts} held={held} />
}

function OverPages({ parts, held }: { parts: ShellParts; held: HomePagesState }) {
  const { services: { s, prefs }, organisation: { tree }, findings, nav, agent } = parts
  const { openSomewhere } = agent
  // A page that does not stand over a scope is the shell's to open, where it always was.
  const pages = useMemo<HomePagesState>(() => ({
    ...held,
    open: (page: OrgPage, ...picked) => {
      if (OVER_THE_SCOPE.includes(page)) held.open(page, ...picked)
      else openSomewhere({ scope: ROOT_SCOPE, page, ...(picked[0] !== undefined ? { id: picked[0] } : {}) })
    },
  }), [held, openSomewhere])
  const { index, models } = parts.tree
  const treeRead = useMemo(() => ({ index, models }), [index, models])
  const everyScope = useMemo(() => flattenScopes(tree), [tree])
  const rootName = tree.name.trim() || s('picker.organisation')
  const scopeName = useCallback((path: ScopePath) => (
    path === ROOT_SCOPE ? s('common.organisation') : scopeDisplayName(path, everyScope, s('common.organisation'))
  ), [everyScope, s])
  const registerScopeName = useCallback((path: ScopePath) => scopeDisplayName(path, everyScope, rootName), [everyScope, rootName])
  const root = useOrganisationRead(parts)
  const marking = useCheckMarking()
  const checks = useHomeChecks({
    findings: findings.treeFindings, register: findings.register, technology: findings.technology, at: ROOT_SCOPE, root, tree: treeRead,
    marks: marking?.marks, people: parts.people, platformTree: findings.platformTree, today: parts.todayDay, scopeName, s,
  })
  const { openScopeAt, goHome } = nav
  const open = useCallback((path: ScopePath, page?: InitialPage) => {
    const to = destinationOf(path, page)
    if (to) { openSomewhere(to); return }
    // Not a place: the scope is entered afresh for it, the open one included, so what is asked meets the scope as it is kept.
    if (nav.project?.path === path) goHome(path)
    openScopeAt(path, page)
  }, [openSomewhere, openScopeAt, goHome, nav.project?.path])
  const topics = useMemo(() => ({ makeId: parts.props.makeId }), [parts.props.makeId])
  const windowChrome = usePageChrome(parts.windowChrome).pageChrome
  return (
    <HomePages
      pages={pages} at={ROOT_SCOPE} register={findings.register} technology={findings.technology} registerScopeName={registerScopeName}
      everyScope={everyScope} treeRead={treeRead} today={parts.todayDay} language={prefs.language} topics={topics} scopeName={scopeName}
      checks={checks} people={parts.people} readOnly={!parts.writable(ROOT_SCOPE)} open={open}
      onHome={(path) => openSomewhere({ scope: path, page: 'home' })} onChecksOf={(path) => openSomewhere({ scope: path, page: 'checks' })}
      onOpenRow={(path, id) => open(path, { page: 'element', id })} onOpenRowPage={(path, id) => open(path, { page: 'document', id })}
      onLink={(path, id, to) => open(path, { page: 'link', id, to })} s={s} windowChrome={windowChrome}
    />
  )
}

/**
 * The organisation's own document, read as one of its pages comes up and again
 * whenever the tree is: its operating model and its views, for the findings
 * only a home's own document has. A home reads it for its cards; over a scope
 * nobody else does.
 */
function useOrganisationRead(parts: ShellParts): ScopeSnapshot | undefined {
  const { scopes } = parts.props.repositories
  const { index } = parts.tree
  const { failed } = parts.services
  const [read, setRead] = useState<ScopeSnapshot | undefined>(undefined)
  useEffect(() => {
    let current = true
    readScope(scopes, ROOT_SCOPE).then(
      (found) => { if (current) setRead(found) },
      (cause: unknown) => failed('organisationOver.read', cause),
    )
    return () => { current = false }
    // Again with the index: what moved the tree may have moved the organisation.
  }, [scopes, index, failed])
  return read
}
