// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The help quotes the screen, and a quote the screen no longer says sends a
 * reader looking for a control that is gone. Two holds on that:
 *
 * - a label the help quotes as a menu item — in double quotes or bold, ending
 *   in an ellipsis — is a string the app has in some language, or the start of one;
 * - the board's labels a version renamed (8 November 2026: Remove from view
 *   and Delete from model, the selection's bar gone into the panel and the
 *   right-click menu, View settings…, the Arrange menu's Tidy the board and
 *   Route the lines, a line's bend points, the element menu's Open the record)
 *   are named nowhere in the help;
 * - a control the English help presses or picks by its label, or names in
 *   bold, is named in Dutch and German by that control's own Dutch or German
 *   label, at the same place in the help: the English is checked against the
 *   screen's English, and the other two follow it through the string's key;
 * - and, apart from the English, what the Dutch and German help press, pick,
 *   quote or put in bold in a step is a label of that language's own strings,
 *   so a stale word is caught where the English quote has no key to follow.
 */
import { describe, expect, it } from 'vitest'
import { STRINGS } from '../i18n/strings'
import type { Language } from '../i18n/languages'
import { helpStrings } from './glossary.test'
import { TEXT as EN } from './text/en'
import { TEXT as NL } from './text/nl'
import { TEXT as DE } from './text/de'
import example from '../adapters/folder/format/examples/acme-logistics.json' with { type: 'json' }

const RETIRED: Record<Language, RegExp> = {
  en: /Remove \/ delete…|\bFrom this view\b|Remove from diagram|selection bar|bar over the selection|floating toolbar|Board settings…|Route connections|[Dd]iagram settings|\*\*Add bend\*\*|\*\*Remove bend\*\*|\bTidy\*\* (runs|lays)|Open documentation/,
  nl: /Weghalen \/ verwijderen…|Van deze weergave\b|Van het diagram halen|selectiebalk|balk boven de selectie|zwevende werkbalk|Bordinstellingen…|Verbindingen routeren|[Dd]iagraminstellingen|Knik toevoegen|Knik verwijderen|\bTidy\b|Verbindingen leggen|Alles opnieuw leggen|Documentatie openen/,
  de: /Entfernen \/ Löschen…|Von dieser Ansicht\b|Aus dem Diagramm nehmen|Auswahlleiste|Leiste über der Auswahl|schwebende\w* Werkzeugleiste|Board-Einstellungen…|Verbindungen führen|Diagrammeinstellungen|Verbindungen routen|Alles neu routen|\*\*Automatisch anordnen\*\*|Dokumentation öffnen/,
}

/** A label the panel composes from the names of the rows it holds back (`addLabel`), which no one string holds. */
const COMPOSED = /^\+ (Owner, vendor|Eigenaar, leverancier|Eigentümer, Anbieter)$/

describe.each([['en', EN], ['nl', NL], ['de', DE]] as const)('the %s help', (language, text) => {
  const strings = helpStrings(text)
  // Every language's words: the help shows what the first page says in another one.
  const said = Object.values(STRINGS).flatMap((table) => Object.values(table)).join('\n')

  it('quotes a menu item the app has', () => {
    const missing = strings.flatMap(([path, help]) => [...help.matchAll(/"([^"\n]{2,60})…"|\*\*([^*\n]{2,60})…\*\*/g)]
      .map(([quoted, inQuotes, inBold]) => [quoted, (inQuotes ?? inBold)!.split(' › ').pop()] as const)
      .filter(([, label]) => !said.includes(label!) && !COMPOSED.test(label!))
      .map(([quoted]) => `${path}: ${quoted}`))
    expect(missing).toEqual([])
  })

  it('names none of the board labels a version renamed', () => {
    const retired = strings.filter(([, help]) => RETIRED[language].test(help)).map(([path, help]) => `${path}: ${help.match(RETIRED[language])![0]}`)
    expect(retired).toEqual([])
  })
})

/** Every English label and the keys that carry it. A label with a placeholder or a line break is not quoted whole. */
function labelsByWord(): Map<string, string[]> {
  const keys = new Map<string, string[]>()
  for (const [key, label] of Object.entries(STRINGS.en)) {
    if (label.length < 3 || label.length > 60 || label.includes('{') || label.includes('\n')) continue
    keys.set(label, [...(keys.get(label) ?? []), key])
  }
  return keys
}

/**
 * Where the English help names a label it quotes from the screen: after Press,
 * Click, Choose or Pick, or the *then* of a step that presses two, ending where
 * the label does.
 */
const PRESSED = /\b(?:[Pp]ress|[Cc]lick|[Cc]hoose|[Pp]ick|[Cc]lick on|then)\s+/g
const LABEL_ENDS = /^($|[.,;:!?)"…*]|'(?!s\b)| (and|or|to|in|on|under|beside|next|for|from|at|with|then|again|if|when|until|so|instead|of|is|\())/
const KEYS = /^(Delete|Enter|Escape|Esc|Tab|Backspace|Space|Return)$/
/** Where a place in the help is said, a list of places, or of a menu's items: each part may start with a label. */
const PART_STARTS = /(?:^|; |: |, | or | and | \/ )(?=[A-Z+⋯])/g

/**
 * A label pressed in the English that is the start of a longer one with a name
 * in it (*Open in <scope>*, *Move N days*): the Dutch and German say the whole
 * label, which no single string holds.
 */
const NAMED_LABELS = new Set([
  'sections.sol-gate[3][2]', 'sections.roadmap.initiatives[3][1]', 'sections.plan.boardsOpen[3][0]',
  'sections.principles.keptElsewhere[3][1]', 'sections.blocks.about[3][2]', 'sections.plan.move[3][2]', 'sections.plan.giveTheRest[3][1]',
])

/**
 * Words the help keeps in English that are also a label somewhere: names in
 * the shipped example, and the desktop updater's dialog, which speaks English.
 */
const UNTRANSLATED = new Set(['Application landscape', 'Topics', 'Later'])

/** A label read at `at` in `text`: the longest the screen has that ends where a label may. */
function labelAt(text: string, at: number, longestFirst: string[]): string | undefined {
  const rest = text.slice(at)
  return longestFirst.find((one) => rest.startsWith(one) && LABEL_ENDS.test(rest.slice(one.length)))
}

/**
 * The labels the English quotes at a place, read off its words: pressed, in
 * bold, in double quotes, a menu item with its ellipsis anywhere, and the
 * start of each part of a list where a section says where to find it. A label
 * of one word counts only where it is pressed, bold or quoted, so a sentence
 * starting with an ordinary word is not taken for a control.
 */
function quotedLabels(text: string, labels: Map<string, string[]>, longestFirst: string[], where: boolean): string[] {
  const found: string[] = []
  const take = (label: string | undefined, oneWord: boolean) => {
    if (!label || /^[a-z]/.test(label) || KEYS.test(label)) return
    if (!oneWord && !/\s/.test(label) && !label.endsWith('…')) return
    found.push(label)
  }
  for (const match of text.matchAll(PRESSED)) take(labelAt(text, (match.index ?? 0) + match[0].length, longestFirst), true)
  for (const [, label] of text.matchAll(/\*\*([^*\n]{3,60})\*\*/g)) if (labels.has(label!)) take(label, true)
  for (const [, label] of text.matchAll(/"([^"\n]{3,60})"/g)) if (labels.has(label!)) take(label, true)
  // A menu item whose ellipsis the screen draws apart from its words is named by them.
  for (const [, label] of text.matchAll(/(?:^|[\s(*"])([A-Z+][^\n,;:.()*"]{1,58}…)/g)) {
    take(labels.has(label!) ? label : labels.has(label!.slice(0, -1)) ? label!.slice(0, -1) : undefined, labels.has(label!))
  }
  if (where) for (const match of text.matchAll(PART_STARTS)) take(labelAt(text, (match.index ?? 0) + match[0].length, longestFirst), false)
  return [...new Set(found)]
}

describe.each([['nl', NL], ['de', DE]] as const)('the %s help', (language, text) => {
  it('names a control the English names by the label the screen gives it in this language', () => {
    const labels = labelsByWord()
    const longestFirst = [...labels.keys()].sort((a, b) => b.length - a.length)
    const here = new Map(helpStrings(text).map(([path, said]) => [path, said.replace(/\s*\n\s*/g, ' ')]))
    const table = STRINGS[language] as Record<string, string>
    const wrong = helpStrings(EN).filter(([path]) => !NAMED_LABELS.has(path)).flatMap(([path, english]) => {
      const said = here.get(path) ?? ''
      return quotedLabels(english, labels, longestFirst, /^sections\.[^[]+\[2\]$/.test(path))
        // The example's own names stay English in every language, and so does a label the screen says in English too.
        .filter((label) => !said.includes(label) || !(UNTRANSLATED.has(label) || labels.get(label)!.some((key) => table[key] === label)))
        .filter((label) => !labels.get(label)!.some((key) => table[key] && said.includes(table[key]!)))
        .map((label) => `${path}: "${label}" is ${[...new Set(labels.get(label)!.map((key) => table[key]))].join(' or ')} on screen`)
    })
    expect(wrong).toEqual([])
  })
})


/** The names in the shipped example, which the help presses as they are in every language. */
function exampleNames(): string[] {
  const names = new Set<string>()
  const take = (name: string) => { if (name.length > 1 && name.length <= 60) names.add(name.trim()) }
  // The example is its folder: a file's JSON, or the lines of a file, whose quoted
  // values, front matter and headings are the names.
  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      for (const [, quoted] of value.matchAll(/"((?:[^"\\]|\\.){2,60})"/g)) take(quoted!.replace(/\\(.)/g, '$1'))
      const [, said] = /^(?:\w+: |#+ )(.+)$/.exec(value) ?? []
      if (said) take(said.replace(/^['"]|['"]$/g, ''))
      if (!/[{}[\]":]/.test(value)) take(value)
    } else if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(example)
  return [...names]
}

/** Where the Dutch and German help press or pick a control, ending where its label starts; a step's *then* too. */
const PRESSED_HERE = {
  nl: /\b(?:[Kk]lik(?: dan)?(?: nog eens)?(?: daar)? op|[Kk]ies)\s+/g,
  de: /\b(?:[Kk]licken Sie(?: dann)?(?: dort)?(?: erneut)? auf|[Ww]ählen Sie)\s+/g,
} as const
const THEN_HERE = { nl: /(?:^|, )dan\s+/g, de: /(?:^|, )dann\s+/g } as const

/**
 * What the help presses that no string holds, because the screen draws it
 * without one: the plus, minus, back and forward buttons, the panel's + … menu, an export's
 * formats, a record's number, what a step types itself, and the people,
 * library and records the help's examples add to the shipped example.
 */
const UNSTRUNG = /^(\+|−|‹|›|\+ …|SVG|PNG|[A-Z]{2,3}-\d{4}\b.*|Northline Freight|Road network|Backup|Teambord|Logistics IT|Platforms and hosting|ware|chase|Priya Raman|Jonas Weber|Operate|RM|IT4IT|A customer is quoted one price and billed another)(?![\p{L}\d])/u

/**
 * A label of the screen read as a pattern: a count it starts with is the
 * help's N, a name inside it any words, and a name it ends on one word.
 */
function labelPattern(label: string): RegExp {
  const escape = (part: string) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const body = label.replace(/^\{[^}]+\}/, 'N').replace(/\s*\{[^}]+\}$/, '\u0000').split(/\{[^}]+\}/).map(escape).join('[^.,;:]{1,40}?')
  return new RegExp(`^${body.replace('\u0000', '(?:\\s?(?:N|[A-Z0-9][^\\s.,;:]*))?')}(?![\\p{L}\\d])`, 'u')
}

describe.each([['nl', NL], ['de', DE]] as const)('the %s help', (language, text) => {
  it('names every control it presses, picks or quotes by a label this language\'s screen has', () => {
    const table = STRINGS[language] as Record<string, string>
    const labels = [...new Set(Object.values(table))]
      .filter((label) => label.length <= 90 && !label.includes('\n') && label.replace(/\{[^}]+\}/g, '').trim() !== '')
      .map(labelPattern)
    const names = exampleNames()
    const wrong = helpStrings(text).filter(([path]) => !NAMED_LABELS.has(path)).flatMap(([path, help]) => {
      const said = help.replace(/\s*\n\s*/g, ' ')
      const step = /\[3\]\[\d+\]$|\.steps\[\d+\]$/.test(path)
      const found: string[] = []
      const read = (at: number, anyCase = false) => {
        const rest = said.slice(at)
        if (!anyCase && !/^[A-Z+]/.test(rest)) return
        if (UNSTRUNG.test(rest) || labels.some((label) => label.test(rest))) return
        if (names.some((name) => rest.startsWith(name) && !/^[\p{L}\d]/u.test(rest.slice(name.length)))) return
        found.push(`${path}: ${rest.slice(0, 48)}`)
      }
      for (const match of said.matchAll(PRESSED_HERE[language])) read((match.index ?? 0) + match[0].length)
      if (step) for (const match of said.matchAll(THEN_HERE[language])) read((match.index ?? 0) + match[0].length)
      for (const match of said.matchAll(/\*\*(?! )([^*]{1,60}?)(?<! )\*\*/g)) {
        if (step || /[›…]$/.test(match[1]!)) read((match.index ?? 0) + 2, step)
      }
      for (const match of said.matchAll(/"([^"]{2,60})"/g)) read((match.index ?? 0) + 1)
      return found
    })
    expect(wrong).toEqual([])
  })
})
