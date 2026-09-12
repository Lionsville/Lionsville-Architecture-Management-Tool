import { describe, expect, it } from 'vitest'
import { SAMPLE_PATH, describeScopeStore, sampleScope } from '../../ports/ScopeStore.contract'
import { InMemoryScopeStore } from './InMemoryScopeStore'

describeScopeStore('memory', () => new InMemoryScopeStore())

describe('InMemoryScopeStore', () => {
  it('may be seeded with scopes to start from', async () => {
    const store = new InMemoryScopeStore([sampleScope()])
    expect((await store.load(SAMPLE_PATH))?.activeDiagramId).toBe('l7')
  })

  it('does not hand back the same reference it was given', async () => {
    // Otherwise a test using this store proves nothing about a real adapter,
    // which goes through JSON and returns a copy by definition.
    const store = new InMemoryScopeStore()
    const scope = sampleScope()
    await store.save(scope)
    const back = await store.load(SAMPLE_PATH)
    expect(back?.model).toEqual(scope.model)
    expect(back).not.toBe(scope)
    expect(back?.model).not.toBe(scope.model)
  })

  /** The folder you opened is not something this app may throw away. */
  it('will not remove the root', async () => {
    const store = new InMemoryScopeStore([sampleScope()])
    await store.remove('')
    expect((await store.load(SAMPLE_PATH))?.model.name).toBe('Application landscape')
  })
})
