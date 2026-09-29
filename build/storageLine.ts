// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The line between the domain and where work is kept (ADR-0031 §4), as data a
 * test holds the tree to.
 *
 * **No imports across the line.** Nothing outside the implementations
 * (`src/adapters/`, `src/platform/node/`, `electron/`), the providers built on
 * them (`src/providers/`) and the composition root imports an implementation,
 * or the folder format. The import matrix in
 * `eslint.config.js` already keeps `adapters` out of every module but the
 * composition root; what it cannot say is that a handful of files *inside*
 * the domain's own modules are the folder format and belong with the folder's
 * implementation. {@link FOLDER_FORMAT} names them, and the test reads the
 * import graph `cycles.ts` builds — types included, because a type names what
 * it knows as surely as a value does.
 *
 * **No storage words in logic.** An identifier in the domain, the app or a
 * screen that names a storage mechanism, or a string in its code that does,
 * is the domain deciding how work is kept. {@link STORAGE_WORDS} is the list,
 * each with why it is on it, and {@link NOT_STORAGE_WORDS} the words
 * considered and left off, each with why: a word that is also ordinary in this
 * tree would fail on a board's SVG path or a search query, and a test that
 * cries wolf is switched off. A string is read for the words and for the
 * folder format's own spellings ({@link FORMAT_PATTERNS}: `.json`, `../`,
 * `images/`, `.git`) — `kind === 'folder'` is the app branching on a storage
 * mechanism as surely as a name is. Not read: comments, which may say what a
 * folder does; the words tables, where a person may be told about their folder
 * where the folder's own chrome speaks; the name of a module imported, which
 * the other half reads; a word a landscape is made of ({@link CONTENT_WORDS});
 * and the strings of the marks ({@link CONTENT_FILES}).
 *
 * **Today's exceptions, and they only shrink.** {@link IMPORT_EXCEPTIONS} and
 * {@link WORD_EXCEPTIONS} are the tree as it stood when the rule arrived, each
 * entry exactly what that file does. The test fails on anything not listed,
 * and on an entry that no longer holds — so a file that stops crossing the
 * line takes its entry with it. {@link FOLDER_FORMAT} is held the same way:
 * every file on it must exist and still sit in the domain, and leaves the list
 * when it moves. And each list has a ceiling ({@link CEILINGS}) held to exactly
 * its length: a new entry fails unless the ceiling is raised in the same
 * change, where the diff shows it, and one taken off fails until the ceiling
 * comes down, so nothing grows back into the room.
 *
 * **The repositories speak no storage at all.** {@link SPEAKS_NO_STORAGE} are
 * the new seams and the words they are written in, held to the stricter list
 * ADR-0031 gives — file, folder, commit, table, URL, query — in their comments
 * as well as their code, with no exceptions.
 */
import ts from 'typescript'
import type { Graph } from './cycles'

/**
 * What may know how work is kept: the implementations, the providers built on
 * them — whose chrome is where a person is told about their folder (ADR-0031
 * §4) — and the composition root that chooses them.
 */
export const IMPLEMENTATIONS: readonly string[] = ['src/adapters/', 'src/providers/', 'src/platform/node/', 'electron/']
export const COMPOSITION_ROOT = 'src/app/composition.ts'

export function isImplementation(file: string): boolean {
  return IMPLEMENTATIONS.some((prefix) => file.startsWith(prefix))
}

/**
 * A module's words are not its implementation: the composed string table
 * imports every module's slice, `adapters`' included (`COMPOSES_THE_TABLE` in
 * `eslint.config.js`), and a slice is a table and nothing else.
 */
export function isWordsTable(file: string): boolean {
  return /^src\/[^/]+\/strings\/[^/]+\.ts$/.test(file)
}

export function mayKnowStorage(file: string): boolean {
  return isImplementation(file) || file === COMPOSITION_ROOT
}

/**
 * The folder format, still in the domain: a scope as files, the files'
 * text, what a scope's header file is called, the history subjects by path,
 * the settings file, the working file's codec, the
 * readers of the formats before this one and the pass that upgrades a
 * folder to this one. They are the folder implementation's, and move into it; each leaves
 * this list as it does.
 */
export const FOLDER_FORMAT: readonly string[] = [
  'src/platform/scopeHeader.ts',
  'src/projects/adrFile.ts',
  'src/projects/fileText.ts',
  'src/projects/folderFormat.ts',
  'src/projects/migrate3to4.ts',
  'src/projects/migrate4to5.ts',
  'src/projects/observationFile.ts',
  'src/projects/transitionFile.ts',
  'src/projects/workingFile.ts',
  'src/projects/workingFileManifest.ts',
]

/**
 * The words that name a storage mechanism, and why each is one. A phrase of
 * two words matches two words side by side in one identifier.
 */
export const STORAGE_WORDS: Readonly<Record<string, string>> = {
  folder: 'How the desktop keeps work. The domain says scope; a folder is the folder implementation\'s word.',
  folders: 'The same, more than once.',
  directory: 'The platform\'s word for a folder.',
  directories: 'The same, more than once.',
  git: 'How the desktop keeps a history. The domain says history, entry and label.',
  'commit message': 'What git calls an entry\'s subject. (A commit on its own is also an edit a text field commits, so the word alone is not listed.)',
  disk: 'Where the desktop\'s folder is. Where work is kept is not the domain\'s to say.',
  storage: 'The word for where work is kept, which only an implementation, and its provider\'s own chrome, speaks.',
  'file system': 'The mechanism under the folder, in the platform\'s words.',
  'indexed db': 'A browser\'s database, a place an implementation may keep work.',
  database: 'A place an implementation may keep work.',
  sql: 'How an implementation may ask a database.',
}

/**
 * The words considered and left off, and why: each is also an ordinary word
 * in this tree, and what it would catch the rule catches another way.
 */
export const NOT_STORAGE_WORDS: Readonly<Record<string, string>> = {
  file: 'The working file is an interchange format a person holds (ADR-0018, 0023), a `File` is what a person hands over from their own machine, and File is a menu. A file of the folder format arrives through the format\'s imports, which the other half of the rule refuses.',
  path: 'A scope\'s address is its path in the tree (`ScopePath`), and a board draws SVG paths. A path inside a scope is the folder format\'s, and arrives through its imports.',
  url: 'A link a person typed, and a mark\'s data URL, are content.',
  table: 'A table on a screen, and the command table.',
  query: 'A search, and a media query.',
  commit: 'An edit a text field commits; git\'s commit is caught as git and as a commit message.',
  blob: 'The bytes of an exported picture, handed to the browser to save.',
  json: 'How anything is written down, and the agent\'s protocol.',
  snapshot: 'A scope\'s state as read (`ScopeSnapshot`).',
  remote: 'A step another author made (`origin: \'remote\'`).',
}

/**
 * The phrases a storage word is ordinary in: the image library's folders are
 * a way of naming pictures (ADR-0031 §3), not a place.
 */
export const ORDINARY_PHRASES: readonly string[] = ['image folder', 'image folders']

/**
 * The seams, and the words they are written in, that speak no storage at all
 * — in comments as in code.
 */
export const SPEAKS_NO_STORAGE: readonly string[] = [
  'src/model/imageEntry.ts',
  'src/model/imageName.ts',
  'src/model/recordKey.ts',
  'src/ports/HistoryRepository.ts',
  'src/ports/ImageRepository.ts',
  'src/ports/OrganisationIndex.ts',
  'src/ports/Repositories.ts',
  'src/ports/ScopeRepository.ts',
  'src/ports/SettingsRepository.ts',
  'src/projects/scopeState.ts',
  'src/projects/settings.ts',
]

/** ADR-0031's own list, for the seams: every storage word, and the ordinary ones too. */
export const STRICT_WORDS: readonly string[] = [
  ...Object.keys(STORAGE_WORDS),
  'file', 'files', 'commit', 'commits', 'table', 'tables', 'url', 'urls', 'query', 'queries',
]

/** An identifier or a stretch of prose as its words, lower case: `FolderSettingsStore` is folder, settings, store. */
export function wordsOf(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0)
}

/**
 * The listed words and phrases one run of words says, once each, sorted — a
 * phrase in {@link ORDINARY_PHRASES} said instead of a word is not the word.
 */
export function listedIn(words: readonly string[], listed: readonly string[]): string[] {
  const found = new Set<string>()
  for (let at = 0; at < words.length; at += 1) {
    const pair = at + 1 < words.length ? `${words[at]} ${words[at + 1]}` : undefined
    if (pair !== undefined && listed.includes(pair)) found.add(pair)
    if (!listed.includes(words[at])) continue
    const ordinary = at > 0 && ORDINARY_PHRASES.includes(`${words[at - 1]} ${words[at]}`)
    if (!ordinary) found.add(words[at])
  }
  return [...found].sort()
}

/**
 * What names a place in the folder format when a string says it: a file of
 * its (`.json`, `.md`), a step up out of a scope (`../`), its pictures
 * (`images/`), its descriptions (`docs/`), and the history kept beside it
 * (`.git`). Read in strings only; an identifier
 * says the same things in words.
 */
export const FORMAT_PATTERNS: Readonly<Record<string, RegExp>> = {
  '.json': /\.json\b/i,
  '../': /\.\.\//,
  'images/': /(^|\/)images\//,
  '.git': /\.git\b/,
  'docs/': /(^|\/)docs\//,
  '.md': /\.md\b/i,
}

/**
 * The storage words that are also what a landscape is made of: a string may
 * name a database a team runs, or the SQL it speaks, as the thing it is. In an
 * identifier they are how the code keeps something, and are read there.
 */
export const CONTENT_WORDS: Readonly<Record<string, string>> = {
  database: 'A platform service a landscape draws: a managed database is an element, not where work is kept.',
  sql: 'What such a database speaks, in a service\'s description.',
}

/**
 * The files whose strings are content rather than code: the marks, which are
 * the icons a landscape draws, named as their makers name them — a git host
 * is a thing a landscape holds; and the manual's address, a page on the web
 * whose path happens to say `docs/` and `.md`.
 */
export const CONTENT_FILES: readonly string[] = ['src/model/marks/', 'src/platform/manual.ts']

/** The listed words, and the folder format's patterns, a string's text says. */
function storageInText(text: string, listed: readonly string[]): string[] {
  const patterns = Object.entries(FORMAT_PATTERNS).filter(([, pattern]) => pattern.test(text)).map(([said]) => said)
  const words = listedIn(wordsOf(text), listed).filter((word) => !(word in CONTENT_WORDS))
  return [...words, ...patterns]
}

/** Where a string names a module to import, which the import half of the rule reads instead. */
function isModuleName(node: ts.Node): boolean {
  const parent = node.parent as ts.Node | undefined
  if (!parent) return false
  if ((ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) && parent.moduleSpecifier === node) return true
  if (ts.isExternalModuleReference(parent) || ts.isLiteralTypeNode(parent) && ts.isImportTypeNode(parent.parent)) return true
  return ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword
}

/**
 * The storage words a file's code names — its identifiers, and the text of
 * its strings and of the fixed parts of its template strings, where the
 * folder format's patterns count too — read off the syntax tree, so a comment
 * is never taken for code. Or, `withProse`, every word the file says,
 * comments included.
 */
export function storageWords(path: string, text: string, listed: readonly string[], withProse = false): string[] {
  // The licence header is the same two lines on every file, and says what
  // the licence says about a file of source; it is nobody's storage.
  const code = text.replace(/^\/\/ SPDX-.*$/gm, '')
  if (withProse) return listedIn(wordsOf(code), listed)
  const content = CONTENT_FILES.some((prefix) => path.startsWith(prefix))
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, kind)
  const found = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
      for (const word of listedIn(wordsOf(node.text), listed)) found.add(word)
    } else if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) {
      if (!content && !isModuleName(node)) for (const said of storageInText(node.text, listed)) found.add(said)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return [...found].sort()
}

/**
 * Every file of the domain that imports an implementation or the folder
 * format, with what it imports, sorted. A file of the folder format may import
 * the rest of it: they move together.
 */
export function importsAcross(graph: Graph): Record<string, string[]> {
  const found: Record<string, string[]> = {}
  for (const [file, targets] of graph) {
    if (mayKnowStorage(file) || FOLDER_FORMAT.includes(file)) continue
    const across = targets.filter((target) => (isImplementation(target) && !isWordsTable(target)) || FOLDER_FORMAT.includes(target))
    if (across.length > 0) found[file] = [...across].sort()
  }
  return found
}

/**
 * Each domain file's imports across the line as they stood when the rule
 * arrived: the folder's way in and its chrome, the folder format read and
 * written from `app/` and `projects/`, and the ports it replaces.
 */
export const IMPORT_EXCEPTIONS: Readonly<Record<string, readonly string[]>> = {
  'src/app/shellParts.ts': ['src/projects/workingFileManifest.ts'],
  'src/app/useHomeFiles.ts': ['src/projects/workingFileManifest.ts'],
  'src/app/useHomeParts.ts': ['src/projects/workingFileManifest.ts'],
  'src/app/useProjectFiles.ts': ['src/projects/workingFileManifest.ts'],
  'src/app/useWorkspaceFiles.ts': ['src/projects/workingFileManifest.ts'],
  'src/app/workingFileFlows.ts': ['src/projects/workingFile.ts', 'src/projects/workingFileManifest.ts'],
  'src/app/workspaceProps.ts': ['src/projects/workingFileManifest.ts'],
  'src/projects/index.ts': ['src/projects/adrFile.ts', 'src/projects/fileText.ts', 'src/projects/folderFormat.ts', 'src/projects/migrate3to4.ts', 'src/projects/migrate4to5.ts', 'src/projects/workingFile.ts'],
  'src/projects/scope.ts': ['src/projects/workingFileManifest.ts'],
}

/** Each domain file's storage words, and the folder format's patterns in its strings, as they stood when the rule arrived. */
export const WORD_EXCEPTIONS: Readonly<Record<string, readonly string[]>> = {
  'src/agent/mcpProtocol.ts': ['disk'],
  'src/agent/shell.ts': ['disk'],
  'src/agent/tools.ts': ['disk', 'folder'],
  'src/app/App.tsx': ['storage'],
  'src/app/AppPanels.tsx': ['storage'],
  'src/app/DiskChangeNotice.tsx': ['disk'],
  'src/app/ProjectWorkspace.tsx': ['storage'],
  'src/app/ShellToolbar.tsx': ['disk'],
  'src/app/WorkspaceBar.tsx': ['disk'],
  'src/app/appProps.ts': ['storage'],
  'src/app/dialogs/OpenIntoDialog.tsx': ['folder'],
  'src/app/history/useProjectHistory.ts': ['commit message'],
  'src/app/main.tsx': ['../', 'storage'],
  'src/app/organisation/OrganisationScreen.tsx': ['folder'],
  'src/app/organisation/useOrganisation.ts': ['storage'],
  'src/app/useDocumentSession.ts': ['storage'],
  'src/app/useHomeParts.ts': ['.json'],
  'src/app/useShellPreferences.ts': ['storage'],
  'src/app/useShellServices.ts': ['storage'],
  'src/app/useStorageNotice.ts': ['storage'],
  'src/app/useWorkspaceDocument.ts': ['storage'],
  'src/app/useWorkspaceFiles.ts': ['.json'],
  'src/app/workspaceProps.ts': ['storage'],
  'src/projects/commitMessage.ts': ['commit message', 'git'],
}

/**
 * How long each list may be, written down beside it: an entry added fails the
 * test unless the ceiling is raised in the same change, where a reader of the
 * diff sees it; an entry taken off fails it until the ceiling comes down with
 * it, so the room it leaves cannot be taken again.
 */
export const CEILINGS = {
  /** Files of the folder format still in the domain. */
  folderFormat: 10,
  /** Files importing across the line, and the imports between them. */
  importingFiles: 9,
  imports: 15,
  /** Files naming storage, and the words and patterns between them. */
  namingFiles: 24,
  words: 27,
} as const
