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
import { isLanguage } from '../i18n'
import type { Language } from '../i18n'
import { isProjectRef } from './projectRef'
import type { ProjectRef } from './projectRef'

/**
 * The light or dark theme — or the system's.
 *
 * Three settings and not two: "follow the system" is what most people want, and
 * it is the only setting that moves along by itself in the evening. A shell that
 * knew only light/dark would force everybody to choose something every day.
 */
export type ThemeMode = 'light' | 'dark' | 'system'

const THEME_MODES: readonly string[] = ['light', 'dark', 'system']

/**
 * The language from the stored preferences, or `undefined` when there is nothing
 * usable — the browser decides then (`detectBrowserLanguage`).
 *
 * The package ignores fields it does not recognise, so the blob is allowed to
 * carry more than `EditorPreferences`.
 */
export function readLanguage(stored: unknown): Language | undefined {
  if (!stored || typeof stored !== 'object') return undefined
  const raw = (stored as Record<string, unknown>).language
  return isLanguage(raw) ? raw : undefined
}

/** The same for the theme. */
export function readThemeMode(stored: unknown): ThemeMode | undefined {
  if (!stored || typeof stored !== 'object') return undefined
  const raw = (stored as Record<string, unknown>).themeMode
  return typeof raw === 'string' && THEME_MODES.includes(raw) ? (raw as ThemeMode) : undefined
}

/**
 * The project this browser had open last, or `undefined` for a first visit.
 *
 * A preference and not project data: which project you were in belongs to this
 * screen, the way a window position does. It is also why the app can open
 * straight into your work instead of asking every time — and why, when the ref
 * points at a project that has since been deleted, the honest answer is the
 * picker rather than an error.
 *
 * Validated rather than trusted: this value is the one piece of addressing that
 * survives a reload, so it is the one an old or hand-edited store can poison.
 */
export function readLastProject(stored: unknown): ProjectRef | undefined {
  if (!stored || typeof stored !== 'object') return undefined
  const raw = (stored as Record<string, unknown>).lastProject
  return isProjectRef(raw) ? raw : undefined
}

/**
 * The folder this machine keeps its projects in, or `undefined` when it does
 * not keep them in one.
 *
 * A preference and not project data, for the same reason as the last project:
 * it says where this machine looks, not what the projects are. It is a path
 * rather than anything richer because the desktop is the only thing that can
 * use it, and there it is checked against the folders the user has actually
 * granted before it opens anything (`electron/main/files.ts`) — a path in a
 * preferences blob is a wish, not an authorisation.
 */
export function readWorkingDirectory(stored: unknown): string | undefined {
  if (!stored || typeof stored !== 'object') return undefined
  const raw = (stored as Record<string, unknown>).workingDirectory
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined
}

/** The same blob, pointed at a folder. */
export function withWorkingDirectory(stored: unknown, root: string): Record<string, unknown> {
  const kept = stored && typeof stored === 'object' ? { ...stored as Record<string, unknown> } : {}
  kept.workingDirectory = root
  // The project you had open was one in the OLD folder; carrying the ref across
  // would open the picker on a project that is not there, or — worse, if the
  // slugs happen to match — a different project with the same address.
  delete kept.lastProject
  return kept
}

/**
 * The folders this machine has already copied its browser-storage projects
 * into.
 *
 * A list rather than a flag, because a person can have two folders — one per
 * customer, one per machine — and each of them wants the migration once and
 * exactly once. Copying again would be harmless (nothing already in a folder is
 * overwritten) but it would resurrect projects the user deleted from the folder
 * on purpose, which is the same nuisance as a sync client that will not let go.
 */
export function readMigratedFolders(stored: unknown): string[] {
  if (!stored || typeof stored !== 'object') return []
  const raw = (stored as Record<string, unknown>).migratedFolders
  return Array.isArray(raw) ? raw.filter((held): held is string => typeof held === 'string') : []
}

/** The same blob, with one more folder marked as done. */
export function withMigratedFolder(stored: unknown, root: string): Record<string, unknown> {
  const kept = stored && typeof stored === 'object' ? { ...stored as Record<string, unknown> } : {}
  kept.migratedFolders = [...new Set([...readMigratedFolders(stored), root])]
  return kept
}

/**
 * The same blob with the last project taken out.
 *
 * What "Start without the last project" writes back. A ref that points at a
 * project this build cannot open — half-written, from a newer version, or
 * simply enormous — would otherwise be reopened on every boot, and every boot
 * would fail the same way. Everything else in the blob is kept: the language
 * and the theme are not what went wrong.
 */
export function withoutLastProject(stored: unknown): Record<string, unknown> {
  if (!stored || typeof stored !== 'object') return {}
  const next = { ...(stored as Record<string, unknown>) }
  delete next.lastProject
  return next
}
