// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What every window of the app is given, whichever way it was made — at the
 * start, from the Dock, or for a document opened from Finder with every
 * window closed ({@link windowsOf}): a close that does not lose work, and a
 * word when its renderer is gone.
 *
 * **Closing must not lose the last few seconds of work.** The browser has
 * `beforeunload` for this and shows its own dialog; Electron fires the same
 * event and does NOT — returning a value there cancels the close silently,
 * which is worse than either alternative. So the conversation happens here.
 * It saves rather than asking. Everything in this app is written three
 * seconds after you stop typing; a window that interrupts you to ask whether
 * you meant it is a window that trains you to dismiss the question. What it
 * does ask about is the case where saving did not work — a folder that has
 * gone, a permission withdrawn — because closing then really does lose
 * something. The page's own `beforeunload` holds while work is unsaved, and
 * a close it holds is cancelled without a word unless main says otherwise
 * (`will-prevent-unload`): so *Close anyway* destroys the window, and a close
 * main has let go is not held by the page.
 *
 * **Closing never freezes, and never stalls a quit.** The page says what
 * closing would lose whenever it changes ({@link WindowHolds}), and a close is
 * decided by it at once: nothing, and the window goes; a write not landed,
 * and it says *Saving…* and goes when the write lands; a draft, and the page
 * asks its own question (*Leave with a draft?*), the window going only where
 * the person leaves it. Main asks its own question — a sheet, never a modal
 * loop in main — only where a write did not land in time, which is the one
 * time *could not be saved* is true. A close that was held and then goes
 * ahead tells main (`closed`), because a quit a window held is called off by
 * Electron and has to be asked again; one the person stopped calls it off
 * (`kept`). Nothing of one close is left for the next. A page that holds
 * nothing and does not answer within a second is closed without its answer.
 * Every wait says on the log how long it took.
 *
 * **A dead renderer is a window that will never paint again.** Without a word
 * it stays on screen showing the last frame it managed, and the only way to
 * tell it apart from a very slow app is to wait indefinitely. The log says
 * why it went, its exit code and the last error the page said before it did,
 * since the page's own trail went with it; and a renderer that hangs is said
 * when it hangs and when it answers again.
 *
 * **What it holds unsaved is its own.** Each window's page says so over
 * `app:unsaved` ({@link reportUnsaved}), and it is forgotten when the page is
 * replaced or the window goes: a flag left from a window closed anyway, or a
 * renderer that died, would hold the next window's close for a save nobody
 * owes and then say it failed.
 *
 * **What its page says reaches the log.** The desktop half of the diagnostics
 * port: the shell reports through `ConsoleDiagnostics`, which writes a
 * `[lvarch]` line, and that line lands in the log file without an IPC channel
 * having to exist for it. Filtered, for two reasons: `info` and `debug` from
 * libraries we do not own is noise that would push the crash off the end of
 * the file, and it is the one place model content could reach the log, since
 * a third-party `console.log` may carry anything it likes. Our own lines and
 * anything at warning or above get through — see the note at the top of
 * `log.ts`. Under `--smoke`, everything else is said on stderr too: a blank
 * window with a passing process is the failure mode the smoke exists to catch,
 * and it is indistinguishable from success without it.
 */
import type { BrowserWindow, Dialog } from 'electron'
import { DE } from '../../src/platform/strings/de'
import { EN } from '../../src/platform/strings/en'
import { NL } from '../../src/platform/strings/nl'

/** How long a close waits for the save it asked for before asking the person. */
export const SAVE_BEFORE_CLOSE_MS = 5_000

/**
 * How long a page that holds a close main thought free is given to say what it
 * holds, before it is closed anyway: its word is on its way, and a page that
 * holds nothing it can say holds nothing a close loses.
 */
export const PAGE_SAYS_MS = 500

/**
 * How long a page holding nothing main heard of has to answer a close. Past
 * it the window goes without the answer: a renderer busy or hung must not
 * hold the quit, and nothing it had said was waiting to be written.
 */
export const PAGE_ANSWERS_MS = 1_000

/**
 * What the renderer's own diagnostics lines start with
 * (`adapters/browser/ConsoleDiagnostics.ts`). Spelled out rather than imported:
 * this bundle compiles against Node and the DOM adapter it lives in does not.
 */
export const RENDERER_LOG_PREFIX = '[lvarch]'

/** How much of the renderer's last error is kept for the line that says it died. */
export const LAST_ERROR_KEPT = 2_000

/** As much of a window as its guards use. */
export type GuardedWindow = Pick<BrowserWindow, 'on' | 'close' | 'destroy' | 'isDestroyed'> & {
  webContents: Pick<BrowserWindow['webContents'], 'on' | 'reload'>
}

/** What closing a window would lose: nothing, a write not landed yet, or a draft no write keeps. */
export type WindowHolds = 'clean' | 'write' | 'draft'

/** Per page, what it holds; a page not heard from holds nothing. */
const holdsIn = new WeakMap<object, WindowHolds>()

/** Per page, what main does when the person leaves a draft at the page's question. */
const leavingIn = new WeakMap<object, () => void>()

/** A page said what closing it would lose (`app:unsaved`); anything else it says is nothing. */
export function reportUnsaved(contents: object, holds: unknown): void {
  holdsIn.set(contents, holds === 'write' || holds === 'draft' ? holds : 'clean')
}

/** The person left a draft at the page's question (`app:leaveAnyway`): its window goes, where main asked. */
export function leaveAnyway(contents: object): void {
  leavingIn.get(contents)?.()
}

/** Windows that can still answer: neither gone, nor showing a renderer that died. */
export function liveWindows(windows: readonly Pick<BrowserWindow, 'isDestroyed' | 'webContents'>[]): number {
  return windows.filter((one) => !one.isDestroyed() && !one.webContents.isCrashed()).length
}

export type WindowGuardDeps = {
  /** Ask the window to write now. */
  save: () => void
  /** Tell the window it waits for that write before it closes, so it can say *Saving…*; and that it no longer does. */
  saving?: (saving: boolean) => void
  /** A close that was held went ahead after all: whatever it was part of, a quit, goes on. */
  closed?: () => void
  /** The person kept the window open: whatever the close was part of, a quit, is off. */
  kept?: () => void
  /** Ask the page its own question about the draft it holds. */
  askDraft?: () => void
  /** Whether a quit is under way, and to ask for it again: a draft left after the quit was called off. */
  quitting?: () => boolean
  quit?: () => void
  /** Under `--smoke`, where nobody is there to answer. */
  unattended: boolean
  dialog: Pick<Dialog, 'showMessageBox'>
  log: (where: string, line: string) => void
  logFile: () => string
  /** Where a smoke run says what the page said that the log file leaves out. */
  echo: (line: string) => void
  /** The platform's words in the app's language, as main last heard it; English where it has heard nothing. */
  words?: () => PlatformWords
}

/** The platform's words, in one language. */
export type PlatformWords = Record<keyof typeof EN, string>

/** The platform's words in a language the app reports (`app:language`); English for any other. */
export function platformWords(language: unknown): PlatformWords {
  return language === 'nl' ? NL : language === 'de' ? DE : EN
}

export function guardWindow(window: GuardedWindow, deps: WindowGuardDeps): void {
  const { webContents: page } = window
  const holds = (): WindowHolds => holdsIn.get(page) ?? 'clean'
  // A page replaced, or a renderer gone, holds nothing any more.
  const forget = () => { holdsIn.delete(page) }
  page.on('did-navigate', forget)
  page.on('render-process-gone', forget)
  page.on('destroyed', forget)
  guardUnsavedWork(window, holds, deps)
  relayConsole(window, deps)
  // A load that neither finishes nor fails is the hardest thing to read from
  // outside the process: no window, no error, no exit. Say what went wrong.
  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    deps.log('renderer', `did-fail-load ${code} ${description} ${url}`)
  })
  // A renderer that hangs is the other way a window stops painting, and the
  // one a person reports as a crash: said when it starts and when it ends.
  window.on('unresponsive', () => { deps.log('renderer', 'unresponsive') })
  window.on('responsive', () => { deps.log('renderer', 'responsive again') })
  window.webContents.on('render-process-gone', (_event, details) => {
    deps.log('renderer', goneLine(details, lastErrorIn.get(page)))
    lastErrorIn.delete(page)
    if (deps.unattended || window.isDestroyed()) return
    void deps.dialog.showMessageBox(window as BrowserWindow, {
      type: 'error',
      message: 'The window stopped responding.',
      detail: `Reason: ${details.reason} (exit code ${details.exitCode}).\nDiagnostics: ${deps.logFile()}`,
      buttons: ['Reload', 'Close'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0 && !window.isDestroyed()) window.webContents.reload()
    })
  })
}

/**
 * Per page, the last error its renderer said. A renderer that dies takes its
 * own trail with it, and the line before the end is the one worth having
 * beside the reason: it is written again with the line that says it went.
 */
const lastErrorIn = new WeakMap<object, string>()

/** As much of Electron's `RenderProcessGoneDetails` as the line says. */
export type GoneDetails = { reason: string; exitCode: number }

/** The log's line for a renderer gone: why, its exit code, and the last error it said, where it said one. */
export function goneLine(details: GoneDetails, lastError: string | undefined): string {
  const said = lastError === undefined ? 'no error said before' : `last error: ${lastError}`
  return `render-process-gone reason=${details.reason} exitCode=${details.exitCode}; ${said}`
}

function relayConsole(window: GuardedWindow, deps: WindowGuardDeps): void {
  const page = window.webContents
  page.on('did-navigate', () => { lastErrorIn.delete(page) })
  window.webContents.on('console-message', (event) => {
    const ours = event.message.startsWith(RENDERER_LOG_PREFIX)
    if (event.level === 'error') lastErrorIn.set(page, event.message.slice(0, LAST_ERROR_KEPT))
    if (ours || event.level === 'warning' || event.level === 'error') {
      deps.log(`renderer[${event.level}]`, event.message)
      return
    }
    if (deps.unattended) deps.echo(`renderer[${event.level}] ${event.message}`)
  })
}

function guardUnsavedWork(window: GuardedWindow, holds: () => WindowHolds, deps: WindowGuardDeps): void {
  const page = window.webContents
  /** The close goes ahead: the work is saved, or the person said to close anyway. */
  let letting = false
  /** A close main let through, which the page may still object to; when it was let through. */
  let closing: number | undefined
  /** A close held for a write or a question: one at a time, and nothing of it left after. */
  let held = false

  const goAhead = (how: 'close' | 'destroy') => {
    held = false
    letting = true
    if (window.isDestroyed()) return
    if (how === 'close') window.close()
    else window.destroy()
    deps.closed?.()
  }
  /** The person stopped the close: the window is in use again, as if no close had been asked. */
  const stay = () => {
    held = false
    deps.saving?.(false)
    deps.kept?.()
  }

  /**
   * The page's own question about its draft. The quit, where this close is
   * part of one, is called off while it is asked — the person may write on for
   * as long as they like — and asked again where they leave.
   */
  const askDraft = (started: number) => {
    const quitting = deps.quitting?.() ?? false
    deps.saving?.(false)
    deps.kept?.()
    deps.log('main', `closing: the page asks about a draft after ${Date.now() - started} ms`)
    leavingIn.set(page, () => {
      leavingIn.delete(page)
      deps.log('main', 'closing: the draft was left')
      held = false
      letting = true
      if (!window.isDestroyed()) window.destroy()
      if (quitting) deps.quit?.()
    })
    // Asked once: a draft kept leaves the window as it was, for a later close to ask again.
    held = false
    deps.askDraft?.()
  }

  /**
   * Save, then close once the write has landed — or ask, where it did not land
   * in time. Never a frozen window: main polls and the question is a sheet, so
   * the page goes on painting its *Saving…*, and a write that lands while the
   * question is up closes the window and takes the question with it.
   */
  const closeWhenWritten = () => {
    held = true
    const started = Date.now()
    deps.log('main', 'closing: waiting for the page to write')
    deps.save()
    deps.saving?.(true)
    let asking: AbortController | undefined
    const poll = setInterval(() => {
      if (window.isDestroyed()) { clearInterval(poll); asking?.abort(); return }
      const now = holds()
      if (now !== 'write') {
        clearInterval(poll)
        asking?.abort()
        deps.log('main', `closing: written in ${Date.now() - started} ms`)
        if (now === 'draft') askDraft(started)
        else goAhead('close')
        return
      }
      if (asking || Date.now() - started <= SAVE_BEFORE_CLOSE_MS) return
      deps.log('main', `closing: not written in ${Date.now() - started} ms; asked`)
      asking = new AbortController()
      const signal = asking.signal
      void askNotSaved(signal).then((closeAnyway) => {
        if (signal.aborted) return
        clearInterval(poll)
        if (!closeAnyway) { stay(); return }
        // Closed as the person said, and not asked of the page: its own
        // `beforeunload` holds while work is unsaved, and would cancel a close
        // without a word.
        deps.log('main', `closing: closed anyway after ${Date.now() - started} ms`)
        goAhead('destroy')
      }, (error: unknown) => {
        clearInterval(poll)
        deps.log('main', `closing: the question failed: ${String(error)}`)
        stay()
      })
    }, 100)
  }

  /** The one question main asks itself: a write that did not land, which is when *could not be saved* is true. */
  const askNotSaved = async (signal: AbortSignal): Promise<boolean> => {
    const say = deps.words?.() ?? EN
    const { response } = await deps.dialog.showMessageBox(window as BrowserWindow, {
      type: 'warning',
      title: say['window.unsavedTitle'],
      message: say['window.unsavedMessage'],
      detail: say['window.unsavedDetail'],
      buttons: [say['window.closeAnyway'], say['window.keepOpen']],
      defaultId: 1,
      cancelId: 1,
      signal,
    })
    return response === 0
  }

  /** Decided by what the page holds now. */
  const decide = (started: number) => {
    const now = holds()
    if (now === 'write') closeWhenWritten()
    else if (now === 'draft') askDraft(started)
    else goAhead('close')
  }

  window.on('close', (event) => {
    if (letting || deps.unattended) return
    if (held) { event.preventDefault(); return }
    if (holds() === 'clean') {
      // Let through, for the page to answer. A page that does not answer —
      // its renderer busy or hung — holds nothing main heard of, and does not
      // get to hold the quit with it: it is closed without its answer.
      const at = Date.now()
      closing = at
      setTimeout(() => {
        if (closing !== at || held || letting || window.isDestroyed()) return
        closing = undefined
        deps.log('main', `closing: the page did not answer in ${PAGE_ANSWERS_MS} ms; closed without it`)
        goAhead('destroy')
      }, PAGE_ANSWERS_MS)
      return
    }
    event.preventDefault()
    decide(Date.now())
  })
  // The page's own `beforeunload` holds the unload while it holds something,
  // and Electron then cancels the close without a word. A close main has let
  // go — written, or closed anyway — goes on. One main thought free is held
  // for what the page says it holds, given a moment to say it: its word is on
  // its way. A reload the page holds stays held, as it always was.
  window.webContents.on('will-prevent-unload', (event) => {
    if (letting || deps.unattended) {
      event.preventDefault()
      return
    }
    if (closing === undefined) return
    closing = undefined
    held = true
    const started = Date.now()
    const wait = setInterval(() => {
      if (window.isDestroyed()) { clearInterval(wait); held = false; return }
      if (holds() === 'clean' && Date.now() - started <= PAGE_SAYS_MS) return
      clearInterval(wait)
      if (holds() === 'clean') deps.log('main', `closing: the page held the close and said nothing in ${PAGE_SAYS_MS} ms; closed`)
      decide(started)
    }, 50)
  })
}

/**
 * The app's windows, each made through one door and guarded there: the first
 * at the start, and one again where the app runs with none.
 */
export function windowsOf<W>(deps: {
  make: () => W
  guard: (window: W) => void
  load: (window: W) => Promise<void>
  open: () => number
  failed: (during: string, error: unknown) => void
}): { first: () => W; again: () => void } {
  const made = () => {
    const window = deps.make()
    deps.guard(window)
    return window
  }
  return {
    first: made,
    // The Dock's click, or a document opened from Finder with every window closed.
    again: () => {
      if (deps.open() !== 0) return
      deps.load(made()).catch((error: unknown) => deps.failed('reopening the window', error))
    },
  }
}
