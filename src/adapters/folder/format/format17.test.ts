// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Format 17: the organisation's scales and a function's ratings (ADR-0046), the
 * confirmed or assumed mark (ADR-0047), a Noted observation (ADR-0038, amended)
 * and an assignment's end by a leaving (ADR-0036, amended), each read back as
 * written through the folder and the working file. A 16 reads as a 17 that says
 * none of them, the pass rewrites the headers and nothing else, and a 17 is
 * refused by a build that reads 16, which would drop them on its way back.
 */
import { describe, expect, it } from 'vitest'
import acmeLogistics from './examples/acme-logistics.json' with { type: 'json' }
import type { HostModel } from '../../../model/hostModel'
import type { DesignElement, Relation } from '../../../model/types'
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
import { openDocumentBytes, workingFileBytes } from './workingFile'

const textOf = (file: FolderFile) => ('text' in file ? file.text : new TextDecoder().decode(file.bytes))

function at(version: number, file: FolderFile): FolderFile {
  const name = file.path.split('/').pop()
  return name === SCOPE_FILE
    ? { path: file.path, text: textOf(file).replace(`"version": ${SCOPE_FORMAT_VERSION}`, `"version": ${version}`) }
    : file
}

async function plant(root: FakeDirectory, files: readonly FolderFile[], under = ''): Promise<void> {
  for (const file of files) {
    const parts = `${under}${file.path}`.split('/')
    const name = parts.pop()!
    let dir: DirectoryHandleLike = root
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true })
    const handle = await dir.getFileHandle(name, { create: true })
    const writable = await handle.createWritable()
    await writable.write('text' in file ? file.text : file.bytes)
    await writable.close()
  }
}

async function textAt(root: FakeDirectory, path: string): Promise<string> {
  const parts = path.split('/')
  const name = parts.pop()!
  let dir: DirectoryHandleLike = root
  for (const part of parts) dir = await dir.getDirectoryHandle(part)
  return (await (await dir.getFileHandle(name)).getFile()).text()
}

const element = (id: string, over: Partial<DesignElement>): DesignElement => ({
  id, name: id, kind: 'application', lifecycle: 'live', isManaged: true, aspects: {}, ...over,
})

const said: Partial<HostModel> = {
  aspectScales: [{ key: 'maturity', label: 'Maturity', min: 1, max: 5 }, { key: 'custom-risk', label: 'Risk', code: 'RSK', min: 0, max: 3 }],
  elements: [
    element('billing', { certainty: 'confirmed', owner: 'Revenue systems' }),
    element('fulfilment', { kind: 'function', ratings: { maturity: 3, 'custom-risk': 1 }, certainty: 'assumed' }),
  ],
  relations: [
    { id: 'c1', type: 'flow', sourceId: 'billing', targetId: 'fulfilment', certainty: 'assumed' } satisfies Relation,
  ],
  observations: [{
    id: 'ob-1', number: 1, title: 'Seen', date: '2026-11-01', impact: 'minor', seen: 1, body: 'What was seen.', noted: true,
    history: [{ date: '2026-11-01', kind: 'recorded' }, { date: '2026-11-02', kind: 'noted', note: 'A fact, nothing to explain' }],
  }],
  assignments: [
    { id: 'as-1', unitId: 'team', roleId: 'ro-1', person: { person: 'pe-1' }, until: '2026-10-31', endedByLeaving: {} },
    { id: 'as-2', unitId: 'team', roleId: 'ro-1', person: { person: 'pe-1' }, until: '2026-10-31', endedByLeaving: { until: '2027-06-30' } },
  ],
}

function organisation(): ScopeSnapshot {
  const scope = bareScope('', 'Acme', 'organisation')
  return { ...scope, model: { ...scope.model, ...said } }
}

function pick(model: HostModel) {
  const { aspectScales, elements, relations, observations, assignments } = model
  return { aspectScales, elements, relations, observations, assignments }
}

describe('format 17', () => {
  it('is what a scope is written at now, one past 16', () => {
    expect(SCOPE_FORMAT_VERSION).toBe(16 + 1)
    const header = scopeFiles(organisation()).find((file) => file.path === SCOPE_FILE)!
    expect(JSON.parse(textOf(header)).version).toBe(17)
    expect(JSON.parse(textOf(header)).aspectScales).toEqual(said.aspectScales)
  })

  it('reads back as written, through the folder and the working file', () => {
    expect(pick(scopeFromFolder(scopeFiles(organisation()), '')!.model)).toMatchObject(pick(organisation().model))
    const held = organisation()
    const opened = openDocumentBytes(workingFileBytes([held]), held)
    if (!opened.ok) throw new Error('did not open')
    expect(pick(opened.scope.model)).toMatchObject(pick(held.model))
  })

  it('passes over a scale a hand got wrong, and keeps the rest of the header', () => {
    const files = scopeFiles(organisation()).map((file) => {
      if (file.path !== SCOPE_FILE) return file
      const header = JSON.parse(textOf(file))
      header.aspectScales = [{ key: 'maturity', label: 'Maturity', min: 5, max: 1 }, { key: 'reach', label: 'Reach' }, 'not one']
      return { path: file.path, text: JSON.stringify(header) }
    })
    expect(scopeFromFolder(files, '')?.model.aspectScales).toEqual([{ key: 'reach', label: 'Reach', min: 1, max: 5 }])
  })
})

describe('a folder written at format 16', () => {
  it('is brought up by the pass: the headers turn, every other file stays as it was, and no scope moves', async () => {
    const before = exampleFiles(acmeLogistics as ExampleFolder).map((file) => at(16, file))
    const root = new FakeDirectory('Architecture')
    await plant(root, before)
    const store = new FileSystemScopeStore(root)
    const scopes = flattenScopes(await store.list()).map((scope) => scope.path).sort()
    expect((await store.outdated()).sort()).toEqual(scopes)
    expect(await upgradeProjects(store)).toMatchObject({ upgraded: scopes.length, created: 0, failed: 0 })
    expect(root.paths().sort()).toEqual(before.map((file) => file.path).sort())
    for (const file of before) {
      const now = await textAt(root, file.path)
      if (file.path.split('/').pop() === SCOPE_FILE) expect(JSON.parse(now).version).toBe(SCOPE_FORMAT_VERSION)
      else expect(now, file.path).toBe(textOf(file))
    }
  })
})

describe('a folder written at format 17, opened by a build that reads 16', () => {
  it('is refused rather than saved without what only 17 keeps', async () => {
    const files = scopeFiles({ ...organisation(), path: 'customer' }).map((file) => at(SCOPE_FORMAT_VERSION + 1, file))
    expect(scopeFromFolder(files, 'customer')).toBeUndefined()
    const root = new FakeDirectory('Architecture')
    await plant(root, scopeFiles(bareScope('', 'Acme', 'organisation')))
    await plant(root, files, 'customer/')
    const store = new FileSystemScopeStore(root)
    expect((await store.list()).unreadable).toEqual(['customer'])
    await expect(store.save(bareScope('customer', 'Customer', 'domain'))).rejects.toMatchObject({ key: 'shell.unreadableNotSaved' })
  })
})
