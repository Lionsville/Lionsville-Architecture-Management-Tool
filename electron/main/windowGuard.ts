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
 * **A dead renderer is a window that will never paint again.** Without a word
 * it stays on screen showing the last frame it managed, and the only way to
 * tell it apart from a very slow app is to wait indefinitely.
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

/** How long a close waits for the save it asked for before asking the person. */
export const SAVE_BEFORE_CLOSE_MS = 5_000

/**
 * What the renderer's own diagnostics lines start with
 * (`adapters/browser/ConsoleDiagnostics.ts`). Spelled out rather than imported:
 * this bundle compiles against Node and the DOM adapter it lives in does not.
 */
export const RENDERER_LOG_PREFIX = '[lvarch]'

/** As much of a window as its guards use. */
export type GuardedWindow = Pick<BrowserWindow, 'on' | 'close' | 'destroy' | 'isDestroyed'> & {
  webContents: Pick<BrowserWindow['webContents'], 'on' | 'reload'>
}

/** Per page, whether it holds work closing would lose; a page not heard from holds none. */
const unsavedIn = new WeakMap<object, boolean>()

/** A page said whether it holds work that closing would lose (`app:unsaved`). */
export function reportUnsaved(contents: object, unsaved: boolean): void {
  unsavedIn.set(contents, unsaved)
}

/** Windows that can still answer: neither gone, nor showing a renderer that died. */
export function liveWindows(windows: readonly Pick<BrowserWindow, 'isDestroyed' | 'webContents'>[]): number {
  return windows.filter((one) => !one.isDestroyed() && !one.webContents.isCrashed()).length
}

export type WindowGuardDeps = {
  /** Ask the window to write now. */
  save: () => void
  /** Under `--smoke`, where nobody is there to answer. */
  unattended: boolean
  dialog: Pick<Dialog, 'showMessageBox' | 'showMessageBoxSync'>
  log: (where: string, line: string) => void
  logFile: () => string
  /** Where a smoke run says what the page said that the log file leaves out. */
  echo: (line: string) => void
}

export function guardWindow(window: GuardedWindow, deps: WindowGuardDeps): void {
  const { webContents: page } = window
  const unsaved = () => unsavedIn.get(page) === true
  // A page replaced, or a renderer gone, holds nothing any more.
  const forget = () => { unsavedIn.delete(page) }
  page.on('did-navigate', forget)
  page.on('render-process-gone', forget)
  page.on('destroyed', forget)
  guardUnsavedWork(window, unsaved, deps)
  relayConsole(window, deps)
  // A load that neither finishes nor fails is the hardest thing to read from
  // outside the process: no window, no error, no exit. Say what went wrong.
  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    deps.log('renderer', `did-fail-load ${code} ${description} ${url}`)
  })
  window.webContents.on('render-process-gone', (_event, details) => {
    deps.log('renderer', `render-process-gone ${details.reason}`)
    if (deps.unattended || window.isDestroyed()) return
    void deps.dialog.showMessageBox(window as BrowserWindow, {
      type: 'error',
      message: 'The window stopped responding.',
      detail: `Reason: ${details.reason}.\nDiagnostics: ${deps.logFile()}`,
      buttons: ['Reload', 'Close'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0 && !window.isDestroyed()) window.webContents.reload()
    })
  })
}

function relayConsole(window: GuardedWindow, deps: WindowGuardDeps): void {
  window.webContents.on('console-message', (event) => {
    const ours = event.message.startsWith(RENDERER_LOG_PREFIX)
    if (ours || event.level === 'warning' || event.level === 'error') {
      deps.log(`renderer[${event.level}]`, event.message)
      return
    }
    if (deps.unattended) deps.echo(`renderer[${event.level}] ${event.message}`)
  })
}

function guardUnsavedWork(window: GuardedWindow, unsaved: () => boolean, deps: WindowGuardDeps): void {
  /** The close goes ahead: the work is saved, or the person said to close anyway. */
  let letting = false
  /** A close main let through, which the page may still object to. */
  let closing = false
  let waiting = false

  /** Save, then close once saved — or ask, where saving did not work in time. */
  const closeWhenSaved = () => {
    if (waiting) return
    waiting = true
    deps.save()
    const deadline = Date.now() + SAVE_BEFORE_CLOSE_MS
    const poll = setInterval(() => {
      if (!unsaved()) {
        clearInterval(poll)
        waiting = false
        letting = true
        window.close()
        return
      }
      if (Date.now() <= deadline) return
      clearInterval(poll)
      waiting = false
      const choice = deps.dialog.showMessageBoxSync(window as BrowserWindow, {
        type: 'warning',
        message: 'This project could not be saved.',
        detail: 'Closing now loses the changes that are still only in this window.',
        buttons: ['Close anyway', 'Keep the window open'],
        defaultId: 1,
        cancelId: 1,
      })
      if (choice !== 0) return
      // Closed as the person said, and not asked of the page: its own
      // `beforeunload` holds while work is unsaved, and would cancel a close
      // without a word.
      letting = true
      window.destroy()
    }, 100)
  }

  window.on('close', (event) => {
    if (letting || deps.unattended) return
    if (!unsaved()) {
      closing = true
      return
    }
    event.preventDefault()
    closeWhenSaved()
  })
  // The page's own `beforeunload` holds the unload while it has work unsaved,
  // and Electron then cancels the close without a word. A close main has let
  // go — saved, or closed anyway — goes on; one the page knows more about
  // than main did is saved first, as any close with work unsaved is. A reload
  // the page holds stays held, as it always was.
  window.webContents.on('will-prevent-unload', (event) => {
    if (letting || deps.unattended) {
      event.preventDefault()
      return
    }
    if (!closing) return
    closing = false
    closeWhenSaved()
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
