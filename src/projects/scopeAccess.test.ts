// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { memoryRepositories } from '../adapters/memory/memoryRepositories'
import { ShellError } from '../platform/errors'
import type { Repositories } from '../ports/Repositories'
import {
  changeScope, contentOf, ensureScope, everyScope, keptAt, landed, modelsOf, moveScope, placeTogether, placeWhole, readScope,
  readWhole, stepOf, summaryOf,
} from './scopeAccess'
import type { ScopeSnapshot } from './scope'

async function withAcme(): Promise<{ repositories: Repositories; acme: string }> {
  const repositories = memoryRepositories()
  const acme = landed(await repositories.scopes.create('acme', { name: 'Acme Logistics', kind: 'domain', client: 'Acme' })).id
  return { repositories, acme }
}

const crews = { type: 'element.create', element: { id: 'crews', kind: 'application', name: 'Crews', lifecycle: 'live', isManaged: false, aspects: {} } } as const

describe('the app’s questions about scopes, asked of the repositories', () => {
  it('draws the tree as summaries, each with its identity, and the root first', async () => {
    const { repositories, acme } = await withAcme()
    await repositories.scopes.create('acme/rail', { name: 'Rail' })
    const summary = summaryOf(await repositories.scopes.tree())
    expect(summary.path).toBe('')
    expect(summary.children.map((one) => [one.path, one.id, one.name, one.kind, one.client])).toEqual([
      ['acme', acme, 'Acme Logistics', 'domain', 'Acme'],
    ])
    expect(summary.children[0].children.map((one) => one.path)).toEqual(['acme/rail'])
    expect(summary.unreadable).toBeUndefined()
  })

  it('reads a scope by its address, with its identity and revision, and nothing where none is', async () => {
    const { repositories, acme } = await withAcme()
    const held = await readScope(repositories.scopes, 'acme')
    expect([held?.path, held?.id, held?.model.name, held?.kind, held?.revision]).toEqual(
      ['acme', acme, 'Acme Logistics', 'domain', (await repositories.scopes.state(acme))?.revision],
    )
    expect(held?.logoLibrary).toEqual([])
    expect(await readScope(repositories.scopes, 'globex')).toBeUndefined()
  })

  it('changes a scope by steps expecting what was read, and answers it as it now is', async () => {
    const { repositories } = await withAcme()
    const changed = await changeScope(repositories.scopes, 'acme', () => [crews])
    expect(changed?.model.elements.map((one) => one.id)).toEqual(['crews'])
    expect(await changeScope(repositories.scopes, 'acme', () => undefined)).toEqual(changed)
    expect(await changeScope(repositories.scopes, 'globex', () => [crews])).toBeUndefined()
  })

  it('works a change out again over a scope somebody changed in between', async () => {
    const { repositories, acme } = await withAcme()
    let asked = 0
    const changed = await changeScope(repositories.scopes, 'acme', (held) => {
      asked += 1
      // Somebody else lands a step between this read and the apply, once.
      if (asked === 1) void repositories.scopes.apply([{ scope: acme, steps: [stepOf({ type: 'project.settings', patch: { name: 'Acme' } })] }])
      return held.model.elements.length === 0 ? [crews] : undefined
    })
    expect(asked).toBe(2)
    expect([changed?.model.name, changed?.model.elements.map((one) => one.id)]).toEqual(['Acme', ['crews']])
  })

  it('says a refusal the reducer made with its key', async () => {
    const { repositories } = await withAcme()
    await changeScope(repositories.scopes, 'acme', () => [crews])
    await expect(changeScope(repositories.scopes, 'acme', () => [crews])).rejects.toEqual(new ShellError('command.taken'))
  })

  it('makes a scope where none is, and answers the one that is where one is', async () => {
    const { repositories, acme } = await withAcme()
    expect(await ensureScope(repositories.scopes, 'acme', { name: 'Again' })).toBe(acme)
    const made = await ensureScope(repositories.scopes, 'globex/crews', { name: 'Crews', kind: 'landscape' })
    const tree = summaryOf(await repositories.scopes.tree())
    expect(tree.children.map((one) => one.path)).toEqual(['acme', 'globex'])
    expect(tree.children[1].children.map((one) => [one.id, one.name, one.kind])).toEqual([[made, 'Crews', 'landscape']])
  })

  it('reads the index as the records the fold takes, by address', async () => {
    const { repositories } = await withAcme()
    await changeScope(repositories.scopes, 'acme', () => [crews])
    const models = modelsOf(await repositories.index.read())
    expect(models.map((one) => [one.path, one.model.elements.map((element) => element.id)]).sort()).toEqual([['', []], ['acme', ['crews']]])
  })
})

describe('a content that arrives whole, and a scope moved', () => {
  const example = (path: string): ScopeSnapshot => ({
    path,
    model: { name: 'Crews', elements: [crews.element], relations: [], diagrams: [] },
    activeDiagramId: '',
    logoLibrary: [],
    kind: 'landscape',
    client: 'Acme',
  })

  it('places a content at an address, making the scope and those above it', async () => {
    const repositories = memoryRepositories()
    const id = await placeWhole(repositories.scopes, 'acme/crews', contentOf(example('acme/crews')))
    const held = await readScope(repositories.scopes, 'acme/crews')
    expect([held?.id, held?.model.elements.map((one) => one.id), held?.kind, held?.client]).toEqual([id, ['crews'], 'landscape', 'Acme'])
    expect((await readScope(repositories.scopes, 'acme'))?.model.name).toBe('acme')
  })

  it('places a content over a scope that is there, taking what was there away', async () => {
    const { repositories, acme } = await withAcme()
    await changeScope(repositories.scopes, 'acme', () => [{ ...crews, element: { ...crews.element, id: 'depot' } }])
    expect(await placeWhole(repositories.scopes, 'acme', contentOf(example('acme')))).toBe(acme)
    expect((await readScope(repositories.scopes, 'acme'))?.model.elements.map((one) => one.id)).toEqual(['crews'])
  })

  it('moves a scope with what is under it, and names it anew in the stand-ins that point into it', async () => {
    const { repositories, acme } = await withAcme()
    await placeWhole(repositories.scopes, 'acme/crews', contentOf(example('acme/crews')))
    const standIn = { ...crews.element, ref: 'acme/crews' }
    await placeWhole(repositories.scopes, 'globex', { ...contentOf(example('globex')), model: { name: 'Globex', elements: [standIn], relations: [], diagrams: [] } })
    await placeWhole(repositories.scopes, 'acme/rail', { ...contentOf(example('acme/rail')), model: { name: 'Rail', elements: [standIn], relations: [], diagrams: [] } })
    const moved = await moveScope(repositories.scopes, repositories.index, 'acme', 'group/acme')
    expect([moved?.id, moved?.path]).toEqual([acme, 'group/acme'])
    expect((await readScope(repositories.scopes, 'group/acme/crews'))?.model.elements.map((one) => one.id)).toEqual(['crews'])
    expect((await readScope(repositories.scopes, 'globex'))?.model.elements[0].ref).toBe('group/acme/crews')
    expect((await readScope(repositories.scopes, 'group/acme/rail'))?.model.elements[0].ref).toBe('group/acme/crews')
    expect(await readScope(repositories.scopes, 'acme')).toBeUndefined()
  })

  it('says a move the repository refuses with its key, and moves nothing — not a stand-in either', async () => {
    const { repositories } = await withAcme()
    await placeWhole(repositories.scopes, 'acme/crews', contentOf(example('acme/crews')))
    const standIn = { ...crews.element, ref: 'acme/crews' }
    await placeWhole(repositories.scopes, 'globex', { ...contentOf(example('globex')), model: { name: 'Globex', elements: [standIn], relations: [], diagrams: [] } })
    await expect(moveScope(repositories.scopes, repositories.index, 'acme', 'globex')).rejects.toEqual(new ShellError('shell.scopeTaken'))
    expect((await readScope(repositories.scopes, 'acme'))?.model.name).toBe('Acme Logistics')
    expect((await readScope(repositories.scopes, 'globex'))?.model.elements[0].ref).toBe('acme/crews')
  })
})

describe('contents that arrive together', () => {
  const content = (name: string) => contentOf({
    path: '', model: { name, elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [],
  }, [])

  /** The repositories, with the apply that lands the contents refused — after `meanwhile` has run. */
  function refusing(meanwhile: (repositories: Repositories) => Promise<void> = () => Promise.resolve()) {
    const repositories = memoryRepositories()
    const scopes = new Proxy(repositories.scopes, {
      get: (target, member) => (member === 'apply'
        ? async () => { await meanwhile(repositories); return { refused: 'shell.scopeMoved' } }
        : Reflect.get(target, member)),
    })
    return { repositories, placing: { ...repositories, scopes } }
  }

  it('takes away again the scopes made to hold contents that did not land', async () => {
    const { repositories, placing } = refusing()
    await expect(placeTogether(placing, [{ address: 'globex', content: content('Globex') }])).rejects.toEqual(new ShellError('shell.scopeMoved'))
    expect(await readScope(repositories.scopes, 'globex')).toBeUndefined()
  })

  it('leaves a scope made for them that somebody wrote to in between', async () => {
    const { repositories, placing } = refusing(async (held) => {
      const globex = nodesAt(summaryOf(await held.scopes.tree()), 'globex')
      await held.scopes.apply([{ scope: globex, steps: [stepOf({ type: 'project.settings', patch: { name: 'Globex, as somebody named it' } })] }])
    })
    await expect(placeTogether(placing, [{ address: 'globex', content: content('Globex') }])).rejects.toEqual(new ShellError('shell.scopeMoved'))
    expect((await readScope(repositories.scopes, 'globex'))?.model.name).toBe('Globex, as somebody named it')
  })

  it('keeps a picture where the repository says it put it, not where its bytes would say', async () => {
    const repositories = memoryRepositories()
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])
    const images = { put: () => Promise.resolve({ contentAddress: 'where-the-repository-keeps-it' }) }
    // What the landing would write, heard and refused.
    const landing: unknown[] = []
    const scopes = new Proxy(repositories.scopes, {
      get: (target, member) => (member === 'apply'
        ? (work: unknown) => { landing.push(work); return Promise.resolve({ refused: 'shell.scopeMoved' }) }
        : Reflect.get(target, member)),
    })
    await expect(placeTogether({ scopes, images }, [
      { address: 'globex', content: content('Globex'), pictures: [{ name: 'logo.png', bytes: png }] },
    ])).rejects.toMatchObject({ key: 'shell.scopeMoved' })
    const [[{ steps: [{ command }] }]] = landing as { steps: { command: { type: string; content: { images: { contentAddress: string }[] } } }[] }[][]
    expect(command.content.images.map((image) => image.contentAddress)).toEqual(['where-the-repository-keeps-it'])
  })

  it('expects what the caller checked, so a write since it looked is refused rather than replaced', async () => {
    const repositories = memoryRepositories()
    const globex = landed(await repositories.scopes.create('globex', { name: 'Globex' })).id
    const checked = (await readScope(repositories.scopes, 'globex'))!.revision!
    await repositories.scopes.apply([{ scope: globex, steps: [stepOf({ type: 'project.settings', patch: { name: 'Globex, worked on' } })] }])
    await expect(placeTogether(repositories, [{ address: 'globex', content: content('Globex, arriving'), checked: { revision: checked } }]))
      .rejects.toMatchObject({ key: 'shell.scopeMoved' })
    expect((await readScope(repositories.scopes, 'globex'))?.model.name).toBe('Globex, worked on')
  })

  it('refuses where the caller found nothing and somebody has made a scope there since', async () => {
    const repositories = memoryRepositories()
    await repositories.scopes.create('globex', { name: 'Globex, made meanwhile' })
    await expect(placeTogether(repositories, [{ address: 'globex', content: content('Globex, arriving'), checked: {} }]))
      .rejects.toMatchObject({ key: 'shell.scopeMoved' })
    expect((await readScope(repositories.scopes, 'globex'))?.model.name).toBe('Globex, made meanwhile')
  })
})

/**
 * Every scope in full, pictures and all: what a working set is made of, read
 * out of the repositories — the organisation, or one scope and those under it.
 */
describe('a working set, read whole', () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])
  const scope = (path: string, name: string): ScopeSnapshot => ({
    path, model: { name, elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [],
  })

  async function tree(): Promise<Repositories> {
    const repositories = memoryRepositories()
    await placeTogether(repositories, [
      { address: '', content: contentOf(scope('', 'Acme'), []) },
      { address: 'retail', content: contentOf(scope('retail', 'Retail'), []), pictures: [{ name: 'shop.png', bytes: png }] },
      { address: 'retail/tills', content: contentOf(scope('retail/tills', 'Tills'), []) },
      { address: 'fleet', content: contentOf(scope('fleet', 'Fleet'), []) },
    ])
    return repositories
  }

  it('reads one scope and every scope under it, and no other, when asked from an address', async () => {
    const held = await everyScope(await tree(), 'retail')
    expect(held.map((one) => one.path)).toEqual(['retail', 'retail/tills'])
    expect(held[0].imageLibrary?.map((image) => image.file)).toEqual(['shop.png'])
  })

  it('refuses an address that holds no scope as a scope gone', async () => {
    await expect(everyScope(await tree(), 'nowhere')).rejects.toMatchObject({ key: 'shell.scopeGone' })
  })

  it('refuses, naming it, a scope the tree lists that then does not read', async () => {
    const repositories = await tree()
    const tills = nodesAt(summaryOf(await repositories.scopes.tree()), 'retail')
    const scopes = new Proxy(repositories.scopes, {
      get: (target, member) => (member === 'state'
        ? async (id: string) => (id === tills ? undefined : target.state(id))
        : Reflect.get(target, member)),
    })
    await expect(everyScope({ ...repositories, scopes })).rejects.toMatchObject({ key: 'shell.exportUnreadable', params: { paths: 'retail' } })
  })

  it('reads one scope by its address with its pictures\' bytes, and nothing where none is', async () => {
    const repositories = await tree()
    expect((await readWhole(repositories, 'retail'))?.imageLibrary?.map((image) => image.file)).toEqual(['shop.png'])
    expect(await readWhole(repositories, 'nowhere')).toBeUndefined()
  })

  it('throws the key a picture\'s bytes were refused with', () => {
    expect(() => keptAt({ refused: 'shell.imageBadName' })).toThrow(new ShellError('shell.imageBadName'))
    expect(keptAt({ contentAddress: 'sha256:x' })).toBe('sha256:x')
  })

  it('takes the scope somebody made at the address between the look and the making', async () => {
    const repositories = await tree()
    let theirs: string | undefined
    const scopes = new Proxy(repositories.scopes, {
      get: (target, member) => (member === 'create'
        ? async (at: string, made: { name: string }) => {
          theirs = landed(await target.create(at, { name: `${made.name}, made meanwhile` })).id
          return { refused: 'shell.scopeTaken' }
        }
        : Reflect.get(target, member)),
    })
    expect(await ensureScope(scopes, 'globex', { name: 'Globex' })).toBe(theirs)
  })

  it('moves nothing, and answers nothing, from an address that holds no scope', async () => {
    const repositories = await tree()
    expect(await moveScope(repositories.scopes, repositories.index, 'nowhere', 'elsewhere')).toBeUndefined()
  })
})

function nodesAt(tree: ReturnType<typeof summaryOf>, path: string): string {
  return tree.children.find((one) => one.path === path)!.id!
}

