/**
 * The last reader of format 4, and the only file that still knows there were
 * ever two kinds of record.
 *
 * Format 5 made every scope the same document (ADR-0012 §1), which left
 * `project.json` and `group.json` with nothing to be: one said "a landscape
 * lives here" and the other said "a name lives here", and a scope says both.
 * Every folder, every browser-storage record and every working file written
 * before the turn has to keep opening, and this is where that happens.
 *
 * | it said | it says now |
 * |---|---|
 * | `project.json` | `scope.json`, `kind: 'landscape'` |
 * | `group.json` | `scope.json`, `kind: 'domain'` |
 * | `formatVersion` | `version` |
 * | `groupName` | the parent scope's own `name` |
 *
 * **It reads the old and writes through the new.** The fold ends at a
 * `ScopeSnapshot`, and `folderFormat.ts` — the format's own writer — turns that
 * back into files. So there is one writer of format 5 and no second one here to
 * drift from it; what this file owns is the reading.
 *
 * **What it removes, it removes on purpose.** A folder's superseded header is
 * simply not among the files the format writes, so the first save takes it off
 * disk under the store's own removal rule. The grammar cannot claim it — a
 * format that named the files it has stopped writing would never stop naming
 * them — so {@link isSupersededPath} says it instead, and the store asks both.
 *
 * **`groupName` has nowhere to go here**, and that is deliberate. It was the
 * name of the folder ABOVE this one, carried on every project inside it; the
 * scope that owns it is a different folder, and one folder's fold cannot write
 * another's. The pass over the whole tree is what gives a parent its
 * `scope.json` (`migration.ts`), and this is what it folds each folder with.
 */
import { parseJson, stableJson, textFromBytes } from './fileText'
import { scopeFromFolder, SCOPE_FILE, SCOPE_FORMAT_VERSION } from './folderFormat'
import type { FolderFile } from './folderFormat'
import { foldFolderToFormat4 } from './migrate3to4'
import type { ScopeSnapshot } from './scope'
import type { ScopePath } from './scopePath'

/** What the two records were called. Nothing else in the tree names these. */
export const PROJECT_FILE = 'project.json'
export const GROUP_FILE = 'group.json'

/**
 * Is this a file an older format wrote and this one has stopped writing?
 *
 * The question a store asks beside `isFormatPath`, so that a folder being read
 * hands over its old header to be folded, and a folder being saved has it taken
 * away again.
 */
export function isSupersededPath(path: string): boolean {
  return path === PROJECT_FILE || path === GROUP_FILE
}

function objectIn(file: FolderFile | undefined): Record<string, unknown> | undefined {
  if (!file) return undefined
  const parsed = parseJson('text' in file ? file.text : textFromBytes(file.bytes))
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : undefined
}

function pass<T>(value: T | undefined, key: string): Record<string, T> {
  return value === undefined ? {} : { [key]: value }
}

/**
 * A format-4 folder's files, as format 5's, or `undefined` when the folder is
 * not one — which includes every folder that is already format 5.
 *
 * A format-3 folder goes through the earlier fold first, so the two versions
 * before this one land here as one shape and there is one place that knows what
 * a header becomes.
 *
 * Exported so a test can read the output as files rather than only through a
 * scope: a migration whose result can only be inspected after it has been
 * parsed again is a migration whose bugs are invisible.
 */
export function foldFolderToFormat5(files: readonly FolderFile[]): FolderFile[] | undefined {
  const held = foldFolderToFormat4(files) ?? files
  const byPath = new Map(held.map((file) => [file.path, file]))
  const project = objectIn(byPath.get(PROJECT_FILE))
  const group = project ? undefined : objectIn(byPath.get(GROUP_FILE))
  if (!project && !group) return undefined

  const header = project
    ? {
      type: 'lionsville-architecture',
      version: SCOPE_FORMAT_VERSION,
      name: typeof project.name === 'string' ? project.name : '',
      kind: 'landscape',
      ...pass(project.description, 'description'),
      activeDiagramId: typeof project.activeDiagramId === 'string' ? project.activeDiagramId : '',
      diagrams: Array.isArray(project.diagrams) ? project.diagrams : [],
      ...pass(project.defaults, 'defaults'),
      ...pass(project.logos, 'logos'),
      ...pass(project.interchange, 'interchange'),
    }
    : {
      type: 'lionsville-architecture',
      version: SCOPE_FORMAT_VERSION,
      name: typeof group!.name === 'string' ? group!.name : '',
      kind: 'domain',
      ...pass(group!.client, 'client'),
      ...pass(group!.description, 'description'),
      ...pass(group!.links, 'links'),
      activeDiagramId: '',
      diagrams: [],
    }

  return [
    ...held.filter((file) => !isSupersededPath(file.path)),
    { path: SCOPE_FILE, text: stableJson(header) },
  ]
}

/**
 * The scope a folder holds, whichever version wrote it.
 *
 * The dispatch lives here rather than in `folderFormat.ts` because the
 * dependency runs one way: the migration may know the format, and the format
 * may not know the migration. Every reader of a folder — the store, the
 * container, the history — goes through this one door, so there is nowhere a
 * version can be forgotten.
 */
export function openScopeFolder(
  files: readonly FolderFile[], path: ScopePath,
): ScopeSnapshot | undefined {
  const now = scopeFromFolder(files, path)
  if (now) return now
  const folded = foldFolderToFormat5(files)
  return folded ? scopeFromFolder(folded, path) : undefined
}
