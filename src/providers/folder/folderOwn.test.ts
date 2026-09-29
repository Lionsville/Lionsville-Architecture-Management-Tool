// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The folder's remote over the desktop's channel, and what this person said about it. */
import { describe, expect, it, vi } from 'vitest'
import type { DesktopHistory } from '../../adapters/desktop/channel'
import { desktopSync, syncSettingsOf } from './folderOwn'

describe('the folder\'s remote on the desktop', () => {
  it('is the desktop\'s git, bound to the folder', async () => {
    const git = {
      available: vi.fn(() => Promise.resolve(true)),
      isRepository: vi.fn(() => Promise.resolve(true)),
      pull: vi.fn(() => Promise.resolve('done')),
      push: vi.fn(() => Promise.resolve('rejected')),
      resolve: vi.fn(() => Promise.resolve('done')),
      snapshot: vi.fn(() => Promise.resolve(undefined)),
    } as unknown as DesktopHistory
    const sync = desktopSync(git, '/work')
    expect(await sync.available()).toBe(true)
    expect(await sync.keeping()).toBe(true)
    expect(await sync.pull()).toBe('done')
    expect(await sync.push()).toBe('rejected')
    expect(await sync.resolve('theirs')).toBe('done')
    // Nothing had changed, so nothing was recorded.
    expect(await sync.record('Before syncing')).toBe(false)
    expect(git.isRepository).toHaveBeenCalledWith('/work')
    expect(git.resolve).toHaveBeenCalledWith('/work', 'theirs')
    expect(git.snapshot).toHaveBeenCalledWith('/work', 'Before syncing')
  })
})

describe('what this person said about the remote', () => {
  it('is nothing done where nothing was said, and what was said where it was', () => {
    expect(syncSettingsOf({})).toEqual({ pullOnOpen: false, pushAfterSnapshot: false })
    expect(syncSettingsOf({ git: 'nonsense' })).toEqual({ pullOnOpen: false, pushAfterSnapshot: false })
    expect(syncSettingsOf({ git: { pullOnOpen: true, pushAfterSnapshot: 'yes' } })).toEqual({ pullOnOpen: true, pushAfterSnapshot: false })
  })
})
