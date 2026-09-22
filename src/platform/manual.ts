// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the manual is read from.
 *
 * The manual ships in the repository, one file per language, and the
 * published repository is where a menu item can open it: the desktop app
 * carries no copy of its own, and a page on GitHub is one every platform's
 * default browser can show. The language is the renderer's, which is why the
 * Help menu's *User Manual* is a command the renderer answers rather than a
 * URL main opens itself.
 */
import type { Language } from '../i18n/strings'

export const REPOSITORY_URL = 'https://github.com/Lionsville/Lionsville-Architecture-Management-Tool'

export function manualUrl(language: Language): string {
  return `${REPOSITORY_URL}/blob/main/docs/manual.${language}.md`
}
