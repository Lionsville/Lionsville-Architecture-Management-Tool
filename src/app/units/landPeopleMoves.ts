// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The people's moves written as one step (ADR-0036 §6): every old assignment
 * ends on its last day and every new one begins the day after, in every scope
 * they are kept in, together.
 *
 * **Each scope's part is that scope's step**, worked out by
 * `model/reorganisation.peopleMoveSteps`. The scopes other than the open one
 * are written in **one** `apply` over the source's repositories, each
 * expecting what was read, so all of them land or none does
 * (`projects/scopeAccess.changeScopes`), as leaving writes its ends
 * (`app/organisation/leaving.ts`). **The open scope's part goes through its
 * session**, for the reason `useChangeAcross.ts` gives: the session may hold
 * work not yet written. It is asked of the reducer before anything is
 * applied, so a part it would refuse refuses the whole.
 *
 * **Undo.** Where the open scope is the only one written — a plan filed where
 * its units are — the whole move is one step on its stack, and ⌘Z takes all
 * of it back. Where other scopes were written as well, ⌘Z here could take
 * back only this scope's part and leave the organisation half moved, which is
 * what writing it as one step is for: the stack refuses it, and says why.
 *
 * **What was read is what is written.** An assignment ended or taken away
 * since the list was drawn is passed over rather than refused, and an id
 * taken since is not written twice.
 */
import { useCallback } from 'react'
import { assignmentsOf, fromArrays } from '../../model/normalised'
import type { Model } from '../../model/normalised'
import type { Command } from '../../model/commands'
import { apply } from '../../model/reducer'
import type { StringKey } from '../../i18n'
import { ShellError } from '../../platform/errors'
import { changeScopes } from '../../projects/scopeAccess'
import type { ScopePath } from '../../projects/scopePath'
import type { ScopeCommand } from '../../projects/scopeState'
import type { BelowScopes } from '../useChangeBelow'

/** Why the open scope's part of a move written across scopes cannot be undone here. */
export const MOVE_BARRIER: StringKey = 'move.barrier'

export type MovePeopleDeps = {
  /** The scope open in this window. */
  scope: ScopePath
  scopes: BelowScopes
  session: { indexed(): Model; dispatch(command: Command): unknown }
  /** May the person change the scope at this path? */
  writable: (path: ScopePath) => boolean
  /** Write what the session holds now, and reject where it did not land. */
  save: () => Promise<void>
  /** The source carries every step of the open scope: its dispatch is its write. */
  published?: boolean
  onTreeChanged?: () => void
}

/** Where the moves went: the scopes written and how many ended and began, or why nothing was. */
export type PeopleMoved =
  | { ok: true; changed: ScopePath[]; ended: number; begun: number; unsaved?: true }
  | { ok: false; reason: string; scope?: ScopePath }

/** The commands that still apply to a scope as it is now, as its one step: none where nothing is left to do. */
export function stepIn(model: Model, commands: readonly Command[]): Command | undefined {
  const held = assignmentsOf(model)
  const still = commands.filter((command) => {
    if (command.type === 'assignment.add') return !(command.assignment.id in held)
    if (command.type === 'assignment.update' || command.type === 'assignment.remove') return command.id in held
    return true
  })
  if (still.length === 0) return undefined
  return still.length === 1 ? still[0] : { type: 'transaction', commands: still }
}

/** How many ends and beginnings a step holds. */
function counted(steps: readonly Command[]): { ended: number; begun: number } {
  const all = steps.flatMap((step) => (step.type === 'transaction' ? step.commands : [step]))
  return {
    ended: all.filter((one) => one.type === 'assignment.update' || one.type === 'assignment.remove').length,
    begun: all.filter((one) => one.type === 'assignment.add').length,
  }
}

/**
 * Land the moves: the other scopes in one apply, then the open scope's part
 * through its session. Answers where they went.
 */
export async function landPeopleMoves(deps: MovePeopleDeps, steps: ReadonlyMap<ScopePath, readonly Command[]>): Promise<PeopleMoved> {
  const paths = [...steps.keys()]
  const refusedHere = paths.find((path) => !deps.writable(path))
  if (refusedHere !== undefined) return { ok: false, reason: 'shell.scopeReadOnly', scope: refusedHere }
  const ownCommands = steps.get(deps.scope)
  const own = ownCommands ? stepIn(deps.session.indexed(), ownCommands) : undefined
  if (own) {
    const asked = apply(deps.session.indexed(), own)
    if (!asked?.ok) return { ok: false, reason: asked?.reason ?? 'unchanged', scope: deps.scope }
  }
  const others = paths.filter((path) => path !== deps.scope)
  const written: Command[] = []
  const changed: ScopePath[] = []
  if (others.length > 0) {
    try {
      const landed = await changeScopes(deps.scopes, others, (held) => {
        written.length = 0
        changed.length = 0
        const out = new Map<ScopePath, ScopeCommand[]>()
        for (const [path, scope] of held) {
          const step = stepIn(fromArrays(scope.model), steps.get(path) ?? [])
          if (!step) continue
          out.set(path, [step])
          written.push(step)
          changed.push(path)
        }
        return out
      })
      if (!landed) return { ok: false, reason: 'gone' }
    } catch (error) {
      if (error instanceof ShellError) return { ok: false, reason: error.key }
      throw error
    }
  }
  const elsewhere = changed.length > 0
  if (elsewhere) deps.onTreeChanged?.()
  if (own) {
    if (deps.session.dispatch({ ...own, ...(elsewhere ? { barrier: MOVE_BARRIER } : {}) }) === undefined) {
      return { ok: false, reason: 'partial', scope: deps.scope }
    }
    written.push(own)
    changed.push(deps.scope)
  }
  if (written.length === 0) return { ok: false, reason: 'unchanged' }
  const done = { ok: true as const, changed, ...counted(written) }
  if (!own || !elsewhere || deps.published) return done
  try {
    await deps.save()
    return done
  } catch {
    // The step is on this page and will be written with its next write; the other scopes have it already.
    return { ...done, unsaved: true }
  }
}

/** The people's moves as the screens land them: nothing where the scope open may not be changed. */
export type LandPeopleMoves = (steps: ReadonlyMap<ScopePath, readonly Command[]>) => Promise<PeopleMoved>

/** {@link landPeopleMoves}, asked first whether anything may be written here. */
export function useLandPeopleMoves(deps: MovePeopleDeps & { mayChange: () => boolean }): LandPeopleMoves {
  const { scope, scopes, session, writable, save, published, onTreeChanged, mayChange } = deps
  return useCallback(async (steps) => {
    if (!mayChange()) return { ok: false, reason: 'readOnly' }
    return landPeopleMoves({
      scope, scopes, session, writable, save, ...(published !== undefined ? { published } : {}), ...(onTreeChanged ? { onTreeChanged } : {}),
    }, steps)
  }, [scope, scopes, session, writable, save, published, onTreeChanged, mayChange])
}
