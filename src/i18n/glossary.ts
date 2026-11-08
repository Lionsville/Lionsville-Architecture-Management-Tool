// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The glossary the Dutch and German words are held to (8 November 2026, both
 * choices reversible): Dutch says *je*, German says *Sie*, and each concept has
 * one word, the second word it had being refused with the one to use instead.
 *
 * Data, read by the tests that hold the string tables, the help's text and a
 * composed build's own strings to it (`glossary.test.ts`,
 * `help/glossary.test.ts`), so a build that adds words keeps to the same list
 * rather than a copy of it. Nothing on screen reads it.
 */
import type { Language } from './languages'

/** What a string says, without its placeholders, its code and the markdown help's tables. */
export const prose = (text: string) => text.replace(/\{[^}]*\}/g, ' ').replace(/`[^`]*`/g, ' ')

/** Keys that are a name, a code or a flag, the same in every language. */
export const SAME_EVERYWHERE = new Set([
  'agent.tabClaude', 'agent.tabClaudeDesktop', 'agent.tabCodex', 'agent.tabCursor',
  'agent.recipeClaude', 'agent.recipeCodex', 'agent.recipeCursor',
  'first.brand', 'help.product', 'common.languageNl', 'common.languageDe', 'common.languageEn',
  // A flag read by the code, not a word on screen.
  'org.checksMostlyLower',
])

/** Words each language shares with English, so a string made only of them is translated already. */
export const SHARED: Record<Exclude<Language, 'en'>, ReadonlySet<string>> = {
  nl: new Set(['a', 'account', 'actor', 'agent', 'agents', 'aspect', 'auto', 'badge', 'canvas', 'capability', 'code', 'compact', 'conflict', 'container', 'containers', 'detail', 'details', 'diagram', 'document', 'element', 'experiment', 'ext', 'f', 'filter', 'filters', 'focus', 'half', 'help', 'impact', 'in', 'inspector', 'is', 'item', 'items', 'label', 'labels', 'later', 'link', 'links', 'live', 'logo', 'matrix', 'mermaid', 'must', 'nesting', 'ok', 'open', 'overlap', 'plan', 'platform', 'platforms', 'poster', 'privacy', 'product', 'protocol', 'rc', 'recent', 'records', 'register', 'remote', 'roadmap', 'route', 'scope', 'scopes', 'status', 'team', 'teams', 'type', 'updates', 'via', 'website', 'z', 'zone']),
  de: new Set(['a', 'agent', 'auto', 'beta', 'block', 'board', 'boards', 'checks', 'code', 'container', 'detail', 'details', 'element', 'experiment', 'filter', 'hybrid', 'in', 'initiative', 'integration', 'link', 'links', 'logo', 'matrix', 'name', 'neutral', 'normal', 'ok', 'option', 'optional', 'organisation', 'pause', 'person', 'position', 'plan', 'poster', 'problem', 'rc', 'register', 'remote', 'roadmap', 'route', 'signal', 'status', 'system', 'team', 'teams', 'text', 'updates', 'version', 'website', 'z', 'zone']),
}

/** A word refused in a language, and the one to use instead. */
export type Refused = { readonly word: RegExp; readonly use: string; readonly except?: (key: string) => boolean }

export const GLOSSARY: Record<Exclude<Language, 'en'>, readonly Refused[]> = {
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
    // A scope's home is the tab called Start: its page is the startpagina, never a thuis.
    { word: /\b[Tt]huis\b/, use: 'startpagina' },
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
    // Under review is a decision's state and stays In Prüfung (sent Zur Prüfung); the checks are Checks.
    { word: /(?<!\b[Ii]n |\b[Zz]ur )Prüfung/, use: 'Check', except: (key) => key.startsWith('adr.') },
    { word: /Verschachtelung/, use: 'Hierarchie' },
    { word: /Aufräumen/, use: 'Automatisch anordnen' },
  ],
}

/** What `text` says against the glossary of `language`: one line per word refused, with the word to use. */
export function refusedIn(language: Exclude<Language, 'en'>, key: string, text: string): string[] {
  const said = prose(text)
  return GLOSSARY[language]
    .filter((refused) => refused.word.test(said) && !refused.except?.(key))
    .map((refused) => `${key}: "${text.slice(0, 80)}" — use ${refused.use}`)
}
