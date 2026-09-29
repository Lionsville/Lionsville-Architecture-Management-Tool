// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * What a scope in a desktop folder hears about, over a fake file channel: its
 * own files and nothing else, the tree everything, and this window's own
 * writes the tree only — the open scope just wrote them, and "changed
 * elsewhere" would be the app interrupting itself.
 */
import { describe, expect, it, vi } from 'vitest'
import type { DesktopChange, DesktopFiles } from '../../adapters/desktop/channel'
import { RecordingDiagnostics } from '../../adapters/memory/RecordingDiagnostics'
import { desktopOpening } from './folderSource'
import { openFolder } from './openFolder'

function channel(): DesktopFiles {
  return {
    chooseDirectory: () => Promise.resolve(undefined),
    recentDirectories: () => Promise.resolve([]),
    list: () => Promise.resolve(undefined),
    makeDirectory: () => Promise.resolve(),
    read: () => Promise.resolve(undefined),
    write: vi.fn(() => Promise.resolve({ mtimeMs: 1, size: 1, sha256: 'x' })),
    create: vi.fn(() => Promise.resolve(true)),
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
  }
}

async function listening(files: DesktopFiles = channel()) {
  let listener: ((change: DesktopChange) => void) | undefined
  const watched = { ...files, onChanged: (held: (change: DesktopChange) => void) => { listener = held; return () => {} } }
  const opening = desktopOpening(watched, { root: '/work', name: 'work' })
  const diagnostics = new RecordingDiagnostics()
  const parts = await openFolder(opening, { diagnostics })
  const heard: string[] = []
  const report = (path: string) => listener?.({ root: '/work', path, stamp: { mtimeMs: 1, size: 1, sha256: 'x' } })
  return { parts, opening, heard, report, diagnostics }
}

describe('what a scope in a desktop folder hears about', () => {
  it('tells the open scope about its own files and nothing else', async () => {
    const { parts, heard, report } = await listening()
    parts.changes!('acme', () => heard.push('acme'))
    report('acme/model.json')
    report('acme/docs/erp.md')
    // A landscape filed under the domain, a README beside scope.json, an
    // export saved into the folder, another domain: none of them this scope's.
    report('acme/rail/model.json')
    report('acme/README.md')
    report('acme/landscape.lvarch')
    report('finance/model.json')
    report('scope.json')
    expect(heard).toHaveLength(2)
  })

  it('tells the tree about everything under it', async () => {
    const { parts, heard, report } = await listening()
    parts.changes!('', () => heard.push('tree'), true)
    report('acme/rail/model.json')
    report('scope.json')
    report('acme/README.md')
    expect(heard).toHaveLength(3)
  })

  it('tells the tree about this window\'s own writes, and the open scope not', async () => {
    const { parts, opening, heard, report } = await listening()
    parts.changes!('acme', () => heard.push('acme'))
    parts.changes!('', () => heard.push('tree'), true)
    // Through the folder's handle, so the remembering wrapper sees the write;
    // the fake channel stamps every write 'x', and the report carries the same.
    const scope = await opening.handle.getDirectoryHandle('acme', { create: true })
    const file = await (await scope.getFileHandle('model.json', { create: true })).createWritable()
    await file.write('{}')
    await file.close()
    report('acme/model.json')
    expect(heard).toEqual(['tree'])
  })

  it('tells the organisation, opened on a page, about its own files only', async () => {
    const { parts, heard, report } = await listening()
    parts.changes!('', () => heard.push('root'))
    report('acme/rail/model.json')
    report('scope.json')
    report('diagrams/l7.json')
    expect(heard).toHaveLength(2)
  })

  /** A watcher that could not be set up is a window deaf to the folder, and was said nowhere. */
  it('says on the trail a folder that cannot be watched', async () => {
    const { parts, diagnostics } = await listening({ ...channel(), watch: () => Promise.reject(new Error('EMFILE: too many open files')) })
    parts.changes!('acme', () => {})
    await new Promise((settled) => setTimeout(settled, 0))
    expect(diagnostics.messages()).toContain('the folder cannot be watched')
  })

  it('is the folder it was opened on, root and all', async () => {
    const { parts } = await listening()
    expect(parts.source).toEqual({ kind: 'folder', name: 'work', root: '/work' })
  })
})
