// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Whether this run keeps a minidump when one of its processes crashes.
 *
 * Without `crashReporter.start` Crashpad never runs, and a renderer that dies
 * leaves nothing on disk but the log's one line: two crashes in development
 * runs left no dump to read. A development run keeps them; nothing is ever
 * uploaded, and they sit beside its settings (`<userData>/Crashpad`).
 *
 * **Not in an installed app unless asked** (`LVARCH_CRASH_DUMPS=1`). A dump
 * holds pieces of the process's memory, which may be the model a person had
 * open, and the help promises that nothing about their work is kept or sent
 * that they did not ask for. A person asked to send one turns it on for a run.
 */
export function keepsCrashDumps(packaged: boolean, env: Readonly<Record<string, string | undefined>>): boolean {
  if (env.LVARCH_CRASH_DUMPS === '0') return false
  return !packaged || env.LVARCH_CRASH_DUMPS === '1'
}
