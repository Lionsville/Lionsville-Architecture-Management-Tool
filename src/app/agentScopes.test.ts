// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The tree of scopes as the desktop lends it to the agent (ADR-0040 §3),
 * over the memory repositories: the scope open is the session's to change,
 * a scope the person may not write is refused before anything is built, the
 * repository's refusals arrive as the agent's keys, and a removal that took
 * work with it is said on the person's screen.
 */
import { describe, expect, it } from 'vitest'
import { memoryRepositories } from '../adapters/memory/memoryRepositories'
import { translator } from '../i18n'
import type { HostModel } from '../model/hostModel'
import type { Repositories } from '../ports/Repositories'
import { contentOf, modelsOf, placeWhole, readScope, summaryOf } from '../projects/scopeAccess'
import { flattenScopes } from '../projects/scope'
import { indexScopes } from '../projects/scopeIndex'
import type { ScopeIndex } from '../projects/scopeIndex'
import { scopesViewOver } from './agentScopes'
import type { AgentScopesDeps } from './agentScopes'

const s = translator('en')
const model = (name: string, over: Partial<HostModel> = {}): HostModel => ({ name, elements: [], relations: [], diagrams: [], ...over })

async function place(repositories: Repositories, path: string, held: HostModel) {
  await placeWhole(repositories.scopes, path, contentOf({ path, model: held, activeDiagramId: '', logoLibrary: [] }))
}

async function organisation() {
  const repositories = memoryRepositories()
  await place(repositories, 'acme', model('Acme'))
  await place(repositories, 'acme/rail', model('Rail', {
    diagrams: [{ id: 'board', kind: 'layer7', name: 'Rail board', members: [], geometry: { nodes: [] } }],
  }))
  await place(repositories, 'globex', model('Globex'))
  let index: ScopeIndex = indexScopes(modelsOf(await repositories.index.read()))
  let listing: string[] = []
  const notices: [string, string][] = []
  let changed = 0
  const deps = (over: Partial<AgentScopesDeps> = {}): AgentScopesDeps => ({
    repositories,
    index: () => index,
    writable: () => true,
    openPath: () => undefined,
    treeChanged: () => {
      changed += 1
      void repositories.scopes.tree().then((tree) => { listing = flattenScopes(summaryOf(tree)).map((one) => one.path) })
      void repositories.index.read().then((read) => { index = indexScopes(modelsOf(read)) })
    },
    listed: () => listing,
    boardName: () => 'Landscape',
    today: () => '2026-10-18',
    notify: (message, severity) => notices.push([severity, message]),
    client: () => 'Claude Code',
    s,
    ...over,
  })
  return { repositories, deps, notices, changed: () => changed }
}

describe('the tree lent to the agent on the desktop', () => {
  it('reads a scope with what it holds and what is filed under it', async () => {
    const { deps } = await organisation()
    const view = scopesViewOver(deps())
    const acme = await view.read('acme')
    expect([acme?.name, acme?.below, acme?.hiddenBelow, acme?.holds.views]).toEqual(['Acme', ['acme/rail'], 0, 0])
    expect((await view.read('acme/rail'))?.holds.viewNames).toEqual(['Rail board'])
    expect(await view.read('nowhere')).toBeUndefined()
  })

  it('makes a scope, and answers once the listing the next call reads has it', async () => {
    const { deps, repositories, changed } = await organisation()
    const view = scopesViewOver(deps())
    const made = await view.create({ parent: 'globex', name: 'Yard', withBoard: true })
    expect(made).toMatchObject({ path: 'globex/yard', name: 'Yard', kind: 'landscape', board: { id: 'landscape', name: 'Landscape' } })
    expect('revision' in made && made.revision).toBe((await readScope(repositories.scopes, 'globex/yard'))?.revision)
    expect(changed()).toBe(1)
    expect(await view.create({ parent: 'nowhere', name: 'Yard', withBoard: false })).toEqual({ refused: 'agent.unknownScope', scope: 'nowhere' })
  })

  it('leaves the open scope\'s place in the tree to its session: describe it, move or remove it or one above it from a home', async () => {
    const { deps } = await organisation()
    const view = scopesViewOver(deps({ openPath: () => 'acme/rail' }))
    expect(await view.describe('acme/rail', { name: 'Rails' })).toEqual({ refused: 'scope.isOpen', scope: 'acme/rail' })
    expect(await view.move('acme/rail', 'globex')).toEqual({ refused: 'scope.isOpen', scope: 'acme/rail' })
    expect(await view.move('acme', 'globex')).toEqual({ refused: 'scope.isOpen', scope: 'acme' })
    expect(await view.remove('acme', { expects: '', holds: (await view.read('acme'))!.holds })).toEqual({ refused: 'scope.isOpen', scope: 'acme' })
    // A scope above is described, and one beside moves, with the scope open.
    expect(await view.describe('acme', { description: 'Trains' })).toEqual({ path: 'acme', changed: ['description'] })
    expect(await view.move('globex', 'acme')).toMatchObject({ from: 'globex', to: 'acme/globex' })
  })

  it('refuses a scope the person may not write before anything is built, and says the repository\'s refusals as the agent\'s keys', async () => {
    const { deps } = await organisation()
    const closed = scopesViewOver(deps({ writable: (path) => path !== 'globex' }))
    expect(await closed.create({ parent: 'globex', name: 'Yard', withBoard: false })).toEqual({ refused: 'agent.readOnly', scope: 'globex' })
    expect(await closed.describe('globex', { name: 'G' })).toEqual({ refused: 'agent.readOnly', scope: 'globex' })
    expect(await closed.move('acme', 'globex')).toEqual({ refused: 'agent.readOnly', scope: 'globex' })
    expect(await closed.remove('globex', { expects: '', holds: (await closed.read('globex'))!.holds })).toEqual({ refused: 'agent.readOnly', scope: 'globex' })
    const view = scopesViewOver(deps())
    const read = await view.read('globex')
    await view.describe('globex', { description: 'Moved on' })
    expect(await view.remove('globex', { expects: read!.revision, holds: read!.holds })).toEqual({ refused: 'agent.stale', scope: 'globex' })
    expect(await view.describe('gone', { name: 'G' })).toEqual({ refused: 'agent.unknownScope', scope: 'gone' })
    expect(await view.serve('globex', 'nobody')).toEqual({ refused: 'agent.unknownId' })
  })

  it('removes a scope, and says one that went with its work at the person\'s word on their screen', async () => {
    const { deps, notices } = await organisation()
    const view = scopesViewOver(deps())
    const empty = await view.read('globex')
    expect(await view.remove('globex', { expects: empty!.revision, holds: empty!.holds })).toEqual({ removed: ['globex'] })
    expect(notices).toEqual([])
    const rail = await view.read('acme/rail')
    expect(await view.remove('acme/rail', { expects: rail!.revision, holds: rail!.holds, personSaid: 'Yes, Rail can go' })).toEqual({ removed: ['acme/rail'] })
    expect(notices).toEqual([['warning', 'Claude Code removed Rail with 1 views and 0 other records, as you said: “Yes, Rail can go”. This cannot be undone.']])
  })
})
