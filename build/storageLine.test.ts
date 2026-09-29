// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The domain speaks no storage language, and knows no implementation
 * (ADR-0031 §4). `storageLine.ts` says what the line is and why each word is
 * on it; this holds the tree to it, and holds the exceptions to exactly what
 * the tree still does, so they can only shrink.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { importGraph, programFiles } from './cycles'
import {
  CEILINGS, CONTENT_WORDS, FOLDER_FORMAT, IMPORT_EXCEPTIONS, importsAcross, isWordsTable, listedIn, mayKnowStorage,
  NOT_STORAGE_WORDS, SPEAKS_NO_STORAGE, STORAGE_WORDS, storageWords, STRICT_WORDS, WORD_EXCEPTIONS, wordsOf,
} from './storageLine'

const root = fileURLToPath(new URL('..', import.meta.url))

/**
 * What differs between the exceptions listed and what the tree does, as
 * sentences that say what to write: a file doing more than its entry, one
 * doing less, and one whose entry is gone.
 */
function differences(
  listed: Readonly<Record<string, readonly string[]>>, found: Readonly<Record<string, readonly string[]>>, what: string,
): string[] {
  const wrong: string[] = []
  for (const file of new Set([...Object.keys(listed), ...Object.keys(found)])) {
    const was = listed[file] ?? []
    const is = found[file] ?? []
    const more = is.filter((one) => !was.includes(one))
    const less = was.filter((one) => !is.includes(one))
    if (more.length > 0) wrong.push(`${file} ${what} ${more.join(', ')}, which is across the line`)
    if (less.length > 0) wrong.push(`${file} no longer ${what} ${less.join(', ')}: take it off the exceptions`)
  }
  return wrong.sort()
}

describe('the line between the domain and where work is kept', { timeout: 60_000 }, () => {
  it('lists the folder format only while it is still in the domain', () => {
    const wrong = FOLDER_FORMAT.flatMap((file) => {
      if (!existsSync(`${root}/${file}`)) return [`${file} is gone: take it off FOLDER_FORMAT`]
      if (mayKnowStorage(file)) return [`${file} is with the implementations now: take it off FOLDER_FORMAT`]
      return []
    })
    expect(wrong).toEqual([])
  })

  it('has nothing in the domain import an implementation or the folder format, but the exceptions', () => {
    const found = importsAcross(importGraph(root, ['src', 'electron'], true))
    expect(differences(IMPORT_EXCEPTIONS, found, 'imports')).toEqual([])
  })

  it('has nothing in the domain name a storage mechanism in its code, but the exceptions', () => {
    const found: Record<string, string[]> = {}
    for (const file of programFiles(root, 'src')) {
      if (mayKnowStorage(file) || FOLDER_FORMAT.includes(file) || isWordsTable(file)) continue
      const words = storageWords(file, readFileSync(`${root}/${file}`, 'utf8'), Object.keys(STORAGE_WORDS))
      if (words.length > 0) found[file] = words
    }
    expect(differences(WORD_EXCEPTIONS, found, 'names')).toEqual([])
  })

  it('has the repositories and the words they are written in speak no storage at all, in comments either', () => {
    const wrong = SPEAKS_NO_STORAGE.flatMap((file) => {
      const words = storageWords(file, readFileSync(`${root}/${file}`, 'utf8'), STRICT_WORDS, true)
      return words.length > 0 ? [`${file} says ${words.join(', ')}`] : []
    })
    expect(wrong).toEqual([])
  })

  it('holds every list to its ceiling, exactly', () => {
    const lengths = {
      folderFormat: FOLDER_FORMAT.length,
      importingFiles: Object.keys(IMPORT_EXCEPTIONS).length,
      imports: Object.values(IMPORT_EXCEPTIONS).flat().length,
      namingFiles: Object.keys(WORD_EXCEPTIONS).length,
      words: Object.values(WORD_EXCEPTIONS).flat().length,
    }
    const wrong = Object.entries(lengths).flatMap(([list, length]) => {
      const ceiling = CEILINGS[list as keyof typeof CEILINGS]
      if (length > ceiling) return [`${list} holds ${length}, over its ceiling of ${ceiling}: raising the ceiling is a decision the change says`]
      if (length < ceiling) return [`${list} holds ${length}: bring its ceiling down from ${ceiling} to ${length}`]
      return []
    })
    expect(wrong).toEqual([])
  })

  it('says why each word is on the list or off it, and no word is both', () => {
    for (const reason of [
      ...Object.values(STORAGE_WORDS), ...Object.values(NOT_STORAGE_WORDS), ...Object.values(CONTENT_WORDS),
    ]) expect(reason).toMatch(/\w{3}/)
    expect(Object.keys(STORAGE_WORDS).filter((word) => word in NOT_STORAGE_WORDS)).toEqual([])
    expect(Object.keys(CONTENT_WORDS).filter((word) => !(word in STORAGE_WORDS))).toEqual([])
  })
})

describe('reading words out of code', () => {
  it('splits an identifier into its words, whatever its case', () => {
    expect(wordsOf('FolderSettingsStore')).toEqual(['folder', 'settings', 'store'])
    expect(wordsOf('IMAGES_FOLDER')).toEqual(['images', 'folder'])
    expect(wordsOf('readJSONFile')).toEqual(['read', 'json', 'file'])
    expect(wordsOf('indexedDB')).toEqual(['indexed', 'db'])
  })

  it('finds a word whole and not inside another, and a phrase side by side', () => {
    const listed = ['file', 'folder', 'file system']
    expect(listedIn(wordsOf('profile'), listed)).toEqual([])
    expect(listedIn(wordsOf('FileSystemScopeStore'), listed)).toEqual(['file', 'file system'])
    expect(listedIn(wordsOf('chooseFolder'), listed)).toEqual(['folder'])
  })

  it('reads the image library’s folders as the naming they are, and nothing else as that', () => {
    expect(listedIn(wordsOf('imageFoldersUnder'), ['folders'])).toEqual([])
    expect(listedIn(wordsOf('ImageFolder'), ['folder'])).toEqual([])
    expect(listedIn(wordsOf('IMAGES_FOLDER'), ['folder'])).toEqual(['folder'])
    expect(listedIn(wordsOf('folderOfImage'), ['folder'])).toEqual(['folder'])
  })

  it('reads identifiers and strings, and comments only when asked for the prose too', () => {
    const text = [
      '// The folder a scope is kept in.',
      "const label = 'git'",
      'const diskUsage = 1',
    ].join('\n')
    expect(storageWords('a.ts', text, ['folder', 'git', 'disk'])).toEqual(['disk', 'git'])
    expect(storageWords('a.ts', text, ['folder', 'git', 'disk'], true)).toEqual(['disk', 'folder', 'git'])
  })

  it('reads the folder format’s own spellings in a string and in the fixed parts of a template', () => {
    const text = [
      "const header = 'scope.json'",
      'const picture = (file: string) => `../images/${file}`',
      "const kept = source.kind === 'folder' ? 1 : 2",
      "const history = '.git/info/exclude'",
    ].join('\n')
    expect(storageWords('a.ts', text, ['folder'])).toEqual(['../', '.git', '.json', 'folder', 'images/'])
  })

  it('leaves alone what is not code deciding storage: a module imported, a landscape’s words, the marks', () => {
    const imports = [
      "import { SCOPE_FILE } from '../projects/folderFormat'",
      "export { fold } from '../../images/folder.json'",
      "type Held = import('../folder/x').Held",
      "const later = import('../folder/y')",
    ].join('\n')
    expect(storageWords('a.ts', imports, ['folder'])).toEqual([])
    expect(storageWords('a.ts', "const service = 'a managed database'", ['database'])).toEqual([])
    expect(storageWords('a.ts', 'const managedDatabase = 1', ['database'])).toEqual(['database'])
    expect(storageWords('src/model/marks/vendors.ts', "const mark = 'GitLab'", ['git'])).toEqual([])
  })

  it('reads a screen as well as a module', () => {
    expect(storageWords('a.tsx', 'export const A = () => <ChooseFolder onDisk={1} />\n', ['folder', 'disk'])).toEqual(['disk', 'folder'])
  })
})
