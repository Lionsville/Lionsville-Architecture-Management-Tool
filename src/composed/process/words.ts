// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: the words.
 *
 * The registry and what reads it without a screen: a translator, the languages
 * there are, words a build composed from this one brings, a day said.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { formatDay } from '../../i18n/dates'
export { detectBrowserLanguage } from '../../i18n/languages'
export type { Language } from '../../i18n/languages'
export { DEFAULT_TRANSLATE, LANGUAGES, LOCALE, STRINGS, registerStrings, t, translator } from '../../i18n/strings'
export type { StringKey, StringParams, StringTable } from '../../i18n/table'
