/**
 * A scope as one file: version 5, and everything before it.
 *
 * The folder is the working copy; this is the **container** — what you hand to
 * somebody, mail, attach to a ticket, or open on a machine that has never seen
 * your working directory. ADR-0003 kept it for exactly that, and the header
 * comment in `model/hostModel.ts` reserved the shape when it refused to promise
 * JSON in the `.lvarch` extension: version 5 is a scope's folder, zipped, and
 * every version before it was the same folder one format earlier.
 *
 * It is the folder and not a new format on purpose. There is one writer, one
 * reader, one set of rules about what a file is called and what goes in it, and
 * an export that can be unzipped and read by a person with no tool at all. The
 * export is even reproducible — the entries carry a fixed timestamp — so two
 * exports of the same project are the same file and can be compared as one.
 *
 * Every older version keeps opening, and lands on format 5 through the folds
 * (`migrate3to4.ts`, `migrate4to5.ts`): a version-3 or -4 zip is a folder the
 * migration reads, and versions 1 and 2 are a single JSON document
 * `openScopeDocument` has read since there was one.
 *
 * **One scope, not a subtree.** A `.lvarch` is the scope's own folder: the
 * scopes filed under it are not in it, and a zip somebody hands over with them
 * inside opens as the scope at the top. Exporting a subtree is a gesture of its
 * own — ADR-0012 leaves it open, because a domain exported alone carries
 * stand-ins whose definitions are not in the zip, and what to do about those is
 * the question rather than the zipping.
 */
import { unzipSync, zipSync } from 'fflate'
import { slug } from '../model/keys'
import { WORKING_FILE_EXTENSION } from '../model/hostModel'
import { bytesFromText, parseJson, textFromBytes } from './fileText'
import { SCOPE_FILE, scopeFiles } from './folderFormat'
import { migrateSnapshot } from './migrate3to4'
import { openScopeFolder } from './migrate4to5'
import type { FolderFile } from './folderFormat'
import { openScopeDocument } from './scope'
import { joinScopePath } from './scopePath'
import type { OpenResult, ScopeSnapshot } from './scope'

export { WORKING_FILE_EXTENSION }

/** What a `.lvarch` is, now that it is a zip and not a JSON document. */
export const WORKING_FILE_MEDIA_TYPE = 'application/zip'

/**
 * The whole point of a fixed timestamp: an export is reproducible.
 *
 * Zip entries carry an mtime, and `Date.now()` in it would mean two exports of
 * an unchanged project differ in every entry header — no comparing two files,
 * no committing one, no checksum that means anything. 1980-01-01 is the epoch
 * the zip format itself starts at.
 */
const FIXED_MTIME = new Date(Date.UTC(1980, 0, 1))

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b
    && bytes[2] === 0x03 && bytes[3] === 0x04
}

/**
 * The working set as one file: the folder, zipped, entries in path order.
 *
 * Every scope handed over, each under its path **relative to the first one** —
 * which is where it already sits on disk, because a scope IS a folder and the
 * ones filed under it are inside it (ADR-0012 §1). So this is not a second
 * layout that has to be kept in step with the store's; it is the store's, with
 * a zip around it.
 *
 * Relative, and not the address it has in this working directory. A file is
 * something you hand to somebody else, and where the scope at its top was filed
 * in your tree is none of their business — the same reason `toWorkingFile`
 * never wrote the path. It also means the one-scope case is unchanged: a file
 * written from a single scope has `scope.json` at the top of the zip, exactly
 * as every `.lvarch` before format 6 did.
 *
 * The caller decides what goes in. Nothing here walks a tree or reads a store:
 * hand it one scope and the file holds one, hand it the whole organisation and
 * the file holds the organisation.
 */
export function workingFileBytes(scopes: readonly ScopeSnapshot[]): Uint8Array {
  const entries: Record<string, [Uint8Array, { mtime: Date }]> = {}
  const top = scopes.length ? scopes[0].path : ''
  const under = top ? `${top}/` : ''
  for (const scope of scopes) {
    const relative = scope.path === top ? ''
      : scope.path.startsWith(under) ? scope.path.slice(under.length) : scope.path
    const prefix = relative ? `${relative}/` : ''
    for (const file of scopeFiles(scope)) {
      entries[`${prefix}${file.path}`] = [
        'text' in file ? bytesFromText(file.text) : file.bytes,
        { mtime: FIXED_MTIME },
      ]
    }
  }
  return zipSync(entries)
}

/**
 * What to call the file.
 *
 * The scope at the top names it — its own name, slugged — and not its path.
 * The path was what named it until ADR-0018, and the organisation's path is the
 * empty string (`ROOT_SCOPE`), so exporting from the top produced a file called
 * `.lvarch`: a hidden file with no name, which macOS's save panel writes
 * somewhere the person never finds. A name is a thing every scope has.
 */
export function workingFileName(top: ScopeSnapshot): string {
  return `${slug(top.model.name)}${WORKING_FILE_EXTENSION}`
}

/**
 * Where the scopes are in a folder full of files: every directory that holds a
 * `scope.json`, nearest the top first.
 *
 * A scope's own subfolders are a closed list and a child scope may not be named
 * after one of them (`RESERVED_SCOPE_NAMES`), so a `scope.json` anywhere below
 * the top is a scope filed there and never a file of the scope above it. That
 * rule is what makes this a directory scan rather than a walk that has to know
 * the format.
 */
function scopeRootsIn(files: readonly FolderFile[]): string[] {
  const roots = files
    .filter((file) => file.path === SCOPE_FILE || file.path.endsWith(`/${SCOPE_FILE}`))
    .map((file) => file.path.slice(0, Math.max(file.path.length - SCOPE_FILE.length - 1, 0)))
  // Shallowest first, so a caller opening a tree meets the organisation before
  // anything filed under it.
  return [...new Set(roots)].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
}

/** One scope's own files, with its prefix taken off and its children left out. */
function filesOfScope(files: readonly FolderFile[], root: string, roots: readonly string[]): FolderFile[] {
  const prefix = root ? `${root}/` : ''
  const deeper = roots.filter((other) => other !== root && other.startsWith(prefix))
  return files
    .filter((file) => file.path.startsWith(prefix))
    .filter((file) => !deeper.some((child) => file.path.startsWith(`${child}/`)))
    .map((file) => ('text' in file
      ? { path: file.path.slice(prefix.length), text: file.text }
      : { path: file.path.slice(prefix.length), bytes: file.bytes }))
}

/** Text unless the extension says otherwise — the same rule the folder store uses. */
function fileFrom(path: string, bytes: Uint8Array): FolderFile {
  return path.endsWith('.png') ? { path, bytes } : { path, text: textFromBytes(bytes) }
}

/**
 * The folder inside a zipped file.
 *
 * A zip made by a person rather than by this tool usually has one folder at the
 * top — that is what "zip this folder" does in every file manager — so a single
 * common prefix is stripped. Anything else is read as it is.
 */
function folderIn(bytes: Uint8Array): FolderFile[] | undefined {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(bytes)
  } catch {
    return undefined
  }
  const paths = Object.keys(entries).filter((path) => !path.endsWith('/'))
  if (paths.length === 0) return undefined

  const first = paths[0].split('/')[0]
  const wrapped = paths.every((path) => path.startsWith(`${first}/`))
  return paths.map((path) => fileFrom(wrapped ? path.slice(first.length + 1) : path, entries[path]))
}

/**
 * A file the user chose, landed into the project they had open.
 *
 * One door for all of it: a zip of whatever version, and a version-1 or -2 JSON
 * document. Which one it is, is a question about the bytes and not about the
 * extension — a file that was renamed is still what it is.
 *
 * `into` is the scope being replaced: the file supplies the content, the open
 * scope supplies where it is filed.
 */
export function openDocumentBytes(bytes: Uint8Array, into: ScopeSnapshot): OpenResult {
  if (isZip(bytes)) {
    const files = folderIn(bytes)
    if (!files) return { ok: false, messageKey: 'shell.unknownFile' }
    const roots = scopeRootsIn(files)
    // No `scope.json` anywhere: an older zip, which is one scope and has no
    // header to find. `openScopeFolder` is the reader that folds it forward.
    const tops = roots.length ? roots : ['']
    const top = tops[0]
    const scope = openScopeFolder(filesOfScope(files, top, tops), into.path)
    if (!scope) return { ok: false, messageKey: 'shell.unknownFile' }
    if (!scope.model.diagrams.length) return { ok: false, messageKey: 'shell.workingFileNoDiagrams' }
    // Filed where the file says, relative to where the top one landed: a
    // `retail` inside the file opened into `acme` is `acme/retail`.
    const under = top ? `${top}/` : ''
    const rest = tops.slice(1).flatMap((root) => {
      const held = openScopeFolder(filesOfScope(files, root, tops), joinScopePath(into.path, root.slice(under.length)))
      return held ? [held] : []
    })
    return { ok: true, kind: 'workingFile', relayout: false, scope, ...(rest.length ? { rest } : {}) }
  }
  const opened = openScopeDocument(parseJson(textFromBytes(bytes)), into)
  // A version-1 or -2 document holds the model as it was said before ADR-0012:
  // one list of connections, and a view's membership in the same row as its
  // coordinates. It opens, through the same fold a format-3 folder goes
  // through, and is format 5 the moment it is saved.
  return opened.ok && opened.kind === 'workingFile'
    ? { ...opened, scope: migrateSnapshot(opened.scope) }
    : opened
}
