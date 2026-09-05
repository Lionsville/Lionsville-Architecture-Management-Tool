import { describe, expect, it } from 'vitest'
import { SAMPLE_REF, describeProjectStore, sampleProject } from '../../ports/ProjectStore.contract'
import { InMemoryProjectStore } from './InMemoryProjectStore'

describeProjectStore('memory', () => new InMemoryProjectStore())

describe('InMemoryProjectStore', () => {
  it('may be seeded with projects to start from', async () => {
    const store = new InMemoryProjectStore([sampleProject()])
    expect((await store.load(SAMPLE_REF))?.activeDiagramId).toBe('l7')
  })

  it('does not hand back the same reference it was given', async () => {
    // Otherwise a test using this store proves nothing about a real adapter,
    // which goes through JSON and returns a copy by definition.
    const store = new InMemoryProjectStore()
    const project = sampleProject()
    await store.save(project)
    const back = await store.load(SAMPLE_REF)
    expect(back?.model).toEqual(project.model)
    expect(back).not.toBe(project)
    expect(back?.model).not.toBe(project.model)
  })
})
