// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A folder's applied step ids on the desktop: in the app's own data folder,
 * keyed by the folder, over the settings channel (`platform/node/appliedSteps.ts`
 * on the other side) — invisible to the person, alive across a restart, and
 * not carried by a copy of the folder.
 */
import type { DesktopSettings } from '../../desktop/channel'
import type { StepStore } from '../stepMemory'

export function desktopStepStore(settings: Pick<DesktopSettings, 'readFolderSteps' | 'writeFolderSteps'>, root: string): StepStore {
  return {
    read: () => settings.readFolderSteps(root),
    write: (steps) => settings.writeFolderSteps(root, steps),
  }
}
