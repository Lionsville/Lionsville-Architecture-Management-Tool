/**
 * Taking a run of steps off a model and putting it back on (ADR-0002).
 *
 * A session records, for every step, the commands that made it and the exact
 * inverses that undo it. That pair is what lets a run of steps made here be
 * lifted off the model, a step made by another author applied underneath it,
 * and the run put back on top. This file is that arithmetic and nothing else:
 * no React, no stack, no policy about which steps are in the run — the session
 * hook composes it, and a caller that speaks to somewhere else decides what a
 * run is.
 *
 * It is written over the smallest shape a step can have, so it is a node test
 * over plain objects rather than a rendered hook. Order is stated once here
 * and never re-decided: a run is **oldest first**, the order the steps were
 * made in and the order they go back on. Taking one off walks it backwards.
 */
import { apply, transaction } from '../model'
import type { Command, Model } from '../model'
import type { CommandRefusal } from '../model'

/** What this file needs to know about a step: its name on the wire, and both directions. */
export type StepRun = {
  stepId: string
  commands: Command[]
  /** Already in undo order, newest first — as the session records them. */
  inverses: Command[]
}

/**
 * The steps named by `stepIds`, in the order the stack holds them, and the ids
 * that name nothing.
 *
 * An id can name nothing for an ordinary reason — the step was trimmed when the
 * log reached its cap, or a caller is asking twice — so it is reported rather
 * than refused.
 */
export function pickRun<S extends StepRun>(
  steps: readonly S[],
  stepIds: readonly string[],
): { run: S[]; unknown: string[] } {
  const wanted = new Set(stepIds)
  const run = steps.filter((step) => wanted.has(step.stepId))
  const held = new Set(run.map((step) => step.stepId))
  return { run, unknown: stepIds.filter((id) => !held.has(id)) }
}

/**
 * Take a run off the model: its inverses, newest step first.
 *
 * All or nothing. An inverse the reducer refuses means the model is no longer
 * the one the run was made against, and a half-unwound model is worse than an
 * untouched one — so the caller is given the key and decides.
 */
export function unwind(
  model: Model,
  run: readonly StepRun[],
): { ok: true; model: Model } | { ok: false; reason: CommandRefusal } {
  let next = model
  for (let i = run.length - 1; i >= 0; i -= 1) {
    const result = apply(next, transaction(run[i].inverses))
    if (!result.ok) return result
    next = result.model
  }
  return { ok: true, model: next }
}

/** A step that did not survive the way back, and the key that says why. */
export type DroppedStep = { stepId: string; reason: CommandRefusal }

/**
 * Put a run back on the model, oldest first, dropping what the reducer now
 * refuses.
 *
 * Unlike `unwind` this is step by step rather than all or nothing: a rename
 * refused because somebody else removed the row is one step to report, and the
 * unrelated steps after it still belong on the model. A step that lands keeps
 * its place in the run; its inverse is recomputed, because the model it now
 * undoes is not the model it was made against.
 */
export function rewind<S extends StepRun>(
  model: Model,
  run: readonly S[],
): { model: Model; kept: S[]; dropped: DroppedStep[] } {
  let next = model
  const kept: S[] = []
  const dropped: DroppedStep[] = []
  for (const step of run) {
    const result = apply(next, transaction(step.commands))
    if (!result.ok) {
      dropped.push({ stepId: step.stepId, reason: result.reason })
      continue
    }
    next = result.model
    kept.push({ ...step, inverses: [result.inverse] })
  }
  return { model: next, kept, dropped }
}

/**
 * The newest step a person may take back: the last one that is theirs.
 *
 * Another author's step sits on the stack because it happened and the Activity
 * list says so, but it is not ours to undo — and it does not make our own step
 * underneath it un-undoable either, so the walk steps over it and keeps going.
 * `-1` when there is nothing of ours left.
 */
export function newestOwn(steps: readonly { origin?: string }[]): number {
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    if (steps[i].origin !== 'remote') return i
  }
  return -1
}
