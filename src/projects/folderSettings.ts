/**
 * The two settings files a working directory may carry (ADR-0005).
 *
 * A preference belongs to whatever it is actually about, and two of the three
 * scopes are about the folder rather than the person: what is true of this
 * working directory for everyone who opens it, and what this machine does
 * about it. They are two files in one dot-folder at the root:
 *
 *   <root>/.lionsville-architecture/folder.json   shared, committed
 *   <root>/.lionsville-architecture/local.json    this machine only
 *
 * The folder is named after the working file's discriminator and not after
 * its extension: `.lvarch/` beside `something.lvarch` would be one token
 * meaning two things in the same directory listing.
 *
 * The shared file's first key is the **organisation** (ADR-0012): the working
 * directory is one organisation, and this is where it says its own name. That
 * is what the scope was held open for — its location, its rules and a reader
 * that tolerated its absence were built before there was anything to put in it,
 * so that the first key would land on a file every build already forgives.
 *
 * Readers tolerate anything — absent, malformed, a `version` newer than this
 * build — and fail towards the safe default, which for the machine file is
 * "do nothing automatically". Writers patch rather than replace: keys this
 * build does not recognise are carried through unchanged, because an older
 * build must not prune a newer one's settings, and with a shared file the
 * newer build may be a colleague's.
 *
 * Pure. Nothing here touches a disk; `ports/FolderSettings.ts` is the seam
 * that does.
 */
import { parseJson, stableJson } from './fileText'
import { isOrganisation, normaliseOrganisation } from './organisation'
import type { Organisation } from './organisation'

export const SETTINGS_FOLDER = '.lionsville-architecture'
export const FOLDER_SETTINGS_FILE = 'folder.json'
export const LOCAL_SETTINGS_FILE = 'local.json'
export const FOLDER_SETTINGS_PATH = `${SETTINGS_FOLDER}/${FOLDER_SETTINGS_FILE}`
export const LOCAL_SETTINGS_PATH = `${SETTINGS_FOLDER}/${LOCAL_SETTINGS_FILE}`

/** The format of `local.json` this build writes. */
export const LOCAL_SETTINGS_VERSION = 1

/** The format of `folder.json` this build writes. */
export const FOLDER_SETTINGS_VERSION = 1

/**
 * What everyone who opens this folder agrees on.
 *
 * The organisation is absent until someone names it. A folder that has only
 * ever been opened is a folder, not an unnamed organisation, and the difference
 * matters: absent falls back to the folder's own name, whereas a record with a
 * blank name is a person who cleared the field.
 */
export type FolderSettings = {
  readonly organisation?: Organisation
}

/** What a writer may change in the shared file: any subset of it. */
export type FolderSettingsPatch = {
  readonly organisation?: Organisation
}

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
 * Key by key, and forgiving, for the same reason as `local.json`: a file
 * carrying one good section and one written by a build that disagrees keeps the
 * good one. A section this build cannot read is absent rather than an error —
 * an organisation nobody can name still opens.
 */
export function readFolderSettings(text: string | undefined): FolderSettings {
  const held = text === undefined ? undefined : record(parseJson(text))
  const organisation = held?.['organisation']
  return isOrganisation(organisation) ? { organisation } : {}
}

/**
 * The text `folder.json` should hold after `patch` is applied to `existing`.
 *
 * Unknown keys are kept and the version is never lowered — the same two rules
 * as `local.json`, and here they are load-bearing rather than careful: this
 * file is committed, so the newer build whose keys must survive an older one
 * writing is routinely a colleague's.
 *
 * A section in the patch **replaces** rather than merges, unlike `local.json`'s
 * flags. An organisation is edited as a form and saved whole, so merging would
 * make a cleared field indistinguishable from an untouched one.
 */
export function folderSettingsText(
  existing: string | undefined, patch: FolderSettingsPatch,
): string {
  const held = (existing === undefined ? undefined : record(parseJson(existing))) ?? {}
  const version = typeof held['version'] === 'number' && held['version'] > FOLDER_SETTINGS_VERSION
    ? held['version']
    : FOLDER_SETTINGS_VERSION
  return stableJson({
    ...held,
    version,
    ...(patch.organisation ? { organisation: normaliseOrganisation(patch.organisation) } : {}),
  })
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
