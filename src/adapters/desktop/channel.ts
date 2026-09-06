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
 *
 * The menu and the documents the OS opens us with are the other half of this
 * doorway; their vocabulary is `platform/hostCommands.ts`, because the shell
 * has to understand it too.
 */
import type { HostCommands } from '../../platform/hostCommands'

export type DesktopCommands = HostCommands

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

/**
 * One path under a watched folder that changed. No stamp means it is gone.
 *
 * Main cannot tell whose write it was — it sees a filesystem event and nothing
 * else — so every change is reported and the renderer, which knows what it last
 * wrote, decides whether it is news.
 */
export type DesktopChange = {
  root: string
  path: string
  stamp?: DesktopStamp
}

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
  /**
   * Hand a document to the user: a real save dialog, and a file where they
   * said. Answers `false` when they cancelled, which is not a failure.
   *
   * Outside every granted folder on purpose — the dialog IS the grant, for
   * that one file, once, and nothing about the place it went is remembered.
   */
  saveDocument(name: string, bytes: Uint8Array, mediaType: string): Promise<boolean>
  /**
   * Start reporting changes under this folder. Watching one twice is fine and
   * watches it once.
   */
  watch(root: string): Promise<void>
  unwatch(root: string): Promise<void>
  /**
   * Every change to every watched folder, until the returned function is
   * called.
   *
   * One stream rather than one per folder: there is one window, and the
   * listener filters by root. Unsubscribing has to be possible — a workspace
   * that is remounted per project would otherwise pile up listeners for
   * projects nobody has open.
   */
  onChanged(listener: (change: DesktopChange) => void): () => void
}
