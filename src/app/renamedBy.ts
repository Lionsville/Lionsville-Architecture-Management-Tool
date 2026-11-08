// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who else last renamed an element, read off the session's own history: what
 * a name being typed over is told when another author's rename lands under it
 * (`widgets/kit/PressName`). Only a step that arrived from elsewhere counts;
 * this keyboard's own renames name nobody.
 */
import type { Command } from '../model/commands'
import type { HistoryStep } from '../ports/ScopeSession'

export function renamedBy(history: readonly HistoryStep[], elementId: string): string | undefined {
  for (let at = history.length - 1; at >= 0; at -= 1) {
    const step = history[at]
    if (!step.commands.some((command) => renames(command, elementId))) continue
    return step.origin === 'remote' ? step.by : undefined
  }
  return undefined
}

function renames(command: Command, elementId: string): boolean {
  if (command.type === 'transaction') return command.commands.some((one) => renames(one, elementId))
  return command.type === 'element.update' && command.id === elementId && typeof command.patch.name === 'string'
}
