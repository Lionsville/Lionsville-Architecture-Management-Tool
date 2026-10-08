// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A change to the analysis of several scopes as one, made from the
 * observations page (ADR-0035 §5): a merge across the tree.
 *
 * **Every scope's part is that scope's step.** A record is edited where it
 * lives, so each scope the change writes gets the commands its own lists
 * turn into (`stepFor`, as a change below does), and the scopes other than
 * the open one are written in **one** `apply` over the source's
 * repositories, each expecting the revision read: all of them land, or none
 * does (`projects/scopeAccess.changeScopes`).
 *
 * **The open scope's part goes through its session**, never through the
 * repository. The session may hold work it has not written yet, which a
 * read of the repository would not see and a step applied there would land
 * beside; and the session writes expecting the revision it last saw, so a
 * step written past it would come back as *changed elsewhere* on the next
 * save — in every source, and as a step another author made where the
 * source carries steps. So the open scope is read from the session, and its
 * part is dispatched there once the other scopes have landed: one step on
 * this page's stack, with a barrier where other scopes were written,
 * because ⌘Z can take back this scope's part and not theirs (ADR-0012 §10).
 * It is asked of the reducer before anything is applied, so a part this
 * session would refuse refuses the whole; and, where the source writes
 * rather than carries steps, it is written at once, so the merge is kept
 * when it is said to be (as a gesture across scopes is, `useGestures`).
 *
 * **Who may change what is asked first.** Nothing is written unless the
 * person may change every scope the change writes (`writable`); the
 * repository refuses a scope it will not let them write anyway
 * (`shell.scopeReadOnly`), and nothing is written then either.
 */
import { useCallback } from 'react'
import { causeList, experimentList, fromArrays, observationList, solutionList } from '../model'
import type { Command, Model } from '../model'
import { apply } from '../model/reducer'
import type { CommandRefusal } from '../model/reducer'
import { ACROSS_BARRIER } from '../observations/merge'
import type { ChangeAcross, ChangedAcross, ObservationWork } from '../observations/ui/ObservationsPage'
import { ShellError } from '../platform/errors'
import { changeScopes } from '../projects/scopeAccess'
import type { ScopePath } from '../projects/scopePath'
import type { ScopeCommand } from '../projects/scopeState'
import { stepFor } from './useChangeBelow'
import type { BelowScopes } from './useChangeBelow'

/** The open scope, as a change across reads and writes it: through the session over it. */
export type AcrossSession = {
  /** The model as it stands now, indexed: what its part is worked out from. */
  indexed: () => Model
  /** The one way in. Answers nothing where the reducer refused. */
  dispatch: (command: Command) => unknown
}

export type AcrossDeps = {
  /** The scope the session has open. */
  scope: ScopePath
  scopes: BelowScopes
  session: AcrossSession
  /** May the person change the scope at this path? */
  writable: (path: ScopePath) => boolean
  /** Write what the session holds now, and reject where it did not land. */
  save: () => Promise<void>
  /** The source carries every step of the open scope (`publishesSteps`): its dispatch is its write. */
  published?: boolean
}

/** A scope's four lists, as the page holds them. */
function workOf(model: Model): ObservationWork {
  return {
    observations: observationList(model), causes: causeList(model),
    solutions: solutionList(model), experiments: experimentList(model),
  }
}

/** A refusal thrown by `changeScopes`, as the page names one; anything else is not this change's to say. */
function refusedAcross(error: unknown): ChangedAcross | undefined {
  if (!(error instanceof ShellError)) return undefined
  if (error.key === 'shell.scopeGone') return { ok: false, reason: 'gone' }
  if (error.key === 'shell.scopeReadOnly') return { ok: false, reason: 'shell.scopeReadOnly' }
  if (error.key === 'shell.scopeMoved') return { ok: false, reason: 'shell.scopeMoved' }
  return error.key.startsWith('command.') ? { ok: false, reason: error.key as CommandRefusal } : undefined
}

/** What one working out of the change came to: the steps per scope, or why there are none. */
type Worked =
  | { steps: Map<ScopePath, ScopeCommand[]>; open?: Command }
  | { stop: ChangedAcross }

/**
 * The change worked out once, over what the other scopes hold as read and
 * what the session holds now: each written scope's step, the open scope's
 * apart, and every scope it writes asked whether it may be.
 */
function workOut(
  deps: AcrossDeps, paths: readonly ScopePath[], held: ReadonlyMap<ScopePath, { model: Parameters<typeof fromArrays>[0] }>,
  change: Parameters<ChangeAcross>[1],
): Worked {
  const models = new Map<ScopePath, Model>()
  for (const [path, one] of held) models.set(path, fromArrays(one.model))
  if (paths.includes(deps.scope)) models.set(deps.scope, deps.session.indexed())
  const next = change(new Map([...models].map(([path, model]) => [path, workOf(model)])))
  if (next === undefined) return { stop: { ok: false, reason: 'unchanged' } }
  if ('refused' in next) return { stop: { ok: false, reason: 'refused', refused: next.refused as string } }
  const steps = new Map<ScopePath, ScopeCommand[]>()
  let open: Command | undefined
  for (const [path, work] of next) {
    const model = models.get(path)
    if (!model) throw new Error(`a change across wrote a scope it did not read (${path})`)
    const step = stepFor(model, work)
    if (!step) continue
    if (!deps.writable(path)) return { stop: { ok: false, reason: 'shell.scopeReadOnly', scope: path } }
    if (path === deps.scope) open = step
    else steps.set(path, [step])
  }
  if (open) {
    const asked = apply(deps.session.indexed(), open)
    if (!asked?.ok) return { stop: { ok: false, reason: asked?.reason ?? 'unchanged' } }
  }
  if (steps.size === 0 && !open) return { stop: { ok: false, reason: 'unchanged' } }
  return { steps, ...(open ? { open } : {}) }
}

/**
 * Land `change` over the scopes at `paths`: the other scopes in one apply,
 * then the open scope's part through its session. Answers where it went.
 */
export async function landAcross(deps: AcrossDeps, paths: readonly ScopePath[], change: Parameters<ChangeAcross>[1]): Promise<ChangedAcross> {
  const others = [...new Set(paths)].filter((path) => path !== deps.scope)
  let worked: Worked | undefined
  try {
    const landed = await changeScopes(deps.scopes, others, (held) => {
      worked = workOut(deps, paths, held, change)
      return 'stop' in worked ? undefined : worked.steps
    })
    if (!landed) return { ok: false, reason: 'gone' }
  } catch (error) {
    const refused = refusedAcross(error)
    if (refused) return refused
    throw error
  }
  if (!worked || 'stop' in worked) return worked?.stop ?? { ok: false, reason: 'unchanged' }
  const changed = [...worked.steps.keys()]
  if (!worked.open) return { ok: true, changed }
  const elsewhere = changed.length > 0
  if (deps.session.dispatch({ ...worked.open, ...(elsewhere ? { barrier: ACROSS_BARRIER } : {}) }) === undefined) {
    return { ok: false, reason: 'partial', changed }
  }
  const all = [...changed, deps.scope]
  // Only where other scopes were written: a change to this scope alone is an
  // edit like any other, written when the session writes.
  if (!elsewhere || deps.published) return { ok: true, changed: all }
  try {
    await deps.save()
    return { ok: true, changed: all }
  } catch {
    // The step is on this page and will be written with its next write; the
    // other scopes have it already. The page says so.
    return { ok: true, changed: all, unsaved: true }
  }
}

/**
 * The page's way to change several scopes as one: {@link landAcross}, asked
 * whether anything may be written first, and the tree told afterwards where
 * another scope was written, so the index reads what landed.
 */
export function useChangeAcross(deps: AcrossDeps & {
  mayChange: () => boolean
  onTreeChanged?: () => void
}): ChangeAcross {
  const { scope, scopes, session, writable, save, published, mayChange, onTreeChanged } = deps
  return useCallback(async (paths, change) => {
    if (!mayChange()) return { ok: false, reason: 'readOnly' }
    const landed = await landAcross({ scope, scopes, session, writable, save, ...(published !== undefined ? { published } : {}) }, paths, change)
    if (landed.ok && landed.changed.some((path) => path !== scope)) onTreeChanged?.()
    return landed
  }, [scope, scopes, session, writable, save, published, mayChange, onTreeChanged])
}
