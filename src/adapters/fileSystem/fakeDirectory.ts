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
 * exactly as the browser's does, removing a folder with something in it needs
 * `recursive`, and a writable is a two-step affair whose contents only land on
 * `close()`. A double that quietly created missing folders would hide the very
 * bug it exists to catch.
 *
 * Not a test file itself — the contract suite and any future test can use it.
 */
import type {
  DirectoryHandleLike, FileHandleLike, FileLike, WritableLike,
} from './FileSystemProjectStore'

type StoredFile = { contents: string | Uint8Array; lastModified: number }

/** A clock that always moves, so two saves never share an mtime. */
let tick = 1_700_000_000_000

function bytesOf(contents: string | Uint8Array): Uint8Array {
  return typeof contents === 'string' ? new TextEncoder().encode(contents) : contents
}

function textOf(contents: string | Uint8Array): string {
  return typeof contents === 'string' ? contents : new TextDecoder().decode(contents)
}

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

  async removeEntry(name: string, options?: { recursive?: boolean }): Promise<void> {
    if (this.files.delete(name)) return
    const folder = this.folders.get(name)
    if (!folder) throw new Error(`NotFoundError: no entry ${name}`)
    if (!options?.recursive && !folder.isEmpty()) {
      throw new Error(`InvalidModificationError: ${name} is not empty`)
    }
    this.folders.delete(name)
  }

  async *values(): AsyncIterableIterator<FileHandleLike | DirectoryHandleLike> {
    for (const folder of this.folders.values()) yield folder
    for (const name of [...this.files.keys()]) yield this.handleFor(name)
  }

  private isEmpty(): boolean {
    return this.files.size === 0 && this.folders.size === 0
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
          size: bytesOf(stored.contents).length,
          text: async () => textOf(stored.contents),
          arrayBuffer: async () => {
            const bytes = bytesOf(stored.contents)
            return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
          },
        }
      },
      async createWritable(): Promise<WritableLike> {
        // Buffered until close, like the real one: a reader that arrives
        // mid-write sees the previous contents rather than half of the new.
        const chunks: (string | Uint8Array)[] = []
        return {
          async write(data: string | Uint8Array) { chunks.push(data) },
          async close() {
            const contents = chunks.every((chunk) => typeof chunk === 'string')
              ? chunks.join('')
              : joinBytes(chunks)
            files.set(name, { contents, lastModified: (tick += 1) })
          },
        }
      },
    }
  }

  /** Put a file there without going through the store, for the awkward cases. */
  writeRaw(name: string, contents: string | Uint8Array): void {
    this.files.set(name, { contents, lastModified: (tick += 1) })
  }

  /** Every path under here, for a test that wants to see the whole folder. */
  paths(within = ''): string[] {
    const found: string[] = []
    for (const name of this.files.keys()) found.push(within ? `${within}/${name}` : name)
    for (const [name, folder] of this.folders) {
      found.push(...folder.paths(within ? `${within}/${name}` : name))
    }
    return found.sort()
  }
}

function joinBytes(chunks: readonly (string | Uint8Array)[]): Uint8Array {
  const parts = chunks.map(bytesOf)
  const joined = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let at = 0
  for (const part of parts) {
    joined.set(part, at)
    at += part.length
  }
  return joined
}
