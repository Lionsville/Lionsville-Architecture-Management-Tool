// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A sentence names a key as `{key:…}` and `t` says it for the platform: no
 * string carries ⌘, ⇧, ⌥ or ⌃ itself, or Windows and Linux would read ⌘Z.
 * (The key names themselves are held in `platform/keyNames.test.ts`.)
 */
import { describe, expect, it } from 'vitest'
import { MODIFIER_GLYPHS, fillKeys } from './keyNames'
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
})
