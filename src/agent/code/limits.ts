// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a script may cost (ADR-0051), and the sentence each limit is refused
 * with.
 *
 * A script is somebody else's code run where the work is kept, so every
 * dimension it can grow in has a number, and every number is enforced where
 * it cannot be argued with: its length before anything is run, its
 * processing by the interpreter's own interrupt, its memory and its stack by
 * the interpreter's own limits, its calls and writes by a count where they
 * are answered, its answer by a measure of what it returned, and its time on
 * the clock by a timer outside it.
 *
 * Two sets, because two kinds of host differ in whose time a script spends.
 * A host many callers share gives a script more processing on a thread of
 * its own and less time on the clock; the app on a person's screen runs it
 * in the page that draws, so it gets less processing — a second of it is a
 * second the screen does not answer — and longer on the clock, since its
 * reads may wait on a folder.
 */

/** Every limit a script can meet, by the name a refusal says. */
export type ScriptLimit =
  | 'script' | 'cpu' | 'wall' | 'memory' | 'stack' | 'calls' | 'writes' | 'result' | 'concurrent' | 'rate'

export type ScriptLimits = {
  /** The script's own text, in bytes of UTF-8. */
  readonly scriptBytes: number
  /** Processing inside the interpreter, in milliseconds: the time it computes, not the time it waits. */
  readonly cpuMs: number
  /** From start to answer on the clock, in milliseconds, waiting included. */
  readonly wallMs: number
  /** What the interpreter may allocate, in bytes. */
  readonly memoryBytes: number
  /** The interpreter's stack, in bytes: how deep a script may nest. */
  readonly stackBytes: number
  /** Calls to `lv` in one script. */
  readonly calls: number
  /** Calls that change something in one script: the cap one step of changes has (`batchSteps.ts`). */
  readonly writes: number
  /** What a script returns, serialised, in bytes of UTF-8. */
  readonly resultBytes: number
}

const SHARED = {
  scriptBytes: 32 * 1024,
  calls: 500,
  writes: 200,
  resultBytes: 256 * 1024,
} as const

/** A host many callers share, where a script runs on a thread of its own. */
export const SHARED_HOST_LIMITS: ScriptLimits = {
  ...SHARED,
  cpuMs: 2_000,
  wallMs: 15_000,
  memoryBytes: 32 * 1024 * 1024,
  stackBytes: 256 * 1024,
}

/** The app on a person's screen, where a script runs in the page that draws. */
export const DESKTOP_LIMITS: ScriptLimits = {
  ...SHARED,
  cpuMs: 1_000,
  wallMs: 30_000,
  memoryBytes: 64 * 1024 * 1024,
  // The page's own stack is the browser's and not ours to size: kept well inside it.
  stackBytes: 64 * 1024,
}

/** The longest message of a script's own failure an answer carries, in characters. */
export const MOST_FAILURE_TEXT = 2_000

/** How many inner calls are charged as one call at the door. */
export const CALLS_PER_CHARGE = 10

const seconds = (ms: number): string => `${ms / 1000} s`
const kilobytes = (bytes: number): string => `${Math.round(bytes / 1024)} kB`
const megabytes = (bytes: number): string => `${Math.round(bytes / (1024 * 1024))} MB`

const NARROW = 'Narrow the reads with fields and limit, or split the work.'

/** What a refusal says of the limit a script met: what stopped it, at what, and what to do instead. */
export function limitDetail(limit: ScriptLimit, limits: ScriptLimits): string {
  switch (limit) {
    case 'script': return `The script is longer than ${kilobytes(limits.scriptBytes)} (limit: script). Nothing was run. Split the work over several scripts.`
    case 'cpu': return `The script was stopped at ${seconds(limits.cpuMs)} of processing (limit: cpu). Nothing was changed. ${NARROW}`
    case 'wall': return `The script was stopped ${seconds(limits.wallMs)} after it started (limit: wall). Nothing was changed. ${NARROW}`
    case 'memory': return `The script was stopped at ${megabytes(limits.memoryBytes)} of memory (limit: memory). Nothing was changed. ${NARROW}`
    case 'stack': return 'The script nested deeper than its stack allows (limit: stack). Nothing was changed. Loop where it recurses.'
    case 'calls': return `The script was stopped at ${limits.calls} calls (limit: calls). Nothing was changed. Read lists once and join them in the script, or split the work.`
    case 'writes': return `The script was stopped at ${limits.writes} changes (limit: writes). Nothing was changed. Split the work into several simulations, each one change a person can tell apart.`
    case 'result': return `The script returned more than ${kilobytes(limits.resultBytes)} (limit: result). Nothing was changed. Return only the fields and rows needed.`
    case 'concurrent': return 'Another script of yours is still running (limit: concurrent). Nothing was run. Wait for it to answer.'
    case 'rate': return 'The script made calls faster than this caller is allowed (limit: rate). Nothing was changed. Wait, and make fewer calls.'
    default: {
      const unexpected: never = limit
      return unexpected
    }
  }
}
