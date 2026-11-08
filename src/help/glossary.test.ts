// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The help's Dutch and German held to the glossary the string tables keep
 * (`i18n/glossary.ts`): je and Sie, one word per concept, and a mouse is
 * clicked while a key is pressed.
 *
 * The help quotes the screen, so a word the screen does not use sends a reader
 * looking for a control that is not there; and it is where a second form of
 * address would read as a second author for pages on end.
 */
import { describe, expect, it } from 'vitest'
import { pressedNotKey, refusedIn } from '../i18n/glossary'
import { MODIFIER_GLYPHS } from '../i18n/keyNames'
import { TEXT as EN } from './text/en'
import { TEXT as NL } from './text/nl'
import { TEXT as DE } from './text/de'

/** Every string in the help's text, with the path it sits at. */
export function helpStrings(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]]
  if (Array.isArray(value)) return value.flatMap((item, index) => helpStrings(item, `${path}[${index}]`))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => helpStrings(item, path ? `${path}.${key}` : key))
  }
  return []
}

/**
 * What the help says, less what it quotes from elsewhere: an address
 * (`#/<scope>/-/chart/<view id>`, `view:<id>`), and the browser's own button,
 * which is the browser's word and not ours.
 */
const quoted = (text: string) => text.replace(/#\/\S*|\(?view:[^)\s]*\)?/g, ' ').replace(/Opslaan als PDF/g, ' ')

describe.each([['nl', NL], ['de', DE]] as const)('the %s help', (language, text) => {
  const strings = helpStrings(text)

  it('is read', () => {
    expect(strings.length).toBeGreaterThan(500)
  })

  it('keeps to the glossary: one form of address, and one word per concept', () => {
    const wrong = strings.flatMap(([path, said]) => refusedIn(language, path, quoted(said)))
    expect(wrong).toEqual([])
  })

  it('clicks a control and presses a key', () => {
    const wrong = strings.flatMap(([path, said]) => pressedNotKey(said, language).map((press) => `${path}: ${press}`))
    expect(wrong).toEqual([])
  })
})

describe('a press that is a key', () => {
  it('is told from a click by the words it names first', () => {
    expect(pressedNotKey('Druk op {key:Mod+K} om te zoeken.', 'nl')).toEqual([])
    expect(pressedNotKey('Druk op Enter.', 'nl')).toEqual([])
    expect(pressedNotKey('Druk op ? voor de toetsen.', 'nl')).toEqual([])
    expect(pressedNotKey('Druk op Nieuwe weergave…', 'nl')).toHaveLength(1)
    expect(pressedNotKey('Druk op Roadmap om de 2 plannen te zien.', 'nl')).toHaveLength(1)
    expect(pressedNotKey('Druk op Waarom vragen voor deze N.', 'nl')).toHaveLength(1)
    expect(pressedNotKey('Op een regel drukken opent haar.', 'nl')).toHaveLength(1)
    expect(pressedNotKey('Elke stap zegt waarop je drukt.', 'nl')).toHaveLength(1)
    expect(pressedNotKey('Druk op 2 op te lossen.', 'nl')).toHaveLength(1)
    expect(pressedNotKey('Druk op de roadmap op F1.', 'nl')).toHaveLength(1)
    expect(pressedNotKey('Op de roadmap: druk op F1.', 'nl')).toEqual([])
    expect(pressedNotKey('Druk in Application landscape op {key:Mod+S}.', 'nl')).toEqual([])
    expect(pressedNotKey('en Enter drücken.', 'de')).toEqual([])
    expect(pressedNotKey('of dubbeldruk op een lege plek', 'nl')).toHaveLength(1)
    expect(pressedNotKey('Drücken Sie Esc.', 'de')).toEqual([])
    expect(pressedNotKey('Drücken Sie die Eingabetaste.', 'de')).toEqual([])
    expect(pressedNotKey('Drücken Sie auf Speichern.', 'de')).toHaveLength(1)
    expect(pressedNotKey('Ein Druck auf eine Karte wählt sie.', 'de')).toHaveLength(1)
    expect(pressedNotKey('ein Doppeldruck öffnet sie', 'de')).toHaveLength(1)
    expect(pressedNotKey('Jeder sagt, was zu drücken ist.', 'de')).toHaveLength(1)
    expect(pressedNotKey('Marek Nowak drückt Mich finden.', 'de')).toHaveLength(1)
    expect(pressedNotKey('ein Bild öffnet sich groß, wenn man es drückt.', 'de')).toHaveLength(1)
    expect(pressedNotKey('wer {key:Enter} drückt, öffnet ihn.', 'de')).toEqual([])
  })
})

/**
 * Enter, Escape, Tab, Delete and an arrow named as words, outside a key
 * placeholder: a Mac shows ↩ ⎋ ⇥ ⌫ ↓ for them on every other screen, and German
 * said one key three ways. A browser's tab and the Delete a menu says are not keys.
 */
const KEY_AS_WORD: Record<'en' | 'nl' | 'de', RegExp> = {
  en: /\b(Enter|Escape|Esc)\b|\bDelete key\b|\b(down|up|left|right) arrows?\b|\b(up|left) and (down|right) arrows\b|(?<!\b(an?|the|own) )\bTab\b/,
  nl: /\b(Enter|Escape|Esc|Delete)\b|\bpijlen? (omlaag|omhoog|links|rechts)\b|(?<!\b(een|de|het|eigen) )\bTab\b/,
  de: /\b(Enter|Escape|Esc|Eingabetaste|Entf(-Taste)?|Rücktaste)\b|\bPfeile? (nach )?(unten|links|rechts|hoch|runter)\b(?! (rechts|links))|(?<!\b(ein|der|den|dem|einem|einen|anderen|anderer|diesem|dieser|dieses|jedem|jeder|eigenen|Ein) |Browser-)\bTab\b/,
}

describe.each([['en', EN], ['nl', NL], ['de', DE]] as const)('the %s help', (language, text) => {
  it('names Enter, Escape, Tab, Delete and the arrows as keys, so a Mac shows their glyphs', () => {
    const worded = helpStrings(text)
      .filter(([, said]) => KEY_AS_WORD[language].test(said.replace(/\{key:[^}]*\}/g, ' ').replace(/`[^`]*`/g, ' ')))
      .map(([path, said]) => `${path}: ${said.replace(/\{key:[^}]*\}/g, ' ').match(KEY_AS_WORD[language])![0]} in ${said.slice(0, 60)}`)
    expect(worded).toEqual([])
  })

  it('names keys rather than draw ⌘, ⇧, ⌥ or ⌃, so Windows and Linux read their own', () => {
    const drawn = helpStrings(text).filter(([, said]) => MODIFIER_GLYPHS.test(said)).map(([path, said]) => `${path}: ${said.slice(0, 80)}`)
    expect(drawn).toEqual([])
  })

  it('names a modifier as a key placeholder, so a Mac shows ⇧ and ⌥ and a German keyboard Umschalt', () => {
    // A role in the example is called Shift lead.
    const worded = helpStrings(text)
      .filter(([, said]) => /\b(Shift|Umschalt|Alt|Ctrl|Strg)\b(?! lead)|menu key|menutoets|Menütaste/.test(said.replace(/\{key:[^}]*\}/g, '')))
      .map(([path, said]) => `${path}: ${said.slice(0, 80)}`)
    expect(worded).toEqual([])
  })
})

/**
 * Words German keeps for one thing each, held where the English says which
 * thing it is: Bereich is a scope and never a sheet's area, and vermutet is
 * assumed where angenommen is an accepted decision. A string says Bereich at
 * most once more than its English says scope (German names the scope where
 * English says *it*), and angenommen no more often than its English says
 * accepted or adopted.
 */
describe('the German help, against the English it says', () => {
  const english = new Map(helpStrings(EN))
  const count = (text: string, word: RegExp) => text.match(new RegExp(word.source, 'gi'))?.length ?? 0
  const over = (word: RegExp, says: RegExp, slack = 0) => helpStrings(DE)
    .filter(([path, text]) => count(text, word) > count(english.get(path) ?? '', says) + slack)
    .map(([path, text]) => `${path}: ${count(text, word)} × ${word.source} against ${count(english.get(path) ?? '', says)}`)

  it('says Bereich only where the English says scope', () => {
    expect(over(/Bereich(?!s?baum)/, /scope|tree/, 1)).toEqual([])
  })

  it('says angenommen only where the English says accepted or adopted', () => {
    expect(over(/angenommen/, /accept|adopt/)).toEqual([])
  })
})

