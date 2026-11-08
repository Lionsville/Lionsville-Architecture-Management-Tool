// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one thing about `userData` a unit test can actually hold: that main pins
 * it, to the frozen name, before anything reads a path.
 *
 * Read as text rather than imported, because importing `index.ts` starts the
 * app — it registers a scheme, asks for the single-instance lock and waits on
 * `whenReady`. What is asserted is not the string in the file for its own sake
 * but the ordering, which is the part that is easy to lose: `app.setPath` after
 * `whenReady` is a call Electron accepts and ignores, so the folder would move
 * on the next launch with nothing failing here or anywhere else. The smoke run
 * checks the path itself, against a real Electron.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { USER_DATA_NAME } from '../../src/platform/userData'

const MAIN = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

describe('where main puts userData', () => {
  it('pins it to the frozen folder name, not to what the product is called', () => {
    expect(MAIN).toContain("if (app.isPackaged) app.setPath('userData', join(app.getPath('appData'), USER_DATA_NAME))")
    expect(USER_DATA_NAME).toBe('Lionsville Architecture Management Tool')
  })

  it('pins it before whenReady, which is the last moment a path can be set', () => {
    const pinned = MAIN.indexOf("app.setPath('userData', join(")
    const ready = MAIN.indexOf('app.whenReady()')
    expect(pinned).toBeGreaterThan(-1)
    expect(ready).toBeGreaterThan(-1)
    expect(pinned).toBeLessThan(ready)
  })

  /**
   * The smoke run's own temporary folder has to win over the pin, not lose to
   * it — belt and braces, since the pin is a packaged app's only.
   */
  it('lets the smoke run override it afterwards', () => {
    const pinned = MAIN.indexOf("app.setPath('userData', join(")
    const smoke = MAIN.indexOf("app.setPath('userData', own)")
    expect(smoke).toBeGreaterThan(pinned)
  })

  /**
   * A development run's own folder, `LVARCH_USER_DATA`: so a test run started
   * from a checkout never opens the folder another run remembered. Read only
   * where the app is not packaged — an installed app's settings are never
   * moved by its environment — and set before `whenReady`, with the log beside
   * it, after the pin and before the smoke run's own folder, which still wins.
   */
  it('lets a development run keep its own folder, never a packaged app', () => {
    expect(MAIN).toContain('const ownUserData = app.isPackaged ? undefined : process.env.LVARCH_USER_DATA')
    expect(MAIN.match(/process\.env\.LVARCH_USER_DATA/g)).toHaveLength(1)
  })

  it('sets that folder and its logs before whenReady, between the pin and the smoke run', () => {
    const pinned = MAIN.indexOf("app.setPath('userData', join(")
    const own = MAIN.indexOf("app.setPath('userData', ownUserData)")
    const logs = MAIN.indexOf("app.setAppLogsPath(join(ownUserData, 'logs'))")
    const smoke = MAIN.indexOf("app.setPath('userData', own)")
    const ready = MAIN.indexOf('app.whenReady()')
    expect(own).toBeGreaterThan(pinned)
    expect(logs).toBeGreaterThan(own)
    expect(smoke).toBeGreaterThan(logs)
    expect(ready).toBeGreaterThan(smoke)
  })

  it('reads no path before that folder is set', () => {
    const own = MAIN.indexOf("app.setPath('userData', ownUserData)")
    const before = MAIN.slice(0, own)
    // Only a function that reads a path later, and the pin's own appData.
    const reads = [...before.matchAll(/app\.getPath\('(\w+)'\)/g)].map((m) => m[1])
    expect(reads.every((name) => name === 'userData' || name === 'appData')).toBe(true)
    expect(before).toMatch(/const keptThemePath = \(\): string => join\(app\.getPath\('userData'\)/)
    expect(before.match(/app\.getPath\('userData'\)/g)).toHaveLength(1)
  })
})
