// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the shell reads out of the stored preferences blob.
 *
 * Language and theme only: those are the two the shell itself governs. The rest
 * of the blob belongs to the editor, which vets it itself (`mergePreferences`),
 * and both ignore what they do not recognise — so an older shell does not lose a
 * newer one's settings.
 *
 * Language and theme sit in the SAME blob as the editor's preferences and not
 * under a key of their own: it is one set of settings for this browser, and two
 * keys could drift apart on "shipped document" or on a full store.
 *
 * The reading and writing themselves no longer live here. That is work for a
 * `PreferencesStore` (`src/ports/`), so the desktop can later have a different
 * store without these two functions noticing.
 */
import { languageFrom } from '../i18n/languages'
import { isThemeMode } from '../platform/theme'
import type { ThemeMode } from '../platform/theme'
import type { Language } from '../i18n/languages'
import { isSafeScopePath, pathOfOldRef } from './scopePath'
import type { ScopePath } from './scopePath'

export type { ThemeMode } from '../platform/theme'


/**
 * The language from the stored preferences, or `undefined` when there is nothing
 * usable — the browser decides then (`detectBrowserLanguage`).
 *
 * The package ignores fields it does not recognise, so the blob is allowed to
 * carry more than `EditorPreferences`. A language this app no longer ships is
 * read as the one that took its place (`languageFrom`), so a person who chose
 * Frisian opens in Dutch rather than in whatever the browser says.
 */
export function readLanguage(stored: unknown): Language | undefined {
  if (!stored || typeof stored !== 'object') return undefined
  return languageFrom((stored as Record<string, unknown>).language)
}

/** The same for the theme. */
export function readThemeMode(stored: unknown): ThemeMode | undefined {
  if (!stored || typeof stored !== 'object') return undefined
  const raw = (stored as Record<string, unknown>).themeMode
  return isThemeMode(raw) ? raw : undefined
}

/**
 * The scope this browser had open last, or `undefined` for a first visit.
 *
 * A preference and not content: which scope you were in belongs to this screen,
 * the way a window position does. It is also why the app can open straight into
 * your work instead of asking every time — and why, when the path names a scope
 * that has since been deleted, the honest answer is the picker rather than an
 * error.
 *
 * Validated rather than trusted: this value is the one piece of addressing that
 * survives a reload, so it is the one an old or hand-edited store can poison.
 *
 * A blob written before scopes says `lastProject`, as a group and a key. The
 * two spell the same address — the path was always `<group>/<project>` — so it
 * is read rather than thrown away, and the next write says `lastScope`.
 */
export function readLastScope(stored: unknown): ScopePath | undefined {
  if (!stored || typeof stored !== 'object') return undefined
  const held = stored as Record<string, unknown>
  const raw = held.lastScope ?? pathOfOldRef(held.lastProject)
  return isSafeScopePath(raw) && raw !== '' ? raw : undefined
}

/**
 * The same blob with the last scope taken out.
 *
 * What "Start without the last project" writes back. A path that names a scope
 * this build cannot open — half-written, from a newer version, or simply
 * enormous — would otherwise be reopened on every boot, and every boot would
 * fail the same way. Everything else in the blob is kept: the language and the
 * theme are not what went wrong. The older key goes with it, or the fallback
 * above would hand the same broken address back on the next boot.
 */
export function withoutLastScope(stored: unknown): Record<string, unknown> {
  if (!stored || typeof stored !== 'object') return {}
  const next = { ...(stored as Record<string, unknown>) }
  delete next.lastScope
  delete next.lastProject
  return next
}
