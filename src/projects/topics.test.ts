// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Topics (ADR-0042): what makes a scope one, where it is relevant on a day,
 * what the tree draws, and how a link is written, ended and carried.
 */
import { describe, expect, it } from 'vitest'
import {
  choosableScopes, endedOn, isTopic, isTopicLinkList, linkHolds, principleReadsAt, readdressLinks, relevantPlaces, stoppedToday, TOPICS_PLACE,
  topicFindings, topicRowsAt, topicsInForce, topicsOf, topicsRelevantAt, withDays, withLink, withoutLink,
} from './topics'
import type { TopicLink, TopicNode } from './topics'

const DAY = '2026-11-02'

/** An organisation with two domains, a topics place holding a topic and its subtopic, and a scope elsewhere that says it is relevant. */
const TREE: TopicNode[] = [
  { path: '' },
  { path: 'sales' },
  { path: 'sales/web' },
  { path: 'stock' },
  { path: 'topics' },
  { path: 'topics/security', relevantTo: [{ path: 'sales', from: '2026-01-01' }, { path: 'stock', from: '2025-01-01', until: '2025-12-31' }] },
  { path: 'topics/security/identity', relevantTo: [{ path: 'stock' }] },
  { path: 'stock/data', relevantTo: [{ path: 'sales/web', from: '2026-12-01' }] },
]

describe('what a topic is', () => {
  it('is a scope under the topics place, or one that says it is relevant somewhere, and every scope under one', () => {
    expect(topicsOf(TREE).map((one) => one.path)).toEqual(['stock/data', 'topics/security', 'topics/security/identity'])
    expect(isTopic(TOPICS_PLACE, TREE)).toBe(false)
    expect(isTopic('sales', TREE)).toBe(false)
    expect(isTopic('topics/security/identity', TREE)).toBe(true)
  })

  it('reads a list of links back only where every link names a scope and its days are days', () => {
    expect(isTopicLinkList([{ path: 'a', from: '2026-01-01' }, { path: 'b' }])).toBe(true)
    expect(isTopicLinkList([{ path: 'a', from: 'soon' }])).toBe(false)
    expect(isTopicLinkList([{ from: '2026-01-01' }])).toBe(false)
    expect(isTopicLinkList('a')).toBe(false)
  })
})

describe('where a topic is relevant on a day', () => {
  it('holds from its first day to its last, both included, each open where absent', () => {
    const link: TopicLink = { path: 'a', from: '2026-01-01', until: '2026-01-31' }
    expect([linkHolds(link, '2025-12-31'), linkHolds(link, '2026-01-01'), linkHolds(link, '2026-01-31'), linkHolds(link, '2026-02-01')])
      .toEqual([false, true, true, false])
    expect(linkHolds({ path: 'a' }, '1999-01-01')).toBe(true)
  })

  it('makes a subtopic relevant wherever its topic is, and wherever it says so itself', () => {
    expect(relevantPlaces('topics/security', TREE, DAY)).toEqual(['sales'])
    expect(relevantPlaces('topics/security/identity', TREE, DAY)).toEqual(['sales', 'stock'])
    // A link that starts later holds from then.
    expect(relevantPlaces('stock/data', TREE, DAY)).toEqual([])
    expect(relevantPlaces('stock/data', TREE, '2026-12-01')).toEqual(['sales/web'])
  })

  it('lists the topics relevant at a scope, and those in force there through the scopes above it', () => {
    expect(topicsRelevantAt('sales', TREE, DAY)).toEqual(['topics/security', 'topics/security/identity'])
    expect(topicsRelevantAt('sales/web', TREE, DAY)).toEqual([])
    expect(topicsInForce('sales/web', TREE, DAY)).toEqual(['topics/security', 'topics/security/identity'])
    // An ended link is history: it puts nothing in force.
    expect(topicsInForce('stock', TREE, '2025-06-01')).toEqual(['topics/security', 'topics/security/identity'])
    expect(topicsInForce('stock', TREE, DAY)).toEqual(['topics/security/identity'])
  })

  it('draws a row under a scope for each topic relevant to it, leaving out a subtopic its topic implies', () => {
    expect(topicRowsAt('sales', TREE, DAY)).toEqual(['topics/security'])
    expect(topicRowsAt('stock', TREE, DAY)).toEqual(['topics/security/identity'])
  })

  it('reads a principle where it is kept, above it, or through a topic in force there', () => {
    const reads = principleReadsAt(TREE, DAY)
    expect(reads('sales/web', 'sales')).toBe(true)
    expect(reads('sales/web', 'topics/security')).toBe(true)
    expect(reads('stock', 'topics/security')).toBe(false)
    expect(reads('stock', 'stock/data')).toBe(false)
  })
})

describe('writing a link', () => {
  const links: TopicLink[] = [{ path: 'a', from: '2026-01-01' }, { path: 'b', from: '2025-01-01', until: '2025-06-30' }]

  it('adds one from a day, but not a second to a scope a link already holds or will', () => {
    expect(withLink(links, 'c', DAY)).toEqual([...links, { path: 'c', from: DAY }])
    expect(withLink(links, 'a', DAY)).toEqual(links)
    // An ended one is history; the scope may be linked again.
    expect(withLink(links, 'b', DAY)).toEqual([...links, { path: 'b', from: DAY }])
  })

  it('ends one on its last day and keeps it, or takes out one that would end before it began', () => {
    expect(endedOn(links, links[0]!, '2026-10-31')).toEqual([{ path: 'a', from: '2026-01-01', until: '2026-10-31' }, links[1]])
    expect(endedOn(links, links[0]!, '2025-12-31')).toEqual([links[1]])
  })

  it('stops the link that holds today from today: yesterday is its last day, and one made today never held', () => {
    expect(stoppedToday(links, 'a', DAY)).toEqual([{ path: 'a', from: '2026-01-01', until: '2026-11-01' }, links[1]])
    expect(stoppedToday([{ path: 'a', from: DAY }], 'a', DAY)).toEqual([])
    expect(stoppedToday(links, 'b', DAY)).toEqual(links)
  })

  it('changes a link\'s days, an empty day open, and removes a link made by mistake without a trace', () => {
    expect(withDays(links, links[1]!, { from: '2025-02-01' })).toEqual([links[0], { path: 'b', from: '2025-02-01' }])
    expect(withoutLink(links, links[0]!)).toEqual([links[1]])
  })

  it('carries the links a move of a subtree names to their new addresses, and leaves the rest', () => {
    const named: TopicLink[] = [{ path: 'sales' }, { path: 'sales/web', from: DAY }, { path: 'salesforce' }]
    expect(readdressLinks(named, 'sales', 'markets/sales')).toEqual([{ path: 'markets/sales' }, { path: 'markets/sales/web', from: DAY }, { path: 'salesforce' }])
    expect(readdressLinks(named, '', 'x')).toEqual(named)
  })
})

describe('what the topics contradict', () => {
  it('finds a link, ended or not, to a scope the tree no longer holds, on the topic that keeps it', () => {
    const gone: TopicNode[] = [...TREE, { path: 'topics/data', relevantTo: [{ path: 'billing' }, { path: 'billing', until: '2025-01-01' }, { path: 'sales' }] }]
    expect(topicFindings(gone)).toEqual([
      { key: 'check.relevantGone', scope: 'topics/data', id: 'billing', name: 'billing', fields: ['billing'] },
    ])
    expect(topicFindings(TREE)).toEqual([])
  })
})

describe('the scopes a picker offers', () => {
  const label = (path: string) => path || 'Acme'
  const nodes = [
    { path: '' }, { path: 'operations' }, { path: 'operations/retail' },
    { path: 'topics' }, { path: 'topics/integration', relevantTo: [] }, { path: 'topics/integration/events' },
  ]

  it('lists every part of the organisation at its depth, and no topic and not the topics’ place', () => {
    expect(choosableScopes(nodes, label, false)).toEqual([
      { path: '', name: 'Acme', depth: 0 },
      { path: 'operations', name: 'operations', depth: 1 },
      { path: 'operations/retail', name: 'operations/retail', depth: 2 },
    ])
  })

  it('puts the topics first where they may be chosen, counted from their place', () => {
    expect(choosableScopes(nodes, label, true).slice(0, 3)).toEqual([
      { path: 'topics/integration', name: 'topics/integration', depth: 0, topic: true },
      { path: 'topics/integration/events', name: 'topics/integration/events', depth: 1, topic: true },
      { path: '', name: 'Acme', depth: 0 },
    ])
  })
})

