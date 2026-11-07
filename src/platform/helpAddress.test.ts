// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { helpAddress, isHelpUrl, readHelpAddress } from './helpAddress'

describe('the address', () => {
  it('writes a section, a language and a theme, and reads them back', () => {
    const at = helpAddress({ language: 'de', theme: 'dark', section: 'frame.back' })
    expect(at).toBe('help/?lang=de&theme=dark#frame.back')
    const url = new URL(at, 'https://app.example/')
    expect(readHelpAddress(url.search, url.hash)).toEqual({ language: 'de', theme: 'dark', section: 'frame.back' })
  })

  it('leaves out what is not one of its own', () => {
    expect(readHelpAddress('?lang=xx&theme=pink', '#<script>')).toEqual({})
    expect(helpAddress({ section: 'javascript:alert(1)' })).toBe('help/')
  })

  it('knows the help page from any other address at the app\'s base', () => {
    expect(isHelpUrl('app://local/help/?lang=nl#board', 'app://local/')).toBe(true)
    expect(isHelpUrl('app://local/help/index.html', 'app://local')).toBe(true)
    expect(isHelpUrl('app://local/', 'app://local/')).toBe(false)
    expect(isHelpUrl('https://elsewhere.example/help/', 'app://local/')).toBe(false)
  })
})
