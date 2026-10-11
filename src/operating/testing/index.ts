// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The operating model's suites' own harness: an organisation with nothing in
 * it, its lists as the page reads them, and commands applied through the one
 * writer, as a session would.
 */
import type { Command } from '../../model/commands'
import { fromArrays, operatingRuleList, responsibilityList, roleList, unitTypeList } from '../../model/normalised'
import type { Model } from '../../model/normalised'
import { apply } from '../../model/reducer'
import type { OperatingModel } from '../edit'

export function empty(): Model {
  return fromArrays({ name: 'Acme Logistics', elements: [], relations: [], diagrams: [] })
}

export function listsOf(model: Model): OperatingModel {
  return {
    unitTypes: unitTypeList(model), roles: roleList(model), responsibilities: responsibilityList(model),
    operatingRules: operatingRuleList(model),
  }
}

/** Each command applied in turn; a refusal fails the test that asked. */
export function applyAll(model: Model, commands: readonly Command[]): Model {
  let held = model
  for (const command of commands) {
    const result = apply(held, command)
    if (!result.ok) throw new Error(`refused: ${result.reason}`)
    held = result.model
  }
  return held
}
