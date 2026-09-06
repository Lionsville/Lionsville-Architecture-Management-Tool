/**
 * The desktop log file: somewhere a failure lands that a user can find.
 *
 * A packaged app has no devtools open and no terminal attached, so everything
 * this process wrote to stderr went nowhere. This is the same lines, appended
 * to a dated file under `app.getPath('logs')` — the folder the platform already
 * has for this (`~/Library/Logs/<app>`, `%APPDATA%\<app>\logs`,
 * `~/.config/<app>/logs`) — which is the path the failure dialogs point at.
 *
 * **Synchronously, on purpose.** The lines worth having are the ones written
 * just before the process died; a buffered writer loses exactly those. A few
 * hundred bytes of `appendFileSync` per event is not a cost worth optimising
 * against that.
 *
 * **What may go in it.** The app's own messages, keys, and the renderer's
 * `[lvarch]` diagnostics — which are disciplined about this (see
 * `src/core/diagnostics.ts`). Not model content: no element names, no
 * documentation, no paths off the user's disk. The manual promises no
 * telemetry, and a log the user is invited to send someone is only safe to
 * invite them to send if we know what is in it.
 */
import { app } from 'electron'
import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { logFileName, needsRotation, rolledName } from '../../src/core/logFile'

let resolved: string | undefined

/** Where this run is writing. Stable for the life of the process. */
export function logFilePath(): string {
  if (!resolved) {
    const directory = app.getPath('logs')
    try { mkdirSync(directory, { recursive: true }) } catch { /* appendFileSync will say */ }
    resolved = join(directory, logFileName(new Date()))
  }
  return resolved
}

function sizeOf(path: string): number {
  try { return statSync(path).size } catch { return 0 }
}

/**
 * One line, stamped. Never throws: a log that can take the app down with it is
 * worse than no log — this is called from crash handlers.
 */
export function log(where: string, message: string): void {
  const line = `${new Date().toISOString()} ${where}: ${message}\n`
  try {
    const path = logFilePath()
    if (needsRotation(sizeOf(path), Buffer.byteLength(line))) {
      renameSync(path, rolledName(path))
    }
    appendFileSync(path, line)
  } catch {
    // Nowhere left to complain to. stderr still has the line below.
  }
  process.stderr.write(line)
}
