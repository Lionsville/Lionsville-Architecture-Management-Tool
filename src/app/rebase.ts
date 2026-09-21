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
 * The unit here is the **fold**, not the step. A step that coalesces — a run of
 * keystrokes into one field, a drag and the routing after it — is one step on
 * the stack and several announcements outwards, and a caller that carries each
 * announcement somewhere else has each of them answered for separately. So one
 * of them can be settled while the next is still in flight, and the run that
 * has to come off the model is *that* fold's commands and not the whole step's.
 * A fold is named by its `changeId`; a step is still named by its `stepId`, and
 * naming the step means naming every fold of it.
 *
 * It is written over the smallest shape a fold can have, so it is a node test
 * over plain objects rather than a rendered hook. Order is stated once here
 * and never re-decided: a run is **oldest first**, the order the folds were
 * made in and the order they go back on. Taking one off walks it backwards.
 */
import { apply, transaction } from '../model'
import type { Command, Model } from '../model'
import type { CommandRefusal } from '../model'

/**
 * One announcement's worth of a step: what that fold applied, and what undoes
 * it.
 *
 * This is also the shape a caller supplies for a fold this stack no longer
 * holds (`RebaseRun.steps`), which is why it says nothing about a stack.
 */
export type StepFold = {
  /** What this fold is called: a UUID, unique to the one announcement it was. */
  changeId: string
  commands: Command[]
  /** Already in undo order, newest first — as the session records them. */
  inverses: Command[]
}

/** What this file needs to know about a step: its name, and the folds it is made of. */
export type StepRun = {
  stepId: string
  folds: StepFold[]
}

/** A fold picked off the stack, still knowing which step it belongs to. */
export type PickedFold = StepFold & { stepId: string }

/**
 * A step's two directions, as its folds make them: every fold's commands in
 * the order they were applied, and every fold's inverses in undo order.
 *
 * The session keeps these on the step as well, because undo wants the whole
 * step and not one fold of it; this is the statement of what they are, and the
 * one place that rebuilds them when a fold has been dropped.
 */
export function flatten(folds: readonly StepFold[]): { commands: Command[]; inverses: Command[] } {
  return {
    commands: folds.flatMap((fold) => fold.commands),
    inverses: [...folds].reverse().flatMap((fold) => fold.inverses),
  }
}

/**
 * The folds named by `ids`, in the order the stack holds them, and the ids
 * that name nothing.
 *
 * An id may name a whole step, and then every fold of it is in the run, or one
 * fold, and then only that one is. A caller that publishes per announcement
 * holds `changeId`s; a caller that thinks in steps holds `stepId`s; both are
 * read here, because a fold and the step it grew into are the same work under
 * two names.
 *
 * An id can name nothing for an ordinary reason — the step was trimmed when the
 * log reached its cap, or a caller is asking twice — so it is reported rather
 * than refused. A caller that still holds the body of such a fold hands it over
 * instead (`RebaseRun.steps`).
 */
export function pickRun(
  steps: readonly StepRun[],
  ids: readonly string[],
): { run: PickedFold[]; unknown: string[] } {
  const wanted = new Set(ids)
  const run: PickedFold[] = []
  const held = new Set<string>()
  for (const step of steps) {
    const whole = wanted.has(step.stepId)
    for (const fold of step.folds) {
      if (!whole && !wanted.has(fold.changeId)) continue
      run.push({ ...fold, stepId: step.stepId })
      held.add(fold.changeId)
      if (whole) held.add(step.stepId)
    }
  }
  return { run, unknown: ids.filter((id) => !held.has(id)) }
}

/**
 * Take a run off the model: its inverses, newest fold first.
 *
 * All or nothing. An inverse the reducer refuses means the model is no longer
 * the one the run was made against, and a half-unwound model is worse than an
 * untouched one — so the caller is given the key and decides.
 */
export function unwind(
  model: Model,
  run: readonly StepFold[],
): { ok: true; model: Model } | { ok: false; reason: CommandRefusal } {
  let next = model
  for (let i = run.length - 1; i >= 0; i -= 1) {
    const result = apply(next, transaction(run[i].inverses))
    if (!result.ok) return result
    next = result.model
  }
  return { ok: true, model: next }
}

/** A fold that did not survive the way back, and the key that says why. */
export type DroppedStep = {
  changeId: string
  /** The step it was a fold of, where it came off this stack rather than from a caller. */
  stepId?: string
  reason: CommandRefusal
}

/**
 * Put a run back on the model, oldest fold first, dropping what the reducer now
 * refuses.
 *
 * Unlike `unwind` this is fold by fold rather than all or nothing: a rename
 * refused because somebody else removed the row is one fold to report, and the
 * unrelated folds after it still belong on the model. A fold that lands keeps
 * its place in the run; its inverse is recomputed, because the model it now
 * undoes is not the model it was made against.
 */
export function rewind<F extends StepFold>(
  model: Model,
  run: readonly F[],
): { model: Model; kept: F[]; dropped: DroppedStep[] } {
  let next = model
  const kept: F[] = []
  const dropped: DroppedStep[] = []
  for (const fold of run) {
    const result = apply(next, transaction(fold.commands))
    if (!result.ok) {
      dropped.push({ changeId: fold.changeId, reason: result.reason })
      continue
    }
    next = result.model
    kept.push({ ...fold, inverses: [result.inverse] })
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
