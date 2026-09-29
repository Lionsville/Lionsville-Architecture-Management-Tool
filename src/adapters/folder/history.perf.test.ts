// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the folder's history costs on a history of ten thousand commits
 * (ADR-0031: a thing's history on a large folder costs a scan, and this is
 * how large a scan it may be).
 *
 * The folder is one scope of twenty elements, each with a description of its
 * own, one more nobody touches again, and fifteen hundred with none, which
 * make its `model.json` a large one; every commit rewrites one description,
 * and every tenth renames an element in the model they share. The first half
 * of the history was made before any commit was marked with the scope it
 * records, as an older build's or a person's commits are. Made with `git fast-import`, which writes
 * ten thousand commits in a second or two, and read through the same handle
 * and git the desktop uses, minus the wire.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'
import {
  fingerprint, listDirectory, makeDirectory, moveEntry, readFile as readInside, removeEntry, stampAt, writeFile, writeTogether,
} from '../../../electron/main/fileStore'
import { BUDGET } from '../../model/testing/measure'
import { stableJson } from '../../projects/fileText'
import { gitAvailable } from '../../platform/node/git'
import { folderGitAt } from '../../platform/node/gitEntries'
import { element, over } from '../../ports/Repositories.contract'
import type { Over } from '../../ports/Repositories.contract'
import type { DesktopFiles } from '../desktop/channel'
import { IpcDirectoryHandle } from './desktop/IpcDirectoryHandle'
import { folderRepositories } from './folderRepositories'
import { scopeTrailer } from './folderGit'

const run = promisify(execFile)
const available = await gitAvailable()

const COMMITS = 10_000
const ELEMENTS = 20
/** Commits made before the folder's repositories kept its history: no trailer, by hand or by an older build. */
const LEGACY = 5_000
/** Elements the model holds beside the twenty, with no description of their own: what makes a large `model.json`. */
const BULK = 1_500

let folder = ''
let repositories: Over
let acme = ''

function filesOver(): DesktopFiles {
  const unused = () => Promise.reject(new Error('not asked'))
  return {
    chooseDirectory: unused, recentDirectories: unused, revealInFolder: unused, saveDocument: unused, watch: unused, unwatch: unused,
    onChanged: () => () => {},
    list: (held, path) => listDirectory(held, path),
    makeDirectory: (held, path) => makeDirectory(held, path),
    read: (held, path) => readInside(held, path),
    write: (held, path, bytes) => writeFile(held, path, bytes),
    writeTogether: (held, writes, removals) => writeTogether(held, writes, removals),
    remove: (held, path, options) => removeEntry(held, path, options),
    move: (held, from, to) => moveEntry(held, from, to),
    stamp: (held, path) => stampAt(held, path),
    fingerprint: (held, path) => fingerprint(held, path),
  }
}

/** One file of a fast-import commit. */
function inline(path: string, text: string): string {
  return `M 100644 inline ${path}\ndata ${Buffer.byteLength(text)}\n${text}\n`
}

async function generate(): Promise<void> {
  folder = realpathSync(mkdtempSync(join(tmpdir(), 'lvarch-history-perf-')))
  const root = new IpcDirectoryHandle(filesOver(), folder, basename(folder))
  repositories = over({ repositories: folderRepositories({ root, git: folderGitAt(folder) }) })
  acme = await repositories.scope('acme', 'Acme Logistics')
  await repositories.steps(acme, ...Array.from({ length: ELEMENTS }, (_, n) =>
    ({ type: 'element.create' as const, element: element(`e${n}`, `Element ${n}`, `Description of ${n}.`) })))
  // One element nobody touches again — its history is one entry, so a page of it never fills — and the bulk.
  await repositories.steps(acme, { type: 'element.create', element: element('cold', 'Cold') },
    ...Array.from({ length: BULK }, (_, n) => ({ type: 'element.create' as const, element: element(`bulk-${n}`, `Bulk ${n}`) })))
  const files = ['acme/scope.json', 'acme/model.json', ...Array.from({ length: ELEMENTS }, (_, n) => `acme/docs/e${n}.md`)]
  const held = new Map(await Promise.all(files.map(async (path) => [path, await readFile(join(folder, path), 'utf8')] as const)))
  const model = JSON.parse(held.get('acme/model.json')!) as { elements: { id: string; name: string }[]; relations: unknown[] }
  const trailer = scopeTrailer(acme, 'acme')
  const stream: string[] = []
  for (let at = 0; at <= COMMITS; at += 1) {
    const message = at <= LEGACY ? `step ${at}` : `step ${at}\n\n${trailer}`
    let changed: string
    if (at === 0) {
      changed = [...held].map(([path, text]) => inline(path, text)).join('')
    } else {
      changed = inline(`acme/docs/e${at % ELEMENTS}.md`, `Description ${at}.\n`)
      if (at % 10 === 0) {
        model.elements[(at / 10) % ELEMENTS].name = `Renamed ${at}`
        changed += inline('acme/model.json', stableJson(model))
      }
    }
    stream.push(`commit refs/heads/main\ncommitter A <a@example.org> ${1_700_000_000 + at} +0000\ndata ${Buffer.byteLength(message)}\n${message}\n${changed}`)
  }
  await run('git', ['init', '-q'], { cwd: folder })
  await new Promise<void>((resolve, reject) => {
    const child = execFile('git', ['fast-import', '--quiet'], { cwd: folder, maxBuffer: 64 * 1024 * 1024 }, (failure) => (failure ? reject(failure) : resolve()))
    child.stdin?.end(stream.join(''))
  })
  await run('git', ['symbolic-ref', 'HEAD', 'refs/heads/main'], { cwd: folder })
  await run('git', ['reset', '-q', '--hard'], { cwd: folder })
}

async function timed<T>(label: string, work: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const started = performance.now()
  const value = await work()
  const ms = performance.now() - started
  console.log(`${label}: ${ms.toFixed(0)} ms`)
  return { ms, value }
}

describe.skipIf(!available)('the folder’s history on ten thousand commits', () => {
  beforeAll(generate, 120_000)
  afterAll(() => rmSync(folder, { recursive: true, force: true }))

  it('answers a page of a scope’s history, and the page after it', async () => {
    const first = await timed('folder history: first page of 50', () => repositories.history.entries({ scopes: [acme], limit: 50 }))
    expect(first.value.entries).toHaveLength(50)
    expect(first.ms).toBeLessThan(BUDGET.folderHistoryPage)
    const next = await timed('folder history: the page after', () =>
      repositories.history.entries({ scopes: [acme], limit: 50, after: first.value.next! }))
    expect(next.value.entries[0].subject).toBe(`step ${COMMITS - 50}`)
    expect(next.ms).toBeLessThan(BUDGET.folderHistoryPage)
  })

  it('answers a page of one element’s history without reading the history whole', async () => {
    const page = await timed('folder history: first page of one element’s', () =>
      repositories.history.entries({ scopes: [acme], record: { kind: 'element', id: 'e3' }, limit: 50 }))
    expect(page.value.entries).toHaveLength(50)
    expect(page.value.entries.every((entry) => /^step \d+$/.test(entry.subject ?? ''))).toBe(true)
    expect(page.value.next).toBeDefined()
    expect(page.ms).toBeLessThan(BUDGET.folderThingHistory)
  })

  it('answers a page of an element nobody touched again, which never fills, from commits marked and unmarked', async () => {
    const page = await timed('folder history: a page of an element changed once, which never fills', () =>
      repositories.history.entries({ scopes: [acme], record: { kind: 'element', id: 'cold' }, limit: 50 }))
    expect(page.value.entries.map((entry) => entry.subject)).toEqual(['step 0'])
    expect(page.value.next).toBeUndefined()
    expect(page.ms).toBeLessThan(BUDGET.folderThingHistory)
  })

  it('answers a deep page, among the commits made before any was marked', async () => {
    const [first] = (await repositories.history.entries({ scopes: [acme], limit: 1 })).entries
    const tip = (await folderGitAt(folder).head())!
    expect(first).toBeDefined()
    const deep = await timed('folder history: a page 9,000 commits down', () =>
      repositories.history.entries({ scopes: [acme], limit: 50, after: `${tip}:9000:0` }))
    expect(deep.value.entries[0].subject).toBe(`step ${COMMITS - 9000}`)
    expect(deep.value.entries).toHaveLength(50)
    expect(deep.ms).toBeLessThan(BUDGET.folderHistoryPage)
  })

  it('reads the scope as it was at an entry', async () => {
    const [newest] = (await repositories.history.entries({ scopes: [acme], limit: 1 })).entries
    const state = await timed('folder history: the state at an entry', () => repositories.history.stateAt(acme, newest.id))
    expect(state.value?.model.elements).toHaveLength(ELEMENTS + 1 + BULK)
    expect(state.ms).toBeLessThan(BUDGET.historyLook)
  })
})
