// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's architecture principles (ADR-0041): added, patched and removed.
 * Its groups are the scope's own record and change with `project.settings`.
 *
 * Two rules are the reducer's, whoever sends the step — the page, the agent,
 * a replay: a principle keeps at least one aspect, each numbered once and
 * never past the highest given (§2), and a change that sharpens an accepted
 * principle carries the note that says why (§4). Whether anything cites a
 * principle that is removed is a question about every scope below, which no
 * one scope's step can ask: the screen and the agent ask it first.
 */
import { principlesOf } from '../normalised'
import type { Principle } from '../principle'
import { aspectsRefusal, sharpenRefusal } from '../principle'
import { gone, ok, taken } from './handler'
import type { CommandTable, PatchKeys, Refused } from './handler'
import { drop, patched, put, withPrinciples } from './rows'
import { patchWrites } from './writes'

/** Every field of a principle but its id. */
const PRINCIPLE_FIELDS: PatchKeys<'principle.update'> = {
  number: true, title: true, statement: true, rationale: true, implications: true, keywords: true, aspects: true,
  lastAspect: true, groups: true, regime: true, status: true, question: true, acceptedOn: true, relations: true,
  sharpened: true, mergedInto: true,
}

/** Why a principle cannot be as it would be, or nothing. */
function principleRefusal(next: Principle, held?: Principle): Refused | undefined {
  const aspects = aspectsRefusal(next)
  if (aspects) return { ok: false, reason: aspects === 'aspectsEmpty' ? 'command.aspectsEmpty' : 'command.aspectNumber' }
  if (!next.title.trim()) return { ok: false, reason: 'command.titleEmpty' }
  if (held && sharpenRefusal(held, next)) return { ok: false, reason: 'command.sharpenNote' }
  return undefined
}

export const PRINCIPLE_COMMANDS = {
  'principle.add': {
    carries: { principle: true },
    writes: (command) => [`principle/${command.principle.id}`],
    apply(model, command, { meta }) {
      const { principle, at } = command
      if (principle.id in principlesOf(model)) return taken
      const refused = principleRefusal(principle)
      if (refused) return refused
      const rows = put(principlesOf(model), model.order.principles, principle.id, principle, at)
      return ok(withPrinciples(model, rows), { type: 'principle.remove', id: principle.id }, meta)
    },
  },

  'principle.update': {
    carries: { id: true, patch: true },
    patch: { keys: PRINCIPLE_FIELDS, row: (model, command) => principlesOf(model)[command.id] },
    writes: (command) => patchWrites(`principle/${command.id}`, command.patch),
    apply(model, command, { meta }) {
      const held = principlesOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const refused = principleRefusal(row, held)
      if (refused) return refused
      const rows = put(principlesOf(model), model.order.principles, command.id, row)
      return ok(withPrinciples(model, rows), { type: 'principle.update', id: command.id, patch: inverse }, meta)
    },
  },

  'principle.remove': {
    carries: { id: true },
    writes: (command) => [`principle/${command.id}`],
    apply(model, command, { meta }) {
      const held = principlesOf(model)[command.id]
      if (!held) return gone
      const at = model.order.principles.indexOf(command.id)
      const rows = drop(principlesOf(model), model.order.principles, command.id)
      return ok(withPrinciples(model, rows), { type: 'principle.add', principle: held, at }, meta)
    },
  },
} satisfies Partial<CommandTable>
