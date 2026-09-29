// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What every settings repository must do — written once, run by all of them.
 *
 * Three sets kept apart, a write that is a patch, and a key nobody here knows
 * carried through a write: the same bargain `FolderSettings.contract.ts`
 * struck, said about whose settings they are rather than where they are kept.
 *
 * Named `.contract.ts` so the runner does not pick it up on its own.
 */
import { describe, expect, it } from 'vitest'
import { ok, over } from './Repositories.contract'
import type { MakeRepositories } from './Repositories.contract'

export function describeSettingsRepository(name: string, make: MakeRepositories): void {
  describe(`SettingsRepository contract — ${name}`, () => {
    const fresh = async () => {
      const repositories = over(await make())
      return { repositories, acme: await repositories.scope('acme', 'Acme Logistics') }
    }

    it('names itself', async () => {
      const { repositories } = await fresh()
      expect(repositories.settings.id).toMatch(/\S/)
    })

    it('reads every set nobody wrote as empty', async () => {
      const { repositories, acme } = await fresh()
      expect(await repositories.settings.read({ of: 'organisation' })).toEqual({})
      expect(await repositories.settings.read({ of: 'scope', scope: acme })).toEqual({})
      expect(await repositories.settings.read({ of: 'person' })).toEqual({})
    })

    it('reads back what it wrote, and answers the set as it now is', async () => {
      const { repositories } = await fresh()
      const answered = await repositories.settings.write({ of: 'organisation' }, { review: { quorum: 2 } })
      expect(answered).toEqual({ review: { quorum: 2 } })
      expect(await repositories.settings.read({ of: 'organisation' })).toEqual({ review: { quorum: 2 } })
    })

    it('patches: a second write leaves the first standing, at any depth', async () => {
      const { repositories } = await fresh()
      await repositories.settings.write({ of: 'person' }, { review: { onOpen: true }, language: 'nl' })
      await repositories.settings.write({ of: 'person' }, { review: { afterStep: true } })
      expect(await repositories.settings.read({ of: 'person' }))
        .toEqual({ review: { onOpen: true, afterStep: true }, language: 'nl' })
    })

    it('takes a key out for `null`, and replaces a list whole', async () => {
      const { repositories } = await fresh()
      await repositories.settings.write({ of: 'organisation' }, { tags: ['a', 'b'], stale: 'yes', keep: 1 })
      await repositories.settings.write({ of: 'organisation' }, { tags: ['c'], stale: null })
      expect(await repositories.settings.read({ of: 'organisation' })).toEqual({ tags: ['c'], keep: 1 })
    })

    it('carries a key it knows nothing about through a write of another', async () => {
      const { repositories } = await fresh()
      await repositories.settings.write({ of: 'organisation' }, { fromANewerBuild: { mode: 'strict', level: 3 } })
      await repositories.settings.write({ of: 'organisation' }, { review: { quorum: 2 } })
      expect(await repositories.settings.read({ of: 'organisation' }))
        .toEqual({ fromANewerBuild: { mode: 'strict', level: 3 }, review: { quorum: 2 } })
    })

    it('keeps the organisation’s, each scope’s and the person’s own apart', async () => {
      const { repositories, acme } = await fresh()
      const globex = await repositories.scope('globex', 'Globex')
      await repositories.settings.write({ of: 'organisation' }, { who: 'organisation' })
      await repositories.settings.write({ of: 'scope', scope: acme }, { who: 'acme' })
      await repositories.settings.write({ of: 'scope', scope: globex }, { who: 'globex' })
      await repositories.settings.write({ of: 'person' }, { who: 'me' })
      expect(await repositories.settings.read({ of: 'organisation' })).toEqual({ who: 'organisation' })
      expect(await repositories.settings.read({ of: 'scope', scope: acme })).toEqual({ who: 'acme' })
      expect(await repositories.settings.read({ of: 'scope', scope: globex })).toEqual({ who: 'globex' })
      expect(await repositories.settings.read({ of: 'person' })).toEqual({ who: 'me' })
      // The organisation is a scope too, and its scope settings are not the organisation's.
      expect(await repositories.settings.read({ of: 'scope', scope: await repositories.root() })).toEqual({})
    })

    it('keeps a scope’s settings through a move, because they follow the identity', async () => {
      const { repositories, acme } = await fresh()
      await repositories.settings.write({ of: 'scope', scope: acme }, { review: { quorum: 3 } })
      ok(await repositories.move(acme, 'globex/acme'))
      expect(await repositories.settings.read({ of: 'scope', scope: acme })).toEqual({ review: { quorum: 3 } })
    })

    it('keeps the settings of the scopes under a moved one', async () => {
      const { repositories } = await fresh()
      const rail = await repositories.scope('globex/rail', 'Rail')
      const stock = await repositories.scope('globex/rail/rolling-stock', 'Rolling stock')
      await repositories.settings.write({ of: 'scope', scope: stock }, { review: { quorum: 1 } })
      ok(await repositories.move(rail, 'initech/rail'))
      expect(await repositories.settings.read({ of: 'scope', scope: stock })).toEqual({ review: { quorum: 1 } })
    })

    it('starts a scope created where a removed one was with no settings, its own and its children’s', async () => {
      const { repositories, acme } = await fresh()
      const rail = await repositories.scope('acme/rail', 'Rail')
      await repositories.settings.write({ of: 'scope', scope: acme }, { who: 'acme' })
      await repositories.settings.write({ of: 'scope', scope: rail }, { who: 'rail' })
      ok(await repositories.remove(acme))
      const again = await repositories.scope('acme/rail', 'Rail again')
      expect(await repositories.settings.read({ of: 'scope', scope: again })).toEqual({})
      expect(await repositories.settings.read({ of: 'scope', scope: await repositories.scopeAt('acme') })).toEqual({})
    })

    it('hands out settings nobody else holds: changing what it answered changes nothing it keeps', async () => {
      const { repositories } = await fresh()
      await repositories.settings.write({ of: 'organisation' }, { review: { quorum: 2 } })
      const answered = await repositories.settings.read({ of: 'organisation' }) as { review: { quorum: number } }
      answered.review.quorum = 9
      expect(await repositories.settings.read({ of: 'organisation' })).toEqual({ review: { quorum: 2 } })
    })
  })
}
