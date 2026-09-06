/**
 * The file channel, wired.
 *
 * `window.desktop.files` in the renderer is `ipcRenderer.invoke` in the
 * preload, and this is the other end of it: the only place in the app where a
 * request from the renderer becomes something happening to somebody's disk.
 *
 * Two rules, and everything here is one of them.
 *
 * **A root has to have been chosen.** Not "looks reasonable", not "is inside
 * the home directory" — chosen, by the user, in a dialog, in this app. The set
 * below is the record of that, seeded from the folders they chose before. A
 * renderer that invents a path gets nothing, which is what makes the path
 * checking in `fileStore.ts` a second line of defence rather than the only one.
 *
 * **A payload is a shape until it has been checked.** Every argument arrives
 * from a process that opens other people's documents, so each handler validates
 * before it acts and answers a refusal rather than throwing something
 * interesting back across the boundary.
 */
import { app, dialog, ipcMain, shell } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { realpath } from 'node:fs/promises'
import type { DesktopDirectory } from '../../src/adapters/desktop/channel'
import { log } from './log'
import {
  fingerprint, listDirectory, makeDirectory, readFile as readInside, removeEntry, resolveInside,
  writeFile as writeInside,
} from './fileStore'

/** Where the list of folders the user has chosen is kept, between runs. */
const RECENTS_FILE = 'recent-folders.json'

/** How many to remember. A menu, not an archive. */
const RECENTS_KEPT = 8

/**
 * The folders this renderer may touch.
 *
 * In memory and rebuilt every run from the recents file, so revoking access is
 * deleting one small JSON file, and a folder that has been removed from the
 * machine drops out on its own.
 */
const granted = new Set<string>()

let recents: DesktopDirectory[] = []

function recentsPath(): string {
  return join(app.getPath('userData'), RECENTS_FILE)
}

async function loadRecents(): Promise<void> {
  try {
    const held: unknown = JSON.parse(await readFile(recentsPath(), 'utf8'))
    if (!Array.isArray(held)) return
    for (const entry of held) {
      const root = (entry as DesktopDirectory)?.root
      if (typeof root !== 'string') continue
      // Resolved now, so what is granted is what the path meant at grant time —
      // and a folder that has gone away is simply not offered.
      const real = await realpath(root).catch(() => undefined)
      if (!real) continue
      granted.add(real)
      recents.push({ root: real, name: basename(real) })
    }
  } catch {
    // No file yet, or one somebody edited into nonsense. An empty list is the
    // right answer to both: the user picks a folder and it fills itself.
  }
}

async function rememberRecent(directory: DesktopDirectory): Promise<void> {
  recents = [directory, ...recents.filter((held) => held.root !== directory.root)].slice(0, RECENTS_KEPT)
  try {
    await writeFile(recentsPath(), `${JSON.stringify(recents, null, 2)}\n`, 'utf8')
  } catch (cause) {
    // Not fatal: the folder still works this run, it is only forgotten by the
    // next one. Worth a line in the log, not worth a dialog.
    log('files', `could not write ${RECENTS_FILE}: ${String(cause)}`)
  }
}

function isGranted(root: unknown): root is string {
  return typeof root === 'string' && granted.has(root)
}

function isPath(path: unknown): path is string {
  return typeof path === 'string'
}

/**
 * Bytes, and really bytes.
 *
 * What arrives over IPC for a `Uint8Array` is a `Uint8Array`, and for anything
 * else is anything else. A handler that trusted this would be writing whatever
 * `Buffer.from` makes of an arbitrary object to a file the user believes is
 * their project.
 */
function isBytes(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array
}

export function registerFileChannel(): void {
  void loadRecents()

  ipcMain.handle('files:chooseDirectory', async (): Promise<DesktopDirectory | undefined> => {
    const chosen = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    })
    const picked = chosen.filePaths[0]
    if (chosen.canceled || !picked) return undefined
    const real = await realpath(picked).catch(() => undefined)
    if (!real) return undefined
    granted.add(real)
    const directory = { root: real, name: basename(real) }
    await rememberRecent(directory)
    return directory
  })

  ipcMain.handle('files:recentDirectories', (): DesktopDirectory[] => recents)

  ipcMain.handle('files:list', async (_event, root: unknown, path: unknown) =>
    isGranted(root) && isPath(path) ? listDirectory(root, path) : undefined)

  ipcMain.handle('files:makeDirectory', async (_event, root: unknown, path: unknown) => {
    if (!isGranted(root) || !isPath(path)) throw new Error('shell.pathRefused')
    await makeDirectory(root, path)
  })

  ipcMain.handle('files:read', async (_event, root: unknown, path: unknown) =>
    isGranted(root) && isPath(path) ? readInside(root, path) : undefined)

  ipcMain.handle('files:write', async (_event, root: unknown, path: unknown, bytes: unknown) => {
    if (!isGranted(root) || !isPath(path) || !isBytes(bytes)) throw new Error('shell.pathRefused')
    return writeInside(root, path, bytes)
  })

  ipcMain.handle('files:remove', async (_event, root: unknown, path: unknown, options: unknown) => {
    if (!isGranted(root) || !isPath(path)) return
    const recursive = (options as { recursive?: unknown } | undefined)?.recursive === true
    await removeEntry(root, path, { recursive })
  })

  ipcMain.handle('files:fingerprint', async (_event, root: unknown, path: unknown) =>
    isGranted(root) && isPath(path) ? fingerprint(root, path) : undefined)

  ipcMain.handle('files:revealInFolder', async (_event, root: unknown, path: unknown) => {
    if (!isGranted(root) || !isPath(path)) return
    const target = await resolveInside(root, path)
    if (target) shell.showItemInFolder(target)
  })
}
