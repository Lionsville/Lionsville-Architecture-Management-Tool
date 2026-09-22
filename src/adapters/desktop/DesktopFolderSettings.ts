// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The folder's settings on the desktop (ADR-0023, amending ADR-0005): what
 * this machine does about it kept by the app in `userData`, and what the
 * folder still says about itself read from the folder.
 *
 * Two halves, because the two files ADR-0005 put in the folder went two ways.
 * The machine file — `local.json` — is configuration of this install and
 * moved out: it goes over the settings channel to one file main keeps, keyed
 * by the folder's path. The shared file — `folder.json` — is a fact about the
 * folder that an older build may have written (the organisation's name,
 * before the root scope held it) and is read where it is; nothing writes it
 * any more.
 *
 * A folder this install has never written an entry for reads through to the
 * `local.json` it may still carry, so the machine's choices survive the move
 * without a migration step; the first write lands in `userData` with those
 * choices folded in, and the file in the folder is left alone — it is a
 * person's folder, and a build that reads it forgives it.
 */
import type {
  FolderSettings, LocalSettings, LocalSettingsPatch,
} from '../../projects/folderSettings'
import type { FolderSettingsStore } from '../../ports/FolderSettings'
import type { DesktopSettings } from './channel'

export class DesktopFolderSettings implements FolderSettingsStore {
  readonly id = 'desktop'

  constructor(
    private readonly channel: DesktopSettings,
    private readonly root: string,
    /** The folder's own files, for what an older build left there. */
    private readonly inFolder: FolderSettingsStore,
  ) {}

  readFolder(): Promise<FolderSettings> {
    return this.inFolder.readFolder()
  }

  async readLocal(): Promise<LocalSettings> {
    return await this.channel.readFolderLocal(this.root) ?? this.inFolder.readLocal()
  }

  async writeLocal(patch: LocalSettingsPatch): Promise<void> {
    const kept = await this.channel.readFolderLocal(this.root)
    // The first write for this folder folds in what its old file said, so a
    // flag set there is not lost the moment another one is set here.
    const carried = kept ? patch : { git: { ...(await this.inFolder.readLocal()).git, ...patch.git } }
    await this.channel.writeFolderLocal(this.root, carried)
  }
}
