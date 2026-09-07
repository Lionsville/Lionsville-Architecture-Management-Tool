/**
 * Where a working directory's own settings are kept (ADR-0005).
 *
 * Two of the three preference scopes live in the folder itself: what is true
 * of it for everyone, and what this machine does about it. This seam is how
 * the shell reaches both without knowing whether the folder is an IPC handle
 * or a browser's directory handle — and it is **absent** on a shell that has
 * no folder, the way `history?` is, rather than a null object that answers
 * "no" to everything. A section of the preferences dialog that has nothing to
 * be about is not drawn.
 *
 * Reading never fails: an absent, malformed or newer file reads as its safe
 * default (`projects/folderSettings.ts` decides what that is). Writing patches
 * what is there and may reject, the way every other write may.
 */
import type { FolderSettings, LocalSettings, LocalSettingsPatch } from '../projects/folderSettings'

export interface FolderSettingsStore {
  /** Where this one keeps things, in plain words. For messages and the trail. */
  readonly id: string

  /** What everyone who opens this folder agrees on. Nothing yet. */
  readFolder(): Promise<FolderSettings>

  /** What this machine does about the folder. Defaults when there is no file. */
  readLocal(): Promise<LocalSettings>

  /**
   * Change some of what this machine does. A patch, so two settings written
   * from two places never overwrite each other, and so keys a newer build put
   * in the file survive an older build changing one of its own.
   */
  writeLocal(patch: LocalSettingsPatch): Promise<void>
}
