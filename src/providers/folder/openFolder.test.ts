// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What opening a folder does before anything in it is read: the pull, where
 * this person said to, and the format pass — each asked only where there is
 * something to learn, and each beginning with an entry where the folder keeps
 * a history the desktop can record into.
 */
import { describe, expect, it, vi } from 'vitest'
import { FakeDirectory } from '../../adapters/folder/fakeDirectory'
import type { PersonSettings } from '../../adapters/folder/FolderSettingsRepository'
import { RecordingDiagnostics } from '../../adapters/memory/RecordingDiagnostics'
import type { PullOutcome } from '../../platform/sync'
import { readScope, summaryOf } from '../../projects/scopeAccess'
import type { FolderGit } from '../../adapters/folder/folderGit'
import type { FolderSync } from './folderOwn'
import { openFolder } from './openFolder'

function person(pullOnOpen: boolean): PersonSettings {
  let held = { git: { pullOnOpen, pushAfterSnapshot: false } }
  return {
    read: () => Promise.resolve(held),
    write: (next) => { held = next as typeof held; return Promise.resolve() },
  }
}

function sync(answers: { pull?: PullOutcome; keeping?: boolean } = {}) {
  const asked: string[] = []
  const remote: FolderSync = {
    available: () => Promise.resolve(true),
    keeping: () => Promise.resolve(answers.keeping ?? true),
    pull: vi.fn(() => { asked.push('pull'); return Promise.resolve(answers.pull ?? 'done') }),
    push: () => Promise.resolve('done'),
    resolve: () => Promise.resolve('done'),
    record: vi.fn((subject: string) => { asked.push(`record ${subject}`); return Promise.resolve(true) }),
  }
  return { remote, asked }
}

const base = () => ({ diagnostics: new RecordingDiagnostics() })

describe('the pull as a folder opens', () => {
  it('records everything first, then pulls, and hands what it answered to the chrome', async () => {
    const held = sync({ pull: 'diverged' })
    const parts = await openFolder(
      { handle: new FakeDirectory('Architecture'), name: 'Architecture', root: '/work', sync: held.remote, person: person(true) },
      base(),
    )
    expect(held.asked).toEqual(['record Before syncing', 'pull'])
    expect(parts.own.pulled).toBe('diverged')
  })

  it('records in the person\'s language', async () => {
    const held = sync()
    const { translator } = await import('../../i18n')
    await openFolder(
      { handle: new FakeDirectory('Architecture'), name: 'Architecture', root: '/work', sync: held.remote, person: person(true) },
      { ...base(), s: translator('nl') },
    )
    expect(held.asked[0]).toBe('record Voor het synchroniseren')
  })

  it('asks nothing of the remote where this person did not say to pull', async () => {
    const held = sync()
    const parts = await openFolder(
      { handle: new FakeDirectory('Architecture'), name: 'Architecture', root: '/work', sync: held.remote, person: person(false) },
      base(),
    )
    expect(held.asked).toEqual([])
    expect(parts.own.pulled).toBeUndefined()
  })

  it('pulls nothing into a folder that keeps no history', async () => {
    const held = sync({ keeping: false })
    await openFolder(
      { handle: new FakeDirectory('Architecture'), name: 'Architecture', root: '/work', sync: held.remote, person: person(true) },
      base(),
    )
    expect(held.asked).toEqual([])
  })

  it('opens the folder anyway where the pull fell over, and says so in the trail', async () => {
    const held = sync()
    held.remote.pull = () => Promise.reject(new Error('no network'))
    const diagnostics = new RecordingDiagnostics()
    const parts = await openFolder(
      { handle: new FakeDirectory('Architecture'), name: 'Architecture', root: '/work', sync: held.remote, person: person(true) },
      { diagnostics },
    )
    expect(parts.own.pulled).toBeUndefined()
    expect(diagnostics.recent().map((entry) => entry.message)).toContain('pull on open failed')
  })
})

describe('the format pass as a folder opens', () => {
  /** A scope as a build before scopes wrote it, and the organisation's name where that build kept it. */
  async function older(): Promise<FakeDirectory> {
    const root = new FakeDirectory('Architecture')
    const settings = await root.getDirectoryHandle('.lionsville-architecture', { create: true })
    ;(settings as FakeDirectory).writeRaw('folder.json', JSON.stringify({ version: 1, organisation: { name: 'Acme Logistics' } }))
    const scope = await (await root.getDirectoryHandle('acme', { create: true })).getDirectoryHandle('warehouse', { create: true })
    ;(scope as FakeDirectory).writeRaw('project.json', JSON.stringify({
      type: 'lionsville-architecture', formatVersion: 4, name: 'Warehouse', groupName: 'Acme', activeDiagramId: '', diagrams: [],
    }))
    ;(scope as FakeDirectory).writeRaw('model.json', JSON.stringify({ elements: [], relations: [] }))
    return root
  }

  it('brings an older folder up to date before its repositories read it, recording first', async () => {
    const held = sync()
    const parts = await openFolder(
      { handle: await older(), name: 'Architecture', root: '/work', sync: held.remote, person: person(false) },
      base(),
    )
    expect(held.asked).toEqual(['record Before upgrading the file format'])
    const tree = summaryOf(await parts.repositories.scopes.tree())
    expect(tree.name).toBe('Acme Logistics')
    expect((await readScope(parts.repositories.scopes, 'acme/warehouse'))?.model.name).toBe('Warehouse')
  })

  it('upgrades a folder with no history to record into, and records nothing', async () => {
    const parts = await openFolder({ handle: await older(), name: 'Architecture', root: 'Architecture' }, base())
    expect((await readScope(parts.repositories.scopes, 'acme/warehouse'))?.model.name).toBe('Warehouse')
  })

  it('records nothing where there is nothing to upgrade', async () => {
    const held = sync()
    await openFolder(
      { handle: new FakeDirectory('Architecture'), name: 'Architecture', root: '/work', sync: held.remote, person: person(false) },
      base(),
    )
    expect(held.asked).toEqual([])
  })
})

describe('whether the folder keeps a history an entry can go into', () => {
  /** A git that answers the two questions as the case says, and is never asked anything else. */
  function git(keeping: boolean, readiness: () => Promise<'ready'>): FolderGit & { started: boolean } {
    const held = {
      started: false,
      keeping: () => Promise.resolve(keeping),
      readiness,
      start: () => { held.started = true; return Promise.resolve() },
    }
    return held as unknown as FolderGit & { started: boolean }
  }

  const opened = (history: FolderGit) => openFolder({ handle: new FakeDirectory('Architecture'), name: 'Architecture', root: '/work', git: history }, base())

  it('does where the folder keeps one and git can write to it', async () => {
    const parts = await opened(git(true, () => Promise.resolve('ready')))
    expect(await parts.historyKept?.()).toBe(true)
  })

  it('does not where the folder keeps none, and starts none by asking', async () => {
    const history = git(false, () => Promise.resolve('ready'))
    const parts = await opened(history)
    expect(await parts.historyKept?.()).toBe(false)
    expect(history.started).toBe(false)
  })

  it('does not where git is missing on this machine, or too old', async () => {
    const parts = await opened(git(true, () => Promise.reject(new Error('gitMissing'))))
    expect(await parts.historyKept?.()).toBe(false)
  })
})
