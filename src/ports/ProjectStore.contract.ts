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
import type { DesignElement } from '@lionsville/solution-design'
import type { HostModel } from '../core/model/fromInterchange'
import type { ProjectSnapshot } from '../core/project'
import type { ProjectRef } from '../core/projectRef'
import type { ProjectStore } from './ProjectStore'

function element(id: string, name: string): DesignElement {
  return { id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} }
}

export const SAMPLE_REF: ProjectRef = { group: 'acme-logistics', project: 'landscape' }

/** Small but real: two diagrams, a connection, and an uploaded mark. */
export function sampleProject(over: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  const model: HostModel = {
    name: 'Application landscape',
    customerName: 'Acme Logistics',
    elements: [element('crews', 'Crews'), element('reisinfo', 'Reisinformatie')],
    connections: [{ id: 'c#1', sourceId: 'crews', targetId: 'reisinfo', isBidirectional: false }],
    diagrams: [
      { id: 'l7', kind: 'layer7', name: 'Landschap', placements: [{ elementId: 'crews', x: 10, y: 20 }] },
      { id: 'cd', kind: 'container', name: 'Crews · containers', placements: [] },
    ],
    ...(over.model ?? {}),
  }
  return {
    ref: SAMPLE_REF,
    activeDiagramId: 'l7',
    logoLibrary: [{ key: 'lib:own', label: 'Own', url: 'data:image/svg+xml;base64,PHN2Zy8+' }],
    ...over,
    model,
  }
}

/**
 * The same project filed somewhere else, for the addressing checks.
 *
 * The group's name follows the ref rather than staying the sample's own, so an
 * ordering test actually exercises grouping instead of comparing one string
 * with itself.
 */
export function projectAt(ref: ProjectRef, name = ref.project): ProjectSnapshot {
  const base = sampleProject()
  return { ...base, ref, model: { ...base.model, name, customerName: ref.group } }
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
      await expect(store.load(SAMPLE_REF)).resolves.toBeUndefined()
    })

    it('gives back what was saved, under its own ref', async () => {
      const store = create()
      const project = sampleProject()
      await store.save(project)
      const back = await store.load(SAMPLE_REF)
      expect(back).toMatchObject({
        ref: SAMPLE_REF,
        activeDiagramId: 'l7',
        logoLibrary: project.logoLibrary,
      })
      expect(back?.model).toEqual(project.model)
    })

    it('does not answer for a ref that was never saved', async () => {
      const store = create()
      await store.save(sampleProject())
      await expect(store.load({ group: 'other', project: 'landscape' })).resolves.toBeUndefined()
      await expect(store.load({ group: 'acme-logistics', project: 'other' }))
        .resolves.toBeUndefined()
    })

    it('keeps two projects in the same group apart', async () => {
      const store = create()
      await store.save(projectAt({ group: 'acme', project: 'one' }, 'One'))
      await store.save(projectAt({ group: 'acme', project: 'two' }, 'Two'))
      expect((await store.load({ group: 'acme', project: 'one' }))?.model.name).toBe('One')
      expect((await store.load({ group: 'acme', project: 'two' }))?.model.name).toBe('Two')
      expect(await store.list()).toHaveLength(2)
    })

    it('keeps the same project key in two groups apart', async () => {
      // The whole reason the group level exists: this tool is shared with the
      // people whose landscape it describes, and everybody calls their first
      // project the same thing.
      const store = create()
      await store.save(projectAt({ group: 'acme', project: 'landscape' }, 'Acme'))
      await store.save(projectAt({ group: 'globex', project: 'landscape' }, 'Globex'))
      expect((await store.load({ group: 'acme', project: 'landscape' }))?.model.name).toBe('Acme')
      expect((await store.load({ group: 'globex', project: 'landscape' }))?.model.name).toBe('Globex')
    })

    it('keeps a nested group apart from its parent', async () => {
      // Groups do not nest in the UI yet; the store must not be what stops them.
      const store = create()
      await store.save(projectAt({ group: 'acme', project: 'landscape' }, 'Parent'))
      await store.save(projectAt({ group: 'acme/rail', project: 'landscape' }, 'Nested'))
      expect((await store.load({ group: 'acme', project: 'landscape' }))?.model.name).toBe('Parent')
      expect((await store.load({ group: 'acme/rail', project: 'landscape' }))?.model.name).toBe('Nested')
    })

    it('overwrites in place rather than accumulating', async () => {
      const store = create()
      await store.save(sampleProject())
      await store.save(sampleProject({ activeDiagramId: 'cd' }))
      expect(await store.list()).toHaveLength(1)
      expect((await store.load(SAMPLE_REF))?.activeDiagramId).toBe('cd')
    })

    it('lists in a stable alphabetical order', async () => {
      // Deterministic, and the same from every store: the picker offers recency
      // as an option and re-sorts for it, but a store must not decide that.
      const store = create()
      await store.save(projectAt({ group: 'zeta', project: 'one' }, 'Zeta one'))
      await store.save(projectAt({ group: 'alpha', project: 'two' }, 'Alpha two'))
      await store.save(projectAt({ group: 'alpha', project: 'one' }, 'Alpha one'))
      expect((await store.list()).map((s) => `${s.groupName}/${s.name}`))
        .toEqual(['alpha/Alpha one', 'alpha/Alpha two', 'zeta/Zeta one'])
    })

    it('lists a summary of every project it holds', async () => {
      const store = create()
      await store.save(sampleProject())
      const [summary] = await store.list()
      expect(summary).toMatchObject({
        ref: SAMPLE_REF,
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
      await store.remove(SAMPLE_REF)
      await expect(store.load(SAMPLE_REF)).resolves.toBeUndefined()
      await expect(store.list()).resolves.toEqual([])
    })

    it('removes only what it was asked to', async () => {
      const store = create()
      await store.save(projectAt({ group: 'acme', project: 'one' }))
      await store.save(projectAt({ group: 'acme', project: 'two' }))
      await store.remove({ group: 'acme', project: 'one' })
      expect(await store.list()).toHaveLength(1)
    })

    it('does not mind remove() for something that is not there', async () => {
      await expect(create().remove(SAMPLE_REF)).resolves.toBeUndefined()
    })

    it('refuses to file a project under an unusable ref', async () => {
      // A key that is not a slug could walk out of its own folder once a store
      // keeps projects on disk. Refusing here means no adapter has to sanitise.
      const store = create()
      const bad = { ...sampleProject(), ref: { group: '', project: '../escape' } }
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
      const back = await store.load(SAMPLE_REF)
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
      await expect(store.load(SAMPLE_REF)).resolves.toBeUndefined()
      await expect(store.list()).resolves.toEqual([])
    })

    it('names itself, so a message can say where it went wrong', () => {
      expect(create().id).toBeTruthy()
    })
  })
}
