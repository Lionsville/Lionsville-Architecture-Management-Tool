// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The seam a script is run behind (ADR-0050): somewhere that runs text it
 * did not write, with nothing in reach but the calls it is handed.
 *
 * A port, because where a script runs is the host's and what a script may do
 * is not: the app runs it in its page, a host many callers share runs it on
 * a thread of its own, and both are held to the same contract — the script
 * sees `lv` and the language, and nothing of the process around it; no
 * module, no network, no file, no timer that outlives it. Only strings cross
 * in either direction, so nothing of the host's can be reached through a
 * value it handed over.
 *
 * `quickjs.ts` is the filling that ships. This file names no interpreter.
 */
import type { ScriptLimit, ScriptLimits } from './limits'

/** What one call out of a script came to. */
export type SandboxAnswer =
  /** Answered: the text the script is handed, parsed as JSON where it is JSON. */
  | { readonly ok: true; readonly value: string }
  /** Refused: thrown in the script as an error carrying the key, which the script may catch. */
  | { readonly ok: false; readonly refusal: string; readonly message: string }
  /** A limit the caller counts was met: the script ends here, whatever it would have caught. */
  | { readonly stop: ScriptLimit }

/** A call out of a script: the method by its name on `lv`, its one argument as JSON, and the scope `lv.in` bound. */
export type SandboxCall = (method: string, args: string, scope: string | undefined) => Promise<SandboxAnswer>

export type SandboxRun = {
  /** The body of an async function, with `lv` in scope. */
  readonly script: string
  /** Every method `lv` holds, as `area.method`, or a bare name for one on `lv` itself. */
  readonly methods: readonly string[]
  /** The scope `lv` is bound to before any `lv.in`. */
  readonly scope?: string
  readonly limits: Pick<ScriptLimits, 'cpuMs' | 'wallMs' | 'memoryBytes' | 'stackBytes'>
  readonly call: SandboxCall
}

export type SandboxOutcome =
  /** It returned: what it returned as JSON, `null` for nothing. */
  | { readonly ok: true; readonly result: string; readonly cpuMs: number }
  /** It was stopped at a limit. */
  | { readonly ok: false; readonly limit: ScriptLimit; readonly cpuMs: number }
  /** It threw, or would not compile: the message, which is the script's own words. */
  | { readonly ok: false; readonly thrown: string; readonly cpuMs: number }

export type Sandbox = {
  run(run: SandboxRun): Promise<SandboxOutcome>
  /** Let go of the interpreter, where the filling holds one. */
  dispose?(): void
}
