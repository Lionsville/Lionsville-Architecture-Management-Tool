// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's comments (ADR-0037 §8): one thread read, or the scope's newest;
 * a comment written by the person the agent acts for via its client, a reply
 * to a reply landing under the comment above it, an edit of its own and a
 * removal — refused for a kind nobody comments on, a record the scope does
 * not hold, nobody to sign it, and somebody else's comment to edit; and the
 * reads of a commentable record saying how many comments it has.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import type { HostModel } from '../model/hostModel'
import { idPolicy } from '../model/keys'
import { commentList, fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import { apply } from '../model/reducer'
import { answer } from './answer'
import type { ReadTool } from './answer'
import { commandFor } from './commandFor'
import type { Prepared, WriteView } from './commandFor'
import { TOOL_NAMES } from './tools'
import type { AgentAnswer, ToolName } from './tools'
import { COMMENTABLE_KINDS } from '../model/commentable'
import { COMMENTABLE_TOOL_KINDS } from './tools'

const AT = '2026-10-16T09:00:00.000Z'
const host: HostModel = {
  name: 'Claims', relations: [], diagrams: [],
  elements: [{ id: 'web', kind: 'application', name: 'Webshop', lifecycle: 'live', isManaged: false, aspects: {} }],
  observations: [{ id: 'ob-1', number: 7, title: 'Claims stall', date: '2026-09-01', impact: 'minor', seen: 1, body: '', history: [] }],
  decisions: [{ id: 'adr-1', number: 3, title: 'Keep the ledger', status: 'proposed', date: '2026-09-01', body: '', signers: [] }],
  comments: [
    { id: 'cm-1', about: { kind: 'observation', id: 'ob-1' }, by: { person: 'pe-tom' }, at: '2026-10-01T09:00:00Z', body: 'Seen at the desk' },
    { id: 'cm-2', about: { kind: 'observation', id: 'ob-1' }, by: { person: 'pe-eva' }, at: '2026-10-02T09:00:00Z', body: 'Mine', replyTo: 'cm-1' },
  ],
}

let counter = 0
beforeEach(() => { counter = 0 })
function view(model: Model, over: Partial<WriteView> = {}): WriteView {
  return {
    model, current: () => toArrays(model), activeDiagramId: '', scopePath: 'acme/claims', ancestorDecisions: [],
    ids: idPolicy(() => []), makeId: (prefix) => `${prefix}-new-${++counter}`, today: () => '2026-10-16',
    translate: DEFAULT_TRANSLATE, containerName: (name) => name,
    me: () => 'pe-eva', client: 'Claude', now: () => AT, ...over,
  }
}

const parse = (held: AgentAnswer): Record<string, unknown> => {
  if (!held.ok || held.content[0].type !== 'text') throw new Error(`not an answer: ${JSON.stringify(held)}`)
  return JSON.parse(held.content[0].text) as Record<string, unknown>
}
const read = (tool: ReadTool, args: unknown, model = fromArrays(host)) => parse(answer(tool, args, view(model)))
function write(tool: ToolName, args: unknown, over: Partial<WriteView> = {}, model = fromArrays(host)): { model: Model; said: Record<string, unknown> } {
  const out = commandFor(tool, args, view(model, over))
  if ('ok' in out) throw new Error(`refused: ${JSON.stringify(out)}`)
  const applied = apply(model, (out as Prepared).command)
  if (!applied.ok) throw new Error(`reducer refused: ${applied.reason}`)
  return { model: applied.model, said: parse((out as Prepared).answer) }
}
function refusal(tool: ToolName, args: unknown, over: Partial<WriteView> = {}): string {
  const out = commandFor(tool, args, view(fromArrays(host), over))
  if (!('ok' in out) || out.ok) throw new Error(`not refused: ${JSON.stringify(out)}`)
  return out.refusal
}

describe('the four tools', () => {
  it('are offered, over the kinds the registry opts in and no other', () => {
    for (const tool of ['comments.list', 'comment.add', 'comment.update', 'comment.remove']) expect(TOOL_NAMES).toContain(tool)
    expect([...COMMENTABLE_TOOL_KINDS].sort()).toEqual([...COMMENTABLE_KINDS].sort())
  })
})

describe('comments.list', () => {
  it('reads one record’s thread by its label, the reply under the comment it answers', () => {
    expect(read('comments.list', { about: { kind: 'observation', id: 'OB-0007' } })).toEqual({
      about: { kind: 'observation', id: 'ob-1', title: 'Claims stall' },
      count: 2,
      thread: [{
        id: 'cm-1', by: { person: 'pe-tom' }, at: '2026-10-01T09:00:00Z', body: 'Seen at the desk',
        replies: [{ id: 'cm-2', by: { person: 'pe-eva' }, at: '2026-10-02T09:00:00Z', body: 'Mine', replyTo: 'cm-1' }],
      }],
    })
  })

  it('reads the scope’s newest comments where no record is named', () => {
    const said = read('comments.list', { limit: 1 })
    expect(said).toMatchObject({ total: 2, comments: [{ id: 'cm-2', about: { kind: 'observation', id: 'ob-1', title: 'Claims stall' } }] })
  })

  it('refuses a kind nobody comments on and a record this scope does not hold', () => {
    expect(answer('comments.list', { about: { kind: 'observation', id: 'ob-9' } }, view(fromArrays(host)))).toMatchObject({ ok: false, refusal: 'command.unknownRecord' })
    expect(answer('comments.list', { about: { kind: 'diagram', id: 'd1' } }, view(fromArrays(host)))).toMatchObject({ ok: false, refusal: 'agent.badArguments' })
  })
})

describe('comment.add', () => {
  it('signs a comment with the person the agent acts for, via its client', () => {
    const { model, said } = write('comment.add', { about: { kind: 'decision', id: 'ADR-0003' }, body: 'Why now?' })
    expect(commentList(model).at(-1)).toEqual({
      id: 'cm-new-1', about: { kind: 'decision', id: 'adr-1' }, by: { person: 'pe-eva' }, at: AT, body: 'Why now?', via: 'Claude',
    })
    expect(said).toMatchObject({ id: 'cm-new-1', about: { kind: 'decision', id: 'adr-1' } })
  })

  it('answers a reply by answering the comment it is under', () => {
    const { model } = write('comment.add', { about: { kind: 'observation', id: 'ob-1' }, body: 'Agreed', replyTo: 'cm-2' })
    expect(commentList(model).at(-1)).toMatchObject({ replyTo: 'cm-1' })
  })

  it('refuses nobody to sign it, an unknown record, an unknown reply, and a kind nobody comments on', () => {
    expect(refusal('comment.add', { about: { kind: 'element', id: 'web' }, body: 'x' }, { me: () => undefined })).toBe('agent.badArguments')
    expect(refusal('comment.add', { about: { kind: 'element', id: 'gone' }, body: 'x' })).toBe('command.unknownRecord')
    expect(refusal('comment.add', { about: { kind: 'element', id: 'web' }, body: 'x', replyTo: 'cm-9' })).toBe('agent.unknownId')
    expect(refusal('comment.add', { about: { kind: 'relation', id: 'r1' }, body: 'x' })).toBe('agent.badArguments')
  })
})

describe('comment.update and comment.remove', () => {
  it('edit their person’s own comment, and never somebody else’s', () => {
    const { model } = write('comment.update', { id: 'cm-2', body: 'Mine, again' })
    expect(commentList(model)[1]).toMatchObject({ body: 'Mine, again', edited: AT })
    expect(refusal('comment.update', { id: 'cm-1', body: 'Rewritten' })).toBe('agent.badArguments')
    expect(refusal('comment.update', { id: 'cm-9', body: 'x' })).toBe('agent.unknownId')
  })

  it('remove as a tombstone — their own, and another’s only where the person may moderate', () => {
    const { model, said } = write('comment.remove', { id: 'cm-1' })
    expect(commentList(model)[0]).toMatchObject({ body: '', removed: { at: AT, by: { person: 'pe-eva' } } })
    expect(said).toMatchObject({ id: 'cm-1', removed: true })
    expect(refusal('comment.remove', { id: 'cm-1' }, { mayModerate: () => false })).toBe('agent.mayNotModerate')
    expect(refusal('comment.remove', { id: 'cm-2' }, { me: () => undefined })).toBe('agent.badArguments')
  })
})

describe('the reads of a commentable record', () => {
  it('say how many comments it has, and nothing where it has none', () => {
    expect(read('observation.read', { id: 'ob-1' })).toMatchObject({ comments: 2 })
    expect(read('element.describe', { id: 'web' })).not.toHaveProperty('comments')
  })
})
