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

/**
 * A press that is a key's: a glyph, a key placeholder or a key's name in the
 * words after it, up to the end of the clause (*Druk in de dekking op ⌘K*).
 * Anything else pressed is a control, and a control is clicked.
 */
const KEY = /\{key:|[⌘⇧⌥⌃↩⎋⌫⇥↑↓←→]|\b(Enter|Esc|Escape|Tab|Return|Delete|Del|Backspace|Entf|Eingabe\w*|Rücktaste|Spatie|Spatiebalk|Leertaste|Space|Shift|Umschalt|Ctrl|Strg|Alt|F\d+|Page\w*|Home|End|Pos1|Pfeil\w*|[Pp]ijl\w*|\w*[Tt]aste\w*|\w*toets\w*)\b|(^|\s)(\*\*)?([?/+−=-]|[A-Z0-9])(\*\*)?(?=[\s,.;:'"]|$)/

/** "Druk op X" / "Drücken Sie X" where X is not a key. */
function pressedNotKey(text: string, press: RegExp): string[] {
  const found: string[] = []
  for (const match of text.matchAll(press)) {
    const after = text.slice((match.index ?? 0) + match[0].length)
    const clause = after.split(/[,;.!](\s|$)|\n\n/)[0] ?? ''
    if (!KEY.test(clause)) found.push(`${match[0]}${after.slice(0, 40)}`)
  }
  return found
}

/**
 * What the help says, less what it quotes from elsewhere: an address
 * (`#/<scope>/-/chart/<view id>`, `view:<id>`), and the browser's own button,
 * which is the browser's word and not ours.
 */
const quoted = (text: string) => text.replace(/#\/\S*|\(?view:[^)\s]*\)?/g, ' ').replace(/Opslaan als PDF/g, ' ')

const PRESS = { nl: /\b[Dd]ruk(t|ken)? op\b/g, de: /\b[Dd]rücken Sie( auf)?\b/g } as const

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
    const wrong = strings.flatMap(([path, said]) => pressedNotKey(said, PRESS[language]).map((press) => `${path}: ${press}`))
    expect(wrong).toEqual([])
  })
})

describe('a press that is a key', () => {
  it('is told from a click', () => {
    expect(pressedNotKey('Druk op {key:Mod+K} om te zoeken.', PRESS.nl)).toEqual([])
    expect(pressedNotKey('Druk op Enter.', PRESS.nl)).toEqual([])
    expect(pressedNotKey('Druk op Nieuwe weergave…', PRESS.nl)).toHaveLength(1)
    expect(pressedNotKey('Drücken Sie Esc.', PRESS.de)).toEqual([])
    expect(pressedNotKey('Drücken Sie auf Speichern.', PRESS.de)).toHaveLength(1)
  })
})

describe.each([['en', EN], ['nl', NL], ['de', DE]] as const)('the %s help', (_, text) => {
  it('names keys rather than draw ⌘, ⇧, ⌥ or ⌃, so Windows and Linux read their own', () => {
    const drawn = helpStrings(text).filter(([, said]) => MODIFIER_GLYPHS.test(said)).map(([path, said]) => `${path}: ${said.slice(0, 80)}`)
    expect(drawn).toEqual([])
  })
})
