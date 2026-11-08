// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a step on a scope is called, whatever it carries: the model's commands
 * named as `summarise` names them, and the scope's own — a content that
 * arrives whole, what a scope says about itself, its pictures — named here.
 *
 * `summarise` reads the model's commands only. A source that keeps a log of
 * every step (and lists it to a person or an agent) also holds steps that are
 * the scope's and not the model's: a scope landed whole from a page with
 * nothing open, a put back, a board made the one that opens. Such a step is
 * still somebody's change, so it is named rather than left out.
 */
import { summarise } from '../model/activity'
import type { StepSummary } from '../model/activity'
import type { Command } from '../model/commands'
import type { Model } from '../model/normalised'
import type { ScopeCommand } from './scopeState'

/** A step's command, as a log keeps it: one of the scope's, or a transaction of them. */
export function summariseStep(command: ScopeCommand, before: Model): StepSummary {
  const all: readonly ScopeCommand[] = command.type === 'transaction' && Array.isArray(command.commands) ? command.commands : [command]
  const model = all.filter((one): one is Command => !isScopesOwn(one))
  if (model.length > 0) return summarise(model, before)
  const replaced = all.find((one) => one.type === 'scope.replace')
  if (replaced?.type === 'scope.replace') {
    return replaced.putBack ? { key: 'activity.scopePutBack', name: replaced.putBack.subject } : { key: 'activity.scopeReplaced' }
  }
  if (all.some((one) => one.type.startsWith('image.'))) return { key: 'activity.picturesChanged' }
  return { key: 'activity.projectSettings' }
}

function isScopesOwn(command: ScopeCommand): boolean {
  return command.type === 'scope.replace' || command.type === 'scope.describe' || command.type.startsWith('image.')
}
