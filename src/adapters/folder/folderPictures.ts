// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's picture library in its folder (ADR-0031 §3).
 *
 * **The pictures are files, and the library is a list in the header.** Each
 * picture is `images/<file>`, as it always was, so a folder reads in any
 * markdown viewer; its entry — name, media type, size, width, height and
 * content address — is a row of `images` in `scope.json`, so a scope is read,
 * and a page laid out, without reading one picture.
 *
 * **A file nobody listed is in the library too**: one a person dropped into
 * `images/`, one an older build wrote, one a crash left behind before the
 * header named it. Its entry is made from its bytes, which are read once for
 * that, and it is listed the next time the scope is written. Its name is its
 * file's where that name passes the domain's rule, and one made from it where
 * it does not (`imageNameOfFile`); the file is never renamed.
 *
 * **What the files say wins over the rows.** A row whose file has gone —
 * removed by hand, or never written — leaves the library, and its name is
 * free again; but for a row a step added whose bytes were not put yet, which
 * says so (`pending`) and waits for them. A file replaced under a row's name —
 * another size, or other bytes where the handle can say so without handing
 * them over (the desktop's main process fingerprints a file where it is) — is
 * described afresh, under the row's name.
 *
 * **Names and files.** A row says its file where the file's name is not the
 * picture's: a file an older macOS gave back decomposed, a name made for a
 * file that did not pass, and a picture filed in an image folder whose name
 * differs only in case from one already there — `A/x.png` and `a/y.png` are
 * two names the domain allows, and on a disk that does not tell case apart
 * they would be one folder, so the second is kept in the first's folder
 * ({@link fileFor}) whatever the disk is.
 */
import { isImageFile } from '../../model/documentImage'
import { imageEntryRefusal, imageName, imageNameKey } from '../../model/imageName'
import type { ImageEntry, ImageName } from '../../model/imageName'
import { imageNameOfFile, PICTURES } from './imageLibrary'
import type { PictureFiles } from './imageLibrary'

/** A picture in a library, and the file inside the pictures folder it is kept as. */
export type KeptPicture = { entry: ImageEntry; file: string }

/**
 * A file the pictures folder holds, by its path inside it; with its size, and
 * the digest of its bytes, where the handle says them without reading it here.
 */
export type PictureFile = { file: string; size?: number; sha256?: string }

/** The key `scope.json` keeps the library under. */
export const LIBRARY_KEY = 'images'

/** One row of the library in the header: the entry, its file where that is not its name, and whether its bytes are still to come. */
type Row = ImageEntry & { file?: string; pending?: true }

/** A picture in a library, as the header keeps it: `pending` while its bytes are still to come. */
export type RowPicture = KeptPicture & { pending?: true }

/** The rows a header's library holds that describe a picture; any other is left to be found as a file. */
export function rowsOf(held: unknown): RowPicture[] {
  if (!Array.isArray(held)) return []
  return held.flatMap((row: unknown) => {
    if (!row || typeof row !== 'object') return []
    const { file, pending, ...entry } = row as Row
    if (imageEntryRefusal(entry) !== undefined) return []
    const kept = typeof file === 'string' && isImageFile(file) ? file : entry.name
    return [{ entry: { ...entry }, file: kept, ...(pending === true ? { pending } : {}) }]
  })
}

/** The library as the header keeps it; `waiting` are the files whose bytes are still to come. */
export function rowsFor(library: readonly KeptPicture[], waiting: ReadonlySet<string> = new Set()): Row[] {
  return library.map(({ entry, file }) => ({
    name: entry.name, mediaType: entry.mediaType, size: entry.size, width: entry.width, height: entry.height,
    contentAddress: entry.contentAddress,
    ...(file === entry.name ? {} : { file }),
    ...(waiting.has(file) ? { pending: true as const } : {}),
  }))
}

/** How a scope's library is read: the files there are, and a description of one of them. */
export type PictureSource = {
  files: readonly PictureFile[]
  /** The entry for a file under a name, from its bytes; `undefined` where it will not read. */
  describe(file: PictureFile, name: ImageName): Promise<ImageEntry | undefined>
}

/** Whether a file is not what its row describes, by what the handle says of it without reading it. */
function replaced(row: KeptPicture, file: PictureFile): boolean {
  if (file.sha256 !== undefined && `sha256:${file.sha256}` !== row.entry.contentAddress) return true
  return file.size !== undefined && file.size !== row.entry.size
}

/**
 * A scope's library: every row of its header whose file is there, in its
 * order — described afresh where the file is not what the row says — and the
 * rows still waiting for their bytes; then every file no row names, by file.
 */
export async function libraryOf(rows: readonly RowPicture[], source: PictureSource): Promise<KeptPicture[]> {
  const onDisk = new Map(source.files.map((file) => [imageName(file.file), file]))
  const kept = rows.filter((row) => row.pending || onDisk.has(imageName(row.file)))
  const taken = new Set(kept.map((row) => imageNameKey(row.entry.name)))
  const named = new Set<string>()
  const library: KeptPicture[] = []
  for (const row of kept) {
    const found = onDisk.get(imageName(row.file))
    if (!found) {
      library.push({ entry: row.entry, file: row.file })
      continue
    }
    named.add(imageName(row.file))
    const entry = replaced(row, found) ? await source.describe(found, row.entry.name) : row.entry
    library.push({ entry: entry ?? row.entry, file: found.file })
  }
  const unlisted = source.files.filter((file) => !named.has(imageName(file.file)))
    .sort((one, other) => (one.file < other.file ? -1 : 1))
  for (const file of unlisted) {
    const entry = await source.describe(file, imageNameOfFile(file.file, taken))
    if (entry) library.push({ entry, file: file.file })
  }
  return library
}

/** What a library says about a scope's state: each picture's name and the bytes it is. */
export function pictureStamps(library: readonly KeptPicture[]): string[] {
  return library.map(({ entry }) => `${entry.name}\u0000${entry.contentAddress}`).sort()
}

/** Documents' pictures, both ways, over a library (and, reading, the one it replaces). */
export function pictureFiles(...libraries: readonly (readonly KeptPicture[])[]): PictureFiles {
  const byFile = new Map<string, ImageName>()
  const byName = new Map<ImageName, string>()
  for (const library of [...libraries].reverse()) {
    for (const { entry, file } of library) {
      byFile.set(imageName(file), entry.name)
      byName.set(entry.name, file)
    }
  }
  return {
    nameOf: (file) => byFile.get(imageName(file)),
    fileOf: (name) => byName.get(name),
  }
}

/**
 * The file a new picture is kept as: its name, in the image folders already
 * there where one differs only in case — so two names the domain tells apart
 * never share a folder by accident of the disk, and never depend on whether
 * it tells case apart. `folders` is every image folder the library's files
 * are in, and grows with the answer.
 */
export function fileFor(name: ImageName, folders: Map<string, string>): string {
  const segments = name.split('/')
  const kept: string[] = []
  for (const segment of segments.slice(0, -1)) {
    const path = [...kept, segment].join('/')
    const key = imageNameKey(path)
    const known = folders.get(key)
    kept.push(known === undefined ? segment : known.split('/').pop()!)
    if (known === undefined) folders.set(key, path)
  }
  return [...kept, segments[segments.length - 1]].join('/')
}

/** The image folders a library's files are in, by the key a case-blind disk would know them by. */
export function foldersOf(files: readonly string[]): Map<string, string> {
  const folders = new Map<string, string>()
  for (const file of files) {
    const segments = file.split('/').slice(0, -1)
    for (let depth = 1; depth <= segments.length; depth += 1) {
      const path = segments.slice(0, depth).join('/')
      if (!folders.has(imageNameKey(path))) folders.set(imageNameKey(path), path)
    }
  }
  return folders
}

/** Where a picture's file is from the folder's root. */
export function picturePath(scopeFolder: string, file: string): string {
  return scopeFolder ? `${scopeFolder}/${PICTURES}/${file}` : `${PICTURES}/${file}`
}

/**
 * Bytes put and not yet in a library, by scope and content address.
 *
 * In memory, and nowhere in the folder: bytes put and never added to a
 * library are in no library and answer nothing by name, and a file written
 * for them would be one — a picture found in `images/` with no row is a
 * picture the library has. They are written as a file when a step adds an
 * entry with their address, and let go of with the repositories.
 */
export class PictureStaging {
  private readonly held = new Map<string, Map<string, Uint8Array>>()

  put(scope: string, contentAddress: string, bytes: Uint8Array): void {
    const kept = this.held.get(scope) ?? new Map<string, Uint8Array>()
    kept.set(contentAddress, new Uint8Array(bytes))
    this.held.set(scope, kept)
  }

  get(scope: string, contentAddress: string): Uint8Array | undefined {
    const found = this.held.get(scope)?.get(contentAddress)
    return found ? new Uint8Array(found) : undefined
  }

  /** Let go of what was put for scopes that are gone. */
  drop(scopes: Iterable<string>): void {
    for (const scope of scopes) this.held.delete(scope)
  }
}
