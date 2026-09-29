// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a working file says it holds, and whether what landed is that
 * (ADR-0023, amended).
 *
 * A working file is a whole organisation, and opening one is a walk that
 * writes one scope at a time into wherever it lands. Nothing used to look at
 * the result: a scope the walk did not write, a view a store did not keep, a
 * file a server refused and a caller took for absent — each finished with the
 * same *loaded* as a file that arrived whole. The manifest is the file's own
 * word about itself, written when it is made, so the landing can be read back
 * and held to it.
 *
 * **What it lists.** Every scope, by its path relative to the top of the file,
 * with its name; every file the format made of it, with its size and a
 * SHA-256 of its bytes; every view, with its kind and how much is on it; and
 * the counts a person would recognise — elements, relations, records, pictures
 * and marks. The files and their hashes are the proof: anything the format
 * writes is in one of them, so anything lost is a file missing or a file
 * changed. The views and the counts are how that proof is said to a person,
 * who knows a view by its name and not a file by its path.
 *
 * **What it may say it left out.** A file the scope was read without — one
 * that was there and would not read (ADR-0028, amended) — is not in the file,
 * and the manifest says so under `omitted` rather than pretending the scope is
 * whole. The landing repeats it.
 *
 * **A file with no manifest** — everything written before this — is held to
 * what the file itself contains: the manifest is made from the scopes it
 * opened to, and a scope in it that would not open is named as missing.
 *
 * Pure apart from the hash, which is the platform's (`crypto.subtle`), the way
 * the seal is.
 */
import { bytesFromText, parseJson, stableJson } from '../../../projects/text'
import { scopeFiles } from './folderFormat'
import type { FolderFile } from './folderFormat'
import type { ScopeSnapshot } from '../../../projects/scope'
import type { ScopePath } from '../../../projects/scopePath'

/**
 * Where the manifest is in the zip: beside the top scope's `scope.json`.
 *
 * Not a file the format reads or writes, so a build that knows nothing about
 * it opens the file exactly as before, and a folder somebody unzipped by hand
 * holds one file the folder store leaves alone.
 */
export const MANIFEST_FILE = 'lvarch-manifest.json'

/** The discriminator, so a person's own `lvarch-manifest.json` in a hand-made zip is not taken for ours. */
export const MANIFEST_TYPE = 'lionsville-architecture-manifest'

export type ManifestFile = { path: string; bytes: number; sha256: string }

export type ManifestView = { id: string; name: string; kind: string; members: number; lines: number }

export type ManifestCounts = {
  elements: number
  relations: number
  views: number
  decisions: number
  plans: number
  observations: number
  causes: number
  solutions: number
  experiments: number
  pictures: number
  marks: number
}

export type ManifestScope = {
  /** Relative to the top of the file, as the zip files it: `''` is the top. */
  path: ScopePath
  name: string
  files: ManifestFile[]
  views: ManifestView[]
  counts: ManifestCounts
}

export type WorkingFileManifest = {
  type: typeof MANIFEST_TYPE
  version: 1
  scopes: ManifestScope[]
  /** What the scopes were read without, per scope, where anything was: the file does not hold these. */
  omitted?: { path: ScopePath; files: string[] }[]
}

/** Where `path` is inside the file whose top scope sits at `top`. */
export function relativeTo(top: ScopePath, path: ScopePath): ScopePath {
  if (path === top) return ''
  const under = top ? `${top}/` : ''
  return path.startsWith(under) ? path.slice(under.length) : path
}

/**
 * The manifest of these scopes, the first of them the top — the same list, in
 * the same order, `workingFileBytes` is handed.
 */
export async function manifestOf(
  scopes: readonly ScopeSnapshot[], top: ScopePath = scopes.length ? scopes[0].path : '',
): Promise<WorkingFileManifest> {
  const listed = await Promise.all(scopes.map((scope) => manifestScope(scope, relativeTo(top, scope.path))))
  const omitted = scopes
    .filter((scope) => scope.unread?.length)
    .map((scope) => ({ path: relativeTo(top, scope.path), files: [...(scope.unread ?? [])] }))
  return {
    type: MANIFEST_TYPE,
    version: 1,
    scopes: listed,
    ...(omitted.length ? { omitted } : {}),
  }
}

async function manifestScope(scope: ScopeSnapshot, path: ScopePath): Promise<ManifestScope> {
  const files = scopeFiles(scope)
  const model = scope.model
  return {
    path,
    name: model.name,
    files: await Promise.all(files.map(manifestFile)),
    views: model.diagrams.map((view) => ({
      id: view.id,
      name: view.name,
      kind: view.kind,
      members: view.members.length,
      lines: view.lines?.length ?? 0,
    })),
    counts: {
      elements: model.elements.length,
      relations: model.relations.length,
      views: model.diagrams.length,
      decisions: model.decisions?.length ?? 0,
      plans: model.transitions?.length ?? 0,
      observations: model.observations?.length ?? 0,
      causes: model.causes?.length ?? 0,
      solutions: model.solutions?.length ?? 0,
      experiments: model.experiments?.length ?? 0,
      pictures: scope.imageLibrary?.length ?? 0,
      marks: scope.logoLibrary.length,
    },
  }
}

async function manifestFile(file: FolderFile): Promise<ManifestFile> {
  const bytes = 'text' in file ? bytesFromText(file.text) : file.bytes
  return { path: file.path, bytes: bytes.length, sha256: await sha256(bytes) }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** The manifest as the file holds it. */
export function manifestText(manifest: WorkingFileManifest): string {
  return stableJson(manifest)
}

/**
 * The manifest a file carries, or `undefined` for one written before there
 * was one — or one that does not read as ours, which is the same answer: the
 * landing is then held to what the file contains.
 */
export function readManifest(text: string): WorkingFileManifest | undefined {
  const held = parseJson(text) as Partial<WorkingFileManifest> | undefined
  if (!held || typeof held !== 'object' || held.type !== MANIFEST_TYPE || held.version !== 1) return undefined
  if (!Array.isArray(held.scopes)) return undefined
  const scopes = held.scopes.filter((scope): scope is ManifestScope => Boolean(scope)
    && typeof scope.path === 'string' && typeof scope.name === 'string'
    && Array.isArray(scope.files) && Array.isArray(scope.views))
  if (scopes.length !== held.scopes.length) return undefined
  return {
    type: MANIFEST_TYPE,
    version: 1,
    scopes,
    ...(Array.isArray(held.omitted) ? { omitted: held.omitted } : {}),
  }
}

/** What did not arrive, per scope — each list empty where nothing is wrong. */
export type ManifestScopeDifference = {
  path: ScopePath
  name: string
  /** The whole scope is not there. */
  absent: boolean
  views: ManifestView[]
  missingFiles: string[]
  changedFiles: string[]
}

export type ManifestDifference = {
  scopes: ManifestScopeDifference[]
  /** What the file itself said it was made without. */
  omitted: { path: ScopePath; files: string[] }[]
}

/**
 * Held against the manifest: the scopes as they landed, keyed by the same
 * relative path. `undefined` where every scope, every view and every file
 * arrived byte for byte and the file left nothing out.
 *
 * A landing may hold more than the file — a scope that was already there, a
 * file of a person's own beside a scope — and that is not a difference: the
 * question is whether what the file holds arrived, not whether nothing else
 * is there.
 */
export function compareManifests(
  expected: WorkingFileManifest, landed: WorkingFileManifest,
): ManifestDifference | undefined {
  const byPath = new Map(landed.scopes.map((scope) => [scope.path, scope]))
  const scopes: ManifestScopeDifference[] = []
  for (const want of expected.scopes) {
    const have = byPath.get(want.path)
    if (!have) {
      scopes.push({
        path: want.path, name: want.name, absent: true, views: want.views,
        missingFiles: want.files.map((file) => file.path), changedFiles: [],
      })
      continue
    }
    const files = new Map(have.files.map((file) => [file.path, file]))
    const missingFiles = want.files.filter((file) => !files.has(file.path)).map((file) => file.path)
    const changedFiles = want.files
      .filter((file) => {
        const got = files.get(file.path)
        return got !== undefined && (got.sha256 !== file.sha256 || got.bytes !== file.bytes)
      })
      .map((file) => file.path)
    const views = want.views.filter((view) => !have.views.some((got) => got.id === view.id))
    if (missingFiles.length || changedFiles.length || views.length) {
      scopes.push({ path: want.path, name: want.name, absent: false, views, missingFiles, changedFiles })
    }
  }
  const omitted = expected.omitted ?? []
  return scopes.length || omitted.length ? { scopes, omitted } : undefined
}

/** Every file a manifest lists, and every view: what a complete landing says it checked. */
export function manifestTotals(manifest: WorkingFileManifest): { scopes: number; views: number; files: number } {
  return {
    scopes: manifest.scopes.length,
    views: manifest.scopes.reduce((sum, scope) => sum + scope.views.length, 0),
    files: manifest.scopes.reduce((sum, scope) => sum + scope.files.length, 0),
  }
}
