// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A tab left open over a deploy, and the script it asks for that is gone.
 *
 * The parts reached later arrive in scripts of their own (`widgets/lazyPart`),
 * named by a hash of what is in them. A deploy replaces every one of those
 * names; a tab that was open before it still holds the old page, and the first
 * time somebody presses a card whose page was not loaded yet, it asks for a
 * script the server no longer has. The bundler says so with this event, and
 * the answer is the page again — the new one, which names the scripts that
 * exist.
 *
 * **Never over work a reload would lose.** A tab holding an edit not yet
 * written, or working from a source nothing outlives the tab in, is not
 * reloaded: `mayReload` says so, the event is left alone, and the part that
 * asked for the script refuses in its own words — the person keeps their
 * work and reloads once it is kept.
 *
 * **Once.** A reload that meets the same event again straight away is a
 * deploy that is broken rather than new, and reloading it for ever is a tab
 * nobody can use. So the moment is kept in this tab's session storage, and a
 * second event inside the window is left to the boundary that draws a part
 * that would not load. Without session storage there is no way to know, and
 * the event is left alone the same way.
 */
import type { Diagnostics } from '../../ports/Diagnostics'

/** What the bundler dispatches on `window` when a script a part needs will not load. */
export const STALE_SCRIPTS_EVENT = 'vite:preloadError'

/** Where this tab remembers that it has just reloaded for it. */
export const STALE_SCRIPTS_KEY = 'lvarch.reloadedForScripts'

/** How long after such a reload another event is taken for a broken deploy. */
export const STALE_SCRIPTS_WINDOW_MS = 30_000

export type StaleScriptsDeps = {
  reload(): void
  diagnostics: Diagnostics
  /** Where the event arrives: the window, in a page. */
  target?: EventTarget
  /** This tab's session storage, or nothing where the browser will not give it. */
  storage?: () => Storage | undefined
  now?: () => number
  /**
   * Whether a reload now loses nothing: no edit unwritten, and a source that
   * outlives the tab. Absent, it always may.
   */
  mayReload?: () => boolean
}

export function reloadOnStaleScripts(deps: StaleScriptsDeps): () => void {
  const target = deps.target ?? window
  const storage = deps.storage ?? (() => window.sessionStorage)
  const now = deps.now ?? Date.now
  const heard = (event: Event): void => {
    if (deps.mayReload && !deps.mayReload()) {
      deps.diagnostics.report({
        level: 'warn', where: 'scripts', message: 'a script this page needs would not load; not reloading over work a reload would lose',
      })
      return
    }
    let held: Storage | undefined
    try {
      held = storage()
    } catch {
      held = undefined
    }
    const last = Number(tryRead(held))
    if (!held || (Number.isFinite(last) && now() - last < STALE_SCRIPTS_WINDOW_MS)) {
      deps.diagnostics.report({
        level: 'error', where: 'scripts', message: 'a script this page needs would not load, and a reload did not bring it',
      })
      return
    }
    try {
      held.setItem(STALE_SCRIPTS_KEY, String(now()))
    } catch {
      // A reload that could not be remembered is one that could loop.
      deps.diagnostics.report({ level: 'error', where: 'scripts', message: 'a script this page needs would not load' })
      return
    }
    // The bundler's own rejection is not thrown: the page is going.
    event.preventDefault()
    deps.diagnostics.report({ level: 'info', where: 'scripts', message: 'the page named scripts that are gone; loading it again' })
    deps.reload()
  }
  target.addEventListener(STALE_SCRIPTS_EVENT, heard)
  return () => target.removeEventListener(STALE_SCRIPTS_EVENT, heard)
}

function tryRead(storage: Storage | undefined): string | null {
  try {
    return storage?.getItem(STALE_SCRIPTS_KEY) ?? null
  } catch {
    return null
  }
}
