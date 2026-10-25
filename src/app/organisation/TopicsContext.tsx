// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Topics (ADR-0042): a scope that is relevant to other scopes. The link is
 * written from either end and kept on the topic; a subtopic is a scope under
 * a topic, relevant wherever its topic is and wherever it says so itself.
 * The catalogue lists the scopes under the organisation's topics place and
 * any scope anywhere with a relevance link — never by the label.
 *
 * The seam the catalogue and a home's *Relevant topics* read and write
 * through. A topic is named by its path. Every write is a step in the topic,
 * under the topic's rights, and lands when the tree is read again: the
 * screens draw what the access says after it, and a refusal is said by the
 * access, not the screen.
 */
import type { ScopeChoice } from '../../widgets/ScopeChoices'
import { createContext, useContext, type ReactNode } from 'react'
import type { TopicLink } from '../../projects/topics'
import type { ScopePath } from '../../projects/scopePath'

export type { TopicLink }
export { linkHolds } from '../../projects/topics'

export type TopicSummary = {
  /** Its path: a topic is a scope. */
  id: ScopePath
  name: string
  description?: string
  /** The topic it is filed under, where it is a subtopic. */
  parent?: ScopePath
  /** Where it says it is relevant, itself, ended links included. */
  links: readonly TopicLink[]
}

/** What a topic keeps, which a removal is refused over (§3). */
export type TopicKeeps = { principles: number; blocks: number; subtopics: number }

export type TopicsAccess = {
  /** Moves whenever the tree is read again, so a memo over a read knows to read again. */
  readonly version: number
  list(): readonly TopicSummary[]
  get(id: ScopePath): TopicSummary | undefined
  /** Relevant here today: by its own link, or through the topic it is under. */
  relevantAt(path: ScopePath): readonly TopicSummary[]
  /** The ↗ rows the tree draws under a scope (§4): relevant today, less a subtopic whose topic is listed. */
  treeRows(path: ScopePath): readonly TopicSummary[]
  /** The topics whose principles are in force at a scope today: relevant to it or to a scope above it (§4). */
  inForceAt(path: ScopePath): readonly ScopePath[]
  /** Where a topic is relevant today, its parents' places included. */
  relevantPlaces(id: ScopePath): readonly ScopePath[]
  /** May the person change this topic — its links, its name — which is a step in the topic. */
  mayWrite(topic: ScopePath): boolean
  /** May the person make a topic: a scope under the topics place. */
  mayCreate(): boolean
  /** A link from the day given, or from today. */
  relate(topic: ScopePath, path: ScopePath, from?: string): void
  /** The link ends on `until`, its last day, and is kept. */
  endLink(topic: ScopePath, link: TopicLink, until: string): void
  /** The link to `path` that holds today no longer holds from today: the × on a home's chip. */
  stopHere(topic: ScopePath, path: ScopePath): void
  /** A link's days changed. */
  setLink(topic: ScopePath, link: TopicLink, days: { from?: string; until?: string }): void
  /** A link made by mistake, taken out. */
  removeLink(topic: ScopePath, link: TopicLink): void
  /** A topic made under the topics place, or under a topic: its path once it is there. */
  create(name: string, parent?: ScopePath, relevantTo?: readonly ScopePath[]): Promise<ScopePath | undefined>
  /** Its name and description, and — where `parent` is said — the topic it is filed under, or none. */
  update(topic: ScopePath, patch: { name: string; description: string; parent?: ScopePath | '' }): void
  /** Removed while it keeps nothing (§3): answers whether it went. */
  remove(topic: ScopePath): Promise<boolean>
  keeps(topic: ScopePath): TopicKeeps
  today(): string
  scopeLabel(path: ScopePath): string
  /** The scopes a topic may be made relevant to: every scope that is not a topic. */
  /** The scopes a topic may be relevant to, in the tree's order and at their depth. */
  scopeChoices(): readonly ScopeChoice[]
  /** Open the catalogue, on a topic where one is named. */
  openCatalogue(topic?: ScopePath): void
  /** The topic's principles page. */
  openPrinciples(topic: ScopePath): void
  /** The topic's own home, where it lives. */
  openHome(topic: ScopePath): void
}

const TopicsContext = createContext<TopicsAccess | undefined>(undefined)

export function TopicsProvider({ value, children }: { value: TopicsAccess | undefined; children: ReactNode }) {
  return <TopicsContext.Provider value={value}>{children}</TopicsContext.Provider>
}

export function useTopics(): TopicsAccess | undefined {
  return useContext(TopicsContext)
}
