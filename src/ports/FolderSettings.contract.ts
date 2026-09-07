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
import { DEFAULT_LOCAL_SETTINGS, LOCAL_SETTINGS_PATH } from '../projects/folderSettings'
import type { FolderSettingsStore } from './FolderSettings'

export type SeededStore = {
  store: FolderSettingsStore
  /** The text at a path inside the folder, as it now stands. */
  textAt(path: string): Promise<string | undefined>
}

export function describeFolderSettings(
  name: string, make: (files?: Record<string, string>) => SeededStore,
): void {
  describe(`FolderSettings contract — ${name}`, () => {
    it('reads the defaults from a folder with no settings at all', async () => {
      const { store } = make()
      expect(await store.readLocal()).toEqual(DEFAULT_LOCAL_SETTINGS)
      expect(await store.readFolder()).toEqual({})
    })

    it('reads back what it wrote, and only under its own path', async () => {
      const { store, textAt } = make()
      await store.writeLocal({ git: { pullOnOpen: true } })
      expect((await store.readLocal()).git.pullOnOpen).toBe(true)
      expect(await textAt(LOCAL_SETTINGS_PATH)).toContain('"pullOnOpen": true')
    })

    it('patches: a second write leaves the first flag standing', async () => {
      const { store } = make()
      await store.writeLocal({ git: { pullOnOpen: true } })
      await store.writeLocal({ git: { pushAfterSnapshot: true } })
      expect(await store.readLocal()).toEqual({ git: { pullOnOpen: true, pushAfterSnapshot: true } })
    })

    it('carries a newer build’s keys through a write', async () => {
      const { store, textAt } = make({
        [LOCAL_SETTINGS_PATH]: '{"version":2,"git":{"pullOnOpen":false,"rebase":true}}\n',
      })
      await store.writeLocal({ git: { pullOnOpen: true } })
      const held = JSON.parse((await textAt(LOCAL_SETTINGS_PATH))!)
      expect(held.git.rebase).toBe(true)
      expect(held.version).toBe(2)
      expect(held.git.pullOnOpen).toBe(true)
    })

    it('reads a malformed file as the defaults rather than failing', async () => {
      const { store } = make({ [LOCAL_SETTINGS_PATH]: 'not json at all' })
      expect(await store.readLocal()).toEqual(DEFAULT_LOCAL_SETTINGS)
    })

    it('never writes the shared file, which has nothing to say yet', async () => {
      const { store, textAt } = make()
      await store.writeLocal({ git: { pullOnOpen: true } })
      expect(await textAt('.lionsville-architecture/folder.json')).toBeUndefined()
    })
  })
}
