// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The smoke run's directory: made per run, handed to the app, and removed once
 * the app has exited — including what it wrote on its way out, which is what a
 * removal from inside the app lost — unless a failing run asked to keep it.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SMOKE_DEADLINE, SMOKE_KEEP, smokeRun } from './smokeRun'

let under = ''
beforeEach(() => { under = mkdtempSync(join(tmpdir(), 'lv-smoke-run-')) })
afterEach(() => { rmSync(under, { recursive: true, force: true }) })

/**
 * A stand-in for the app: it makes a user-data directory and working folders
 * inside the root it is handed, and writes a profile file as the very last
 * thing before it exits, as Chromium does at quit.
 */
const app = (exitCode: number) => `
  const { mkdirSync, mkdtempSync, writeFileSync } = require('node:fs')
  const { join } = require('node:path')
  const root = process.env.LVARCH_SMOKE_ROOT
  mkdirSync(join(root, 'userdata', 'logs'), { recursive: true })
  mkdtempSync(join(root, 'lvarch-smoke-a-'))
  mkdtempSync(join(root, 'lvarch-smoke-remote-'))
  process.on('exit', () => {
    mkdirSync(join(root, 'userdata', 'Session Storage'), { recursive: true })
    writeFileSync(join(root, 'userdata', 'Local State'), '{}')
  })
  process.exit(${exitCode})
`

const run = (
  exitCode: number, env: NodeJS.ProcessEnv = {}, script = app(exitCode), remove?: (root: string) => void, grace?: number,
) => {
  const said: string[] = []
  const done = smokeRun({
    command: process.execPath, args: ['-e', script], env: { ...process.env, ...env }, under, say: (line) => said.push(line),
    ...(remove ? { remove } : {}), ...(grace !== undefined ? { grace } : {}),
  })
  return { done, said }
}

/** Whether a process is gone, asked for a while: one just killed may take a moment to be reaped. */
async function goneSoon(pid: number): Promise<boolean> {
  for (let tries = 0; tries < 40; tries += 1) {
    try {
      process.kill(pid, 0)
    } catch {
      return true
    }
    await new Promise((resolve) => { setTimeout(resolve, 50) })
  }
  return false
}

describe('a smoke run’s own directory', () => {
  it('leaves nothing behind after a run that passed, what the app wrote as it quit included', async () => {
    const { done } = run(0)
    expect(await done).toBe(0)
    expect(readdirSync(under)).toEqual([])
  })

  it('leaves nothing behind after a run that failed, and answers its exit code', async () => {
    const { done } = run(3)
    expect(await done).toBe(3)
    expect(readdirSync(under)).toEqual([])
  })

  it('keeps a failing run’s where it was asked to, and says where everything is', async () => {
    const { done, said } = run(1, { [SMOKE_KEEP]: '1' })
    expect(await done).toBe(1)
    const [root] = readdirSync(under)
    expect(root).toMatch(/^lvarch-smoke-/)
    expect(existsSync(join(under, root, 'userdata', 'Local State'))).toBe(true)
    expect(said[0]).toContain(join(under, root))
    expect(said.slice(1).map((line) => line.trim().split('/').pop()?.replace(/-.*$/, '')).sort())
      .toEqual(['lvarch', 'lvarch', 'userdata'])
  })

  it('removes a passing run’s even where keeping was asked for', async () => {
    const { done } = run(0, { [SMOKE_KEEP]: '1' })
    await done
    expect(readdirSync(under)).toEqual([])
  })

  it('gives each run a directory of its own', async () => {
    const first = run(1, { [SMOKE_KEEP]: '1' })
    const second = run(1, { [SMOKE_KEEP]: '1' })
    await Promise.all([first.done, second.done])
    expect(readdirSync(under)).toHaveLength(2)
  })

  it('stops an app that never exits after the deadline, fails the run saying so, and leaves nothing behind', async () => {
    const hangs = `
      require('node:fs').mkdirSync(require('node:path').join(process.env.LVARCH_SMOKE_ROOT, 'userdata'))
      setInterval(() => undefined, 1000)
    `
    const { done, said } = run(0, { [SMOKE_DEADLINE]: '300' }, hangs)
    expect(await done).toBe(1)
    expect(said.join('\n')).toContain('had not exited after')
    // A well-behaved app goes on the stop alone.
    expect(said.join('\n')).not.toContain('killing it')
    expect(readdirSync(under)).toEqual([])
  }, 15_000)

  it('kills an app that ignores the stop, once the grace has passed', async () => {
    const stubborn = `
      process.on('SIGTERM', () => undefined)
      setInterval(() => undefined, 1000)
    `
    const { done, said } = run(0, { [SMOKE_DEADLINE]: '300' }, stubborn, undefined, 300)
    expect(await done).toBe(1)
    expect(said.join('\n')).toContain('killing it')
    expect(readdirSync(under)).toEqual([])
  }, 15_000)

  it.skipIf(process.platform === 'win32')('leaves nothing of the app’s process tree behind, a helper that ignores the stop included', async () => {
    const pidFile = join(under, '..', `${under.split('/').pop()}.helper-pid`)
    const helper = "process.on('SIGTERM', () => undefined); setInterval(() => undefined, 1000)"
    const withHelper = `
      const { spawn } = require('node:child_process')
      const helper = spawn(process.execPath, ['-e', ${JSON.stringify(helper)}], { stdio: 'ignore' })
      require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(helper.pid))
      setInterval(() => undefined, 1000)
    `
    try {
      const { done } = run(0, { [SMOKE_DEADLINE]: '500' }, withHelper, undefined, 300)
      expect(await done).toBe(1)
      const pid = Number(readFileSync(pidFile, 'utf8'))
      expect(pid).toBeGreaterThan(0)
      expect(await goneSoon(pid)).toBe(true)
    } finally {
      rmSync(pidFile, { force: true })
    }
  }, 15_000)

  it('keeps a passing run passing where its directory could not be removed, and says what was left', async () => {
    const { done, said } = run(0, {}, app(0), () => { throw new Error('ENOTEMPTY: a helper is still writing') })
    expect(await done).toBe(0)
    expect(said[0]).toContain('could not be removed entirely')
    expect(said[0]).toContain('ENOTEMPTY')
    expect(said.slice(1).length).toBeGreaterThan(0)
  })
})
