// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Opening a board is reading it (ADR-0027, amended 8 November 2026), through
 * the whole shell with the real editor, over a folder that holds the example
 * as a person keeps it. The example's boards were written by a machine and lay
 * themselves out the first time they are opened: that layout is written once,
 * in that board's own files, while the status stays where it was, and the
 * list says it was nobody's.
 *
 * Every assertion reads the folder itself, by the stamp each file carries.
 */
import { afterEach, beforeAll, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import acmeLogistics from '../adapters/folder/format/examples/acme-logistics.json' with { type: 'json' }
import { exampleScopes } from '../adapters/folder/format/exampleFolder'
import type { ExampleFolder } from '../adapters/folder/format/exampleFolder'
import { memoryRepositories } from '../adapters/memory/memoryRepositories'
import { FakeDirectory } from '../adapters/folder/fakeDirectory'
import type { DirectoryHandleLike } from '../adapters/folder/FileSystemScopeStore'
import { folderRepositories } from '../adapters/folder/folderRepositories'
import { memoryGit } from '../adapters/folder/memoryGit'
import { EXAMPLE_CATALOGUE } from '../projects/examples/catalogue'
import { exampleCopyOver, keepVisit, placeCopy } from '../projects/examples/copy'
import { readPlace } from '../agent/place'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'
import { placeLanding, readPlaceScope } from './bootLanding'
import { renderApp } from './testing/renderShell'

afterEach(() => cleanup())
beforeAll(() => installReactFlowMocks())

const entry = EXAMPLE_CATALOGUE[0]

/** The example visited, then kept into an empty folder, as a person does. */
async function keptFolder(): Promise<FakeDirectory> {
  const visit = memoryRepositories()
  await placeCopy(visit, await exampleCopyOver(visit.scopes, { ...entry, scopes: exampleScopes(acmeLogistics as ExampleFolder, entry.path) }))
  const root = new FakeDirectory('work')
  const named = { key: entry.key, label: entry.label, description: entry.description, path: entry.path }
  await keepVisit(visit.scopes, folderRepositories({ root, git: memoryGit(root) }), named)
  return root
}

/** Every file in the folder, by its stamp. */
async function stamps(root: FakeDirectory): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const path of root.paths()) {
    const parts = path.split('/')
    let folder: DirectoryHandleLike = root
    for (const part of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(part)
    out[path] = (await (await folder.getFileHandle(parts[parts.length - 1])).getFile()).lastModified
  }
  return out
}

const changedSince = (before: Record<string, number>, after: Record<string, number>) =>
  Object.keys(after).filter((path) => after[path] !== before[path]).sort()

it('lays a board out as it opens, writes only that board, keeps the status, and says it was nobody\'s', async () => {
  const root = await keptFolder()
  const before = await stamps(root)
  const repositories = folderRepositories({ root, git: memoryGit(root) })
  const place = readPlace('#/application-landscape/-/board/landscape')!
  renderApp({ repositories, boot: placeLanding(await readPlaceScope(repositories.scopes, place.scope), place) })

  const said = new Set<string>()
  const status = await screen.findByTestId('saved-indicator')
  const listen = new MutationObserver(() => said.add(status.textContent ?? ''))
  listen.observe(status, { subtree: true, characterData: true, childList: true })
  said.add(status.textContent ?? '')

  await waitFor(async () => {
    expect(changedSince(before, await stamps(root))).toEqual([
      'application-landscape/diagrams/landscape.geometry.json',
      'application-landscape/diagrams/landscape.json',
    ])
  }, { timeout: 15_000 })
  // Past the autosave's wait: nothing else follows the layout.
  await new Promise((resolve) => setTimeout(resolve, 3_500))
  listen.disconnect()
  expect(changedSince(before, await stamps(root))).toEqual([
    'application-landscape/diagrams/landscape.geometry.json',
    'application-landscape/diagrams/landscape.json',
  ])
  const words = [...said].join(' | ')
  expect(words).not.toMatch(/Unsaved|Saving|Saved/)

  fireEvent.click(screen.getByTestId('frame-activity'))
  const list = await screen.findByRole('list', { name: 'Activity' })
  await within(list).findByText('Laid out automatically')
  expect(within(list).queryByText('You')).toBeNull()
}, 40_000)
