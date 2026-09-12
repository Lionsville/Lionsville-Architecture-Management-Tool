/**
 * A working directory's own settings, as two files in a dot-folder at its
 * root (ADR-0005).
 *
 * The one implementation, over `DirectoryHandleLike`: the desktop's IPC handle
 * and the browser's directory handle both satisfy it, which is how
 * `FileSystemScopeStore` avoids two as well. Everything about what the files
 * mean is in `projects/folderSettings.ts`; this only finds them and puts the
 * text back.
 *
 * The dot-folder is outside the project format — `isFormatPath` does not
 * claim it — so a project save can never remove these and a settings write
 * can never look like a project change. The desktop watcher skips any path
 * with a dot segment, so a colleague changing the shared file raises no
 * change notice: folder settings are read on open, not live.
 */
import {
  FOLDER_SETTINGS_FILE, folderSettingsText, LOCAL_SETTINGS_FILE, SETTINGS_FOLDER, localSettingsText,
  readFolderSettings, readLocalSettings,
} from '../../projects/folderSettings'
import type {
  FolderSettings, FolderSettingsPatch, LocalSettings, LocalSettingsPatch,
} from '../../projects/folderSettings'
import type { FolderSettingsStore } from '../../ports/FolderSettings'
import type { DirectoryHandleLike } from './FileSystemScopeStore'

export class FileSystemFolderSettings implements FolderSettingsStore {
  readonly id = 'folder on disk'

  constructor(private readonly root: DirectoryHandleLike) {}

  /** The text of one of the two files, or nothing for every way that fails. */
  private async text(name: string): Promise<string | undefined> {
    try {
      const folder = await this.root.getDirectoryHandle(SETTINGS_FOLDER)
      const handle = await folder.getFileHandle(name)
      return await (await handle.getFile()).text()
    } catch {
      // Absent folder, absent file, withdrawn permission: the readers turn
      // "nothing" into the defaults, and none of it is worth a message.
      return undefined
    }
  }

  async readFolder(): Promise<FolderSettings> {
    return readFolderSettings(await this.text(FOLDER_SETTINGS_FILE))
  }

  async readLocal(): Promise<LocalSettings> {
    return readLocalSettings(await this.text(LOCAL_SETTINGS_FILE))
  }

  async writeLocal(patch: LocalSettingsPatch): Promise<void> {
    await this.write(LOCAL_SETTINGS_FILE, localSettingsText(await this.text(LOCAL_SETTINGS_FILE), patch))
  }

  async writeFolder(patch: FolderSettingsPatch): Promise<void> {
    await this.write(FOLDER_SETTINGS_FILE, folderSettingsText(await this.text(FOLDER_SETTINGS_FILE), patch))
  }

  private async write(name: string, text: string): Promise<void> {
    const folder = await this.root.getDirectoryHandle(SETTINGS_FOLDER, { create: true })
    const handle = await folder.getFileHandle(name, { create: true })
    const writable = await handle.createWritable()
    try {
      await writable.write(text)
    } finally {
      await writable.close()
    }
  }
}
