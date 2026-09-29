// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where a copy of an example lands, and a copy written: the rule every
 * copier asks — the organisation's page and a process with no screen alike —
 * over the example as it ships, and over repositories in memory.
 */
import { describe, expect, it } from 'vitest'
import acmeLogistics from '../../adapters/folder/format/examples/acme-logistics.json' with { type: 'json' }
import { exampleScopes } from '../../adapters/folder/format/exampleFolder'
import type { ExampleFolder } from '../../adapters/folder/format/exampleFolder'
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import { MemoryStore } from '../../adapters/memory/MemoryStore'
import { spoilKept } from '../../adapters/repositories/testing/spoil'
import type { ScopeSummary } from '../scope'
import { placeWhole, readScope } from '../scopeAccess'
import { emptyContent } from '../scopeState'
import { EXAMPLE_CATALOGUE } from './catalogue'
import { copyExampleInto, exampleCopyOver, placeCopy } from './copy'
import type { ExampleProject } from './copy'

const EXAMPLES: readonly ExampleProject[] = EXAMPLE_CATALOGUE.map((entry) => ({
  ...entry, scopes: exampleScopes(acmeLogistics as ExampleFolder, entry.path),
}))

describe('where a copy lands', () => {
  const example = EXAMPLES[0]
  const root = (over: Partial<ScopeSummary> = {}): ScopeSummary => ({
    path: '', name: '', diagrams: 0, children: [], ...over,
  })

  /** The common case: an empty folder, and somebody who wants to see the tool. */
  it('makes the example the organisation when the root is unnamed and empty', () => {
    const copied = copyExampleInto(example, root())
    expect(copied.map((scope) => scope.path)).toEqual(['', 'application-landscape', 'platforms'])
    expect(copied[0].model.name).toBe('Acme Logistics')
    expect(copied[0].kind).toBe('organisation')
  })

  it('files a copy under a child of the root it lands in, and gives a second one its own address', () => {
    const copied = copyExampleInto(example, root({ name: 'Globex' }))
    expect(copied.map((scope) => scope.path))
      .toEqual(['acme-logistics', 'acme-logistics/application-landscape', 'acme-logistics/platforms'])
    const copied2 = copyExampleInto(example, root({ children: [
      { path: 'retail', name: 'Retail', diagrams: 0, children: [] },
    ] }))
    expect(copied2[0].path).toBe('acme-logistics')
    // Not in the design's sentence; overwriting a board is the unrecoverable one.
    expect(copyExampleInto(example, root({ diagrams: 1 }))[0].path).toBe('acme-logistics')
    const copied3 = copyExampleInto(example, root({ name: 'Globex', children: [
      { path: 'acme-logistics', name: 'Acme Logistics', diagrams: 0, children: [] },
    ] }))
    expect(copied3.map((scope) => scope.path))
      .toEqual(['acme-logistics-2', 'acme-logistics-2/application-landscape', 'acme-logistics-2/platforms'])
  })

  /** No name and no board is not nothing: records in the root are somebody's work. */
  it('files a copy under a child where the root holds records, whatever its listing says', () => {
    expect(copyExampleInto(example, root(), true)[0].path).toBe('acme-logistics')
  })

  /**
   * The content travels; the ADDRESSES in it travel with it (ADR-0012 §3). A
   * stand-in's `ref` is a path, and a copy that carried the old one would land
   * a tree whose every stand-in points at a folder that is not there — which
   * the drift check found the afternoon it existed.
   */
  it('carries the content over unchanged, and re-addresses what is an address', () => {
    const asRoot = copyExampleInto(example, root())
    const asChild = copyExampleInto(example, root({ name: 'Globex' }))
    const withoutRefs = (scope: typeof asRoot[number]) => ({
      ...scope.model,
      elements: scope.model.elements.map(({ ref: _held, ...rest }) => rest),
    })
    expect(withoutRefs(asChild[1])).toEqual(withoutRefs(asRoot[1]))

    const refs = (scope: typeof asRoot[number]) =>
      [...new Set(scope.model.elements.map((e) => e.ref).filter((ref) => ref !== undefined))]
    expect(refs(asRoot[1])).toEqual(['', 'platforms'])
    expect(refs(asChild[1])).toEqual(['acme-logistics', 'acme-logistics/platforms'])
  })
})

describe('a copy over the tree as it is kept', () => {
  const example = EXAMPLES[0]

  it('takes a blank root, and is written whole', async () => {
    const repositories = memoryRepositories()
    const copy = await exampleCopyOver(repositories.scopes, example)
    expect(copy[0].path).toBe('')
    await placeCopy(repositories, copy)
    expect((await readScope(repositories.scopes, ''))?.model.name).toBe('Acme Logistics')
    expect((await readScope(repositories.scopes, 'application-landscape'))?.model.elements.length).toBeGreaterThan(0)
  })

  it('is filed under a scope of its own where the root holds records its listing does not show', async () => {
    const repositories = memoryRepositories()
    await placeWhole(repositories.scopes, '', {
      ...emptyContent(''), model: { ...emptyContent('').model, decisions: [] , elements: [{
        id: 'ledger', kind: 'application', name: 'Ledger', lifecycle: 'live', isManaged: true, aspects: {},
      }] },
    })
    const copy = await exampleCopyOver(repositories.scopes, example)
    expect(copy[0].path).toBe('acme-logistics')
  })

  /** What could not be read of a root may be anything: a later version's organisation reads as nameless and empty here. */
  for (const how of ['later', 'damaged'] as const) {
    it(`is filed under a scope of its own where the root could not be read whole (${how}), and lands nothing over it`, async () => {
      const store = new MemoryStore()
      const repositories = memoryRepositories(store)
      // A root this build knows as nameless and empty, whose content somebody else's build then wrote.
      const root = (await repositories.scopes.tree()).root.id
      await store.transaction(['contents'], 'write', async (tx) => {
        tx.put('contents', root, how === 'later'
          ? { format: 2, model: { name: 'Precious', records: ['NEWER WORK'] }, description: {} }
          : { format: 1, model: 'torn', description: {} })
      })
      expect((await repositories.scopes.tree()).root.name).toBe('')
      const raw = await store.transaction(['contents'], 'read', (tx) => tx.get('contents', root))
      const copy = await exampleCopyOver(repositories.scopes, example)
      expect(copy[0].path).toBe('acme-logistics')
      await placeCopy(repositories, copy)
      expect(await store.transaction(['contents'], 'read', (tx) => tx.get('contents', root))).toEqual(raw)
      expect((await readScope(repositories.scopes, 'acme-logistics'))?.model.name).toBe('Acme Logistics')
    })
  }

  it('lands nothing over a scope that could not be read whole where a copy is filed', async () => {
    const store = new MemoryStore()
    const repositories = memoryRepositories(store)
    await placeWhole(repositories.scopes, '', { ...emptyContent('Globex') })
    const there = await placeWhole(repositories.scopes, 'acme-logistics/application-landscape', emptyContent('Ours'))
    await spoilKept(store, there, 'damaged')
    const copy = await exampleCopyOver(repositories.scopes, example)
    await expect(placeCopy(repositories, copy.map((scope) => ({ ...scope, path: scope.path.replace(/^acme-logistics-2/, 'acme-logistics') }))))
      .rejects.toMatchObject({ key: 'shell.unreadableNotSaved' })
  })
})
