/**
 * A folder on the desktop, shaped like a folder in a browser.
 *
 * `FileSystemProjectStore` was written against `DirectoryHandleLike` — the
 * handful of File System Access methods it actually uses — precisely so that
 * the desktop would not need a second store. This is the other implementation
 * of that shape: the same walking, reading and writing, over the IPC channel in
 * `electron/main/files.ts` instead of over a browser's handle.
 *
 * So the store, the folder format, the contract suite and every test above them
 * are untouched by the desktop existing. What is different here is only what
 * has to be: a path is a string this side of the boundary rather than a chain
 * of handles, and the checking of it happens in main, where the folder the user
 * chose is actually known.
 *
 * One deliberate difference from the browser's API. `getFileHandle(name, {
 * create: true })` does not create the file: it hands back a handle that will
 * write one when it is closed. Creating an empty file on the way past would
 * mean a save that fails halfway leaves empty files behind, which is the
 * failure the atomic write in main exists to prevent.
 */
import type {
  DirectoryHandleLike, FileHandleLike, FileLike, WritableLike,
} from '../fileSystem/FileSystemProjectStore'
import type { DesktopFiles } from './channel'

function missing(what: string, name: string): Error {
  // The browser throws `NotFoundError`; the store reads the failure and not the
  // message, but a person reading a stack trace should see the same word.
  return new Error(`NotFoundError: no ${what} ${name}`)
}

function fileHandle(
  files: DesktopFiles, root: string, path: string, name: string,
): FileHandleLike {
  return {
    kind: 'file',
    name,
    async getFile(): Promise<FileLike> {
      const held = await files.read(root, path)
      if (!held) throw missing('file', name)
      return {
        lastModified: held.mtimeMs,
        size: held.size,
        text: async () => new TextDecoder().decode(held.bytes),
        arrayBuffer: async () => held.bytes.buffer.slice(
          held.bytes.byteOffset, held.bytes.byteOffset + held.bytes.byteLength,
        ) as ArrayBuffer,
      }
    },
    async createWritable(): Promise<WritableLike> {
      const chunks: Uint8Array[] = []
      return {
        async write(data: string | Uint8Array) {
          chunks.push(typeof data === 'string' ? new TextEncoder().encode(data) : data)
        },
        // One write for the whole file, at the end. That is what makes it
        // atomic in main: a temporary file, flushed, renamed over the target.
        async close() { await files.write(root, path, join(chunks)) },
      }
    },
  }
}

function join(chunks: readonly Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0]
  const joined = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0))
  let at = 0
  for (const chunk of chunks) {
    joined.set(chunk, at)
    at += chunk.length
  }
  return joined
}

export class IpcDirectoryHandle implements DirectoryHandleLike {
  readonly kind = 'directory' as const

  /**
   * `root` is the folder the user chose and never changes; `path` is where this
   * handle sits inside it. Both are strings main will check again.
   */
  constructor(
    private readonly files: DesktopFiles,
    private readonly root: string,
    readonly name: string,
    private readonly path = '',
  ) {}

  private within(name: string): string {
    return this.path ? `${this.path}/${name}` : name
  }

  async getDirectoryHandle(
    name: string, options?: { create?: boolean },
  ): Promise<DirectoryHandleLike> {
    const path = this.within(name)
    if (options?.create) await this.files.makeDirectory(this.root, path)
    else if (!await this.files.list(this.root, path)) throw missing('directory', name)
    return new IpcDirectoryHandle(this.files, this.root, name, path)
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike> {
    const path = this.within(name)
    if (!options?.create && !await this.files.read(this.root, path)) throw missing('file', name)
    return fileHandle(this.files, this.root, path, name)
  }

  async removeEntry(name: string, options?: { recursive?: boolean }): Promise<void> {
    await this.files.remove(this.root, this.within(name), options)
  }

  async *values(): AsyncIterableIterator<FileHandleLike | DirectoryHandleLike> {
    // A folder that has gone away — unplugged, deleted, permission withdrawn —
    // reads as empty rather than throwing, and the store turns that into an
    // empty picker instead of a broken one.
    for (const entry of await this.files.list(this.root, this.path) ?? []) {
      yield entry.kind === 'directory'
        ? new IpcDirectoryHandle(this.files, this.root, entry.name, this.within(entry.name))
        : fileHandle(this.files, this.root, this.within(entry.name), entry.name)
    }
  }
}
