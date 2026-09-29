// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The settings of a folder's organisation and scopes, and the person's own
 * (ADR-0031 §1).
 *
 * **In the folder, where they travel with it.** The organisation's are
 * `organisation.json` and a scope's are `settings.json`, each in the
 * settings folder the organisation's settings have always been kept in
 * (`.lionsville-architecture/`, ADR-0005), at the root and in the scope's own
 * folder. So a scope's settings move with it, go with it when it is removed,
 * are in its history, and are kept apart from its state: writing one moves no
 * revision.
 *
 * **The person's are not the folder's.** They are this person's, on this
 * install, and whoever composes the folder says where those are kept
 * (`PersonSettings`); the desktop keeps what it does about a folder in its own
 * data folder (ADR-0023), and nothing of the person's is written beside the
 * work.
 */
import { parseJson, stableJson } from '../../projects/text'
import { scopeFilePath } from '../../projects/scopePath'
import { patchSettings } from '../../projects/settings'
import type { Settings, SettingsPatch } from '../../projects/settings'
import { ShellError } from '../../platform/errors'
import type { SettingsOf, SettingsRepository } from '../../ports/SettingsRepository'
import { SCOPE_SETTINGS_FOLDER } from './folderGit'
import type { FolderScopes } from './folderScopes'
import { textAt, writeAt } from './handles'

/** Where the person's own settings about this folder are kept: the composer's to say. */
export type PersonSettings = {
  read(): Promise<Settings>
  write(next: Settings): Promise<void>
}

/** The person's settings kept in memory, for as long as the repositories are open: where nobody said otherwise. */
export function personSettingsInMemory(): PersonSettings {
  let held: Settings = {}
  return {
    read: () => Promise.resolve(structuredClone(held)),
    write: (next) => {
      held = structuredClone(next)
      return Promise.resolve()
    },
  }
}

const ORGANISATION_FILE = `${SCOPE_SETTINGS_FOLDER}/organisation.json`
const SCOPE_SETTINGS_FILE = `${SCOPE_SETTINGS_FOLDER}/settings.json`

/** Settings as a file holds them: an object, or nothing a reader can use, which reads as none. */
function settingsIn(text: string | undefined): Settings {
  const parsed = text === undefined ? undefined : parseJson(text)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Settings : {}
}

export class FolderSettingsRepository implements SettingsRepository {
  readonly id = 'folder'

  constructor(private readonly folder: FolderScopes, private readonly person: PersonSettings) {}

  /** Where a set is kept in the folder; `undefined` for a scope that is not there. */
  private async fileOf(of: SettingsOf): Promise<string | undefined> {
    if (of.of === 'organisation') return ORGANISATION_FILE
    if (of.of === 'person') return undefined
    const node = await this.folder.resolve(of.scope)
    return node ? scopeFilePath(node.address, SCOPE_SETTINGS_FILE) : undefined
  }

  async read(of: SettingsOf): Promise<Settings> {
    if (of.of === 'person') return this.person.read()
    const file = await this.fileOf(of)
    return file === undefined ? {} : settingsIn(await textAt(this.folder.root, file))
  }

  write(of: SettingsOf, patch: SettingsPatch): Promise<Settings> {
    return this.folder.serial(async () => {
      if (of.of === 'person') {
        const next = patchSettings(await this.person.read(), patch)
        await this.person.write(next)
        return structuredClone(next)
      }
      const file = await this.fileOf(of)
      if (file === undefined) throw new ShellError('shell.scopeGone')
      const next = patchSettings(settingsIn(await textAt(this.folder.root, file)), patch)
      await writeAt(this.folder.root, file, stableJson(next))
      return structuredClone(next)
    })
  }
}
