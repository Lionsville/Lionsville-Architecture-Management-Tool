// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The clock in the user's language.
 *
 * `nl-NL` used to be hardcoded here, which gave a Dutch time on an English
 * screen. The locale now follows the language choice — same button, same answer.
 *
 * A file of its own because two screens say it: the bar, for when it last
 * saved, and the Activity list the bar opens, for when each step was made.
 * Beside either of them it was a loop — the bar imports the list it opens, and
 * the list imported the bar for this one function.
 */
import { LOCALE } from '../i18n'
import type { Language } from '../i18n'

export function clockTime(at: Date, language: Language): string {
  return at.toLocaleTimeString(LOCALE[language], {
    hour: '2-digit', minute: '2-digit',
  })
}
