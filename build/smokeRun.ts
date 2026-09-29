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
 * when its path and what it holds are printed instead. A removal that could
 * not finish — a helper still writing — is said, and does not fail a run
 * that passed.
 *
 * An app that never exits is stopped after `LVARCH_SMOKE_DEADLINE_MS`
 * ({@link SMOKE_DEADLINE_MS} by default), and the run fails saying so: a gate
 * that waits forever is a gate nobody hears from.
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
/** What moves the deadline, in milliseconds. */
export const SMOKE_DEADLINE = 'LVARCH_SMOKE_DEADLINE_MS'
/** How long a run may take before the app is stopped: a run takes two minutes or so. */
export const SMOKE_DEADLINE_MS = 5 * 60_000
/** How long a stopped app is given to go before it is killed. */
const STOP_GRACE_MS = 5_000

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
  /** How the directory is removed; `rmSync`, retried, by default. For a test. */
  remove?: (root: string) => void
}

/** The deadline this run keeps: the environment's, where it names a positive number. */
function deadlineOf(env: NodeJS.ProcessEnv): number {
  const asked = Number(env[SMOKE_DEADLINE])
  return Number.isFinite(asked) && asked > 0 ? asked : SMOKE_DEADLINE_MS
}

/** Removed, and retried while something lets go of it; what was left is said, never thrown. */
function removeRun(root: string, remove: (root: string) => void, say: (line: string) => void): void {
  try {
    remove(root)
  } catch (cause) {
    say(`smoke: ${root} could not be removed entirely (${cause instanceof Error ? cause.message : String(cause)}); left:`)
    try {
      for (const entry of readdirSync(root)) say(`  ${join(root, entry)}`)
    } catch {
      // Gone after all, or unreadable: said above either way.
    }
  }
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
  const deadline = deadlineOf(env)
  let late = false
  let killer: ReturnType<typeof setTimeout> | undefined
  const stopper = setTimeout(() => {
    late = true
    say(`smoke: the app had not exited after ${Math.round(deadline / 1000)} s; stopping it`)
    child.kill('SIGTERM')
    killer = setTimeout(() => { child.kill('SIGKILL') }, STOP_GRACE_MS)
  }, deadline)
  const exited = await new Promise<number>((resolve) => {
    child.once('error', (cause) => { say(`smoke: could not start ${launch.command}: ${cause.message}`); resolve(1) })
    child.once('exit', (code, signal) => { resolve(code ?? (signal ? 1 : 0)) })
  })
  clearTimeout(stopper)
  clearTimeout(killer)
  process.off('SIGINT', forward)
  process.off('SIGTERM', forward)
  const code = late ? 1 : exited
  if (code !== 0 && env[SMOKE_KEEP] === '1') {
    say(`smoke: kept this run's directory, ${root}:`)
    for (const entry of readdirSync(root)) say(`  ${join(root, entry)}`)
  } else {
    removeRun(root, launch.remove ?? ((at) => { rmSync(at, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) }), say)
  }
  return code
}

// `node build/smokeRun.ts [electron arguments...]`
if (process.argv[1]?.endsWith('smokeRun.ts')) {
  const electron = createRequire(import.meta.url)('electron') as string
  void smokeRun({ command: electron, args: process.argv.slice(2) }).then((code) => process.exit(code))
}
