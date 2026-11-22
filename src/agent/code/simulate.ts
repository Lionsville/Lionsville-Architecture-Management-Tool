// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `simulate`, `run` and `discard` (ADR-0050): a script that changes things
 * is tried before it lands.
 *
 * `simulate` runs the script with every scope it touches on a trial
 * (`trialSession.ts`). Each call is answered by the handler over that trial,
 * so the script meets what a plain call would meet — the same refusals, the
 * same ids of the same shape — and changes nothing. What it answers is what
 * a person needs to say yes to: per scope what would change, in the
 * landscape's own terms (`model/diff.ts`); each changing call's answer;
 * every refusal the script met, caught or not; and what it returned. With it
 * comes a token for the commands, held for a while (`held.ts`).
 *
 * `run` lands those commands and never the script: one step for each scope,
 * each held to the revision it was tried at, all of them or none — which the
 * host does, since where work is kept decides how several scopes are written
 * as one. `discard` lets a simulation go.
 *
 * A script that fails — a refusal nobody caught, an error of its own, a
 * limit — answers no token: half a script is not offered to be landed.
 */
import { transaction } from '../../model/commands'
import { countChanges, diffModels } from '../../model/diff'
import { toArrays } from '../../model/normalised'
import { apply } from '../../model/reducer'
import type { SessionView } from '../handle'
import type { ShellView } from '../shell'
import { checkArguments, json, refused } from '../tools'
import type { AgentAnswer, AgentRefusal } from '../tools'
import { codeToolSpec } from './codeTools'
import type { HeldScope, HeldSimulations, Simulation } from './held'
import type { CodeHost } from './host'
import { changes, entering, handed } from './script'
import type { Running, ScriptKind } from './script'
import type { SandboxAnswer } from './sandbox'
import { trialOf } from './trialSession'
import type { Trial } from './trialSession'

/** A changing call that was answered in the trial. */
type Step = { n: number; call: string; scope: string; answer: unknown }
/** A call the script was refused, whether or not it caught it. */
type Refusal = { n: number; call: string; refusal: AgentRefusal | string; detail?: string }

const parsedOr = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

/** A trial as a simulation answers it: what would change there. */
function changedIn(trial: Trial, writes: number) {
  const diff = diffModels(toArrays(trial.before), toArrays(trial.model()))
  return { scope: trial.scope, revision: trial.base, writes, diff, counts: countChanges(diff) }
}

/** The script that changes things: its calls answered over trials, and its answer what would change. */
export function simulating(simulations: HeldSimulations): ScriptKind {
  const trials = new Map<string, Trial>()
  /** Per scope: how many calls changed it, and the tools that did. */
  const written = new Map<string, { writes: number; tools: Set<string> }>()
  const steps: Step[] = []
  const refusals: Refusal[] = []

  return {
    op: 'simulate',
    call: (running) => async (name, raw, bound) => {
      const entered = entering(running, name, raw, bound)
      if (!('method' in entered)) {
        if ('ok' in entered && !entered.ok) refusals.push({ n: running.counted.calls, call: name, refusal: entered.refusal, detail: entered.message })
        return entered
      }
      const { n, method, args } = entered
      const changing = changes(method)
      if (changing) {
        running.counted.writes += 1
        if (running.counted.writes > running.host.limits.writes) return { stop: 'writes' }
      }
      // The scope the call was answered over, said by the session it was handed, and how far its trial had come.
      let at: { scope: string; trial: Trial; commands: number } | undefined
      const over = (session: SessionView): SessionView => {
        const scope = session.scopePath()
        let trial = trials.get(scope)
        if (!trial) {
          trial = trialOf(session, running.hash)
          trials.set(scope, trial)
        }
        at = { scope, trial, commands: trial.commands().length }
        return trial.over(session)
      }
      const answer = await running.host.ask({ id: `script-${n}`, tool: method.tool.name, args }, over)
      const said: SandboxAnswer = handed(answer)
      if ('ok' in said && !said.ok) {
        refusals.push({ n, call: name, refusal: said.refusal, detail: said.message })
        return said
      }
      if (typeof args.scope === 'string' && !changing) running.counted.scopesRead.add(args.scope)
      if (changing && at && 'ok' in said && at.trial.commands().length > at.commands) {
        const held = written.get(at.scope) ?? { writes: 0, tools: new Set<string>() }
        held.writes += 1
        held.tools.add(method.tool.name)
        written.set(at.scope, held)
        running.counted.scopesWritten.add(at.scope)
        steps.push({ n, call: name, scope: at.scope, answer: parsedOr(said.value) })
      }
      return said
    },
    answered: (running: Running) => {
      const changed = [...trials.values()].filter((trial) => trial.commands().length > 0)
      const scopes: HeldScope[] = changed.map((trial) => {
        const active = trial.activeDiagramId()
        return {
          scope: trial.scope, base: trial.base, commands: [...trial.commands()],
          tools: [...(written.get(trial.scope)?.tools ?? [])], writes: written.get(trial.scope)?.writes ?? 0,
          ...(active !== undefined ? { activeDiagramId: active } : {}),
        }
      })
      const held = scopes.length > 0 ? simulations.hold(running.host.holder, running.hash, scopes) : undefined
      return {
        ...(held ? { token: held.token, expires: new Date(held.expires).toISOString() } : {}),
        scopes: changed.map((trial) => changedIn(trial, written.get(trial.scope)?.writes ?? 0)),
        steps,
        refusals,
        calls: running.counted.calls,
      }
    },
  }
}

const tokenOf = (tool: 'run' | 'discard', rawArgs: unknown): string | AgentAnswer => {
  const wrong = checkArguments(codeToolSpec(tool).inputSchema, rawArgs)
  return wrong ? refused('agent.badArguments', wrong) : (rawArgs as { token: string }).token
}

/** What a host is told of a run or a discard: the simulation's fingerprint and what it wrote, no more. */
function reported(host: CodeHost, op: 'run' | 'discard', simulation: Simulation, outcome: 'ok' | AgentRefusal): void {
  host.report?.({
    op, hash: simulation.hash, bytes: 0, scopesRead: [], scopesWritten: simulation.scopes.map((one) => one.scope),
    calls: 0, writes: simulation.scopes.reduce((sum, one) => sum + one.writes, 0), cpuMs: 0, resultBytes: 0, outcome,
  })
}

/** `run`: the simulation under this token, landed by the host; the token is spent whatever comes of it. */
export async function land(rawArgs: unknown, host: CodeHost, simulations: HeldSimulations): Promise<AgentAnswer> {
  const token = tokenOf('run', rawArgs)
  if (typeof token !== 'string') return token
  if (!host.land) return refused('agent.unknownTool', 'run')
  const simulation = simulations.take(host.holder, token)
  if (!simulation) return refused('agent.unknownSimulation')
  const answer = await host.land(simulation)
  reported(host, 'run', simulation, answer.ok ? 'ok' : answer.refusal)
  return answer
}

/** `discard`: the simulation under this token, let go. */
export function discard(rawArgs: unknown, host: CodeHost, simulations: HeldSimulations): AgentAnswer {
  const token = tokenOf('discard', rawArgs)
  if (typeof token !== 'string') return token
  const simulation = simulations.take(host.holder, token)
  if (!simulation) return refused('agent.unknownSimulation')
  reported(host, 'discard', simulation, 'ok')
  return json({ discarded: true })
}

const said = (scope: string): string => scope || 'the organisation'

/**
 * A simulation landed on the session of the scope open: how a host that
 * keeps one scope open in a window fills {@link CodeHost.land}. One scope,
 * the one open, still at the revision it was tried at; its commands as one
 * transaction, so one step to undo and one line in the list of what was
 * done. Counted as a driving call, so the person sees who changed what and
 * may take it back with the session.
 */
export function landOnSession(simulation: Simulation, session: SessionView | undefined, shell?: ShellView): AgentAnswer {
  if (!session) return refused('agent.noProject')
  const elsewhere = simulation.scopes.find((one) => one.scope !== session.scopePath())
  if (elsewhere) return refused('agent.scopeNotOpen', `${said(elsewhere.scope)} is not the scope open in the app`)
  const [held] = simulation.scopes
  if (!held) return json({ landed: [] })
  const blocked = session.blocked()
  if (blocked) return refused(blocked)
  if (session.revision() !== held.base) {
    return refused('agent.stale', `${said(held.scope)} is at revision ${session.revision()}, and the simulation was tried at ${held.base}: simulate again`)
  }
  // The script was the batch, and landing it drives as a batch does.
  const gate = shell?.driving.admit('batch', shell.client())
  if (gate) return refused(gate)
  const command = transaction([...held.commands], { origin: 'agent' })
  // Asked of the reducer once more, so a refusal comes back with its reason rather than as nothing.
  const tried = apply(session.indexed(), command)
  if (!tried.ok) return refused(tried.reason)
  session.dispatch(command, held.activeDiagramId !== undefined ? { activeDiagramId: held.activeDiagramId } : undefined)
  return json({ landed: [{ scope: held.scope, revision: session.revision(), writes: held.writes }] })
}
