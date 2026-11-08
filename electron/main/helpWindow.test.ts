// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { beforeEach, describe, expect, it, vi } from 'vitest'

const made: { options: unknown; loaded: string[]; handlers: Record<string, (...args: unknown[]) => void>; openHandler?: (details: { url: string }) => unknown }[] = []
const opened: string[] = []

vi.mock('electron', () => ({
  shell: { openExternal: (url: string) => { opened.push(url); return Promise.resolve() } },
  BrowserWindow: class {
    record: (typeof made)[number]
    webContents: unknown
    constructor(options: unknown) {
      const record: (typeof made)[number] = { options, loaded: [], handlers: {} }
      this.record = record
      made.push(record)
      this.webContents = {
        getURL: () => record.loaded.at(-1) ?? '',
        setWindowOpenHandler: (handler: (details: { url: string }) => unknown) => { record.openHandler = handler },
        on: (event: string, handler: (...args: unknown[]) => void) => { record.handlers[event] = handler },
      }
    }
    once() {}
    on() {}
    isDestroyed() { return false }
    isMinimized() { return false }
    show() {}
    focus() {}
    loadURL(url: string) { this.record.loaded.push(url); return Promise.resolve() }
  },
}))

const { helpAddressInLanguage, helpAddressInTheme, helpNavigation, helpWindowOptions, openHelpWindow, opensInBrowser } = await import('./helpWindow')
const BASE = 'app://local/'

describe('the help window', () => {
  beforeEach(() => { opened.length = 0 })

  it('is a reader: sandboxed, isolated, with no node and no preload', () => {
    const { webPreferences } = helpWindowOptions('#000')
    expect(webPreferences).toMatchObject({ sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true })
    expect(webPreferences).not.toHaveProperty('preload')
  })

  it('stays on the help, sends the web to the system\'s browser and refuses the rest', () => {
    expect(helpNavigation('app://local/help/?lang=nl#board', BASE)).toBe('stay')
    expect(helpNavigation('https://app.architecture.lionsville.nl/', BASE)).toBe('browser')
    expect(helpNavigation('app://local/', BASE)).toBe('refuse')
    expect(helpNavigation('file:///etc/passwd', BASE)).toBe('refuse')
  })

  it('hands the system the web and a mail address, as a tab would, and nothing else', () => {
    expect(opensInBrowser('https://example.org/')).toBe(true)
    expect(opensInBrowser('http://intranet.example/page')).toBe(true)
    expect(opensInBrowser('mailto:someone@example.org')).toBe(true)
    expect(opensInBrowser('file:///etc/passwd')).toBe(false)
    expect(opensInBrowser('app://local/')).toBe(false)
    expect(opensInBrowser('javascript:alert(1)')).toBe(false)
  })

  it('is one window, reused, and opens nothing that is not the help', () => {
    openHelpWindow('app://local/', BASE, { background: '#000', show: false })
    expect(made).toHaveLength(0)
    openHelpWindow('app://local/help/?lang=de', BASE, { background: '#000', show: false })
    openHelpWindow('app://local/help/?lang=de#frame.back', BASE, { background: '#000', show: false })
    expect(made).toHaveLength(1)
    expect(made[0].loaded).toEqual(['app://local/help/?lang=de', 'app://local/help/?lang=de#frame.back'])
  })

  it('hands a link out of the help to the system\'s browser and opens no window for it', () => {
    const result = made[0].openHandler?.({ url: 'https://example.org/' })
    expect(result).toEqual({ action: 'deny' })
    expect(opened).toEqual(['https://example.org/'])
    const prevented = vi.fn()
    made[0].handlers['will-navigate']?.({ preventDefault: prevented }, 'app://local/')
    expect(prevented).toHaveBeenCalled()
  })
})

describe('the help window and the app\'s language', () => {
  it('reads the same place in the language the app switched to', () => {
    expect(helpAddressInLanguage('app://local/help/?lang=nl&theme=dark#chart.find', 'de')).toBe('app://local/help/?lang=de&theme=dark#chart.find')
    expect(helpAddressInLanguage('app://local/help/#frame.back', 'nl')).toBe('app://local/help/?lang=nl#frame.back')
    expect(helpAddressInLanguage('app://local/help/?lang=de', 'de')).toBe('app://local/help/?lang=de')
    expect(helpAddressInLanguage('not an address', 'de')).toBeUndefined()
  })
})

describe('the help window and the app\'s theme', () => {
  it('reads the same place in the theme the app switched to, and in the system\'s where it follows the system', () => {
    expect(helpAddressInTheme('app://local/help/?lang=nl&theme=dark#chart.find', 'light')).toBe('app://local/help/?lang=nl&theme=light#chart.find')
    expect(helpAddressInTheme('app://local/help/?lang=nl#frame.back', 'dark')).toBe('app://local/help/?lang=nl&theme=dark#frame.back')
    expect(helpAddressInTheme('app://local/help/?lang=de&theme=dark#board', undefined)).toBe('app://local/help/?lang=de#board')
    expect(helpAddressInTheme('app://local/help/?theme=dark', 'dark')).toBe('app://local/help/?theme=dark')
    expect(helpAddressInTheme('not an address', 'dark')).toBeUndefined()
  })
})
