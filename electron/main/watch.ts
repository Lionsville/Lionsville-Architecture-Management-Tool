/**
 * Noticing that the folder changed under us.
 *
 * A working directory has other authors: a sync client, a colleague's checkout,
 * the same person on another machine, a text editor with the model open. The
 * app has to find out within a second or so, and it must never quietly write
 * over what it finds — which is what `documentSession` is for, one layer up.
 * This is only the noticing.
 *
 * No Electron in here, so it can be tested against a real folder. What it has
 * to get right is not the watching, which is one call, but the noise:
 *
 * - **Editors do not write files, they replace them.** A save is a temporary
 *   file, an fsync and a rename; some also write a lock file and a backup. One
 *   save is therefore several events on several paths, and the ones with a
 *   `.tmp`/`.swp`/`~` name are nobody's business.
 * - **A change arrives more than once.** Watching APIs coalesce differently on
 *   every platform, so a burst is collected and reported as a set of paths.
 * - **Our own writes come back as news.** Not suppressed here: main cannot tell
 *   whose write it was. Each reported path carries a fingerprint, and the
 *   renderer — which knows what it last wrote — decides.
 */
import { createHash } from 'node:crypto'
import { watch } from 'node:fs'
import type { FSWatcher } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { basename, join, sep } from 'node:path'
import type { DesktopStamp } from '../../src/adapters/desktop/channel'

/** One path that changed, with what is there now — absent when it is gone. */
export type FolderChange = { path: string; stamp?: DesktopStamp }

/**
 * How long a burst is collected before it is reported.
 *
 * Long enough that one save is one report — a rename after a write is two
 * events milliseconds apart — and short enough that the exit criterion holds:
 * a change made in another editor is noticed within a second.
 */
export const WATCH_SETTLE_MS = 120

/** What no editor's save should ever be reported as. */
function isNoise(path: string): boolean {
  const segments = path.split(/[/\\]/)
  // Every segment, not just the last one. A dot names somebody else's workings
  // at any depth, and the one that matters is `.git`: history snapshots commit
  // into this very folder, so a basename-only test reports every object a
  // snapshot writes as a user's edit — and each one is answered below with a
  // full read and a hash of the file.
  if (segments.some((segment) => segment.startsWith('.'))) return true
  const name = segments[segments.length - 1] ?? ''
  return name.endsWith('~')
    || /\.(tmp|swp|swx|part|crdownload)$/i.test(name)
    || /^\d+\.tmp$/i.test(name)
}

async function stampOf(root: string, path: string): Promise<DesktopStamp | undefined> {
  try {
    const full = join(root, path)
    const held = await stat(full)
    if (!held.isFile()) return undefined
    return {
      mtimeMs: held.mtimeMs,
      size: held.size,
      sha256: createHash('sha256').update(await readFile(full)).digest('hex'),
    }
  } catch {
    // Gone, or being replaced at this instant. Either way there is nothing to
    // fingerprint, and "no stamp" is how a removal is reported.
    return undefined
  }
}

/**
 * Watch a folder and its subfolders, reporting settled bursts of changes.
 *
 * Returns the function that stops it. A folder that cannot be watched — a
 * platform without recursive watching, a drive that has gone — reports nothing
 * and stops cleanly, because a working directory that cannot be watched is
 * still a working directory. The caller degrades; it does not fail.
 */
export function watchFolder(
  root: string,
  onChanged: (changes: FolderChange[]) => void,
  settleMs = WATCH_SETTLE_MS,
): () => void {
  const pending = new Set<string>()
  let timer: NodeJS.Timeout | undefined
  let watcher: FSWatcher | undefined
  let stopped = false

  const settle = (): void => {
    timer = undefined
    const paths = [...pending].sort()
    pending.clear()
    if (paths.length === 0) return
    void Promise.all(paths.map(async (path) => ({ path, stamp: await stampOf(root, path) })))
      .then((changes) => { if (!stopped) onChanged(changes) })
  }

  // macOS reports one event for the watched directory itself, named after it,
  // whenever anything inside changes. There is nothing at that path to read and
  // nothing for anybody to act on.
  const itself = basename(root)

  try {
    watcher = watch(root, { recursive: true }, (_event, name) => {
      if (!name) return
      const path = String(name).split(sep).join('/')
      if (path === itself || isNoise(path)) return
      pending.add(path)
      if (timer) clearTimeout(timer)
      timer = setTimeout(settle, settleMs)
    })
    // A watcher that dies takes the notifications with it and must not take the
    // process: an unwatched folder is a working folder, one layer worse.
    watcher.on('error', () => { watcher?.close() })
  } catch {
    watcher = undefined
  }

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    watcher?.close()
  }
}
