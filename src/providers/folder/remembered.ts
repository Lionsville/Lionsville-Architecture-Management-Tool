// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the folder keeps in the person's preferences: which folder this
 * machine works in, and what was answered when it offered to bring the work
 * kept in this browser along.
 *
 * In the preferences blob, which has one writer: the boot writes the first
 * (`SourceConnect.remember`) and the folder's chrome the second, through the
 * app (`SourcePreferences`).
 */

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
  // The scope you had open was one in the OLD folder; carrying the path across
  // would open the picker on a scope that is not there, or — worse, if the
  // slugs happen to match — a different scope at the same address.
  delete kept.lastScope
  delete kept.lastProject
  return kept
}

/**
 * The folders this machine has already copied its browser-storage projects
 * into.
 *
 * **One copy, ever — not one per folder.** This list used to be the whole rule,
 * and it read "each folder wants the migration once and exactly once". That is
 * the sentence that copied somebody's organisation into the next empty folder
 * they picked, and the one after it: a folder nobody has migrated into is every
 * folder they have just made. One folder per customer is exactly the case where
 * the first customer's landscape must not follow them into the second's.
 *
 * So it is read now as *has the rescue happened at all*, and it stays a list
 * because it is also the record of where the work went, and because a blob
 * written by a build before this one still reads.
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
 * The folders the offer was made for and turned down.
 *
 * Kept per folder, and the reason it is per folder rather than a flag is the
 * browser: permission to a handle rarely survives a restart, so the same folder
 * is picked again and again, and a question already answered must not be asked
 * on every one of those picks. A different folder is a different question, and
 * is asked once too.
 *
 * Nothing here is a refusal of anything later: the work is still in browser
 * storage, untouched, and saying no leaves every route to it open.
 */
export function readDeclinedFolders(stored: unknown): string[] {
  if (!stored || typeof stored !== 'object') return []
  const raw = (stored as Record<string, unknown>).declinedFolders
  return Array.isArray(raw) ? raw.filter((held): held is string => typeof held === 'string') : []
}

/** The same blob, with one more folder marked as asked and answered no. */
export function withDeclinedFolder(stored: unknown, root: string): Record<string, unknown> {
  const kept = stored && typeof stored === 'object' ? { ...stored as Record<string, unknown> } : {}
  kept.declinedFolders = [...new Set([...readDeclinedFolders(stored), root])]
  return kept
}

/**
 * Whether picking this folder may still offer to bring the work along.
 *
 * The rule, less the one part of it that has to read a store: is there anything
 * left to rescue, and has this folder already been asked about. Here, pure and
 * pinned, because it is the whole of what went wrong — the offer used to be
 * made per folder, so every folder somebody made was one that had never been
 * offered, and a folder made to start something new arrived full.
 *
 * One copy anywhere ends the offer everywhere: the work is in files now, and
 * which files is beside the point. A no ends it for that folder only, because
 * a no is about a place — the next folder is a fair question again.
 */
export function mayOfferAdoption(stored: unknown, root: string): boolean {
  if (readMigratedFolders(stored).length > 0) return false
  return !readDeclinedFolders(stored).includes(root)
}
