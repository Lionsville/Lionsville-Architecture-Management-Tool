// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What code mode asks of the host it runs on (ADR-0050): a seam, filled by
 * the app over its live session and by any other host over whatever it has.
 *
 * The rule the seam exists for: **a call out of a script is answered by the
 * path a plain call takes.** A script is not a second way in with rules of
 * its own. Who may read what, what is refused, how a person is named — all
 * of it is decided where it was already decided, because the host answers
 * an inner call with the code that answers a plain one ({@link CodeHost.ask}).
 * What code mode adds is around that: the interpreter, the counts, and one
 * line about the script for a host that keeps a log of what was asked of it.
 */
import type { SessionView } from '../handle'
import type { AgentAnswer, AgentRefusal, AgentRequest, ToolSpec } from '../tools'
import type { Simulation } from './held'
import type { ScriptLimit, ScriptLimits } from './limits'
import type { Sandbox } from './sandbox'

/**
 * One line about one script, for a host that keeps a trail. Counts, a
 * fingerprint and an outcome. **Never the script's text, an argument, a
 * value it was answered or returned, or a message it threw**: a script
 * carries somebody's landscape, and a trail is read by other people.
 */
export type ScriptReport = {
  readonly op: 'query' | 'simulate' | 'run' | 'discard'
  /** SHA-256 of the script's text, as hex: which script, without the script. */
  readonly hash: string
  readonly bytes: number
  /** The scopes its calls named, by path, in the order first named. */
  readonly scopesRead: readonly string[]
  readonly scopesWritten: readonly string[]
  readonly calls: number
  readonly writes: number
  readonly cpuMs: number
  readonly resultBytes: number
  /** The limit it was stopped at, where it was. */
  readonly limit?: ScriptLimit
  readonly outcome: 'ok' | AgentRefusal
}

export type CodeHost = {
  /** Who scripts are counted for: one runs at a time for each. */
  readonly holder: string
  readonly limits: ScriptLimits
  /** Which of the vocabulary this host has: what it offers as tools is what `lv` holds. Everything, when unsaid. */
  readonly tools?: (tool: ToolSpec) => boolean
  /** The interpreter, loaded with the first script and never before. */
  sandbox(): Promise<Sandbox>
  /**
   * One inner call, answered as a plain call of that tool is answered here —
   * its rights, its refusals, its names — and landing nothing. Where `over`
   * is given, the call is answered over the session it makes of the host's.
   */
  ask(request: AgentRequest, over?: (session: SessionView) => SessionView): Promise<AgentAnswer>
  /** Charge the caller for a round of inner calls, where the host meters its door; false ends the script. */
  charge?(): boolean
  /** What a script returned, with every person in it said as an answer says one: a second pass, behind `ask`'s. */
  named?(answer: AgentAnswer): Promise<AgentAnswer>
  /** One line about a script, where the host keeps a trail. */
  report?(line: ScriptReport): void
  /**
   * Land a simulation: every scope's commands as that scope's one step, each
   * only where the scope is still at the revision it was tried at and this
   * caller may still write it, all of them or none. Absent where the host
   * lands nothing, and `run` is then refused.
   */
  land?(simulation: Simulation): Promise<AgentAnswer>
}
