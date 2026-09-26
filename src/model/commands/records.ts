// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** A scope's decision records, and its plans (ADR-0009): added, patched, removed. */
import { decisionsOf, transitionsOf } from '../normalised'
import { gone, ok, taken } from './handler'
import type { CommandTable } from './handler'
import { drop, patched, put, withDecisions, withTransitions } from './rows'

export const DECISION_COMMANDS = {
  'decision.add': {
    apply(model, command, { meta }) {
      const { decision, at } = command
      if (decision.id in decisionsOf(model)) return taken
      const rows = put(decisionsOf(model), model.order.decisions, decision.id, decision, at)
      return ok(withDecisions(model, rows), { type: 'decision.remove', id: decision.id }, meta)
    },
  },

  'decision.update': {
    apply(model, command, { meta }) {
      const held = decisionsOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(decisionsOf(model), model.order.decisions, command.id, row)
      return ok(withDecisions(model, rows), { type: 'decision.update', id: command.id, patch: inverse }, meta)
    },
  },

  'decision.remove': {
    apply(model, command, { meta }) {
      const held = decisionsOf(model)[command.id]
      if (!held) return gone
      const at = model.order.decisions.indexOf(command.id)
      const rows = drop(decisionsOf(model), model.order.decisions, command.id)
      return ok(withDecisions(model, rows), { type: 'decision.add', decision: held, at }, meta)
    },
  },
} satisfies Partial<CommandTable>

export const TRANSITION_COMMANDS = {
  'transition.add': {
    apply(model, command, { meta }) {
      const { transition, at } = command
      if (transition.id in transitionsOf(model)) return taken
      const rows = put(transitionsOf(model), model.order.transitions, transition.id, transition, at)
      return ok(withTransitions(model, rows), { type: 'transition.remove', id: transition.id }, meta)
    },
  },

  'transition.update': {
    apply(model, command, { meta }) {
      const held = transitionsOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(transitionsOf(model), model.order.transitions, command.id, row)
      return ok(withTransitions(model, rows), { type: 'transition.update', id: command.id, patch: inverse }, meta)
    },
  },

  'transition.remove': {
    apply(model, command, { meta }) {
      const held = transitionsOf(model)[command.id]
      if (!held) return gone
      const at = model.order.transitions.indexOf(command.id)
      const rows = drop(transitionsOf(model), model.order.transitions, command.id)
      return ok(withTransitions(model, rows), { type: 'transition.add', transition: held, at }, meta)
    },
  },
} satisfies Partial<CommandTable>
