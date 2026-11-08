// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The shipped example reads the same however it reaches a disk: copied file by
 * file as it stands, or read under the path it lands at by default. Its
 * stand-ins point at their definitions both ways, so the showcase greets
 * nobody with a check that is only about where the file was put.
 */
import { describe, expect, it } from 'vitest'
import folder from './examples/acme-logistics.json'
import { exampleFiles, exampleScopes } from './exampleFolder'
import type { ExampleFolder } from './exampleFolder'
import { FakeDirectory } from '../fakeDirectory'
import { folderRepositories } from '../folderRepositories'
import { memoryGit } from '../memoryGit'
import { writeAt } from '../handles'
import { indexScopes } from '../../../projects/scopeIndex'

const drifting = (scopes: Parameters<typeof indexScopes>[0]) => indexScopes(scopes).entries().filter((entry) => entry.stale.length > 0).map((entry) => entry.id)

describe('the shipped example, wherever it lands', () => {
  it('copied onto a disk file by file, its stand-ins point at their definitions', async () => {
    const root = new FakeDirectory()
    for (const file of exampleFiles(folder as ExampleFolder)) await writeAt(root, file.path, 'text' in file ? file.text : file.bytes)
    const read = await folderRepositories({ root, git: memoryGit(root) }).index.read()
    expect(read.scopes.map((one) => one.address)).toContain('application-landscape')
    expect(drifting(read.scopes.map((one) => ({ path: one.address, model: one.model })))).toEqual([])
  })

  it('read under the path it lands at, its refs and its causes\' links move with it', () => {
    const scopes = exampleScopes(folder as ExampleFolder, 'acme-logistics')
    expect(drifting(scopes)).toEqual([])
    const refs = new Set(scopes.flatMap((scope) => scope.model.elements.flatMap((element) => (element.ref === undefined ? [] : [element.ref]))))
    expect([...refs].sort()).toEqual(['acme-logistics', 'acme-logistics/platforms'])
    const links = scopes.flatMap((scope) => (scope.model.causes ?? []).flatMap((cause) => cause.explains.flatMap((link) => (link.scope === undefined ? [] : [link.scope]))))
    expect(links).toEqual(['acme-logistics/application-landscape'])
  })
})
