// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { element, laidOut } from '../model/testFixtures'
import { textFromBytes } from './text'
import { scopeFiles } from './folderFormat'
import { bareScope } from './scope'
import type { ScopeSnapshot } from './scope'
import { openDocumentBytes, workingFileBytes } from './workingFile'
import { compareManifests, MANIFEST_FILE, manifestOf, manifestTotals, readManifest } from './workingFileManifest'

const scope = (path: string, name: string, views: string[] = ['l7']): ScopeSnapshot => ({
  path,
  model: {
    name,
    elements: [element('route-planner', { name: 'Route planner', description: 'Routes.' })],
    relations: [],
    diagrams: views.map((id) => laidOut({ id, kind: 'layer7', name: `View ${id}`, placements: [{ id: 'route-planner', x: 1, y: 2 }] })),
  },
  activeDiagramId: views[0] ?? '',
  logoLibrary: [],
})

/** An organisation, a domain, and a team under it holding the most views — the last scope a walk writes. */
const organisation = () => [
  scope('', 'Organisation'),
  scope('depots', 'Depots', []),
  scope('depots/fleet', 'Fleet', ['l7', 'containers-a', 'containers-b']),
]

describe('the manifest of a working set', () => {
  it('lists every scope, relative to the top, with every file hashed and every view named', async () => {
    const manifest = await manifestOf(organisation())
    expect(manifest.scopes.map((held) => [held.path, held.name])).toEqual([
      ['', 'Organisation'], ['depots', 'Depots'], ['depots/fleet', 'Fleet'],
    ])
    const fleet = manifest.scopes[2]
    expect(fleet.files.map((file) => file.path)).toEqual(scopeFiles(organisation()[2]).map((file) => file.path))
    expect(fleet.files.every((file) => /^[0-9a-f]{64}$/.test(file.sha256) && file.bytes > 0)).toBe(true)
    expect(fleet.views.map((view) => view.id)).toEqual(['l7', 'containers-a', 'containers-b'])
    expect(fleet.counts).toMatchObject({ elements: 1, views: 3 })
    expect(manifestTotals(manifest)).toEqual({ scopes: 3, views: 4, files: manifest.scopes.reduce((n, s) => n + s.files.length, 0) })
  })

  it('is relative to the top of the set, so a domain exported alone lists itself as the top', async () => {
    const manifest = await manifestOf(organisation().slice(1).map((held) => held))
    expect(manifest.scopes.map((held) => held.path)).toEqual(['', 'fleet'])
  })

  it('says what a scope was read without, rather than calling it whole', async () => {
    const [top, depots, fleet] = organisation()
    const manifest = await manifestOf([top, depots, { ...fleet, unread: ['diagrams/lost.json'] }])
    expect(manifest.omitted).toEqual([{ path: 'depots/fleet', files: ['diagrams/lost.json'] }])
  })
})

describe('what landed, held to the manifest', () => {
  it('is nothing at all when every scope and every file arrived', async () => {
    const want = await manifestOf(organisation())
    expect(compareManifests(want, await manifestOf(organisation()))).toBeUndefined()
  })

  it('names a scope that did not arrive, with the views it held', async () => {
    const want = await manifestOf(organisation())
    const have = await manifestOf(organisation().slice(0, 2))
    const difference = compareManifests(want, have)
    expect(difference?.scopes).toHaveLength(1)
    expect(difference?.scopes[0]).toMatchObject({ path: 'depots/fleet', name: 'Fleet', absent: true })
    expect(difference?.scopes[0].views.map((view) => view.id)).toEqual(['l7', 'containers-a', 'containers-b'])
  })

  it('names a view that did not arrive, and its files', async () => {
    const want = await manifestOf(organisation())
    const [top, depots, fleet] = organisation()
    const short = { ...fleet, model: { ...fleet.model, diagrams: fleet.model.diagrams.slice(0, 2) } }
    const difference = compareManifests(want, await manifestOf([top, depots, short]))
    expect(difference?.scopes[0].views.map((view) => view.id)).toEqual(['containers-b'])
    expect(difference?.scopes[0].missingFiles).toEqual(
      ['diagrams/containers-b.geometry.json', 'diagrams/containers-b.json'])
  })

  it('names a file that arrived with other contents', async () => {
    const want = await manifestOf(organisation())
    const [top, depots, fleet] = organisation()
    const moved = { ...fleet, model: { ...fleet.model, elements: [{ ...fleet.model.elements[0], description: 'Other.' }] } }
    const difference = compareManifests(want, await manifestOf([top, depots, moved]))
    expect(difference?.scopes[0].changedFiles).toEqual(['docs/route-planner.md'])
  })

  it('is not bothered by what was already there beside the landing', async () => {
    const want = await manifestOf(organisation().slice(0, 2))
    expect(compareManifests(want, await manifestOf(organisation()))).toBeUndefined()
  })

  it('repeats what the file said it was made without', async () => {
    const [top, depots, fleet] = organisation()
    const want = await manifestOf([top, depots, { ...fleet, unread: ['docs/x.md'] }])
    expect(compareManifests(want, await manifestOf(organisation()))?.omitted).toEqual([{ path: 'depots/fleet', files: ['docs/x.md'] }])
  })
})

describe('in the working file', () => {
  it('rides beside the top scope, and the scopes open exactly as they did without it', async () => {
    const set = organisation()
    const manifest = await manifestOf(set)
    const bytes = workingFileBytes(set, manifest)
    expect(Object.keys(unzipSync(bytes))).toContain(MANIFEST_FILE)
    const opened = openDocumentBytes(bytes, bareScope('', ''))
    const plain = openDocumentBytes(workingFileBytes(set), bareScope('', ''))
    if (!opened.ok || !plain.ok) throw new Error('did not open')
    expect(opened.manifest).toEqual(manifest)
    expect(plain.manifest).toBeUndefined()
    expect(scopeFiles(opened.scope)).toEqual(scopeFiles(plain.scope))
    expect(opened.rest?.map((held) => held.path)).toEqual(plain.rest?.map((held) => held.path))
  })

  it('is read only when it says it is ours', () => {
    expect(readManifest('{"type":"somebody-else","version":1,"scopes":[]}')).toBeUndefined()
    expect(readManifest('not json')).toBeUndefined()
    expect(readManifest('{"type":"lionsville-architecture-manifest","version":1,"scopes":[{"path":""}]}')).toBeUndefined()
  })

  it('names a scope in the file whose folder would not open, where it used to be left out in silence', () => {
    const bytes = workingFileBytes(organisation())
    const entries = unzipSync(bytes)
    // A header the reader cannot take: the scope is in the file and does not open.
    entries['depots/fleet/scope.json'] = new TextEncoder().encode('{ "type": "lionsville-architecture", "version": 99 }')
    const opened = openDocumentBytes(zipSync(entries), bareScope('', ''))
    if (!opened.ok) throw new Error('did not open')
    expect(opened.rest?.map((held) => held.path)).toEqual(['depots'])
    expect(opened.unopened).toEqual(['depots/fleet'])
    expect(textFromBytes(entries['depots/scope.json'])).toContain('Depots')
  })
})
