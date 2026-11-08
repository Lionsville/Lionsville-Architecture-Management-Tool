// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The help quotes the screen, and a quote the screen no longer says sends a
 * reader looking for a control that is gone. Two holds on that:
 *
 * - a label the help quotes as a menu item — in double quotes, ending in an
 *   ellipsis — is a string the app has in some language, or the start of one;
 * - the board's labels a version renamed (8 November 2026: Remove from view
 *   and Delete from model, the selection's bar gone into the panel and the
 *   right-click menu, View settings…, the Arrange menu's Tidy the board and
 *   Route the lines, a line's bend points) are named nowhere in the help;
 * - a control the English help presses or picks by its label, or names in
 *   bold, is named in Dutch and German by that control's own Dutch or German
 *   label, at the same place in the help: the English is checked against the
 *   screen's English, and the other two follow it through the string's key.
 */
import { describe, expect, it } from 'vitest'
import { STRINGS } from '../i18n/strings'
import type { Language } from '../i18n/languages'
import { helpStrings } from './glossary.test'
import { TEXT as EN } from './text/en'
import { TEXT as NL } from './text/nl'
import { TEXT as DE } from './text/de'

const RETIRED: Record<Language, RegExp> = {
  en: /Remove \/ delete…|\bFrom this view\b|Remove from diagram|selection bar|bar over the selection|floating toolbar|Board settings…|Route connections|[Dd]iagram settings|\*\*Add bend\*\*|\*\*Remove bend\*\*|\bTidy\*\* (runs|lays)/,
  nl: /Weghalen \/ verwijderen…|Van deze weergave\b|Van het diagram halen|selectiebalk|balk boven de selectie|zwevende werkbalk|Bordinstellingen…|Verbindingen routeren|[Dd]iagraminstellingen|Knik toevoegen|Knik verwijderen|\bTidy\b|Verbindingen leggen|Alles opnieuw leggen/,
  de: /Entfernen \/ Löschen…|Von dieser Ansicht\b|Aus dem Diagramm nehmen|Auswahlleiste|Leiste über der Auswahl|schwebende\w* Werkzeugleiste|Board-Einstellungen…|Verbindungen führen|Diagrammeinstellungen|Verbindungen routen|Alles neu routen|\*\*Automatisch anordnen\*\*/,
}

describe.each([['en', EN], ['nl', NL], ['de', DE]] as const)('the %s help', (language, text) => {
  const strings = helpStrings(text)
  // Every language's words: the help shows what the first page says in another one.
  const said = Object.values(STRINGS).flatMap((table) => Object.values(table)).join('\n')

  it('quotes a menu item the app has', () => {
    const missing = strings.flatMap(([path, help]) => [...help.matchAll(/"([^"\n]{2,60})…"/g)]
      .filter(([, label]) => !said.includes(label!))
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

/** Where the English help names a label it quotes from the screen: after Press, Click, Choose or Pick, ending where the label does. */
const PRESSED = /\b(?:[Pp]ress|[Cc]lick|[Cc]hoose|[Pp]ick)\s+/g
const LABEL_ENDS = /^($|[.,;:!?)'"…]| (and|or|to|in|on|under|beside|next|for|from|at|with|then|again|if|when|until|so|instead|\())/
const KEYS = /^(Delete|Enter|Escape|Esc|Tab|Backspace|Space|Return)$/

/**
 * A label pressed in the English that is the start of a longer one with a name
 * in it (*Open in <scope>*, *Move N days*): the Dutch and German say the whole
 * label, which no single string holds.
 */
const NAMED_LABELS = new Set([
  'sections.sol-gate[3][2]', 'sections.roadmap.initiatives[3][1]', 'sections.plan.boardsOpen[3][0]',
  'sections.principles.keptElsewhere[3][1]', 'sections.blocks.about[3][2]', 'sections.plan.move[3][2]', 'sections.plan.giveTheRest[3][1]',
])

/** The labels the English quotes at a place, read off its words. */
function quotedLabels(text: string, labels: Map<string, string[]>, longestFirst: string[]): string[] {
  const found: string[] = []
  for (const match of text.matchAll(PRESSED)) {
    const rest = text.slice((match.index ?? 0) + match[0].length)
    const label = longestFirst.find((one) => rest.startsWith(one) && LABEL_ENDS.test(rest.slice(one.length)))
    if (label && !/^[a-z]/.test(label) && !KEYS.test(label)) found.push(label)
  }
  for (const [, label] of text.matchAll(/\*\*([^*\n]{3,60})\*\*/g)) {
    if (labels.has(label!) && /\s/.test(label!) && !/^[a-z]/.test(label!)) found.push(label!)
  }
  return found
}

describe.each([['nl', NL], ['de', DE]] as const)('the %s help', (language, text) => {
  it('names a control the English names by the label the screen gives it in this language', () => {
    const labels = labelsByWord()
    const longestFirst = [...labels.keys()].sort((a, b) => b.length - a.length)
    const here = new Map(helpStrings(text))
    const table = STRINGS[language] as Record<string, string>
    // The reference's long accounts are not held to this yet: their labels are checked in the tasks that quote them.
    const wrong = helpStrings(EN).filter(([path]) => !path.startsWith('background.') && !NAMED_LABELS.has(path)).flatMap(([path, english]) => {
      const said = here.get(path) ?? ''
      return quotedLabels(english, labels, longestFirst)
        // The example's own names stay English in every language.
        .filter((label) => !said.includes(label))
        .filter((label) => !labels.get(label)!.some((key) => table[key] && said.includes(table[key]!)))
        .map((label) => `${path}: "${label}" is ${[...new Set(labels.get(label)!.map((key) => table[key]))].join(' or ')} on screen`)
    })
    expect(wrong).toEqual([])
  })
})

