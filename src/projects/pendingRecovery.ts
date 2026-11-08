// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Put back what a page held and never wrote (`ports/PendingSteps.ts`): each
 * line applied to its scope expecting the revision it was made against, so a
 * scope that moved since — the write landed after all, another tab changed it,
 * it is not the scope it was — refuses it and is left as it is. A line answered
 * either way is let go of, since one refused now is refused at every try; one
 * that met a failure is kept for the next open.
 *
 * Answers how many lines were put back, for the one sentence that says so.
 */
import type { PendingSteps } from '../ports/PendingSteps'
import type { ScopeRepository } from '../ports/ScopeRepository'
import { nodeAt } from './scopeAccess'

export async function recoverPending(
  scopes: Pick<ScopeRepository, 'apply' | 'tree'>, pending: PendingSteps | undefined,
  report?: (message: string, cause?: unknown) => void,
): Promise<number> {
  if (!pending) return 0
  const lines = await pending.left()
  let put = 0
  for (const line of lines) {
    try {
      const scope = line.scope.id ?? nodeAt(await scopes.tree(), line.scope.address)?.id
      if (scope === undefined) { line.release(); continue }
      const answer = await scopes.apply([{ scope, steps: line.steps, expects: line.base }])
      line.release()
      if ('refused' in answer) {
        report?.(`a held change was not put back: ${answer.refused}`)
        continue
      }
      put += 1
    } catch (cause) {
      // Kept for the next open: a source that could not be asked now has not said no.
      report?.('a held change could not be put back', cause)
    }
  }
  return put
}
