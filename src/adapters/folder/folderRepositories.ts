// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The five repositories over one folder (ADR-0031 §2): what the composition
 * root builds for a folder and hands the app as one value.
 *
 * One folder handle, one history and one place for the person's own settings
 * in; the repositories share what they read of the folder, write one at a
 * time, and answer every contract suite (`folderRepositories.test.ts`, over
 * the fake folder and over a real one with git).
 *
 * What is not here is the folder's own: choosing one, the recent ones,
 * watching one, and pulling, pushing and the remote — the folder provider's
 * chrome and way in (ADR-0022), not a member of any repository.
 */
import type { Diagnostics } from '../../ports/Diagnostics'
import type { Repositories } from '../../ports/Repositories'
import type { DirectoryHandleLike } from './DirectoryHandle'
import { FolderHistory } from './FolderHistory'
import { FolderImageRepository } from './FolderImageRepository'
import { FolderIndex } from './FolderIndex'
import { PictureStaging } from './folderPictures'
import type { StampCache } from './folderPictures'
import { FolderScopeRepository } from './FolderScopeRepository'
import { FolderScopes } from './folderScopes'
import type { PlaceStore } from './folderScopes'
import { FolderSettingsRepository, personSettingsInMemory } from './FolderSettingsRepository'
import type { PersonSettings } from './FolderSettingsRepository'
import type { FolderGit } from './folderGit'
import { StepMemory } from './stepMemory'
import type { StepStore } from './stepMemory'

export type FolderOpening = {
  /** The folder. */
  root: DirectoryHandleLike
  /** Its history. */
  git: FolderGit
  /** Where the person's own settings about it are kept; in memory where not said. */
  person?: PersonSettings
  /** Where a file that will not read, and a picture that could not be kept, are said. */
  diagnostics?: Pick<Diagnostics, 'report'>
  /**
   * Where the step ids it applied are kept between one opening and the next,
   * outside the folder (`desktop/desktopStepStore.ts`); in memory where not said.
   */
  steps?: StepStore
  /** Where the scopes' identities were last found is kept, outside the folder; in memory where not said. */
  places?: PlaceStore
  /** What this machine found the folder's pictures to be, by stamp, kept outside the folder; in memory where not said. */
  stamps?: StampCache
  /** The clock step ids are remembered by. */
  now?: () => number
}

export function folderRepositories(opening: FolderOpening): Repositories {
  const folder = new FolderScopes(opening.root, opening.diagnostics, opening.places, opening.stamps)
  const staging = new PictureStaging()
  const history = new FolderHistory(folder, opening.git)
  return {
    // A move is an entry of the history of every scope it moved (`ScopeRepository.move`).
    scopes: new FolderScopeRepository(folder, new StepMemory(opening.steps, opening.now), staging, (moves) => history.recordMoves(moves)),
    index: new FolderIndex(folder),
    history,
    images: new FolderImageRepository(folder, staging),
    settings: new FolderSettingsRepository(folder, opening.person ?? personSettingsInMemory()),
  }
}
