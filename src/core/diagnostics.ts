/**
 * What a diagnostic is, and what a pile of them reads like.
 *
 * The shapes live here rather than beside the port because they are data, not
 * machinery: a level, where it happened, what happened, and optionally the thing
 * that was thrown. `src/ports/Diagnostics.ts` is the seam that carries them.
 *
 * **What may go in a `message`.** Keys, identifiers the app made up itself, and
 * the app's own words. Never model content — no element names, no
 * documentation, no group or project names, no paths off the user's disk. This
 * repository is public and the manual promises no telemetry; a log on the user's
 * own disk is fine, a log with their landscape in it is not, because the whole
 * point of the ring buffer is that they can send it to someone. That is a
 * discipline at the call sites, which is why it is written at the top of the
 * file every call site imports from.
 */
import { reasonOf } from './errors'


export type DiagnosticLevel = 'error' | 'warn' | 'info'

/** What a caller reports. */
export type Diagnostic = {
  level: DiagnosticLevel
  /** Where in the app, in the app's own terms: `boot`, `autosave`, `editor`. */
  where: string
  /** A key or a short sentence of the app's own. Never model content. */
  message: string
  /** Whatever was thrown, if anything was. */
  cause?: unknown
}

/** A reported diagnostic, stamped. */
export type DiagnosticEntry = Diagnostic & {
  /** ISO 8601, from whoever kept it. */
  at: string
}

/** How many entries are worth keeping to hand somebody. */
export const RING_SIZE = 200

/**
 * Whatever was thrown, as one line.
 *
 * An `Error` gives its name and message; anything else gets `String()`, which is
 * what a `throw 'oops'` deserves. Deliberately no stack: the ring buffer is
 * meant to be copied into an email, and a stack per entry makes 200 of them
 * unreadable. The boundary shows the stack of the one crash that matters.
 */
export function describeCause(cause: unknown): string | undefined {
  if (cause === undefined || cause === null) return undefined
  // The class name is worth having here and nowhere else: a log reader wants to
  // know it was a QuotaExceededError, a user does not.
  if (cause instanceof Error) return `${cause.name}: ${cause.message}`
  return reasonOf(cause)
}

/** One entry as a line: the shape both the console and the copied text use. */
export function formatDiagnostic(entry: DiagnosticEntry): string {
  const cause = describeCause(entry.cause)
  return `${entry.at} ${entry.level.toUpperCase()} ${entry.where}: ${entry.message}${cause ? ` — ${cause}` : ''}`
}

/**
 * The ring buffer as text, oldest first — what "Copy diagnostics" puts on the
 * clipboard. Empty gets a line of its own rather than an empty clipboard, so
 * pasting it still says something.
 */
export function formatDiagnostics(entries: readonly DiagnosticEntry[]): string {
  if (!entries.length) return 'No diagnostics recorded.'
  return entries.map(formatDiagnostic).join('\n')
}

/** Add to a bounded list, oldest dropped first. Pure, so the adapters share it. */
export function pushBounded<T>(
  entries: readonly T[], entry: T, limit: number = RING_SIZE,
): T[] {
  const next = [...entries, entry]
  return next.length > limit ? next.slice(next.length - limit) : next
}
