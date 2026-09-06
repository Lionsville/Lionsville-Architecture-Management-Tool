/**
 * The file channel, as a type: what the renderer may ask the main process to do
 * with the folder the user chose.
 *
 * Written down once and imported by both ends — the preload that exposes it and
 * the adapter that calls it — because the two agreeing is the whole point of a
 * channel. Types only, and no DOM in them, so the Electron bundle can compile
 * against this file as happily as the renderer does.
 *
 * **Everything here crosses a security boundary.** The renderer is where a
 * document from somebody else is opened, so main treats every argument as
 * hostile: a `root` must be one the user actually chose, and a `path` is
 * resolved inside it or refused. That checking is in `electron/main/fileStore.ts`
 * and is not repeated on this side — a check the caller can skip is not a check.
 *
 * Bytes rather than text, deliberately. A PNG has no text form, an encoding
 * argument is a decision this channel should not be making, and the renderer
 * already knows which of its files are text.
 */

/** A folder the user has given this app access to. */
export type DesktopDirectory = {
  /** The absolute path. Opaque to the renderer: it hands it back, nothing more. */
  root: string
  /** The folder's own name, for a menu and a toolbar. */
  name: string
}

export type DesktopEntry = { name: string; kind: 'file' | 'directory' }

export type DesktopFileContents = { bytes: Uint8Array; mtimeMs: number; size: number }

/**
 * Enough to tell our own write from somebody else's — the four fields
 * `SaveFingerprint` asks for, minus the path it already knows.
 */
export type DesktopStamp = { mtimeMs: number; size: number; sha256: string }

export type DesktopFiles = {
  /** Ask the user for a folder. `undefined` when they cancelled. */
  chooseDirectory(): Promise<DesktopDirectory | undefined>
  /** The folders this app has been given, most recent first. */
  recentDirectories(): Promise<DesktopDirectory[]>
  /** One directory's entries, or `undefined` when there is no such directory. */
  list(root: string, path: string): Promise<DesktopEntry[] | undefined>
  /** The directory, and every directory above it. Making one that exists is fine. */
  makeDirectory(root: string, path: string): Promise<void>
  /** One file, or `undefined` when it is not there. */
  read(root: string, path: string): Promise<DesktopFileContents | undefined>
  /**
   * One file, written whole.
   *
   * Atomically: to a temporary name in the same directory, flushed, then
   * renamed over the target. A reader that arrives mid-write sees the previous
   * file, and a crash mid-write leaves the previous file — which is the
   * difference between an interrupted save and a lost project.
   */
  write(root: string, path: string, bytes: Uint8Array): Promise<DesktopStamp>
  /** A file, or a directory with `recursive`. Removing what is not there is fine. */
  remove(root: string, path: string, options?: { recursive?: boolean }): Promise<void>
  /** What is on disk right now, without reading the whole file back. */
  fingerprint(root: string, path: string): Promise<DesktopStamp | undefined>
  /** Show it to the user in their file manager. */
  revealInFolder(root: string, path: string): Promise<void>
}
