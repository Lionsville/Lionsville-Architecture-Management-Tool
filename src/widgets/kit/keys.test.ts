// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chordHeld, claimKey, commandKey, isMac, keyClaimed } from './keys'

const press = (metaKey: boolean, ctrlKey: boolean) => ({ metaKey, ctrlKey })

describe('the command key', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is ⌘ on a Mac, and Ctrl there is the text field\'s own', () => {
    expect(commandKey(press(true, false), true)).toBe(true)
    expect(commandKey(press(false, true), true)).toBe(false)
    expect(commandKey(press(true, true), true)).toBe(false)
  })

  it('is Ctrl elsewhere, and ⌘ (the Windows key) is not it', () => {
    expect(commandKey(press(false, true), false)).toBe(true)
    expect(commandKey(press(true, false), false)).toBe(false)
  })

  it('reads the platform when nobody says which', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' })
    expect(isMac()).toBe(true)
    expect(commandKey(press(false, true))).toBe(false)
    vi.stubGlobal('navigator', { platform: 'Win32', userAgentData: { platform: 'Windows' } })
    expect(isMac()).toBe(false)
    expect(commandKey(press(false, true))).toBe(true)
  })

  it('is told apart from any chord held, which a plain key stands aside for', () => {
    expect(chordHeld(press(false, true))).toBe(true)
    expect(chordHeld(press(true, false))).toBe(true)
    expect(chordHeld(press(false, false))).toBe(false)
  })
})

describe('a key claimed', () => {
  it('goes no further and says so to whoever hears it anyway', () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true })
    const stop = vi.spyOn(event, 'stopPropagation')
    expect(keyClaimed(event)).toBe(false)
    claimKey(event)
    expect(keyClaimed(event)).toBe(true)
    expect(stop).toHaveBeenCalled()
  })
})
