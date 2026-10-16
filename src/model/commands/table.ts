// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every command there is, and its entry: what `apply` looks a command up in.
 *
 * Each family file answers for a slice of the vocabulary in `../commands.ts`;
 * this puts the slices together and the type holds the sum to the whole of
 * `Command['type']`, so a command added to the vocabulary without an entry is
 * a type error here rather than a step the writer silently falls through.
 * One entry, one module: a command's entry is testable on its own.
 */
import type { CommandEntry, CommandTable, CommandType } from './handler'
import { DIAGRAM_COMMANDS } from './diagrams'
import { ELEMENT_COMMANDS } from './elements'
import { GROUP_COMMANDS } from './groups'
import { MEMBER_COMMANDS } from './members'
import { ASSIGNMENT_COMMANDS } from './assignments'
import { CHECK_MARK_COMMANDS } from './checkMarks'
import { COMMENT_COMMANDS } from './commenting'
import { OPERATING_RULE_COMMANDS, RESPONSIBILITY_COMMANDS, ROLE_COMMANDS, UNIT_TYPE_COMMANDS } from './operatingModel'
import { CAUSE_COMMANDS, EXPERIMENT_COMMANDS, OBSERVATION_COMMANDS, SOLUTION_COMMANDS } from './analysis'
import { PROJECT_COMMANDS } from './project'
import { DECISION_COMMANDS, TRANSITION_COMMANDS } from './records'
import { RELATION_COMMANDS } from './relations'
import { ROUTE_COMMANDS } from './routes'
import { drop, withComments } from './rows'
import { COMMENTABLE, COMMENTABLE_KINDS } from '../commentable'
import type { CommentableKind } from '../commentable'
import { isAbout } from '../comment'
import { transaction } from '../commands'
import type { Command } from '../commands'
import { commentsOf } from '../normalised'

const ENTRIES: CommandTable = {
  ...ELEMENT_COMMANDS,
  ...RELATION_COMMANDS,
  ...MEMBER_COMMANDS,
  ...GROUP_COMMANDS,
  ...ROUTE_COMMANDS,
  ...DIAGRAM_COMMANDS,
  ...DECISION_COMMANDS,
  ...TRANSITION_COMMANDS,
  ...OBSERVATION_COMMANDS,
  ...CAUSE_COMMANDS,
  ...SOLUTION_COMMANDS,
  ...EXPERIMENT_COMMANDS,
  ...UNIT_TYPE_COMMANDS,
  ...ROLE_COMMANDS,
  ...RESPONSIBILITY_COMMANDS,
  ...OPERATING_RULE_COMMANDS,
  ...ASSIGNMENT_COMMANDS,
  ...CHECK_MARK_COMMANDS,
  ...COMMENT_COMMANDS,
  ...PROJECT_COMMANDS,
}

/**
 * A record deleted takes its thread with it, in the same step, and undo
 * brings both back (ADR-0037 §6): the command that deletes a commentable
 * kind (`model/commentable.ts`) is wrapped once, here, rather than in every
 * family — so a kind opted in later takes its comments without a line of its
 * own. The thread goes after the record, and comes back after it, each
 * comment where it stood.
 */
function takingThread<K extends CommandType>(kind: CommentableKind, entry: CommandEntry<K>): CommandEntry<K> {
  return {
    ...entry,
    apply(model, command, context) {
      const result = entry.apply(model, command, context)
      if (!result.ok || model.order.comments.length === 0) return result
      const about = { kind, id: (command as unknown as { id: string }).id }
      const held = commentsOf(model)
      const undo: Command[] = []
      let next = result.model
      model.order.comments.forEach((id, at) => {
        if (!isAbout(held[id], about)) return
        undo.push({ type: 'comment.put', comment: held[id], at })
        next = withComments(next, drop(commentsOf(next), next.order.comments, id))
      })
      if (undo.length === 0) return result
      return { ok: true, model: next, inverse: transaction([result.inverse, ...undo], context.meta) }
    },
  }
}

function withThreads(table: CommandTable): CommandTable {
  const out: Record<string, unknown> = { ...table }
  for (const kind of COMMENTABLE_KINDS) {
    const type = COMMENTABLE[kind]
    out[type] = takingThread(kind, table[type] as CommandEntry<typeof type>)
  }
  return out as CommandTable
}

export const COMMAND_TABLE: CommandTable = withThreads(ENTRIES)
