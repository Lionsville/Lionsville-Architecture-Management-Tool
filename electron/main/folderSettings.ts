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
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LocalSettings, LocalSettingsPatch } from '../../src/adapters/folder/format/folderSettings'
import { readLocalSettings } from '../../src/adapters/folder/format/folderSettings'
import {
  MACHINE_FOLDER_SETTINGS_FILE, machineFolderSettingsText, readMachineFolderSettings,
} from '../../src/platform/node/machineFolderSettings'
import {
  appliedStepsFile, appliedStepsOf, appliedStepsText, pictureStampsText, readAppliedSteps, readPictureStamps, readScopePlaces,
  scopePlacesText,
} from '../../src/platform/node/appliedSteps'
import type { PictureStamps, ScopePlaces } from '../../src/platform/node/appliedSteps'
import { writeWhole } from './fileStore'
import { isGranted } from './files'
import { log } from './log'

const settingsPath = (): string => join(app.getPath('userData'), MACHINE_FOLDER_SETTINGS_FILE)
const stepsPath = (root: string): string => join(app.getPath('userData'), appliedStepsFile(root))

async function text(path = settingsPath()): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
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
      await writeWhole(settingsPath(), `${next}\n`)
    } catch (cause) {
      log('settings', `could not write ${MACHINE_FOLDER_SETTINGS_FILE}: ${String(cause)}`)
      throw cause
    }
    return readMachineFolderSettings(next, root) ?? readLocalSettings(undefined)
  })
  // The step ids a folder's repositories applied (ADR-0031): kept here, one
  // file per folder, so the person never sees them and a copy never carries
  // them; with where its scopes were last found and what its pictures were.
  // Like the file channels, only for a folder the user granted.
  kept('Steps', readAppliedSteps, (text, root, value) => appliedStepsText(text, root, appliedStepsOf(value)))
  kept('Places', readScopePlaces, (text, root, value) => scopePlacesText(text, root, (value ?? {}) as ScopePlaces))
  kept('Stamps', readPictureStamps, (text, root, value) => pictureStampsText(text, root, (value ?? {}) as PictureStamps))
}

/** One part of a folder's own file: a read, and a write in that file's turn. */
function kept(
  part: 'Steps' | 'Places' | 'Stamps',
  read: (text: string | undefined, root: string) => unknown,
  written: (text: string | undefined, root: string, value: unknown) => string,
): void {
  ipcMain.handle(`settings:readFolder${part}`, async (_event, root: unknown) =>
    isGranted(root) ? read(await text(stepsPath(root)), root) : undefined)
  ipcMain.handle(`settings:writeFolder${part}`, (_event, root: unknown, value: unknown): Promise<void> => {
    if (!isGranted(root)) return Promise.reject(new Error('shell.pathRefused'))
    return inTurn(root, async () => {
      const path = stepsPath(root)
      try {
        // Whole or not at all: a file cut short reads as nothing, and the next
        // write would keep only what it adds.
        await writeWhole(path, `${written(await text(path), root, value)}\n`)
      } catch (cause) {
        log('settings', `could not write a folder's ${part.toLowerCase()}: ${String(cause)}`)
        throw cause
      }
    })
  })
}

/**
 * One write of a folder's file at a time: two windows remembering steps must
 * not lose each other's. Another folder's file is another turn.
 */
const turns = new Map<string, Promise<unknown>>()

function inTurn(root: string, write: () => Promise<void>): Promise<void> {
  const next = (turns.get(root) ?? Promise.resolve()).then(write, write)
  turns.set(root, next.catch(() => undefined))
  return next
}
