/**
 * An in-memory stand-in for a directory the user picked.
 *
 * The File System Access API cannot run in the test environment, and a store
 * that could only be checked by clicking through a browser would be a store
 * nobody dares change. So the adapter names the handful of methods it uses
 * (`DirectoryHandleLike` and friends), and this implements them — held to the
 * same shape by the compiler, so a double that has drifted from the real API's
 * surface is a type error rather than a green test.
 *
 * It is deliberately literal about the things that trip stores up: folders have
 * to be created before they can be entered, entering a missing folder throws
 * exactly as the browser's does, and a writable is a two-step affair whose
 * contents only land on `close()`. A double that quietly created missing folders
 * would hide the very bug it exists to catch.
 *
 * Not a test file itself — the contract suite and any future test can use it.
 */
import type {
  DirectoryHandleLike, FileHandleLike, FileLike, WritableLike,
} from './FileSystemProjectStore'

type StoredFile = { contents: string; lastModified: number }

/** A clock that always moves, so two saves never share an mtime. */
let tick = 1_700_000_000_000

export class FakeDirectory implements DirectoryHandleLike {
  readonly kind = 'directory' as const

  private readonly files = new Map<string, StoredFile>()
  private readonly folders = new Map<string, FakeDirectory>()

  constructor(readonly name = '') {}

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike> {
    const existing = this.folders.get(name)
    if (existing) return existing
    if (!options?.create) {
      // The browser throws NotFoundError here; a double that returned an empty
      // folder instead would turn "this group does not exist" into "this group
      // is empty", which is a different answer.
      throw new Error(`NotFoundError: no directory ${name}`)
    }
    const created = new FakeDirectory(name)
    this.folders.set(name, created)
    return created
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike> {
    if (!this.files.has(name)) {
      if (!options?.create) throw new Error(`NotFoundError: no file ${name}`)
      this.files.set(name, { contents: '', lastModified: (tick += 1) })
    }
    return this.handleFor(name)
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.files.delete(name) && !this.folders.delete(name)) {
      throw new Error(`NotFoundError: no entry ${name}`)
    }
  }

  async *values(): AsyncIterableIterator<FileHandleLike | DirectoryHandleLike> {
    for (const folder of this.folders.values()) yield folder
    for (const name of [...this.files.keys()]) yield this.handleFor(name)
  }

  private handleFor(name: string): FileHandleLike {
    const files = this.files
    return {
      kind: 'file',
      name,
      async getFile(): Promise<FileLike> {
        const stored = files.get(name)
        if (!stored) throw new Error(`NotFoundError: no file ${name}`)
        return {
          lastModified: stored.lastModified,
          size: stored.contents.length,
          text: async () => stored.contents,
        }
      },
      async createWritable(): Promise<WritableLike> {
        // Buffered until close, like the real one: a reader that arrives
        // mid-write sees the previous contents rather than half of the new.
        let buffer = ''
        return {
          async write(data: string) { buffer += data },
          async close() { files.set(name, { contents: buffer, lastModified: (tick += 1) }) },
        }
      },
    }
  }

  /** Put a file there without going through the store, for the awkward cases. */
  writeRaw(name: string, contents: string): void {
    this.files.set(name, { contents, lastModified: (tick += 1) })
  }
}
