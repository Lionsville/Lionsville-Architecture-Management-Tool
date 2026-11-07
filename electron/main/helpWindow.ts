// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The help's window: one, reused, beside the app's.
 *
 * The help is a page of the renderer's own build (`help/index.html`), served
 * over `app://` like the app and under the same Content-Security-Policy, so it
 * needs no network and nothing the app does not already ship. Its window is a
 * plain reader: sandboxed, no node, no preload at all, because the page asks
 * main for nothing. A link in it that leaves the help goes to the system's
 * browser; anything else that would navigate it is refused.
 *
 * Opened two ways, which both end here: the Help menu, answered by main itself
 * so it works before the app's page has loaded and with nothing open, and the
 * app's own ways in (the ? in row one, a place that reads more), which call
 * `window.open` on the help's address and are caught by the app window's
 * open handler.
 */
import { BrowserWindow, shell } from 'electron'
import type { BrowserWindowConstructorOptions } from 'electron'
import { isHelpUrl } from '../../src/platform/helpAddress'

let helpWindow: BrowserWindow | undefined

/** What the window is made with: a reader, and nothing a page could reach main through. */
export function helpWindowOptions(background: string): BrowserWindowConstructorOptions {
  return {
    width: 1080,
    height: 820,
    minWidth: 480,
    minHeight: 400,
    show: false,
    backgroundColor: background,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  }
}

/** Where a navigation inside the help may go: the help itself; the web leaves for the system's browser; nothing else. */
export function helpNavigation(url: string, base: string): 'stay' | 'browser' | 'refuse' {
  if (isHelpUrl(url, base)) return 'stay'
  return /^https?:\/\//.test(url) ? 'browser' : 'refuse'
}

/** Open the help at `url` (an address `isHelpUrl` accepts), in its one window. */
export function openHelpWindow(url: string, base: string, options: { background: string; show: boolean }): void {
  if (!isHelpUrl(url, base)) return
  if (helpWindow && !helpWindow.isDestroyed()) {
    if (helpWindow.webContents.getURL() !== url) void helpWindow.loadURL(url)
    if (helpWindow.isMinimized()) helpWindow.restore()
    helpWindow.show()
    helpWindow.focus()
    return
  }
  const window = new BrowserWindow(helpWindowOptions(options.background))
  helpWindow = window
  window.once('ready-to-show', () => { if (options.show) window.show() })
  window.on('closed', () => { if (helpWindow === window) helpWindow = undefined })
  window.webContents.setWindowOpenHandler(({ url: wanted }) => {
    if (helpNavigation(wanted, base) === 'browser') void shell.openExternal(wanted)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, wanted) => {
    const where = helpNavigation(wanted, base)
    if (where === 'stay') return
    event.preventDefault()
    if (where === 'browser') void shell.openExternal(wanted)
  })
  void window.loadURL(url)
}

/** Is this the help's window? The app's own windows are counted without it. */
export function isHelpWindow(window: unknown): boolean {
  return helpWindow !== undefined && window === helpWindow
}

/** The help goes when the last of the app's windows does, where the app quits then. */
export function closeHelpWindow(): void {
  if (helpWindow && !helpWindow.isDestroyed()) helpWindow.close()
}
