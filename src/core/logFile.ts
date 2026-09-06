/**
 * What the desktop log file is called, and when it rolls over.
 *
 * The rules are here rather than in the main process because they are
 * arithmetic — a date, a size, a name — and because "does a full file roll over
 * exactly once" is worth a test that does not need Electron to run.
 *
 * **Two files, dated.** One per day keeps yesterday's crash readable after a
 * restart; one roll-over per file keeps a runaway loop from filling somebody's
 * disk. Anything more elaborate is a log rotation system, which this is not.
 */

/** Half a megabyte: thousands of lines, and nothing anyone would notice. */
export const MAX_LOG_BYTES = 512 * 1024

/** The stem, so a log is recognisable in a folder full of other apps' logs. */
const STEM = 'lvarch'

/** `lvarch-2026-09-06.log`, in local time — the day the user had, not UTC's. */
export function logFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${STEM}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.log`
}

/** The one file we keep behind the current one. Overwritten on the next roll. */
export function rolledName(name: string): string {
  return `${name}.1`
}

/**
 * Would this line take the file past the cap?
 *
 * Asked before the write rather than after, so the cap is a cap and not a line
 * somebody has already crossed. A single line longer than the whole budget
 * still gets written — truncating the one message that matters would be a
 * strange way to save space.
 */
export function needsRotation(
  currentBytes: number, incomingBytes: number, max: number = MAX_LOG_BYTES,
): boolean {
  return currentBytes > 0 && currentBytes + incomingBytes > max
}
