// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A folder's scope made one this build cannot read whole, for the suites
 * (`RepositoriesUnderTest.spoil`): a `model.json` that is there and is not a
 * model, or a header a later version of the format wrote — which this build
 * does not open at all, so the scope is addressed by nothing.
 */
import type { Spoiled } from '../../../ports/Repositories.contract'
import type { Repositories } from '../../../ports/Repositories'
import type { ScopeId } from '../../../projects/scopeState'

/** How the suite writes and reads a file of the folder, by its path from the root. */
export type FolderAt = { read(path: string): Promise<string | undefined>; write(path: string, text: string): Promise<void> }

export async function spoilFolder(repositories: Repositories, at: FolderAt, scope: ScopeId, how: Spoiled): Promise<void> {
  const state = await repositories.scopes.state(scope)
  if (!state) return
  const path = (file: string) => (state.address ? `${state.address}/${file}` : file)
  if (how === 'damaged') return at.write(path('model.json'), '{ half a write')
  const header = JSON.parse((await at.read(path('scope.json'))) ?? '{}') as Record<string, unknown>
  return at.write(path('scope.json'), JSON.stringify({ ...header, version: 99 }))
}
