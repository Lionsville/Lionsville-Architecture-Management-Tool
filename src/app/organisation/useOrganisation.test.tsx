// @vitest-environment jsdom
/**
 * The organisation screen's wiring, driven directly.
 *
 * The screen's own tests go through the shell, which is the honest way to check
 * what a person sees. What is pinned here is the part that has no pixels: the
 * store operations and their ORDER — ancestors written before the scope filed
 * under them, a copied example landing where the root's state says it should,
 * an open that carries the page it was opened for, and a refusal that reaches
 * the trail rather than the screen.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { InMemoryScopeStore } from '../../adapters/memory/InMemoryScopeStore'
import { translator } from '../../i18n'
import type { ScopeSnapshot } from '../../projects/scope'
import type { InitialPage, ScopeLibrary } from '../App'
import type { ExampleProject } from '../examples'
import { useOrganisation } from './useOrganisation'
import type { Organisation } from './useOrganisation'

afterEach(() => cleanup())

const s = translator('en')

const EXAMPLE: ExampleProject = {
  key: 'acme',
  path: 'acme-logistics',
  label: 'Acme Logistics',
  description: 'an example',
  folder: {
    'scope.json': {
      type: 'lionsville-architecture', version: 5, name: 'Acme Logistics',
      kind: 'organisation', activeDiagramId: '', diagrams: [],
    },
    'model.json': { elements: [], relations: [] },
    'application-landscape/scope.json': {
      type: 'lionsville-architecture', version: 5, name: 'Application landscape',
      kind: 'landscape', activeDiagramId: 'l7', diagrams: ['l7'],
    },
    'application-landscape/model.json': { elements: [], relations: [] },
    'application-landscape/diagrams/l7.json': { id: 'l7', kind: 'layer7', name: 'Landscape', members: [] },
    'application-landscape/diagrams/l7.geometry.json': { nodes: [] },
  },
}

type Harness = {
  held: () => Organisation
  entered: ReturnType<typeof vi.fn>
  failures: string[]
  store: InMemoryScopeStore
}

function mount(
  initial: readonly ScopeSnapshot[] = [],
  over: Partial<ScopeLibrary> = {},
  active = true,
): Harness {
  const store = new InMemoryScopeStore(initial)
  const scopes: ScopeLibrary = {
    list: () => store.list(),
    load: (path) => store.load(path),
    save: (scope) => store.save(scope),
    remove: (path) => store.remove(path),
    ...over,
  }
  const entered = vi.fn<(scope: ScopeSnapshot, page?: InitialPage) => void>()
  const failures: string[] = []
  let current: Organisation | undefined

  // `onFailure` is deliberately a fresh arrow on every render: that is what it
  // is in the shell, where it hangs off the toasts and the language, and an
  // effect that depended on its identity would read the tree for ever.
  function Probe() {
    current = useOrganisation({
      scopes,
      active,
      onEnter: entered,
      notify: () => {},
      onFailure: (where) => { failures.push(where) },
      onStorageResult: () => {},
      s,
    })
    return null
  }
  render(<Probe />)
  return { held: () => current!, entered, failures, store }
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

    expect((await store.load('acme'))?.model.name).toBe('acme')
    expect((await store.load('acme/rail'))?.kind).toBe('domain')
    expect((await store.load('acme/rail/rolling-stock'))?.model.name).toBe('Rolling stock')
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

  it('carries the page a scope was opened for', async () => {
    const { held, entered } = mount([{
      path: '', model: { name: 'Acme', elements: [], relations: [], diagrams: [] },
      activeDiagramId: '', logoLibrary: [],
    }])
    await settle()
    await act(async () => { held().open('', { page: 'roadmap' }); await Promise.resolve() })
    expect(entered).toHaveBeenCalledWith(expect.objectContaining({ path: '' }), { page: 'roadmap' })
  })

  describe('copying an example', () => {
    it('makes it the organisation when the root is unnamed and empty', async () => {
      const { held, store } = mount()
      await settle()
      await act(async () => { held().copyExample(EXAMPLE); await Promise.resolve() })
      await settle()
      expect((await store.load(''))?.model.name).toBe('Acme Logistics')
      expect((await store.load('application-landscape'))?.model.name).toBe('Application landscape')
      expect(await store.load('acme-logistics')).toBeUndefined()
    })

    it('files it under a child when the root is already something', async () => {
      const { held, store } = mount([{
        path: '', model: { name: 'Globex', elements: [], relations: [], diagrams: [] },
        activeDiagramId: '', logoLibrary: [],
      }])
      await settle()
      await act(async () => { held().copyExample(EXAMPLE); await Promise.resolve() })
      await settle()
      expect((await store.load(''))?.model.name).toBe('Globex')
      expect((await store.load('acme-logistics'))?.model.name).toBe('Acme Logistics')
      expect((await store.load('acme-logistics/application-landscape'))).toBeDefined()
    })
  })

  /**
   * A listing that will not read and an empty one look the same on a screen,
   * and one of them means "your work is still there, somewhere".
   */
  it('says which failure it was when the listing refuses', async () => {
    const { failures } = mount([], { list: () => Promise.reject(new Error('no')) })
    await settle()
    expect(failures).toContain('organisation.list')
  })

  /** The cards are decoration beside a tree that reads; the trail still gets it. */
  it('reports a root that will not load without interrupting the screen', async () => {
    const { held, failures } = mount([], { load: () => Promise.reject(new Error('no')) })
    await settle()
    expect(failures).toContain('organisation.root')
    expect(held().ready).toBe(true)
    expect(held().root).toBeUndefined()
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
