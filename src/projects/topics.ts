// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Topics (ADR-0042): a scope that is relevant to other scopes, by dated links
 * kept in its own record (`relevantTo`). A link holds from a day and ends on
 * one, as a reporting line does; an ended link is kept. A subtopic — a scope
 * under a topic — is relevant wherever its topic is, and wherever it says so
 * itself.
 *
 * Pure: the tree's listing in, answers out. Nothing here reads a label: a
 * scope is a topic because it is filed under the topics place or says where
 * it is relevant, never because of what it calls itself.
 */
import { dayBefore } from '../model/units'
import type { Finding } from './checks'
import { ancestorScopes, isWithinScope, joinScope, ROOT_SCOPE } from './scopePath'
import type { ScopePath } from './scopePath'

/** One link from a topic to a scope it is relevant to: from a day, and until one once it ends. Days are `yyyy-mm-dd`. */
export type TopicLink = { path: ScopePath; from?: string; until?: string }

/** The organisation's topics place where no setting says another (§2): a *Topics* scope at the organisation. */
export const TOPICS_PLACE = joinScope(ROOT_SCOPE, 'topics')

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Whether something read back out of storage is a list of topic links: each a path, its days `yyyy-mm-dd` where said. */
export function isTopicLinkList(value: unknown): value is TopicLink[] {
  return Array.isArray(value) && value.every((one) => one !== null && typeof one === 'object'
    && typeof (one as TopicLink).path === 'string'
    && ((one as TopicLink).from === undefined || DAY.test((one as TopicLink).from!))
    && ((one as TopicLink).until === undefined || DAY.test((one as TopicLink).until!)))
}

/** Whether a link holds on `day`: on or after its first day, and on or before its last, each open where absent. */
export function linkHolds(link: TopicLink, day: string): boolean {
  return (link.from === undefined || link.from <= day) && (link.until === undefined || link.until >= day)
}

/** A scope as the listing says it, for these questions: where it is, and where it says it is relevant. */
export type TopicNode = { readonly path: ScopePath; readonly relevantTo?: readonly TopicLink[] }

/** Whether a scope says it is a topic itself: filed under the topics place — the place itself is not one — or saying where it is relevant. */
function saysTopic(node: TopicNode, place: ScopePath): boolean {
  return (node.path !== place && isWithinScope(node.path, place)) || (node.relevantTo?.length ?? 0) > 0
}

/**
 * The topics of the tree, in path order (§1): every scope that says it is one,
 * and every scope under one of those — a subtopic.
 */
export function topicsOf(nodes: readonly TopicNode[], place: ScopePath = TOPICS_PLACE): TopicNode[] {
  const said = new Set(nodes.filter((one) => saysTopic(one, place)).map((one) => one.path))
  return nodes
    .filter((one) => said.has(one.path) || ancestorScopes(one.path).some((above) => said.has(above)))
    .sort((a, b) => a.path.localeCompare(b.path))
}

/** Whether a scope is a topic: {@link topicsOf} asked of one. */
export function isTopic(path: ScopePath, nodes: readonly TopicNode[], place: ScopePath = TOPICS_PLACE): boolean {
  return topicsOf(nodes, place).some((one) => one.path === path)
}

/** The topics a topic is under, nearest first: what a subtopic is relevant through. */
function topicsAbove(path: ScopePath, topics: ReadonlySet<ScopePath>): ScopePath[] {
  return ancestorScopes(path).filter((one) => topics.has(one))
}

/**
 * Where a topic is relevant on `day` (§1): wherever a link of its own holds,
 * and wherever a topic it is under is relevant.
 */
export function relevantPlaces(topic: ScopePath, nodes: readonly TopicNode[], day: string, place: ScopePath = TOPICS_PLACE): ScopePath[] {
  const byPath = new Map(nodes.map((one) => [one.path, one]))
  const topics = new Set(topicsOf(nodes, place).map((one) => one.path))
  const own = (path: ScopePath) => (byPath.get(path)?.relevantTo ?? []).filter((link) => linkHolds(link, day)).map((link) => link.path)
  const places = [topic, ...topicsAbove(topic, topics)].flatMap(own)
  return [...new Set(places)].sort()
}

/**
 * The topics relevant at a scope on `day` (§4), by their own links or
 * through the topic they are under — the scope's own, not those of the
 * scopes above it, which `topicsInForce` adds.
 */
export function topicsRelevantAt(path: ScopePath, nodes: readonly TopicNode[], day: string, place: ScopePath = TOPICS_PLACE): ScopePath[] {
  return topicsOf(nodes, place).filter((one) => relevantPlaces(one.path, nodes, day, place).includes(path)).map((one) => one.path)
}

/**
 * The topics whose principles are in force at a scope on `day` (§4, ADR-0041
 * §1): those relevant to it or to any scope above it.
 */
export function topicsInForce(path: ScopePath, nodes: readonly TopicNode[], day: string, place: ScopePath = TOPICS_PLACE): ScopePath[] {
  const at = new Set([path, ...ancestorScopes(path)])
  return topicsOf(nodes, place).filter((one) => relevantPlaces(one.path, nodes, day, place).some((there) => at.has(there))).map((one) => one.path)
}

/**
 * The topic rows a tree draws under a scope (§4): the topics relevant to it
 * today, less a subtopic whose topic is listed there — implied by it.
 */
export function topicRowsAt(path: ScopePath, nodes: readonly TopicNode[], day: string, place: ScopePath = TOPICS_PLACE): ScopePath[] {
  const listed = topicsRelevantAt(path, nodes, day, place)
  return listed.filter((one) => !listed.some((other) => other !== one && isWithinScope(one, other)))
}

/** A link added from `from`: the list with it, unless one to the same scope already holds then or is to start. */
export function withLink(links: readonly TopicLink[], path: ScopePath, from?: string): TopicLink[] {
  const standing = links.some((one) => one.path === path && one.until === undefined)
  return standing ? [...links] : [...links, { path, ...(from !== undefined ? { from } : {}) }]
}

/** Whether two links are the same one: the same scope, from and until the same days. */
export function sameLink(one: TopicLink, other: TopicLink): boolean {
  return one.path === other.path && one.from === other.from && one.until === other.until
}

/** The links without `link`: for a link made by mistake only (§1). */
export function withoutLink(links: readonly TopicLink[], link: TopicLink): TopicLink[] {
  return links.filter((one) => !sameLink(one, link))
}

/**
 * The links with `link` ended on `until`, its last day, and kept (§1). A
 * link that would end before it starts never held: it is taken out instead.
 */
export function endedOn(links: readonly TopicLink[], link: TopicLink, until: string): TopicLink[] {
  if (link.from !== undefined && until < link.from) return withoutLink(links, link)
  return links.map((one) => (sameLink(one, link) ? { ...one, until } : one))
}

/**
 * The links with the one to `path` that holds today no longer holding from
 * today (§4, the × on a home's chip): its last day is yesterday, or — made
 * today — it never held, and goes.
 */
export function stoppedToday(links: readonly TopicLink[], path: ScopePath, today: string): TopicLink[] {
  const held = links.find((one) => one.path === path && linkHolds(one, today))
  return held ? endedOn(links, held, dayBefore(today)) : [...links]
}

/** The links with the days of `link` set as said; a day said empty is open. */
export function withDays(links: readonly TopicLink[], link: TopicLink, days: { from?: string; until?: string }): TopicLink[] {
  return links.map((one) => (sameLink(one, link)
    ? { path: one.path, ...(days.from ? { from: days.from } : {}), ...(days.until ? { until: days.until } : {}) }
    : one))
}

/** The links carried by a move of the subtree at `from` to `to` (§5): each path inside it, at its new address. */
export function readdressLinks(links: readonly TopicLink[], from: ScopePath, to: ScopePath): TopicLink[] {
  if (from === ROOT_SCOPE || from === to) return [...links]
  return links.map((one) => (isWithinScope(one.path, from) ? { ...one, path: `${to}${one.path.slice(from.length)}` } : one))
}

/**
 * `check.relevantGone` (§5): a link, ended or not, to a scope the tree no
 * longer holds — found on the topic, which keeps it and is where it is put
 * right. Ended links are history and count too: a link to nowhere says
 * nothing about when.
 */
export function topicFindings(nodes: readonly TopicNode[]): Finding[] {
  const held = new Set(nodes.map((one) => one.path))
  return nodes.flatMap((one) => [...new Set((one.relevantTo ?? []).map((link) => link.path))]
    .filter((path) => !held.has(path))
    .map((path): Finding => ({ key: 'check.relevantGone', scope: one.path, id: path, name: path, fields: [path] })))
}

/**
 * Whether a principle kept at `kept` reads at `scope` on `day` (ADR-0041 §1):
 * kept there or above, or kept by a topic in force there.
 */
export function principleReadsAt(nodes: readonly TopicNode[], day: string, place: ScopePath = TOPICS_PLACE): (scope: ScopePath, kept: ScopePath) => boolean {
  const inForce = new Map<ScopePath, ScopePath[]>()
  return (scope, kept) => {
    if (scope === kept || ancestorScopes(scope).includes(kept)) return true
    if (!inForce.has(scope)) inForce.set(scope, topicsInForce(scope, nodes, day, place))
    return inForce.get(scope)!.includes(kept)
  }
}
