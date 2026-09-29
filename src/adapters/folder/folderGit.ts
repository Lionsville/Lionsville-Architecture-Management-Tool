// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The folder's history, as the few things it asks of git (ADR-0031 §2).
 *
 * The folder keeps its history in git: an entry is a commit, a thing's history
 * is the commits that changed the files it is kept in, and a label is a tag.
 * This is as much of git as the history repository over a folder needs, said
 * as a seam so the same repository runs over the machine's own git
 * (`platform/node/git.ts`, and the desktop's channel to it) and over one kept
 * in memory for the suites (`memoryGit.ts`).
 *
 * **Which scope a commit is.** A folder's commits are made by this
 * implementation, by an older build, and by a person in a terminal. Those this
 * implementation makes say which scopes they record, by identity and address,
 * in a trailer each ({@link scopeTrailer}), and are those scopes' entries and
 * nobody else's — which is how a history follows a scope through a move, and
 * how a scope made where a removed one was starts with none. A commit without
 * one is an entry of each scope whose own files it changed, where they are.
 */
import { SCOPE_FILE, SCOPE_FOLDERS } from '../../projects/folderFormat'
import { SETTINGS_FOLDER, LOCAL_SETTINGS_PATH } from '../../projects/folderSettings'
import { ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopeAddress, ScopeId } from '../../projects/scopeState'

/** One commit, as the history reads it. */
export type FolderCommit = {
  sha: string
  /** Epoch milliseconds. */
  at: number
  author: string
  /** The first line of the message. */
  subject: string
  /** The whole message, trailers included. */
  message: string
  /** Every path it changed, from the folder's root. */
  changed: readonly string[]
}

/** A file as it was at a commit: text, or bytes for a picture that is not an SVG. */
export type CommittedFile = { path: string; text: string } | { path: string; bytes: Uint8Array }

/** One tag, by name, on the commit it marks, with the words it carries. */
export type FolderTag = { name: string; sha: string; message: string }

/** A path whose contents differ from the last commit, and whether it is gone. */
export type FolderChange = { path: string; deleted: boolean }

/** Which commits: those that changed one of `paths` (every one without), whose message holds `grep`, from `from` back. */
export type CommitsWanted = {
  paths?: readonly string[]
  grep?: string
  limit: number
  /** The commit to start at, itself included; the newest without. */
  from?: string
}

export interface FolderGit {
  /** Whether the folder keeps a history of its own. */
  keeping(): Promise<boolean>
  /** Keep one where there is none, as a first snapshot always has. */
  start(): Promise<void>
  /** Everything that differs from the last commit, files nobody has committed included. */
  changes(): Promise<FolderChange[]>
  /** Those paths as they are now, and no others, as one commit; `undefined` where none of them changed. */
  commit(paths: readonly string[], message: string): Promise<string | undefined>
  /** Commits, newest first. */
  log(wanted: CommitsWanted): Promise<FolderCommit[]>
  /** Every file under `within` at a commit, from the root. */
  treeAt(sha: string, within: string): Promise<string[]>
  /** Those files as they were at a commit; one that is not there is left out. */
  readAt(sha: string, paths: readonly string[]): Promise<CommittedFile[]>
  tags(): Promise<FolderTag[]>
  /** An annotated tag on a commit, never over one that is there. */
  tag(sha: string, name: string, message: string): Promise<'done' | 'exists'>
}

/** The trailer a commit of this implementation says one scope with. English: it is a git message. */
export const SCOPE_TRAILER = 'Lionsville-Scope'

/** How the organisation's address is written in a trailer, where the empty string would vanish. */
const ROOT_IN_TRAILER = '.'

/** The trailer for one scope a commit records. */
export function scopeTrailer(id: ScopeId, address: ScopeAddress): string {
  return `${SCOPE_TRAILER}: ${id} ${address === ROOT_SCOPE ? ROOT_IN_TRAILER : address}`
}

/**
 * The scopes a commit says it records, by identity, with the address each
 * had; empty for a commit that says none. Read from the trailer block alone —
 * the message's last paragraph, every line of it a trailer — so a line in a
 * subject or a body that looks like one is not one.
 */
export function trailersOf(message: string): Map<ScopeId, ScopeAddress> {
  const found = new Map<ScopeId, ScopeAddress>()
  const paragraphs = message.replace(/\s+$/, '').split(/\n[ \t]*\n/)
  if (paragraphs.length < 2) return found
  const block = paragraphs[paragraphs.length - 1].split('\n')
  if (!block.every((line) => /^[A-Za-z0-9-]+: \S/.test(line))) return found
  const pattern = new RegExp(`^${SCOPE_TRAILER}: (\\S+) (\\S+)$`)
  for (const line of block) {
    const [, id, address] = pattern.exec(line) ?? []
    if (id) found.set(id, address === ROOT_IN_TRAILER ? ROOT_SCOPE : address)
  }
  return found
}

/** A record's subject as a commit's first line: one line, however it was typed. */
export function subjectLine(subject: string): string {
  return subject.replace(/\s+/g, ' ').trim()
}

/** A path inside an address's folder, relative to it; `undefined` for one outside it. */
export function within(address: ScopeAddress, path: string): string | undefined {
  if (address === ROOT_SCOPE) return path
  return path.startsWith(`${address}/`) ? path.slice(address.length + 1) : undefined
}

/**
 * The scope a path is the own file of: the deepest of `addresses` whose
 * folder holds it. A scope's own files are everything in its folder but the
 * scopes filed under it — its format's files, its pictures, its settings and
 * whatever a person keeps beside them. The machine's settings file an older
 * build left at the root is nobody's: it never travels.
 */
export function ownerOf(path: string, addresses: Iterable<ScopeAddress>): ScopeAddress | undefined {
  if (path === LOCAL_SETTINGS_PATH) return undefined
  let found: ScopeAddress | undefined
  for (const address of addresses) {
    if (within(address, path) === undefined) continue
    if (found === undefined || address.length > found.length) found = address
  }
  return found
}

/**
 * The files of one scope at a commit, relative to its folder: those under it
 * that no scope filed inside it holds — a folder with a header of its own at
 * that commit is a scope, and its files are its own.
 */
export function ownFilesAt(address: ScopeAddress, tree: readonly string[]): string[] {
  const relative = tree.flatMap((path) => {
    const inside = within(address, path)
    return inside === undefined ? [] : [inside]
  })
  const nested = relative
    .filter((path) => path.endsWith(`/${SCOPE_FILE}`))
    .map((path) => path.slice(0, -SCOPE_FILE.length))
    .filter((prefix) => !SCOPE_FOLDERS.includes(prefix.split('/')[0]) && !prefix.startsWith('.'))
  return relative.filter((path) => !nested.some((prefix) => path.startsWith(prefix)))
}

/** The folder a scope keeps its settings in: the one the organisation's settings have always been in. */
export const SCOPE_SETTINGS_FOLDER = SETTINGS_FOLDER
