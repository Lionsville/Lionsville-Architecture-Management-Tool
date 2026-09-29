// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The folder's repositories held to every suite, over the fake folder with a
 * history kept in memory. The same suites run over a real folder with the
 * machine's own git beside the desktop's handle (`desktop/`).
 */
import { describeHistoryRepository } from '../../ports/HistoryRepository.contract'
import { describeImageRepository } from '../../ports/ImageRepository.contract'
import { describeOrganisationIndex } from '../../ports/OrganisationIndex.contract'
import type { RepositoriesUnderTest } from '../../ports/Repositories.contract'
import { describeScopeRepository } from '../../ports/ScopeRepository.contract'
import { describeSettingsRepository } from '../../ports/SettingsRepository.contract'
import { FakeDirectory } from './fakeDirectory'
import { folderRepositories } from './folderRepositories'
import { memoryGit } from './memoryGit'
import { writeAt } from './handles'
import type { ScopeId } from '../../projects/scopeState'

function overFakeFolder(): RepositoriesUnderTest {
  const root = new FakeDirectory()
  const repositories = folderRepositories({ root, git: memoryGit(root) })
  return {
    repositories,
    // A model.json that is there and is not a model: the scope reads to be looked at, and takes no step.
    spoil: async (scope: ScopeId) => {
      const state = await repositories.scopes.state(scope)
      if (state) await writeAt(root, state.address ? `${state.address}/model.json` : 'model.json', '{ half a write')
    },
  }
}

describeScopeRepository('folder', overFakeFolder)
describeOrganisationIndex('folder', overFakeFolder)
describeHistoryRepository('folder', overFakeFolder)
describeImageRepository('folder', overFakeFolder)
describeSettingsRepository('folder', overFakeFolder)
