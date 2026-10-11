// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What this person does about a folder on this desktop, kept by the desktop
 * beside the folder's path, and read where an older build left it in the
 * folder only while the desktop has nothing.
 */
import { describe, expect, it, vi } from 'vitest'
import type { LocalSettings, LocalSettingsPatch } from '../../adapters/folder/format/folderSettings'
import { meOf, mePatch } from '../../people/me'
import { machineFolderSettingsText, readMachineFolderSettings } from '../../platform/node/machineFolderSettings'
import { patchSettings } from '../../projects/settings'
import { desktopPerson } from './desktopPerson'

const settings = (pullOnOpen: boolean, pushAfterSnapshot = false): LocalSettings => ({ git: { pullOnOpen, pushAfterSnapshot } })

function channel(held: LocalSettings | undefined) {
  return {
    readFolderLocal: vi.fn((_root: string) => Promise.resolve(held)),
    writeFolderLocal: vi.fn((_root: string, patch: Partial<LocalSettings>) => Promise.resolve({ ...settings(false), ...patch } as LocalSettings)),
  }
}

describe('what this person does about a folder on this desktop', () => {
  it('is what the desktop keeps for the folder, by its path', async () => {
    const kept = channel(settings(true, true))
    const left = { readLocal: vi.fn(() => Promise.resolve(settings(false))) }
    expect(await desktopPerson(kept, '/work', left).read()).toEqual({ git: { pullOnOpen: true, pushAfterSnapshot: true } })
    expect(kept.readFolderLocal).toHaveBeenCalledWith('/work')
    expect(left.readLocal).not.toHaveBeenCalled()
  })

  it('is what an older build left in the folder, where the desktop has nothing yet', async () => {
    const left = { readLocal: vi.fn(() => Promise.resolve(settings(true))) }
    expect(await desktopPerson(channel(undefined), '/work', left).read()).toEqual({ git: { pullOnOpen: true, pushAfterSnapshot: false } })
  })

  it('is written to the desktop, beside the folder\'s path, and never into the folder', async () => {
    const kept = channel(undefined)
    await desktopPerson(kept, '/work', { readLocal: () => Promise.resolve(settings(false)) }).write({ git: { pullOnOpen: true, pushAfterSnapshot: false } })
    expect(kept.writeFolderLocal).toHaveBeenCalledWith('/work', { git: { pullOnOpen: true, pushAfterSnapshot: false }, people: { me: null } })
  })

  it('keeps who this person is (This is me) with the install, beside the folder\'s path, until they say nobody', async () => {
    let text: string | undefined
    const kept = {
      readFolderLocal: (root: string) => Promise.resolve(readMachineFolderSettings(text, root)),
      writeFolderLocal: (root: string, patch: LocalSettingsPatch) => {
        text = machineFolderSettingsText(text, root, patch)
        return Promise.resolve(readMachineFolderSettings(text, root)!)
      },
    }
    const person = desktopPerson(kept, '/work', { readLocal: () => Promise.resolve(settings(false)) })
    await person.write(patchSettings(await person.read(), mePatch('pe-1')))
    expect(meOf(await person.read())).toBe('pe-1')
    await person.write(patchSettings(await person.read(), { git: { pullOnOpen: true } }))
    expect(meOf(await person.read())).toBe('pe-1')
    expect((await person.read()).git).toEqual({ pullOnOpen: true, pushAfterSnapshot: false })
    await person.write(patchSettings(await person.read(), mePatch(undefined)))
    expect(meOf(await person.read())).toBeUndefined()
  })
})
