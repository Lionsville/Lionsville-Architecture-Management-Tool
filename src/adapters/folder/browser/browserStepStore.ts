// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A browser folder's applied step ids, where its scopes' identities were last
 * found, and what its pictures were found to be — kept in this browser for
 * the folder (`browserFolder.ts`), one record per entry, and never in the
 * folder. Each lasts through a reload; the step ids are let go of two days
 * after they were applied (`StepMemory`).
 */
import type { Described, StampCache } from '../folderPictures'
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
