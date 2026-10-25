// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The topics, wired over the memory repositories (ADR-0042): a topic made
 * under the topics place, made on first use; a link written from either end
 * as a step in the topic, under its rights; stopped, ended and carried by a
 * move; and a removal refused while the topic keeps anything.
 */
import { describe, expect, it, vi } from 'vitest'
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import type { HostModel } from '../../model/hostModel'
import type { Principle } from '../../model/principle'
import type { Repositories } from '../../ports/Repositories'
import { contentOf, placeWhole, readScope, summaryOf } from '../../projects/scopeAccess'
import type { ScopePrinciples } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { translator } from '../../i18n/strings'
import { topicsAccess } from './useTopicsAccess'
import type { TopicsDeps } from './useTopicsAccess'
import type { TopicsAccess } from './TopicsContext'

const DAY = '2026-11-02'
const s = translator('en')

const model = (name: string): HostModel => ({ name, elements: [], relations: [], diagrams: [] })

async function place(repositories: Repositories, path: string, name: string): Promise<void> {
  await placeWhole(repositories.scopes, path, contentOf({ path, model: model(name), activeDiagramId: '', logoLibrary: [] }))
}

const principle: Principle = {
  id: 'pr-1', number: 1, title: 'Least privilege', statement: 'Grant the least.', aspects: [{ id: 'a1', number: 1, text: 'One role per task', nature: 'design' }],
  lastAspect: 1, groups: [], regime: 'flexible', status: 'accepted',
}

/** The access as the home makes it, read again after every write, as the home is. */
async function wired(repositories: Repositories, over: Partial<TopicsDeps> = {}) {
  const notify = vi.fn()
  const keptPrinciples = new Map<ScopePath, ScopePrinciples>()
  const deps: TopicsDeps = {
    tree: summaryOf(await repositories.scopes.tree()),
    principlesAt: (path) => keptPrinciples.get(path) ?? { principles: [], groups: [] },
    scopes: repositories.scopes, index: repositories.index, writable: () => true, written: () => undefined,
    notify, today: DAY, open: vi.fn(), goHome: vi.fn(), openCatalogue: vi.fn(), s, ...over,
  }
  const again = async (): Promise<TopicsAccess> => topicsAccess({ ...deps, tree: summaryOf(await repositories.scopes.tree()) }, 1)
  return { deps, notify, keptPrinciples, again, access: await again() }
}

/** Writes from the access settle on their own; a test waits for the tree to say it. */
async function settled(): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('the topics over a home', () => {
  it('makes a topic under the Topics place, made on first use, relevant from today to the scopes picked', async () => {
    const repositories = memoryRepositories()
    await place(repositories, 'sales', 'Sales')
    const { access, again } = await wired(repositories)
    expect(access.list()).toEqual([])
    const made = await access.create('Security', undefined, ['sales'])
    expect(made).toBe('topics/security')
    const topics = await readScope(repositories.scopes, 'topics')
    expect([topics?.model.name, topics?.kind]).toEqual(['Topics', 'domain'])
    const now = await again()
    expect(now.list()).toEqual([{ id: 'topics/security', name: 'Security', links: [{ path: 'sales', from: DAY }] }])
    expect(now.relevantAt('sales').map((one) => one.id)).toEqual(['topics/security'])
    expect(now.treeRows('sales').map((one) => one.id)).toEqual(['topics/security'])
    // Topics are not offered as places a topic is relevant to; the place is not either.
    expect(now.scopeChoices().map((one) => one.path)).toEqual(['', 'sales'])
    // A subtopic, under its topic.
    expect(await now.create('Identity', 'topics/security')).toBe('topics/security/identity')
    expect((await again()).get('topics/security/identity')).toMatchObject({ parent: 'topics/security', links: [] })
  })

  it('writes a link from either end as a step in the topic, stops it from today, and says a refusal', async () => {
    const repositories = memoryRepositories()
    await place(repositories, 'sales', 'Sales')
    await place(repositories, 'topics/security', 'Security')
    const { access, again, notify } = await wired(repositories)
    access.relate('topics/security', 'sales')
    await settled()
    expect((await readScope(repositories.scopes, 'topics/security'))?.relevantTo).toEqual([{ path: 'sales', from: DAY }])
    ;(await again()).stopHere('topics/security', 'sales')
    await settled()
    // Made today, stopped today: it never held, and goes.
    expect((await readScope(repositories.scopes, 'topics/security'))?.relevantTo).toBeUndefined()

    const closed = await wired(repositories, { writable: (path) => path !== 'topics/security' })
    closed.access.relate('topics/security', 'sales')
    await settled()
    expect(closed.notify).toHaveBeenCalledWith(s('shell.scopeReadOnly'), 'error')
    expect(closed.access.mayWrite('topics/security')).toBe(false)
    expect(notify).not.toHaveBeenCalled()
  })

  it('ends a link on its last day and keeps it, and carries the link when the scope it names moves', async () => {
    const repositories = memoryRepositories()
    await place(repositories, 'sales', 'Sales')
    await place(repositories, 'markets', 'Markets')
    await place(repositories, 'topics/security', 'Security')
    const { access, again } = await wired(repositories)
    access.relate('topics/security', 'sales', '2026-01-01')
    await settled()
    const link = (await again()).get('topics/security')!.links[0]!
    ;(await again()).endLink('topics/security', link, '2026-10-31')
    await settled()
    expect((await readScope(repositories.scopes, 'topics/security'))?.relevantTo).toEqual([{ path: 'sales', from: '2026-01-01', until: '2026-10-31' }])

    // A topic moved under another keeps its links; a scope a link names, moved, is followed.
    const { access: moving } = await wired(repositories)
    moving.update('topics/security', { name: 'Security', description: 'Who may do what', parent: '' })
    await settled()
    const { moveScopeUnder } = await import('../../projects/scopeTree')
    await moveScopeUnder(repositories.scopes, repositories.index, 'sales', 'markets')
    expect((await readScope(repositories.scopes, 'topics/security'))).toMatchObject({
      model: { description: 'Who may do what' }, relevantTo: [{ path: 'markets/sales', from: '2026-01-01', until: '2026-10-31' }],
    })
  })

  it('files a topic under another, and back under the place, with its links', async () => {
    const repositories = memoryRepositories()
    await place(repositories, 'topics/security', 'Security')
    await place(repositories, 'topics/data', 'Data')
    const { access, again } = await wired(repositories)
    access.relate('topics/data', '')
    await settled()
    ;(await again()).update('topics/data', { name: 'Data', description: '', parent: 'topics/security' })
    await settled()
    const under = await again()
    expect(under.get('topics/security/data')).toMatchObject({ parent: 'topics/security', links: [{ path: '', from: DAY }] })
    under.update('topics/security/data', { name: 'Data', description: '', parent: '' })
    await settled()
    expect((await again()).get('topics/data')).toMatchObject({ links: [{ path: '', from: DAY }] })
  })

  it('removes a topic that keeps nothing, and refuses one that keeps a principle or a subtopic', async () => {
    const repositories = memoryRepositories()
    await place(repositories, 'topics/security', 'Security')
    await place(repositories, 'topics/security/identity', 'Identity')
    await place(repositories, 'topics/data', 'Data')
    const { access, keptPrinciples, again } = await wired(repositories)
    keptPrinciples.set('topics/data', { principles: [principle], groups: [] })
    expect(access.keeps('topics/security')).toEqual({ principles: 0, blocks: 0, subtopics: 1 })
    expect(await access.remove('topics/security')).toBe(false)
    expect(await access.remove('topics/data')).toBe(false)
    expect(await access.remove('topics/security/identity')).toBe(true)
    expect((await again()).list().map((one) => one.id)).toEqual(['topics/data', 'topics/security'])
  })

  it('opens a topic\'s principles, its home and the catalogue where the home says', async () => {
    const repositories = memoryRepositories()
    const { access, deps } = await wired(repositories)
    access.openPrinciples('topics/security')
    access.openHome('topics/security')
    access.openCatalogue('topics/security')
    expect(deps.open).toHaveBeenCalledWith('topics/security', { page: 'principles' })
    expect(deps.goHome).toHaveBeenCalledWith('topics/security')
    expect(deps.openCatalogue).toHaveBeenCalledWith('topics/security')
  })
})
