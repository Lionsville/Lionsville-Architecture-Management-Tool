/**
 * What a scope's header file is called, and the one thing outside the renderer
 * that ever reads it.
 *
 * The format lives in `projects/folderFormat.ts` and is the only place that
 * knows what a scope's files mean. This is smaller than that on purpose: the
 * desktop's main process needs the organisation's name — for the window title,
 * and for the Recent menu, where a working directory IS the root scope
 * (ADR-0012 §1) — and dragging the format in would drag the model, the
 * decisions and the plans into a compile that has no DOM in it and no business
 * with any of them.
 *
 * So the name of the file and the name in it live here, in `platform`, which is
 * what main reads; the format imports the constant from here rather than
 * declaring a second one, because two spellings of `scope.json` is one spelling
 * and one oversight.
 *
 * Forgiving about everything, because main is a process that must not fail to
 * open a window: a file that is not there, will not parse, or was written by a
 * build that says something else answers with nothing, and the caller falls
 * back to the folder's own name.
 */

/** The file a folder holds when it is a scope. */
export const SCOPE_FILE = 'scope.json'

/** What the tool writes into every file it owns, so a folder says what it is. */
const TOOL = 'lionsville-architecture'

/**
 * The name a scope's header carries, trimmed — or nothing.
 *
 * `type` is checked when it is there and tolerated when it is not: a header
 * somebody wrote by hand is still a scope, and a file that says it belongs to
 * another tool is not ours to read a name out of.
 */
export function scopeNameIn(text: string | undefined): string | undefined {
  if (text === undefined) return undefined
  let held: unknown
  try {
    held = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!held || typeof held !== 'object' || Array.isArray(held)) return undefined
  const record = held as Record<string, unknown>
  if (record['type'] !== undefined && record['type'] !== TOOL) return undefined
  const name = typeof record['name'] === 'string' ? record['name'].trim() : ''
  return name || undefined
}
