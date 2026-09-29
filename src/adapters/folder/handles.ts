// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The folder, a path at a time: what the repositories over a folder do with a
 * handle beyond what the folder store does — a file read, written or removed
 * by its path from the root, and a folder's files listed.
 */
import type { DirectoryHandleLike, FileHandleLike } from './DirectoryHandle'
import { isAbsent } from './FileSystemScopeStore'

function segmentsOf(path: string): string[] {
  return path.split('/').filter((segment) => segment.length > 0)
}

/** The folder at a path, or `undefined` where it is not there and `create` is not asked. */
export async function folderAt(
  root: DirectoryHandleLike, path: string, create = false,
): Promise<DirectoryHandleLike | undefined> {
  let folder = root
  for (const segment of segmentsOf(path)) {
    try {
      folder = await folder.getDirectoryHandle(segment, { create })
    } catch (cause) {
      if (isAbsent(cause)) return undefined
      throw cause
    }
  }
  return folder
}

/** A file's handle by its path, or `undefined` where it is not there. */
export async function fileAt(root: DirectoryHandleLike, path: string): Promise<FileHandleLike | undefined> {
  const segments = segmentsOf(path)
  const folder = await folderAt(root, segments.slice(0, -1).join('/'))
  if (!folder || segments.length === 0) return undefined
  return folder.getFileHandle(segments[segments.length - 1]).catch((cause: unknown) => {
    if (isAbsent(cause)) return undefined
    throw cause
  })
}

/** A file's bytes by its path, or `undefined` where it is not there. */
export async function bytesAt(root: DirectoryHandleLike, path: string): Promise<Uint8Array | undefined> {
  const handle = await fileAt(root, path)
  if (!handle) return undefined
  const file = await handle.getFile().catch((cause: unknown) => {
    if (isAbsent(cause)) return undefined
    throw cause
  })
  return file ? new Uint8Array(await file.arrayBuffer()) : undefined
}

/** A file's text by its path, or `undefined` where it is not there. */
export async function textAt(root: DirectoryHandleLike, path: string): Promise<string | undefined> {
  const bytes = await bytesAt(root, path)
  return bytes === undefined ? undefined : new TextDecoder().decode(bytes)
}

/** A file written whole at a path, the folders on the way made. */
export async function writeAt(root: DirectoryHandleLike, path: string, data: string | Uint8Array): Promise<void> {
  const segments = segmentsOf(path)
  const folder = await folderAt(root, segments.slice(0, -1).join('/'), true)
  const handle = await folder!.getFileHandle(segments[segments.length - 1], { create: true })
  const writable = await handle.createWritable()
  try {
    await writable.write(data)
  } finally {
    await writable.close()
  }
}

/** A file or a folder removed by its path; one that is not there is not an error. */
export async function removeAt(root: DirectoryHandleLike, path: string, recursive = false): Promise<void> {
  const segments = segmentsOf(path)
  const folder = await folderAt(root, segments.slice(0, -1).join('/'))
  if (!folder || segments.length === 0) return
  await folder.removeEntry(segments[segments.length - 1], { recursive }).catch((cause: unknown) => {
    if (!isAbsent(cause)) throw cause
  })
}

/** One file under a folder: its path inside it, and its handle. */
export type Listed = { path: string; handle: FileHandleLike }

/**
 * Every file under a folder, at any depth, with its path inside it — but for
 * what `skip` leaves out, by a folder's name and where it is.
 */
export async function filesUnder(
  folder: DirectoryHandleLike,
  skip: (name: string, within: string) => boolean = () => false,
  within = '',
): Promise<Listed[]> {
  const found: Listed[] = []
  for await (const entry of folder.values()) {
    const path = within ? `${within}/${entry.name}` : entry.name
    if (entry.kind === 'file') found.push({ path, handle: entry })
    else if (!skip(entry.name, within)) found.push(...await filesUnder(entry, skip, path))
  }
  return found
}
