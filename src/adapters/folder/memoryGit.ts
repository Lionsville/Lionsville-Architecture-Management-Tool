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
import { fingerprint } from '../../projects/revision'
import type { CommitsWanted, CommittedFile, FolderChange, FolderCommit, FolderGit, FolderTag, TreeEntry } from './folderGit'

type Tree = Map<string, string>

type Kept = { sha: string; parents: string[]; at: number; message: string; tree: Tree; changed: string[]; blobs: Record<string, [string, string]> }

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

/** What a file held, named as git names it: by what it held. */
function blobOf(held: string | undefined): string {
  return held === undefined ? '' : fingerprint(['blob', held])
}

export function memoryGit(root: DirectoryHandleLike, author = 'memory'): FolderGit {
  const commits: Kept[] = []
  const texts = new Map<string, string>()
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
    readiness: () => Promise.resolve('ready'),
    changes,
    async commit(paths, message) {
      const now = await walk(root)
      const tree = new Map(head())
      const changed: string[] = []
      const blobs: Record<string, [string, string]> = {}
      for (const path of paths) {
        const held = now.get(path)
        if (held === tree.get(path)) continue
        changed.push(path)
        blobs[path] = [blobOf(tree.get(path)), blobOf(held)]
        if (held !== undefined) texts.set(blobOf(held), held)
        if (held === undefined) tree.delete(path)
        else tree.set(path, held)
      }
      if (changed.length === 0) return undefined
      started = true
      // A clock of its own, so two commits in one millisecond are still in order.
      clock = Math.max(Date.now(), clock + 1)
      const sha = `commit-${commits.length + 1}`
      const parents = commits.length ? [commits[commits.length - 1].sha] : []
      commits.push({ sha, parents, at: clock, message, tree, changed: changed.sort(), blobs })
      return sha
    },
    head: () => Promise.resolve(commits[commits.length - 1]?.sha),
    // One line of history, so first parents are every parent and a tip is where it starts.
    log(wanted: CommitsWanted): Promise<FolderCommit[]> {
      let from = commits.length - 1
      if (wanted.tip !== undefined) from = commits.findIndex((kept) => kept.sha === wanted.tip)
      const found: FolderCommit[] = []
      let skip = wanted.skip ?? 0
      for (let at = from; at >= 0 && found.length < wanted.limit; at -= 1) {
        const kept = commits[at]
        if (wanted.grep !== undefined && !kept.message.includes(wanted.grep)) continue
        const changed = wanted.paths
          ? kept.changed.filter((path) => wanted.paths!.some((spec) => isUnder(path, spec)))
          : kept.changed
        if (wanted.paths && changed.length === 0) continue
        if (skip > 0) {
          skip -= 1
          continue
        }
        found.push({
          sha: kept.sha, parents: kept.parents, at: kept.at, author, subject: kept.message.split('\n')[0], message: kept.message,
          changed: wanted.bare ? [] : changed,
          ...(wanted.bare ? {} : { blobs: Object.fromEntries(changed.map((path) => [path, kept.blobs[path]])) }),
        })
      }
      return Promise.resolve(found)
    },
    treeAt(sha, inside): Promise<TreeEntry[]> {
      const kept = commits.find((one) => one.sha === sha)
      return Promise.resolve(kept
        ? [...kept.tree].filter(([path]) => isUnder(path, inside)).sort(([one], [other]) => (one < other ? -1 : 1))
          .map(([path, held]) => ({ path, blob: blobOf(held) }))
        : [])
    },
    readAt(sha, paths) {
      const kept = commits.find((one) => one.sha === sha)
      return Promise.resolve(paths.flatMap((path) => {
        const held = kept?.tree.get(path)
        return held === undefined ? [] : [asFile(path, held)]
      }))
    },
    blobsAt(at) {
      return Promise.resolve(at.map(({ sha, path }) => {
        const held = commits.find((one) => one.sha === sha)?.tree.get(path)
        return held === undefined ? undefined : blobOf(held)
      }))
    },
    texts(ids) {
      return Promise.resolve(Object.fromEntries(ids.flatMap((id) => {
        const held = texts.get(id)
        return held === undefined ? [] : [[id, new TextDecoder().decode(Uint8Array.from(held, (character) => character.charCodeAt(0)))]]
      })))
    },
    tags: () => Promise.resolve(tags.map((tag) => ({ ...tag }))),
    tag(sha, name, message) {
      if (tags.some((tag) => tag.name === name)) return Promise.resolve('exists')
      tags.push({ name, sha, message })
      return Promise.resolve('done')
    },
  }
}
