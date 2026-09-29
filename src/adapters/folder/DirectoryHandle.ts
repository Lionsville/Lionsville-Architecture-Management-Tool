// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A folder of files, as little of one as this app ever asks for.
 *
 * The slice of the File System Access API the folder store works through, and
 * nothing beyond it. Declared here rather than taken from the DOM lib for two
 * reasons that both still hold: the ambient types are not present in every
 * TypeScript configuration this repo builds under, and naming exactly what is
 * used makes the store testable against a small in-memory double instead of a
 * browser.
 *
 * It is the folder implementation's own (ADR-0031 §2), and sits beside the
 * store that reads through it. Three things satisfy it — a browser's own
 * handle, the desktop's over an IPC channel, and the fake the suites run on —
 * and a build composed from this one that wants the folder store over a folder
 * of its own is the fourth. `FileSystemScopeStore` re-exports all four names.
 */

/** One file's contents, either way of reading them. */
export type FileLike = {
  text(): Promise<string>
  /** For the marks: a PNG has no honest text form. */
  arrayBuffer(): Promise<ArrayBuffer>
  lastModified: number
  size: number
}

export type WritableLike = {
  write(data: string | Uint8Array): Promise<void>
  close(): Promise<void>
}

export type FileHandleLike = {
  kind: 'file'
  name: string
  getFile(): Promise<FileLike>
  createWritable(): Promise<WritableLike>
  /**
   * This file renamed within its folder, over a file of that name if there is
   * one — the one step of a staged landing (ADR-0023, amendment 3) that makes
   * a written file the file. A browser's own handle has it where the browser
   * can rename a file the person chose; absent, a folder is written one file
   * at a time.
   */
  move?(name: string): Promise<void>
  /**
   * What the file is without handing its bytes over — its size, and the
   * SHA-256 of its bytes in hex where the handle works it out where the file
   * is. The desktop's main process does; a browser's `getFile()` is lazy and
   * answers the size alone. Absent, `getFile()` is asked.
   */
  stamp?(): Promise<{ size: number; sha256?: string } | undefined>
}

export type DirectoryHandleLike = {
  kind: 'directory'
  name: string
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
  values(): AsyncIterableIterator<FileHandleLike | DirectoryHandleLike>
  /**
   * Several files written and removed as one, by paths inside this folder.
   *
   * Every write is staged first — its bytes on disk under a name of its own,
   * beside where it goes — and only when all of them are there is any of them
   * moved into place; then the removals. A failure while staging leaves the
   * folder as it was. Offered where something outside the page does the work —
   * the desktop's main process — so that the page going away part way cannot
   * cut it short. A browser's own handle offers none, because the page is
   * what would do the work; the folder store then stages with the handles'
   * own `move` where they have it, and writes one file at a time where they
   * do not (ADR-0023, amendment 3).
   */
  writeTogether?(
    writes: readonly { path: string; data: string | Uint8Array }[],
    removals: readonly string[],
  ): Promise<void>
  /**
   * A file or a folder, by its path inside this one, renamed to another path
   * inside it — everything in it moved as it is, links and empty folders
   * included, and no byte read. Refused where something is at the new path.
   * Offered where something outside the page can do it — the desktop's main
   * process; absent, a folder's files are copied and the old folder removed.
   */
  moveEntry?(from: string, to: string): Promise<void>
}
