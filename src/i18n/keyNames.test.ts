// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A sentence names a key as `{key:…}` and `t` says it for the platform: no
 * string carries ⌘, ⇧, ⌥ or ⌃ itself, or Windows and Linux would read ⌘Z.
 * (The key names themselves are held in `platform/keyNames.test.ts`.)
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MODIFIER_GLYPHS, acceleratorName, fillKeys, keyName, onMac } from './keyNames'
import { STRINGS, t } from './strings'

describe('a key a sentence names', () => {
  it('is said for a Mac, and for everything else in its language', () => {
    expect(fillKeys('Undone with {key:Mod+Z}.', 'en', true)).toBe('Undone with ⌘Z.')
    expect(fillKeys('Undone with {key:Mod+Z}.', 'en', false)).toBe('Undone with Ctrl+Z.')
    expect(fillKeys('Mit {key:Mod+Shift+Z}', 'de', false)).toBe('Mit Strg+Umschalt+Z')
    expect(fillKeys('{key:Shift+Mod+Z}', 'de', true)).toBe('⇧⌘Z')
    expect(fillKeys('{key:Mod} and the wheel', 'nl', false)).toBe('Ctrl and the wheel')
    expect(fillKeys('{key:Mod+Plus} {key:Mod+-} {key:Mod+\\}', 'en', true)).toBe('⌘+ ⌘− ⌘\\')
  })

  it('may be another chord off a Mac', () => {
    expect(fillKeys('{key:Cmd+[|Alt+Left}', 'en', true)).toBe('⌘[')
    expect(fillKeys('{key:Cmd+[|Alt+Left}', 'de', false)).toBe('Alt+←')
  })

  it('leaves a sentence with no key, and a placeholder of another kind, alone', () => {
    expect(fillKeys('Nothing here {name}', 'en', true)).toBe('Nothing here {name}')
  })

  it('is filled by t', () => {
    expect(t('en', 'toolbar.undoTip')).toMatch(/^Undo \((⌘Z|Ctrl\+Z)\)$/)
    expect(t('de', 'toolbar.undoTip')).not.toContain('{key:')
  })
})

describe.each(['en', 'nl', 'de'] as const)('the %s strings', (language) => {
  it('name keys rather than draw ⌘, ⇧, ⌥ or ⌃', () => {
    const drawn = Object.entries(STRINGS[language]).filter(([, text]) => MODIFIER_GLYPHS.test(text)).map(([key, text]) => `${key}: ${text}`)
    expect(drawn).toEqual([])
  })

  it('name a key as a placeholder, so a Mac shows ↩ and ⎋ and a German keyboard Umschalt', () => {
    const KEY_IN_WORDS = /\b(Enter|Esc|Escape|Shift|Umschalt|Eingabetaste|Leertaste|Spatie)\b/
    // Read aloud to a screen reader, where a glyph would be read as a symbol rather than as the key.
    const SPOKEN = new Set(['canvas.a11yNode', 'canvas.a11yEdge'])
    const worded = Object.entries(STRINGS[language])
      .filter(([key, text]) => text.includes('{key:{') || (!SPOKEN.has(key) && !key.startsWith('shortcut.') && KEY_IN_WORDS.test(text.replace(/\{key:[^}]*\}/g, ''))))
      .map(([key, text]) => `${key}: ${text}`)
    expect(worded).toEqual([])
  })
})

describe('a key with no name of its own', () => {
  it('is its letter as the keyboard prints it, or its own word', () => {
    expect(keyName('z', false)).toBe('Z')
    expect(keyName('F5', true)).toBe('F5')
  })

  it('may be + itself, at the end of a chord', () => {
    expect(acceleratorName('CmdOrCtrl++', false)).toBe('Ctrl++')
    expect(acceleratorName('CmdOrCtrl++', true)).toBe('⌘+')
    expect(acceleratorName('Shift++', false, 'de')).toBe('Umschalt++')
  })
})

describe('the platform a key is said for', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('is the browser\'s where there is one', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' })
    expect(onMac()).toBe(true)
    vi.stubGlobal('navigator', { platform: 'Win32', userAgentData: { platform: 'Windows' } })
    expect(onMac()).toBe(false)
    // A browser that says no platform at all is not a Mac.
    vi.stubGlobal('navigator', { platform: '' })
    expect(onMac()).toBe(false)
  })

  // The desktop's main process has no browser: only Electron on a Mac is one, never node on the runner.
  it('is Electron\'s in a process with no browser, and never node\'s', () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('process', { platform: 'darwin', versions: { electron: '40.0.0' } })
    expect(onMac()).toBe(true)
    vi.stubGlobal('process', { platform: 'darwin', versions: {} })
    expect(onMac()).toBe(false)
  })
})
