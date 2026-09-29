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
 *
 * A second folder has a `model.json` of two megabytes that every one of its
 * commits changes: a thing's history reads each version of it, and hundreds
 * of them together are more than one read of git's objects may answer.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'
import {
  createFile, fingerprint, listDirectory, makeDirectory, moveEntry, readFile as readInside, removeEntry, stampAt, writeFile, writeTogether,
} from '../../../electron/main/fileStore'
import { BUDGET } from '../../model/testing/measure'
import { stableJson } from '../../projects/text'
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
    create: (held, path, bytes) => createFile(held, path, bytes),
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

/** One fast-import commit on `main`. */
function commitOf(at: number, message: string, changed: string): string {
  return `commit refs/heads/main\ncommitter A <a@example.org> ${1_700_000_000 + at} +0000\ndata ${Buffer.byteLength(message)}\n${message}\n${changed}`
}

/** A folder made a repository of these commits, streamed to `git fast-import` one at a time, and checked out. */
async function imported(at: string, commits: Iterable<string>): Promise<void> {
  await run('git', ['init', '-q'], { cwd: at })
  await new Promise<void>((resolve, reject) => {
    const child = execFile('git', ['fast-import', '--quiet'], { cwd: at, maxBuffer: 64 * 1024 * 1024 }, (failure) => (failure ? reject(failure) : resolve()))
    const input = child.stdin!
    const next = commits[Symbol.iterator]()
    const write = (): void => {
      for (let one = next.next(); !one.done; one = next.next()) {
        if (!input.write(one.value)) {
          input.once('drain', write)
          return
        }
      }
      input.end()
    }
    write()
  })
  await run('git', ['symbolic-ref', 'HEAD', 'refs/heads/main'], { cwd: at })
  await run('git', ['reset', '-q', '--hard'], { cwd: at })
}

/** A folder's repositories over the same handle and git the desktop uses, minus the wire. */
function repositoriesAt(at: string): Over {
  const root = new IpcDirectoryHandle(filesOver(), at, basename(at))
  return over({ repositories: folderRepositories({ root, git: folderGitAt(at) }) })
}

async function generate(): Promise<void> {
  folder = realpathSync(mkdtempSync(join(tmpdir(), 'lvarch-history-perf-')))
  repositories = repositoriesAt(folder)
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
    stream.push(commitOf(at, message, changed))
  }
  await imported(folder, stream)
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

/** Commits of the folder whose large model every commit changes: more than one chunk of the history. */
const LARGE_COMMITS = 220
/** How large its `model.json` is, at least. */
const LARGE_MODEL = 2 * 1024 * 1024

describe.skipIf(!available)('the folder’s history where every commit changes a large model', () => {
  let large = ''
  let held: Over
  let scope = ''

  beforeAll(async () => {
    large = realpathSync(mkdtempSync(join(tmpdir(), 'lvarch-history-large-')))
    held = repositoriesAt(large)
    scope = await held.scope('globex', 'Globex')
    await held.steps(scope, ...Array.from({ length: ELEMENTS }, (_, n) =>
      ({ type: 'element.create' as const, element: element(`e${n}`, `Element ${n}`, `Description of ${n}.`) })))
    const header = await readFile(join(large, 'globex/scope.json'), 'utf8')
    const model = JSON.parse(await readFile(join(large, 'globex/model.json'), 'utf8')) as { elements: { id: string; name: string }[] }
    const [template] = model.elements
    const renamed = model.elements.find((one) => one.id === 'e3')!
    for (let n = 0; stableJson(model).length < LARGE_MODEL; n += 1) {
      model.elements.push(...Array.from({ length: 500 }, (_, k) => ({ ...template, id: `bulk-${n}-${k}`, name: `Bulk ${n}-${k}` })))
    }
    const trailer = scopeTrailer(scope, 'globex')
    function* commits(): Generator<string> {
      yield commitOf(0, `step 0\n\n${trailer}`, inline('globex/scope.json', header) + inline('globex/model.json', stableJson(model)))
      for (let at = 1; at < LARGE_COMMITS; at += 1) {
        renamed.name = `Renamed ${at}`
        yield commitOf(at, `step ${at}\n\n${trailer}`, inline('globex/model.json', stableJson(model)))
      }
    }
    await rm(join(large, 'globex'), { recursive: true, force: true })
    await imported(large, commits())
  }, 300_000)
  afterAll(() => rmSync(large, { recursive: true, force: true }))

  it('answers a page of the element every commit changes, reading the model’s versions a batch at a time', async () => {
    const page = await timed('folder history: first page of an element every commit of a 2 MB model changes', () =>
      held.history.entries({ scopes: [scope], record: { kind: 'element', id: 'e3' }, limit: 50 }))
    expect(page.value.entries.map((entry) => entry.subject).slice(0, 2)).toEqual([`step ${LARGE_COMMITS - 1}`, `step ${LARGE_COMMITS - 2}`])
    expect(page.value.entries).toHaveLength(50)
    expect(page.ms).toBeLessThan(BUDGET.folderThingHistory)
  })

  it('answers a page of an element changed once, which reads every version of the model there is', async () => {
    const page = await timed('folder history: a page of an element changed once, over every version of a 2 MB model', () =>
      held.history.entries({ scopes: [scope], record: { kind: 'element', id: 'e5' }, limit: 50 }))
    expect(page.value.entries.map((entry) => entry.subject)).toEqual(['step 0'])
    expect(page.ms).toBeLessThan(BUDGET.folderThingHistory)
  })
})
