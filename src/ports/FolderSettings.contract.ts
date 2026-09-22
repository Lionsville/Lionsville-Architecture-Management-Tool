// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What every folder-settings store must do — written once, run by all of them.
 *
 * Same bargain as `ProjectStore.contract.ts`: the interface pins the shapes and
 * this pins the behaviour. The maker takes the files to plant first, because
 * half of the contract is about what a store does with a file it did not write
 * — a colleague's, a newer build's, a hand-edited one.
 *
 * Named `.contract.ts` so the runner does not pick it up on its own.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCAL_SETTINGS, FOLDER_SETTINGS_PATH, LOCAL_SETTINGS_PATH } from '../projects/folderSettings'
import type { FolderSettingsStore } from './FolderSettings'

export type SeededStore = {
  store: FolderSettingsStore
  /**
   * The text at a path, as it now stands — the two paths ADR-0005 named, as
   * this store keeps them. A store that keeps the machine file elsewhere
   * (the desktop's, ADR-0023) answers `LOCAL_SETTINGS_PATH` with the text it
   * holds for the folder, wherever that is, and the maker plants the seed
   * the same way.
   */
  textAt(path: string): Promise<string | undefined>
}

/**
 * `make` may answer with a promise, for the same reason `describeScopeStore`'s
 * maker may: a store that answers over a network is connected before it is a
 * store. Every clause awaits it, and a synchronous maker runs as it always did.
 */
export function describeFolderSettings(
  name: string, make: (files?: Record<string, string>) => SeededStore | Promise<SeededStore>,
): void {
  describe(`FolderSettings contract — ${name}`, () => {
    it('reads the defaults from a folder with no settings at all', async () => {
      const { store } = await make()
      expect(await store.readLocal()).toEqual(DEFAULT_LOCAL_SETTINGS)
      expect(await store.readFolder()).toEqual({})
    })

    it('reads back what it wrote, and only under its own path', async () => {
      const { store, textAt } = await make()
      await store.writeLocal({ git: { pullOnOpen: true } })
      expect((await store.readLocal()).git.pullOnOpen).toBe(true)
      expect(await textAt(LOCAL_SETTINGS_PATH)).toContain('"pullOnOpen": true')
    })

    it('patches: a second write leaves the first flag standing', async () => {
      const { store } = await make()
      await store.writeLocal({ git: { pullOnOpen: true } })
      await store.writeLocal({ git: { pushAfterSnapshot: true } })
      expect(await store.readLocal()).toEqual({ git: { pullOnOpen: true, pushAfterSnapshot: true } })
    })

    it('carries a newer build’s keys through a write', async () => {
      const { store, textAt } = await make({
        [LOCAL_SETTINGS_PATH]: '{"version":2,"git":{"pullOnOpen":false,"rebase":true}}\n',
      })
      await store.writeLocal({ git: { pullOnOpen: true } })
      const held = JSON.parse((await textAt(LOCAL_SETTINGS_PATH))!)
      expect(held.git.rebase).toBe(true)
      expect(held.version).toBe(2)
      expect(held.git.pullOnOpen).toBe(true)
    })

    it('reads a malformed file as the defaults rather than failing', async () => {
      const { store } = await make({ [LOCAL_SETTINGS_PATH]: 'not json at all' })
      expect(await store.readLocal()).toEqual(DEFAULT_LOCAL_SETTINGS)
    })

    it('never writes the shared file for a machine setting', async () => {
      const { store, textAt } = await make()
      await store.writeLocal({ git: { pullOnOpen: true } })
      expect(await textAt('.lionsville-architecture/folder.json')).toBeUndefined()
    })

    /**
     * The shared file is read for the one key an older build wrote — the
     * organisation's name, before the root scope existed to hold it (ADR-0012
     * §1) — and never written (ADR-0023): the folder is a person's.
     */
    it('reads the name an older build wrote, and leaves the shared file exactly as it found it', async () => {
      const planted = '{"version":1,"organisation":{"name":"Acme Logistics"},"somethingLater":true}\n'
      const { store, textAt } = await make({ [FOLDER_SETTINGS_PATH]: planted })
      expect((await store.readFolder()).legacyOrganisationName).toBe('Acme Logistics')
      await store.writeLocal({ git: { pullOnOpen: true } })
      expect(await textAt(FOLDER_SETTINGS_PATH)).toBe(planted)
    })
  })
}
