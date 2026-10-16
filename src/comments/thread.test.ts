// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** A thread and its counts (ADR-0037 §4), and a thread carried by a merge or a move (§6). */
import { describe, expect, it } from 'vitest'
import type { Comment } from '../model/comment'
import { commentCount, commentCounts, newestComments, recordKeyText, replyTarget, threadOf } from './thread'
import { carryThread, threadSize } from './travel'

const web = { kind: 'element' as const, id: 'web' }
const ob = { kind: 'observation' as const, id: 'ob-1' }
const said = (id: string, over: Partial<Comment> = {}): Comment => ({
  id, about: web, by: { person: 'pe-1' }, at: `2026-10-1${id.slice(-1)}T09:00:00Z`, body: id, ...over,
})
const removed = { at: '2026-10-19T09:00:00Z', by: { person: 'pe-1' } }

describe('a thread', () => {
  const comments = [
    said('cm-1'), said('cm-2', { about: ob }), said('cm-3', { replyTo: 'cm-1' }), said('cm-4', { body: '', removed }),
    said('cm-5', { replyTo: 'cm-4' }), said('cm-6', { replyTo: 'cm-9' }),
  ]

  it('is the comments about one record, oldest first, each with its replies under it', () => {
    expect(threadOf(comments, web).map(({ comment, replies }) => [comment.id, replies.map((one) => one.id)])).toEqual([
      ['cm-1', ['cm-3']], ['cm-4', ['cm-5']], ['cm-6', []],
    ])
    expect(threadOf(comments, ob).map(({ comment }) => comment.id)).toEqual(['cm-2'])
    expect(threadOf([], web)).toEqual([])
  })

  it('counts what says something, not a tombstone, per record and for each', () => {
    expect(commentCount(comments, web)).toBe(4)
    expect(commentCount(comments, { kind: 'decision', id: 'adr-1' })).toBe(0)
    expect([...commentCounts(comments)]).toEqual([[recordKeyText(web), 4], [recordKeyText(ob), 1]])
  })

  it('answers a reply by answering the comment it is under, so it stays one level deep', () => {
    expect(replyTarget(comments, 'cm-1')).toBe('cm-1')
    expect(replyTarget(comments, 'cm-3')).toBe('cm-1')
    expect(replyTarget(comments, 'cm-0')).toBeUndefined()
  })

  it('lists a scope’s newest comments first', () => {
    expect(newestComments(comments, 2).map((one) => one.id)).toEqual(['cm-6', 'cm-5'])
    expect(newestComments(comments, -1)).toEqual([])
  })
})

describe('a thread carried', () => {
  it('within a scope keeps every comment where it stood, about the survivor and saying where it came from', () => {
    const comments = [said('cm-1', { about: ob }), said('cm-2'), said('cm-3', { about: ob, replyTo: 'cm-1' })]
    const into = { kind: 'observation' as const, id: 'ob-2' }
    const carried = carryThread({ scope: 'a', comments }, { scope: 'a', comments }, ob, into)
    expect(carried.moved).toBe(2)
    expect(carried.from).toBe(carried.to)
    expect(carried.to).toEqual([
      said('cm-1', { about: into, from: { kind: 'observation', id: 'ob-1' } }), said('cm-2'),
      said('cm-3', { about: into, replyTo: 'cm-1', from: { kind: 'observation', id: 'ob-1' } }),
    ])
  })

  it('across scopes leaves the one and joins the other, keeping the first place a comment came from', () => {
    const leaving = [said('cm-1', { about: ob }), said('cm-2'), said('cm-3', { about: ob, from: { kind: 'observation', id: 'ob-7' } })]
    const arriving = [said('cm-8', { about: ob })]
    const carried = carryThread({ scope: 'north', comments: leaving }, { scope: '', comments: arriving }, ob, ob)
    expect(carried.from).toEqual([said('cm-2')])
    expect(carried.to).toEqual([
      said('cm-8', { about: ob }),
      said('cm-1', { about: ob, from: { kind: 'observation', id: 'ob-1', scope: 'north' } }),
      said('cm-3', { about: ob, from: { kind: 'observation', id: 'ob-7', scope: 'north' } }),
    ])
  })

  it('drops a from that names the record and scope it arrives at, and moves nothing where there is no thread', () => {
    const back = [said('cm-1', { about: ob, from: { kind: 'element', id: 'web', scope: '' } })]
    const carried = carryThread({ scope: 'north', comments: back }, { scope: '', comments: [] }, ob, web)
    expect(carried.to).toEqual([said('cm-1')])
    expect(carryThread({ scope: '', comments: [said('cm-2')] }, { scope: 'x', comments: [] }, ob, ob).moved).toBe(0)
    expect(threadSize([said('cm-1', { about: ob }), said('cm-2')], ob)).toBe(1)
  })
})
