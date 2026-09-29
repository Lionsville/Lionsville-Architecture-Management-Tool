// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import {
  APPLIED_STEPS_FILE, appliedStepsOf, appliedStepsText, pictureStampsText, readAppliedSteps, readPictureStamps, readScopePlaces,
  scopePlacesText,
} from '../../src/platform/node/appliedSteps'
import type { AppliedSteps, PictureStamps, ScopePlaces } from '../../src/platform/node/appliedSteps'
import { log } from './log'

const settingsPath = (): string => join(app.getPath('userData'), MACHINE_FOLDER_SETTINGS_FILE)
const stepsPath = (): string => join(app.getPath('userData'), APPLIED_STEPS_FILE)

async function text(path = settingsPath()): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    // No file yet. The reader answers "never written" for every folder.
    return undefined
  }
}

/** One write of the steps file at a time: two windows remembering steps must not lose each other's. */
let stepsQueue: Promise<unknown> = Promise.resolve()

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
  // The step ids a folder's repositories applied (ADR-0031): kept here, keyed
  // by the folder, so the person never sees them and a copy never carries them.
  ipcMain.handle('settings:readFolderSteps', async (_event, root: unknown): Promise<AppliedSteps | undefined> => {
    if (typeof root !== 'string') return undefined
    return readAppliedSteps(await text(stepsPath()), root)
  })
  ipcMain.handle('settings:writeFolderSteps', (_event, root: unknown, steps: unknown): Promise<void> => {
    if (typeof root !== 'string') throw new Error('a folder is named by its path')
    const write = async () => {
      const next = appliedStepsText(await text(stepsPath()), root, appliedStepsOf(steps))
      try {
        await writeFile(stepsPath(), `${next}\n`, 'utf8')
      } catch (cause) {
        log('settings', `could not write ${APPLIED_STEPS_FILE}: ${String(cause)}`)
        throw cause
      }
    }
    const next = stepsQueue.then(write, write)
    stepsQueue = next.catch(() => undefined)
    return next
  })
  // Where a folder's scopes were last found, in the same file and the same turn.
  ipcMain.handle('settings:readFolderPlaces', async (_event, root: unknown): Promise<ScopePlaces | undefined> => {
    if (typeof root !== 'string') return undefined
    return readScopePlaces(await text(stepsPath()), root)
  })
  ipcMain.handle('settings:writeFolderPlaces', (_event, root: unknown, places: unknown): Promise<void> => {
    if (typeof root !== 'string') throw new Error('a folder is named by its path')
    const write = async () => {
      await writeFile(stepsPath(), `${scopePlacesText(await text(stepsPath()), root, (places ?? {}) as ScopePlaces)}\n`, 'utf8')
    }
    const next = stepsQueue.then(write, write)
    stepsQueue = next.catch(() => undefined)
    return next
  })
  // What this machine found a folder's pictures to be, by stamp: a cache, in the same file and the same turn.
  ipcMain.handle('settings:readFolderStamps', async (_event, root: unknown): Promise<PictureStamps | undefined> => {
    if (typeof root !== 'string') return undefined
    return readPictureStamps(await text(stepsPath()), root)
  })
  ipcMain.handle('settings:writeFolderStamps', (_event, root: unknown, stamps: unknown): Promise<void> => {
    if (typeof root !== 'string') throw new Error('a folder is named by its path')
    const write = async () => {
      await writeFile(stepsPath(), `${pictureStampsText(await text(stepsPath()), root, (stamps ?? {}) as PictureStamps)}\n`, 'utf8')
    }
    const next = stepsQueue.then(write, write)
    stepsQueue = next.catch(() => undefined)
    return next
  })
}
