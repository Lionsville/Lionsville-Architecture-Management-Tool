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
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import type { HostModel } from '../../model/hostModel'
import type { Principle } from '../../model/principle'
import type { Repositories } from '../../ports/Repositories'
import { translator } from '../../i18n/strings'
import { contentOf, modelsOf, placeWhole, readScope, summaryOf } from '../../projects/scopeAccess'
import { indexScopes } from '../../projects/scopeIndex'
import { adrGate, adrOpenItems } from '../../decisions/adr'
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
    expect(access.placeChoices().map((one) => one.path)).toEqual(['topics/integration', ''])
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
    expect(copying.evaluateChoices('blk-gw').map((one) => one.path)).toEqual(['', 'stock', 'topics/integration'])
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
