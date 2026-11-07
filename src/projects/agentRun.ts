// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A whole agent session as one thing to take back (ADR-0019, amended 7 November
 * 2026): an agent can land dozens of steps, and the place a person decides
 * whether they wanted them is the end, not step by step.
 *
 * **While its steps are the newest.** The run is the unbroken stretch of the
 * session's steps at the top of the history. Anybody's step on top of it, a
 * person's or a colleague's, means there is no run: taking the agent's work
 * out from under theirs is not a thing to do in one press. A two-scope gesture
 * inside it is where it stops, as ⌘Z stops there, and the answer says so.
 *
 * **Two ways back, because there are two kinds of log.** Where the stack is this
 * person's, the run is undone as one step (`ModelSession.undoRun`). Where the log
 * is everybody's, on a server, nothing is taken out of it: *Put back* lands the
 * inverses as one new step by the person pressing it ({@link putBackRun}), which
 * the writer refuses like any other if somebody got there first.
 */
import type { Command } from '../model/commands'
import type { HistoryStep } from '../ports/ScopeSession'

/** Whose session: its start, and on a server the author and the client its steps arrive under. */
export type AgentSessionOf = {
  /** When it started, in milliseconds. Absent: as far back as the steps are the agent's. */
  readonly since?: number
  /** The author and client a remote step of it says. Absent: this session's own agent. */
  readonly remote?: { readonly by?: string; readonly via: string }
}

/** As much of a step as telling whose it is takes. */
type RunStep = Pick<HistoryStep, 'at' | 'origin' | 'by' | 'via' | 'barrier'>

export type AgentRun<S extends RunStep = HistoryStep> = {
  /** The steps, newest first: the order their inverses apply in. */
  readonly steps: readonly S[]
  /** The run stops short of the session's start: a two-scope gesture, this key saying why. */
  readonly barrier?: HistoryStep['barrier']
}

function isOfSession(step: RunStep, of: AgentSessionOf): boolean {
  if (of.since !== undefined && step.at < of.since) return false
  if (!of.remote) return step.origin === 'agent'
  return step.origin === 'remote' && step.via === of.remote.via && (of.remote.by === undefined || step.by === of.remote.by)
}

/** The session's steps at the top of a history, oldest first as `history()` keeps it. Nothing where anybody else's is on top. */
export function agentRun<S extends RunStep>(history: readonly S[], of: AgentSessionOf = {}): AgentRun<S> {
  const steps: S[] = []
  for (let at = history.length - 1; at >= 0; at -= 1) {
    const step = history[at]
    if (!isOfSession(step, of)) break
    if (step.barrier !== undefined) return { steps, barrier: step.barrier }
    steps.push(step)
  }
  return { steps }
}

/** What undoes a run, in the order it must apply: the newest step's inverses first. */
export function runInverses(run: AgentRun): Command[] {
  return run.steps.flatMap((step) => step.inverses)
}

/**
 * *Put back*: the run's inverses as one new step, named for the Activity list.
 * `name` says whose work it put back, and `on` the day, as a restore's are.
 */
export function putBackRun(run: AgentRun, name: string, on: string): Command {
  return { type: 'restore', restored: { what: 'agentSession', name, asOf: on }, commands: runInverses(run) }
}
