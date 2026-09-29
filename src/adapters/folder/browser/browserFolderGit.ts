// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A browser folder's history, kept in this browser (ADR-0031, as built).
 *
 * A browser has no git to run, and a folder opened in one still keeps its
 * history the way the folder's history is kept everywhere — entries are
 * commits, a thing's history is read off them, a label is a tag — so this is
 * the folder's history seam (`FolderGit`) over this browser's database, and
 * the history repository over it is the one the desktop's git answers
 * (`FolderHistory`). **It is this browser's, not the folder's**: the folder
 * holds none of it, and a history the desktop keeps of the same folder in git
 * is another history.
 *
 * **What it keeps.** File contents by their SHA-256, each once however many
 * commits hold it; each commit as the map of its paths to those contents, what
 * it changed from and to, and its message; the tags; and which commit the
 * folder is at. A commit costs the files it changed, and a folder is read to
 * record only where a file's size or time written says it changed since it
 * was last recorded.
 *
 * One line of history: a browser's folder has no branch and no merge.
 */
import { isBinaryPath } from '../../../projects/folderFormat'
import { LOCAL_SETTINGS_PATH } from '../../../projects/folderSettings'
import type { DirectoryHandleLike } from '../DirectoryHandle'
import type { CommitsWanted, CommittedFile, FolderChange, FolderCommit, FolderGit, FolderTag, TreeEntry } from '../folderGit'
import { filesUnder } from '../handles'
import type { BrowserFolder } from './browserFolder'

/** A file in a commit: what it held, and the size and time written it had when it was recorded. */
type TreeRow = { blob: string; size: number; lastModified: number }

/** A commit as a log lists it, kept under its place in the line. */
type LogRow = Omit<FolderCommit, 'subject'> & { seq: number }

/** A commit's tree, kept under its id. */
type CommitRow = { seq: number; tree: Record<string, TreeRow> }

/** Who a commit is by, where a browser knows nobody. */
const AUTHOR = 'this browser'

/** How many commits are read at a time while a log fills. */
const CHUNK = 200

function seqName(seq: number): string {
  return String(seq).padStart(12, '0')
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256(bytes: Uint8Array): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))
}

function isUnder(path: string, spec: string): boolean {
  return spec === '' || path === spec || path.startsWith(`${spec}/`)
}

/** A working file, as the folder has it now. */
type Working = { path: string; size: number; lastModified: number; read(): Promise<Uint8Array> }

/** A working file's contents, where they differ from a tree row: its stamp says it changed, and its bytes agree. */
async function differs(file: Working, row: TreeRow | undefined): Promise<{ blob: string; bytes: Uint8Array } | undefined> {
  if (row && row.size === file.size && row.lastModified === file.lastModified) return undefined
  const bytes = await file.read()
  const blob = await sha256(bytes)
  return blob === row?.blob ? undefined : { blob, bytes }
}

/** What a commit of some paths makes of a tree: the new tree, the contents it adds, and what changed from and to. */
async function planned(was: Record<string, TreeRow>, now: Map<string, Working>, paths: readonly string[]) {
  const tree = { ...was }
  const objects = new Map<string, Uint8Array>()
  const changed: string[] = []
  const blobs: Record<string, [string, string]> = {}
  for (const path of [...new Set(paths)].sort()) {
    const file = now.get(path)
    const before = was[path]
    if (!file) {
      if (!before) continue
      delete tree[path]
      changed.push(path)
      blobs[path] = [before.blob, '']
      continue
    }
    const next = await differs(file, before)
    if (!next) {
      // Unchanged, and its stamp remembered, so the next look need not read it.
      if (before) tree[path] = { ...before, size: file.size, lastModified: file.lastModified }
      continue
    }
    objects.set(next.blob, next.bytes)
    tree[path] = { blob: next.blob, size: file.size, lastModified: file.lastModified }
    changed.push(path)
    blobs[path] = [before?.blob ?? '', next.blob]
  }
  return { tree, objects, changed, blobs }
}

export function browserFolderGit(folder: BrowserFolder, root: DirectoryHandleLike): FolderGit {
  const store = folder.store

  const working = async (): Promise<Map<string, Working>> => {
    const files = await filesUnder(root, (name, within) => name === '.git' && within === '')
    const found = new Map<string, Working>()
    for (const { path, handle } of files) {
      if (path === LOCAL_SETTINGS_PATH) continue
      const file = await handle.getFile()
      found.set(path, { path, size: file.size, lastModified: file.lastModified, read: async () => new Uint8Array(await file.arrayBuffer()) })
    }
    return found
  }

  const head = async (): Promise<string | undefined> => {
    const key = await folder.keyOf('ref', 'HEAD')
    return store.transaction(['folderData'], 'read', (tx) => tx.get<string>('folderData', key))
  }

  const commitRow = async (sha: string): Promise<CommitRow | undefined> => {
    const key = await folder.keyOf('commit', sha)
    return store.transaction(['folderData'], 'read', (tx) => tx.get<CommitRow>('folderData', key))
  }

  const headTree = async (): Promise<{ sha?: string; seq: number; tree: Record<string, TreeRow> }> => {
    const sha = await head()
    const row = sha ? await commitRow(sha) : undefined
    return { ...(sha ? { sha } : {}), seq: row?.seq ?? 0, tree: row?.tree ?? {} }
  }

  const texts = async (ids: readonly string[]): Promise<Record<string, string>> => {
    const keys = await Promise.all(ids.map((id) => folder.keyOf('object', id)))
    const held = await store.transaction(['folderData'], 'read', (tx) => Promise.all(keys.map((key) => tx.get<Uint8Array>('folderData', key))))
    return Object.fromEntries(ids.flatMap((id, at) => (held[at] ? [[id, new TextDecoder().decode(held[at])]] : [])))
  }

  return {
    keeping: async () => (await head()) !== undefined,
    start: () => Promise.resolve(),
    readiness: () => Promise.resolve('ready'),

    async changes(): Promise<FolderChange[]> {
      const [{ tree }, now] = await Promise.all([headTree(), working()])
      const found: FolderChange[] = []
      for (const file of now.values()) if (await differs(file, tree[file.path])) found.push({ path: file.path, deleted: false })
      for (const path of Object.keys(tree)) if (!now.has(path)) found.push({ path, deleted: true })
      return found.sort((one, other) => (one.path < other.path ? -1 : 1))
    },

    async commit(paths, message): Promise<string | undefined> {
      const [was, now] = await Promise.all([headTree(), working()])
      const { tree, objects, changed, blobs } = await planned(was.tree, now, paths)
      if (changed.length === 0) return undefined
      const seq = was.seq + 1
      const at = Date.now()
      const parents = was.sha ? [was.sha] : []
      const sha = await sha256(new TextEncoder().encode(JSON.stringify({ parents, seq, at, message, blobs })))
      const keys = {
        commit: await folder.keyOf('commit', sha), seq: await folder.keyOf('seq', seqName(seq)), head: await folder.keyOf('ref', 'HEAD'),
        objects: await Promise.all([...objects.keys()].map((blob) => folder.keyOf('object', blob))),
      }
      const row: LogRow = { sha, parents, seq, at, author: AUTHOR, message, changed, blobs }
      await store.transaction(['folderData'], 'write', (tx) => {
        ;[...objects.values()].forEach((bytes, index) => tx.put('folderData', keys.objects[index], bytes))
        tx.put('folderData', keys.commit, { seq, tree } satisfies CommitRow)
        tx.put('folderData', keys.seq, row)
        tx.put('folderData', keys.head, sha)
        return Promise.resolve()
      })
      return sha
    },

    head,

    async log(wanted: CommitsWanted): Promise<FolderCommit[]> {
      const tip = wanted.tip ?? await head()
      const tipRow = tip ? await commitRow(tip) : undefined
      if (!tipRow) return []
      const range = await folder.kind('seq')
      let below = await folder.keyOf('seq', seqName(tipRow.seq + 1))
      let skip = wanted.skip ?? 0
      const found: FolderCommit[] = []
      for (;;) {
        const rows = await store.transaction(['folderData'], 'read', (tx) =>
          tx.range<LogRow>('folderData', { from: range.from, below, reverse: true, limit: CHUNK }))
        for (const { value } of rows) {
          if (wanted.grep !== undefined && !value.message.includes(wanted.grep)) continue
          const changed = wanted.paths ? value.changed.filter((path) => wanted.paths!.some((spec) => isUnder(path, spec))) : value.changed
          if (wanted.paths && changed.length === 0) continue
          if (skip > 0) {
            skip -= 1
            continue
          }
          const { seq: _seq, blobs: _blobs, ...commit } = value
          found.push({
            ...commit, subject: value.message.split('\n')[0], changed: wanted.bare ? [] : changed,
            ...(wanted.bare ? {} : { blobs: Object.fromEntries(changed.map((path) => [path, value.blobs![path]])) }),
          })
          if (found.length >= wanted.limit) return found
        }
        if (rows.length < CHUNK) return found
        below = rows[rows.length - 1].key
      }
    },

    async treeAt(sha, inside): Promise<TreeEntry[]> {
      const row = await commitRow(sha)
      return Object.entries(row?.tree ?? {})
        .filter(([path]) => isUnder(path, inside))
        .sort(([one], [other]) => (one < other ? -1 : 1))
        .map(([path, { blob }]) => ({ path, blob }))
    },

    async readAt(sha, paths): Promise<CommittedFile[]> {
      const tree = (await commitRow(sha))?.tree ?? {}
      const wanted = paths.filter((path) => tree[path])
      const keys = await Promise.all(wanted.map((path) => folder.keyOf('object', tree[path].blob)))
      const held = await store.transaction(['folderData'], 'read', (tx) => Promise.all(keys.map((key) => tx.get<Uint8Array>('folderData', key))))
      return wanted.flatMap((path, at): CommittedFile[] => {
        const bytes = held[at]
        if (!bytes) return []
        return [isBinaryPath(path) ? { path, bytes } : { path, text: new TextDecoder().decode(bytes) }]
      })
    },

    texts,

    async tags(): Promise<FolderTag[]> {
      const range = await folder.kind('tag')
      const start = (await folder.keyOf('tag')).length
      const rows = await store.transaction(['folderData'], 'read', (tx) => tx.range<{ sha: string; message: string; at: number }>('folderData', range))
      return rows.sort((one, other) => one.value.at - other.value.at)
        .map(({ key, value }) => ({ name: key.slice(start), sha: value.sha, message: value.message }))
    },

    async tag(sha, name, message): Promise<'done' | 'exists'> {
      const key = await folder.keyOf('tag', name)
      return store.transaction(['folderData'], 'write', async (tx) => {
        if (await tx.get('folderData', key)) return 'exists'
        tx.put('folderData', key, { sha, message, at: Date.now() })
        return 'done'
      })
    },
  }
}
