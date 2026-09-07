/**
 * The contract, over the in-memory directory. The desktop's IPC handle is held
 * to the same `DirectoryHandleLike` shape, so this is the admission test for
 * both.
 */
import { describeFolderSettings } from '../../ports/FolderSettings.contract'
import { FakeDirectory } from './fakeDirectory'
import { FileSystemFolderSettings } from './FileSystemFolderSettings'

async function plant(root: FakeDirectory, path: string, text: string): Promise<void> {
  const parts = path.split('/')
  let folder: FakeDirectory = root
  for (const segment of parts.slice(0, -1)) {
    folder = await folder.getDirectoryHandle(segment, { create: true }) as FakeDirectory
  }
  folder.writeRaw(parts[parts.length - 1], text)
}

async function textAt(root: FakeDirectory, path: string): Promise<string | undefined> {
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

describeFolderSettings('in-memory directory', (files = {}) => {
  const root = new FakeDirectory('Architecture')
  // Synchronous planting through the fake's own writer, so the store's first
  // read sees the file the way it would see a colleague's.
  const planted = Promise.all(Object.entries(files).map(([path, text]) => plant(root, path, text)))
  const store = new FileSystemFolderSettings(root)
  return {
    store: {
      id: store.id,
      readFolder: async () => { await planted; return store.readFolder() },
      readLocal: async () => { await planted; return store.readLocal() },
      writeLocal: async (patch) => { await planted; return store.writeLocal(patch) },
    },
    textAt: (path) => textAt(root, path),
  }
})
