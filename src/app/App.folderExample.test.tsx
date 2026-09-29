// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * An empty folder, taken through the folder's own provider: its root is named
 * after the folder, and the shipped example copied into it is filed under a
 * scope of its own — as the desktop's smoke run finds it on a real disk.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { FakeDirectory } from '../adapters/folder/fakeDirectory'
import { textAt } from '../adapters/folder/handles'
import { RecordingDiagnostics } from '../adapters/memory/RecordingDiagnostics'
import { memoryRepositories } from '../adapters/memory/memoryRepositories'
import { openFolder } from '../providers/folder/openFolder'
import type { Repositories } from '../ports/Repositories'
import { contentOf, placeTogether, readScope } from '../projects/scopeAccess'
import { EXAMPLE_OFFERS } from './composition'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return { ...actual, SolutionDesignEditor: () => <div data-testid="editor" /> }
})

afterEach(() => cleanup())

describe('the example, copied into an empty folder', () => {
  it('lands under a scope of its own, below a root named after the folder', async () => {
    const handle = new FakeDirectory('Architecture')
    const { repositories } = await openFolder({ handle, name: 'Architecture', root: 'Architecture' }, { diagnostics: new RecordingDiagnostics() })
    renderApp({ repositories, examples: EXAMPLE_OFFERS })

    await waitFor(() => expect(screen.getByTestId('organisation-name').textContent).toBe('Architecture'))
    fireEvent.click(await screen.findByTestId('copy-example'))

    await waitFor(async () => expect(await textAt(handle, 'acme-logistics/scope.json')).toBeDefined(), { timeout: 5_000 })
    const header = JSON.parse((await textAt(handle, 'acme-logistics/scope.json'))!) as { name?: string }
    expect(header.name).toBe('Acme Logistics')
    expect((await repositories.scopes.tree()).root.name).toBe('Architecture')
  })

  /**
   * The listing is a read like any other, and a slow one — a busy machine, a
   * folder on a network drive — may answer after the button is pressed. What
   * the copy decides is decided on the tree as it is kept then, not on the
   * screen's tree before it was read, which is empty and nameless.
   */
  it('lands under a scope of its own when pressed before the listing has answered', async () => {
    const handle = new FakeDirectory('Architecture')
    const { repositories } = await openFolder({ handle, name: 'Architecture', root: 'Architecture' }, { diagnostics: new RecordingDiagnostics() })
    let answer!: () => void
    const held = new Promise<void>((resolve) => { answer = resolve })
    let asked = 0
    const scopes = repositories.scopes
    const slow = {
      ...repositories,
      scopes: new Proxy(scopes, {
        get: (target, key) => {
          const value = Reflect.get(target, key, target) as unknown
          if (key !== 'tree' || typeof value !== 'function') return typeof value === 'function' ? value.bind(target) : value
          return async () => {
            asked += 1
            if (asked === 1) await held
            return scopes.tree()
          }
        },
      }),
    }
    renderApp({ repositories: slow, examples: EXAMPLE_OFFERS })

    fireEvent.click(await screen.findByTestId('copy-example'))
    await waitFor(async () => expect(await textAt(handle, 'acme-logistics/scope.json')).toBeDefined(), { timeout: 5_000 })
    answer()
    expect(await textAt(handle, 'scope.json')).toBeUndefined()
  })
})

/**
 * A root with records in it and no name or board — an application an agent
 * added there, a decision left after its only view was removed — is
 * somebody's work. The example is filed under it, and the root keeps what it
 * holds.
 */
describe('the example, copied over a root that holds records but no name or board', () => {
  const work = contentOf({
    path: '',
    model: {
      name: '',
      elements: [{ id: 'wms', kind: 'application', name: 'WMS', lifecycle: 'live', isManaged: true, aspects: {} }],
      relations: [],
      diagrams: [],
      decisions: [{ id: 'adr-1', number: 1, title: 'Keep the WMS', status: 'accepted', date: '2026-09-01', body: 'Kept.', signers: [] }],
    },
    activeDiagramId: '',
    logoLibrary: [],
  }, [])

  const sources: readonly [string, () => Promise<Repositories>][] = [
    ['memory', () => Promise.resolve(memoryRepositories())],
    ['a folder', async () => (await openFolder(
      { handle: new FakeDirectory(''), name: '', root: 'Architecture' }, { diagnostics: new RecordingDiagnostics() },
    )).repositories],
  ]

  for (const [name, open] of sources) {
    it(`files it under a scope of its own, and leaves the root's records, in ${name}`, async () => {
      const repositories = await open()
      await placeTogether(repositories, [{ address: '', content: work }])
      renderApp({ repositories, examples: EXAMPLE_OFFERS })

      fireEvent.click(await screen.findByTestId('copy-example'))
      await waitFor(async () => expect(await readScope(repositories.scopes, 'acme-logistics')).toBeDefined(), { timeout: 5_000 })
      const root = await readScope(repositories.scopes, '')
      expect(root?.model.elements.map((element) => element.id)).toEqual(['wms'])
      expect(root?.model.decisions?.map((decision) => decision.title)).toEqual(['Keep the WMS'])
    })
  }
})
