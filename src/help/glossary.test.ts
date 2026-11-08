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
import { refusedIn } from '../i18n/glossary'
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

/** A key's name: a glyph, a key placeholder, a key's own word, a bare ? or slash, or one character standing alone. */
const KEY_WORD = /(\{key:|[⌘⇧⌥⌃↩⎋⌫⇥↑↓←→]|\b(Enter|Esc|Escape|Tab|Return|Delete|Del|Backspace|Entf|Eingabe\w*|Rücktaste|Spatie|Spatiebalk|Leertaste|Space|Shift|Umschalt|Ctrl|Strg|Alt|F\d+|Page\w*|Home|End|Pos1|Pfeil\w*|[Pp]ijl\w*|\w*[Tt]aste\w*|\w*toets\w*)\b|[?/](?=\s|[,.;:'")]|$)|(\*\*)?([?/]|[A-Z0-9])(\*\*)?(?=[,.;:'")]|$|\s(of|om|en|or|oder|und|bis|zu|to|op)\b))/
/**
 * The words a press names begin with a key: only the first words count, so
 * "Druk op Roadmap om de 2 plannen te zien" is a control whatever the rest of
 * the clause says, and "Druk op 2 op te lossen" names a line, not the key 2.
 */
const KEY_FIRST = new RegExp(`^(\\*\\*)?(de |het |een |die |der |den |eine? )?${KEY_WORD.source}`)

/** What follows a press, to the end of its clause. */
const clause = (after: string) => after.split(/[,.;!](?:\s|$)|\n\n|\(/)[0] ?? ''

/** Whether a press is a key's, read the way each language puts what is pressed. */
const IS_KEY: Record<'nl' | 'de', { press: RegExp; key: (before: string, word: string, after: string) => boolean }> = {
  // Druk op X · druk in het paneel op X · op X drukken · erop drukken · één druk · dubbeldruk
  nl: {
    press: /\b(dubbel)?[Dd]ruk(t|ken|te)?\b/g,
    key: (before, word, after) => {
      if (/^\s+(haar\s+|het\s+)?af\b/.test(after) || /\bheel\s+$/.test(before)) return true // drukt af, een druk bord
      if (word.startsWith('dubbel')) return false
      const said = clause(after)
      if (/^\s*(erop|er)\b/.test(said)) return false
      const objects = said.split(/\bop\s+/).slice(1)
      if (objects.length === 0) {
        const op = /\b[Oo]p\s+(.{1,40}?)\s*$/.exec(before)
        return !!op && KEY_FIRST.test(op[1]!)
      }
      return objects.some((object) => KEY_FIRST.test(object))
    },
  },
  // Drücken Sie X · Drücken Sie auf X · Enter drücken · ein Druck auf X · ein Doppeldruck
  de: {
    press: /\b[Dd]rücken Sie auf\b|\b[Dd]rücken Sie\b|\b([Dd]oppel)?[Dd]ruck\b|\b[Dd]rücken\b/g,
    key: (before, word, after) => {
      if (word === 'Druck' && /\bdem\s+$/.test(before)) return true // the printout
      const said = clause(after)
      if (/^drücken sie/i.test(word)) return KEY_WORD.test(said)
      if (/^drücken$/i.test(word) && KEY_WORD.test(before.slice(-30))) return true
      return KEY_FIRST.test(said.trim())
    },
  },
}

/** A press of something that is not a key: a control is clicked. */
export function pressedNotKey(text: string, language: 'nl' | 'de'): string[] {
  const { press, key } = IS_KEY[language]
  const found: string[] = []
  for (const match of text.matchAll(press)) {
    const at = match.index ?? 0
    const after = text.slice(at + match[0].length, at + match[0].length + 120)
    if (!key(text.slice(Math.max(0, at - 60), at), match[0], after)) found.push(`${text.slice(Math.max(0, at - 20), at)}${match[0]}${after.slice(0, 30)}`)
  }
  return found
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
    expect(pressedNotKey('Druk op de roadmap op F1.', 'nl')).toEqual([])
    expect(pressedNotKey('en Enter drücken.', 'de')).toEqual([])
    expect(pressedNotKey('of dubbeldruk op een lege plek', 'nl')).toHaveLength(1)
    expect(pressedNotKey('Drücken Sie Esc.', 'de')).toEqual([])
    expect(pressedNotKey('Drücken Sie die Eingabetaste.', 'de')).toEqual([])
    expect(pressedNotKey('Drücken Sie auf Speichern.', 'de')).toHaveLength(1)
    expect(pressedNotKey('Ein Druck auf eine Karte wählt sie.', 'de')).toHaveLength(1)
    expect(pressedNotKey('ein Doppeldruck öffnet sie', 'de')).toHaveLength(1)
    expect(pressedNotKey('Jeder sagt, was zu drücken ist.', 'de')).toHaveLength(1)
  })
})

describe.each([['en', EN], ['nl', NL], ['de', DE]] as const)('the %s help', (_, text) => {
  it('names keys rather than draw ⌘, ⇧, ⌥ or ⌃, so Windows and Linux read their own', () => {
    const drawn = helpStrings(text).filter(([, said]) => MODIFIER_GLYPHS.test(said)).map(([path, said]) => `${path}: ${said.slice(0, 80)}`)
    expect(drawn).toEqual([])
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

