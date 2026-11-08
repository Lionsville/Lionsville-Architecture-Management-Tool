// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The words, held to one form of address and one term per concept in each
 * language, and none of them left in English.
 *
 * `strings.test.ts` holds the tables to being complete; this holds what is in
 * them to the choices made about them (8 November 2026, both reversible):
 *
 * - **Dutch says je**, never u: about 170 strings said je and 29 u.
 * - **German says Sie**, never du: about 500 strings said Sie and 25 du.
 * - **One word per concept**, the glossary below: the second word each concept
 *   had is refused, with the word to use instead.
 * - **Nothing left in English**: a Dutch or German string that reads the same
 *   as the English one is refused unless every word in it is one the language
 *   shares with English (Team, Plan, Status, Container…), or it is a name or
 *   code on the list of keys that are the same in every language.
 */
import { describe, expect, it } from 'vitest'
import { STRINGS } from './strings'
import { SAME_EVERYWHERE, SHARED, actsIn, pressedNotKey, prose, refusedIn } from './glossary'

describe.each(['nl', 'de'] as const)('the %s words', (language) => {
  const table = STRINGS[language]

  it('keep to the glossary: one form of address, and one word per concept', () => {
    const wrong: string[] = []
    for (const [key, text] of Object.entries(table)) {
      if (key.endsWith('markdownHelp')) continue
      wrong.push(...refusedIn(language, key, text))
    }
    expect(wrong).toEqual([])
  })

  it('click a control and press a key', () => {
    const wrong = Object.entries(table).flatMap(([key, text]) => pressedNotKey(text, language).map((press) => `${key}: ${press}`))
    expect(wrong).toEqual([])
  })

  it('leave nothing in English', () => {
    const english: string[] = []
    for (const [key, text] of Object.entries(table)) {
      if (text !== STRINGS.en[key as keyof typeof STRINGS.en] || SAME_EVERYWHERE.has(key)) continue
      const words = prose(text).match(/\p{L}+/gu) ?? []
      if (words.every((word) => SHARED[language].has(word.toLowerCase()))) continue
      english.push(`${key}: "${text}"`)
    }
    expect(english).toEqual([])
  })
})

describe('remove and delete', () => {
  it.each(['en', 'nl', 'de'] as const)('never share a word in %s, and English says Remove rather than take off or out', (language) => {
    const en = STRINGS.en as Record<string, string>
    const wrong: string[] = []
    for (const [key, text] of Object.entries(STRINGS[language] as Record<string, string>)) {
      if (key.endsWith('markdownHelp') || en[key] === undefined) continue
      wrong.push(...actsIn(language, key, en[key], text))
    }
    expect(wrong).toEqual([])
  })

  it('refuses the other act\'s word, and lets a choice between the two say both', () => {
    expect(actsIn('nl', 'x', 'Remove', 'Verwijderen')).toHaveLength(1)
    expect(actsIn('de', 'x', 'Comment deleted', 'Kommentar entfernt')).toHaveLength(1)
    expect(actsIn('nl', 'x', 'Remove', 'Weghalen')).toEqual([])
    expect(actsIn('de', 'x', 'Remove from view or delete from model…', 'Aus der Ansicht entfernen oder aus dem Modell löschen…')).toEqual([])
    expect(actsIn('en', 'x', 'Take out {name}', 'Take out {name}')).toHaveLength(1)
  })
})

describe('a word the glossary refuses', () => {
  it('is said with its key, the text and the word to use', () => {
    expect(refusedIn('de', 'checks.title', 'Die Prüfung')).toEqual(['checks.title: "Die Prüfung" — use Check'])
  })

  it('passes where its exception says it is meant, and only there', () => {
    expect(refusedIn('de', 'adr.reviewNote', 'Die Prüfung')).toEqual([])
    expect(refusedIn('de', 'decision.state', 'In Prüfung')).toEqual([])
  })
})

describe('terms that must not meet', () => {
  it('says an assumed cause otherwise than an accepted decision, in every language', () => {
    for (const language of ['en', 'nl', 'de'] as const) {
      const t = STRINGS[language]
      expect(t['observation.stateAssumed']).not.toBe(t['adr.statusAccepted'])
      expect(t['certainty.assumed']).not.toBe(t['principles.statusAccepted'])
    }
  })

  it('says assumed in German as vermutet wherever the English says it, never as an accepted decision\'s angenommen', () => {
    const wrong = Object.entries(STRINGS.en)
      .filter(([, text]) => /\bassum/i.test(text))
      .map(([key]) => [key, STRINGS.de[key as keyof typeof STRINGS.de]] as const)
      .filter(([, text]) => /angenommen/i.test(text) || !/vermut/i.test(text))
    expect(wrong).toEqual([])
  })

  it('gives German an area and a panel words other than the scope\'s', () => {
    const de = STRINGS.de
    for (const key of ['sheet.unmappedJumpOne', 'sheet.unmappedJumpOther', 'newView.sheetLine', 'prefs.textSizeHint'] as const) {
      expect(de[key]).not.toMatch(/Bereich/)
    }
  })

  it('names an act on the board with the same words in the menu, the panel and the dialog that follows', () => {
    for (const language of ['en', 'nl', 'de'] as const) {
      const t = STRINGS[language]
      expect(t['dialog.removeFromDiagram']).toBe(t['menu.removeFromDiagram'])
      expect(t['dialog.deleteFromModelButton']).toBe(t['menu.deleteFromModel'].replace(/…$/, ''))
      expect(t['inspector.arrange']).toBe(t['bar.arrange'])
      expect(t['prefs.snap']).toBe(t['menu.snapToGrid'])
    }
  })

  it('names the two densities and the two tidy spacings apart on one page', () => {
    for (const language of ['nl', 'de'] as const) {
      const t = STRINGS[language]
      expect(t['kit.density.comfortable']).not.toBe(t['prefs.tidySpacious'])
    }
  })
})

describe('a du imperative', () => {
  it('is refused at the head of a clause, capital or not, and the Sie form and an infinitive are not', () => {
    expect(refusedIn('de', 'k', 'verbinde zwei Elemente')).toHaveLength(1)
    expect(refusedIn('de', 'k', 'Bring mich hin')).toHaveLength(1)
    expect(refusedIn('de', 'k', 'Die letzten Wochen. Zeige auf einen Balken.')).toHaveLength(1)
    for (const du of ['Bitte die anderen, sie zu lesen', 'Berichtige stattdessen etwas Echtes', 'Ist abgedeckt. Ergänze bei dieser, was sie stützt', 'Kläre es, und man kann ihr trauen'])
      expect(refusedIn('de', 'k', du)).toHaveLength(1)
    expect(refusedIn('de', 'k', 'Bitte noch einmal versuchen.')).toEqual([])
    expect(refusedIn('de', 'k', 'Zwei Elemente verbinden')).toEqual([])
    expect(refusedIn('de', 'k', 'Schlagen Sie eine Lösung vor')).toEqual([])
    expect(refusedIn('de', 'k', 'Eine Frage zur Karte')).toEqual([])
  })
})

