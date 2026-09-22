// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two settings files a working directory may carry (ADR-0005), and what
 * became of them (ADR-0023).
 *
 * A preference belongs to whatever it is actually about, and two of the three
 * scopes are about the folder rather than the person: what is true of this
 * working directory for everyone who opens it, and what this machine does
 * about it. ADR-0005 made them two files in one dot-folder at the root:
 *
 *   <root>/.lionsville-architecture/folder.json   shared, committed
 *   <root>/.lionsville-architecture/local.json    this machine only
 *
 * The folder is named after the working file's discriminator and not after
 * its extension: `.lvarch/` beside `something.lvarch` would be one token
 * meaning two things in the same directory listing.
 *
 * **The desktop writes neither any more.** Configuration of the application
 * belongs with the application, not in every project a person opens: what
 * this machine does about a folder is kept in the desktop's own data folder,
 * keyed by the folder's path (`platform/node/machineFolderSettings.ts`), and
 * `local.json` is read where an older build left it and never written back.
 * The shared file is keyless — its one key was the organisation's name
 * (ADR-0012), put there before the root scope's `scope.json` existed to hold
 * it — and is only read, for that name, by the 4 → 5 pass; a source that
 * keeps its settings in the folder it serves (the hosted plugin's) still
 * writes the machine file through `FileSystemFolderSettings`, which is why
 * the shape of that file is still decided here.
 *
 * Readers tolerate anything — absent, malformed, a `version` newer than this
 * build — and fail towards the safe default, which for the machine file is
 * "do nothing automatically". The writer patches rather than replaces: keys
 * this build does not recognise are carried through unchanged, because an
 * older build must not prune a newer one's settings.
 *
 * Pure. Nothing here touches a disk; `ports/FolderSettings.ts` is the seam
 * that does.
 */
import { parseJson, stableJson } from './fileText'

export const SETTINGS_FOLDER = '.lionsville-architecture'
export const FOLDER_SETTINGS_FILE = 'folder.json'
export const LOCAL_SETTINGS_FILE = 'local.json'
export const FOLDER_SETTINGS_PATH = `${SETTINGS_FOLDER}/${FOLDER_SETTINGS_FILE}`
export const LOCAL_SETTINGS_PATH = `${SETTINGS_FOLDER}/${LOCAL_SETTINGS_FILE}`

/** The format of `local.json` this build writes, where a source still keeps one. */
export const LOCAL_SETTINGS_VERSION = 1

/**
 * What an older build wrote into the shared file, read and never written.
 *
 * Nothing this build governs — see the header. The type stays so the seam
 * that reads it keeps its shape.
 */
export type FolderSettings = {
  /**
   * What an older build called this organisation, where the file still says so.
   *
   * Not a setting, and not read by anything that draws: the root scope's
   * `scope.json` is where a name belongs (ADR-0012 §1). The 4 → 5 pass is this
   * field's only reader — it takes the name for the root it is about to write.
   * The key is left where it is: a build that reads it forgives it, and the
   * folder is a person's, not a place this app keeps its files (ADR-0023).
   */
  readonly legacyOrganisationName?: string
}

/** The key an older build wrote the organisation's name under. */
const LEGACY_ORGANISATION = 'organisation'

/** What this machine does about the folder's git remote. */
export type LocalGitSettings = {
  /** Fast-forward from the remote when the folder is opened. */
  readonly pullOnOpen: boolean
  /** Push after every snapshot that succeeds. */
  readonly pushAfterSnapshot: boolean
}

export type LocalSettings = {
  readonly git: LocalGitSettings
}

/** What a writer may change: any subset, at any depth this file has. */
export type LocalSettingsPatch = {
  readonly git?: Partial<LocalGitSettings>
}

/**
 * A machine with no `local.json` does nothing automatically, which is the right
 * way for a missing file to fail. The same defaults answer for a malformed one.
 */
export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  git: { pullOnOpen: false, pushAfterSnapshot: false },
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * The shared settings out of `folder.json`, or what an absent one means.
 *
 * Nothing this build governs, and forgiving about everything: a file that
 * will not parse, a file from a newer build, no file at all. The one key it
 * reads is the one an older build wrote — see
 * {@link FolderSettings.legacyOrganisationName}.
 */
export function readFolderSettings(text: string | undefined): FolderSettings {
  const held = text === undefined ? undefined : record(parseJson(text))
  const organisation = record(held?.[LEGACY_ORGANISATION])
  const name = typeof organisation?.['name'] === 'string' ? organisation['name'].trim() : ''
  return name ? { legacyOrganisationName: name } : {}
}

/**
 * This machine's settings out of `local.json`.
 *
 * Field by field rather than as a whole: a file that carries one good flag and
 * one nonsense value keeps the good one. A version this build does not know
 * is not a reason to refuse — the keys it recognises are read, the rest is
 * carried through by the writer.
 */
export function readLocalSettings(text: string | undefined): LocalSettings {
  const held = text === undefined ? undefined : record(parseJson(text))
  const git = record(held?.['git'])
  return {
    git: {
      pullOnOpen: flag(git?.['pullOnOpen'], DEFAULT_LOCAL_SETTINGS.git.pullOnOpen),
      pushAfterSnapshot: flag(git?.['pushAfterSnapshot'], DEFAULT_LOCAL_SETTINGS.git.pushAfterSnapshot),
    },
  }
}

/**
 * The text `local.json` should hold after `patch` is applied to `existing`.
 *
 * Unknown keys at the top and inside `git` are kept. The version is stamped
 * with this build's, except where the file already claims a newer one: a
 * newer build's file that an older build patches stays a newer build's file.
 * Stable JSON, so a settings change is one readable line in a diff.
 */
export function localSettingsText(existing: string | undefined, patch: LocalSettingsPatch): string {
  const held = (existing === undefined ? undefined : record(parseJson(existing))) ?? {}
  const git = record(held['git']) ?? {}
  const version = typeof held['version'] === 'number' && held['version'] > LOCAL_SETTINGS_VERSION
    ? held['version']
    : LOCAL_SETTINGS_VERSION
  return stableJson({
    ...held,
    version,
    git: { ...git, ...(patch.git ?? {}) },
  })
}
