// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The tree's four gestures over the memory repositories (ADR-0040 §1): the
 * same operations the organisation screen and every host's agent use.
 */
import { describe, expect, it } from 'vitest'
import { memoryRepositories } from '../adapters/memory/memoryRepositories'
import type { DesignElement } from '../model'
import type { HostModel } from '../model/hostModel'
import type { UnitType } from '../model/operatingModel'
import { ShellError } from '../platform/errors'
import type { Repositories } from '../ports/Repositories'
import { contentOf, landed, modelsOf, placeWhole, readScope, summaryOf } from './scopeAccess'
import type { ScopeSnapshot } from './scope'
import { indexScopes } from './scopeIndex'
import { createScopeAt, describeScopeAt, moveScopeUnder, removeScopeAt, serveScopeBy, settingsCommands, writeSettings } from './scopeTree'
import type { TreeScopes } from './scopeTree'

const DAY = '2026-10-18'

const snapshot = (path: string, model: HostModel): ScopeSnapshot => ({ path, model, activeDiagramId: '', logoLibrary: [] })
const model = (name: string, elements: DesignElement[] = []): HostModel => ({ name, elements, relations: [], diagrams: [] })
const app = (id: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'application', name: id, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})
const unit = (id: string, unitTypeId: string): DesignElement => ({ ...app(id), kind: 'actor', name: `Unit ${id}`, unitTypeId })
const types: UnitType[] = [
  { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [] },
  { id: 'ut-team', name: 'Team', within: ['ut-domain'], slots: [] },
]

async function place(repositories: Repositories, path: string, held: HostModel): Promise<void> {
  await placeWhole(repositories.scopes, path, contentOf(snapshot(path, held)))
}

async function paths(repositories: Repositories): Promise<string[]> {
  const listed: string[] = []
  const walk = (node: { path: string; children: readonly { path: string; children: readonly never[] }[] }) => {
    listed.push(node.path)
    node.children.forEach(walk)
  }
  walk(summaryOf(await repositories.scopes.tree()) as never)
  return listed
}

/** The repository, with the scope at one identity readable and never writable: a source that decides who may write. */
function closedAt(repositories: Repositories, closed: string): TreeScopes {
  const scopes = repositories.scopes
  return {
    tree: () => scopes.tree(),
    state: (id) => scopes.state(id),
    create: (at, scope) => scopes.create(at, scope),
    move: (id, to, expects) => scopes.move(id, to, expects),
    remove: (id, expects) => scopes.remove(id, expects),
    apply: (work) => (work.some((one) => one.scope === closed)
      ? Promise.resolve({ refused: 'shell.scopeReadOnly', scope: closed } as never)
      : scopes.apply(work)),
  }
}

describe('making a scope', () => {
  it('makes a landscape with one board, or a domain that draws nothing, at the dialog\'s address', async () => {
    const repositories = memoryRepositories()
    await place(repositories, 'acme', model('Acme'))
    const made = await createScopeAt(repositories.scopes, { parent: 'acme', name: ' Rail yards ', withBoard: true, boardName: 'Landscape', ancestors: 'required' })
    expect(made).toMatchObject({ path: 'acme/rail-yards', name: 'Rail yards', kind: 'landscape', board: { id: 'landscape', name: 'Landscape' } })
    const held = await readScope(repositories.scopes, 'acme/rail-yards')
    expect([held?.model.name, held?.kind, held?.model.diagrams.map((one) => one.name), held?.activeDiagramId]).toEqual(['Rail yards', 'landscape', ['Landscape'], 'landscape'])
    // The same name again is suffixed, and a domain has no board.
    const again = await createScopeAt(repositories.scopes, { parent: 'acme', name: 'Rail yards', withBoard: false, boardName: 'Landscape', ancestors: 'required' })
    expect([('path' in again) && again.path, ('kind' in again) && again.kind, 'board' in again]).toEqual(['acme/rail-yards-2', 'domain', false])
    expect((await readScope(repositories.scopes, 'acme/rail-yards-2'))?.model.diagrams).toEqual([])
  })

  it('suffixes a name that slugs to a reserved word', async () => {
    const repositories = memoryRepositories()
    const made = await createScopeAt(repositories.scopes, { parent: '', name: 'Decisions', withBoard: false, boardName: 'x', ancestors: 'required' })
    expect('path' in made && made.path).toBe('decisions-2')
  })

  it('refuses a parent that is not there when one is required, and makes the missing ones as domains otherwise', async () => {
    const repositories = memoryRepositories()
    expect(await createScopeAt(repositories.scopes, { parent: 'nowhere', name: 'Rail', withBoard: false, boardName: 'x', ancestors: 'required' }))
      .toEqual({ refused: 'shell.scopeGone' })
    expect(await paths(repositories)).toEqual([''])
    const made = await createScopeAt(repositories.scopes, { parent: 'acme/freight', name: 'Rail', withBoard: false, boardName: 'x', ancestors: 'make' })
    expect('path' in made && made.path).toBe('acme/freight/rail')
    expect((await readScope(repositories.scopes, 'acme/freight'))?.kind).toBe('domain')
  })

  it('refuses an address where a scope nobody could read is in the way', async () => {
    const repositories = memoryRepositories()
    const scopes = repositories.scopes
    const unreadable: TreeScopes = { ...closedAt(repositories, 'none'), tree: async () => ({ ...await scopes.tree(), unreadable: ['acme'] }) }
    expect(await createScopeAt(unreadable, { parent: 'acme', name: 'Rail', withBoard: false, boardName: 'x' })).toEqual({ refused: 'shell.unreadableInTheWay' })
  })
})

describe('a unit serving a scope from the start', () => {
  async function organisation() {
    const repositories = memoryRepositories()
    await place(repositories, '', { ...model('Acme'), unitTypes: types })
    await place(repositories, 'acme', model('Acme', [unit('freight', 'ut-domain')]))
    await place(repositories, 'acme/rail', model('Rail'))
    const index = indexScopes(modelsOf(await repositories.index.read()))
    return { repositories, index }
  }

  it('writes the unit\'s scopes where it is kept and gives the scope its type, in one apply', async () => {
    const { repositories, index } = await organisation()
    const served = await serveScopeBy({ scopes: repositories.scopes, index, writable: () => true, today: DAY }, 'acme/rail', 'freight')
    expect(served).toEqual({ unit: 'freight', keptIn: 'acme', scopeType: 'ut-domain' })
    expect((await readScope(repositories.scopes, 'acme'))?.model.elements[0].scopes).toEqual(['acme', 'acme/rail'])
    expect((await readScope(repositories.scopes, 'acme/rail'))?.unitTypeId).toBe('ut-domain')
  })

  it('refuses a unit nobody keeps, a scope the person may not write, and says the repository\'s own refusal', async () => {
    const { repositories, index } = await organisation()
    const deps = { scopes: repositories.scopes, index, writable: () => true, today: DAY }
    expect(await serveScopeBy(deps, 'acme/rail', 'nobody')).toEqual({ refused: 'agent.unknownId' })
    expect(await serveScopeBy({ ...deps, writable: (path) => path !== 'acme' }, 'acme/rail', 'freight')).toEqual({ refused: 'shell.scopeReadOnly', scope: 'acme' })
    const acme = (await readScope(repositories.scopes, 'acme'))!.id!
    expect(await serveScopeBy({ ...deps, scopes: closedAt(repositories, acme) }, 'acme/rail', 'freight')).toEqual({ refused: 'shell.scopeReadOnly' })
    expect((await readScope(repositories.scopes, 'acme/rail'))?.unitTypeId).toBeUndefined()
    expect(await serveScopeBy(deps, 'acme/gone', 'freight')).toEqual({ refused: 'shell.scopeGone' })
  })
})

describe('describing a scope', () => {
  it('writes only the fields that differ, as the two steps the dialog writes, and clears with null', async () => {
    const repositories = memoryRepositories()
    await placeWhole(repositories.scopes, 'acme', { ...contentOf(snapshot('acme', { ...model('Acme'), description: 'Trains' })), kind: 'domain', client: 'Acme Ltd' })
    const changed = await describeScopeAt(repositories.scopes, 'acme', {
      name: 'Acme', description: null, unitTypeId: 'ut-domain', kind: null, client: ' Acme Group ', links: [{ label: 'Wiki', url: 'https://example.com/acme' }],
    })
    expect(changed?.changed).toEqual(['description', 'kind', 'unitTypeId', 'client', 'links'])
    const held = await readScope(repositories.scopes, 'acme')
    expect([held?.model.name, held?.model.description, held?.kind, held?.unitTypeId, held?.client, held?.links])
      .toEqual(['Acme', undefined, undefined, 'ut-domain', 'Acme Group', [{ label: 'Wiki', url: 'https://example.com/acme' }]])
    expect(await describeScopeAt(repositories.scopes, 'acme', { client: 'Acme Group' })).toEqual({ changed: [] })
    expect(await describeScopeAt(repositories.scopes, 'gone', { name: 'x' })).toBeUndefined()
  })

  it('saves the settings form whole, making a scope that has no document yet', async () => {
    const repositories = memoryRepositories()
    await writeSettings(repositories.scopes, 'acme', 'Acme', { name: 'Acme', description: ' Trains ', type: 'kind:programme', client: '' })
    const held = await readScope(repositories.scopes, 'acme')
    expect([held?.model.name, held?.model.description, held?.kind, held?.client]).toEqual(['Acme', 'Trains', 'programme', undefined])
    expect(settingsCommands('Acme', { name: 'Acme', kind: 'team' })[1]).toEqual({ type: 'scope.describe', patch: { client: undefined, links: undefined, kind: 'team' } })
  })
})

describe('moving a scope', () => {
  async function landscape() {
    const repositories = memoryRepositories()
    await place(repositories, 'acme', model('Acme'))
    await place(repositories, 'acme/crews', model('Crews', [app('crews')]))
    await place(repositories, 'globex', model('Globex', [app('crews', { ref: 'acme/crews' })]))
    await place(repositories, 'initech', model('Initech', [app('crews', { ref: 'acme/crews' })]))
    return repositories
  }

  it('moves it under the new parent with its last segment, and re-addresses the stand-ins that named it', async () => {
    const repositories = await landscape()
    await place(repositories, 'group', model('Group'))
    const moved = await moveScopeUnder(repositories.scopes, repositories.index, 'acme', 'group')
    expect(moved).toEqual({ from: 'acme', to: 'group/acme', carried: ['globex', 'initech'], notCarried: [] })
    expect((await readScope(repositories.scopes, 'globex'))?.model.elements[0].ref).toBe('group/acme/crews')
  })

  it('suffixes a segment taken under the new parent, and says a stand-in it could not re-address while the move stands', async () => {
    const repositories = await landscape()
    await place(repositories, 'group/acme', model('Other Acme'))
    const initech = (await readScope(repositories.scopes, 'initech'))!.id!
    const moved = await moveScopeUnder(closedAt(repositories, initech), repositories.index, 'acme', 'group')
    expect(moved).toEqual({ from: 'acme', to: 'group/acme-2', carried: ['globex'], notCarried: [{ scope: 'initech', reason: 'shell.scopeReadOnly' }] })
    expect((await readScope(repositories.scopes, 'initech'))?.model.elements[0].ref).toBe('acme/crews')
    expect(await readScope(repositories.scopes, 'group/acme-2/crews')).toBeDefined()
  })

  it('throws a carry refused where the screen asks for it strictly, and answers nothing for a scope not there', async () => {
    const repositories = await landscape()
    const initech = (await readScope(repositories.scopes, 'initech'))!.id!
    await expect(moveScopeUnder(closedAt(repositories, initech), repositories.index, 'acme', 'globex', { strict: true }))
      .rejects.toEqual(new ShellError('shell.scopeReadOnly'))
    expect(await moveScopeUnder(repositories.scopes, repositories.index, 'nowhere', 'globex')).toBeUndefined()
  })
})

describe('removing a scope', () => {
  it('removes it, expecting what was read, and refuses one somebody changed since', async () => {
    const repositories = memoryRepositories()
    await place(repositories, 'acme', model('Acme'))
    const read = await readScope(repositories.scopes, 'acme')
    await placeWhole(repositories.scopes, 'acme', contentOf(snapshot('acme', model('Acme', [app('crews')]))))
    await expect(removeScopeAt(repositories.scopes, 'acme', read!.revision)).rejects.toEqual(new ShellError('shell.scopeMoved'))
    const now = await readScope(repositories.scopes, 'acme')
    expect(await removeScopeAt(repositories.scopes, 'acme', now!.revision)).toEqual(['acme'])
    expect(await removeScopeAt(repositories.scopes, 'acme')).toBeUndefined()
    expect(await paths(repositories)).toEqual([''])
  })

  it('removes the subtree the repository takes with it, and refuses the organisation', async () => {
    const repositories = memoryRepositories()
    landed(await repositories.scopes.create('acme/rail', { name: 'Rail' }))
    expect(await removeScopeAt(repositories.scopes, 'acme')).toEqual(['acme', 'acme/rail'])
    await expect(removeScopeAt(repositories.scopes, '')).rejects.toBeInstanceOf(ShellError)
  })
})
