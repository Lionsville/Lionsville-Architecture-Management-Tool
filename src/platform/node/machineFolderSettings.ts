/**
 * What this machine does about each working directory, kept by the app and
 * not in the directory (ADR-0023, amending ADR-0005).
 *
 * The machine's settings for a folder used to be a file in the folder —
 * `.lionsville-architecture/local.json` — which put a settings file of ours
 * in every working directory a person opened, excluded from its history by a
 * line in `.git/info/exclude` and carried along by every copy of the folder
 * that was not a clone. Configuration of the application belongs with the
 * application: one file in the desktop's own data folder, keyed by the
 * folder's path, and nothing of ours left in anybody's project.
 *
 *   <userData>/folder-settings.json
 *   { "version": 1, "folders": { "<root>": { "version": 1, "git": { … } } } }
 *
 * Each entry is exactly what `local.json` held, read and patched by the same
 * two functions, which is what makes a folder's old file readable as an entry
 * that has not been written yet (`DesktopFolderSettings`).
 *
 * Pure: text in, text out. The main process finds the file and puts the text
 * back; this decides what the text says.
 */
import { parseJson, stableJson } from '../../projects/fileText'
import { localSettingsText, readLocalSettings } from '../../projects/folderSettings'
import type { LocalSettings, LocalSettingsPatch } from '../../projects/folderSettings'

export const MACHINE_FOLDER_SETTINGS_FILE = 'folder-settings.json'
export const MACHINE_FOLDER_SETTINGS_VERSION = 1

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function entries(text: string | undefined): Record<string, unknown> {
  const held = text === undefined ? undefined : record(parseJson(text))
  return record(held?.['folders']) ?? {}
}

/**
 * The entry for one folder, or `undefined` where the app has never written
 * one — which is the caller's cue to look at what the folder itself still
 * says. An entry that is there but will not read answers the defaults, the
 * way the file it replaces did.
 */
export function readMachineFolderSettings(text: string | undefined, root: string): LocalSettings | undefined {
  const entry = entries(text)[root]
  if (entry === undefined) return undefined
  return readLocalSettings(JSON.stringify(entry))
}

/**
 * The text the file should hold after `patch` is applied to the entry for
 * `root`. Every other folder's entry is carried through untouched, and so is
 * anything inside the entry this build does not know, for the reason
 * `localSettingsText` gives.
 */
export function machineFolderSettingsText(
  text: string | undefined, root: string, patch: LocalSettingsPatch,
): string {
  const held = entries(text)
  const existing = held[root] === undefined ? undefined : JSON.stringify(held[root])
  const top = (text === undefined ? undefined : record(parseJson(text))) ?? {}
  const version = typeof top['version'] === 'number' && top['version'] > MACHINE_FOLDER_SETTINGS_VERSION
    ? top['version']
    : MACHINE_FOLDER_SETTINGS_VERSION
  return stableJson({
    ...top,
    version,
    folders: { ...held, [root]: parseJson(localSettingsText(existing, patch)) },
  })
}
