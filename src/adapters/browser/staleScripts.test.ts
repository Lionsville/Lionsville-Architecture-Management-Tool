// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { RecordingDiagnostics } from '../memory/RecordingDiagnostics'
import { reloadOnStaleScripts, STALE_SCRIPTS_EVENT, STALE_SCRIPTS_KEY, STALE_SCRIPTS_WINDOW_MS } from './staleScripts'

function stale(): Event {
  return new Event(STALE_SCRIPTS_EVENT, { cancelable: true })
}

function listening(storage: Storage | undefined, at = 1_000_000) {
  const target = new EventTarget()
  const reload = vi.fn()
  const diagnostics = new RecordingDiagnostics()
  const stop = reloadOnStaleScripts({ reload, diagnostics, target, storage: () => storage, now: () => at })
  return { target, reload, diagnostics, stop }
}

describe('reloadOnStaleScripts', () => {
  it('loads the page again when a deploy took away a script it names', () => {
    sessionStorage.clear()
    const { target, reload } = listening(sessionStorage)
    const event = stale()
    target.dispatchEvent(event)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('does not reload a second time straight after the first, which would be a broken deploy for ever', () => {
    sessionStorage.clear()
    sessionStorage.setItem(STALE_SCRIPTS_KEY, String(1_000_000 - STALE_SCRIPTS_WINDOW_MS / 2))
    const { target, reload, diagnostics } = listening(sessionStorage)
    const event = stale()
    target.dispatchEvent(event)
    expect(reload).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    expect(diagnostics.recent().some((entry) => entry.where === 'scripts' && entry.level === 'error')).toBe(true)
  })

  it('reloads again once the window has passed', () => {
    sessionStorage.clear()
    sessionStorage.setItem(STALE_SCRIPTS_KEY, String(1_000_000 - STALE_SCRIPTS_WINDOW_MS * 2))
    const { target, reload } = listening(sessionStorage)
    target.dispatchEvent(stale())
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('leaves the event alone where it cannot remember having reloaded', () => {
    const { target, reload } = listening(undefined)
    target.dispatchEvent(stale())
    expect(reload).not.toHaveBeenCalled()
  })

  it('stops listening when asked', () => {
    sessionStorage.clear()
    const { target, reload, stop } = listening(sessionStorage)
    stop()
    target.dispatchEvent(stale())
    expect(reload).not.toHaveBeenCalled()
  })
})
