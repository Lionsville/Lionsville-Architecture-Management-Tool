// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { translator } from '../../i18n'
import { DELETE_VIEW_BODY } from './deleteViewBody'

const LANGUAGES = ['en', 'nl', 'de'] as const
const said = (kind: keyof typeof DELETE_VIEW_BODY) => Object.fromEntries(LANGUAGES.map((language) => [language, translator(language)(DELETE_VIEW_BODY[kind])]))

/** What each kind's sentence must say of itself, in English: the thing that goes, and that the records stay. */
const SAYS: { readonly [K in keyof typeof DELETE_VIEW_BODY]: RegExp } = {
  layer7: /placements, groups and routes of this landscape/,
  container: /containers on this view go with it/,
  sheet: /^The sheet goes/,
  map: /^The map goes/,
  technology: /^The technology landscape goes/,
  drawing: /^The drawing goes/,
  chart: /^The organisation chart goes/,
  conway: /^The Conway map goes/,
}

describe('what deleting a view says it takes with it', () => {
  it.each(Object.keys(SAYS) as (keyof typeof SAYS)[])('says it of a %s in its own words, in every language', (kind) => {
    const words = said(kind)
    expect(words.en).toMatch(SAYS[kind])
    for (const language of LANGUAGES) expect(words[language], language).not.toBe('')
    // Translated, not the English left standing.
    expect(words.nl).not.toBe(words.en)
    expect(words.de).not.toBe(words.en)
    // Only a container view carries containers away.
    if (kind !== 'container') expect(words.en).not.toMatch(/containers on this view/)
  })

  it('gives every kind a sentence of its own', () => {
    for (const language of LANGUAGES) {
      const t = translator(language)
      const all = Object.values(DELETE_VIEW_BODY).map((key) => t(key))
      expect(new Set(all).size, language).toBe(all.length)
    }
  })
})
