/**
 * What this machine does about each working directory, kept in `userData`
 * (ADR-0023, amending ADR-0005).
 *
 * Beside `update-settings.json` and `mcp.json`, for the same reason they are
 * here: `userData` is not a folder the user granted, so the renderer cannot
 * reach it through the file channel, and a settings file of ours does not
 * belong in anybody's project. Everything about what the text says is in
 * `platform/node/machineFolderSettings.ts`; this finds the file and puts the
 * text back, and answers the renderer's two calls.
 */
import { app, ipcMain } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LocalSettings, LocalSettingsPatch } from '../../src/projects/folderSettings'
import { readLocalSettings } from '../../src/projects/folderSettings'
import {
  MACHINE_FOLDER_SETTINGS_FILE, machineFolderSettingsText, readMachineFolderSettings,
} from '../../src/platform/node/machineFolderSettings'
import { log } from './log'

const settingsPath = (): string => join(app.getPath('userData'), MACHINE_FOLDER_SETTINGS_FILE)

async function text(): Promise<string | undefined> {
  try {
    return await readFile(settingsPath(), 'utf8')
  } catch {
    // No file yet. The reader answers "never written" for every folder.
    return undefined
  }
}

export function registerFolderSettingsChannel(): void {
  ipcMain.handle('settings:readFolderLocal', async (_event, root: unknown): Promise<LocalSettings | undefined> => {
    if (typeof root !== 'string') return undefined
    return readMachineFolderSettings(await text(), root)
  })
  ipcMain.handle('settings:writeFolderLocal', async (_event, root: unknown, patch: unknown): Promise<LocalSettings> => {
    if (typeof root !== 'string') throw new Error('a folder is named by its path')
    const held = (patch ?? {}) as LocalSettingsPatch
    const next = machineFolderSettingsText(await text(), root, held)
    try {
      await writeFile(settingsPath(), `${next}\n`, 'utf8')
    } catch (cause) {
      log('settings', `could not write ${MACHINE_FOLDER_SETTINGS_FILE}: ${String(cause)}`)
      throw cause
    }
    return readMachineFolderSettings(next, root) ?? readLocalSettings(undefined)
  })
}
