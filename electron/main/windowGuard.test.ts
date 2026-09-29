// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every window is guarded, the one made again included: a close with unsaved
 * work saves first and asks where saving did not work, and a renderer gone
 * is said.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { guardWindow, SAVE_BEFORE_CLOSE_MS, windowsOf } from './windowGuard'
import type { WindowGuardDeps } from './windowGuard'

vi.mock('electron', () => ({}))

/** A window as far as its guards go: its events raised by the test, and whether it closed. */
function window() {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>()
  const on = (event: string, listener: (...args: unknown[]) => void) => {
    listeners.set(event, [...listeners.get(event) ?? [], listener])
  }
  const held = {
    closed: 0,
    reloaded: 0,
    on,
    close: () => { held.closed += 1 },
    isDestroyed: () => false,
    webContents: { on, reload: () => { held.reloaded += 1 } },
    raise: (event: string, ...args: unknown[]) => { for (const listener of listeners.get(event) ?? []) listener(...args) },
  }
  return held
}

type Window = ReturnType<typeof window>

function app(options: { unsaved: boolean; answer?: number }) {
  const state = { unsaved: options.unsaved, saves: 0, asked: 0 }
  const deps: WindowGuardDeps = {
    unsaved: () => state.unsaved,
    save: () => { state.saves += 1 },
    unattended: false,
    dialog: {
      showMessageBoxSync: () => { state.asked += 1; return options.answer ?? 1 },
      showMessageBox: () => Promise.resolve({ response: 0, checkboxChecked: false }),
    } as unknown as WindowGuardDeps['dialog'],
    log: () => undefined,
    logFile: () => 'main.log',
  }
  const made: Window[] = []
  let open = 0
  const windows = windowsOf<Window>({
    make: () => { const one = window(); made.push(one); open += 1; return one },
    guard: (one) => guardWindow(one as never, deps),
    load: () => Promise.resolve(),
    open: () => open,
    failed: () => undefined,
  })
  const closing = (one: Window) => {
    const event = { preventDefault: vi.fn() }
    one.raise('close', event)
    return event
  }
  return { state, windows, made, closing, allClosed: () => { open = 0 } }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('a window made again, where the app ran with none', () => {
  it('saves before it closes with unsaved work, and asks where saving did not work', async () => {
    const held = app({ unsaved: true })
    held.windows.first()
    held.allClosed()
    held.windows.again()
    const again = held.made[1]
    expect(again).toBeDefined()
    const event = held.closing(again)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(held.state.saves).toBe(1)
    await vi.advanceTimersByTimeAsync(SAVE_BEFORE_CLOSE_MS + 200)
    expect(held.state.asked).toBe(1)
    expect(again.closed).toBe(0)
  })

  it('closes once the save has landed, without asking', async () => {
    const held = app({ unsaved: true })
    held.windows.again()
    const [again] = held.made
    held.closing(again)
    held.state.unsaved = false
    await vi.advanceTimersByTimeAsync(200)
    expect(again.closed).toBe(1)
    expect(held.state.asked).toBe(0)
  })

  it('offers to reload once its renderer is gone', async () => {
    const held = app({ unsaved: false })
    held.windows.again()
    const [again] = held.made
    again.raise('render-process-gone', {}, { reason: 'crashed' })
    await vi.advanceTimersByTimeAsync(0)
    expect(again.reloaded).toBe(1)
  })

  it('is made only where the app has no window', () => {
    const held = app({ unsaved: false })
    held.windows.first()
    held.windows.again()
    expect(held.made).toHaveLength(1)
  })
})

describe('closing a window with nothing unsaved', () => {
  it('lets it go at once', () => {
    const held = app({ unsaved: false })
    const first = held.windows.first()
    expect(held.closing(first).preventDefault).not.toHaveBeenCalled()
  })
})
