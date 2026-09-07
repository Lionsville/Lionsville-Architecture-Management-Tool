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
 * **The shared file has no keys yet, and is not written until it has one.**
 * The scope exists — its location, its rules, and the reader that tolerates
 * its absence — because the next folder-shaped setting needs somewhere to
 * land; a file that carries nothing is a shape people fill for the wrong
 * reasons, so there is deliberately no writer for it here.
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

export const SETTINGS_FOLDER = '.lionsville-architecture'
export const FOLDER_SETTINGS_FILE = 'folder.json'
export const LOCAL_SETTINGS_FILE = 'local.json'
export const FOLDER_SETTINGS_PATH = `${SETTINGS_FOLDER}/${FOLDER_SETTINGS_FILE}`
export const LOCAL_SETTINGS_PATH = `${SETTINGS_FOLDER}/${LOCAL_SETTINGS_FILE}`

/** The format of `local.json` this build writes. */
export const LOCAL_SETTINGS_VERSION = 1

/**
 * What everyone who opens this folder agrees on. Nothing yet — see the file
 * header for why the type is not simply omitted.
 */
export type FolderSettings = Record<never, never>

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

/** The shared settings out of `folder.json`, or what an absent one means. */
export function readFolderSettings(text: string | undefined): FolderSettings {
  // Parsed and then ignored, deliberately: the reader exists so that the first
  // key added here lands on a file that is already tolerated everywhere.
  void (text === undefined ? undefined : record(parseJson(text)))
  return {}
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
