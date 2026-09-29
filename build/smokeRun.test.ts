// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The smoke run's directory: made per run, handed to the app, and removed once
 * the app has exited — including what it wrote on its way out, which is what a
 * removal from inside the app lost — unless a failing run asked to keep it.
 */
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SMOKE_KEEP, smokeRun } from './smokeRun'

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

const run = (exitCode: number, env: NodeJS.ProcessEnv = {}) => {
  const said: string[] = []
  const done = smokeRun({
    command: process.execPath, args: ['-e', app(exitCode)], env: { ...process.env, ...env }, under, say: (line) => said.push(line),
  })
  return { done, said }
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
})
