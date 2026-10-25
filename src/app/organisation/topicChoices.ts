// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The topics as the catalogue nests them, and as the chooser on a scope's
 * home offers them (ADR-0042 §3, §4): each topic followed by its subtopics,
 * narrowed by what was typed — a match keeps the topics it is under, so a
 * subtopic is never shown without where it sits — and each saying whether it
 * may still be picked for the scope.
 *
 * Pure: the access's reads in, rows out.
 */
import { matchesQuery } from '../../model/textSearch'
import { isWithinScope } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import type { TopicSummary, TopicsAccess } from './TopicsContext'

export type NestedTopic = { topic: TopicSummary; depth: number }

/** The topics in catalogue order: each followed by its subtopics, nested, by name. */
export function nested(list: readonly TopicSummary[]): NestedTopic[] {
  const out: NestedTopic[] = []
  const walk = (parent: string | undefined, depth: number) => {
    for (const topic of list.filter((one) => one.parent === parent).sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ topic, depth })
      walk(topic.id, depth + 1)
    }
  }
  walk(undefined, 0)
  return out
}

/**
 * Whether a topic may be picked for the scope: `free`; already relevant there
 * (`here`, by its own link or through the topic it is under); coming with a
 * topic picked or relevant above it (`with`, which `withName` names); or not
 * the person's to change (`readOnly`).
 */
export type TopicChoiceState = 'free' | 'here' | 'with' | 'readOnly'

export type TopicChoice = NestedTopic & {
  state: TopicChoiceState
  /** The topic above it that it comes with. */
  withName?: string
  /** What was typed matches it; a row kept only for a match below it does not. */
  matched: boolean
}

type ChoiceReads = Pick<TopicsAccess, 'list' | 'relevantAt' | 'mayWrite'>

/** The chooser's rows for the scope at `at`, narrowed by `query`, with `picked` already ticked. */
export function topicChoices(access: ChoiceReads, at: ScopePath, query: string, picked: ReadonlySet<ScopePath>): TopicChoice[] {
  const list = access.list()
  const byId = new Map(list.map((one) => [one.id, one]))
  const here = new Set(access.relevantAt(at).map((one) => one.id))
  const above = (id: ScopePath) => [...here, ...picked].filter((other) => other !== id && isWithinScope(id, other) && byId.has(other))
  const rows = nested(list).map(({ topic, depth }): TopicChoice => {
    const matched = matchesQuery(query, [topic.name, topic.description])
    const carried = above(topic.id)[0]
    if (carried !== undefined) return { topic, depth, state: 'with', withName: byId.get(carried)!.name, matched }
    if (here.has(topic.id)) return { topic, depth, state: 'here', matched }
    return { topic, depth, state: access.mayWrite(topic.id) ? 'free' : 'readOnly', matched }
  })
  if (!query.trim()) return rows
  const shown = new Set(rows.filter((row) => row.matched).flatMap((row) => [row.topic.id, ...ancestorsIn(row.topic, byId)]))
  return rows.filter((row) => shown.has(row.topic.id))
}

/** The topics a topic is filed under, nearest first. */
function ancestorsIn(topic: TopicSummary, byId: ReadonlyMap<ScopePath, TopicSummary>): ScopePath[] {
  const out: ScopePath[] = []
  for (let parent = topic.parent; parent !== undefined; parent = byId.get(parent)?.parent) out.push(parent)
  return out
}
