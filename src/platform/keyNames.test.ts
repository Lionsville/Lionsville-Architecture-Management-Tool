// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { acceleratorName, chordName, keyName } from './keyNames'

describe('a key\'s name', () => {
  it('is the glyph on a Mac\'s key cap in every language', () => {
    for (const language of ['en', 'nl', 'de'] as const) {
      expect(keyName('Delete', true, language)).toBe('⌫')
      expect(keyName('Enter', true, language)).toBe('↩')
      expect(keyName('Escape', true, language)).toBe('⎋')
      expect(keyName('Mod', true, language)).toBe('⌘')
    }
  })

  it('is the word a keyboard prints elsewhere, in German on a German one', () => {
    expect(keyName('Mod', false, 'de')).toBe('Strg')
    expect(keyName('Shift', false, 'de')).toBe('Umschalt')
    expect(keyName('Delete', false, 'de')).toBe('Entf')
    expect(keyName('ContextMenu', false, 'de')).toBe('Menütaste')
    expect(keyName('Mod', false, 'en')).toBe('Ctrl')
    expect(keyName('Delete', false, 'nl')).toBe('Del')
    expect(keyName('k', false, 'en')).toBe('K')
  })
})

describe('a chord\'s name', () => {
  it('is in macOS\'s order on a Mac, whatever order it was written in', () => {
    expect(chordName(['Mod', 'Shift', 'Z'], true)).toBe('⇧⌘Z')
    expect(chordName(['Shift', 'Mod', 'E'], true)).toBe('⇧⌘E')
    expect(chordName(['Alt', 'Mod', 'Shift', 'K'], true)).toBe('⌥⇧⌘K')
    expect(acceleratorName('CmdOrCtrl+Shift+E', true, 'de')).toBe('⇧⌘E')
  })

  it('is joined with + elsewhere, in the keyboard\'s own words', () => {
    expect(acceleratorName('CmdOrCtrl+Shift+Z', false, 'de')).toBe('Strg+Umschalt+Z')
    expect(acceleratorName('CmdOrCtrl+Shift+Z', false, 'en')).toBe('Ctrl+Shift+Z')
    expect(acceleratorName('CmdOrCtrl+Plus', false, 'en')).toBe('Ctrl++')
    expect(acceleratorName('CmdOrCtrl+[', true, 'en')).toBe('⌘[')
  })
})
