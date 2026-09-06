/**
 * What every group store must do — written once, run by all of them.
 *
 * Same bargain as `ProjectStore.contract.ts`: the interface pins the shapes, and
 * this pins the behaviour. Adding a place to keep group records is
 *
 * ```ts
 * describeGroupStore('disk', () => new DiskGroupStore(tmpdir()))
 * ```
 *
 * and nothing else.
 *
 * Named `.contract.ts` so the runner does not pick it up on its own.
 */
import { describe, expect, it } from 'vitest'
import type { GroupProfile } from '../projects/group'
import type { GroupStore } from './GroupStore'

export function sampleProfile(over: Partial<GroupProfile> = {}): GroupProfile {
  return {
    group: 'acme-logistics',
    name: 'Acme Logistics',
    description: 'Rail freight, three programmes.',
    links: [{ label: 'Wiki', url: 'https://example.test/wiki' }],
    ...over,
  }
}

export function describeGroupStore(name: string, make: () => GroupStore): void {
  describe(`GroupStore contract — ${name}`, () => {
    it('starts empty', async () => {
      expect(await make().list()).toEqual([])
    })

    it('returns what it stored, unchanged', async () => {
      const store = make()
      const profile = sampleProfile()
      await store.save(profile)
      expect(await store.list()).toEqual([profile])
    })

    it('a second save replaces the first rather than sitting beside it', async () => {
      const store = make()
      await store.save(sampleProfile())
      await store.save(sampleProfile({ name: 'Acme Rail', description: undefined }))
      const held = await store.list()
      expect(held).toHaveLength(1)
      expect(held[0].name).toBe('Acme Rail')
      expect(held[0].description).toBeUndefined()
    })

    it('keeps a nested group apart from its parent', async () => {
      const store = make()
      await store.save(sampleProfile({ group: 'acme', name: 'Acme' }))
      await store.save(sampleProfile({ group: 'acme/rail', name: 'Acme Rail' }))
      const held = await store.list()
      expect(held.map((p) => p.group).sort()).toEqual(['acme', 'acme/rail'])
    })

    it('forgets one, and forgetting an absent one is not an error', async () => {
      const store = make()
      await store.save(sampleProfile())
      await store.remove('acme-logistics')
      expect(await store.list()).toEqual([])
      await expect(store.remove('never-existed')).resolves.toBeUndefined()
    })

    /**
     * The same rule the project store is held to: a path that is not a slug
     * could escape its own folder once a store keeps records on disk, so it is
     * refused at the seam rather than sanitised in each adapter.
     */
    it('refuses a group path that could escape its own folder', async () => {
      const store = make()
      await expect(store.save(sampleProfile({ group: '../elsewhere' }))).rejects.toThrow()
      await expect(store.save(sampleProfile({ group: '' }))).rejects.toThrow()
      expect(await store.list()).toEqual([])
    })

    it('keeps the decisions a group carries, verbatim', async () => {
      const store = make()
      const profile = sampleProfile({
        decisions: [{
          id: 'adr-1', number: 1, title: 'Use one identity provider', status: 'accepted',
          date: '2026-09-01', body: '## Context\n\nEvery project logs in differently.',
          signers: [{ name: 'A. Architect', role: 'Lead', verdict: 'approved', signedAt: '2026-09-01' }],
        }],
      })
      await store.save(profile)
      expect(await store.list()).toEqual([profile])
    })

    it('survives a round trip with no links and no description', async () => {
      const store = make()
      const bare: GroupProfile = { group: 'plain', name: 'Plain' }
      await store.save(bare)
      expect(await store.list()).toEqual([bare])
    })
  })
}
