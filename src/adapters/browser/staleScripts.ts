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
 * **A cut is not a deploy.** A script that would not load because the
 * network went is not gone, and a reload with no network is a page nobody
 * gets back to until it returns. So nothing is reloaded while the browser
 * says it is offline, and otherwise only once the server, asked for the
 * script again, says it has no such file (a 404): a request that fails
 * outright is the network, and the part that asked draws its quiet line
 * with *Try again* (`widgets/lazyPart`). The bundler's message names the
 * script; where it does not, the page's own entry is asked, which a deploy
 * replaces the same way. The rejection is left to the part meanwhile, so
 * the line is up while the server is asked, and a reload follows it.
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
  /** Whether the browser says it has a network. Absent, `navigator.onLine`. */
  online?: () => boolean
  /**
   * Whether the server answers that the script at this address is not there:
   * a 404, and nothing else. A request that fails is not an answer — it
   * resolves false. Absent, a `HEAD` the browser's cache is not asked for.
   */
  gone?: (address: string) => Promise<boolean>
  /** The script to ask about where the event names none: the page's own entry. */
  entry?: () => string | undefined
}

export function reloadOnStaleScripts(deps: StaleScriptsDeps): () => void {
  const target = deps.target ?? window
  const storage = deps.storage ?? (() => window.sessionStorage)
  const now = deps.now ?? Date.now
  const online = deps.online ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false)
  const gone = deps.gone ?? scriptIsGone
  const entry = deps.entry ?? pageEntry
  const warn = (message: string) => deps.diagnostics.report({ level: 'warn', where: 'scripts', message })
  const mayReload = (): boolean => {
    if (!online()) {
      warn('a script this page needs would not load while offline; not reloading')
      return false
    }
    if (deps.mayReload && !deps.mayReload()) {
      warn('a script this page needs would not load; not reloading over work a reload would lose')
      return false
    }
    return true
  }
  const reloadOnce = (): void => {
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
    deps.diagnostics.report({ level: 'info', where: 'scripts', message: 'the page named scripts that are gone; loading it again' })
    deps.reload()
  }
  const heard = (event: Event): void => {
    if (!mayReload()) return
    const address = scriptNamedBy(event) ?? entry()
    if (!address) {
      warn('a script this page needs would not load, and nothing says which')
      return
    }
    // The rejection goes on to the part, which says it did not load; the
    // page follows it only once the server has said the script is gone.
    void gone(address).catch(() => false).then((isGone) => {
      if (!isGone) {
        warn('a script this page needs would not load; the server still has it or could not be reached, so not reloading')
        return
      }
      // Asked again: the network or the work may have changed while the server answered.
      if (mayReload()) reloadOnce()
    })
  }
  target.addEventListener(STALE_SCRIPTS_EVENT, heard)
  return () => target.removeEventListener(STALE_SCRIPTS_EVENT, heard)
}

/** The script or stylesheet the bundler's error names: its message ends in the address. */
export function scriptNamedBy(event: Event): string | undefined {
  const payload = (event as Event & { payload?: unknown }).payload
  const message = payload instanceof Error ? payload.message : typeof payload === 'string' ? payload : ''
  const named = /(?:https?:\/\/|\/)[^\s'"]+\.(?:m?js|css)(?:\?[^\s'"]*)?/.exec(message)
  return named?.[0]
}

/** Only the server's own word that the file is not there; a request that fails is the network. */
async function scriptIsGone(address: string): Promise<boolean> {
  const answer = await fetch(address, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' })
  return answer.status === 404 || answer.status === 410
}

function pageEntry(): string | undefined {
  if (typeof document === 'undefined') return undefined
  return document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src || undefined
}

function tryRead(storage: Storage | undefined): string | null {
  try {
    return storage?.getItem(STALE_SCRIPTS_KEY) ?? null
  } catch {
    return null
  }
}
