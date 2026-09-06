/**
 * A project as one file: version 3, and everything before it.
 *
 * The folder is the working copy; this is the **container** — what you hand to
 * somebody, mail, attach to a ticket, or open on a machine that has never seen
 * your working directory. ADR-0003 kept it for exactly that, and the header
 * comment in `model/hostModel.ts` reserved the shape when it refused to promise
 * JSON in the `.lvarch` extension: version 3 is the project folder, zipped.
 *
 * It is the folder and not a new format on purpose. There is one writer, one
 * reader, one set of rules about what a file is called and what goes in it, and
 * an export that can be unzipped and read by a person with no tool at all. The
 * export is even reproducible — the entries carry a fixed timestamp — so two
 * exports of the same project are the same file and can be compared as one.
 *
 * Versions 1 and 2 keep opening: they are a single JSON document, and
 * `openProjectDocument` has read them since there was one. So does an
 * interchange document, which is a different thing again — someone else's
 * format, which we import rather than open.
 */
import { unzipSync, zipSync } from 'fflate'
import { WORKING_FILE_EXTENSION } from '../model/hostModel'
import { bytesFromText, parseJson, textFromBytes } from './fileText'
import { projectFiles, projectFromFolder } from './folderFormat'
import type { FolderFile } from './folderFormat'
import { openProjectDocument } from './project'
import type { OpenResult, ProjectSnapshot } from './project'
import { slug } from '../model/keys'

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

/** The project as one file: the folder, zipped, entries in path order. */
export function workingFileBytes(project: ProjectSnapshot): Uint8Array {
  const entries: Record<string, [Uint8Array, { mtime: Date }]> = {}
  for (const file of projectFiles(project)) {
    entries[file.path] = [
      'text' in file ? bytesFromText(file.text) : file.bytes,
      { mtime: FIXED_MTIME },
    ]
  }
  return zipSync(entries)
}

/** What the file is offered as. The project's own name, not its key. */
export function workingFileName(project: ProjectSnapshot): string {
  return `${slug(project.model.name) || project.ref.project}${WORKING_FILE_EXTENSION}`
}

/** Text unless the extension says otherwise — the same rule the folder store uses. */
function fileFrom(path: string, bytes: Uint8Array): FolderFile {
  return path.endsWith('.png') ? { path, bytes } : { path, text: textFromBytes(bytes) }
}

/**
 * The folder inside a version-3 file.
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
 * One door for all of it: a version-3 zip, a version-1 or -2 JSON document, and
 * an interchange document from another tool. Which one it is, is a question
 * about the bytes and not about the extension — a file that was renamed is
 * still what it is.
 *
 * `into` is the project being replaced: the file supplies the content, the open
 * project supplies where it is filed.
 */
export function openDocumentBytes(bytes: Uint8Array, into: ProjectSnapshot): OpenResult {
  if (isZip(bytes)) {
    const files = folderIn(bytes)
    const project = files && projectFromFolder(files, into.ref)
    if (!project) return { ok: false, messageKey: 'shell.unknownFile' }
    if (!project.model.diagrams.length) return { ok: false, messageKey: 'shell.workingFileNoDiagrams' }
    return { ok: true, kind: 'workingFile', relayout: false, project }
  }
  return openProjectDocument(parseJson(textFromBytes(bytes)), into)
}
