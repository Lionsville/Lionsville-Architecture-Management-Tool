// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The tree of scopes, lent to the agent on the desktop (ADR-0040 §3): the
 * four gestures over the source's repositories, as the organisation screen
 * makes them (`projects/scopeTree.ts`).
 *
 * **A change to the tree is each scope's own step**, under that scope's
 * rights, never a step on the open session's stack — the rule
 * `units/writeIn.ts` keeps. So **the scope open in the workspace is the
 * session's to change**: describing it, and moving or removing it or a scope
 * above it, is refused `scope.isOpen`, and the agent opens the home first,
 * where a person changes the tree too. Making a scope anywhere, and
 * describing one above, need nothing moved.
 *
 * **Nor does it write behind the open session**: a unit kept in the scope
 * open is linked there, with `element.update`, and a move that would
 * re-address a stand-in, a cause or a line kept in the scope open is refused
 * `scope.isOpen` too, before anything moves.
 *
 * A scope this build could not read whole — part of it unreadable, written by
 * a later version, or no document at all — is said as `unreadable` and never
 * removed from here; a removal always expects the revision it was read at,
 * and takes that one scope alone (`leafOnly`), so a scope filed under it in
 * the meantime is refused, not taken with it.
 *
 * After every write the tree and the index are read again, and the answer
 * waits — a little, never for ever — until the listing the agent's next call
 * reads says so, so a scope made, renamed, retyped or moved a moment ago is
 * one the next call reads as it now is.
 * A removal that took work with it is said on the person's screen as well,
 * because there is no ⌘Z for it.
 */
import { useMemo, useRef } from 'react'
import type { ScopeHeader, ScopeRead, ScopesView, TreeRefusal, TreeRefused } from '../agent/scopeTree'
import type { Translate } from '../i18n'
import type { ElementId } from '../model'
import { ShellError } from '../platform/errors'
import type { Repositories } from '../ports/Repositories'
import { HOLDS_NOTHING, holdsOf, readWhole } from '../projects/scopeHolds'
import type { ScopeHolds } from '../projects/scopeHolds'
import { nodeAt, nodesOf, readScope, summaryOf } from '../projects/scopeAccess'
import { flattenScopes } from '../projects/scope'
import type { ScopeIndex } from '../projects/scopeIndex'
import { isWithinScope } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import { createScopeAt, describeScopeAt, fileTopicsPlace, moveScopeUnder, removeScopeAt, scopesAMoveWrites, serveScopeBy } from '../projects/scopeTree'
import { TOPICS_PLACE, topicFiledUnder } from '../projects/topics'

export type AgentScopesDeps = {
  repositories: Pick<Repositories, 'scopes' | 'index'>
  /** The index as the shell holds it now: who keeps which unit. */
  index: () => ScopeIndex
  /** May this person change the scope at this path? */
  writable: (path: ScopePath) => boolean
  /** The scope open in the workspace, where one is. */
  openPath: () => ScopePath | undefined
  /** Read the tree and the index again. */
  treeChanged: () => void
  /** The tree as the agent's next call reads it; absent, nothing is waited for. */
  listed?: () => readonly ListedScope[]
  /** What a new scope's first board is called. */
  boardName: () => string
  today: () => string
  notify: (message: string, severity: 'success' | 'error' | 'warning' | 'info') => void
  /** The connected client's name, for what the screen says of a removal. */
  client: () => string | undefined
  s: Translate
}

/** One scope as the listing the agent reads says it (`TreeView.scopes`). */
export type ListedScope = { readonly path: ScopePath; readonly name: string; readonly kind?: string; readonly unitTypeId?: string }

/** How long an answer waits for the listing to say what landed, and how often it looks. */
const SETTLE_MS = 3000
const LOOK_MS = 25

/** The repository's refusals, as the agent's keys (ADR-0040 §1); anything else passes as it is. */
const AS_AGENT: Readonly<Record<string, TreeRefusal>> = {
  'shell.scopeReadOnly': 'agent.readOnly',
  'shell.scopeMoved': 'agent.stale',
  'shell.scopeGone': 'agent.unknownScope',
  'shell.unreadableInTheWay': 'shell.scopeTaken',
  'shell.scopeHasChildren': 'scope.scopesBelow',
}

function refusedAs(key: string, scope?: ScopePath): TreeRefused {
  return { refused: AS_AGENT[key] ?? (key as TreeRefusal), ...(scope !== undefined ? { scope } : {}) }
}

/** A write, its repository refusal said as the agent's key rather than thrown. */
async function caught<T>(write: () => Promise<T | TreeRefused>, scope: ScopePath): Promise<T | TreeRefused> {
  try {
    return await write()
  } catch (cause) {
    if (cause instanceof ShellError) return refusedAs(cause.key, scope)
    throw cause
  }
}

/** The scope open is this one or filed under it: its place in the tree is the session's. */
function holdsTheOpen(path: ScopePath, open: ScopePath | undefined): boolean {
  return open !== undefined && isWithinScope(open, path)
}

const IS_OPEN = (scope: ScopePath, detail?: string): TreeRefused => ({ refused: 'scope.isOpen', scope, ...(detail ? { detail } : {}) })
const UNREADABLE = (scope: ScopePath): TreeRefused => ({ refused: 'scope.unreadable', scope })

/** Does the listing say what a describe asked for: the name, and the kind or the type, where those were given? */
function saysHeader(row: ListedScope | undefined, header: ScopeHeader): boolean {
  if (!row) return false
  const same = (asked: string | null | undefined, held: string | undefined) => asked === undefined || (asked ?? undefined) === held
  return same(header.name?.trim(), row.name) && same(header.kind, row.kind) && same(header.unitTypeId, row.unitTypeId)
}
const READ_ONLY = (scope: ScopePath): TreeRefused => ({ refused: 'agent.readOnly', scope })

/** How many records a removal took beyond its views, for the screen to say. */
function recordsIn(holds: ScopeHolds): number {
  return Object.entries(holds).reduce((sum, [key, value]) => (key === 'views' || key === 'viewNames' ? sum : sum + (value as number)), 0)
}

/** {@link ScopesView} over the desktop's repositories. */
export function scopesViewOver(deps: AgentScopesDeps): ScopesView {
  const { repositories: { scopes, index }, writable, openPath, s } = deps
  /** The tree read again, and the answer held until the listing says what landed. */
  const settled = async (until: (listed: readonly ListedScope[]) => boolean) => {
    deps.treeChanged()
    const listed = deps.listed
    if (!listed) return
    for (let waited = 0; waited < SETTLE_MS && !until(listed()); waited += LOOK_MS) {
      await new Promise((done) => { setTimeout(done, LOOK_MS) })
    }
  }
  const read = async (path: ScopePath): Promise<ScopeRead | undefined> => {
    const tree = await scopes.tree()
    const node = nodeAt(tree, path)
    if (!node) return undefined
    const state = await scopes.state(node.id)
    const unreadable = (tree.unreadable ?? []).filter((address) => address !== path && isWithinScope(address, path))
    return {
      path, name: node.name, revision: state?.revision ?? '',
      holds: state ? holdsOf(state) : HOLDS_NOTHING,
      below: nodesOf(node).slice(1).map((one) => one.address),
      hiddenBelow: unreadable.length,
      // No document, part of one, or one a later version wrote: not known to be empty.
      ...(state && readWhole(state) ? {} : { unreadable: true as const }),
    }
  }
  return {
    read,
    create: ({ parent: asked, name, withBoard, topic }) => caught(async () => {
      const parent = topic ? topicFiledUnder(flattenScopes(summaryOf(await scopes.tree())), asked) : asked
      if (!writable(parent)) return READ_ONLY(parent)
      if (topic && parent === TOPICS_PLACE) await fileTopicsPlace(scopes, s('topics.title'))
      const made = await createScopeAt(scopes, {
        parent, name, withBoard, boardName: deps.boardName(), ancestors: 'required', ...(topic ? { kind: 'topic' as const } : {}),
      })
      if ('refused' in made) return refusedAs(made.refused, parent)
      await settled((listed) => listed.some((one) => one.path === made.path))
      const revision = (await readScope(scopes, made.path))?.revision ?? ''
      return { path: made.path, name: made.name, kind: made.kind, revision, ...(made.board ? { board: made.board } : {}) }
    }, asked),
    serve: (path, unitId: ElementId) => caught(async () => {
      const keptIn = deps.index().units().find(({ unit }) => unit.id === unitId)?.scope
      if (keptIn !== undefined && keptIn === openPath()) {
        return IS_OPEN(keptIn, `the unit is kept in the scope open in the workspace: link it there, with element.update of its scopes`)
      }
      if (path === openPath()) return IS_OPEN(path)
      const served = await serveScopeBy({ scopes, index: deps.index(), writable, today: deps.today() }, path, unitId)
      if ('refused' in served) return refusedAs(served.refused, served.scope)
      // Until the index says the unit serves it, and the listing says the type it took.
      await settled((listed) => (deps.index().units().find(({ unit }) => unit.id === unitId)?.unit.scopes ?? []).includes(path)
        && (served.scopeType === undefined || listed.find((one) => one.path === path)?.unitTypeId === served.scopeType))
      return served
    }, path),
    describe: (path, header: ScopeHeader) => caught(async () => {
      if (path === openPath()) return IS_OPEN(path)
      if (!writable(path)) return READ_ONLY(path)
      const changed = await describeScopeAt(scopes, path, header)
      if (!changed) return refusedAs('shell.scopeGone', path)
      if (changed.changed.length) await settled((listed) => saysHeader(listed.find((one) => one.path === path), header))
      return { path, changed: changed.changed }
    }, path),
    move: (path, parent) => caught(async () => {
      if (holdsTheOpen(path, openPath())) return IS_OPEN(path)
      if (!writable(path)) return READ_ONLY(path)
      if (!writable(parent)) return READ_ONLY(parent)
      const open = openPath()
      if (open !== undefined && (await scopesAMoveWrites(index, path)).includes(open)) {
        return IS_OPEN(open, `the scope open in the workspace names ${path} and would be re-addressed behind its session: open a home first`)
      }
      const moved = await moveScopeUnder(scopes, index, path, parent)
      if (!moved) return refusedAs('shell.scopeGone', path)
      await settled((listed) => listed.some((one) => one.path === moved.to) && !listed.some((one) => one.path === path))
      return moved
    }, path),
    remove: (path, why) => caught(async () => {
      if (holdsTheOpen(path, openPath())) return IS_OPEN(path)
      if (!writable(path)) return READ_ONLY(path)
      // Never without what was read: a scope with no revision is one nothing could be read of.
      if (!why.expects) return UNREADABLE(path)
      const held = await read(path)
      if (held?.unreadable) return UNREADABLE(path)
      const removed = await removeScopeAt(scopes, path, why.expects, { leafOnly: true })
      if (!removed) return refusedAs('shell.scopeGone', path)
      await settled((listed) => !listed.some((one) => one.path === path))
      if (why.personSaid !== undefined) {
        const what = s('agent.scopeRemovedWhat', { views: why.holds.views, records: recordsIn(why.holds) })
        deps.notify(s('agent.scopeRemoved', { agent: deps.client() ?? s('agent.someone'), name: held?.name ?? path, what, said: why.personSaid }), 'warning')
      }
      return { removed }
    }, path),
  }
}

/** The view, built once for the life of the shell over refs that always reach what is current. */
export function useAgentScopes(deps: AgentScopesDeps): ScopesView {
  const latest = useRef(deps)
  latest.current = deps
  return useMemo(() => scopesViewOver({
    repositories: deps.repositories,
    index: () => latest.current.index(),
    writable: (path) => latest.current.writable(path),
    openPath: () => latest.current.openPath(),
    treeChanged: () => latest.current.treeChanged(),
    ...(deps.listed ? { listed: () => latest.current.listed?.() ?? [] } : {}),
    boardName: () => latest.current.boardName(),
    today: () => latest.current.today(),
    notify: (message, severity) => latest.current.notify(message, severity),
    client: () => latest.current.client(),
    s: (key, params) => latest.current.s(key, params),
  }), [deps.repositories])
}
