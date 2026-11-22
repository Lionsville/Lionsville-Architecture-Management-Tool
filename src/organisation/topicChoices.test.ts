// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The chooser's rows (ADR-0042 §4): nested, narrowed by what was typed, and each saying whether it may be picked. */
import { describe, expect, it } from 'vitest'
import { topicChoices } from './topicChoices'
import type { TopicSummary } from './TopicsContext'

const LIST: TopicSummary[] = [
  { id: 'topics/security', name: 'Security', description: 'Keeping out who should stay out', links: [] },
  { id: 'topics/security/identity', name: 'Identity', parent: 'topics/security', links: [] },
  { id: 'topics/data', name: 'Data', links: [] },
]

const reads = (writable: (id: string) => boolean = () => true) => ({ list: () => LIST, relevantAt: () => [], mayWrite: writable })

describe('the topics a scope may be given', () => {
  it('are nested by name, and a topic the person may not change is shown and not offered', () => {
    const rows = topicChoices(reads((id) => id !== 'topics/data'), 'sales', '', new Set())
    expect(rows.map((row) => [row.topic.id, row.depth, row.state])).toEqual([
      ['topics/data', 0, 'readOnly'], ['topics/security', 0, 'free'], ['topics/security/identity', 1, 'free'],
    ])
  })

  it('match on what a topic is about, and a picked topic carries its subtopics', () => {
    expect(topicChoices(reads(), 'sales', 'stay out', new Set()).map((row) => row.topic.id)).toEqual(['topics/security'])
    const carried = topicChoices(reads(), 'sales', '', new Set(['topics/security'])).find((row) => row.topic.id === 'topics/security/identity')
    expect(carried).toMatchObject({ state: 'with', withName: 'Security' })
  })
})
