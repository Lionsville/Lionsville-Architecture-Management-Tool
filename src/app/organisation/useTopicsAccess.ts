// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The topics, wired (ADR-0042): read off the tree's listing, which says each
 * scope's `relevantTo`, and written as steps in the topic that keeps the link,
 * under its rights (`units/writeIn.ts`) — whichever end the link is made
 * from. Nothing is open on a home, so there is no session to go through; the
 * tree is read again once a step lands.
 *
 * A topic is made under the organisation's topics place (§2), a *Topics*
 * scope made on first use, or under the topic it is a subtopic of; moved with
 * the tree's own move, which carries every link that names it (§5); and
 * removed only while it keeps nothing — no principle, no building block, no
 * subtopic — and nothing else besides, one scope at a time.
 */
import { useMemo, useRef } from 'react'
import type { Translate } from '../../i18n'
import { flattenScopes } from '../../projects/scope'
import type { ScopeSummary } from '../../projects/scope'
import type { ScopePrinciples } from '../../projects/scopeIndex'
import { scopeDisplayName } from '../../projects/scopeLabel'
import { ancestorScopes, isWithinScope, parentScope, ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { ensureScope } from '../../projects/scopeAccess'
import type { OrganisationIndex } from '../../ports/OrganisationIndex'
import { createScopeAt, describeScopeAt, moveScopeUnder, removeScopeAt } from '../../projects/scopeTree'
import type { TreeScopes } from '../../projects/scopeTree'
import type { InitialPage } from '../App'
import {
  endedOn, isTopic, relevantPlaces, stoppedToday, TOPICS_PLACE, topicRowsAt, topicsInForce, topicsOf, topicsRelevantAt, withDays, withLink, withoutLink,
} from '../../projects/topics'
import type { TopicLink } from '../../projects/topics'
import { ShellError } from '../../platform/errors'
import { refusalKey, writeIn } from '../units/writeIn'
import type { TopicKeeps, TopicsAccess, TopicSummary } from './TopicsContext'

export type TopicsDeps = {
  /** The tree as the shell lists it: every scope, with what it says about where it is relevant. */
  tree: ScopeSummary
  /** Each scope's principles, off the index: what a topic keeps. */
  principlesAt: ((path: ScopePath) => ScopePrinciples) | undefined
  scopes: TreeScopes
  index: Pick<OrganisationIndex, 'read'>
  writable: (path: ScopePath) => boolean
  /** The tree read again, and the index with it, once a step lands. */
  written: () => void
  notify: (message: string, severity: 'success' | 'error' | 'warning') => void
  today: string
  /** Open a scope on a page, as the cards do. */
  open: (path: ScopePath, page?: InitialPage) => void
  /** A scope's home. */
  goHome: (path: ScopePath) => void
  /** The catalogue, over the home that is up, on a topic. */
  openCatalogue: (topic?: ScopePath) => void
  s: Translate
}

/** The topics as the catalogue lists them: each with the nearest topic it is filed under. */
function summariesOf(scopes: readonly ScopeSummary[]): TopicSummary[] {
  const topics = topicsOf(scopes)
  const paths = new Set(topics.map((one) => one.path))
  const byPath = new Map(scopes.map((one) => [one.path, one]))
  return topics.map(({ path }) => {
    const held = byPath.get(path)!
    const parent = ancestorScopes(path).find((above) => paths.has(above))
    return {
      id: path, name: held.name.trim() || path,
      ...(held.description ? { description: held.description } : {}),
      ...(parent !== undefined ? { parent } : {}),
      links: held.relevantTo ?? [],
    }
  })
}

/** What a topic keeps (§3): its own principles, standing or not, its building blocks and the scopes under it. */
function keepsOf(deps: TopicsDeps, scopes: readonly ScopeSummary[], topic: ScopePath): TopicKeeps {
  const principles = deps.principlesAt?.(topic).principles.filter((one) => one.mergedInto === undefined).length ?? 0
  const subtopics = scopes.filter((one) => parentScope(one.path) === topic).length
  return { principles, blocks: 0, subtopics }
}

/** A step in the topic: its links, worked out again from what it holds. Said where it is refused; the tree read again where it lands. */
function linksIn(deps: TopicsDeps, topic: ScopePath, change: (links: readonly TopicLink[]) => TopicLink[]): void {
  void writeIn(deps, topic, (held) => {
    const links = held.relevantTo ?? []
    const next = change(links)
    if (JSON.stringify(next) === JSON.stringify(links)) return undefined
    return [{ type: 'scope.describe', patch: { relevantTo: next.length ? next : null } }]
  }).then((written) => {
    if (written.ok) deps.written()
    const key = refusalKey(written)
    if (key) deps.notify(deps.s(key), 'error')
  })
}

/** A refusal said, or anything else let through to the caller. */
function said(deps: TopicsDeps, cause: unknown): undefined {
  if (!(cause instanceof ShellError)) throw cause
  deps.notify(deps.s(cause.key), 'error')
  return undefined
}

async function create(deps: TopicsDeps, name: string, parent: ScopePath | undefined, relevantTo: readonly ScopePath[]): Promise<ScopePath | undefined> {
  const under = parent ?? TOPICS_PLACE
  try {
    if (parent === undefined) await ensureScope(deps.scopes, TOPICS_PLACE, { name: deps.s('topics.title'), kind: 'domain' })
    const made = await createScopeAt(deps.scopes, { parent: under, name: name.trim(), withBoard: false, boardName: '', ancestors: 'required' })
    if ('refused' in made) return said(deps, new ShellError(made.refused))
    if (relevantTo.length) {
      const today = deps.today
      await writeIn(deps, made.path, () => [{ type: 'scope.describe', patch: { relevantTo: relevantTo.reduce<TopicLink[]>((links, path) => withLink(links, path, today), []) } }])
    }
    deps.written()
    return made.path
  } catch (cause) {
    return said(deps, cause)
  }
}

async function update(deps: TopicsDeps, topic: ScopePath, patch: { name: string; description: string; parent?: ScopePath | '' }): Promise<void> {
  try {
    await describeScopeAt(deps.scopes, topic, { name: patch.name, description: patch.description || null })
    const to = patch.parent === undefined ? undefined : patch.parent || TOPICS_PLACE
    if (to !== undefined && to !== parentScope(topic) && !isWithinScope(to, topic)) {
      if (to === TOPICS_PLACE) await ensureScope(deps.scopes, TOPICS_PLACE, { name: deps.s('topics.title'), kind: 'domain' })
      await moveScopeUnder(deps.scopes, deps.index, topic, to, { strict: true })
    }
    deps.written()
  } catch (cause) {
    said(deps, cause)
  }
}

async function remove(deps: TopicsDeps, scopes: readonly ScopeSummary[], topic: ScopePath): Promise<boolean> {
  const keeps = keepsOf(deps, scopes, topic)
  if (keeps.principles + keeps.blocks + keeps.subtopics > 0 || !deps.writable(topic)) return false
  try {
    await removeScopeAt(deps.scopes, topic, undefined, { leafOnly: true })
    deps.written()
    return true
  } catch (cause) {
    said(deps, cause)
    return false
  }
}

/** The access the catalogue and every home's *Relevant topics* read, over the tree as it is listed now. */
export function topicsAccess(deps: TopicsDeps, version: number): TopicsAccess {
  const scopes = flattenScopes(deps.tree)
  const list = summariesOf(scopes)
  const byId = new Map(list.map((one) => [one.id, one]))
  const rootName = deps.tree.name.trim() || deps.s('common.organisation')
  const scopeLabel = (path: ScopePath) => (path === ROOT_SCOPE ? rootName : scopeDisplayName(path, scopes, rootName))
  return {
    version,
    list: () => list,
    get: (id) => byId.get(id),
    relevantAt: (path) => topicsRelevantAt(path, scopes, deps.today).flatMap((id) => byId.get(id) ?? []),
    treeRows: (path) => topicRowsAt(path, scopes, deps.today).flatMap((id) => byId.get(id) ?? []),
    inForceAt: (path) => topicsInForce(path, scopes, deps.today),
    relevantPlaces: (id) => relevantPlaces(id, scopes, deps.today),
    mayWrite: deps.writable,
    mayCreate: () => deps.writable(TOPICS_PLACE),
    relate: (topic, path, from) => linksIn(deps, topic, (links) => withLink(links, path, from ?? deps.today)),
    endLink: (topic, link, until) => linksIn(deps, topic, (links) => endedOn(links, link, until)),
    stopHere: (topic, path) => linksIn(deps, topic, (links) => stoppedToday(links, path, deps.today)),
    setLink: (topic, link, days) => linksIn(deps, topic, (links) => withDays(links, link, days)),
    removeLink: (topic, link) => linksIn(deps, topic, (links) => withoutLink(links, link)),
    create: (name, parent, relevantTo = []) => create(deps, name, parent, relevantTo),
    update: (topic, patch) => { void update(deps, topic, patch) },
    remove: (topic) => remove(deps, scopes, topic),
    keeps: (topic) => keepsOf(deps, scopes, topic),
    today: () => deps.today,
    scopeLabel,
    scopeChoices: () => scopes
      .filter((one) => one.path !== TOPICS_PLACE && !isTopic(one.path, scopes))
      .map((one) => ({ path: one.path, name: scopeLabel(one.path) })),
    openCatalogue: deps.openCatalogue,
    openPrinciples: (topic) => deps.open(topic, { page: 'principles' }),
    openHome: deps.goHome,
  }
}

/** The access, made again when the tree is read again or the day turns; the rest read through a ref. */
export function useTopicsAccess(deps: TopicsDeps): TopicsAccess {
  const latest = useRef(deps)
  latest.current = deps
  const version = useRef(0)
  const { tree, today, principlesAt } = deps
  return useMemo(() => {
    version.current += 1
    const now = latest.current
    return topicsAccess({
      ...now,
      written: () => latest.current.written(),
      open: (path, page) => latest.current.open(path, page),
      goHome: (path) => latest.current.goHome(path),
      openCatalogue: (topic) => latest.current.openCatalogue(topic),
    }, version.current)
  }, [tree, today, principlesAt])
}
