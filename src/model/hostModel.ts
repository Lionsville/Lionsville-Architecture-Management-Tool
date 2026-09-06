/**
 * The shapes by which the shell recognises a file, and the one question it asks
 * before swapping one document for another.
 *
 * What used to live here as well — landing a batch on the model, minting
 * permanent keys for the temporary ones in it, and the array-model versions of
 * renaming, duplicating and deleting a diagram — went with the batch itself
 * (ADR-0002). The reducer does all of it now, over the indexed model, and hands
 * back the command that undoes it.
 */
import type { UploadedLogo } from '.'
import type { HostModel, InterchangeDoc } from './fromInterchange'

/**
 * The working file: everything, including geometry and styling.
 *
 * A fresh definition, not a lineage. The files this tool wrote under its
 * previous name are not read — that was decided deliberately, with the rename,
 * rather than by neglect, and it is why there is no list of old tags
 * here and no migration behind it. A tool still finding its shape pays for
 * compatibility on every subsequent change; a tool with users pays for breaking
 * it. This one has no users yet, so the cheap moment is now.
 *
 * What the version is *for*, then, is the next change rather than the last one.
 * `WORKING_FILE_VERSIONS` is exactly the list {@link isWorkingFile} accepts, so
 * a file from a later version of this tool is refused rather than half-read —
 * which is the honest failure, because a newer version's file may carry meaning
 * this build would silently drop.
 */
export type WorkingFile = {
  type: typeof WORKING_FILE_TYPE
  version: WorkingFileVersion
  model: HostModel
  activeDiagramId?: string
  /** The uploaded logo library (data URLs). Absent when nothing was uploaded. */
  logoLibrary?: UploadedLogo[]
}

/**
 * What a working file calls itself on disk.
 *
 * Never shown to anybody: this is the discriminator a reader checks before
 * trusting the rest of the JSON. It names the tool, not a customer and not a
 * document type, because the tool is the thing that guarantees the shape.
 */
export const WORKING_FILE_TYPE = 'lionsville-architecture'

/**
 * The extension a working file is written with.
 *
 * One extension, not two words with a dot between them. The old
 * `.werkbestand.json` was a double extension: Windows cannot reliably associate
 * one, and the OS shows it as a `.json` file that any other program is welcome
 * to claim.
 *
 * Deliberately not `.json` either, though the contents are JSON today. The
 * container is allowed to stop being a single JSON file later — the uploaded
 * logo library is already data URLs embedded in the document, and a zip is the
 * obvious next step — and promising JSON in the extension turns that into a
 * breaking change instead of an implementation detail.
 */
export const WORKING_FILE_EXTENSION = '.lvarch'

/**
 * 1 — the first shape under this name.
 * 2 — the model may carry `decisions` (architecture decision records). A v1
 *     reader would keep the file's other content and silently drop those on
 *     its next save, which is exactly the loss the version exists to refuse.
 *
 * There is a version 3, and it is deliberately not in this union: it is the
 * project folder in a zip (ADR-0003), so there is no JSON document to carry a
 * version field at all. Its number lives inside, on the folder's `project.json`
 * — one number for one shape. `projects/workingFile.ts` reads it, and reaches
 * the two below by asking whether the bytes are a zip.
 */
export type WorkingFileVersion = 1 | 2

/** What this shell reads as a JSON document. The newest file is a zip. */
export const WORKING_FILE_VERSIONS: WorkingFileVersion[] = [1, 2]
export const WORKING_FILE_VERSION: WorkingFileVersion = 2

export function isWorkingFile(x: unknown): x is WorkingFile {
  if (!x || typeof x !== 'object') return false
  const file = x as WorkingFile
  if (file.type !== WORKING_FILE_TYPE) return false
  // A file without a version never existed (this shell always writes one), so an
  // unknown version is a file from the future and not an old file: refusing is
  // then more honest than half-reading it.
  return WORKING_FILE_VERSIONS.includes(file.version)
}

/** The uploaded logos from a working file; absent when nothing was uploaded. */
export function workingFileLogoLibrary(file: WorkingFile): UploadedLogo[] {
  return Array.isArray(file.logoLibrary) ? file.logoLibrary : []
}

export function isInterchange(x: unknown): x is InterchangeDoc {
  return !!x && typeof x === 'object' && 'formatVersion' in (x as object) && 'elements' in (x as object)
}

/**
 * Does the editor have to remount now that the shell is loading another document?
 *
 * Two reasons, and no others. The package's settle pass runs once per diagram id
 * per editor instance, so a document that has to be laid out again under ids
 * this instance already laid out only gets through with a fresh mount. And a
 * different set of ids is a different drawing: the viewport and selection you
 * would be preserving no longer refer to anything.
 *
 * What remains — and this is the ordinary case — is opening a working file with
 * the same diagrams. That does not need a remount, and used to get one anyway:
 * zoom, selection and collapsed panels all jumped back to the start. The undo
 * stack belongs to the session, which empties it as it adopts the new document.
 */
export function needsRemount(before: HostModel, after: HostModel, relayout: boolean): boolean {
  if (relayout) return true
  const a = before.diagrams.map((d) => d.id).sort()
  const b = after.diagrams.map((d) => d.id).sort()
  return a.length !== b.length || a.some((id, i) => id !== b[i])
}
