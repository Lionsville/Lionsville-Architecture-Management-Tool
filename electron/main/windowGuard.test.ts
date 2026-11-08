// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every window is guarded, the one made again included: a close with unsaved
 * work saves first and asks where saving did not work — for what that window
 * holds, and nothing a window before it held — a renderer gone is said, and
 * what its page says reaches the log.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { guardWindow, leaveAnyway, liveWindows, PAGE_ANSWERS_MS, PAGE_SAYS_MS, platformWords, reportUnsaved, SAVE_BEFORE_CLOSE_MS, windowsOf } from './windowGuard'
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

function app(options: { answer?: number; unattended?: boolean; language?: string; answerAfter?: number } = {}) {
  const state = {
    saves: 0, asked: 0, logged: [] as string[], echoed: [] as string[], question: undefined as unknown,
    saying: [] as boolean[], closedAfterHold: 0, kept: 0, abandoned: 0, draftsAsked: 0, quits: 0, quitting: false,
  }
  const deps: WindowGuardDeps = {
    save: () => { state.saves += 1 },
    saving: (saying) => { state.saying.push(saying) },
    closed: () => { state.closedAfterHold += 1 },
    kept: () => { state.kept += 1; state.quitting = false },
    askDraft: () => { state.draftsAsked += 1 },
    quitting: () => state.quitting,
    quit: () => { state.quits += 1 },
    unattended: options.unattended ?? false,
    dialog: {
      showMessageBox: (_window: unknown, question: { signal?: AbortSignal }) => {
        state.asked += 1
        state.question = question
        // A sheet: answered later, or taken away by main where the write lands first.
        return new Promise((resolve) => {
          question.signal?.addEventListener('abort', () => { state.abandoned += 1; resolve({ response: 1, checkboxChecked: false }) })
          setTimeout(() => resolve({ response: options.answer ?? 1, checkboxChecked: false }), options.answerAfter ?? 0)
        })
      },
    } as unknown as WindowGuardDeps['dialog'],
    log: (where, line) => { state.logged.push(`${where} ${line}`) },
    logFile: () => 'main.log',
    echo: (line) => { state.echoed.push(line) },
    ...(options.language ? { words: () => platformWords(options.language) } : {}),
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
    reportUnsaved(again.webContents, 'write')
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
    reportUnsaved(again.webContents, 'write')
    held.closing(again)
    reportUnsaved(again.webContents, 'clean')
    await vi.advanceTimersByTimeAsync(200)
    expect(again.closed).toBe(1)
    expect(held.state.asked).toBe(0)
  })

  it('offers to reload once its renderer is gone', async () => {
    const held = app({ answer: 0 })
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
    reportUnsaved(first.webContents, 'write')
    held.closing(first)
    await vi.advanceTimersByTimeAsync(SAVE_BEFORE_CLOSE_MS + 200)
    expect(held.state.asked).toBe(1)
    expect(first.forced).toBe(1)
    expect(first.closed).toBe(0)
  })

  it('does not let the page hold a close once the work is saved', async () => {
    const held = app()
    const first = held.windows.first()
    reportUnsaved(first.webContents, 'write')
    held.closing(first)
    reportUnsaved(first.webContents, 'clean')
    await vi.advanceTimersByTimeAsync(200)
    expect(first.closed).toBe(1)
    // The page had not heard yet, and holds the unload.
    expect(unloading(first).preventDefault).toHaveBeenCalled()
  })

  it('saves first where the page knows of work main did not, and closes once the page says it is written', async () => {
    const held = app()
    const first = held.windows.first()
    reportUnsaved(first.webContents, 'clean')
    expect(held.closing(first).preventDefault).not.toHaveBeenCalled()
    expect(unloading(first).preventDefault).not.toHaveBeenCalled()
    // The page says the write it held the close for, then that it landed.
    reportUnsaved(first.webContents, 'write')
    await vi.advanceTimersByTimeAsync(PAGE_SAYS_MS + 500)
    expect(held.state.saves).toBe(1)
    expect(first.closed).toBe(0)
    reportUnsaved(first.webContents, 'clean')
    await vi.advanceTimersByTimeAsync(200)
    expect(first.closed).toBe(1)
    expect(held.state.asked).toBe(0)
  })

  it('has the page ask its own question at once where it holds a draft, and never says it could not be saved', async () => {
    const held = app()
    const first = held.windows.first()
    reportUnsaved(first.webContents, 'draft')
    expect(held.closing(first).preventDefault).toHaveBeenCalled()
    expect(held.state.draftsAsked).toBe(1)
    await vi.advanceTimersByTimeAsync(SAVE_BEFORE_CLOSE_MS * 2)
    expect(held.state.asked).toBe(0)
    expect(first.closed + first.forced).toBe(0)
  })

  it('asks about a draft the page held the close for before main had heard of it', async () => {
    const held = app()
    const first = held.windows.first()
    held.closing(first)
    unloading(first)
    reportUnsaved(first.webContents, 'draft')
    await vi.advanceTimersByTimeAsync(100)
    expect(held.state.draftsAsked).toBe(1)
    expect(held.state.asked).toBe(0)
  })

  it('closes, and lets the quit go on, where the person leaves the draft', async () => {
    const held = app()
    const first = held.windows.first()
    held.state.quitting = true
    reportUnsaved(first.webContents, 'draft')
    held.closing(first)
    // The quit is off while the page asks: the person may write on.
    expect(held.state.quitting).toBe(false)
    leaveAnyway(first.webContents)
    expect(first.forced).toBe(1)
    expect(held.state.quits).toBe(1)
  })

  it('keeps nothing of a close the person stopped: close, keep writing, close with nothing held goes at once', async () => {
    const held = app()
    const first = held.windows.first()
    reportUnsaved(first.webContents, 'draft')
    held.closing(first)
    expect(held.state.draftsAsked).toBe(1)
    // Keep writing, then the draft is sent or dropped.
    reportUnsaved(first.webContents, 'clean')
    expect(held.closing(first).preventDefault).not.toHaveBeenCalled()
    first.destroyed = true
    await vi.advanceTimersByTimeAsync(SAVE_BEFORE_CLOSE_MS + 200)
    expect(held.state.asked).toBe(0)
    expect(held.state.draftsAsked).toBe(1)
    // A leave said long after is nobody's answer.
    leaveAnyway(first.webContents)
    expect(first.forced).toBe(0)
  })

  it('keeps nothing of a close the person kept open at the could-not-be-saved question', async () => {
    const held = app({ answer: 1 })
    const first = held.windows.first()
    reportUnsaved(first.webContents, 'write')
    held.closing(first)
    await vi.advanceTimersByTimeAsync(SAVE_BEFORE_CLOSE_MS + 200)
    expect(held.state.asked).toBe(1)
    reportUnsaved(first.webContents, 'clean')
    expect(held.closing(first).preventDefault).not.toHaveBeenCalled()
    expect(held.state.saves).toBe(1)
  })

  it('closes where the page held the close and said nothing it holds in time', async () => {
    const held = app()
    const first = held.windows.first()
    held.closing(first)
    unloading(first)
    await vi.advanceTimersByTimeAsync(PAGE_SAYS_MS + 100)
    expect(first.closed).toBe(1)
    expect(held.state.asked + held.state.draftsAsked).toBe(0)
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
    reportUnsaved(first.webContents, 'write')
    first.raise('destroyed')
    held.allClosed()
    held.windows.again()
    expect(held.closing(held.made[1]).preventDefault).not.toHaveBeenCalled()
  })

  it('is forgotten when its page is replaced or its renderer dies', () => {
    const held = app()
    const first = held.windows.first()
    reportUnsaved(first.webContents, 'write')
    first.raise('did-navigate')
    expect(held.closing(first).preventDefault).not.toHaveBeenCalled()
    reportUnsaved(first.webContents, 'write')
    first.raise('render-process-gone', {}, { reason: 'crashed' })
    expect(held.closing(first).preventDefault).not.toHaveBeenCalled()
  })

  it('lets a window with nothing unsaved go at once', () => {
    const held = app()
    const first = held.windows.first()
    expect(held.closing(first).preventDefault).not.toHaveBeenCalled()
  })
})

describe('closing never freezes, and never stalls a quit', () => {
  it('says Saving… while it waits for the write, and lets the quit go on once the window has gone', async () => {
    const held = app()
    const first = held.windows.first()
    reportUnsaved(first.webContents, 'write')
    held.closing(first)
    expect(held.state.saying).toEqual([true])
    reportUnsaved(first.webContents, 'clean')
    await vi.advanceTimersByTimeAsync(200)
    expect(first.closed).toBe(1)
    expect(held.state.closedAfterHold).toBe(1)
    expect(held.state.logged.some((line) => /closing: written in \d+ ms/.test(line))).toBe(true)
  })

  it('closes a page that does not answer within a second where nothing was said to be pending', async () => {
    const held = app()
    const first = held.windows.first()
    held.closing(first)
    await vi.advanceTimersByTimeAsync(PAGE_ANSWERS_MS - 100)
    expect(first.forced).toBe(0)
    await vi.advanceTimersByTimeAsync(200)
    expect(first.forced).toBe(1)
    expect(held.state.closedAfterHold).toBe(1)
  })

  it('leaves a page that answered in time to its own close', async () => {
    const held = app()
    const first = held.windows.first()
    held.closing(first)
    first.destroyed = true
    await vi.advanceTimersByTimeAsync(PAGE_ANSWERS_MS + 200)
    expect(first.forced).toBe(0)
  })

  it('takes the question away and closes where the write lands while it is asked', async () => {
    const held = app({ answerAfter: 60_000 })
    const first = held.windows.first()
    reportUnsaved(first.webContents, 'write')
    held.closing(first)
    await vi.advanceTimersByTimeAsync(SAVE_BEFORE_CLOSE_MS + 200)
    expect(held.state.asked).toBe(1)
    reportUnsaved(first.webContents, 'clean')
    await vi.advanceTimersByTimeAsync(200)
    expect(held.state.abandoned).toBe(1)
    expect(first.closed).toBe(1)
    expect(first.forced).toBe(0)
  })

  it('calls the quit off and stops saying Saving… where the person keeps the window open', async () => {
    const held = app({ answer: 1 })
    const first = held.windows.first()
    reportUnsaved(first.webContents, 'write')
    held.closing(first)
    await vi.advanceTimersByTimeAsync(SAVE_BEFORE_CLOSE_MS + 200)
    expect(held.state.kept).toBe(1)
    expect(held.state.saying).toEqual([true, false])
    expect(first.closed + first.forced).toBe(0)
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

  it('says why a renderer went, its exit code and the last error it said before it did', () => {
    const held = app({ unattended: true })
    const first = held.windows.first()
    first.raise('console-message', { level: 'error', message: '[lvarch] ERROR window: uncaught error' })
    first.raise('console-message', { level: 'warning', message: 'a warning after it' })
    first.raise('render-process-gone', {}, { reason: 'oom', exitCode: 133 })
    expect(held.state.logged.at(-1)).toBe('renderer render-process-gone reason=oom exitCode=133; last error: [lvarch] ERROR window: uncaught error')
  })

  it('says a renderer went with nothing said before, and forgets a page replaced', () => {
    const held = app({ unattended: true })
    const first = held.windows.first()
    first.raise('console-message', { level: 'error', message: 'from the page before' })
    first.raise('did-navigate')
    first.raise('render-process-gone', {}, { reason: 'crashed', exitCode: 11 })
    expect(held.state.logged.at(-1)).toBe('renderer render-process-gone reason=crashed exitCode=11; no error said before')
  })

  it('says when a renderer hangs and when it answers again', () => {
    const held = app({ unattended: true })
    const first = held.windows.first()
    first.raise('unresponsive')
    first.raise('responsive')
    expect(held.state.logged).toEqual(['renderer unresponsive', 'renderer responsive again'])
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

describe('the question closing asks', () => {
  /** A window closed with work that will not save, and the question it then asks. */
  async function asked(language?: string) {
    const held = app(language ? { language } : {})
    const first = held.windows.first()
    reportUnsaved(first.webContents, 'write')
    held.closing(first)
    await vi.advanceTimersByTimeAsync(SAVE_BEFORE_CLOSE_MS + 200)
    return held.state.question as { title: string; message: string; detail: string; buttons: string[] }
  }

  it('is asked in the app’s language', async () => {
    expect(await asked('nl')).toMatchObject({
      title: 'Niet-bewaarde wijzigingen', message: 'Deze scope kon niet worden bewaard.', buttons: ['Toch sluiten', 'Venster open laten'],
    })
    expect((await asked('de')).buttons).toEqual(['Trotzdem schließen', 'Fenster geöffnet lassen'])
  })

  it('is asked in English where main has heard no language, or one it does not know', async () => {
    expect((await asked()).buttons).toEqual(['Close anyway', 'Keep the window open'])
    expect((await asked('fr')).message).toBe('This scope could not be saved.')
  })
})

