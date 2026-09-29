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
 * something.
 *
 * **A dead renderer is a window that will never paint again.** Without a word
 * it stays on screen showing the last frame it managed, and the only way to
 * tell it apart from a very slow app is to wait indefinitely.
 */
import type { BrowserWindow, Dialog } from 'electron'

/** How long a close waits for the save it asked for before asking the person. */
export const SAVE_BEFORE_CLOSE_MS = 5_000

/** As much of a window as its guards use. */
export type GuardedWindow = Pick<BrowserWindow, 'on' | 'close' | 'isDestroyed'> & {
  webContents: Pick<BrowserWindow['webContents'], 'on' | 'reload'>
}

export type WindowGuardDeps = {
  /** Does the window hold work that closing would lose? The renderer says, over `app:unsaved`. */
  unsaved: () => boolean
  /** Ask the window to write now. */
  save: () => void
  /** Under `--smoke`, where nobody is there to answer. */
  unattended: boolean
  dialog: Pick<Dialog, 'showMessageBox' | 'showMessageBoxSync'>
  log: (where: string, line: string) => void
  logFile: () => string
}

export function guardWindow(window: GuardedWindow, deps: WindowGuardDeps): void {
  guardUnsavedWork(window, deps)
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

function guardUnsavedWork(window: GuardedWindow, deps: WindowGuardDeps): void {
  let letting = false
  window.on('close', (event) => {
    if (letting || !deps.unsaved() || deps.unattended) return
    event.preventDefault()
    deps.save()

    const deadline = Date.now() + SAVE_BEFORE_CLOSE_MS
    const poll = setInterval(() => {
      if (!deps.unsaved()) {
        clearInterval(poll)
        letting = true
        window.close()
        return
      }
      if (Date.now() <= deadline) return
      clearInterval(poll)
      const choice = deps.dialog.showMessageBoxSync(window as BrowserWindow, {
        type: 'warning',
        message: 'This project could not be saved.',
        detail: 'Closing now loses the changes that are still only in this window.',
        buttons: ['Close anyway', 'Keep the window open'],
        defaultId: 1,
        cancelId: 1,
      })
      if (choice !== 0) return
      letting = true
      window.close()
    }, 100)
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
