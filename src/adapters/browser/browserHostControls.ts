// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Reload and clipboard, as a browser tab does them.
 *
 * `navigator.clipboard` is unavailable outside a secure context and can be
 * refused by permission; that comes back as a rejection, and the fallback says
 * so rather than claiming a copy that did not happen.
 */
import type { HostControls } from '../../ports/HostControls'
import { HELP_WINDOW_NAME } from '../../platform/helpAddress'

export function browserHostControls({ desktop = false }: { desktop?: boolean } = {}): HostControls {
  return {
    id: 'browser',
    reload: () => window.location.reload(),
    copyText: (text) => {
      const clipboard = navigator.clipboard
      if (!clipboard) return Promise.reject(new Error('no clipboard in this context'))
      return clipboard.writeText(text)
    },
    // `noopener`, because the opened page would otherwise hold a handle on this
    // window; on the desktop the window-open handler passes it to the system.
    openExternal: (url) => { window.open(url, '_blank', 'noopener,noreferrer') },
    // A pop-up of its own, named, so a second open goes to the one already
    // there. Where the browser refuses a pop-up the answer is null, and a tab is
    // what it will still give; on the desktop main answers both with the help's
    // window (`electron/main/helpWindow.ts`) and says null, so `desktop` keeps
    // the second open from being asked for at all.
    openHelp: (address) => {
      const at = new URL(address, document.baseURI).href
      const popup = window.open(at, HELP_WINDOW_NAME, 'popup,width=1080,height=820')
      if (popup === null && !desktop) window.open(at, '_blank', 'noopener')
    },
    editInField: (action) => {
      const held = document.activeElement
      const editable = held instanceof HTMLInputElement
        || held instanceof HTMLTextAreaElement
        || (held instanceof HTMLElement && held.isContentEditable)
      if (!editable) return false
      document.execCommand(action)
      return true
    },
  }
}
