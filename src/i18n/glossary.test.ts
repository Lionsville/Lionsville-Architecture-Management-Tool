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
import type { Language } from './languages'

/** What a string says, without its placeholders, its code and the markdown help's tables. */
const prose = (text: string) => text.replace(/\{[^}]*\}/g, ' ').replace(/`[^`]*`/g, ' ')

/** Keys that are a name, a code or a flag, the same in every language. */
const SAME_EVERYWHERE = new Set([
  'agent.tabClaude', 'agent.tabClaudeDesktop', 'agent.tabCodex', 'agent.tabCursor',
  'agent.recipeClaude', 'agent.recipeCodex', 'agent.recipeCursor',
  'first.brand', 'help.product', 'common.languageNl', 'common.languageDe', 'common.languageEn',
  // A flag read by the code, not a word on screen.
  'org.checksMostlyLower',
])

/** Words each language shares with English, so a string made only of them is translated already. */
const SHARED: Record<Exclude<Language, 'en'>, ReadonlySet<string>> = {
  nl: new Set(['a', 'account', 'actor', 'agent', 'agents', 'aspect', 'auto', 'badge', 'canvas', 'capability', 'code', 'compact', 'conflict', 'container', 'containers', 'detail', 'details', 'diagram', 'document', 'element', 'experiment', 'ext', 'f', 'filter', 'filters', 'focus', 'half', 'help', 'impact', 'in', 'inspector', 'is', 'item', 'items', 'label', 'labels', 'later', 'link', 'links', 'live', 'logo', 'matrix', 'mermaid', 'must', 'nesting', 'ok', 'open', 'overlap', 'plan', 'platform', 'platforms', 'poster', 'privacy', 'product', 'protocol', 'rc', 'recent', 'records', 'register', 'remote', 'roadmap', 'route', 'scope', 'scopes', 'status', 'team', 'teams', 'type', 'updates', 'via', 'website', 'z', 'zone']),
  de: new Set(['a', 'agent', 'auto', 'beta', 'block', 'board', 'boards', 'checks', 'code', 'container', 'detail', 'details', 'element', 'experiment', 'filter', 'hybrid', 'in', 'initiative', 'integration', 'link', 'links', 'logo', 'matrix', 'name', 'neutral', 'normal', 'ok', 'option', 'optional', 'organisation', 'pause', 'person', 'plan', 'poster', 'problem', 'rc', 'register', 'remote', 'roadmap', 'route', 'signal', 'status', 'system', 'team', 'teams', 'text', 'updates', 'version', 'website', 'z', 'zone']),
}

/** A word refused in a language, and the one to use instead. */
type Refused = { readonly word: RegExp; readonly use: string; readonly except?: (key: string) => boolean }

const GLOSSARY: Record<Exclude<Language, 'en'>, readonly Refused[]> = {
  nl: [
    { word: /\b[Uu]w?\b/, use: 'je, jouw (Dutch says je throughout)' },
    { word: /[Oo]perating model/, use: 'besturingsmodel' },
    { word: /[Aa]anzicht/, use: 'weergave; containerdiagram for a container view' },
    { word: /\b[Vv]iews?\b/, use: 'weergave' },
    { word: /[Cc]ontainerweergave/, use: 'containerdiagram' },
    { word: /\b[Oo]pslaan\b/, use: 'bewaren' },
    { word: /[Oo]bservatie/, use: 'waarneming' },
    { word: /\b[Ii]nterfaces?\b/, use: 'koppelvlak' },
    { word: /open eindjes/, use: 'open einden' },
    // A count of findings to review; *niets om naar te kijken* elsewhere is plain Dutch.
    { word: /^\s*om (naar te kijken|te bekijken)\s*$|^[Oo]p te lossen/, use: 'na te kijken, te herstellen' },
    { word: /[Ss]napshot/, use: 'momentopname' },
    { word: /[Ss]tamgegevens/, use: 'gegevenspagina' },
    { word: /[Bb]edrijfskaart/, use: 'dekking' },
    { word: /[Oo]verzichtskaart/, use: 'minikaart' },
    { word: /[Oo]pruimen/, use: 'ordenen' },
    { word: /\b[Jj]ourney/, use: 'klantreis' },
  ],
  de: [
    { word: /\b(du|Du|dich|Dich|dir|Dir|dein\w*|Dein\w*)\b/, use: 'Sie, Ihr (German says Sie throughout)' },
    { word: /(^|[.:!?]\s+)(Wähle|Gib|Drücke|Verknüpfe|Ändere|Zieh|Öffne|Markiere|Füge|Klicke|Tippe)\b/, use: 'the Sie form: Wählen Sie, Geben Sie…' },
    { word: /\bScopes?\b/, use: 'Bereich (the scope, and nothing else)' },
    { word: /Fahrplan/, use: 'Roadmap' },
    { word: /\bVerzeichnis\b|Technologieverzeichnis/, use: 'Register' },
    { word: /\bTafel/, use: 'Board' },
    { word: /\bHistorie\b/, use: 'Verlauf' },
    { word: /Weiträumig/, use: 'Großzügig' },
    { word: /Container-?[Aa]nsicht|Container-Diagramm/, use: 'Containerdiagramm' },
    { word: /Datens[aä]tz/, use: 'Eintrag' },
    { word: /Zuweisung/, use: 'Zuordnung' },
    { word: /\bSnapshot/, use: 'Momentaufnahme' },
    { word: /Stammdaten/, use: 'Steckbrief' },
    { word: /Unternehmenskarte/, use: 'Abdeckung' },
    { word: /Übersichtskarte/, use: 'Minikarte' },
    { word: /\bJourneys?\b|^Ablauf$/, use: 'Kundenreise' },
    { word: /zu prüfen/, use: 'zur Durchsicht', except: (key) => key === 'drawing.silentAsk' },
    // Under review is a decision's state and stays In Prüfung; the checks are Checks.
    { word: /Prüfung/, use: 'Check', except: (key) => key.startsWith('adr.') || key === 'folder.adoptChecking' },
    { word: /Verschachtelung/, use: 'Hierarchie' },
    { word: /Aufräumen/, use: 'Automatisch anordnen' },
  ],
}

describe.each(['nl', 'de'] as const)('the %s words', (language) => {
  const table = STRINGS[language]

  it('keep to the glossary: one form of address, and one word per concept', () => {
    const wrong: string[] = []
    for (const [key, text] of Object.entries(table)) {
      if (key.endsWith('markdownHelp')) continue
      for (const refused of GLOSSARY[language]) {
        if (refused.word.test(prose(text)) && !refused.except?.(key)) wrong.push(`${key}: "${text.slice(0, 80)}" — use ${refused.use}`)
      }
    }
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

describe('terms that must not meet', () => {
  it('says an assumed cause otherwise than an accepted decision, in every language', () => {
    for (const language of ['en', 'nl', 'de'] as const) {
      const t = STRINGS[language]
      expect(t['observation.stateAssumed']).not.toBe(t['adr.statusAccepted'])
      expect(t['certainty.assumed']).not.toBe(t['principles.statusAccepted'])
    }
  })

  it('gives German an area and a panel words other than the scope\'s', () => {
    const de = STRINGS.de
    for (const key of ['sheet.unmappedJumpOne', 'sheet.unmappedJumpOther', 'newView.sheetLine', 'prefs.textSizeHint'] as const) {
      expect(de[key]).not.toMatch(/Bereich/)
    }
  })

  it('names the two densities and the two tidy spacings apart on one page', () => {
    for (const language of ['nl', 'de'] as const) {
      const t = STRINGS[language]
      expect(t['kit.density.comfortable']).not.toBe(t['prefs.tidySpacious'])
    }
  })
})
