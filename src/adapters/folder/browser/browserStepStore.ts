// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A browser folder's applied step ids, where its scopes' identities were last
 * found, what its pictures were found to be, and the person's own settings
 * about it — *This is me* among them (ADR-0036 §11) — kept in this browser for
 * the folder (`browserFolder.ts`), one record per entry, and never in the
 * folder. Each lasts through a reload; the step ids are let go of two days
 * after they were applied (`StepMemory`). None of it is the work's, so no
 * export of the work carries it.
 */
import type { Settings } from '../../../projects/settings'
import type { Described, StampCache } from '../folderPictures'
import type { PersonSettings } from '../FolderSettingsRepository'
import type { PlaceStore } from '../folderScopes'
import type { AppliedSteps, StepStore } from '../stepMemory'
import { keptMap } from './browserFolder'
import type { BrowserFolder } from './browserFolder'

export function browserStepStore(folder: BrowserFolder): StepStore {
  return keptMap<AppliedSteps[string]>(folder, 'step')
}

export function browserPlaceStore(folder: BrowserFolder): PlaceStore {
  return keptMap<string>(folder, 'place')
}

export function browserStampCache(folder: BrowserFolder): StampCache {
  return keptMap<Described>(folder, 'stamp')
}

/**
 * The person's own settings about this folder (`SettingsRepository`, `of:
 * 'person'`), kept in this browser as the desktop keeps them in its data
 * folder (ADR-0023): *This is me* outlives a reload and never enters the folder.
 */
export function browserPersonSettings(folder: BrowserFolder): PersonSettings {
  const kept = keptMap<unknown>(folder, 'person')
  return {
    read: async () => (await kept.read() ?? {}) as Settings,
    // Read first, so a setting taken away is taken away here too, whoever read last.
    write: async (next) => {
      await kept.read()
      await kept.write({ ...next })
    },
  }
}
