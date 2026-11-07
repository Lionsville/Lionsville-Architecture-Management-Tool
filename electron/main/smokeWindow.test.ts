// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A person's window is always shown; only the smoke run's stays off the
 * screen. And a step that failed says whether the window was why.
 */
import { describe, expect, it } from 'vitest'
import { showsWindow, SMOKE_SHOWN, windowSays } from './smokeWindow'

describe('showsWindow', () => {
  it('always shows a person\'s window, whatever the environment says', () => {
    expect(showsWindow(false, {})).toBe(true)
    expect(showsWindow(false, { [SMOKE_SHOWN]: '0' })).toBe(true)
    expect(showsWindow(false, { [SMOKE_SHOWN]: '1' })).toBe(true)
  })

  it('keeps the smoke run\'s window off the screen unless asked', () => {
    expect(showsWindow(true, {})).toBe(false)
    expect(showsWindow(true, { [SMOKE_SHOWN]: '0' })).toBe(false)
    expect(showsWindow(true, { [SMOKE_SHOWN]: '1' })).toBe(true)
  })
})

describe('windowSays', () => {
  it('names a hidden window as the machine, not the code', () => {
    const said = windowSays({ visibility: 'hidden', frames: false })
    expect(said).toContain('the window was hidden')
    expect(said).toContain('not the code')
  })

  it('clears the window when the page was visible and drawing', () => {
    expect(windowSays({ visibility: 'visible', frames: true })).toContain('a hidden window did not cause this')
  })

  it('tells a page that says visible but draws nothing from a hidden one', () => {
    const said = windowSays({ visibility: 'visible', frames: false })
    expect(said).toContain('drew no frame')
    expect(said).toContain('not a hidden window')
  })

  it('says so when the page did not answer at all', () => {
    expect(windowSays(undefined)).toContain('did not answer')
  })
})
