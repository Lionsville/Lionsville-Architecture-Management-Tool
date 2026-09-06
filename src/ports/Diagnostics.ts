/**
 * Where a failure goes when there is nobody to tell.
 *
 * A toast is for the user and disappears; this is the trail underneath it — the
 * thing a boundary writes before it draws its fallback, and the thing "Copy
 * diagnostics" hands over. In a browser tab that is the console plus a ring
 * buffer in memory; on the desktop the main process relays the same console
 * output into a file under `app.getPath('logs')`, so a packaged app that fell
 * over has something to show for it.
 *
 * `recent()` and not a getter, because a store behind a real log file would have
 * to read to answer. It returns the buffer oldest-first.
 *
 * See {@link Diagnostic} for what may and may not go in a message: keys and the
 * app's own words, never model content.
 */
import type { Diagnostic, DiagnosticEntry } from '../core/diagnostics'

export interface Diagnostics {
  /** Which one this is, in plain words ('console', 'recording'). */
  readonly id: string

  /** Record one. Never throws: reporting a failure must not become one. */
  report(entry: Diagnostic): void

  /** The last few, oldest first. Bounded — see `RING_SIZE`. */
  recent(): DiagnosticEntry[]
}
