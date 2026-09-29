// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The last reader of format 3, with `model3to4.ts` for its rows: the only two
 * files that still know how it spelt things.
 *
 * Format 4 made the file say what the model says (`folderFormat.ts`), which
 * left three folds with nowhere to live and one job still to do: every folder,
 * every browser-storage record and every working file written before the turn
 * has to keep opening. ADR-0012 §11 is the table; this is the table as code.
 *
 * | it said | it says now |
 * |---|---|
 * | `connections` | `relations`, every row `type: 'flow'` |
 * | `externalSystem` | `application` + `outside` |
 * | `inputChannel` / `managementTool` | `application`; the band is the view's |
 * | `parentApplicationId` | `parentId` |
 * | `placements[].zone` / `.domainGroup` | `members[]`, groups by id |
 * | `layoutConfig` + coordinates | the geometry file |
 * | `<id>.placements.json` | `<id>.geometry.json` |
 *
 * **It reads the old and writes through the new.** The fold ends at a
 * `DesignDiagram`, and {@link diagramFiles} — the format's own writer — turns
 * that into the pair of files. So there is one writer of format 4 and no
 * second one here to drift from it; what this file owns is the reading.
 *
 * **What it removes, it removes on purpose.** A folder's superseded placement
 * files are simply not among the files this pass hands back, so the first save
 * takes them off disk under the store's own rule — remove what matches the
 * format's grammar and is not in the list (`isFormatPath`). Saying it here
 * rather than relying on it being noticed is the point of this paragraph.
 *
 * **The fold is idempotent**, because one of its two callers has no version to
 * check: a browser-storage record is a whole `ProjectSnapshot` with nothing on
 * it that says when it was written. A model that is already format 4's shape
 * goes through unchanged.
 */
import { parseJson, stableJson, textFromBytes } from '../../../projects/text'
import { diagramFiles, DIAGRAMS_FOLDER, MODEL_FILE } from './folderFormat'
import type { FolderFile } from './folderFormat'
import { elementFromV3, relationsFromV3, rows, viewFromV3 } from './model3to4'

/** The model's folds, where every caller of this file has always found them. */
export { isBeforeFormat4, migrateModel, migrateSnapshot } from './model3to4'

/** The version this file reads. There is no 1 or 2: the folder began at 3. */
const FORMAT_3 = 3

/**
 * The version it writes, and the name of the header it writes it into.
 *
 * Both live here rather than in the format, which has moved on twice since: a
 * format-4 folder is something this file produces on its way to a format-5 one
 * (`migrate4to5.ts` takes it from here), and nothing else in the tree has any
 * business knowing what that step looked like.
 */
const FORMAT_4 = 4
const PROJECT_FILE = 'project.json'

/** What a view's second file was called before it held numbers only. */
const PLACEMENTS_SUFFIX = '.placements.json'

function objectIn(file: FolderFile | undefined): Record<string, unknown> | undefined {
  if (!file) return undefined
  const parsed = parseJson('text' in file ? file.text : textFromBytes(file.bytes))
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : undefined
}

// --- a folder ---------------------------------------------------------------

function isDefinition(path: string): boolean {
  return path.startsWith(`${DIAGRAMS_FOLDER}/`) && path.endsWith('.json')
    && !path.endsWith(PLACEMENTS_SUFFIX)
}

/**
 * A format-3 folder's files, as format 4's, or `undefined` when the folder is
 * not one — which includes every folder that is already format 4.
 *
 * Exported so a test can read the output as files rather than only through a
 * project: a migration whose result can only be inspected after it has been
 * parsed again is a migration whose bugs are invisible.
 */
export function foldFolderToFormat4(files: readonly FolderFile[]): FolderFile[] | undefined {
  const byPath = new Map(files.map((file) => [file.path, file]))
  const header = objectIn(byPath.get(PROJECT_FILE))
  if (!header || header.formatVersion !== FORMAT_3) return undefined

  const folded: FolderFile[] = []
  for (const file of files) {
    if (file.path === PROJECT_FILE) {
      folded.push({
        path: PROJECT_FILE,
        text: stableJson({ ...header, formatVersion: FORMAT_4 }),
      })
      continue
    }
    if (file.path === MODEL_FILE) {
      const model = objectIn(file) ?? {}
      const { connections, elements, ...kept } = model
      folded.push({
        path: MODEL_FILE,
        text: stableJson({
          ...kept,
          elements: rows(elements).map(elementFromV3),
          relations: relationsFromV3(connections),
        }),
      })
      continue
    }
    // The superseded half of every view. Dropped here, which is what takes it
    // off disk on the first save — see the note at the top of this file.
    if (file.path.endsWith(PLACEMENTS_SUFFIX)) continue
    if (!isDefinition(file.path)) { folded.push(file); continue }

    const definition = objectIn(file)
    // A definition that is not one is left exactly as it is: the reader ignores
    // it either way, and a migration that rewrites what it cannot read is how a
    // folder loses a file somebody was in the middle of.
    if (!definition || typeof definition.id !== 'string' || typeof definition.name !== 'string') {
      folded.push(file)
      continue
    }
    const stem = file.path.slice(DIAGRAMS_FOLDER.length + 1, -'.json'.length)
    const laid = objectIn(byPath.get(`${DIAGRAMS_FOLDER}/${stem}${PLACEMENTS_SUFFIX}`))
    folded.push(...diagramFiles(viewFromV3(definition, laid && {
      placements: rows(laid.placements),
      ...('routes' in laid ? { routes: rows(laid.routes) } : {}),
      ...(laid.needsLayout === true ? { needsLayout: true } : {}),
    }), stem))
  }
  return folded
}
