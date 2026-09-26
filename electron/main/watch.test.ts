// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Noticing a change in the folder, against a real one.
 *
 * The watching itself is one call to `node:fs`; what is worth testing is the
 * noise it has to survive. An editor's save is a temporary file, a rename and
 * sometimes a lock file — several events on several paths for one save — and a
 * watcher that reported all of it would have the app asking about conflicts
 * with itself every few seconds, which is how a sync feature becomes something
 * people turn off.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { watch } from 'node:fs'
import type { FSWatcher, WatchListener } from 'node:fs'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { watchFolder } from './watch'
import type { FolderChange } from './watch'

// The real `watch`, spied on so one test can stand in for the platform.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, watch: vi.fn(actual.watch) }
})

let root = ''
const stops: (() => void)[] = []

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'lvarch-watch-')))
})

afterEach(async () => {
  vi.useRealTimers()
  for (const stop of stops.splice(0)) stop()
  await rm(root, { recursive: true, force: true })
})

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// A filesystem notification arrives when the platform feels like it, and this
// suite runs beside every other one. The default five seconds is a coin toss
// under that load; these tests are quick when the watcher behaves and slow only
// when something is actually wrong.
vi.setConfig({ testTimeout: 30_000 })

/** What `collecting` writes until the watcher reports it; never one of a test's own changes. */
const PROBE = 'watch-ready.json'

/**
 * Collect what the watcher reports, once it is reporting.
 *
 * `watch` returns before the platform is listening: on macOS the stream is
 * started on a thread of its own, and a write made before it is running is
 * never reported at all. On a quiet machine that gap is shorter than the next
 * statement; beside another test run it is not, and a test that wrote its file
 * straight away waited fifteen seconds for news that was never coming. So a
 * probe is written until the watcher reports it — its own event says it is
 * live — and only then does the test act. That also gives `quiet` its meaning:
 * silence from a watcher known to be listening.
 *
 * `sees` polls rather than waiting a fixed time: a filesystem notification is
 * as fast as the platform feels like being, and a test that waits exactly long
 * enough on this machine is a test that fails on a loaded one. `quiet` has to
 * wait — proving that nothing arrives is the one thing polling cannot do.
 */
async function collecting() {
  const changes: FolderChange[] = []
  let live = false
  stops.push(watchFolder(root, (batch) => {
    for (const change of batch) {
      if (change.path === PROBE) live = true
      else changes.push(change)
    }
  }, 20))
  const deadline = Date.now() + 15_000
  for (let touch = 0; !live; touch += 1) {
    if (Date.now() > deadline) throw new Error('the watcher never reported its probe')
    await writeFile(join(root, PROBE), String(touch))
    await pause(50)
  }
  return {
    changes,
    /**
     * `matches` exists because a watcher can report a change that happened
     * just BEFORE it was installed — the platform's coalescing window is
     * wider than the gap between two statements in a test — so "the file
     * appeared" and "the file went" can both be waiting when it starts.
     */
    async sees(path: string, matches: (change: FolderChange) => boolean = () => true): Promise<FolderChange> {
      // Wall clock rather than a count of pauses: a `setTimeout(25)` on a
      // machine running the rest of this suite is not 25 ms, so counting
      // iterations gives up after an interval nobody chose. Generous, because
      // the only thing this bound decides is how a genuine failure is reported
      // — a watcher that never fires fails here either way.
      const deadline = Date.now() + 15_000
      do {
        const held = changes.find((change) => change.path === path && matches(change))
        if (held) return held
        await pause(25)
      } while (Date.now() < deadline)
      throw new Error(`never saw ${path}; saw ${changes.map((c) => c.path).join(', ') || 'nothing'}`)
    },
    async quiet(): Promise<FolderChange[]> {
      await pause(300)
      return changes
    },
  }
}

/**
 * The platform, played by the test: the watcher's listener, called when the
 * test says, and the settling window on a clock the test moves. What a burst
 * becomes is the watcher's arithmetic, and a real notification arrives when a
 * loaded machine gets round to it — which is how the burst test used to fail
 * beside another run. The files are real, so what is reported is read.
 */
function playedWatcher(settleMs: number) {
  let listener: WatchListener<string> | undefined
  vi.mocked(watch).mockImplementationOnce(((_path: string, _options: unknown, heard: WatchListener<string>) => {
    listener = heard
    return { on: () => undefined, close: () => undefined } as unknown as FSWatcher
  }) as unknown as typeof watch)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const batches: FolderChange[][] = []
  const waiting: (() => void)[] = []
  const stop = watchFolder(root, (batch) => {
    batches.push(batch)
    for (const resolve of waiting.splice(0)) resolve()
  }, settleMs)
  stops.push(stop)
  return {
    batches,
    stop,
    event: (path: string) => listener?.('change', path),
    tick: (ms: number) => vi.advanceTimersByTime(ms),
    /** The next report: a settled burst is read from the folder before it is reported. */
    next: () => new Promise<void>((resolve) => { waiting.push(resolve) }),
  }
}

describe('watchFolder', () => {
  it('reports a file somebody else wrote, with what is now in it', async () => {
    const watcher = await collecting()
    await writeFile(join(root, 'model.json'), '{"a":1}')

    expect((await watcher.sees('model.json')).stamp?.sha256).toBeTruthy()
  })

  it('reports a file inside a project folder by its path', async () => {
    const { mkdir } = await import('node:fs/promises')
    await mkdir(join(root, 'acme/landscape/diagrams'), { recursive: true })
    const watcher = await collecting()
    await writeFile(join(root, 'acme/landscape/diagrams/l7.geometry.json'), '{}')

    await expect(watcher.sees('acme/landscape/diagrams/l7.geometry.json')).resolves.toBeTruthy()
  })

  it('reports a deleted file with no fingerprint at all', async () => {
    await writeFile(join(root, 'gone.json'), '{}')
    const watcher = await collecting()
    await rm(join(root, 'gone.json'))

    expect((await watcher.sees('gone.json', (change) => !change.stamp)).stamp).toBeUndefined()
  })

  it('says nothing about a folder appearing, and reports the file inside it', async () => {
    // A save makes a scope's folders as it goes; a folder has no content to
    // fingerprint, and reported it would read as somebody else's write.
    const seen = await collecting()
    await mkdir(join(root, 'acme/docs'), { recursive: true })
    await writeFile(join(root, 'acme/docs/erp.md'), '# ERP')
    await seen.sees('acme/docs/erp.md')
    const paths = (await seen.quiet()).map((change) => change.path)
    expect(paths).toContain('acme/docs/erp.md')
    expect(paths).not.toContain('acme')
    expect(paths).not.toContain('acme/docs')
  })

  it('says nothing about an editor’s scratch files', async () => {
    const watcher = await collecting()
    await writeFile(join(root, 'model.json.tmp'), 'half')
    await writeFile(join(root, '.model.json.swp'), 'half')
    await writeFile(join(root, 'model.json~'), 'old')

    expect(await watcher.quiet()).toEqual([])
  })

  it('says nothing about what a snapshot writes into .git', async () => {
    const { mkdir } = await import('node:fs/promises')
    const watcher = await collecting()
    await mkdir(join(root, '.git', 'objects', 'f2'), { recursive: true })
    await writeFile(join(root, '.git', 'index'), 'x')
    await writeFile(join(root, '.git', 'objects', 'f2', '05c0049080'), 'x')
    await writeFile(join(root, '.git', 'refs-head'), 'x')

    expect(await watcher.quiet()).toEqual([])
  })

  it('collects a burst into one report rather than one per event', async () => {
    for (const name of ['a', 'b', 'c']) await writeFile(join(root, `${name}.json`), name)
    const watcher = playedWatcher(20)
    // Three saves, each inside the window the one before it opened, and one
    // path told twice — the way a platform reports a write and its rename.
    watcher.event('c.json')
    watcher.tick(10)
    watcher.event('a.json')
    watcher.tick(10)
    watcher.event('b.json')
    watcher.event('c.json')
    watcher.tick(19)
    expect(vi.getTimerCount()).toBe(1)

    const first = watcher.next()
    watcher.tick(1)
    await first
    expect(watcher.batches).toHaveLength(1)
    expect(watcher.batches[0].map((change) => change.path)).toEqual(['a.json', 'b.json', 'c.json'])
    expect(watcher.batches[0].every((change) => change.stamp?.sha256)).toBe(true)

    // A save after the burst settled is a burst of its own.
    watcher.event('a.json')
    const second = watcher.next()
    watcher.tick(20)
    await second
    expect(watcher.batches.map((batch) => batch.map((change) => change.path))).toEqual([['a.json', 'b.json', 'c.json'], ['a.json']])
  })

  it('drops a burst still settling when it is stopped', () => {
    const watcher = playedWatcher(20)
    watcher.event('a.json')
    watcher.stop()
    // Nothing left to settle, so nothing is ever read or reported.
    expect(vi.getTimerCount()).toBe(0)
    watcher.tick(20)
    expect(watcher.batches).toEqual([])
  })

  it('says nothing more once it is stopped', async () => {
    const changes: FolderChange[] = []
    const stop = watchFolder(root, (batch) => changes.push(...batch), 20)
    stop()
    await writeFile(join(root, 'after.json'), '{}')
    await pause(300)

    expect(changes).toEqual([])
  })

  it('degrades to silence for a folder that cannot be watched', () => {
    // An unwatched working directory is still a working directory: the caller
    // loses the notifications, not the app.
    expect(() => watchFolder(join(root, 'not-there'), () => {})()).not.toThrow()
  })
})
