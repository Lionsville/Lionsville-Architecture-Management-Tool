// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The folder's way in: on a desktop, where work is kept in a folder or
 * nowhere, and in a tab, which may be given one and is never made to take it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DesktopDirectory, DesktopFiles } from '../../adapters/desktop/channel'
import { chooseFolderDestination, FOLDER_SOURCE } from './folderSource'
import { desktopOpening } from './openings'

const location = { href: 'https://example.test/', search: '', hash: '' }
const work: DesktopDirectory = { root: '/work', name: 'work' }

function files(over: Partial<DesktopFiles> = {}): DesktopFiles {
  return {
    chooseDirectory: vi.fn(() => Promise.resolve(work)),
    recentDirectories: vi.fn(() => Promise.resolve([work, { root: '/older', name: 'older' }])),
    list: () => Promise.resolve(undefined),
    makeDirectory: () => Promise.resolve(),
    read: () => Promise.resolve(undefined),
    write: () => Promise.resolve({ mtimeMs: 1, size: 1, sha256: 'x' }),
    create: () => Promise.resolve(true),
    writeTogether: () => Promise.resolve([]),
    remove: () => Promise.resolve(),
    stamp: () => Promise.resolve(undefined),
    move: () => Promise.resolve(),
    fingerprint: () => Promise.resolve(undefined),
    revealInFolder: () => Promise.resolve(),
    saveDocument: () => Promise.resolve(true),
    watch: () => Promise.resolve(),
    unwatch: () => Promise.resolve(),
    onChanged: () => () => {},
    ...over,
  } as DesktopFiles
}

/** A desktop under the page, with the file channel it hands a renderer. */
function onDesktop(channel: DesktopFiles = files()): DesktopFiles {
  ;(window as unknown as { desktop?: unknown }).desktop = { files: channel }
  return channel
}

afterEach(() => { delete (window as unknown as { desktop?: unknown }).desktop })

const connect = FOLDER_SOURCE.connect!

describe('the folder\'s way in, on a desktop', () => {
  it('is needed before anything else, is the host\'s own Open…, and can always be taken', () => {
    onDesktop()
    expect(connect.required?.()).toBe(true)
    expect(connect.possible?.()).toBe(true)
    expect(connect.hostMenu).toBe(true)
  })

  it('chooses a folder with the desktop\'s dialog, as one the person just pointed the app at', async () => {
    onDesktop()
    const opening = await connect.open()
    expect([opening?.root, opening?.name, opening?.chosen]).toEqual(['/work', 'work', true])
  })

  it('resumes the folder the preferences name, only where the desktop still grants it', async () => {
    onDesktop()
    expect((await connect.resume?.({ workingDirectory: '/older' }))?.root).toBe('/older')
    expect(await connect.resume?.({ workingDirectory: '/gone' })).toBeUndefined()
    expect(await connect.resume?.({})).toBeUndefined()
  })

  it('remembers a choice in the preferences, keeping what else they hold', () => {
    const remembered = connect.remember?.({ language: 'nl', lastScope: 'acme' }, desktopOpening(onDesktop(), work))
    expect(remembered).toEqual({ language: 'nl', workingDirectory: '/work' })
  })

  it('lists the folders granted lately, and reopens one — under its last segment where the list does not name it', async () => {
    onDesktop()
    expect(await connect.recent?.()).toEqual([{ key: '/work', label: 'work' }, { key: '/older', label: 'older' }])
    expect((await connect.reopen?.('/older'))?.name).toBe('older')
    const unlisted = await connect.reopen?.('/tmp/lvarch-smoke-a/')
    expect([unlisted?.root, unlisted?.name, unlisted?.chosen]).toEqual(['/tmp/lvarch-smoke-a/', 'lvarch-smoke-a', true])
  })

  it('offers another folder where a folder is already open, and says nothing new otherwise', () => {
    expect(connect.offer?.({ source: { provider: 'folder', name: 'work', key: '/work' }, location }))
      .toEqual({ labelKey: 'picker.changeFolder' })
    expect(connect.offer?.({ source: { provider: 'elsewhere', name: 'x', key: 'x' }, location })).toBeUndefined()
  })

  it('opens a folder over the channel with its history and the person\'s settings, where the desktop keeps them', () => {
    const opening = desktopOpening(onDesktop(), work)
    expect([opening.name, opening.root, opening.historyNoteKey]).toEqual(['work', '/work', 'folder.historyNote'])
    expect(opening.channel).toBeDefined()
  })
})

describe('the folder\'s way in, in a tab with no picker', () => {
  it('is neither needed nor possible, and lists and reopens nothing', async () => {
    expect(connect.required?.()).toBe(false)
    expect(connect.possible?.()).toBe(false)
    expect(await connect.open()).toBeUndefined()
    expect(await connect.recent?.()).toEqual([])
    expect(await connect.reopen?.('/work')).toBeUndefined()
    expect(await connect.resume?.({ workingDirectory: '/work' })).toBeUndefined()
    expect(await chooseFolderDestination()).toBeUndefined()
  })
})
