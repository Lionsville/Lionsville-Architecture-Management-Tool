// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which of a browser folder's files its history is kept of (ADR-0031, as
 * built): what a repository on a desktop would keep of the same folder.
 *
 * Left out: the operating systems' litter (`.DS_Store`, `Thumbs.db`,
 * `desktop.ini`), any `.git` folder, `node_modules` folders, and what the
 * folder's top-level `.gitignore` names. A path the history already holds, or
 * one a commit names, is kept whatever those say, as git keeps a file it
 * already tracks.
 *
 * Of `.gitignore`, the simple patterns are honoured — a name, a `*` or `?`
 * inside a name, a leading or inner `/` to anchor a pattern at the top, and a
 * trailing `/` for folders only. Not honoured: `!` to take a path back, `**`,
 * a `\` escape, character classes (`[…]`), and a `.gitignore` anywhere but at
 * the top; such a line leaves the files it would have left out in the history.
 */

/** Files no desktop repository would hold: what an operating system leaves in a folder. */
const LITTER = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini'])

/** One `.gitignore` line: its name patterns, whether it is anchored at the top, and whether it names folders only. */
type Pattern = { parts: RegExp[]; anchored: boolean; folders: boolean }

function nameMatcher(glob: string): RegExp {
  const body = glob.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')
  return new RegExp(`^${body}$`)
}

/** The lines of a `.gitignore` this honours; the rest are let go of. */
export function ignorePatterns(text: string): Pattern[] {
  const found: Pattern[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd()
    if (line === '' || line.startsWith('#') || line.startsWith('!') || /\*\*|\\|\[/.test(line)) continue
    const folders = line.endsWith('/')
    const bare = folders ? line.slice(0, -1) : line
    const anchored = bare.includes('/')
    const parts = bare.replace(/^\//, '').split('/')
    if (parts.some((part) => part === '')) continue
    found.push({ parts: parts.map(nameMatcher), anchored, folders })
  }
  return found
}

/** Whether a pattern names this path: its last names, or, anchored, the whole of it. */
function names(pattern: Pattern, segments: readonly string[], isFolder: boolean): boolean {
  if (pattern.folders && !isFolder) return false
  const { parts } = pattern
  if (pattern.anchored) return parts.length === segments.length && parts.every((part, at) => part.test(segments[at]))
  return parts.length === 1 && parts[0].test(segments[segments.length - 1])
}

/**
 * What to leave out of a folder's working set, given its `.gitignore`'s text
 * and the paths that are kept whatever it says.
 */
export function workingSetRule(gitignore: string | undefined, kept: Iterable<string>) {
  const patterns = gitignore === undefined ? [] : ignorePatterns(gitignore)
  const keptFiles = new Set(kept)
  const keptFolders = new Set<string>()
  for (const path of keptFiles) {
    for (let at = path.indexOf('/'); at >= 0; at = path.indexOf('/', at + 1)) keptFolders.add(path.slice(0, at))
  }
  const ignored = (path: string, isFolder: boolean): boolean => {
    const segments = path.split('/')
    return patterns.some((pattern) => names(pattern, segments, isFolder))
  }
  const leftOutFolder = (path: string): boolean => {
    const name = path.slice(path.lastIndexOf('/') + 1)
    return name === '.git' || name === 'node_modules' || ignored(path, true)
  }
  const underLeftOut = (path: string): boolean => {
    for (let at = path.indexOf('/'); at >= 0; at = path.indexOf('/', at + 1)) if (leftOutFolder(path.slice(0, at))) return true
    return false
  }
  return {
    /** Whether a folder, by its path, is not walked at all: nothing kept is under it, and it is left out. */
    skipsFolder: (path: string): boolean => !keptFolders.has(path) && leftOutFolder(path),
    /** Whether a file, by its path, is left out: it is not kept, and it or a folder it is in is left out. */
    skipsFile: (path: string): boolean => !keptFiles.has(path)
      && (LITTER.has(path.slice(path.lastIndexOf('/') + 1)) || ignored(path, false) || underLeftOut(path)),
  }
}
