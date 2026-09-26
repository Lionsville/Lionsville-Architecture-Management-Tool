// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LANGUAGE_CODES } from '../i18n/languages'
import { manualUrl } from './manual'

describe('manualUrl', () => {
  it('names the manual file for the language, in the published repository', () => {
    expect(manualUrl('en')).toBe('https://github.com/Lionsville/Lionsville-Architecture-Management-Tool/blob/main/docs/manual.en.md')
    expect(manualUrl('de')).toMatch(/manual\.de\.md$/)
  })

  /**
   * *User Manual* opens the file for the language the app is in, so a language
   * with no file is a menu item that opens a 404 — and a file for a language
   * the app does not offer is a manual nobody can reach from it.
   */
  it('has a manual for exactly the languages the app offers', () => {
    const editions = readdirSync('docs')
      .map((name) => /^manual\.([a-z]{2})\.md$/.exec(name)?.[1])
      .filter((code): code is string => code !== undefined)
    expect(editions.sort()).toEqual([...LANGUAGE_CODES].sort())
  })
})
