// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { NO_WINDOW_CHROME, windowAreaFor, windowChromeFor } from './windowChrome'

describe('windowChromeFor', () => {
  it('leaves a browser tab alone', () => {
    expect(windowChromeFor({ desktop: false })).toEqual(NO_WINDOW_CHROME)
  })

  it('asks for Back and Forward on every desktop, and never in a browser tab (ADR-0033)', () => {
    for (const platform of ['darwin', 'win32', 'linux', undefined]) {
      expect(windowChromeFor({ desktop: true, platform }).backForward).toBe(true)
      expect(windowChromeFor({ desktop: false, platform }).backForward).toBeUndefined()
    }
    expect(NO_WINDOW_CHROME.backForward).toBeUndefined()
  })
})

describe('windowAreaFor', () => {
  it('keeps room for the traffic lights on macOS and makes the top bar a handle', () => {
    const area = windowAreaFor({ desktop: true, platform: 'darwin' })
    expect(area.controls).toBeGreaterThan(0)
    expect(area.drag).toBe(true)
  })

  it('asks nothing in full screen, where the traffic lights are gone and the window does not move', () => {
    expect(windowAreaFor({ desktop: true, platform: 'darwin', fullScreen: true })).toEqual({ controls: 0, drag: false })
  })

  it('leaves the other desktops their title bar: no inset and no handle', () => {
    for (const platform of ['win32', 'linux']) {
      expect(windowAreaFor({ desktop: true, platform })).toEqual({ controls: 0, drag: false })
    }
  })

  it('does not take the platform of a browser to mean anything', () => {
    expect(windowAreaFor({ desktop: false, platform: 'darwin' })).toEqual({ controls: 0, drag: false })
  })
})
