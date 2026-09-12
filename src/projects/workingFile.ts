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
 * (`migrate3to4.ts`, `migrate4to5.ts`): a version-3 zip is a folder the migration reads, and
 * versions 1 and 2 are a single JSON document `openProjectDocument` has read
 * since there was one. So is an interchange document, which is a different
 * thing again — someone else's format, which we import rather than open.
 */
import { unzipSync, zipSync } from 'fflate'
import { WORKING_FILE_EXTENSION } from '../model/hostModel'
import { bytesFromText, parseJson, textFromBytes } from './fileText'
import { scopeFiles } from './folderFormat'
import { migrateSnapshot } from './migrate3to4'
import { openScopeFolder } from './migrate4to5'
import type { FolderFile } from './folderFormat'
import { openScopeDocument } from './scope'
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

/** The scope as one file: the folder, zipped, entries in path order. */
export function workingFileBytes(scope: ScopeSnapshot): Uint8Array {
  const entries: Record<string, [Uint8Array, { mtime: Date }]> = {}
  for (const file of scopeFiles(scope)) {
    entries[file.path] = [
      'text' in file ? bytesFromText(file.text) : file.bytes,
      { mtime: FIXED_MTIME },
    ]
  }
  return zipSync(entries)
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
 * One door for all of it: a zip of whatever version, a version-1 or -2 JSON
 * document, and an interchange document from another tool. Which one it is, is a question
 * about the bytes and not about the extension — a file that was renamed is
 * still what it is.
 *
 * `into` is the scope being replaced: the file supplies the content, the open
 * scope supplies where it is filed.
 */
export function openDocumentBytes(bytes: Uint8Array, into: ScopeSnapshot): OpenResult {
  if (isZip(bytes)) {
    const files = folderIn(bytes)
    const scope = files && openScopeFolder(files, into.path)
    if (!scope) return { ok: false, messageKey: 'shell.unknownFile' }
    if (!scope.model.diagrams.length) return { ok: false, messageKey: 'shell.workingFileNoDiagrams' }
    return { ok: true, kind: 'workingFile', relayout: false, scope }
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
