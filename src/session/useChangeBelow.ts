// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A change to the analysis of a scope below, made from the page above
 * (ADR-0032 §2).
 *
 * **It is that scope's step.** A record is edited where it lives (ADR-0012
 * §7), so a sighting, a new cause or a link between the records of a scope
 * below is a step applied to that scope through the source's repositories —
 * never a step on the session open here, whose undo stack it would otherwise
 * join. So ⌘Z on the page above does not reach it; that scope's history does,
 * as every step applied to it does, and so does its Activity list where the
 * source keeps a log of every step (`SourceRecentActivity`).
 *
 * **The commands are the page's own.** The four lists are turned into
 * commands the way the page's whole-lists path turns its own
 * (`model/commands.ts`), and applied as one step, as one submit is one step
 * here (ADR-0002). The scope's writer applies it, so a change it refuses — a
 * root cause somebody explains, a cause again that a solution addresses — is
 * refused below as it is here, with the same key, and nothing is written.
 *
 * **Expecting what was read** (`projects/scopeAccess.changeScope`): over a
 * scope somebody changed in between, the commands are worked out again from
 * what it holds now.
 */
import { useCallback } from 'react'
import {
  causeList, causesToCommands, experimentList, experimentsToCommands, fromArrays, observationList,
  citationsToCommands, commentsToCommands, observationsToCommands, solutionList, solutionsToCommands, transaction,
} from '../model'
import type { Cause, Command, Comment, Experiment, Model, Observation, Solution } from '../model'
import type { Citation } from '../model/citable'
import type { CommandRefusal } from '../model/reducer'
import { ShellError } from '../platform/errors'
import type { ScopeRepository } from '../ports/ScopeRepository'
import { changeScope } from '../projects/scopeAccess'
import type { ScopeReader } from '../projects/scopeAccess'
import type { ScopePath } from '../projects/scopePath'
import { holdWrite } from './writeRefusals'

/**
 * A scope's analysis as a change below is handed it and hands it back: the
 * four lists, and the comments and citations where the change carries any.
 * The observations page's own `ObservationWork`, said in the model's words,
 * because what a window lends may not read a page; the page's type and this
 * one are held to each other where the workspace hands the hook to the page.
 */
export type WorkBelow = {
  observations: Observation[]
  causes: Cause[]
  solutions: Solution[]
  experiments: Experiment[]
  comments?: Comment[]
  citations?: readonly Citation[]
}

/** Where a change below went: landed, refused with the writer's key or because the scope is only read, or not made. */
export type ChangedBelow =
  | { ok: true }
  | { ok: false; reason: CommandRefusal | 'shell.scopeReadOnly' | 'readOnly' | 'gone' | 'unchanged' }

/** A change to a scope below, landed as that scope's step; `change` may be called more than once, so it only answers. */
export type ChangeBelow = (path: string, change: (work: WorkBelow) => WorkBelow | undefined) => Promise<ChangedBelow>

/** As much of a scope repository as a change below takes: read a scope, and apply a step to it. */
export type BelowScopes = ScopeReader & Pick<ScopeRepository, 'apply' | 'settle'>

/** The one step a change makes, from the scope's lists before it and after. */
export function stepFor(model: Model, next: WorkBelow): Command | undefined {
  const commands = [
    ...observationsToCommands(model, next.observations), ...causesToCommands(model, next.causes),
    ...solutionsToCommands(model, next.solutions), ...experimentsToCommands(model, next.experiments),
    // A thread a merge carried (ADR-0037 §6); a change that hands none back leaves them.
    ...(next.comments ? commentsToCommands(model, next.comments) : []),
    ...(next.citations ? citationsToCommands(model, next.citations) : []),
  ]
  if (commands.length === 0) return undefined
  return commands.length === 1 ? commands[0] : transaction(commands)
}

/**
 * A refusal the writer gave, as the page names one; anything else is not this
 * change's to say. A source that decides who may write refuses a scope the
 * person may only read with `shell.scopeReadOnly`, and the page says so.
 */
export function refusalOf(error: unknown): ChangedBelow | undefined {
  if (!(error instanceof ShellError)) return undefined
  if (error.key === 'shell.scopeGone') return { ok: false, reason: 'gone' }
  if (error.key === 'shell.scopeReadOnly') return { ok: false, reason: 'shell.scopeReadOnly' }
  return error.key.startsWith('command.') ? { ok: false, reason: error.key as CommandRefusal } : undefined
}

/**
 * Land `change` on the scope at `path`, as that scope's step. Answers where
 * it went: landed, refused by the writer with its key, or not made — nothing
 * to change, or no such scope.
 */
export async function landBelow(
  scopes: BelowScopes, path: ScopePath, change: (work: WorkBelow) => WorkBelow | undefined,
): Promise<ChangedBelow> {
  let made = false
  let found = false
  try {
    await holdWrite(scopes, changeScope(scopes, path, (held) => {
      found = true
      const model = fromArrays(held.model)
      const next = change({
        observations: observationList(model), causes: causeList(model),
        solutions: solutionList(model), experiments: experimentList(model),
      })
      const step = next && stepFor(model, next)
      made = step !== undefined
      return step ? [step] : undefined
    }))
  } catch (error) {
    const refused = refusalOf(error)
    if (refused) return refused
    throw error
  }
  if (made) return { ok: true }
  return { ok: false, reason: found ? 'unchanged' : 'gone' }
}

/**
 * The page's way to a scope below: {@link landBelow} over the source's
 * repositories, asked whether anything may be written first — a hook that
 * writes another scope asks `mayChange()` before it does — and the tree told
 * afterwards, so the index reads what landed.
 */
export function useChangeBelow(deps: {
  scopes: BelowScopes
  mayChange: () => boolean
  onTreeChanged?: () => void
}): ChangeBelow {
  const { scopes, mayChange, onTreeChanged } = deps
  return useCallback(async (path, change) => {
    if (!mayChange()) return { ok: false, reason: 'readOnly' }
    const landed = await landBelow(scopes, path, change)
    if (landed.ok) onTreeChanged?.()
    return landed
  }, [scopes, mayChange, onTreeChanged])
}
