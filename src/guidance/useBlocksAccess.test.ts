// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The building blocks, wired over the memory repositories (ADR-0043): a
 * block kept in a topic, its requirements written there, evaluated by two
 * scopes — the second copying the first's ratings — and the decision one
 * evaluation becomes, kept in the scope that is choosing; every change a
 * step where the record is kept, under that scope's rights.
 */
import { describe, expect, it, vi } from 'vitest'
import { memoryRepositories } from '../adapters/memory/memoryRepositories'
import type { Comment } from '../model/comment'
import type { HostModel } from '../model/hostModel'
import type { ImageEntry } from '../model/imageName'
import type { Principle } from '../model/principle'
import type { Repositories } from '../ports/Repositories'
import { translator } from '../i18n/strings'
import { contentOf, keptAt, modelsOf, nodeAt, placeWhole, readScope, stepOf, summaryOf } from '../projects/scopeAccess'
import { indexScopes } from '../projects/scopeIndex'
import { adrGate, adrOpenItems } from '../decisions/adr'
import { blocksAccess } from './useBlocksAccess'
import type { BlocksDeps } from './useBlocksAccess'

const DAY = '2026-11-02'
const s = translator('en')

const least: Principle = {
  id: 'pr-1', number: 1, title: 'Least privilege', statement: 'Grant the least.', aspects: [{ id: 'a1', number: 1, text: 'One role per task', nature: 'design' }],
  lastAspect: 1, groups: [], regime: 'flexible', status: 'accepted',
}

async function place(repositories: Repositories, path: string, model: Partial<HostModel> & { name: string }): Promise<void> {
  await placeWhole(repositories.scopes, path, contentOf({ path, model: { elements: [], relations: [], diagrams: [], ...model }, activeDiagramId: '', logoLibrary: [] }))
}

/** The access as a home makes it, over the tree and its index as they are read now. */
async function wired(repositories: Repositories, over: Partial<BlocksDeps> = {}) {
  let id = 0
  const deps: BlocksDeps = {
    tree: summaryOf(await repositories.scopes.tree()),
    index: indexScopes(modelsOf(await repositories.index.read())),
    scopes: repositories.scopes, writable: () => true, written: () => undefined, notify: vi.fn(), today: DAY,
    makeId: (prefix) => `${prefix}-${++id}`, open: vi.fn(), openBlock: vi.fn(), s, ...over,
  }
  return { deps, access: blocksAccess(deps, 1) }
}

const again = async (repositories: Repositories, over: Partial<BlocksDeps> = {}) => (await wired(repositories, over)).access

describe('the building blocks over a home', () => {
  it('keeps a new block in a topic and writes its requirements and catalogue there', async () => {
    const repositories = memoryRepositories()
    await place(repositories, '', { name: 'Acme' })
    await place(repositories, 'topics/integration', { name: 'Integration' })
    const { access } = await wired(repositories)
    // The topics first, under their own heading and counted from their place; then the organisation, at its depth.
    expect(access.placeChoices()).toEqual([
      { path: 'topics/integration', name: 'Integration', depth: 0, topic: true },
      { path: '', name: 'Acme', depth: 0 },
    ])
    const id = await access.create('topics/integration', ' Message gateway ')
    expect(id).toBe('blk-1')
    const made = await again(repositories)
    expect(made.block('blk-1')).toMatchObject({ scope: 'topics/integration', block: { kind: 'buildingBlock', name: 'Message gateway' } })
    made.update('blk-1', {
      capabilities: [{ id: 'cap-route', text: 'Routes by content', must: true }],
      contexts: [{ id: 'cx-partners', name: 'Many partners', needs: { 'cap-route': 4 } }],
      sbbs: [{ id: 'sb-a', name: 'Broker A', sort: 'product', status: 'candidate' }],
    })
    await vi.waitFor(async () => expect((await readScope(repositories.scopes, 'topics/integration'))?.model.elements[0]?.sbbs).toHaveLength(1))
    // A block that does not hold together is refused, and said.
    const notify = vi.fn()
    ;(await again(repositories, { notify })).update('blk-1', { contexts: [{ id: 'cx', name: 'Use', needs: { nope: 2 } }] })
    await vi.waitFor(() => expect(notify).toHaveBeenCalledWith(s('command.badBlock'), 'error'))
  })

  it('reads a block\'s document from the scope that keeps it, and writes a chapter onto that one', async () => {
    const repositories = memoryRepositories()
    await place(repositories, 'topics/integration', {
      name: 'Integration',
      elements: [{ id: 'blk-gw', kind: 'buildingBlock', name: 'Gateway', lifecycle: 'live', isManaged: false, aspects: {}, description: 'What it is.\n' }],
    })
    const { access } = await wired(repositories)
    // The index carries no document; the scope does.
    expect(access.block('blk-gw')?.block.description).toBeUndefined()
    expect(await access.document('blk-gw')).toBe('What it is.\n')
    access.update('blk-gw', (held) => ({ description: `${held.description ?? ''}\n## Regulators\n` }))
    await vi.waitFor(async () => expect(await (await again(repositories)).document('blk-gw')).toBe('What it is.\n\n## Regulators\n'))
    expect(await access.document('blk-none')).toBeUndefined()
  })

  it('says a document that could not be read', async () => {
    const repositories = memoryRepositories()
    await place(repositories, 'topics/integration', { name: 'Integration', elements: [{ id: 'blk-gw', kind: 'buildingBlock', name: 'Gateway', lifecycle: 'live', isManaged: false, aspects: {} }] })
    const notify = vi.fn()
    const { access } = await wired(repositories, { notify, scopes: { ...repositories.scopes, state: () => Promise.reject(new Error('down')) } })
    expect(await access.document('blk-gw')).toBeUndefined()
    expect(notify).toHaveBeenCalledWith(s('blocks.documentUnread'), 'error')
  })

  it('evaluates a block in a scope, copies the ratings into another, and proposes the decision there', async () => {
    const repositories = memoryRepositories()
    await place(repositories, '', { name: 'Acme', principles: [least] })
    await place(repositories, 'topics/integration', {
      name: 'Integration',
      elements: [{
        id: 'blk-gw', kind: 'buildingBlock', name: 'Message gateway', lifecycle: 'live', isManaged: false, aspects: {},
        capabilities: [{ id: 'cap-route', text: 'Routes by content' }, { id: 'cap-audit', text: 'Keeps an audit trail', must: true }],
        contexts: [{ id: 'cx-partners', name: 'Many partners', needs: { 'cap-route': 4, 'cap-audit': 2 } }],
        sbbs: [{ id: 'sb-a', name: 'Broker A', sort: 'product', status: 'candidate' }, { id: 'sb-b', name: 'Managed bus', sort: 'service', status: 'candidate' }],
      }],
      citations: [{ id: 'ci-1', about: { kind: 'element', id: 'blk-gw' }, principle: { scope: '', id: 'pr-1' }, stance: 'supports', on: DAY }],
    })
    await place(repositories, 'sales', { name: 'Sales' })
    await place(repositories, 'stock', { name: 'Stock' })
    const { access } = await wired(repositories)
    expect(access.citationsOf('blk-gw')).toEqual([{ label: 'PR-0001 Least privilege', stance: 'supports' }])
    expect(await access.evaluate('blk-gw', 'sales', ['cx-partners'])).toBe(true)
    const sales = await again(repositories)
    const held = sales.evaluationsOf('blk-gw')[0]!
    expect(held).toMatchObject({ scope: 'sales', evaluation: { id: 'topics.integration~blk-gw', contexts: ['cx-partners'], options: [] } })
    sales.updateEvaluation('sales', {
      ...held.evaluation, options: ['sb-a', 'sb-b'],
      coverage: { 'sb-a': { 'cap-route': { level: 4 }, 'cap-audit': { level: 2 } }, 'sb-b': { 'cap-route': { level: 2 }, 'cap-audit': { level: 4 } } },
    })
    await vi.waitFor(async () => expect((await again(repositories)).evaluationsOf('blk-gw')[0]?.evaluation.options).toEqual(['sb-a', 'sb-b']))
    // The second scope starts from the first's ratings; its own from then on.
    const copying = await again(repositories)
    // Every scope of the organisation that has not yet, at its depth; a topic adopts nothing.
    expect(copying.evaluateChoices('blk-gw')).toEqual([{ path: '', name: 'Acme', depth: 0 }, { path: 'stock', name: 'Stock', depth: 1 }])
    expect(await copying.evaluate('blk-gw', 'stock', [], 'sales')).toBe(true)
    const stock = (await again(repositories)).evaluationsOf('blk-gw').find((one) => one.scope === 'stock')!.evaluation
    expect([stock.contexts, stock.options, stock.coverage['sb-a']?.['cap-route']]).toEqual([[], ['sb-a', 'sb-b'], { level: 4 }])

    const decision = await (await again(repositories)).propose('sales', 'blk-gw', 'sb-b')
    expect(decision).toBeDefined()
    const kept = (await readScope(repositories.scopes, 'sales'))!.model
    const made = kept.decisions!.find((one) => one.id === decision)!
    expect(made).toMatchObject({ status: 'proposed', title: 'Choose Managed bus as Message gateway for Sales', chooses: { evaluation: 'topics.integration~blk-gw', option: 'sb-b' } })
    expect(made.body).toContain('* Managed bus \u2014 67 %\n* Broker A \u2014 fails a must')
    expect(made.body).toContain('Chosen option: Managed bus, which covers 67 % of what is needed here.')
    expect(made.body).toContain('* Routes by content: needed at 4 of 4 here')
    expect(made.body).toContain('```ref\nevaluation: blk-gw\nscope: sales\nat: ')
    // What the person still writes before it may be accepted: a consequence, and an approval.
    expect(adrOpenItems(adrGate({ ...made, signers: [{ name: 'Ada', verdict: 'approved' }] }, 'accepted'))).toEqual(['consequence'])
    // The block's citations are the decision's, as supports.
    expect(kept.citations).toEqual([expect.objectContaining({ about: { kind: 'decision', id: decision }, principle: { scope: '', id: 'pr-1' }, stance: 'supports' })])
  })

  it('refuses an evaluation the person may not write, and says so', async () => {
    const repositories = memoryRepositories()
    await place(repositories, 'topics/integration', { name: 'Integration', elements: [{ id: 'blk-gw', kind: 'buildingBlock', name: 'Gateway', lifecycle: 'live', isManaged: false, aspects: {} }] })
    await place(repositories, 'sales', { name: 'Sales' })
    const notify = vi.fn()
    const { access } = await wired(repositories, { writable: (path) => path !== 'sales', notify })
    expect(await access.evaluate('blk-gw', 'sales', [])).toBe(false)
    expect(notify).toHaveBeenCalledWith(s('shell.scopeReadOnly'), 'error')
    expect(access.mayWrite('sales')).toBe(false)
  })

  it('lists the blocks a home keeps and those it evaluates, and removes an evaluation', async () => {
    const repositories = memoryRepositories()
    await place(repositories, 'topics/integration', { name: 'Integration', elements: [{ id: 'blk-gw', kind: 'buildingBlock', name: 'Gateway', lifecycle: 'live', isManaged: false, aspects: {} }] })
    await place(repositories, 'sales/web', { name: 'Web' })
    const { access } = await wired(repositories)
    await access.evaluate('blk-gw', 'sales/web', [])
    const now = await again(repositories)
    expect(now.blocksAt('sales')).toEqual({ kept: [], evaluated: [now.block('blk-gw')] })
    expect(now.blocksAt('topics')).toEqual({ kept: [now.block('blk-gw')], evaluated: [] })
    now.removeEvaluation('sales/web', 'topics.integration~blk-gw')
    await vi.waitFor(async () => expect((await again(repositories)).evaluationsOf('blk-gw')).toEqual([]))
  })

  it('opens a decision on its scope\'s page and a block\'s page over the home', async () => {
    const repositories = memoryRepositories()
    const { access, deps } = await wired(repositories)
    access.openDecision('sales', 'adr-3')
    access.openBlock('blk-gw', 'sales')
    expect(deps.open).toHaveBeenCalledWith('sales', { page: 'decisions', id: 'adr-3' })
    expect(deps.openBlock).toHaveBeenCalledWith('blk-gw', 'sales')
  })
})

describe('a comparison carried out', () => {
  it('goes through the host\'s clipboard and its save, each said done or not, and is not offered where the host hands neither', async () => {
    const repositories = memoryRepositories()
    await place(repositories, '', { name: 'Acme' })
    const copyText = vi.fn(async () => undefined)
    const saveDocument = vi.fn(async () => undefined)
    const { deps, access } = await wired(repositories, { copyText, saveDocument })
    access.copyText!('a\tb\n')
    access.saveCsv!('gateway-sales.csv', 'a,b\n')
    expect(copyText).toHaveBeenCalledWith('a\tb\n')
    expect(saveDocument).toHaveBeenCalledWith({ name: 'gateway-sales.csv', mediaType: 'text/csv', text: 'a,b\n' })
    await vi.waitFor(() => expect(deps.notify).toHaveBeenCalledTimes(2))
    expect(deps.notify).toHaveBeenCalledWith(s('blocks.tableCopied'), 'success')
    expect(deps.notify).toHaveBeenCalledWith(s('blocks.csvSaved', { name: 'gateway-sales.csv' }), 'success')
    const bare = await again(repositories)
    expect(bare.copyText).toBeUndefined()
    expect(bare.saveCsv).toBeUndefined()
  })

  it('says a copy the host refused', async () => {
    const repositories = memoryRepositories()
    await place(repositories, '', { name: 'Acme' })
    const { deps, access } = await wired(repositories, { copyText: vi.fn(async () => { throw new Error('denied') }) })
    access.copyText!('x')
    await vi.waitFor(() => expect(deps.notify).toHaveBeenCalledWith(s('blocks.tableCopyFailed'), 'error'))
  })
})

describe('a building block moved to another topic', () => {
  const AT = '2026-11-20T09:00:00.000Z'
  const asked: Comment = { id: 'cm-1', about: { kind: 'element', id: 'blk-gw' }, by: { person: 'pe-1' }, at: AT, body: 'Who runs this?' }
  const BYTES = new Uint8Array([1, 2, 3])

  /** A topic keeping a cited, commented block whose document shows a picture of that topic; two scopes compare it, one decided. */
  async function organisation(): Promise<{ repositories: Repositories; picture: ImageEntry }> {
    const repositories = memoryRepositories()
    await place(repositories, '', { name: 'Acme', principles: [least] })
    await place(repositories, 'topics/integration', {
      name: 'Integration',
      elements: [{
        id: 'blk-gw', kind: 'buildingBlock', name: 'Message gateway', lifecycle: 'live', isManaged: false, aspects: {},
        description: 'What it is.\n\n![Routing](image:routing.png)\n',
        capabilities: [{ id: 'cap-route', text: 'Routes by content' }],
        contexts: [{ id: 'cx-partners', name: 'Many partners', needs: { 'cap-route': 4 } }],
        sbbs: [{ id: 'sb-a', name: 'Broker A', sort: 'product', status: 'candidate' }],
      }],
      citations: [{ id: 'ci-1', about: { kind: 'element', id: 'blk-gw' }, principle: { scope: '', id: 'pr-1' }, stance: 'supports', on: DAY }],
      comments: [asked],
    })
    await place(repositories, 'topics/security', { name: 'Security' })
    await place(repositories, 'sales', { name: 'Sales' })
    await place(repositories, 'stock', { name: 'Stock' })
    const topic = nodeAt(await repositories.scopes.tree(), 'topics/integration')!.id
    const picture: ImageEntry = { name: 'routing.png', mediaType: 'image/png', size: BYTES.length, width: 4, height: 3, contentAddress: keptAt(await repositories.images.put(topic, 'routing.png', BYTES)) }
    await repositories.scopes.apply([{ scope: topic, steps: [stepOf({ type: 'image.add', image: picture })] }])
    const { access } = await wired(repositories)
    await access.evaluate('blk-gw', 'sales', ['cx-partners'])
    await access.evaluate('blk-gw', 'stock', [])
    const sales = (await again(repositories)).evaluationsOf('blk-gw').find((one) => one.scope === 'sales')!.evaluation
    ;(await again(repositories)).updateEvaluation('sales', { ...sales, options: ['sb-a'], coverage: { 'sb-a': { 'cap-route': { level: 4 } } } })
    await vi.waitFor(async () => expect((await readScope(repositories.scopes, 'sales'))?.model.evaluations?.[0]?.options).toEqual(['sb-a']))
    await (await again(repositories)).propose('sales', 'blk-gw', 'sb-a')
    return { repositories, picture }
  }

  const idOf = async (repositories: Repositories, path: string) => nodeAt(await repositories.scopes.tree(), path)!.id

  it('keeps it in the target with its document, citations, thread and pictures, every comparison naming its new place, written as one with the target first', async () => {
    const { repositories, picture } = await organisation()
    const apply = vi.spyOn(repositories.scopes, 'apply')
    const written = vi.fn()
    const { access, deps } = await wired(repositories, { images: repositories.images, written })
    expect(await access.move('blk-gw', 'topics/security')).toBe(true)
    expect(deps.notify).toHaveBeenCalledWith(s('blocks.moved', { name: 'Message gateway', scope: 'Security' }), 'success')
    expect(written).toHaveBeenCalledTimes(1)
    // One apply: the target, the scopes that compare it, the source last.
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply.mock.calls[0][0].map((work) => work.scope)).toEqual(await Promise.all(['topics/security', 'sales', 'stock', 'topics/integration'].map((path) => idOf(repositories, path))))

    const now = await again(repositories)
    expect(now.block('blk-gw')?.scope).toBe('topics/security')
    expect(await now.document('blk-gw')).toBe('What it is.\n\n![Routing](image:routing.png)\n')
    expect(now.citationsOf('blk-gw')).toEqual([{ label: 'PR-0001 Least privilege', stance: 'supports' }])
    const target = (await readScope(repositories.scopes, 'topics/security'))!
    expect(target.model.comments).toEqual([{ ...asked, from: { kind: 'element', id: 'blk-gw', scope: 'topics/integration' } }])
    expect(target.images).toEqual([picture])
    expect((await repositories.images.bytes(target.id!, 'routing.png'))?.bytes).toEqual(BYTES)
    const source = (await readScope(repositories.scopes, 'topics/integration'))!
    expect([source.model.elements, source.model.comments ?? [], source.model.citations ?? []]).toEqual([[], [], []])
    // The source keeps its picture: other documents there may show it.
    expect(source.images).toEqual([picture])

    expect(now.evaluationsOf('blk-gw').map((one) => [one.scope, one.evaluation.id, one.evaluation.block.scope])).toEqual([
      ['sales', 'topics.security~blk-gw', 'topics/security'], ['stock', 'topics.security~blk-gw', 'topics/security'],
    ])
    const sales = (await readScope(repositories.scopes, 'sales'))!.model
    expect(sales.evaluations![0]).toMatchObject({ contexts: ['cx-partners'], options: ['sb-a'], coverage: { 'sb-a': { 'cap-route': { level: 4 } } } })
    // The decision proposed from the comparison still chooses in it, so accepting it writes the choice.
    expect(sales.decisions![0].chooses).toEqual({ evaluation: 'topics.security~blk-gw', option: 'sb-a' })
    // And moved back, it comes home: the thread says no other place.
    expect(await now.move('blk-gw', 'topics/integration')).toBe(true)
    expect((await readScope(repositories.scopes, 'topics/integration'))!.model.comments).toEqual([asked])
  })

  it('writes nothing where the person may not change a scope that compares it, and names that scope', async () => {
    const { repositories } = await organisation()
    const apply = vi.spyOn(repositories.scopes, 'apply')
    const put = vi.spyOn(repositories.images, 'put')
    const { access, deps } = await wired(repositories, { images: repositories.images, writable: (path) => path !== 'stock' })
    expect(await access.move('blk-gw', 'topics/security')).toBe(false)
    expect(deps.notify).toHaveBeenCalledWith(s('blocks.moveNotAllowed', { scope: 'Stock' }), 'error')
    expect([apply.mock.calls.length, put.mock.calls.length]).toEqual([0, 0])
    expect((await again(repositories)).block('blk-gw')?.scope).toBe('topics/integration')
    // The source and the target are asked the same way.
    for (const closed of ['topics/integration', 'topics/security']) {
      const one = await wired(repositories, { images: repositories.images, writable: (path) => path !== closed })
      expect(await one.access.move('blk-gw', 'topics/security')).toBe(false)
    }
    expect(apply).not.toHaveBeenCalled()
  })

  it('says a refusal of the plan and one of the place work is kept, and writes nothing', async () => {
    const { repositories } = await organisation()
    const { access, deps } = await wired(repositories, { images: repositories.images })
    expect(await access.move('blk-gw', 'topics/integration')).toBe(false)
    expect(deps.notify).toHaveBeenLastCalledWith(s('blocks.moveSameScope', { scope: 'Integration' }), 'error')
    expect(await access.move('blk-none', 'topics/security')).toBe(false)
    // A scope the tree no longer holds, though the dialog offered it.
    expect(await access.move('blk-gw', 'topics/gone')).toBe(false)
    expect(deps.notify).toHaveBeenLastCalledWith(s('blocks.moveUnknownScope', { scope: 'gone' }), 'error')
    // The place refuses the write: its own key is said, and the block stays.
    vi.spyOn(repositories.scopes, 'apply').mockResolvedValueOnce({ refused: 'shell.scopeReadOnly' })
    expect(await access.move('blk-gw', 'topics/security')).toBe(false)
    expect(deps.notify).toHaveBeenLastCalledWith(s('shell.scopeReadOnly'), 'error')
    expect((await again(repositories)).block('blk-gw')?.scope).toBe('topics/integration')
    // The target already defines the id.
    await place(repositories, 'topics/security', { name: 'Security', elements: [{ id: 'blk-gw', kind: 'buildingBlock', name: 'Another', lifecycle: 'live', isManaged: false, aspects: {} }] })
    expect(await access.move('blk-gw', 'topics/security')).toBe(false)
    expect(deps.notify).toHaveBeenLastCalledWith(s('blocks.moveTaken', { scope: 'Security' }), 'error')
  })

  it('refuses a block whose document shows pictures where the host hands none, rather than leave them behind', async () => {
    const { repositories } = await organisation()
    const { access, deps } = await wired(repositories)
    expect(await access.move('blk-gw', 'topics/security')).toBe(false)
    expect(deps.notify).toHaveBeenLastCalledWith(s('blocks.movePicturesStay'), 'error')
    expect((await again(repositories)).block('blk-gw')?.scope).toBe('topics/integration')
    // The same picture already in the target: nothing to take along, so it moves.
    const { picture } = { picture: (await readScope(repositories.scopes, 'topics/integration'))!.images![0] }
    const target = await idOf(repositories, 'topics/security')
    await repositories.images.put(target, picture.name, BYTES)
    await repositories.scopes.apply([{ scope: target, steps: [stepOf({ type: 'image.add', image: picture })] }])
    expect(await (await again(repositories)).move('blk-gw', 'topics/security')).toBe(true)
  })

  it('leaves a stand-in where a view of the source draws it', async () => {
    const repositories = memoryRepositories()
    const gateway = { id: 'blk-gw', kind: 'buildingBlock' as const, name: 'Gateway', lifecycle: 'live' as const, isManaged: false, aspects: {}, description: 'What it is.\n' }
    await place(repositories, 'topics/integration', {
      name: 'Integration', elements: [gateway],
      diagrams: [{ id: 'board', kind: 'layer7', name: 'Board', members: [{ id: 'blk-gw' }], geometry: { nodes: [{ id: 'blk-gw', x: 0, y: 0 }] } }],
    })
    await place(repositories, 'sales', { name: 'Sales' })
    const { access } = await wired(repositories)
    expect(await access.move('blk-gw', 'sales')).toBe(true)
    const source = (await readScope(repositories.scopes, 'topics/integration'))!.model
    expect(source.elements).toEqual([{ id: 'blk-gw', kind: 'buildingBlock', name: 'Gateway', ref: 'sales', lifecycle: 'live', isManaged: false, aspects: {} }])
    expect(source.diagrams[0].members).toEqual([{ id: 'blk-gw' }])
    const now = await again(repositories)
    expect(now.block('blk-gw')?.scope).toBe('sales')
    expect(await now.document('blk-gw')).toBe('What it is.\n')
  })
})
