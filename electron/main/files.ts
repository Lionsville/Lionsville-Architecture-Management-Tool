// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import { app, dialog, ipcMain, shell, webContents } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { realpath } from 'node:fs/promises'
import type { DesktopChange, DesktopDirectory } from '../../src/adapters/desktop/channel'
import { SCOPE_FILE, scopeNameIn } from '../../src/platform/scopeHeader'
import {
  excludeLocalSettings, filesAt, gitAvailable, history, initRepository, isRepository, label, pull, push, remote,
  resolve, snapshot,
} from '../../src/platform/node/git'
import {
  allTags, changes, commitLog, commitPaths, headOf, isScopeTagName, readAt, readiness, startHistory, tagCommit, textsOf, treeAt,
} from '../../src/platform/node/gitEntries'
import { log } from './log'
import { sayable } from './sayable'
import { watchFolder } from './watch'
import {
  fingerprint, listDirectory, makeDirectory, moveEntry, readFile as readInside, removeEntry, resolveInside,
  writeFile as writeInside, writeTogether as writeTogetherInside,
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

/**
 * Told whenever the list of granted folders changes, so the Recent submenu can
 * be rebuilt. A callback rather than an import, because the menu knowing about
 * files is one direction and files knowing about the menu is the other, and
 * only one of them can be true without a cycle.
 */
let onRecentsChanged: (() => void) | undefined

/** The folders the user has granted, most recent first. For the menu. */
export function recentDirectories(): readonly DesktopDirectory[] {
  return recents
}

/**
 * What to call a working directory: the organisation it holds, or the folder.
 *
 * A working directory IS the root scope (ADR-0012 §1), so the honest label for
 * one is the name in its `scope.json`. A folder that has none — never opened,
 * or not a working directory at all — is called what the person called it in
 * their file manager, which is what this always said.
 *
 * One small read per folder, on the few occasions the list changes. The window
 * title and the Recent menu are the two things that show it.
 */
async function nameOf(root: string): Promise<string> {
  const text = await readFile(join(root, SCOPE_FILE), 'utf8').catch(() => undefined)
  return scopeNameIn(text) ?? basename(root)
}

/** The folders being watched, and how to stop watching each. */
const watching = new Map<string, () => void>()

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
      recents.push({ root: real, name: await nameOf(real) })
    }
  } catch {
    // No file yet, or one somebody edited into nonsense. An empty list is the
    // right answer to both: the user picks a folder and it fills itself.
  }
  onRecentsChanged?.()
}

async function rememberRecent(directory: DesktopDirectory): Promise<void> {
  recents = [directory, ...recents.filter((held) => held.root !== directory.root)].slice(0, RECENTS_KEPT)
  onRecentsChanged?.()
  try {
    await writeFile(recentsPath(), `${JSON.stringify(recents, null, 2)}\n`, 'utf8')
  } catch (cause) {
    // Not fatal: the folder still works this run, it is only forgotten by the
    // next one. Worth a line in the log, not worth a dialog.
    log('files', `could not write ${RECENTS_FILE}: ${String(cause)}`)
  }
}

/**
 * Let the renderer at this folder.
 *
 * Behind the dialog, and exported for the one caller that has no user to click
 * one: the smoke run, which has to exercise the real channel against a real
 * folder. Nothing else may call it — a granted folder is supposed to mean
 * somebody chose it.
 */
export async function grantDirectory(
  path: string, options: { remember?: boolean } = {},
): Promise<DesktopDirectory | undefined> {
  const real = await realpath(path).catch(() => undefined)
  if (!real) return undefined
  granted.add(real)
  const directory = { root: real, name: await nameOf(real) }
  // The smoke run's folder is a temporary directory that will not exist an hour
  // from now, and the Recent menu is for folders a person chose.
  if (options.remember !== false) await rememberRecent(directory)
  return directory
}

function isGranted(root: unknown): root is string {
  return typeof root === 'string' && granted.has(root)
}

function isPath(path: unknown): path is string {
  return typeof path === 'string'
}

/**
 * A path the history may be filtered by: what the format writes, relative to
 * the root, with at most a `*` inside a name. Not an option (no leading `-`),
 * not an escape (no `..`), not a pathspec with magic in it (no `:`).
 */
function isHistoryPath(path: string): boolean {
  return /^[A-Za-z0-9_][A-Za-z0-9_\-./*]*$/.test(path) && !path.includes('..')
}

/** A list of strings, and nothing else in it. */
function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((one) => typeof one === 'string')
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

export function registerFileChannel(options: { onRecentsChanged?: () => void } = {}): void {
  onRecentsChanged = options.onRecentsChanged
  void loadRecents()

  ipcMain.handle('files:chooseDirectory', async (): Promise<DesktopDirectory | undefined> => {
    const chosen = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    })
    const picked = chosen.filePaths[0]
    if (chosen.canceled || !picked) return undefined
    return grantDirectory(picked)
  })

  ipcMain.handle('files:recentDirectories', (): DesktopDirectory[] => recents)

  ipcMain.handle('files:list', async (_event, root: unknown, path: unknown) =>
    isGranted(root) && isPath(path) ? listDirectory(root, path) : undefined)

  answer('files:makeDirectory', async (_event, root: unknown, path: unknown) => {
    if (!isGranted(root) || !isPath(path)) throw new Error('shell.pathRefused')
    await makeDirectory(root, path)
  })

  ipcMain.handle('files:read', async (_event, root: unknown, path: unknown) =>
    isGranted(root) && isPath(path) ? readInside(root, path) : undefined)

  answer('files:write', async (_event, root: unknown, path: unknown, bytes: unknown) => {
    if (!isGranted(root) || !isPath(path) || !isBytes(bytes)) throw new Error('shell.pathRefused')
    return writeInside(root, path, bytes)
  })

  answer('files:writeTogether', async (_event, root: unknown, writes: unknown, removals: unknown) => {
    const shaped = Array.isArray(writes) && writes.every((write: unknown) => {
      const held = write as { path?: unknown; bytes?: unknown } | undefined
      return isPath(held?.path) && isBytes(held?.bytes)
    })
    if (!isGranted(root) || !shaped || !Array.isArray(removals) || !removals.every(isPath)) {
      throw new Error('shell.pathRefused')
    }
    return writeTogetherInside(root, writes as { path: string; bytes: Uint8Array }[], removals as string[])
  })

  answer('files:remove', async (_event, root: unknown, path: unknown, options: unknown) => {
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

  /**
   * A real save dialog, and a file where the user said.
   *
   * The one write in this file that is not inside a granted folder, and it does
   * not need to be: the dialog is the grant. The path is not added to the
   * granted set and not remembered — it is one file, handed over once. It IS
   * added to the OS's recent documents, which is what makes the association
   * worth having.
   */
  ipcMain.handle('files:saveDocument', async (
    _event, name: unknown, bytes: unknown, mediaType: unknown,
  ): Promise<boolean> => {
    if (typeof name !== 'string' || !isBytes(bytes)) throw new Error('shell.pathRefused')
    const chosen = await dialog.showSaveDialog({ defaultPath: basename(name) })
    if (chosen.canceled || !chosen.filePath) return false
    await writeFile(chosen.filePath, bytes)
    if (typeof mediaType === 'string' && chosen.filePath.endsWith('.lvarch')) {
      app.addRecentDocument(chosen.filePath)
    }
    return true
  })

  // --- history (ADR-0003, layer two) ----------------------------------------
  //
  // The same rule as every handler above: a root the user granted, or nothing.
  // Git runs in the folder they chose and nowhere else.

  ipcMain.handle('git:available', () => gitAvailable())

  ipcMain.handle('git:isRepository', (_event, root: unknown) =>
    isGranted(root) ? isRepository(root) : false)

  ipcMain.handle('git:init', async (_event, root: unknown) => {
    if (!isGranted(root)) throw new Error('shell.pathRefused')
    await initRepository(root)
  })

  ipcMain.handle('git:snapshot', async (_event, root: unknown, message: unknown) => {
    if (!isGranted(root) || typeof message !== 'string') throw new Error('shell.pathRefused')
    return snapshot(root, message)
  })

  ipcMain.handle('git:history', (_event, root: unknown, limit: unknown, paths: unknown) => {
    if (!isGranted(root)) return []
    // A path is one the format writes, with at most a `*` in a name. Anything
    // else — an option, a `..`, a `:(magic)` pathspec — is refused as a whole
    // rather than trimmed, because a filter that quietly widened would show
    // the wrong history without a word.
    const filter = paths === undefined ? [] : Array.isArray(paths) ? paths : undefined
    if (!filter || !filter.every((path) => typeof path === 'string' && isHistoryPath(path))) return []
    return history(root, typeof limit === 'number' ? limit : undefined, filter)
  })

  ipcMain.handle('git:filesAt', (_event, root: unknown, sha: unknown, prefix: unknown) => {
    if (!isGranted(root) || typeof sha !== 'string' || typeof prefix !== 'string') return []
    // A sha is forty hex characters and a prefix is a path we wrote — or
    // nothing, for the root scope, whose folder is the root itself. Anything
    // else is somebody trying an argument on for size.
    if (!/^[0-9a-f]{7,40}$/.test(sha) || !/^[A-Za-z0-9_\-./]*$/.test(prefix) || prefix.includes('..')) {
      return []
    }
    return filesAt(root, sha, prefix)
  })

  ipcMain.handle('git:label', (_event, root: unknown, sha: unknown, name: unknown) => {
    // A refusal, never a throw: the renderer shows the word.
    if (!isGranted(root) || typeof sha !== 'string' || typeof name !== 'string') return 'unnamed'
    if (!/^[0-9a-f]{7,40}$/.test(sha) || name.length > 200) return 'unnamed'
    return label(root, sha, name)
  })

  // The remote (ADR-0005). The same rule again, and every answer is a value:
  // a refusal crosses the boundary as a word, never as a thrown error with a
  // path in it.
  ipcMain.handle('git:remote', (_event, root: unknown) =>
    isGranted(root) ? remote(root) : undefined)

  ipcMain.handle('git:pull', (_event, root: unknown) =>
    isGranted(root) ? pull(root) : 'no-remote')

  ipcMain.handle('git:push', (_event, root: unknown) =>
    isGranted(root) ? push(root) : 'no-remote')

  ipcMain.handle('git:resolve', (_event, root: unknown, side: unknown) =>
    isGranted(root) && (side === 'theirs' || side === 'ours') ? resolve(root, side) : 'no-remote')

  ipcMain.handle('git:excludeLocal', async (_event, root: unknown) => {
    if (isGranted(root)) await excludeLocalSettings(root)
  })

  registerRepositoryChannels()

  ipcMain.handle('files:watch', (_event, root: unknown) => {
    if (!isGranted(root) || watching.has(root)) return
    watching.set(root, watchFolder(root, (changes) => {
      // To every window there is, because there is one, and because a renderer
      // that has been replaced (a reload, a crash) simply has no listener.
      const events: DesktopChange[] = changes.map((change) => ({ root, ...change }))
      for (const contents of webContents.getAllWebContents()) {
        if (!contents.isDestroyed()) contents.send('files:changed', events)
      }
    }))
  })

  ipcMain.handle('files:unwatch', (_event, root: unknown) => {
    if (typeof root !== 'string') return
    watching.get(root)?.()
    watching.delete(root)
  })
}

/** Stop every watcher. Called on the way out, so nothing holds the process. */
export function stopWatching(): void {
  for (const stop of watching.values()) stop()
  watching.clear()
}

/**
 * What the folder's repositories ask of main beyond the file channel
 * (ADR-0031 §2) — a scope moved as one rename, and the history they read —
 * with the same rule as every handler of the file channel: a root the person
 * granted, or nothing.
 */
/** A handler of the repositories' channels, whose failures cross as {@link sayable} makes them. */
function answer(channel: string, handler: (event: unknown, ...args: never[]) => unknown): void {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    try {
      return await (handler as (event: unknown, ...args: unknown[]) => unknown)(event, ...args)
    } catch (cause) {
      throw sayable(channel, cause, (said) => log('git', said))
    }
  })
}

function registerRepositoryChannels(): void {
  answer('files:move', async (_event, root: unknown, from: unknown, to: unknown) => {
    if (!isGranted(root) || !isPath(from) || !isPath(to)) throw new Error('shell.pathRefused')
    await moveEntry(root, from, to)
  })

  // Every path a string inside the folder: `gitEntries.ts` hands
  // git each one as a literal, and refuses an escape before git sees it.

  answer('git:startHistory', async (_event, root: unknown) => {
    if (!isGranted(root)) throw new Error('shell.pathRefused')
    await startHistory(root)
  })

  answer('git:readiness', (_event, root: unknown) => {
    if (!isGranted(root)) throw new Error('shell.pathRefused')
    return readiness(root)
  })

  answer('git:changes', (_event, root: unknown) => (isGranted(root) ? changes(root) : []))

  answer('git:commitPaths', (_event, root: unknown, paths: unknown, message: unknown) => {
    if (!isGranted(root) || !isStrings(paths) || typeof message !== 'string') throw new Error('shell.pathRefused')
    return commitPaths(root, paths, message)
  })

  answer('git:head', (_event, root: unknown) => (isGranted(root) ? headOf(root) : undefined))

  answer('git:log', (_event, root: unknown, wanted: unknown) => {
    const held = wanted as { paths?: unknown; grep?: unknown; limit?: unknown; tip?: unknown; skip?: unknown; firstParent?: unknown } | null
    if (!isGranted(root) || !held || typeof held !== 'object' || typeof held.limit !== 'number') return []
    if (held.paths !== undefined && !isStrings(held.paths)) return []
    if ((held.grep !== undefined && typeof held.grep !== 'string') || (held.tip !== undefined && typeof held.tip !== 'string')) return []
    if (held.skip !== undefined && typeof held.skip !== 'number') return []
    return commitLog(root, {
      limit: held.limit,
      ...(held.paths !== undefined ? { paths: held.paths as string[] } : {}),
      ...(held.grep !== undefined ? { grep: held.grep as string } : {}),
      ...(held.tip !== undefined ? { tip: held.tip as string } : {}),
      ...(held.skip !== undefined ? { skip: held.skip as number } : {}),
      ...(held.firstParent === true ? { firstParent: true } : {}),
      ...((held as { bare?: unknown }).bare === true ? { bare: true } : {}),
    })
  })

  answer('git:treeAt', (_event, root: unknown, sha: unknown, within: unknown) =>
    (isGranted(root) && typeof sha === 'string' && typeof within === 'string' ? treeAt(root, sha, within) : []))

  answer('git:readAt', (_event, root: unknown, sha: unknown, paths: unknown) =>
    (isGranted(root) && typeof sha === 'string' && isStrings(paths) ? readAt(root, sha, paths) : []))

  answer('git:texts', (_event, root: unknown, ids: unknown) =>
    (isGranted(root) && isStrings(ids) ? textsOf(root, ids) : {}))

  answer('git:tags', (_event, root: unknown) => (isGranted(root) ? allTags(root) : []))

  answer('git:tag', (_event, root: unknown, sha: unknown, name: unknown, message: unknown) => {
    // A scope's label and nothing else: `<space>/<slug>`, which no option and
    // no name of a person's can be.
    if (!isGranted(root) || typeof sha !== 'string' || typeof name !== 'string' || !isScopeTagName(name)
      || typeof message !== 'string') {
      throw new Error('shell.pathRefused')
    }
    return tagCommit(root, sha, name, message)
  })
}
