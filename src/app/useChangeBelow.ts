// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A change to the analysis of a scope below, made from the page above
 * (ADR-0032 §2).
 *
 * **It is that scope's step.** A record is edited where it lives (ADR-0012
 * §7), so a sighting, a new cause or a link between the records of a scope
 * below is written into that scope — never onto the session open here, whose
 * undo stack it would otherwise join. So ⌘Z on the page above does not reach
 * it; that scope's Activity list and history do.
 *
 * **Through the one writer.** The four lists are turned into commands the way
 * the page's own are (`useAnalysisActions`) and applied to the scope as read,
 * so a change the writer refuses — a root cause somebody explains, a cause
 * again that a solution addresses — is refused below as it is here, with the
 * same key, and nothing is written.
 *
 * **Expecting what was read** (`rewriteScope.ts`): a scope somebody saved in
 * between is read again and the change made again over their work.
 */
import { useCallback } from 'react'
import {
  causeList, causesToCommands, experimentList, experimentsToCommands, fromArrays, observationList,
  observationsToCommands, solutionList, solutionsToCommands, transaction,
} from '../model'
import { apply } from '../model/reducer'
import type { CommandRefusal } from '../model/reducer'
import type { HostModel } from '../model/hostModel'
import type { ChangeBelow, ChangedBelow, ObservationWork } from '../observations/ui/ObservationsPage'
import type { ScopeSnapshot } from '../projects/scope'
import type { ScopePath } from '../projects/scopePath'
import { rewriteScope } from './rewriteScope'
import type { RewriteStore } from './rewriteScope'

/** The four lists as a scope holds them: absent rather than empty, the way the folder reads them. */
function withLists(model: HostModel, work: ObservationWork): HostModel {
  const { observations: _o, causes: _c, solutions: _s, experiments: _e, ...rest } = model
  void [_o, _c, _s, _e]
  return {
    ...rest,
    ...(work.observations.length ? { observations: work.observations } : {}),
    ...(work.causes.length ? { causes: work.causes } : {}),
    ...(work.solutions.length ? { solutions: work.solutions } : {}),
    ...(work.experiments.length ? { experiments: work.experiments } : {}),
  }
}

/**
 * Land `change` on the scope at `path`, as that scope's step. Answers where
 * it went: landed, refused by the writer with its key, or not made — nothing
 * to change, or no such scope.
 */
export async function landBelow(
  scopes: RewriteStore, path: ScopePath, change: (work: ObservationWork) => ObservationWork | undefined,
): Promise<ChangedBelow> {
  let refused: CommandRefusal | undefined
  let found = false
  const written = await rewriteScope(scopes, path, (held): ScopeSnapshot | undefined => {
    refused = undefined
    found = held !== undefined
    if (!held) return undefined
    const model = fromArrays(held.model)
    const next = change({
      observations: observationList(model), causes: causeList(model),
      solutions: solutionList(model), experiments: experimentList(model),
    })
    if (!next) return undefined
    const commands = [
      ...observationsToCommands(model, next.observations), ...causesToCommands(model, next.causes),
      ...solutionsToCommands(model, next.solutions), ...experimentsToCommands(model, next.experiments),
    ]
    if (!commands.length) return undefined
    const result = apply(model, transaction(commands))
    if (!result.ok) {
      refused = result.reason
      return undefined
    }
    return {
      ...held,
      model: withLists(held.model, {
        observations: observationList(result.model), causes: causeList(result.model),
        solutions: solutionList(result.model), experiments: experimentList(result.model),
      }),
    }
  })
  if (written) return { ok: true }
  if (refused) return { ok: false, reason: refused }
  return { ok: false, reason: found ? 'unchanged' : 'gone' }
}

/**
 * The page's way to a scope below: {@link landBelow} over the store, asked
 * whether anything may be written first — a hook that writes another scope
 * asks `mayChange()` before it does — and the tree told afterwards, so the
 * index reads what landed.
 */
export function useChangeBelow(deps: {
  scopes: Partial<Pick<RewriteStore, 'load'>> & Pick<RewriteStore, 'save'>
  mayChange: () => boolean
  onTreeChanged?: () => void
}): ChangeBelow {
  const { scopes, mayChange, onTreeChanged } = deps
  return useCallback(async (path, change) => {
    if (!mayChange()) return { ok: false, reason: 'readOnly' }
    if (!scopes.load) return { ok: false, reason: 'gone' }
    const landed = await landBelow({ load: scopes.load.bind(scopes), save: scopes.save.bind(scopes) }, path, change)
    if (landed.ok) onTreeChanged?.()
    return landed
  }, [scopes, mayChange, onTreeChanged])
}
