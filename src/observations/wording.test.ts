// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { hintWords, similarTitles, titleWords, wordingHint } from './wording'

const titled = (...titles: string[]) => titles.map((title, index) => ({ id: `o${index + 1}`, title }))

describe('the words a title is compared by', () => {
  it('folds case and accents, drops the short words, and cuts each to a stem', () => {
    expect(titleWords('Onboarding a partner carrier takes nine weeks')).toEqual(['onboa', 'partn', 'carri', 'takes', 'nine', 'weeks'])
    expect(titleWords('Überweisung für die Prüfung')).toEqual(['uberw', 'prufu'])
    expect(titleWords('a b c')).toEqual([])
  })
})

describe('seen before?', () => {
  const list = titled(
    'Onboarding a partner carrier takes nine weeks',
    'The portal and Dispatch give different delivery estimates',
    'A customer is quoted one price and billed another',
    'Carrier onboarding stalls on the EDI mapping',
  )

  it('lists the titles that share two words, the most shared first', () => {
    expect(similarTitles('carrier onboarding takes weeks', list).map((one) => one.id)).toEqual(['o1', 'o4'])
  })

  it('asks a one-word title for its one word, and at most three', () => {
    expect(similarTitles('Carriers', list).map((one) => one.id)).toEqual(['o1', 'o4'])
    const many = titled('late truck', 'late truck again', 'truck late', 'the truck was late')
    expect(similarTitles('Late trucks', many)).toHaveLength(3)
  })

  it('finds nothing for a title with no word long enough, or nothing in common', () => {
    expect(similarTitles('is it', list)).toEqual([])
    expect(similarTitles('Stock counts differ between systems', list)).toEqual([])
  })

  it('is the same rule in every language', () => {
    const dutch = titled('Een vervoerder aansluiten duurt negen weken')
    expect(similarTitles('Het aansluiten van een vervoerder duurt lang', dutch)).toHaveLength(1)
  })
})

describe('the wording hint', () => {
  const words = hintWords('because| due to |should|fix||fault')

  it('reads the list the strings hold', () => {
    expect(words).toEqual(['because', 'due to', 'should', 'fix', 'fault'])
  })

  it('names the first word that reads as a cause, a fix or blame, as the title spells it', () => {
    expect(wordingHint('Batch runs late Because the window is small', words)).toBe('Because')
    expect(wordingHint('Late, due  to volumes, and we should fix it', words)).toBe('due  to')
  })

  it('matches whole words only, and says nothing when there is nothing to say', () => {
    expect(wordingHint('The fixture list prints twice', words)).toBeUndefined()
    expect(wordingHint('Pick lists print twice', words)).toBeUndefined()
    expect(wordingHint('Het ligt aan de schuld van niemand', hintWords('schuld|omdat'))).toBe('schuld')
  })
})
