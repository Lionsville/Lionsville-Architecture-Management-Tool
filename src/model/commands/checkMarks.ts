// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A finding marked as intended, and the mark taken back (ADR-0036, amended
 * 11 October 2026; `model/checkMarks.ts`): two moves, each the other's
 * inverse. A mark is made once and taken back whole, so there is no update —
 * a reason said again is a mark taken back and made again, as a restore does.
 *
 * **One rule is the writer's**: only a review or a note is marked. A fix says
 * the model contradicts itself, and the answer to that is in the model, so
 * the writer refuses it whoever sent it — a screen, a step from another
 * author, a file pasted in — with `command.markFix`. A check the catalogue
 * does not know is refused the same way: nobody here can say its weight.
 * Taking a mark back is never refused but for one that is not there.
 */
import { checkMarkId, isMarkable } from '../checkMarks'
import { checkMarksOf } from '../normalised'
import { gone, ok, taken } from './handler'
import type { CommandTable } from './handler'
import { drop, put, withCheckMarks } from './rows'

const markFix = { ok: false, reason: 'command.markFix' } as const

export const CHECK_MARK_COMMANDS = {
  'checkMark.add': {
    carries: { mark: true },
    writes: (command) => [`checkMark/${checkMarkId(command.mark)}`],
    apply(model, command, { meta }) {
      const { mark, at } = command
      if (!isMarkable(mark.check)) return markFix
      const id = checkMarkId(mark)
      if (id in checkMarksOf(model)) return taken
      const rows = put(checkMarksOf(model), model.order.checkMarks, id, mark, at)
      return ok(withCheckMarks(model, rows), { type: 'checkMark.remove', id }, meta)
    },
  },

  'checkMark.remove': {
    carries: { id: true },
    writes: (command) => [`checkMark/${command.id}`],
    apply(model, command, { meta }) {
      const held = checkMarksOf(model)[command.id]
      if (!held) return gone
      const at = model.order.checkMarks.indexOf(command.id)
      const rows = drop(checkMarksOf(model), model.order.checkMarks, command.id)
      return ok(withCheckMarks(model, rows), { type: 'checkMark.add', mark: held, at }, meta)
    },
  },
} satisfies Partial<CommandTable>
