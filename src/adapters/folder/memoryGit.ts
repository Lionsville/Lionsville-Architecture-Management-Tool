// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A history kept in memory, over any folder handle — for the suites that run
 * the folder's repositories over the fake folder, where there is no git.
 *
 * Test support, as `fakeDirectory.ts` is: it does what the seam says and
 * nothing git does beyond it. Every commit keeps the whole folder as it was,
 * which is what makes reading one back, and what a commit changed, a lookup.
 * The suites over a real folder run the machine's own git instead.
 */
import { isBinaryPath } from '../../projects/folderFormat'
import type { DirectoryHandleLike } from './DirectoryHandle'
import type { CommitsWanted, CommittedFile, FolderChange, FolderCommit, FolderGit, FolderTag } from './folderGit'

type Tree = Map<string, string>

type Kept = { sha: string; at: number; message: string; tree: Tree; changed: string[] }

/** What a file holds, as one comparable text: its bytes, whatever they are. */
async function contentsOf(handle: { getFile(): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }> }): Promise<string> {
  const bytes = new Uint8Array(await (await handle.getFile()).arrayBuffer())
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
}

async function walk(folder: DirectoryHandleLike, within = '', tree: Tree = new Map()): Promise<Tree> {
  for await (const entry of folder.values()) {
    const path = within ? `${within}/${entry.name}` : entry.name
    if (entry.kind === 'directory') {
      if (entry.name !== '.git') await walk(entry, path, tree)
    } else {
      tree.set(path, await contentsOf(entry))
    }
  }
  return tree
}

function isUnder(path: string, spec: string): boolean {
  return spec === '' || path === spec || path.startsWith(`${spec}/`)
}

function asFile(path: string, held: string): CommittedFile {
  const bytes = Uint8Array.from(held, (character) => character.charCodeAt(0))
  return isBinaryPath(path) ? { path, bytes } : { path, text: new TextDecoder().decode(bytes) }
}

export function memoryGit(root: DirectoryHandleLike, author = 'memory'): FolderGit {
  const commits: Kept[] = []
  const tags: FolderTag[] = []
  let started = false
  let clock = 0
  const head = (): Tree => commits[commits.length - 1]?.tree ?? new Map()

  const changes = async (): Promise<FolderChange[]> => {
    const now = await walk(root)
    const was = head()
    const found: FolderChange[] = []
    for (const [path, held] of now) if (was.get(path) !== held) found.push({ path, deleted: false })
    for (const path of was.keys()) if (!now.has(path)) found.push({ path, deleted: true })
    return found.sort((one, other) => (one.path < other.path ? -1 : 1))
  }

  return {
    keeping: () => Promise.resolve(started),
    start: () => {
      started = true
      return Promise.resolve()
    },
    changes,
    async commit(paths, message) {
      const now = await walk(root)
      const tree = new Map(head())
      const changed: string[] = []
      for (const path of paths) {
        const held = now.get(path)
        if (held === tree.get(path)) continue
        changed.push(path)
        if (held === undefined) tree.delete(path)
        else tree.set(path, held)
      }
      if (changed.length === 0) return undefined
      started = true
      // A clock of its own, so two commits in one millisecond are still in order.
      clock = Math.max(Date.now(), clock + 1)
      const sha = `commit-${commits.length + 1}`
      commits.push({ sha, at: clock, message, tree, changed: changed.sort() })
      return sha
    },
    log(wanted: CommitsWanted): Promise<FolderCommit[]> {
      let from = commits.length - 1
      if (wanted.from !== undefined) from = commits.findIndex((kept) => kept.sha === wanted.from)
      const found: FolderCommit[] = []
      for (let at = from; at >= 0 && found.length < wanted.limit; at -= 1) {
        const kept = commits[at]
        if (wanted.grep !== undefined && !kept.message.includes(wanted.grep)) continue
        if (wanted.paths && !kept.changed.some((path) => wanted.paths!.some((spec) => isUnder(path, spec)))) continue
        found.push({
          sha: kept.sha, at: kept.at, author, subject: kept.message.split('\n')[0], message: kept.message, changed: kept.changed,
        })
      }
      return Promise.resolve(found)
    },
    treeAt(sha, inside) {
      const kept = commits.find((one) => one.sha === sha)
      return Promise.resolve(kept ? [...kept.tree.keys()].filter((path) => isUnder(path, inside)).sort() : [])
    },
    readAt(sha, paths) {
      const kept = commits.find((one) => one.sha === sha)
      return Promise.resolve(paths.flatMap((path) => {
        const held = kept?.tree.get(path)
        return held === undefined ? [] : [asFile(path, held)]
      }))
    },
    tags: () => Promise.resolve(tags.map((tag) => ({ ...tag }))),
    tag(sha, name, message) {
      if (tags.some((tag) => tag.name === name)) return Promise.resolve('exists')
      tags.push({ name, sha, message })
      return Promise.resolve('done')
    },
  }
}
