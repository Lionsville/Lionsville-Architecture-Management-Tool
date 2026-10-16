// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's comments (ADR-0037 §8): `comments.list`, `comment.add`,
 * `comment.update` and `comment.remove`, generic over every kind the registry
 * opts in (`model/commentable.ts`) — so a kind taken on later is commented on
 * by an agent with no line here.
 *
 * **A comment is about a record and never changes it.** What the record
 * should say is changed in the record.
 *
 * **An agent's comment is its person's**, with `via` the client's name, as
 * its steps are. Its person is who the source says is using the app, or this
 * install's *This is me*; where neither says anybody the add is refused, and
 * the detail says how the person says who they are. It edits its person's
 * comments only, and removes its person's — and, where the source lets its
 * person moderate the scope, anybody's.
 *
 * A record is named by its id, or by the label people call it by
 * (`OB-0007`, `RC-0002`, `ADR-0003`, `TR-0001`), as every other tool names it.
 */
import { isRemoved } from '../model/comment'
import type { Comment } from '../model/comment'
import { COMMENTABLE_KINDS, commentedName, isCommentable } from '../model/commentable'
import type { CommentableKind } from '../model/commentable'
import {
  causeList, commentList, commentsOf, decisionList, experimentList, observationList, solutionList, transitionList,
} from '../model/normalised'
import type { Model } from '../model/normalised'
import { pickedPerson } from '../model/person'
import { findTransition } from '../model/transition'
import { commentCount, newestComments, replyTarget, threadOf } from '../comments/thread'
import type { RecordKey } from '../model/recordKey'
import type { AgentAnswer } from './tools'
import { json, refused } from './tools'
import type { Args, Handler } from './write/shared'

/** How many of a scope's newest comments `comments.list` answers where no record is named. */
const NEWEST = 20

/** A numbered record by its id, or by what people call it — `OB-3`, `ob-0003`, the bare number — as the other tools find one. */
function numbered(list: readonly { id: string; number: number }[], idOrLabel: string, prefix: string): string | undefined {
  const held = list.find((one) => one.id === idOrLabel)
  if (held) return held.id
  const number = new RegExp(`^(?:${prefix}-?)?(\\d+)$`, 'i').exec(idOrLabel.trim())
  return number ? list.find((one) => one.number === Number(number[1]))?.id : undefined
}

/** The record a kind and an id or label name, as its id; nothing where the scope holds none. */
export function recordId(model: Model, kind: CommentableKind, idOrLabel: string): string | undefined {
  switch (kind) {
    case 'element': return model.elements[idOrLabel] ? idOrLabel : undefined
    case 'observation': return numbered(observationList(model), idOrLabel, 'ob')
    // CA and RC share the number (ADR-0032 §3): either label finds the cause.
    case 'cause': return numbered(causeList(model), idOrLabel, '(?:ca|rc)')
    case 'solution': return numbered(solutionList(model), idOrLabel, 'so')
    case 'experiment': return numbered(experimentList(model), idOrLabel, 'ex')
    case 'transition': return findTransition(transitionList(model), idOrLabel)?.id
    case 'decision': return numbered(decisionList(model), idOrLabel, 'adr')
  }
}

/** `about` as a request says it, resolved to a record of this scope — or the refusal that says why not. */
export function aboutOf(model: Model, about: unknown): RecordKey | AgentAnswer {
  const held = (about ?? {}) as { kind?: unknown; id?: unknown }
  const kind = String(held.kind ?? '')
  if (!isCommentable(kind)) {
    return refused('command.notCommentable', `${kind || 'no kind'}: comments are on ${COMMENTABLE_KINDS.join(', ')}`)
  }
  const id = recordId(model, kind, String(held.id ?? ''))
  if (id === undefined) return refused('command.unknownRecord', `${kind} ${String(held.id)} is not in this scope`)
  return { kind, id }
}

/** One comment as the agent reads it: its author by register id, which the answer names (`persons.ts`). */
function line(comment: Comment): Record<string, unknown> {
  return {
    id: comment.id,
    by: comment.by,
    at: comment.at,
    ...(isRemoved(comment) ? { removed: true, removedAt: comment.removed!.at } : { body: comment.body }),
    ...(comment.replyTo !== undefined ? { replyTo: comment.replyTo } : {}),
    ...(comment.edited !== undefined ? { edited: comment.edited } : {}),
    ...(comment.via !== undefined ? { via: comment.via } : {}),
    ...(comment.from !== undefined ? { from: comment.from } : {}),
  }
}

/**
 * `comments.list`: the thread of one record, the replies under the comment
 * they answer; or, where no record is named, the scope's newest comments
 * with the record each is about. A removed comment is a tombstone.
 */
export function listComments(args: Args, view: { readonly model: Model }): AgentAnswer {
  const { model } = view
  const comments = commentList(model)
  if (args.about === undefined) {
    const limit = typeof args.limit === 'number' ? args.limit : NEWEST
    return json({
      total: comments.length,
      comments: newestComments(comments, limit).map((one) => ({
        ...line(one), about: { ...one.about, title: commentedName(model, one.about) },
      })),
    })
  }
  const about = aboutOf(model, args.about)
  if ('ok' in about) return about
  return json({
    about: { ...about, title: commentedName(model, about) },
    count: commentCount(comments, about),
    thread: threadOf(comments, about).map(({ comment, replies }) => ({
      ...line(comment), ...(replies.length > 0 ? { replies: replies.map(line) } : {}),
    })),
  })
}

/** The reads of one commentable record, and the kind each reads. */
const READS_A_RECORD: Readonly<Record<string, CommentableKind>> = {
  'element.describe': 'element', 'observation.read': 'observation', 'cause.read': 'cause', 'solution.read': 'solution',
  'experiment.read': 'experiment', 'decision.read': 'decision', 'plan.read': 'transition',
}

/**
 * A read of a commentable record, answered with how many comments it has
 * (ADR-0037 §8) where it has any; every other answer as it is. The record is
 * this scope's: a decision of a scope above is read here and commented there.
 */
export function withCommentCount(tool: string, rawArgs: unknown, model: Model, said: AgentAnswer): AgentAnswer {
  const kind = READS_A_RECORD[tool]
  const block = said.ok ? said.content[0] : undefined
  if (!kind || block?.type !== 'text') return said
  const id = recordId(model, kind, String((rawArgs as { id?: unknown } | undefined)?.id ?? ''))
  const count = id === undefined ? 0 : commentCount(commentList(model), { kind, id })
  return count === 0 ? said : json({ ...JSON.parse(block.text) as object, comments: count })
}

/** Now, as an ISO date and time: the view's clock where it has one. */
const nowOf = (view: { now?: () => string }) => view.now?.() ?? new Date().toISOString()

const NO_AUTHOR = 'nobody is said to be the person using the app here: they say who they are once with This is me on the People page, or by writing a comment of their own'

export const addComment: Handler = (args, view) => {
  const about = aboutOf(view.model, args.about)
  if ('ok' in about) return about
  const me = view.me?.()
  if (me === undefined) return refused('agent.badArguments', NO_AUTHOR)
  const replyTo = typeof args.replyTo === 'string' ? replyTarget(commentList(view.model), args.replyTo) : undefined
  if (typeof args.replyTo === 'string' && replyTo === undefined) return refused('agent.unknownId', `comment ${args.replyTo}`)
  const comment: Comment = {
    id: view.makeId('cm'), about, by: pickedPerson(me), at: nowOf(view), body: String(args.body),
    ...(replyTo !== undefined ? { replyTo } : {}),
    via: view.client ?? 'an agent',
  }
  return { command: { type: 'comment.add', comment, origin: 'agent' }, answer: json({ ...line(comment), about }) }
}

/** The comment a request names, held by this scope; or the refusal. */
function heldComment(model: Model, id: unknown): Comment | AgentAnswer {
  const held = commentsOf(model)[String(id)]
  return held ?? refused('agent.unknownId', `comment ${String(id)}`)
}

export const updateComment: Handler = (args, view) => {
  const held = heldComment(view.model, args.id)
  if ('ok' in held) return held
  const me = view.me?.()
  if (me === undefined || held.by.person !== me) return refused('agent.badArguments', 'a comment is edited by its author only, and this one is somebody else\'s')
  const edited = nowOf(view)
  return {
    command: { type: 'comment.update', id: held.id, body: String(args.body), edited, origin: 'agent' },
    answer: json({ ...line({ ...held, body: String(args.body), edited }), about: held.about }),
  }
}

export const removeComment: Handler = (args, view) => {
  const held = heldComment(view.model, args.id)
  if ('ok' in held) return held
  const me = view.me?.()
  if (me === undefined) return refused('agent.badArguments', NO_AUTHOR)
  if (held.by.person !== me && view.mayModerate?.() === false) {
    return refused('agent.readOnly', 'this comment is somebody else\'s, and the person this agent acts for may not remove other people\'s comments here')
  }
  const removed = { at: nowOf(view), by: pickedPerson(me) }
  return {
    command: { type: 'comment.remove', id: held.id, removed, origin: 'agent' },
    answer: json({ ...line({ ...held, body: '', removed }), about: held.about }),
  }
}

