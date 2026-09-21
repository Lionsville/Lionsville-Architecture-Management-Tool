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
 * It sits in `ports/` because it is a seam and not an adapter's private
 * business. Three things already satisfy it — a browser's own handle, the
 * desktop's over an IPC channel, and the fake the suites run on — and a build
 * composed from this one that wants the folder store over a folder of its own
 * is the fourth. Reaching it through `adapters/fileSystem/` is what that build
 * had to do while it lived there, and only `app/composition.ts` may name an
 * adapter at all, so the shape a filling has to show had nowhere to be read
 * from. `FileSystemScopeStore` re-exports all four names, so nothing that
 * already imports them moves.
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
}

export type DirectoryHandleLike = {
  kind: 'directory'
  name: string
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
  values(): AsyncIterableIterator<FileHandleLike | DirectoryHandleLike>
}
