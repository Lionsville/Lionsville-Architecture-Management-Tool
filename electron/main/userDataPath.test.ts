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
})
