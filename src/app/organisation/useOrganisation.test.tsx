// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The organisation screen's wiring, driven directly.
 *
 * The screen's own tests go through the shell, which is the honest way to check
 * what a person sees. What is pinned here is the part that has no pixels: what
 * reaches the repositories — ancestors made before the scope filed under them,
 * a copied example landing where the root's state says it should, a move
 * carrying the stand-ins that point into it, an open that carries the page it
 * was opened for, and a refusal that reaches the trail rather than the screen.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { heldRepositories } from '../testing/heldRepositories'
import { translator } from '../../i18n'
import type { ScopeSnapshot } from '../../projects/scope'
import type { InitialPage } from '../App'
import type { HeldRepositories } from '../testing/heldRepositories'
import type { ScopeRepository } from '../../ports/ScopeRepository'
import type { ExampleProject } from '../../projects/examples/copy'
import { useOrganisation } from './useOrganisation'
import type { Organisation } from './useOrganisation'
import { exampleScopes } from '../../adapters/folder/format/exampleFolder'

afterEach(() => cleanup())

const s = translator('en')

const EXAMPLE: ExampleProject = {
  key: 'acme',
  path: 'acme-logistics',
  label: 'Acme Logistics',
  description: 'an example',
  scopes: exampleScopes({
    'scope.json': {
      type: 'lionsville-architecture', version: 5, name: 'Acme Logistics',
      kind: 'organisation', activeDiagramId: '', diagrams: [],
    },
    'model.json': { elements: [], relations: [] },
    'application-landscape/scope.json': {
      type: 'lionsville-architecture', version: 5, name: 'Application landscape',
      kind: 'landscape', activeDiagramId: 'l7', diagrams: ['l7'],
    },
    'application-landscape/model.json': {
      elements: [{ id: 'wms', kind: 'application', name: 'WMS', lifecycle: 'live', isManaged: true, aspects: {} }],
      relations: [],
    },
    'application-landscape/diagrams/l7.json': { id: 'l7', kind: 'layer7', name: 'Landscape', members: [] },
    'application-landscape/diagrams/l7.geometry.json': { nodes: [] },
    // A domain beside the landscape, last in path order, with a board of its
    // own and no applications on it (ADR-0013, ADR-0014): where a copy must
    // NOT land.
    'platforms/scope.json': {
      type: 'lionsville-architecture', version: 5, name: 'Shared platforms',
      kind: 'domain', activeDiagramId: 'p7', diagrams: ['p7'],
    },
    'platforms/model.json': {
      elements: [{ id: 'openshift', kind: 'platform', name: 'OpenShift', lifecycle: 'live', isManaged: true, aspects: {} }],
      relations: [],
    },
    'platforms/diagrams/p7.json': { id: 'p7', kind: 'layer7', name: 'Platforms', members: [{ id: 'openshift', zone: 'management' }] },
    'platforms/diagrams/p7.geometry.json': { nodes: [] },
  }, 'acme-logistics'),
}

type Harness = {
  held: () => Organisation
  entered: ReturnType<typeof vi.fn>
  failures: string[]
  store: HeldRepositories
  treeChanged: ReturnType<typeof vi.fn>
}

/** The scopes, with some of what they answer answered otherwise: a refusal, a count of calls. */
type Over = Partial<ScopeRepository>

function mount(
  initial: readonly ScopeSnapshot[] = [],
  over: Over = {},
  active = true,
  writable?: (path: string) => boolean,
): Harness {
  return mountWith(heldRepositories(initial), over, active, writable)
}

/** The same harness over repositories built beforehand, some of whose answers are the test's. */
function mountWith(
  store: HeldRepositories, over: Over = {}, active = true, writable?: (path: string) => boolean,
): Harness {
  const entered = vi.fn<(scope: ScopeSnapshot, page?: InitialPage) => void>()
  const treeChanged = vi.fn()
  const failures: string[] = []
  let current: Organisation | undefined
  // One value for the life of the screen, as the shell hands it over.
  const repositories = { ...store, scopes: { ...bound(store.scopes), ...over } }

  // `onFailure` is deliberately a fresh arrow on every render: that is what it
  // is in the shell, where it hangs off the toasts and the language, and an
  // effect that depended on its identity would read the tree for ever.
  function Probe() {
    current = useOrganisation({
      repositories,
      active,
      at: '',
      onEnter: entered,
      notify: () => {},
      onFailure: (where) => { failures.push(where) },
      onKeptResult: () => {},
      s,
      onTreeChanged: treeChanged,
      ...(writable ? { writable } : {}),
    })
    return null
  }
  render(<Probe />)
  return { held: () => current!, entered, failures, store, treeChanged }
}

/** A repository's members as plain functions, so a test can put some of its own beside them. */
function bound(scopes: ScopeRepository): ScopeRepository {
  return {
    id: scopes.id,
    tree: () => scopes.tree(),
    state: (id) => scopes.state(id),
    apply: (work) => scopes.apply(work),
    create: (at, scope) => scopes.create(at, scope),
    move: (scope, to, expects) => scopes.move(scope, to, expects),
    remove: (scope, expects) => scopes.remove(scope, expects),
  }
}

/** Let the reads and writes the hook started settle. */
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

describe('useOrganisation', () => {
  it('reads the tree and the root’s own document', async () => {
    const { held } = mount([{
      path: '', model: { name: 'Acme', elements: [], relations: [], diagrams: [] },
      activeDiagramId: '', logoLibrary: [],
    }])
    await settle()
    expect(held().tree.name).toBe('Acme')
    expect(held().root?.model.name).toBe('Acme')
    expect(held().ready).toBe(true)
  })

  /** The root's document is a whole model; nothing loads one behind a canvas. */
  it('does not read the root while its screen is not the one on show', async () => {
    const { held } = mount([{
      path: '', model: { name: 'Acme', elements: [], relations: [], diagrams: [] },
      activeDiagramId: '', logoLibrary: [],
    }], {}, false)
    await settle()
    expect(held().tree.name).toBe('Acme')
    expect(held().root).toBeUndefined()
    expect(held().ready).toBe(false)
  })

  /**
   * A crumb is another home in the same tree: the home's document is read
   * again, and the tree — the read that grows with the organisation, and over
   * a network the costly one — is not listed again for it.
   */
  it('reads the new home and not the whole tree again when a crumb moves it', async () => {
    const store = heldRepositories([
      { path: '', model: { name: 'Acme', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [] },
      { path: 'rail', model: { name: 'Rail', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [] },
    ])
    const states = vi.fn((id: string) => store.scopes.state(id))
    // One value for the life of the screen, as the shell hands it over.
    const repositories = { ...store, scopes: { ...bound(store.scopes), state: states } }
    let current: Organisation | undefined
    function Probe({ at }: { at: string }) {
      current = useOrganisation({
        repositories,
        active: true,
        at,
        onEnter: () => {},
        notify: () => {},
        onFailure: () => {},
        onKeptResult: () => {},
        s,
        onTreeChanged: () => {},
      })
      return null
    }
    const { rerender } = render(<Probe at="" />)
    await settle()
    rerender(<Probe at="rail" />)
    await settle()
    expect(current?.root?.model.name).toBe('Rail')
    expect(states).toHaveBeenCalledTimes(2)
    expect((await store.read('rail'))?.id).toBe(states.mock.calls[1][0])
  })

  /**
   * A folder with no `scope.json` is not a scope (ADR-0012 §1), so a child
   * filed under one would be filed under nothing and nothing would list it.
   */
  it('creates the ancestors that are missing, from the top down', async () => {
    const { held, store } = mount()
    await settle()
    act(() => held().addUnder('acme/rail'))
    act(() => held().setNewScopeName('Rolling stock'))
    await act(async () => { held().create(); await Promise.resolve() })
    await settle()

    expect((await store.read('acme'))?.model.name).toBe('acme')
    expect((await store.read('acme/rail'))?.kind).toBe('domain')
    expect((await store.read('acme/rail/rolling-stock'))?.model.name).toBe('Rolling stock')
  })

  it('enters the scope it made, so a refresh does not lose it', async () => {
    const { held, entered } = mount()
    await settle()
    act(() => held().addUnder(''))
    act(() => held().setNewScopeName('Retail'))
    await act(async () => { held().create(); await Promise.resolve() })
    await settle()
    expect(entered.mock.calls[0][0].path).toBe('retail')
  })

  /**
   * A scope the listing could not read is not in the tree, so its address
   * looks free; a new scope saved there — or a missing ancestor made on the
   * way — would be written over it (ADR-0028, amended).
   */
  it.each([
    ['at the address', '', 'retail'],
    ['above it, where an ancestor would be made', 'acme/rail', 'acme'],
  ])('creates nothing where the listing could not read a scope %s', async (_said, parent, unreadable) => {
    const writes: string[] = []
    const store = heldRepositories([])
    const { held, failures, entered } = mountWith(store, {
      tree: async () => ({ ...await store.scopes.tree(), unreadable: [unreadable] }),
      create: (at, scope) => { writes.push(`create ${at}`); return store.scopes.create(at, scope) },
    })
    await settle()
    act(() => held().addUnder(parent))
    act(() => held().setNewScopeName('Retail'))
    await act(async () => { held().create(); await Promise.resolve() })
    await settle()

    expect(writes).toEqual([])
    expect(entered).not.toHaveBeenCalled()
    expect(failures).toEqual(['organisation.create.unreadable'])
  })

  /**
   * A board for a scope that is already there: read-patch-write, since the
   * home is outside any session, then entered on the board just made.
   */
  it('gives a scope with no board its first one, and enters it on that board', async () => {
    const { held, entered, store } = mount([{
      path: '', model: { name: 'Acme', elements: [], relations: [], diagrams: [] },
      activeDiagramId: '', logoLibrary: [],
    }])
    await settle()
    act(() => held().addBoard(''))
    expect(held().dialog).toEqual({ kind: 'newBoard', path: '', name: 'New landscape' })
    act(() => held().setNewBoardName('Acme today'))
    await act(async () => { held().createBoard(); await Promise.resolve() })
    await settle()

    const root = await store.read('')
    expect(root?.model.diagrams).toEqual([
      { id: 'new-landscape', kind: 'layer7', name: 'Acme today', members: [], geometry: { nodes: [] } },
    ])
    expect(entered).toHaveBeenCalledWith(
      expect.objectContaining({ path: '', activeDiagramId: 'new-landscape' }),
      { page: 'board', id: 'new-landscape' },
    )
  })

  it('claims the next key when the usual one is taken', async () => {
    const { held, store } = mount([{
      path: 'retail',
      model: {
        name: 'Retail', elements: [], relations: [],
        diagrams: [{ id: 'new-landscape', kind: 'layer7', name: 'Now', members: [], geometry: { nodes: [] } }],
      },
      activeDiagramId: 'new-landscape', logoLibrary: [],
    }])
    await settle()
    act(() => held().addBoard('retail'))
    await act(async () => { held().createBoard(); await Promise.resolve() })
    await settle()
    expect((await store.read('retail'))?.model.diagrams.map((d) => d.id)).toEqual(['new-landscape', 'new-landscape-2'])
  })

  /**
   * A container diagram is not a tab, so the tab menu that deletes a
   * landscape never reaches it; its home is where it goes. The active board
   * moves on, so the scope is not entered next on a board that is not there.
   */
  /**
   * The detail goes, the application stays, and the interface its container
   * lines were carrying is written on the landscape rather than dropped with
   * them (`model/containerDiagram.ts`). Deleting the application is the other
   * gesture, and it is the one that takes this view with it.
   */
  it('takes the containers with the view, and carries their interface up to the application', async () => {
    const { held, store } = mount([{
      path: 'retail',
      model: {
        name: 'Retail',
        elements: [
          { id: 'erp', kind: 'application', name: 'ERP', lifecycle: 'live', isManaged: true, aspects: {} },
          { id: 'crm', kind: 'application', name: 'CRM', lifecycle: 'live', isManaged: true, aspects: {} },
          { id: 'erp-api', kind: 'component', parentId: 'erp', name: 'API', lifecycle: 'live', isManaged: true, aspects: {} },
        ],
        relations: [{ id: 'x1', type: 'flow', sourceId: 'erp-api', targetId: 'crm', label: 'orders' }],
        diagrams: [
          { id: 'l7', kind: 'layer7', name: 'Now', members: [{ id: 'erp' }, { id: 'crm' }], geometry: { nodes: [] } },
          { id: 'cd', kind: 'container', name: 'ERP', applicationElementId: 'erp',
            members: [{ id: 'erp' }, { id: 'erp-api' }, { id: 'crm' }], geometry: { nodes: [] } },
        ],
      },
      activeDiagramId: 'cd', logoLibrary: [],
    }])
    await settle()
    act(() => held().askDeleteBoard('retail', { id: 'cd', name: 'ERP' }))
    await act(async () => { held().confirmDeleteBoard(); await Promise.resolve() })
    await settle()
    const retail = await store.read('retail')
    expect(retail?.model.diagrams.map((d) => d.id)).toEqual(['l7'])
    expect(retail?.model.elements.map((e) => e.id)).toEqual(['erp', 'crm'])
    // The container line went with its container; what it meant did not.
    expect(retail?.model.relations).toEqual([
      expect.objectContaining({ type: 'flow', sourceId: 'erp', targetId: 'crm', label: 'orders' }),
    ])
  })

  it('takes a board off a scope from its home, and moves the active board on', async () => {
    const { held, store } = mount([{
      path: 'retail',
      model: {
        name: 'Retail', elements: [], relations: [],
        diagrams: [
          { id: 'l7', kind: 'layer7', name: 'Now', members: [], geometry: { nodes: [] } },
          { id: 'cd', kind: 'container', name: 'ERP', applicationElementId: 'erp', members: [], geometry: { nodes: [] } },
        ],
      },
      activeDiagramId: 'cd', logoLibrary: [],
    }])
    await settle()
    act(() => held().askDeleteBoard('retail', { id: 'cd', name: 'ERP' }))
    expect(held().dialog).toEqual({ kind: 'deleteBoard', path: 'retail', board: { id: 'cd', name: 'ERP' } })
    await act(async () => { held().confirmDeleteBoard(); await Promise.resolve() })
    await settle()
    const retail = await store.read('retail')
    expect(retail?.model.diagrams.map((d) => d.id)).toEqual(['l7'])
    expect(retail?.activeDiagramId).toBe('l7')
    expect(held().dialog).toEqual({ kind: 'none' })
  })

  it('carries the page a scope was opened for', async () => {
    const { held, entered } = mount([{
      path: '', model: { name: 'Acme', elements: [], relations: [], diagrams: [] },
      activeDiagramId: '', logoLibrary: [],
    }])
    await settle()
    await act(async () => { held().open('', { page: 'roadmap' }); await Promise.resolve() })
    expect(entered).toHaveBeenCalledWith(expect.objectContaining({ path: '' }), { page: 'roadmap' })
  })

  it('makes a scope where there is none, before opening the page asked for on it', async () => {
    const { held, entered, failures, store, treeChanged } = mount([{
      path: 'retail', model: { name: 'Retail', elements: [], relations: [], diagrams: [] },
      activeDiagramId: '', logoLibrary: [],
    }])
    await settle()
    await act(async () => { held().open('retail/stores', { page: 'decisions' }) })
    await settle()
    await settle()
    expect(await store.read('retail/stores')).toMatchObject({ path: 'retail/stores', model: { elements: [], diagrams: [] } })
    expect(entered).toHaveBeenCalledWith(expect.objectContaining({ path: 'retail/stores' }), { page: 'decisions' })
    expect(treeChanged).toHaveBeenCalled()
    expect(failures).toEqual([])
  })

  it('opens the page empty and makes nothing where the scope may only be read', async () => {
    const { held, entered, failures, store } = mount([{
      path: 'retail', model: { name: 'Retail', elements: [], relations: [], diagrams: [] },
      activeDiagramId: '', logoLibrary: [],
    }], {}, true, () => false)
    await settle()
    await act(async () => { held().open('retail/stores', { page: 'roadmap' }) })
    await settle()
    expect(await store.read('retail/stores')).toBeUndefined()
    expect(entered).toHaveBeenCalledWith(expect.objectContaining({ path: 'retail/stores' }), { page: 'roadmap' })
    expect(failures).toEqual([])
  })

  it('says once, through the failure, that a scope asked for with no page is gone', async () => {
    const { held, entered, failures } = mount([])
    await settle()
    await act(async () => { held().open('gone') })
    await settle()
    expect(entered).not.toHaveBeenCalled()
    expect(failures).toEqual(['organisation.open.gone'])
  })

  describe('copying an example', () => {
    it('makes it the organisation when the root is unnamed and empty', async () => {
      const { held, store } = mount()
      await settle()
      await act(async () => { held().copyExample(EXAMPLE); await Promise.resolve() })
      await settle()
      expect((await store.read(''))?.model.name).toBe('Acme Logistics')
      expect((await store.read('application-landscape'))?.model.name).toBe('Application landscape')
      expect(await store.read('acme-logistics')).toBeUndefined()
    })

    it('files it under a child when the root is already something', async () => {
      const { held, store } = mount([{
        path: '', model: { name: 'Globex', elements: [], relations: [], diagrams: [] },
        activeDiagramId: '', logoLibrary: [],
      }])
      await settle()
      await act(async () => { held().copyExample(EXAMPLE); await Promise.resolve() })
      await settle()
      expect((await store.read(''))?.model.name).toBe('Globex')
      expect((await store.read('acme-logistics'))?.model.name).toBe('Acme Logistics')
      expect((await store.read('acme-logistics/application-landscape'))).toBeDefined()
    })

    it('lands in the board-drawing scope with the applications, not in the platform scope beside it (ADR-0013, ADR-0014)', async () => {
      const { held, store, entered } = mount()
      await settle()
      await act(async () => { held().copyExample(EXAMPLE); await Promise.resolve() })
      await settle()
      expect((await store.read('platforms'))?.model.name).toBe('Shared platforms')
      expect(entered).toHaveBeenCalledWith(expect.objectContaining({ path: 'application-landscape' }))
    })
  })

  /**
   * The shell reads the index again on this: a browser tab has no watcher to
   * say the tree changed, and an index that never heard of the landscape just
   * copied in answers "nobody" for every application on the map.
   */
  it('says the tree changed once the example is written', async () => {
    const { held, treeChanged } = mount([])
    await settle()
    expect(treeChanged).not.toHaveBeenCalled()
    await act(async () => { held().copyExample(EXAMPLE); await Promise.resolve() })
    await settle()
    await settle()
    expect(treeChanged).toHaveBeenCalled()
  })

  /**
   * A listing that will not read and an empty one look the same on a screen,
   * and one of them means "your work is still there, somewhere".
   */
  it('says which failure it was when the listing refuses', async () => {
    const { failures } = mount([], { tree: () => Promise.reject(new Error('no')) })
    await settle()
    expect(failures).toContain('organisation.list')
  })

  /** The cards are decoration beside a tree that reads; the trail still gets it. */
  it('reports a root that will not load without interrupting the screen', async () => {
    const { held, failures } = mount([], { state: () => Promise.reject(new Error('no')) })
    await settle()
    expect(failures).toContain('organisation.root')
    expect(held().ready).toBe(true)
    expect(held().root).toBeUndefined()
  })

  /**
   * A ref is an address (ADR-0012 §3), and until this the move carried the
   * folders and left every stand-in elsewhere pointing at where they used to
   * be — a drift finding in scopes nobody had touched.
   */
  describe('moving a scope', () => {
    const element = (id: string, ref?: string) => ({
      id, kind: 'application' as const, name: id, lifecycle: 'live' as const,
      isManaged: false, aspects: {}, ...(ref !== undefined ? { ref } : {}),
    })
    const scope = (path: string, elements: ReturnType<typeof element>[]): ScopeSnapshot => ({
      path,
      model: { name: path || 'Acme', elements, relations: [], diagrams: [] },
      activeDiagramId: '',
      logoLibrary: [],
    })
    const tree = () => [
      scope('', []),
      scope('freight', []),
      scope('rail', [element('erp')]),
      scope('rail/rolling-stock', [element('wms')]),
      scope('road', [element('erp', 'rail'), element('wms', 'rail/rolling-stock')]),
    ]

    it('carries every ref that points into the subtree', async () => {
      const { held, store } = mount(tree())
      await settle()
      await act(async () => { held().applySettings('rail', { name: 'Rail', parent: 'freight' }) })
      await settle()

      const road = await store.read('road')
      expect(road?.model.elements.map((e) => e.ref))
        .toEqual(['freight/rail', 'freight/rail/rolling-stock'])
      expect((await store.read('freight/rail/rolling-stock'))?.model.elements[0].id).toBe('wms')
      expect(await store.read('rail')).toBeUndefined()
    })

    it('moves the scope and everything under it, each keeping what it is', async () => {
      const { held, store } = mount(tree())
      await settle()
      const before = [(await store.read('rail'))?.id, (await store.read('rail/rolling-stock'))?.id]
      await act(async () => { held().applySettings('rail', { name: 'Rail', parent: 'freight' }) })
      await settle()
      expect([(await store.read('freight/rail'))?.id, (await store.read('freight/rail/rolling-stock'))?.id]).toEqual(before)
    })

    /** A move the repository refuses moves nothing, and says so. */
    it('moves nothing where the repository refuses, and says so', async () => {
      const store = heldRepositories(tree())
      const { held, failures } = mountWith(store, {
        move: () => Promise.resolve({ refused: 'shell.scopeTaken' }),
      })
      await settle()
      await act(async () => { held().applySettings('rail', { name: 'Rail', parent: 'freight' }) })
      await settle()

      expect(failures).toContain('organisation.settings')
      expect(await store.read('rail')).toBeDefined()
      expect(await store.read('freight/rail')).toBeUndefined()
    })
  })

  it('folds a scope shut and open again', async () => {
    const { held } = mount()
    await settle()
    act(() => held().toggleCollapsed('retail'))
    expect(held().collapsed.has('retail')).toBe(true)
    act(() => held().toggleCollapsed('retail'))
    expect(held().collapsed.has('retail')).toBe(false)
  })
})
