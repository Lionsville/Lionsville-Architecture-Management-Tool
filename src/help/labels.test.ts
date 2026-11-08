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
 *   right-click menu, View settings…) are named nowhere in the help.
 */
import { describe, expect, it } from 'vitest'
import { STRINGS } from '../i18n/strings'
import type { Language } from '../i18n/languages'
import { helpStrings } from './glossary.test'
import { TEXT as EN } from './text/en'
import { TEXT as NL } from './text/nl'
import { TEXT as DE } from './text/de'

const RETIRED: Record<Language, RegExp> = {
  en: /Remove \/ delete…|\bFrom this view\b|Remove from diagram|selection bar|bar over the selection|floating toolbar|Board settings…|Route connections/,
  nl: /Weghalen \/ verwijderen…|Van deze weergave\b|Van het diagram halen|selectiebalk|balk boven de selectie|zwevende werkbalk|Bordinstellingen…|Verbindingen routeren/,
  de: /Entfernen \/ Löschen…|Von dieser Ansicht\b|Aus dem Diagramm nehmen|Auswahlleiste|Leiste über der Auswahl|schwebende\w* Werkzeugleiste|Board-Einstellungen…|Verbindungen führen/,
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
