// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Format 15 (ADR-0038, amended 25 October 2026; ADR-0041 to ADR-0043): what
 * release 3.8.0 keeps, in one turn. An observation says its tone and who
 * recorded it, read back as written through the folder and the working file
 * alike. A folder written at 14 reads as a 15 in which a bright spot is
 * `bright`, every other observation neutral and nobody said to have recorded
 * anything; the pass that brings it up rewrites the headers and nothing else;
 * and a 15 is refused by a build that reads 14, rather than read with every
 * neutral observation taken for a problem.
 */
import { describe, expect, it } from 'vitest'
import acmeLogistics from './examples/acme-logistics.json' with { type: 'json' }
import type { Observation } from '../../../model/observation'
import { bareScope, flattenScopes } from '../../../projects/scope'
import type { ScopeSnapshot } from '../../../projects/scope'
import { FakeDirectory } from '../fakeDirectory'
import type { DirectoryHandleLike } from '../FileSystemScopeStore'
import { FileSystemScopeStore } from '../FileSystemScopeStore'
import { exampleFiles } from './exampleFolder'
import type { ExampleFolder } from './exampleFolder'
import { SCOPE_FILE, SCOPE_FORMAT_VERSION, scopeFiles, scopeFromFolder } from './folderFormat'
import type { FolderFile } from './folderFormat'
import { upgradeProjects } from './migration'
import { observationFileText, observationFromFile } from './observationFile'
import { openDocumentBytes, workingFileBytes } from './workingFile'

const textOf = (file: FolderFile) => ('text' in file ? file.text : new TextDecoder().decode(file.bytes))

/** A header saying another version; any other file as it is. */
function at(version: number, file: FolderFile): FolderFile {
  const name = file.path.split('/').pop()
  return name === SCOPE_FILE
    ? { path: file.path, text: textOf(file).replace(`"version": ${SCOPE_FORMAT_VERSION}`, `"version": ${version}`) }
    : file
}

function observation(id: string, number: number, extra: Partial<Observation> = {}): Observation {
  return {
    id, number, title: `Seen ${number}`, date: '2026-10-01', impact: 'minor', seen: 1, body: 'What was seen.',
    history: [{ date: '2026-10-01', kind: 'recorded' }], ...extra,
  }
}

const bright = observation('ob-1', 1, { tone: 'bright', recordedBy: { name: 'Ada Example', account: 'acc-ada', person: 'pe-ada' } })
const problem = observation('ob-2', 2, { tone: 'problem', recordedBy: { name: 'Ada Example', person: 'pe-ada', via: 'An agent' } })
const neutral = observation('ob-3', 3)

function customer(): ScopeSnapshot {
  const scope = bareScope('customer', 'Customer', 'domain')
  return { ...scope, model: { ...scope.model, observations: [bright, problem, neutral] } }
}

async function plant(root: FakeDirectory, files: readonly FolderFile[], under = ''): Promise<void> {
  for (const file of files) {
    const parts = `${under}${file.path}`.split('/')
    let folder: DirectoryHandleLike = root
    for (const segment of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(segment, { create: true })
    ;(folder as FakeDirectory).writeRaw(parts[parts.length - 1], textOf(file))
  }
}

async function textAt(root: FakeDirectory, path: string): Promise<string> {
  const parts = path.split('/')
  let folder: DirectoryHandleLike = root
  for (const segment of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(segment)
  return (await (await folder.getFileHandle(parts[parts.length - 1])).getFile()).text()
}

describe('format 15', () => {
  it('is what a scope is written at now, one past 14', () => {
    expect(SCOPE_FORMAT_VERSION).toBe(14 + 1)
    const header = scopeFiles(customer()).find((file) => file.path === SCOPE_FILE)!
    expect(JSON.parse(textOf(header)).version).toBe(15)
  })

  it('keeps each observation\'s tone and who recorded it, read back as written', () => {
    const back = scopeFromFolder(scopeFiles(customer()), 'customer')
    expect(back?.model.observations).toEqual([bright, problem, neutral])
  })

  it('carries them through a working file', () => {
    const held = customer()
    const opened = openDocumentBytes(workingFileBytes([held]), held)
    expect(opened.ok && opened.scope.model.observations).toEqual([bright, problem, neutral])
  })

  it('writes a neutral observation as one was written before, with no tone and nobody', () => {
    const text = observationFileText(neutral)
    expect(text).not.toMatch(/^tone:/m)
    expect(text).not.toMatch(/^recordedBy/m)
    expect(text).not.toMatch(/^bright:/m)
  })

  it('reads a 14\'s bright spot as bright and writes it as a tone', () => {
    const fourteen = observationFileText(neutral).replace('impact: minor', 'impact: minor\nbright: true')
    const read = observationFromFile(fourteen, 'observations/0003-seen-3.md')
    expect(read).toMatchObject({ id: 'ob-3', tone: 'bright' })
    expect(read?.bright).toBeUndefined()
    expect(observationFileText(read!)).toMatch(/^tone: bright$/m)
  })

  it('reads a tone it does not know, and a recorded-by with no name, as nothing', () => {
    const odd = observationFileText(neutral).replace('impact: minor', 'impact: minor\ntone: sunny\nrecordedByAccount: acc-x')
    const read = observationFromFile(odd, 'observations/0003-seen-3.md')
    expect(read?.tone).toBeUndefined()
    expect(read?.recordedBy).toBeUndefined()
  })
})

describe('a folder written at format 14', () => {
  it('is brought up to 15 by the pass: the headers turn, every other file stays as it was, and no scope moves', async () => {
    const before = exampleFiles(acmeLogistics as ExampleFolder).map((file) => at(14, file))
    const root = new FakeDirectory('Architecture')
    await plant(root, before)
    const store = new FileSystemScopeStore(root)
    const scopes = flattenScopes(await store.list()).map((scope) => scope.path).sort()
    expect((await store.outdated()).sort()).toEqual(scopes)
    expect(await upgradeProjects(store)).toMatchObject({ upgraded: scopes.length, created: 0, failed: 0 })
    expect(await store.outdated()).toEqual([])
    expect(root.paths().sort()).toEqual(before.map((file) => file.path).sort())
    for (const file of before) {
      const now = await textAt(root, file.path)
      if (file.path.split('/').pop() === SCOPE_FILE) expect(JSON.parse(now).version).toBe(15)
      else expect(now, file.path).toBe(textOf(file))
    }
  })
})

describe('a folder written at format 15, opened by a build that reads 14', () => {
  /** What a 15 is to a build whose newest is 14: a version one past its own, as this build sees a 16. */
  const later = (files: readonly FolderFile[]) => files.map((file) => at(SCOPE_FORMAT_VERSION + 1, file))

  it('is refused rather than read with every neutral observation taken for a problem', async () => {
    const files = later(scopeFiles(customer()))
    expect(scopeFromFolder(files, 'customer')).toBeUndefined()
    const root = new FakeDirectory('Architecture')
    await plant(root, scopeFiles(bareScope('', 'Acme', 'organisation')))
    await plant(root, files, 'customer/')
    const store = new FileSystemScopeStore(root)
    expect((await store.list()).unreadable).toEqual(['customer'])
    await expect(store.save(bareScope('customer', 'Customer', 'domain'))).rejects.toMatchObject({ key: 'shell.unreadableNotSaved' })
  })
})
