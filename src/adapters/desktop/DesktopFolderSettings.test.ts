/**
 * The contract over the desktop's store, seeded both ways a folder's machine
 * settings can already exist: as the entry this install keeps in `userData`,
 * and as the `local.json` an older build left in the folder (ADR-0023).
 */
import { describe, expect, it } from 'vitest'
import { describeFolderSettings } from '../../ports/FolderSettings.contract'
import { LOCAL_SETTINGS_PATH, readLocalSettings } from '../../projects/folderSettings'
import type { LocalSettings, LocalSettingsPatch } from '../../projects/folderSettings'
import { machineFolderSettingsText, readMachineFolderSettings } from '../../platform/node/machineFolderSettings'
import { FakeDirectory } from '../fileSystem/fakeDirectory'
import { FileSystemFolderSettings } from '../fileSystem/FileSystemFolderSettings'
import type { DesktopSettings } from './channel'
import { DesktopFolderSettings } from './DesktopFolderSettings'

const ROOT = '/Users/someone/Architecture'

/** Main's half, over one string: the file in `userData`. */
function fakeChannel(initial?: string): DesktopSettings & { text(): string | undefined } {
  let held = initial
  return {
    text: () => held,
    readUpdates: () => Promise.reject(new Error('not here')),
    writeUpdates: () => Promise.reject(new Error('not here')),
    readFolderLocal: (root) => Promise.resolve(readMachineFolderSettings(held, root)),
    writeFolderLocal: (root, patch) => {
      held = machineFolderSettingsText(held, root, patch)
      return Promise.resolve(readMachineFolderSettings(held, root) ?? readLocalSettings(undefined))
    },
  }
}

async function plant(root: FakeDirectory, path: string, text: string): Promise<void> {
  const parts = path.split('/')
  let folder: FakeDirectory = root
  for (const segment of parts.slice(0, -1)) {
    folder = await folder.getDirectoryHandle(segment, { create: true }) as FakeDirectory
  }
  folder.writeRaw(parts[parts.length - 1], text)
}

async function textIn(root: FakeDirectory, path: string): Promise<string | undefined> {
  const parts = path.split('/')
  try {
    let folder = root as Awaited<ReturnType<FakeDirectory['getDirectoryHandle']>>
    for (const segment of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(segment)
    const handle = await folder.getFileHandle(parts[parts.length - 1])
    return await (await handle.getFile()).text()
  } catch {
    return undefined
  }
}

/**
 * The contract, with the seed where this store keeps the machine file: the
 * folder's entry in `userData`. A seed that is not JSON is kept as the
 * nonsense it is, the way a hand-edited file would be.
 */
describeFolderSettings('desktop', async (files = {}) => {
  const folder = new FakeDirectory('Architecture')
  const { [LOCAL_SETTINGS_PATH]: local, ...rest } = files
  await Promise.all(Object.entries(rest).map(([path, text]) => plant(folder, path, text)))
  const channel = fakeChannel(local === undefined ? undefined : JSON.stringify({
    version: 1, folders: { [ROOT]: parsedOrRaw(local) },
  }))
  const store = new DesktopFolderSettings(channel, ROOT, new FileSystemFolderSettings(folder))
  return {
    store,
    textAt: async (path) => (path === LOCAL_SETTINGS_PATH
      ? entryText(channel.text())
      : textIn(folder, path)),
  }
})

function parsedOrRaw(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function entryText(text: string | undefined): string | undefined {
  if (text === undefined) return undefined
  const entry = (JSON.parse(text) as { folders: Record<string, unknown> }).folders[ROOT]
  return entry === undefined ? undefined : JSON.stringify(entry, null, 2)
}

describe('DesktopFolderSettings — where the machine\'s settings go', () => {
  it('reads through to the folder\'s old file until this install has written, then folds it in', async () => {
    const folder = new FakeDirectory('Architecture')
    await plant(folder, LOCAL_SETTINGS_PATH, '{"version":1,"git":{"pullOnOpen":true}}')
    const channel = fakeChannel()
    const store = new DesktopFolderSettings(channel, ROOT, new FileSystemFolderSettings(folder))

    expect((await store.readLocal()).git.pullOnOpen).toBe(true)
    await store.writeLocal({ git: { pushAfterSnapshot: true } })

    const kept: LocalSettings | undefined = readMachineFolderSettings(channel.text(), ROOT)
    expect(kept).toEqual({ git: { pullOnOpen: true, pushAfterSnapshot: true } })
    // The folder's own file is a person's, and is left exactly as it was.
    expect(await textIn(folder, LOCAL_SETTINGS_PATH)).toBe('{"version":1,"git":{"pullOnOpen":true}}')
  })

  it('writes nothing into the folder, ever', async () => {
    const folder = new FakeDirectory('Architecture')
    const store = new DesktopFolderSettings(fakeChannel(), ROOT, new FileSystemFolderSettings(folder))
    const patch: LocalSettingsPatch = { git: { pullOnOpen: true } }
    await store.writeLocal(patch)
    expect(await textIn(folder, LOCAL_SETTINGS_PATH)).toBeUndefined()
  })

  it('prefers the entry this install keeps over whatever the folder still says', async () => {
    const folder = new FakeDirectory('Architecture')
    await plant(folder, LOCAL_SETTINGS_PATH, '{"version":1,"git":{"pullOnOpen":true}}')
    const channel = fakeChannel(JSON.stringify({ version: 1, folders: { [ROOT]: { version: 1, git: { pullOnOpen: false } } } }))
    const store = new DesktopFolderSettings(channel, ROOT, new FileSystemFolderSettings(folder))
    expect((await store.readLocal()).git.pullOnOpen).toBe(false)
  })
})
