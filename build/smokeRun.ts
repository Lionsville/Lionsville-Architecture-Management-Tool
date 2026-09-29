// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The desktop smoke run, launched and cleaned up after from outside the app.
 *
 * A run needs a place of its own: a user-data directory, so it neither reads
 * nor repoints somebody's real app, and the folders it works in. Each run gets
 * one fresh directory under the system's temporary folder, handed to the app
 * as `LVARCH_SMOKE_ROOT`, with everything the run makes inside it — so two
 * runs at once cannot touch each other's.
 *
 * Removed here, once the app has exited, and not by the app: Chromium writes
 * its profile as it quits, after anything the app itself can still run, and a
 * removal from inside the dying app lost that race. Removed whether the run
 * passed or failed, unless `LVARCH_SMOKE_KEEP=1` asks to keep a failing run's,
 * when its path and what it holds are printed instead.
 *
 *   node build/smokeRun.ts [electron arguments...]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** What the app is told: where everything of this run goes. */
export const SMOKE_ROOT = 'LVARCH_SMOKE_ROOT'
/** What keeps a failing run's directory for a look. */
export const SMOKE_KEEP = 'LVARCH_SMOKE_KEEP'

export type SmokeLaunch = {
  /** The program run, and its arguments. */
  command: string
  args: readonly string[]
  /** The environment it runs in; the root is added to it. */
  env?: NodeJS.ProcessEnv
  /** Where the run's directory is made; the system's temporary folder by default. */
  under?: string
  /** Said instead of printed, for a test. */
  say?: (line: string) => void
}

/** Run it in a directory of its own, and remove the directory once it has exited. Answers its exit code. */
export async function smokeRun(launch: SmokeLaunch): Promise<number> {
  const say = launch.say ?? ((line: string) => { process.stderr.write(`${line}\n`) })
  const env = launch.env ?? process.env
  const root = mkdtempSync(join(launch.under ?? tmpdir(), 'lvarch-smoke-'))
  const child = spawn(launch.command, launch.args, { stdio: 'inherit', env: { ...env, [SMOKE_ROOT]: root } })
  // A run stopped from the keyboard stops the app, and is cleaned up after the same way.
  const forward = (signal: NodeJS.Signals) => { child.kill(signal) }
  process.on('SIGINT', forward)
  process.on('SIGTERM', forward)
  const code = await new Promise<number>((resolve) => {
    child.once('error', (cause) => { say(`smoke: could not start ${launch.command}: ${cause.message}`); resolve(1) })
    child.once('exit', (exited, signal) => { resolve(exited ?? (signal ? 1 : 0)) })
  })
  process.off('SIGINT', forward)
  process.off('SIGTERM', forward)
  if (code !== 0 && env[SMOKE_KEEP] === '1') {
    say(`smoke: kept this run's directory, ${root}:`)
    for (const entry of readdirSync(root)) say(`  ${join(root, entry)}`)
  } else {
    rmSync(root, { recursive: true, force: true })
  }
  return code
}

// `node build/smokeRun.ts [electron arguments...]`
if (process.argv[1]?.endsWith('smokeRun.ts')) {
  const electron = createRequire(import.meta.url)('electron') as string
  void smokeRun({ command: electron, args: process.argv.slice(2) }).then((code) => process.exit(code))
}
