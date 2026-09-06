/**
 * The desktop folder, held to the same contract as every other store.
 *
 * The whole claim of this adapter is that the desktop needs no store of its
 * own: `FileSystemProjectStore` over a different handle is the desktop store.
 * Running the shared suite over it is how that claim is checked rather than
 * asserted — and running it over the *real* main-process implementation, in a
 * real temporary folder, is what makes it worth running. What is left
 * untested here is `ipcRenderer.invoke` itself, which is a function call.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import {
  fingerprint, listDirectory, makeDirectory, readFile, removeEntry, writeFile,
} from '../../../electron/main/fileStore'
import { describeProjectStore, sampleProject } from '../../ports/ProjectStore.contract'
import { FileSystemProjectStore } from '../fileSystem/FileSystemProjectStore'
import type { DesktopFiles } from './channel'
import { IpcDirectoryHandle } from './IpcDirectoryHandle'

const folders: string[] = []
afterAll(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true })
})

/**
 * The channel, minus the wire.
 *
 * Every method is the handler from `electron/main/files.ts` with the argument
 * checking left out — that half is main's and is tested where it lives. What
 * this exercises is the mapping the adapter does: handles onto paths, a
 * writable onto one atomic write, a listing onto handles.
 */
function channelOver(root: string): DesktopFiles {
  return {
    chooseDirectory: () => Promise.resolve({ root, name: basename(root) }),
    recentDirectories: () => Promise.resolve([{ root, name: basename(root) }]),
    list: (held, path) => listDirectory(held, path),
    makeDirectory: (held, path) => makeDirectory(held, path),
    read: (held, path) => readFile(held, path),
    write: (held, path, bytes) => writeFile(held, path, bytes),
    remove: (held, path, options) => removeEntry(held, path, options),
    fingerprint: (held, path) => fingerprint(held, path),
    revealInFolder: () => Promise.resolve(),
  }
}

function freshFolder(): string {
  const folder = realpathSync(mkdtempSync(join(tmpdir(), 'lvarch-desktop-')))
  folders.push(folder)
  return folder
}

function storeOver(folder: string): FileSystemProjectStore {
  return new FileSystemProjectStore(
    new IpcDirectoryHandle(channelOver(folder), folder, basename(folder)),
  )
}

describeProjectStore('desktop folder over IPC', () => storeOver(freshFolder()))

describe('IpcDirectoryHandle', () => {
  it('writes the project as files somebody can open in a file manager', async () => {
    const folder = freshFolder()
    await storeOver(folder).save(sampleProject())

    const { readFileSync } = await import('node:fs')
    const header = readFileSync(join(folder, 'acme-logistics/landscape/project.json'), 'utf8')
    expect(JSON.parse(header)).toMatchObject({ name: 'Application landscape', formatVersion: 3 })
  })

  it('reads back a project another program wrote into the folder', async () => {
    // The point of files: a colleague's copy, a sync client, a git checkout.
    const folder = freshFolder()
    await storeOver(folder).save(sampleProject())

    const { cpSync } = await import('node:fs')
    cpSync(join(folder, 'acme-logistics'), join(folder, 'globex'), { recursive: true })

    const back = await storeOver(folder).load({ group: 'globex', project: 'landscape' })
    expect(back?.model.name).toBe('Application landscape')
    expect(await storeOver(folder).list()).toHaveLength(2)
  })

  it('refuses a path that would leave the folder, wherever it is invented', async () => {
    const folder = freshFolder()
    const handle = new IpcDirectoryHandle(channelOver(folder), folder, basename(folder))

    await expect(handle.getDirectoryHandle('..')).rejects.toThrow()
    await expect(handle.getFileHandle('../escape.json')).rejects.toThrow()
  })

  it('reads a folder that has gone away as empty rather than as an exception', async () => {
    const folder = freshFolder()
    const store = storeOver(folder)
    await store.save(sampleProject())
    rmSync(folder, { recursive: true, force: true })

    await expect(store.list()).resolves.toEqual([])
  })
})
