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
  // A file's name and its size: a unit's symbol is the same in every language.
  'md.fileKb', 'md.fileMb',
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
    { word: /\b[Uu]w?\b|\b[Uu]zelf\b/, use: 'je, jouw, jezelf (Dutch says je throughout)' },
    { word: /[Oo]rganigram/, use: 'organogram' },
    // A comment on a record is a reactie everywhere: the thread, the toast and Activity said it, the box and ⋯ said opmerking (8 November 2026).
    { word: /[Oo]pmerking/, use: 'reactie' },
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
    // A scope is a scope, on the screens and in the help; an onderdeel is an operating model's
    // or a library's item, a unit's section, and what something is part of (onderdeel van).
    { word: /(?<!menu-)\b[Oo]nderde(el|len)\b(?! van\b)/, use: 'scope', except: (key) => /^(operating\.|folder\.count\.operating|activity\.(broughtIn|matchedIn)\b|background\.operating\b|sections\.operating\.|chapters\.operating\.)/.test(key) },
    // A scope's home is the tab called Start: its page is the startpagina, never a thuis.
    { word: /\b[Tt]huis\b/, use: 'startpagina' },
  ],
  de: [
    { word: /\b(du|Du|dich|Dich|dir|Dir|dein\w*|Dein\w*)\b/, use: 'Sie, Ihr (German says Sie throughout)' },
    { word: /(^|[.:!?]\s+)(Wähle|Gib|Drücke|Verknüpfe|Ändere|Zieh|Öffne|Markiere|Füge|Klicke|Tippe)\b/, use: 'the Sie form: Wählen Sie, Geben Sie…' },
    // A du imperative at the head of a clause, capital or not ("verbinde zwei Elemente", "Bring mich hin"): an infinitive or the Sie form.
    // Bitte only as the verb ("Bitte die anderen, sie zu lesen"), not as the polite word ("Bitte noch einmal versuchen").
    { word: /(^|[.:;!?]\s+)(verbinde|erstelle|schlage|halte|füge|plane|setze|arbeite|schließe|übernimm|repariere|fülle|schlichte|bringe?|sammle|zeige|definiere|nimm|decke|wirf|wähle|gib|drücke|verknüpfe|ändere|zieh|öffne|markiere|klicke|tippe|lege|schreibe|lies|sieh|probiere|starte|beende|mache?|folge|finde|teile|lade|benenne|schau|lass|lasse|schärfe|berichtige|ergänze|kläre|bitte(?= (die|den|das|eine[mnr]?|andere\w*|jemand\w*|ihn|sie|es)\b[^.]*\b(um|zu)\b))\b(?! Sie\b)/i, use: 'an infinitive (Zwei Elemente verbinden) or the Sie form' },
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
    // A finding to review is zur Durchsicht, as a count and as a heading; the People page's tab of
    // possible duplicates is Zu prüfen, a list of pairs to answer rather than a weight of finding.
    { word: /[Zz]u prüfen/, use: 'zur Durchsicht', except: (key) => key === 'drawing.silentAsk' || /^(people\.|sections\.people\.)/.test(key) },
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

/*
 * A control is clicked and a key is pressed (8 November 2026): Dutch says *klik op*, German
 * *klicken Sie auf*, and *druk op* and *drücken Sie* are for keys alone.
 */
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
      if (/^\s+(haar\s+|het\s+)?af\b/.test(after) || /\baf\s+te\s+$/.test(before) || /\bheel\s+$/.test(before)) return true // drukt af, af te drukken, een druk bord
      if (word.startsWith('dubbel')) return false
      const said = clause(after)
      if (/^\s*(erop|er)\b/.test(said)) return false
      const objects = said.split(/\bop\s+/).slice(1)
      if (objects.length === 0) {
        const op = /\b[Oo]p\s+(.{1,40}?)\s*$/.exec(before)
        return !!op && KEY_FIRST.test(op[1]!)
      }
      // The first thing pressed is what is pressed: in "Druk op de roadmap op F1" a reader presses the roadmap.
      // "Druk op 2 op te lossen" names a line, not the key 2.
      return KEY_FIRST.test(objects[0]!.trim()) && !/^te\b/.test(objects[1] ?? '')
    },
  },
  // Drücken Sie X · Drücken Sie auf X · Enter drücken · ein Druck auf X · ein Doppeldruck · er drückt X · wenn man es drückt
  de: {
    press: /\b[Dd]rücken Sie auf\b|\b[Dd]rücken Sie\b|\b([Dd]oppel)?[Dd]ruck\b|\b[Dd]rücken\b|\bdrückt\b/g,
    key: (before, word, after) => {
      if (word === 'Druck' && /(\bdem|\bim|\bgroßen|\bkleinen|-)\s*$/.test(before)) return true // the printout: im Druck, ein A0-Druck
      const said = clause(after)
      if (/^drücken sie/i.test(word)) return KEY_WORD.test(said)
      if (/^drück(en|t)$/i.test(word) && KEY_WORD.test(before.slice(-30))) return true
      return KEY_FIRST.test(said.trim())
    },
  },
}

/**
 * A press said as a participle or after its object (*de persoon die je indrukt*,
 * *die gedrückte Person*): a key's only where a key is named just before it, as in
 * *houd {key:Shift} ingedrukt* and *halten Sie {key:Alt} gedrückt*.
 */
const PARTICIPLE: Record<'nl' | 'de', RegExp> = {
  nl: /\b(ingedrukt|indrukt|indrukken)\b/g,
  de: /\bgedrückt(e[nmrs]?)?\b/g,
}

/** A press of something that is not a key, in `text`: a control is clicked. */
export function pressedNotKey(text: string, language: 'nl' | 'de'): string[] {
  const { press, key } = IS_KEY[language]
  const found: string[] = []
  const say = (at: number, word: string, after: string) => found.push(`${text.slice(Math.max(0, at - 20), at)}${word}${after.slice(0, 30)}`)
  for (const match of text.matchAll(press)) {
    const at = match.index ?? 0
    const after = text.slice(at + match[0].length, at + match[0].length + 120)
    if (!key(text.slice(Math.max(0, at - 60), at), match[0], after)) say(at, match[0], after)
  }
  for (const match of text.matchAll(PARTICIPLE[language])) {
    const at = match.index ?? 0
    if (!KEY_WORD.test(text.slice(Math.max(0, at - 30), at))) say(at, match[0], text.slice(at + match[0].length, at + match[0].length + 30))
  }
  return found
}

/**
 * Remove and Delete are two acts, and each language has one word for each that
 * the other never borrows (8 November 2026). Remove takes a thing off or out of
 * something, and the thing stays: a link, a row of a list, a role from a unit
 * type, a card from a view. Delete makes the record itself go. A label or an
 * announcement in English that says one is held, in Dutch and German, to the
 * other's word not appearing in it; one that names both acts is a choice between
 * them and says both.
 */
export const ACTS: readonly {
  readonly act: 'Remove' | 'Delete'
  readonly en: RegExp
  readonly refused: Record<Exclude<Language, 'en'>, RegExp>
  readonly use: Record<Exclude<Language, 'en'>, string>
}[] = [
  { act: 'Remove', en: /^(Remove|Removed|Removing)\b|\bremoved\.?$/, refused: { nl: /verwijder/i, de: /lösch/i }, use: { nl: 'weghalen', de: 'entfernen' } },
  { act: 'Delete', en: /^(Delete|Deleted|Deleting)\b|\bdeleted\.?$/, refused: { nl: /weghal|weggehaald|eruit hal/i, de: /entfern/i }, use: { nl: 'verwijderen', de: 'löschen' } },
]

/** English words standing in for Remove, refused in a label: *Take off*, *Take out*. */
export const ENGLISH_REFUSED: readonly Refused[] = [
  { word: /^(Take|Took|Taking)\b[^.]*\b(off|out)\b/, use: 'Remove' },
]

/**
 * The same stand-in anywhere in running text — a help page, a hint, a check's
 * advice: *takes it off*, *taken out of the selection*. Remove says it.
 */
export const TAKE_OFF_IN_PROSE = /\b(take|takes|taken|taking|took)\s+(?:[^\s.,;:]+\s+){0,3}?(off|out)\b/i

/** Every stand-in for Remove in English running text, with where it sits. */
export function takeOffIn(path: string, text: string): string[] {
  const found = TAKE_OFF_IN_PROSE.exec(prose(text))
  return found ? [`${path}: "…${found[0]}…" — use Remove`] : []
}

/** What a label says against the two acts: one line where Dutch or German uses the other act's word, or English a stand-in for Remove. */
export function actsIn(language: Language, key: string, english: string, text: string): string[] {
  if (language === 'en') {
    return ENGLISH_REFUSED.filter((refused) => refused.word.test(prose(text))).map((refused) => `${key}: "${text.slice(0, 80)}" — use ${refused.use}`)
  }
  const said = prose(english).trim()
  const both = /\bremov/i.test(said) && /\bdelet/i.test(said)
  if (both) return []
  return ACTS
    .filter((one) => one.en.test(said) && one.refused[language].test(prose(text)))
    .map((one) => `${key}: "${text.slice(0, 80)}" says ${english.slice(0, 40)} — ${one.act} is ${one.use[language]}`)
}
