// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { RecordingDiagnostics } from '../memory/RecordingDiagnostics'
import { reloadOnStaleScripts, scriptNamedBy, STALE_SCRIPTS_EVENT, STALE_SCRIPTS_KEY, STALE_SCRIPTS_WINDOW_MS } from './staleScripts'

const SCRIPT = 'https://example.test/assets/Page-abc123.js'

function stale(message = `Failed to fetch dynamically imported module: ${SCRIPT}`): Event {
  const event = new Event(STALE_SCRIPTS_EVENT, { cancelable: true }) as Event & { payload?: unknown }
  event.payload = new TypeError(message)
  return event
}

type Options = { at?: number; online?: () => boolean; gone?: (address: string) => Promise<boolean>; mayReload?: () => boolean; entry?: () => string | undefined }

function listening(storage: Storage | undefined, options: Options = {}) {
  const target = new EventTarget()
  const reload = vi.fn()
  const diagnostics = new RecordingDiagnostics()
  const gone = vi.fn(options.gone ?? (async () => true))
  const stop = reloadOnStaleScripts({
    reload, diagnostics, target, storage: () => storage, now: () => options.at ?? 1_000_000,
    online: options.online ?? (() => true), gone, entry: options.entry ?? (() => undefined),
    ...(options.mayReload ? { mayReload: options.mayReload } : {}),
  })
  return { target, reload, diagnostics, gone, stop }
}

/** The server's answer is awaited; let it arrive. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('reloadOnStaleScripts', () => {
  it('loads the page again once the server says a script it names is gone', async () => {
    sessionStorage.clear()
    const { target, reload, gone } = listening(sessionStorage)
    const event = stale()
    target.dispatchEvent(event)
    // The part hears the rejection and draws its line while the server is asked.
    expect(event.defaultPrevented).toBe(false)
    await settled()
    expect(gone).toHaveBeenCalledWith(SCRIPT)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('never reloads while the browser is offline, and asks nobody', async () => {
    sessionStorage.clear()
    const { target, reload, gone, diagnostics } = listening(sessionStorage, { online: () => false })
    target.dispatchEvent(stale())
    await settled()
    expect(gone).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(STALE_SCRIPTS_KEY)).toBeNull()
    expect(diagnostics.recent().some((entry) => entry.where === 'scripts' && entry.level === 'warn')).toBe(true)
  })

  it('takes a request that fails for the network, not a deploy', async () => {
    sessionStorage.clear()
    const { target, reload } = listening(sessionStorage, { gone: () => Promise.reject(new TypeError('Failed to fetch')) })
    target.dispatchEvent(stale())
    await settled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not reload where the server still has the script', async () => {
    sessionStorage.clear()
    const { target, reload } = listening(sessionStorage, { gone: async () => false })
    target.dispatchEvent(stale())
    await settled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not reload when the network went while the server was asked', async () => {
    sessionStorage.clear()
    let up = true
    const { target, reload } = listening(sessionStorage, { online: () => up, gone: async () => { up = false; return true } })
    target.dispatchEvent(stale())
    await settled()
    expect(reload).not.toHaveBeenCalled()
  })

  it("asks about the page's own entry where the message names no script", async () => {
    sessionStorage.clear()
    const { target, reload, gone } = listening(sessionStorage, { entry: () => 'https://example.test/assets/index-1.js' })
    target.dispatchEvent(stale('Importing a module script failed.'))
    await settled()
    expect(gone).toHaveBeenCalledWith('https://example.test/assets/index-1.js')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does nothing where neither the message nor the page names a script', async () => {
    sessionStorage.clear()
    const { target, reload, gone } = listening(sessionStorage)
    target.dispatchEvent(stale('Importing a module script failed.'))
    await settled()
    expect(gone).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not reload a second time straight after the first, which would be a broken deploy for ever', async () => {
    sessionStorage.clear()
    sessionStorage.setItem(STALE_SCRIPTS_KEY, String(1_000_000 - STALE_SCRIPTS_WINDOW_MS / 2))
    const { target, reload, diagnostics } = listening(sessionStorage)
    target.dispatchEvent(stale())
    await settled()
    expect(reload).not.toHaveBeenCalled()
    expect(diagnostics.recent().some((entry) => entry.where === 'scripts' && entry.level === 'error')).toBe(true)
  })

  it('reloads again once the window has passed', async () => {
    sessionStorage.clear()
    sessionStorage.setItem(STALE_SCRIPTS_KEY, String(1_000_000 - STALE_SCRIPTS_WINDOW_MS * 2))
    const { target, reload } = listening(sessionStorage)
    target.dispatchEvent(stale())
    await settled()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('leaves the event alone where it cannot remember having reloaded', async () => {
    const { target, reload } = listening(undefined)
    target.dispatchEvent(stale())
    await settled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not reload over work a reload would lose, and leaves the event for the part to refuse', async () => {
    sessionStorage.clear()
    let holding = true
    const { target, reload, gone, diagnostics } = listening(sessionStorage, { mayReload: () => !holding })
    const event = stale()
    target.dispatchEvent(event)
    await settled()
    expect(gone).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    expect(sessionStorage.getItem(STALE_SCRIPTS_KEY)).toBeNull()
    expect(diagnostics.recent().some((entry) => entry.where === 'scripts' && entry.level === 'warn')).toBe(true)
    // Once the work is kept, the next time is a reload as ever.
    holding = false
    target.dispatchEvent(stale())
    await settled()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('stops listening when asked', async () => {
    sessionStorage.clear()
    const { target, reload, stop } = listening(sessionStorage)
    stop()
    target.dispatchEvent(stale())
    await settled()
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('scriptNamedBy', () => {
  it('reads the address from the messages the browsers and the bundler give', () => {
    expect(scriptNamedBy(stale())).toBe(SCRIPT)
    expect(scriptNamedBy(stale('error loading dynamically imported module: /assets/A-1.js'))).toBe('/assets/A-1.js')
    expect(scriptNamedBy(stale('Unable to preload CSS for /assets/A-1.css'))).toBe('/assets/A-1.css')
    expect(scriptNamedBy(stale('Importing a module script failed.'))).toBeUndefined()
  })
})
