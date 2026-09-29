// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the app keeps about each folder, through the channels the renderer
 * calls: only for a folder the user granted, and one file per folder.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const electron = vi.hoisted(() => ({
  data: '',
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
}))

vi.mock('electron', () => ({
  app: { getPath: () => electron.data },
  ipcMain: { handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => electron.handlers.set(channel, handler) },
}))
vi.mock('./files', () => ({ isGranted: (root: unknown) => root === '/work/acme' || root === '/work/globex' }))
vi.mock('./log', () => ({ log: vi.fn() }))

const call = (channel: string, ...args: unknown[]) => electron.handlers.get(channel)!({}, ...args)

beforeAll(async () => {
  const { registerFolderSettingsChannel } = await import('./folderSettings')
  registerFolderSettingsChannel()
})

beforeEach(async () => {
  electron.data = await mkdtemp(join(tmpdir(), 'lvarch-settings-'))
})

afterEach(async () => {
  await rm(electron.data, { recursive: true, force: true })
})

describe('what the app keeps about each folder', () => {
  it('answers nothing about a folder the user did not grant, and writes nothing for one', async () => {
    for (const part of ['Steps', 'Places', 'Stamps']) {
      await expect(call(`settings:writeFolder${part}`, '/elsewhere', {})).rejects.toThrow('shell.pathRefused')
      expect(await call(`settings:readFolder${part}`, '/elsewhere')).toBeUndefined()
    }
    await expect(readdir(electron.data)).resolves.toEqual([])
  })

  it('keeps one file per folder, and every part of one folder’s file through writes that race', async () => {
    const stamp = { size: 1, lastModified: 2, contentAddress: 'sha256:ab', width: 3, height: 4 }
    await Promise.all([
      call('settings:writeFolderSteps', '/work/acme', { 'step-1': ['s-1', 1000] }),
      call('settings:writeFolderPlaces', '/work/acme', { 's-1': 'acme' }),
      call('settings:writeFolderStamps', '/work/acme', { 'acme\u0000map.png': stamp }),
      call('settings:writeFolderSteps', '/work/globex', { 'step-2': ['s-2', 2000] }),
    ])
    expect(await call('settings:readFolderSteps', '/work/acme')).toEqual({ 'step-1': ['s-1', 1000] })
    expect(await call('settings:readFolderPlaces', '/work/acme')).toEqual({ 's-1': 'acme' })
    expect(await call('settings:readFolderStamps', '/work/acme')).toEqual({ 'acme\u0000map.png': stamp })
    expect(await call('settings:readFolderSteps', '/work/globex')).toEqual({ 'step-2': ['s-2', 2000] })
    expect(await call('settings:readFolderPlaces', '/work/globex')).toBeUndefined()
    expect(await readdir(join(electron.data, 'folders'))).toHaveLength(2)
  })
})
