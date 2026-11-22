// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for the page: the words, on a screen.
 *
 * The language that is on, as a context and a hook, and a time of day said
 * the way the shell says one.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { clockTime } from '../../app/clockTime'
export { LanguageProvider, useStrings } from '../../i18n/LanguageContext'
