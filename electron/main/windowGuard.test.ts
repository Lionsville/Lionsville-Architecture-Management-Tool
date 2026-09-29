// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every window is guarded, the one made again included: a close with unsaved
 * work saves first and asks where saving did not work — for what that window
 * holds, and nothing a window before it held — a renderer gone is said, and
 * what its page says reaches the log.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { guardWindow, liveWindows, reportUnsaved, SAVE_BEFORE_CLOSE_MS, windowsOf } from './windowGuard'
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
    crashed: false,
    destroyed: false,
    on,
    close: () => { held.closed += 1 },
    forced: 0,
    destroy: () => { held.forced += 1; held.destroyed = true },
    isDestroyed: () => held.destroyed,
    webContents: { on, reload: () => { held.reloaded += 1 }, isCrashed: () => held.crashed },
    raise: (event: string, ...args: unknown[]) => { for (const listener of listeners.get(event) ?? []) listener(...args) },
  }
  return held
}

type Window = ReturnType<typeof window>

function app(options: { answer?: number; unattended?: boolean } = {}) {
  const state = { saves: 0, asked: 0, logged: [] as string[], echoed: [] as string[] }
  const deps: WindowGuardDeps = {
    save: () => { state.saves += 1 },
    unattended: options.unattended ?? false,
    dialog: {
      showMessageBoxSync: () => { state.asked += 1; return options.answer ?? 1 },
      showMessageBox: () => Promise.resolve({ response: 0, checkboxChecked: false }),
    } as unknown as WindowGuardDeps['dialog'],
    log: (where, line) => { state.logged.push(`${where} ${line}`) },
    logFile: () => 'main.log',
    echo: (line) => { state.echoed.push(line) },
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
    const held = app()
    held.windows.first()
    held.allClosed()
    held.windows.again()
    const again = held.made[1]
    reportUnsaved(again.webContents, true)
    const event = held.closing(again)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(held.state.saves).toBe(1)
    await vi.advanceTimersByTimeAsync(SAVE_BEFORE_CLOSE_MS + 200)
    expect(held.state.asked).toBe(1)
    expect(again.closed).toBe(0)
  })

  it('closes once the save has landed, without asking', async () => {
    const held = app()
    held.windows.again()
    const [again] = held.made
    reportUnsaved(again.webContents, true)
    held.closing(again)
    reportUnsaved(again.webContents, false)
    await vi.advanceTimersByTimeAsync(200)
    expect(again.closed).toBe(1)
    expect(held.state.asked).toBe(0)
  })

  it('offers to reload once its renderer is gone', async () => {
    const held = app()
    held.windows.again()
    const [again] = held.made
    again.raise('render-process-gone', {}, { reason: 'crashed' })
    await vi.advanceTimersByTimeAsync(0)
    expect(again.reloaded).toBe(1)
  })

  it('is made only where the app has no window', () => {
    const held = app()
    held.windows.first()
    held.windows.again()
    expect(held.made).toHaveLength(1)
  })
})

describe('closing anyway, and what the page says about it', () => {
  const unloading = (one: Window) => {
    const event = { preventDefault: vi.fn() }
    one.raise('will-prevent-unload', event)
    return event
  }

  it('closes anyway without asking the page, whose own unload handler would cancel it', async () => {
    const held = app({ answer: 0 })
    const first = held.windows.first()
    reportUnsaved(first.webContents, true)
    held.closing(first)
    await vi.advanceTimersByTimeAsync(SAVE_BEFORE_CLOSE_MS + 200)
    expect(held.state.asked).toBe(1)
    expect(first.forced).toBe(1)
    expect(first.closed).toBe(0)
  })

  it('does not let the page hold a close once the work is saved', async () => {
    const held = app()
    const first = held.windows.first()
    reportUnsaved(first.webContents, true)
    held.closing(first)
    reportUnsaved(first.webContents, false)
    await vi.advanceTimersByTimeAsync(200)
    expect(first.closed).toBe(1)
    // The page had not heard yet, and holds the unload.
    expect(unloading(first).preventDefault).toHaveBeenCalled()
  })

  it('saves first where the page knows of work main did not, then closes', async () => {
    const held = app()
    const first = held.windows.first()
    expect(held.closing(first).preventDefault).not.toHaveBeenCalled()
    expect(unloading(first).preventDefault).not.toHaveBeenCalled()
    expect(held.state.saves).toBe(1)
    await vi.advanceTimersByTimeAsync(200)
    expect(first.closed).toBe(1)
  })

  it('leaves a reload the page holds held, as it always was', () => {
    const held = app()
    const first = held.windows.first()
    expect(unloading(first).preventDefault).not.toHaveBeenCalled()
    expect(held.state.saves).toBe(0)
  })
})

describe('what a window holds unsaved', () => {
  it('is its own: a window closed anyway leaves nothing the next one must wait for', () => {
    const held = app({ answer: 0 })
    const first = held.windows.first()
    reportUnsaved(first.webContents, true)
    first.raise('destroyed')
    held.allClosed()
    held.windows.again()
    expect(held.closing(held.made[1]).preventDefault).not.toHaveBeenCalled()
  })

  it('is forgotten when its page is replaced or its renderer dies', () => {
    const held = app()
    const first = held.windows.first()
    reportUnsaved(first.webContents, true)
    first.raise('did-navigate')
    expect(held.closing(first).preventDefault).not.toHaveBeenCalled()
    reportUnsaved(first.webContents, true)
    first.raise('render-process-gone', {}, { reason: 'crashed' })
    expect(held.closing(first).preventDefault).not.toHaveBeenCalled()
  })

  it('lets a window with nothing unsaved go at once', () => {
    const held = app()
    const first = held.windows.first()
    expect(held.closing(first).preventDefault).not.toHaveBeenCalled()
  })
})

describe('what a window’s page says', () => {
  it('reaches the log from every window, filtered, and all of it on stderr under the smoke', () => {
    const held = app({ unattended: true })
    held.windows.first()
    held.allClosed()
    held.windows.again()
    const again = held.made[1]
    again.raise('console-message', { level: 'info', message: '[lvarch] INFO source: the source is open' })
    again.raise('console-message', { level: 'info', message: 'a library chatting' })
    again.raise('console-message', { level: 'error', message: 'Uncaught Error' })
    expect(held.state.logged).toEqual(['renderer[info] [lvarch] INFO source: the source is open', 'renderer[error] Uncaught Error'])
    expect(held.state.echoed).toEqual(['renderer[info] a library chatting'])
  })

  it('says nothing more than the log where nobody runs the smoke', () => {
    const held = app()
    const first = held.windows.first()
    first.raise('console-message', { level: 'info', message: 'a library chatting' })
    expect(held.state.logged).toEqual([])
    expect(held.state.echoed).toEqual([])
  })
})

describe('the windows that can still answer', () => {
  it('leaves out one gone, and one showing a renderer that died', () => {
    const live = window()
    const dead = window()
    dead.crashed = true
    const gone = window()
    gone.destroyed = true
    expect(liveWindows([live, dead, gone] as never)).toBe(1)
  })
})
