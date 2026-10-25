// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Comments at the writer (ADR-0037): written, edited, removed as a tombstone
 * and taken out whole, each undone exactly; the shapes the writer refuses
 * whoever sends them; a record deleted taking its thread with it, and undo
 * bringing both back; and what the Activity list, the diff, a restore and a
 * step's records say about them.
 */
import { describe, expect, it } from 'vitest'
import { summarise } from '../activity'
import type { Comment } from '../comment'
import { commentsToCommands } from '../commands'
import type { Command } from '../commands'
import { COMMENTABLE_KINDS, commentedName, holdsCommentable, isCommentable } from '../commentable'
import { diffModels } from '../diff'
import { commentList, fromArrays, toArrays } from '../normalised'
import type { Model } from '../normalised'
import { recordsChanged } from '../recordKey'
import { apply, writesOf } from '../reducer'
import { restoreCommand } from '../restore'
import type { DesignElement } from '../types'

const app = (id: string, name: string): DesignElement => ({
  id, kind: 'application', name, lifecycle: 'live', isManaged: false, aspects: {},
})
const AT = '2026-10-16T09:00:00.000Z'
const first: Comment = { id: 'cm-1', about: { kind: 'element', id: 'web' }, by: { person: 'pe-1' }, at: AT, body: 'Who runs this?' }
const reply: Comment = { ...first, id: 'cm-2', by: { person: 'pe-2' }, body: 'The web team.', replyTo: 'cm-1' }
const onObservation: Comment = { ...first, id: 'cm-3', about: { kind: 'observation', id: 'ob-1' }, body: 'Seen it too.' }

function scope(over: Partial<Parameters<typeof fromArrays>[0]> = {}): Model {
  return fromArrays({
    name: 'Shop', elements: [app('web', 'Webshop'), app('pay', 'Payments')], relations: [], diagrams: [],
    observations: [{ id: 'ob-1', number: 1, title: 'Checkout is slow', date: '2026-10-01', impact: 'minor', seen: 1, body: '', history: [] }],
    ...over,
  })
}

function applied(model: Model, command: Command): Model {
  const result = apply(model, command)
  if (!result.ok) throw new Error(result.reason)
  return result.model
}

function undone(model: Model, command: Command): Model {
  const result = apply(model, command)
  if (!result.ok) throw new Error(result.reason)
  return applied(result.model, result.inverse)
}

describe('the registry', () => {
  it('opts in the analysis, then elements, decisions and plans, then principles (ADR-0041), one line each, and nothing else', () => {
    expect(COMMENTABLE_KINDS).toEqual(['observation', 'cause', 'solution', 'experiment', 'element', 'decision', 'transition', 'principle'])
    expect(isCommentable('diagram')).toBe(false)
    expect(isCommentable('comment')).toBe(false)
    expect(holdsCommentable(scope(), { kind: 'element', id: 'web' })).toBe(true)
    expect(holdsCommentable(scope(), { kind: 'element', id: 'gone' })).toBe(false)
    expect(holdsCommentable(scope(), { kind: 'decision', id: 'adr-1' })).toBe(false)
  })

  it('names a record by its title or its name, and by its id once it is gone', () => {
    expect(commentedName(scope(), { kind: 'element', id: 'web' })).toBe('Webshop')
    expect(commentedName(scope(), { kind: 'observation', id: 'ob-1' })).toBe('Checkout is slow')
    expect(commentedName(scope(), { kind: 'element', id: 'gone' })).toBe('gone')
    expect(commentedName(scope(), { kind: 'diagram', id: 'd1' })).toBe('d1')
  })
})

describe('a comment at the writer', () => {
  it('is written, and undoing it takes it out whole and leaves no list behind', () => {
    const empty = scope()
    const result = apply(empty, { type: 'comment.add', comment: first })
    expect(result.ok && commentList(result.model)).toEqual([first])
    expect(result.ok && result.inverse).toEqual({ type: 'comment.take', id: 'cm-1' })
    expect(undone(empty, { type: 'comment.add', comment: first })).toStrictEqual(empty)
  })

  it('is edited — the body and when, nothing else — and undone to what it said', () => {
    const held = scope({ comments: [first, reply] })
    const edited = applied(held, { type: 'comment.update', id: 'cm-1', body: 'Who owns this?', edited: '2026-10-17T08:00:00Z' })
    expect(commentList(edited)[0]).toEqual({ ...first, body: 'Who owns this?', edited: '2026-10-17T08:00:00Z' })
    expect(undone(held, { type: 'comment.update', id: 'cm-1', body: 'x', edited: AT })).toStrictEqual(held)
  })

  it('is removed as a tombstone the replies keep their place under, and undone exactly', () => {
    const held = scope({ comments: [first, reply] })
    const removed = { at: '2026-10-17T08:00:00Z', by: { person: 'pe-9' } }
    const after = applied(held, { type: 'comment.remove', id: 'cm-1', removed })
    expect(commentList(after)).toEqual([{ ...first, body: '', removed }, reply])
    expect(undone(held, { type: 'comment.remove', id: 'cm-1', removed })).toStrictEqual(held)
    // A tombstone stays as it is.
    expect(apply(after, { type: 'comment.update', id: 'cm-1', body: 'Back', edited: AT })).toEqual({ ok: false, reason: 'command.commentRemoved' })
    expect(apply(after, { type: 'comment.remove', id: 'cm-1', removed })).toEqual({ ok: false, reason: 'command.commentRemoved' })
  })

  it('refuses a kind nobody comments on, a record the scope does not hold, and a taken id', () => {
    const held = scope({ comments: [first] })
    expect(apply(held, { type: 'comment.add', comment: { ...reply, about: { kind: 'diagram', id: 'd1' } } })).toEqual({ ok: false, reason: 'command.notCommentable' })
    expect(apply(held, { type: 'comment.add', comment: { ...reply, about: { kind: 'element', id: 'gone' } } })).toEqual({ ok: false, reason: 'command.unknownRecord' })
    expect(apply(held, { type: 'comment.add', comment: { ...reply, id: 'cm-1' } })).toEqual({ ok: false, reason: 'command.taken' })
    expect(apply(held, { type: 'comment.update', id: 'cm-9', body: 'x', edited: AT })).toEqual({ ok: false, reason: 'command.gone' })
    expect(apply(held, { type: 'comment.take', id: 'cm-9' })).toEqual({ ok: false, reason: 'command.gone' })
  })

  it('keeps a thread one level deep: a reply to a reply, to another record or to nothing is refused', () => {
    const held = scope({ comments: [first, reply, onObservation] })
    expect(apply(held, { type: 'comment.add', comment: { ...reply, id: 'cm-4', replyTo: 'cm-2' } })).toEqual({ ok: false, reason: 'command.badReply' })
    expect(apply(held, { type: 'comment.add', comment: { ...reply, id: 'cm-4', replyTo: 'cm-3' } })).toEqual({ ok: false, reason: 'command.badReply' })
    expect(apply(held, { type: 'comment.add', comment: { ...reply, id: 'cm-4', replyTo: 'cm-9' } })).toEqual({ ok: false, reason: 'command.badReply' })
    expect(apply(held, { type: 'comment.add', comment: { ...reply, id: 'cm-4' } }).ok).toBe(true)
  })

  it('writes the one comment it touches', () => {
    expect(writesOf({ type: 'comment.add', comment: first })).toEqual(['comment/cm-1'])
    expect(writesOf({ type: 'comment.remove', id: 'cm-2', removed: { at: AT, by: { person: 'pe-1' } } })).toEqual(['comment/cm-2'])
  })
})

describe('a record deleted', () => {
  it('takes its thread in the same step, leaves the others, and undo brings both back where they stood', () => {
    const held = scope({ comments: [first, onObservation, reply] })
    const result = apply(held, { type: 'element.delete', id: 'web' })
    expect(result.ok && commentList(result.model)).toEqual([onObservation])
    const back = result.ok ? apply(result.model, result.inverse) : result
    expect(back.ok && back.model).toStrictEqual(held)
  })

  it('does so for every kind the registry names, through the list a page hands back', () => {
    const held = scope({ comments: [onObservation] })
    const result = apply(held, { type: 'observation.remove', id: 'ob-1' })
    expect(result.ok && 'comments' in toArrays(result.model)).toBe(false)
    expect(result.ok && apply(result.model, result.inverse)).toEqual({ ok: true, model: held, inverse: expect.anything() })
  })

  it('leaves a record with no thread exactly as before', () => {
    const held = scope({ comments: [first] })
    const result = apply(held, { type: 'element.delete', id: 'pay' })
    expect(result.ok && result.inverse.type).toBe('transaction')
    expect(result.ok && commentList(result.model)).toEqual([first])
  })
})

describe('a list of comments handed back', () => {
  it('is taken, added and moved as the changes that get there', () => {
    const held = scope({ comments: [first, reply] })
    const moved: Comment = { ...first, about: { kind: 'observation', id: 'ob-1' }, from: { kind: 'element', id: 'web' } }
    const commands = commentsToCommands(held, [moved, onObservation])
    expect(commands.map((one) => one.type)).toEqual(['comment.take', 'comment.take', 'comment.add', 'comment.add'])
    const after = applied(held, { type: 'transaction', commands })
    expect(commentList(after)).toEqual([moved, onObservation])
    expect(commentsToCommands(after, commentList(after))).toEqual([])
  })
})

describe('what a step about a comment is called', () => {
  it('names the record it is about, as it was called before the step', () => {
    const held = scope({ comments: [first] })
    expect(summarise([{ type: 'comment.add', comment: onObservation }], held)).toEqual({ key: 'activity.commentAdded', name: 'Checkout is slow' })
    expect(summarise([{ type: 'comment.update', id: 'cm-1', body: 'x', edited: AT }], held)).toEqual({ key: 'activity.commentEdited', name: 'Webshop' })
    expect(summarise([{ type: 'comment.remove', id: 'cm-1', removed: { at: AT, by: { person: 'pe-1' } } }], held)).toEqual({ key: 'activity.commentRemoved', name: 'Webshop' })
    expect(summarise([{ type: 'comment.take', id: 'cm-9' }], held)).toEqual({ key: 'activity.commentTaken' })
  })
})

describe('comments in a version’s history', () => {
  it('are a record each, in the diff by the record they are about, in what a step touched and in a restore', () => {
    const before = scope({ comments: [first] })
    const after = applied(applied(before, { type: 'comment.add', comment: reply }),
      { type: 'comment.update', id: 'cm-1', body: 'Who owns it?', edited: AT })
    expect(recordsChanged(before, after)).toEqual([{ kind: 'comment', id: 'cm-1' }, { kind: 'comment', id: 'cm-2' }])
    expect(diffModels(toArrays(before), toArrays(after)).map((change) => [change.kind, change.what, change.name, change.fields]))
      .toEqual([['changed', 'comment', 'Webshop', ['body', 'edited']], ['added', 'comment', 'Webshop', undefined]])
    const back = restoreCommand(before, after, undefined, '2026-10-01')
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(commentList(applied(after, back.command))).toEqual([first])
  })

  it('restore a deleted record with its thread, and take a thread a restore deletes the record of first', () => {
    const before = scope({ comments: [first, reply] })
    const after = applied(before, { type: 'element.delete', id: 'web' })
    const back = restoreCommand(before, after, undefined, '2026-10-01')
    expect(back.ok && commentList(applied(after, back.command))).toEqual([first, reply])
    const forward = restoreCommand(after, before, undefined, '2026-10-01')
    expect(forward.ok && commentList(applied(before, forward.command))).toEqual([])
  })
})
