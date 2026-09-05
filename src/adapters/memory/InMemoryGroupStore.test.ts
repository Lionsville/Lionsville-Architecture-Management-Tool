import { describe, expect, it } from 'vitest'
import { describeGroupStore, sampleProfile } from '../../ports/GroupStore.contract'
import { InMemoryGroupStore } from './InMemoryGroupStore'

describeGroupStore('memory', () => new InMemoryGroupStore())

describe('InMemoryGroupStore', () => {
  it('may be seeded with profiles to start from', async () => {
    const store = new InMemoryGroupStore([sampleProfile()])
    expect((await store.list())[0].name).toBe('Acme Logistics')
  })

  it('does not hand back the same reference it was given', async () => {
    const store = new InMemoryGroupStore()
    const profile = sampleProfile()
    await store.save(profile)
    const back = (await store.list())[0]
    expect(back).toEqual(profile)
    expect(back).not.toBe(profile)
  })
})
