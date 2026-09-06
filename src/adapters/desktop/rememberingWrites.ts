/**
 * Telling our own writes apart from somebody else's.
 *
 * Every save round-trips through the watcher: we write a file, the filesystem
 * says a file changed, and without this the app would interrupt itself every
 * three seconds to ask about a conflict with its own autosave. That is not a
 * cosmetic problem — it is exactly how a sync feature becomes a thing people
 * switch off.
 *
 * Main cannot answer it. It sees a filesystem event and has no idea which
 * process caused it, and a "was that me?" flag in main would be wrong the
 * moment two windows share a folder. The renderer can: it knows what it wrote
 * and what was in it.
 *
 * So this wraps the channel and remembers the fingerprint of every write. A
 * reported change whose fingerprint matches what we last put there is ours —
 * by content, not by timing, so a slow notification, a sync client's echo and a
 * colleague saving a file back to exactly what we wrote are all the same case
 * and none of them needs a timer.
 */
import type { DesktopChange, DesktopFiles, DesktopStamp } from './channel'

export type FolderChannel = {
  /** The channel to use for everything, so nothing writes behind its back. */
  files: DesktopFiles
  /** Is this reported change one of ours, coming back? */
  ours(change: DesktopChange): boolean
}

export function rememberingWrites(files: DesktopFiles): FolderChannel {
  /** Path to what we last left there. `undefined` means we removed it. */
  const written = new Map<string, string | undefined>()
  const keyFor = (root: string, path: string) => `${root} ${path}`

  return {
    files: {
      ...files,
      async write(root, path, bytes): Promise<DesktopStamp> {
        const stamp = await files.write(root, path, bytes)
        written.set(keyFor(root, path), stamp.sha256)
        return stamp
      },
      async remove(root, path, options): Promise<void> {
        await files.remove(root, path, options)
        // Only the path asked for. A recursive remove takes files with it whose
        // names we never had, and those come back as somebody's change — which
        // is honest, since we cannot claim what we did not name.
        written.set(keyFor(root, path), undefined)
      },
    },
    ours(change) {
      const key = keyFor(change.root, change.path)
      if (!written.has(key)) return false
      return written.get(key) === change.stamp?.sha256
    },
  }
}
