/**
 * What every store must do — written once, run by all of them.
 *
 * This file is the open/closed principle made operational. A seam that exists
 * only as a TypeScript interface pins down shapes, not behaviour: a second
 * adapter typechecks perfectly well while returning `undefined` where the first
 * returned a project, letting two groups' projects collide on one key, or
 * putting a second `save()` beside the first instead of over it. Those are
 * exactly the faults that only surface in use.
 *
 * So the behaviour lives here. Adding a new place to keep things is:
 *
 * ```ts
 * // src/adapters/disk/DiskProjectStore.test.ts
 * describeProjectStore('disk', () => new DiskProjectStore(tmpdir()))
 * ```
 *
 * That is the entire admission test, and it takes milliseconds.
 *
 * Named `.contract.ts` and not `.test.ts` on purpose: the runner must not pick
 * it up on its own, because without an adapter there is nothing to run.
 */
import { describe, expect, it } from 'vitest'
import type { DesignElement } from '../model'
import type { HostModel } from '../model/fromInterchange'
import type { ProjectSnapshot } from '../projects/project'
import { parentScope, ROOT_SCOPE, scopePathLabel } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import type { ProjectStore } from './ProjectStore'

function element(id: string, name: string): DesignElement {
  return { id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {} }
}

export const SAMPLE_PATH: ScopePath = 'acme-logistics/landscape'

/** Small but real: two diagrams, a connection, and an uploaded mark. */
export function sampleProject(over: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  const model: HostModel = {
    name: 'Application landscape',
    customerName: 'Acme Logistics',
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

/**
 * The same project filed somewhere else, for the addressing checks.
 *
 * The group's name follows the path rather than staying the sample's own, so an
 * ordering test actually exercises grouping instead of comparing one string
 * with itself.
 */
export function projectAt(path: ScopePath, name = scopePathLabel(path)): ProjectSnapshot {
  const base = sampleProject()
  const group = parentScope(path) ?? ROOT_SCOPE
  return { ...base, path, model: { ...base.model, name, customerName: group } }
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
 * The test. `create` must hand back an empty, fresh store on every call —
 * otherwise one test leaks into the next and the suite proves nothing.
 */
export function describeProjectStore(name: string, create: () => ProjectStore): void {
  describe(`ProjectStore contract: ${name}`, () => {
    it('starts empty', async () => {
      const store = create()
      await expect(store.list()).resolves.toEqual([])
      await expect(store.load(SAMPLE_PATH)).resolves.toBeUndefined()
    })

    it('gives back what was saved, under its own path', async () => {
      const store = create()
      const project = sampleProject()
      await store.save(project)
      const back = await store.load(SAMPLE_PATH)
      expect(back).toMatchObject({
        path: SAMPLE_PATH,
        activeDiagramId: 'l7',
        logoLibrary: project.logoLibrary,
      })
      expect(back?.model).toEqual(project.model)
    })

    /**
     * What this build wrote is not something an older build wrote.
     *
     * The one clause about {@link ProjectStore.outdated} that every store has
     * to satisfy, whether or not it can answer at all: a store that called its
     * own freshest write outdated would rewrite the folder on every open.
     */
    it('does not call what it has just written outdated', async () => {
      const store = create()
      await store.save(sampleProject())
      await expect(store.outdated?.() ?? Promise.resolve([])).resolves.toEqual([])
    })

    it('does not answer for a path that was never saved', async () => {
      const store = create()
      await store.save(sampleProject())
      await expect(store.load('other/landscape')).resolves.toBeUndefined()
      await expect(store.load('acme-logistics/other'))
        .resolves.toBeUndefined()
    })

    it('keeps two projects in the same group apart', async () => {
      const store = create()
      await store.save(projectAt('acme/one', 'One'))
      await store.save(projectAt('acme/two', 'Two'))
      expect((await store.load('acme/one'))?.model.name).toBe('One')
      expect((await store.load('acme/two'))?.model.name).toBe('Two')
      expect(await store.list()).toHaveLength(2)
    })

    it('keeps the same project key in two groups apart', async () => {
      // The whole reason the group level exists: this tool is shared with the
      // people whose landscape it describes, and everybody calls their first
      // project the same thing.
      const store = create()
      await store.save(projectAt('acme/landscape', 'Acme'))
      await store.save(projectAt('globex/landscape', 'Globex'))
      expect((await store.load('acme/landscape'))?.model.name).toBe('Acme')
      expect((await store.load('globex/landscape'))?.model.name).toBe('Globex')
    })

    it('keeps a nested group apart from its parent', async () => {
      // Groups do not nest in the UI yet; the store must not be what stops them.
      const store = create()
      await store.save(projectAt('acme/landscape', 'Parent'))
      await store.save(projectAt('acme/rail/landscape', 'Nested'))
      expect((await store.load('acme/landscape'))?.model.name).toBe('Parent')
      expect((await store.load('acme/rail/landscape'))?.model.name).toBe('Nested')
    })

    it('overwrites in place rather than accumulating', async () => {
      const store = create()
      await store.save(sampleProject())
      await store.save(sampleProject({ activeDiagramId: 'cd' }))
      expect(await store.list()).toHaveLength(1)
      expect((await store.load(SAMPLE_PATH))?.activeDiagramId).toBe('cd')
    })

    it('lists in a stable alphabetical order', async () => {
      // Deterministic, and the same from every store: the picker offers recency
      // as an option and re-sorts for it, but a store must not decide that.
      const store = create()
      await store.save(projectAt('zeta/one', 'Zeta one'))
      await store.save(projectAt('alpha/two', 'Alpha two'))
      await store.save(projectAt('alpha/one', 'Alpha one'))
      expect((await store.list()).map((s) => `${s.groupName}/${s.name}`))
        .toEqual(['alpha/Alpha one', 'alpha/Alpha two', 'zeta/Zeta one'])
    })

    it('lists a summary of every project it holds', async () => {
      const store = create()
      await store.save(sampleProject())
      const [summary] = await store.list()
      expect(summary).toMatchObject({
        path: SAMPLE_PATH,
        name: 'Application landscape',
        groupName: 'Acme Logistics',
      })
    })

    it('stamps a save so the picker can order by it', async () => {
      const store = create()
      await store.save(sampleProject())
      const [summary] = await store.list()
      expect(summary.updatedAt, 'updatedAt').toBeTruthy()
      expect(Number.isNaN(Date.parse(summary.updatedAt!))).toBe(false)
    })

    it('forgets a project after remove()', async () => {
      const store = create()
      await store.save(sampleProject())
      await store.remove(SAMPLE_PATH)
      await expect(store.load(SAMPLE_PATH)).resolves.toBeUndefined()
      await expect(store.list()).resolves.toEqual([])
    })

    it('removes only what it was asked to', async () => {
      const store = create()
      await store.save(projectAt('acme/one'))
      await store.save(projectAt('acme/two'))
      await store.remove('acme/one')
      expect(await store.list()).toHaveLength(1)
    })

    it('does not mind remove() for something that is not there', async () => {
      await expect(create().remove(SAMPLE_PATH)).resolves.toBeUndefined()
    })

    it('refuses to file a project under an unusable path', async () => {
      // A key that is not a slug could walk out of its own folder once a store
      // keeps projects on disk. Refusing here means no adapter has to sanitise.
      const store = create()
      const bad = { ...sampleProject(), path: '../escape' }
      await expect(store.save(bad)).rejects.toBeInstanceOf(Error)
    })

    it('keeps the project intact across a round trip', async () => {
      // Deeper than `toEqual`, which treats a dropped field and a field set to
      // `undefined` as the same thing — and losing fields is exactly what an
      // adapter that goes through JSON does quietly. Key order is allowed to
      // differ: a store may rebuild the object, and several do.
      const store = create()
      const project = sampleProject()
      await store.save(project)
      const back = await store.load(SAMPLE_PATH)
      expect(stableJson({ ...back, updatedAt: undefined }))
        .toBe(stableJson({ ...project, updatedAt: undefined }))
    })

    it('returns undefined for a stored project with no diagrams', async () => {
      // A model without diagrams is not half a project but a broken one: there
      // is nothing to show. Every store should reach that verdict the same way.
      const store = create()
      const empty = sampleProject()
      empty.model = { ...empty.model, diagrams: [] }
      await store.save(empty)
      await expect(store.load(SAMPLE_PATH)).resolves.toBeUndefined()
      await expect(store.list()).resolves.toEqual([])
    })

    it('names itself, so a message can say where it went wrong', () => {
      expect(create().id).toBeTruthy()
    })
  })
}
