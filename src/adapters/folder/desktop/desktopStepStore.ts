// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A folder's applied step ids on the desktop: in the app's own data folder,
 * keyed by the folder, over the settings channel (`platform/node/appliedSteps.ts`
 * on the other side) — invisible to the person, alive across a restart, and
 * not carried by a copy of the folder.
 */
import type { DesktopSettings } from '../../desktop/channel'
import type { StampCache } from '../folderPictures'
import type { PlaceStore } from '../folderScopes'
import type { StepStore } from '../stepMemory'

export function desktopStepStore(settings: Pick<DesktopSettings, 'readFolderSteps' | 'writeFolderSteps'>, root: string): StepStore {
  return {
    read: () => settings.readFolderSteps(root),
    write: (steps) => settings.writeFolderSteps(root, steps),
  }
}

/** Where a folder's scopes were last found, on the desktop: beside its applied step ids, in the app's own data folder. */
export function desktopPlaceStore(settings: Pick<DesktopSettings, 'readFolderPlaces' | 'writeFolderPlaces'>, root: string): PlaceStore {
  return {
    read: () => settings.readFolderPlaces(root),
    write: (places) => settings.writeFolderPlaces(root, places),
  }
}

/** What this machine found a folder's pictures to be, on the desktop: in its own data folder, beside the rest. */
export function desktopStampCache(settings: Pick<DesktopSettings, 'readFolderStamps' | 'writeFolderStamps'>, root: string): StampCache {
  return {
    read: () => settings.readFolderStamps(root),
    write: (stamps) => settings.writeFolderStamps(root, stamps),
  }
}
