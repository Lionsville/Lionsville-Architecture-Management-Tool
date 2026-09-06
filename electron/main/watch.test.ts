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
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { watchFolder } from './watch'
import type { FolderChange } from './watch'

let root = ''
const stops: (() => void)[] = []

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'lvarch-watch-')))
})

afterEach(async () => {
  for (const stop of stops.splice(0)) stop()
  await rm(root, { recursive: true, force: true })
})

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Collect what the watcher reports.
 *
 * `sees` polls rather than waiting a fixed time: a filesystem notification is
 * as fast as the platform feels like being, and a test that waits exactly long
 * enough on this machine is a test that fails on a loaded one. `quiet` has to
 * wait — proving that nothing arrives is the one thing polling cannot do.
 */
function collecting() {
  const changes: FolderChange[] = []
  stops.push(watchFolder(root, (batch) => changes.push(...batch), 20))
  return {
    changes,
    async sees(path: string): Promise<FolderChange> {
      for (let waited = 0; waited < 4_000; waited += 25) {
        const held = changes.find((change) => change.path === path)
        if (held) return held
        await pause(25)
      }
      throw new Error(`never saw ${path}; saw ${changes.map((c) => c.path).join(', ') || 'nothing'}`)
    },
    async quiet(): Promise<FolderChange[]> {
      await pause(300)
      return changes
    },
  }
}

describe('watchFolder', () => {
  it('reports a file somebody else wrote, with what is now in it', async () => {
    const watcher = collecting()
    await writeFile(join(root, 'model.json'), '{"a":1}')

    expect((await watcher.sees('model.json')).stamp?.sha256).toBeTruthy()
  })

  it('reports a file inside a project folder by its path', async () => {
    const { mkdir } = await import('node:fs/promises')
    await mkdir(join(root, 'acme/landscape/diagrams'), { recursive: true })
    const watcher = collecting()
    await writeFile(join(root, 'acme/landscape/diagrams/l7.placements.json'), '{}')

    await expect(watcher.sees('acme/landscape/diagrams/l7.placements.json')).resolves.toBeTruthy()
  })

  it('reports a deleted file with no fingerprint at all', async () => {
    await writeFile(join(root, 'gone.json'), '{}')
    const watcher = collecting()
    await rm(join(root, 'gone.json'))

    expect((await watcher.sees('gone.json')).stamp).toBeUndefined()
  })

  it('says nothing about an editor’s scratch files', async () => {
    const watcher = collecting()
    await writeFile(join(root, 'model.json.tmp'), 'half')
    await writeFile(join(root, '.model.json.swp'), 'half')
    await writeFile(join(root, 'model.json~'), 'old')

    expect(await watcher.quiet()).toEqual([])
  })

  it('collects a burst into one report rather than one per event', async () => {
    const batches: number[] = []
    stops.push(watchFolder(root, (batch) => batches.push(batch.length), 20))
    await writeFile(join(root, 'a.json'), '1')
    await writeFile(join(root, 'b.json'), '2')
    await writeFile(join(root, 'c.json'), '3')
    await pause(300)

    expect(batches.length).toBeLessThanOrEqual(2)
    expect(batches.reduce((total, held) => total + held, 0)).toBeGreaterThanOrEqual(3)
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
