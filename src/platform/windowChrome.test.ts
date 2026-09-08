import { describe, expect, it } from 'vitest'
import { NO_WINDOW_CHROME, barChromeFor, windowChromeFor } from './windowChrome'

describe('windowChromeFor', () => {
  it('leaves a browser tab alone', () => {
    expect(windowChromeFor({ desktop: false })).toEqual(NO_WINDOW_CHROME)
  })

  it('keeps room for the traffic lights on macOS and makes the bar a handle', () => {
    const chrome = windowChromeFor({ desktop: true, platform: 'darwin' })
    expect(chrome.controlsInset).toBeGreaterThan(0)
    expect(chrome.draggable).toBe(true)
  })

  it('leaves the other desktops alone: they keep a real title bar', () => {
    expect(windowChromeFor({ desktop: true, platform: 'win32' })).toEqual(NO_WINDOW_CHROME)
    expect(windowChromeFor({ desktop: true, platform: 'linux' })).toEqual(NO_WINDOW_CHROME)
  })

  it('does not take the platform of a browser to mean anything', () => {
    expect(windowChromeFor({ desktop: false, platform: 'darwin' })).toEqual(NO_WINDOW_CHROME)
  })
})

describe('barChromeFor', () => {
  it('hands a page under the shell toolbar no inset and no drag: the toolbar has both jobs', () => {
    expect(barChromeFor({ controlsInset: 78, draggable: true, topInset: 44 })).toEqual({ controlsInset: 0, draggable: false })
  })

  it('leaves a page that covers the window to do both itself', () => {
    const covers = { controlsInset: 78, draggable: true }
    expect(barChromeFor(covers)).toBe(covers)
    expect(barChromeFor({ ...covers, topInset: 0 })).toMatchObject(covers)
  })
})
