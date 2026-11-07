// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The help's address for this person: in the app's language, in its theme
 * where they chose one rather than the system's, at a chapter or a section.
 * Every way into the help from the app goes through here, so the help opens
 * looking like the window it was opened from.
 */
import { helpAddress } from '../platform/helpAddress'
import type { Language } from '../i18n/languages'
import type { ThemeMode } from '../platform/theme'

export function helpAt(prefs: { language: Language; themeMode?: ThemeMode }, section?: string): string {
  const theme = prefs.themeMode === 'light' || prefs.themeMode === 'dark' ? prefs.themeMode : undefined
  return helpAddress({ language: prefs.language, ...(theme ? { theme } : {}), ...(section ? { section } : {}) })
}
