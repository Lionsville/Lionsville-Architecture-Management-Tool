/**
 * Reload and clipboard, as a browser tab does them.
 *
 * `navigator.clipboard` is unavailable outside a secure context and can be
 * refused by permission; that comes back as a rejection, and the fallback says
 * so rather than claiming a copy that did not happen.
 */
import type { HostControls } from '../../ports/HostControls'

export function browserHostControls(): HostControls {
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
