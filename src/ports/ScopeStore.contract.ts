// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What every scope store must do — written once, run by all of them.
 *
 * This file is the open/closed principle made operational. A seam that exists
 * only as a TypeScript interface pins down shapes, not behaviour: a second
 * adapter typechecks perfectly well while returning `undefined` where the first
 * returned a scope, letting two siblings collide on one key, or putting a
 * second `save()` beside the first instead of over it. Those are exactly the
 * faults that only surface in use.
 *
 * So the behaviour lives here. Adding a new place to keep things is:
 *
 * ```ts
 * // src/adapters/disk/DiskScopeStore.test.ts
 * describeScopeStore('disk', () => new DiskScopeStore(tmpdir()))
 * ```
 *
 * That is the entire admission test, and it takes milliseconds.
 *
 * It is `describeProjectStore` with the two records merged and four clauses
 * added, all four about the tree: the root exists on an empty store and can be
 * saved, a child is listed under its parent, a nested scope is kept apart from
 * its parent, and a reserved name is refused. And, since a second writer, the
 * clauses about a save that says what it expects to overwrite.
 *
 * Named `.contract.ts` and not `.test.ts` on purpose: the runner must not pick
 * it up on its own, because without an adapter there is nothing to run.
 */
import { describe, expect, it } from 'vitest'
import type { DesignElement } from '../model'
import type { HostModel } from '../model/hostModel'
import { isScopeMoved } from '../projects/revision'
import { bareScope, flattenScopes } from '../projects/scope'
import type { ScopeSnapshot } from '../projects/scope'
import { ROOT_SCOPE, scopePathLabel } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import type { ScopeStore } from './ScopeStore'

function element(id: string, name: string): DesignElement {
  return { id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {} }
}

export const SAMPLE_PATH: ScopePath = 'acme-logistics/landscape'

/** Small but real: two diagrams, a relation, and an uploaded mark. */
export function sampleScope(over: Partial<ScopeSnapshot> = {}): ScopeSnapshot {
  const model: HostModel = {
    name: 'Application landscape',
    elements: [element('crews', 'Crews'), element('reisinfo', 'Reisinformatie')],
    relations: [{ id: 'c#1', type: 'flow', sourceId: 'crews', targetId: 'reisinfo', isBidirectional: false }],
    diagrams: [
      {
        id: 'l7', kind: 'layer7', name: 'Landschap',
        members: [{ id: 'crews' }], geometry: { nodes: [{ id: 'crews', x: 10, y: 20 }] },
      },
      { id: 'cd', kind: 'container', name: 'Crews · containers', members: [], geometry: { nodes: [] } },
    ],
    ...(over.model ?? {}),
  }
  return {
    path: SAMPLE_PATH,
    activeDiagramId: 'l7',
    logoLibrary: [{ key: 'lib:own', label: 'Own', url: 'data:image/svg+xml;base64,PHN2Zy8+' }],
    ...over,
    model,
  }
}

/** The same scope filed somewhere else, for the addressing checks. */
export function scopeAt(path: ScopePath, name = scopePathLabel(path)): ScopeSnapshot {
  const base = sampleScope()
  return { ...base, path, model: { ...base.model, name } }
}

/**
 * JSON with its object keys sorted, so a comparison is about content and not
 * about the order a store happened to rebuild the object in.
 */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, held: unknown) => {
    if (!held || typeof held !== 'object' || Array.isArray(held)) return held
    const record = held as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().map((k) => [k, record[k]]))
  })
}

/**
 * One element without its description — what {@link ScopeStore.models} is
 * allowed not to have read, because prose is a file of its own.
 */
function withoutProse(element: DesignElement): Omit<DesignElement, 'description'> {
  const { description: _filed, ...rest } = element
  return rest
}

/** Every path the listing holds, root first. */
async function paths(store: ScopeStore): Promise<ScopePath[]> {
  return flattenScopes(await store.list()).map((scope) => scope.path)
}

/**
 * A fresh, empty store that keeps a scope in more than one piece, and a way to
 * make one of those pieces refuse to be read — the way a file a sync client
 * holds, or one whose permission was withdrawn, refuses. `file` is the piece
 * as the folder format names it inside the scope's folder (`model.json`,
 * `docs/<id>.md`, `images/<file>`), because that format is what says what a
 * scope's pieces are; `undefined` reads everything again.
 */
export type RefusingStore = {
  store: ScopeStore
  refuse(path: ScopePath, file: string | undefined): void | Promise<void>
}

/**
 * What a filling can offer beyond `create`. `refusing` is for a store that
 * keeps a scope in pieces — a folder, a server over one — and is what the
 * clauses about a piece that would not read run over. A store that keeps each
 * scope whole has no piece to fail on its own, and offers none.
 */
export type ScopeStoreOptions = {
  refusing?: () => RefusingStore | Promise<RefusingStore>
}

/**
 * The test. `create` must hand back an empty, fresh store on every call —
 * otherwise one test leaks into the next and the suite proves nothing.
 *
 * It may answer with a promise, because a store that answers over a network is
 * connected before it is a store. Every clause awaits it; a maker that is
 * synchronous is awaited too and nothing about its run changes.
 */
export function describeScopeStore(
  name: string, create: () => ScopeStore | Promise<ScopeStore>, options: ScopeStoreOptions = {},
): void {
  describe(`ScopeStore contract: ${name}`, () => {
    /**
     * The root is not created; it is where you are. A store that answered with
     * nothing would leave the organisation screen with nothing to draw and no
     * way to make the first scope.
     */
    it('has a root on an empty store, and nothing under it', async () => {
      const store = await create()
      const root = await store.list()
      expect(root.path).toBe(ROOT_SCOPE)
      expect(root.children).toEqual([])
      await expect(store.load(SAMPLE_PATH)).resolves.toBeUndefined()
    })

    it('saves the root scope and reads it back', async () => {
      const store = await create()
      await store.save(bareScope(ROOT_SCOPE, 'Acme Logistics', 'organisation'))
      const root = await store.list()
      expect(root.name).toBe('Acme Logistics')
      expect(root.kind).toBe('organisation')
      expect((await store.load(ROOT_SCOPE))?.model.name).toBe('Acme Logistics')
    })

    it('gives back what was saved, at its own path', async () => {
      const store = await create()
      const scope = sampleScope()
      await store.save(scope)
      const back = await store.load(SAMPLE_PATH)
      expect(back).toMatchObject({
        path: SAMPLE_PATH,
        activeDiagramId: 'l7',
        logoLibrary: scope.logoLibrary,
      })
      expect(back?.model).toEqual(scope.model)
    })

    /**
     * What this build wrote is not something an older build wrote.
     *
     * The one clause about {@link ScopeStore.outdated} that every store has to
     * satisfy, whether or not it can answer at all: a store that called its own
     * freshest write outdated would rewrite the folder on every open.
     */
    it('does not call what it has just written outdated', async () => {
      const store = await create()
      await store.save(sampleScope())
      await expect(store.outdated?.() ?? Promise.resolve([])).resolves.toEqual([])
    })

    it('does not answer for a path that was never saved', async () => {
      const store = await create()
      await store.save(sampleScope())
      await expect(store.load('other/landscape')).resolves.toBeUndefined()
      await expect(store.load('acme-logistics/other')).resolves.toBeUndefined()
    })

    it('keeps two scopes under the same parent apart', async () => {
      const store = await create()
      await store.save(scopeAt('acme/one', 'One'))
      await store.save(scopeAt('acme/two', 'Two'))
      expect((await store.load('acme/one'))?.model.name).toBe('One')
      expect((await store.load('acme/two'))?.model.name).toBe('Two')
    })

    it('keeps the same name under two parents apart', async () => {
      // The whole reason the tree exists: this tool is shared with the people
      // whose landscape it describes, and everybody calls their first one the
      // same thing.
      const store = await create()
      await store.save(scopeAt('acme/landscape', 'Acme'))
      await store.save(scopeAt('globex/landscape', 'Globex'))
      expect((await store.load('acme/landscape'))?.model.name).toBe('Acme')
      expect((await store.load('globex/landscape'))?.model.name).toBe('Globex')
    })

    it('keeps a nested scope apart from its parent', async () => {
      const store = await create()
      await store.save(scopeAt('acme', 'Parent'))
      await store.save(scopeAt('acme/rail', 'Nested'))
      expect((await store.load('acme'))?.model.name).toBe('Parent')
      expect((await store.load('acme/rail'))?.model.name).toBe('Nested')
    })

    /** The listing is the tree, so a child has to arrive under its own parent. */
    it('lists a child under its parent', async () => {
      const store = await create()
      await store.save(bareScope('acme', 'Acme', 'domain'))
      await store.save(scopeAt('acme/rail', 'Rail'))
      const root = await store.list()
      expect(root.children.map((child) => child.path)).toEqual(['acme'])
      expect(root.children[0].children.map((child) => child.path)).toEqual(['acme/rail'])
      expect(root.children[0].kind).toBe('domain')
    })

    it('counts the views a scope holds, so a screen need not load it', async () => {
      const store = await create()
      await store.save(sampleScope())
      await store.save(bareScope('acme-logistics', 'Acme Logistics'))
      const [, domain, landscape] = flattenScopes(await store.list())
      expect(domain.diagrams).toBe(0)
      expect(landscape.diagrams).toBe(2)
    })

    /**
     * The six folders a scope writes into. A child scope called `decisions`
     * would be a folder whose meaning depends on what is inside it.
     */
    it('refuses a scope named after one of its own folders', async () => {
      const store = await create()
      await expect(store.save(scopeAt('acme/decisions'))).rejects.toBeInstanceOf(Error)
      await expect(store.load('acme/decisions')).resolves.toBeUndefined()
    })

    it('overwrites in place rather than accumulating', async () => {
      const store = await create()
      await store.save(sampleScope())
      await store.save(sampleScope({ activeDiagramId: 'cd' }))
      expect(await paths(store)).toContain(SAMPLE_PATH)
      expect((await store.load(SAMPLE_PATH))?.activeDiagramId).toBe('cd')
    })

    /**
     * A save may say what it expects to overwrite (`projects/revision.ts`).
     *
     * The clauses a whole write outside the open session leans on: the
     * organisation screen's dialogs, the gestures and a move each read a scope,
     * change it and write it back, and somebody else's save in between is work
     * that a blind write takes away without telling anybody.
     */
    it('stamps what it read, and the same state twice is the same revision', async () => {
      const store = await create()
      await store.save(sampleScope())
      const one = await store.load(SAMPLE_PATH)
      const two = await store.load(SAMPLE_PATH)
      expect(one?.revision, 'revision').toBeTruthy()
      expect(two?.revision).toBe(one?.revision)
    })

    it('lands a save that expects what it read, and moves the revision', async () => {
      const store = await create()
      await store.save(sampleScope())
      const read = await store.load(SAMPLE_PATH)
      const changed = { ...read!, model: { ...read!.model, name: 'Renamed' } }
      await store.save(changed, read!.revision)
      const back = await store.load(SAMPLE_PATH)
      expect(back?.model.name).toBe('Renamed')
      expect(back?.revision).not.toBe(read?.revision)
    })

    it('refuses a save that expects a revision somebody else has saved over, and keeps theirs', async () => {
      const store = await create()
      await store.save(sampleScope())
      const mine = await store.load(SAMPLE_PATH)
      const theirs = await store.load(SAMPLE_PATH)
      await store.save({ ...theirs!, model: { ...theirs!.model, name: 'Theirs' } }, theirs!.revision)

      const refused = await store.save(
        { ...mine!, model: { ...mine!.model, name: 'Mine' } }, mine!.revision,
      ).then(() => undefined, (cause: unknown) => cause)
      expect(isScopeMoved(refused), String(refused)).toBe(true)
      expect((await store.load(SAMPLE_PATH))?.model.name).toBe('Theirs')
    })

    it('refuses a save that expects a scope removed since it was read', async () => {
      const store = await create()
      await store.save(scopeAt('acme/one', 'One'))
      const read = await store.load('acme/one')
      await store.remove('acme/one')
      const refused = await store.save(read!, read!.revision).then(() => undefined, (cause: unknown) => cause)
      expect(isScopeMoved(refused), String(refused)).toBe(true)
      await expect(store.load('acme/one')).resolves.toBeUndefined()
    })

    it('overwrites whatever is there when a save expects nothing', async () => {
      const store = await create()
      await store.save(sampleScope())
      const stale = await store.load(SAMPLE_PATH)
      await store.save(sampleScope({ activeDiagramId: 'cd' }))
      await store.save({ ...stale!, model: { ...stale!.model, name: 'Blind' } })
      expect((await store.load(SAMPLE_PATH))?.model.name).toBe('Blind')
    })

    it('lists a summary of every scope it holds', async () => {
      const store = await create()
      await store.save(sampleScope({ kind: 'landscape', client: 'Acme Logistics BV' }))
      const held = flattenScopes(await store.list()).find((s) => s.path === SAMPLE_PATH)
      expect(held).toMatchObject({
        path: SAMPLE_PATH,
        name: 'Application landscape',
        kind: 'landscape',
        client: 'Acme Logistics BV',
      })
    })

    it('stamps a save so a screen can order by it', async () => {
      const store = await create()
      await store.save(sampleScope())
      const held = flattenScopes(await store.list()).find((s) => s.path === SAMPLE_PATH)
      expect(held?.updatedAt, 'updatedAt').toBeTruthy()
      expect(Number.isNaN(Date.parse(held!.updatedAt!))).toBe(false)
    })

    it('forgets a scope after remove()', async () => {
      const store = await create()
      await store.save(sampleScope())
      await store.remove(SAMPLE_PATH)
      await expect(store.load(SAMPLE_PATH)).resolves.toBeUndefined()
      expect(await paths(store)).not.toContain(SAMPLE_PATH)
    })

    it('removes only what it was asked to', async () => {
      const store = await create()
      await store.save(scopeAt('acme/one'))
      await store.save(scopeAt('acme/two'))
      await store.remove('acme/one')
      expect(await paths(store)).toContain('acme/two')
    })

    /** A child left behind by a removed parent is addressed by nothing. */
    it('removes the scopes filed under the one it removes', async () => {
      const store = await create()
      await store.save(scopeAt('acme'))
      await store.save(scopeAt('acme/rail'))
      await store.remove('acme')
      await expect(store.load('acme/rail')).resolves.toBeUndefined()
    })

    it('does not mind remove() for something that is not there', async () => {
      await expect((await create()).remove(SAMPLE_PATH)).resolves.toBeUndefined()
    })

    it('refuses to file a scope at an unusable path', async () => {
      // A segment that is not a slug could walk out of its own folder once a
      // store keeps scopes on disk. Refusing here means no adapter has to
      // sanitise.
      const store = await create()
      await expect(store.save({ ...sampleScope(), path: '../escape' }))
        .rejects.toBeInstanceOf(Error)
    })

    /**
     * A move is save-then-remove, and what is under the scope has to survive
     * it: the children were never the parent's files to write, and removing the
     * old address must not be what takes them away.
     */
    it('keeps the children when a scope is moved by saving and then removing', async () => {
      const store = await create()
      await store.save(scopeAt('acme', 'Acme'))
      await store.save(scopeAt('acme/rail', 'Rail'))
      const held = await store.load('acme')
      await store.save({ ...held!, path: 'globex' })
      expect((await store.load('acme/rail'))?.model.name).toBe('Rail')
      expect((await store.load('globex'))?.model.name).toBe('Acme')
    })

    it('keeps the scope intact across a round trip', async () => {
      // Deeper than `toEqual`, which treats a dropped field and a field set to
      // `undefined` as the same thing — and losing fields is exactly what an
      // adapter that goes through JSON does quietly. Key order is allowed to
      // differ: a store may rebuild the object, and several do.
      const store = await create()
      const scope = sampleScope({ kind: 'landscape', client: 'Acme BV', links: [{ label: 'Wiki', url: 'https://example.test/wiki' }] })
      await store.save(scope)
      const back = await store.load(SAMPLE_PATH)
      // The two a store stamps on a read, and nothing else.
      expect(stableJson({ ...back, updatedAt: undefined, revision: undefined }))
        .toBe(stableJson({ ...scope, updatedAt: undefined }))
    })

    /**
     * A domain draws nothing and is still a scope. At format 4 a folder with no
     * views did not load at all, which would now hide a domain's decisions, its
     * documents and everything filed under it.
     */
    it('loads a scope that holds no views, because that is a domain', async () => {
      const store = await create()
      await store.save(bareScope('acme', 'Acme', 'domain'))
      const back = await store.load('acme')
      expect(back?.model.name).toBe('Acme')
      expect(back?.model.diagrams).toEqual([])
    })

    it('keeps the decisions a scope carries, verbatim', async () => {
      const store = await create()
      const scope = bareScope('acme', 'Acme', 'domain')
      scope.model.decisions = [{
        id: 'adr-1', number: 1, title: 'Use one identity provider', status: 'accepted',
        date: '2026-09-01', body: '## Context\n\nEvery landscape logs in differently.',
        signers: [{ name: 'A. Architect', role: 'Lead', verdict: 'approved', signedAt: '2026-09-01' }],
      }]
      await store.save(scope)
      expect((await store.load('acme'))?.model.decisions).toEqual(scope.model.decisions)
    })

    /**
     * The clause about {@link ScopeStore.models} (ADR-0012 §2): a store that
     * can answer it must answer for every scope it lists, with the same
     * records and rows `load()` gives.
     *
     * Both halves matter and they fail differently. A scope missing from this
     * is a scope whose definitions the index cannot see, so every stand-in of
     * them reads as dangling and the register loses a domain's applications; a
     * model that disagrees with `load()` is worse, because it is a drift
     * finding about a difference that only exists inside the store.
     *
     * Descriptions are the one thing deliberately left out — they are a file
     * per element and the index never reads one — so the comparison is of the
     * records without their prose.
     */
    /**
     * The clause about {@link ScopeStore.descriptions}: the prose `load()`
     * gives, by id, and nothing for a scope the store does not hold.
     */
    it('answers one scope\'s descriptions as load() gives them', async () => {
      const store = await create()
      const scope = sampleScope()
      scope.model.elements = scope.model.elements.map((element, n) => (
        n === 0 ? { ...element, description: 'What it does, in prose.' } : element
      ))
      await store.save(scope)
      if (!store.descriptions) return
      const loaded = await store.load(scope.path)
      const expected: Record<string, string> = {}
      for (const element of loaded?.model.elements ?? []) {
        if (element.description !== undefined) expected[element.id] = element.description
      }
      expect(await store.descriptions(scope.path)).toEqual(expected)
      expect(await store.descriptions('nowhere')).toBeUndefined()
    })

    it('answers for every scope it lists, with the models load() gives', async () => {
      const store = await create()
      await store.save(bareScope(ROOT_SCOPE, 'Acme Logistics', 'organisation'))
      await store.save(bareScope('acme-logistics', 'Acme', 'domain'))
      // A plan on the landscape, because the roadmap of a scope above reads
      // the initiatives below it off this clause (ADR-0012 §7).
      const withPlan = sampleScope()
      withPlan.model.transitions = [{
        id: 'tr-1', number: 1, title: 'Move the rating', status: 'agreed', initiative: true,
        elements: [], decisions: [], milestones: [], body: '',
      }]
      await store.save(withPlan)
      if (!store.models) return

      const models = await store.models()
      expect([...models.map((held) => held.path)].sort()).toEqual((await paths(store)).sort())
      for (const held of models) {
        const loaded = await store.load(held.path)
        expect(stableJson(held.model.elements.map(withoutProse)))
          .toBe(stableJson((loaded?.model.elements ?? []).map(withoutProse)))
        expect(stableJson(held.model.relations)).toBe(stableJson(loaded?.model.relations ?? []))
        expect(stableJson(held.model.transitions ?? [])).toBe(stableJson(loaded?.model.transitions ?? []))
      }
    })

    it('names itself, so a message can say where it went wrong', async () => {
      expect((await create()).id).toBeTruthy()
    })

    describePiecesItCouldNotRead(options.refusing)
  })
}

/**
 * **A save removes only what a read took in** (ADR-0028, amended). A save
 * writes what the snapshot holds and removes what it no longer produces, so a
 * piece the read left out — because it would not read — is one the next save
 * would remove as no longer wanted, with nobody having wanted that. Where the
 * scope can be understood without the piece it is left where it is; where it
 * cannot — the model — the scope opens to be read and nothing is written.
 */
function describePiecesItCouldNotRead(refusing: ScopeStoreOptions['refusing']): void {
  const described = () => {
    const scope = sampleScope()
    scope.model.elements = scope.model.elements.map((one) => ({ ...one, description: `All about ${one.name}.` }))
    return scope
  }

  describe.skipIf(!refusing)('a piece of a scope it could not read', () => {
    it('keeps a description it could not read through the next save', async () => {
      const { store, refuse } = await refusing!()
      await store.save(described())
      await refuse(SAMPLE_PATH, 'docs/crews.md')
      const opened = await store.load(SAMPLE_PATH)
      expect(opened).toBeDefined()
      await store.save({ ...opened!, model: { ...opened!.model, name: 'Renamed' } })
      await refuse(SAMPLE_PATH, undefined)

      const again = await store.load(SAMPLE_PATH)
      expect(again?.model.name).toBe('Renamed')
      expect(again?.model.elements.find((one) => one.id === 'crews')?.description).toBe('All about Crews.')
    })

    it('keeps a picture it could not read through the next save', async () => {
      const { store, refuse } = await refusing!()
      await store.save({ ...described(), imageLibrary: [{ file: 'map.png', url: 'data:image/png;base64,iVBORw0KGgo=' }] })
      await refuse(SAMPLE_PATH, 'images/map.png')
      const opened = await store.load(SAMPLE_PATH)
      expect(opened).toBeDefined()
      await store.save(opened!)
      await refuse(SAMPLE_PATH, undefined)

      expect((await store.load(SAMPLE_PATH))?.imageLibrary?.map((one) => one.file)).toEqual(['map.png'])
    })

    it('opens a scope whose model will not read to be looked at, and writes nothing over it', async () => {
      const { store, refuse } = await refusing!()
      await store.save(described())
      await refuse(SAMPLE_PATH, 'model.json')
      const opened = await store.load(SAMPLE_PATH)
      expect(opened?.unreadable).toContain('model.json')
      await expect(store.save(opened!)).rejects.toThrow()
      await refuse(SAMPLE_PATH, undefined)

      const again = await store.load(SAMPLE_PATH)
      expect(again?.unreadable).toBeUndefined()
      expect(again?.model.elements.map((one) => one.description))
        .toEqual(['All about Crews.', 'All about Reisinformatie.'])
    })
  })
}
