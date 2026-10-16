// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A comment written, edited, removed — and taken out whole (ADR-0037 §5).
 *
 * **The writer checks the shape, never the person.** The record is there and
 * its kind is commentable (`model/commentable.ts`), a reply answers a comment
 * about the same record that is not a reply itself, and a removed comment is
 * not changed again. Whether the person sending the step may comment, or may
 * change this comment, is the source's to say at its doors: the reducer knows
 * no accounts (§5).
 *
 * **Remove leaves a tombstone**: the body emptied and `removed` set, so the
 * replies under it keep their place. `comment.take` is the other way out —
 * the comment gone whole — and is what undoes an add and what a deletion, a
 * merge or a move writes for a thread that leaves with its record. A take,
 * an update and a removal are undone by `comment.put`, which puts the comment
 * back as it was, where it stood, and asks nothing: it was there.
 */
import { isCommentable, holdsCommentable } from '../commentable'
import type { Comment } from '../comment'
import { isAbout } from '../comment'
import type { CommandMeta } from '../commands'
import { commentsOf } from '../normalised'
import type { Model } from '../normalised'
import { gone, ok, taken } from './handler'
import type { ApplyResult, CommandTable, CommandRefusal } from './handler'
import { drop, put, withComments } from './rows'

const refused = (reason: CommandRefusal) => ({ ok: false, reason }) as const

/** Why a comment cannot be written into this model, or nothing. */
function addRefusal(model: Model, comment: Comment): CommandRefusal | undefined {
  if (!isCommentable(comment.about.kind)) return 'command.notCommentable'
  if (!holdsCommentable(model, comment.about)) return 'command.unknownRecord'
  if (comment.replyTo === undefined) return undefined
  const answered = commentsOf(model)[comment.replyTo]
  if (!answered || answered.replyTo !== undefined || !isAbout(answered, comment.about)) return 'command.badReply'
  return undefined
}

/** A comment changed in place: the new row, and the step that puts the old one back. */
function changed(model: Model, held: Comment, next: Comment, meta: CommandMeta): ApplyResult {
  const rows = put(commentsOf(model), model.order.comments, held.id, next)
  return ok(withComments(model, rows), { type: 'comment.put', comment: held }, meta)
}

export const COMMENT_COMMANDS = {
  'comment.add': {
    carries: { comment: true },
    writes: (command) => [`comment/${command.comment.id}`],
    apply(model, command, { meta }) {
      const { comment, at } = command
      if (comment.id in commentsOf(model)) return taken
      const refusal = addRefusal(model, comment)
      if (refusal) return refused(refusal)
      const rows = put(commentsOf(model), model.order.comments, comment.id, comment, at)
      return ok(withComments(model, rows), { type: 'comment.take', id: comment.id }, meta)
    },
  },

  'comment.update': {
    carries: { id: true, body: true, edited: true },
    writes: (command) => [`comment/${command.id}`],
    apply(model, command, { meta }) {
      const held = commentsOf(model)[command.id]
      if (!held) return gone
      if (held.removed) return refused('command.commentRemoved')
      return changed(model, held, { ...held, body: command.body, edited: command.edited }, meta)
    },
  },

  'comment.remove': {
    carries: { id: true, removed: true },
    writes: (command) => [`comment/${command.id}`],
    apply(model, command, { meta }) {
      const held = commentsOf(model)[command.id]
      if (!held) return gone
      if (held.removed) return refused('command.commentRemoved')
      return changed(model, held, { ...held, body: '', removed: command.removed }, meta)
    },
  },

  'comment.take': {
    carries: { id: true },
    writes: (command) => [`comment/${command.id}`],
    apply(model, command, { meta }) {
      const held = commentsOf(model)[command.id]
      if (!held) return gone
      const at = model.order.comments.indexOf(command.id)
      const rows = drop(commentsOf(model), model.order.comments, command.id)
      return ok(withComments(model, rows), { type: 'comment.put', comment: held, at }, meta)
    },
  },

  'comment.put': {
    carries: { comment: true },
    writes: (command) => [`comment/${command.comment.id}`],
    apply(model, command, { meta }) {
      const { comment, at } = command
      const held = commentsOf(model)[comment.id]
      const rows = put(commentsOf(model), model.order.comments, comment.id, comment, at)
      return ok(withComments(model, rows), held ? { type: 'comment.put', comment: held } : { type: 'comment.take', id: comment.id }, meta)
    },
  },
} satisfies Partial<CommandTable>
