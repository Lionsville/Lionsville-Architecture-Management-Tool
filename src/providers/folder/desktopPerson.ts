// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What this person does about one folder on this desktop — pull when it
 * opens, push after a snapshot — kept in the desktop's own data folder beside
 * the folder's path (ADR-0023), and read where an older build left it in the
 * folder when the desktop has nothing yet.
 *
 * The person's settings of the folder's repositories (ADR-0031 §1) over the
 * channel main already keeps them behind: the desktop keeps the sync settings
 * and nothing else, so a key it does not know is not kept.
 */
import type { DesktopSettings } from '../../adapters/desktop/channel'
import type { PersonSettings } from '../../adapters/folder/FolderSettingsRepository'
import type { FolderSettingsStore } from '../../adapters/folder/FolderSettingsStore'
import type { LocalSettings, LocalSettingsPatch } from '../../adapters/folder/format/folderSettings'
import type { Settings } from '../../projects/settings'

export function desktopPerson(
  channel: Pick<DesktopSettings, 'readFolderLocal' | 'writeFolderLocal'>,
  root: string,
  /** What an older build left in the folder, read only where the desktop has nothing. */
  left: Pick<FolderSettingsStore, 'readLocal'>,
): PersonSettings {
  return {
    async read(): Promise<Settings> {
      const held: LocalSettings = await channel.readFolderLocal(root) ?? await left.readLocal()
      return { git: { ...held.git } }
    },
    async write(next: Settings): Promise<void> {
      await channel.writeFolderLocal(root, next as LocalSettingsPatch)
    },
  }
}
