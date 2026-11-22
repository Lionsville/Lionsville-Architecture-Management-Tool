// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface a build composed from this one imports (ADR-0022, amended), held
 * to `src/composed/SURFACE.txt` exactly: a name gone, a type changed and a name
 * the list does not hold each fail, with the sentence that says which.
 * `composedSurface.ts` says what a line is and why.
 *
 * The reader is asked first about a tree written here, so that what it holds —
 * the closure, a union's order, what an entry may not do — is pinned on a tree
 * small enough to read, and then about this one.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { differences, entriesOf, listed, MANY, readSurface, SNAPSHOT, written } from './composedSurface'

const root = fileURLToPath(new URL('..', import.meta.url))

const made: string[] = []
afterAll(() => { for (const folder of made) rmSync(folder, { recursive: true, force: true }) })

/** A tree with these files, somewhere of its own. */
function treeOf(files: Readonly<Record<string, string>>): string {
  const folder = mkdtempSync(join(tmpdir(), 'surface-'))
  made.push(folder)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(folder, path)), { recursive: true })
    writeFileSync(join(folder, path), text)
  }
  return folder
}

const KEYS = Array.from({ length: MANY }, (_, at) => `k${String(at).padStart(2, '0')}`)

const SMALL = {
  'src/model/shapes.ts': [
    "export type Kind = 'zebra' | 'ant' | 'mole'",
    'type Size = { wide: number; high: number }',
    'export interface Box { readonly id: string; kind: Kind; size?: Size; inside: Box[] }',
    'export type Shelf = { boxes: Box[] }',
    'export function widest(boxes: Box[]): Box | undefined { return boxes[0] }',
    'export const NONE = 0',
    `export const TABLE = { ${KEYS.map((key) => `${key}: 1`).join(', ')} } as const`,
    'export type TableKey = keyof typeof TABLE',
    'export function at(key: TableKey): number { return TABLE[key] }',
  ].join('\n'),
  'src/model/passing.ts': "export { NONE } from './shapes'\nexport const OWN = 1\n",
  'src/app/boot.ts': 'export {}\n',
  'src/composed/process/shapes.ts': [
    "export { at, widest } from '../../model/shapes'",
    "export type { Kind, TableKey } from '../../model/shapes'",
  ].join('\n'),
  'src/composed/renderer/boot.ts': "import '../../app/boot'\n",
}

describe('the surface of a small tree', { timeout: 60_000 }, () => {
  const small = readSurface(treeOf(SMALL))

  it('lists each name an entry offers, with what it is and its type', () => {
    expect(small.faults).toEqual([])
    expect(small.lines).toContain('process/shapes · widest · function · (boxes: Box[]) => Box | undefined')
    expect(entriesOf(treeOf(SMALL))).toEqual(['process/shapes', 'renderer/boot'])
    expect(small.offered['process/shapes']).toContainEqual({ name: 'widest', file: 'model/shapes', declared: 'widest' })
  })

  it('says a union in the order of its members, not of where each was first written', () => {
    expect(small.lines).toContain('process/shapes · Kind · type · "ant" | "mole" | "zebra"')
  })

  it('follows every type a line names, and those it names, one level at a time', () => {
    expect(small.lines).toContain('~ · Box · interface · { readonly id: string; kind: Kind; size?: Size | undefined; inside: Box[] }')
    expect(small.lines).toContain('~ · Size · type · { wide: number; high: number; }')
    // Offered by no entry and named by no line: not on the surface.
    expect(small.lines.some((line) => line.includes('Shelf'))).toBe(false)
  })

  it('says a union of many members by the name it was declared under, and the members where it is declared', () => {
    expect(small.lines).toContain('process/shapes · at · function · (key: TableKey) => number')
    expect(small.lines).toContain(`process/shapes · TableKey · type · ${KEYS.map((key) => `"${key}"`).join(' | ')}`)
  })

  it('says a line too wide as its type is written, and one written as wide by a digest of its width', () => {
    const narrow = readSurface(treeOf(SMALL), 60).lines
    expect(narrow).toContain('process/shapes · TableKey · type · as written: keyof typeof TABLE')
    expect(narrow).toContain('process/shapes · Kind · type · "ant" | "mole" | "zebra"')
    expect(narrow.find((line) => line.startsWith('~ · Box · '))).toMatch(/^~ · Box · interface · \d+ characters, sha256 [0-9a-f]{16}$/)
  })

  it('lists an entry imported for what it does', () => {
    expect(small.lines).toContain('renderer/boot · (effect) · import · 1')
  })

  it('refuses a name taken from a file that passes it on, a name changed, and a declaration offered twice', () => {
    const { faults } = readSurface(treeOf({
      ...SMALL,
      'src/composed/process/more.ts': [
        "export { NONE } from '../../model/passing'",
        "export { OWN as MINE } from '../../model/passing'",
        "export { widest } from '../../model/shapes'",
      ].join('\n'),
    }))
    expect(faults).toHaveLength(3)
    expect(faults.join('\n')).toMatch(/process\/more takes NONE from a file that passes it on: it is declared in model\/shapes/)
    expect(faults.join('\n')).toMatch(/process\/more offers MINE under another name/)
    expect(faults.join('\n')).toMatch(/process\/more and process\/shapes both offer widest/)
  })
})

describe('the list and the tree, compared', () => {
  const list = ['process/a · one · const · 1', 'process/a · two · function · () => void', '~ · Box · interface · { id: string }']

  it('says nothing where they agree', () => {
    expect(differences(list, [...list].reverse())).toEqual([])
    expect(listed(written(list))).toEqual(list)
  })

  it('says a name gone, and that it is a breaking change', () => {
    expect(differences(list, list.slice(1))).toEqual([
      expect.stringMatching(/^one on process\/a is gone: a breaking change .* release notes/),
    ])
    expect(differences(list, list.slice(0, 2))).toEqual([expect.stringMatching(/^the type Box, which the surface names, is gone/)])
  })

  it('says a type changed, and that it is a breaking change', () => {
    const changed = ['process/a · one · const · 2', ...list.slice(1)]
    expect(differences(list, changed)).toEqual([expect.stringMatching(/^one on process\/a changed its type: a breaking change/)])
  })

  it('says a name the list does not hold, which is no break and still fails', () => {
    expect(differences(list, [...list, 'process/b · three · const · 3'])).toEqual([
      'three on process/b is not on the list: npm run composed:write, in the same commit',
    ])
  })

  it('keeps two types of one name in the closure apart from one', () => {
    const two = [...list, '~ · Box · interface · { wide: number }']
    expect(differences(two, two)).toEqual([])
    expect(differences(list, two)).toEqual([expect.stringMatching(/^the type Box, which the surface names, changed its type/)])
  })
})

describe('the surface of this tree', { timeout: 120_000 }, () => {
  const surface = readSurface(root)

  it('is entries that take each name from the file that holds it, once', () => {
    expect(surface.faults).toEqual([])
  })

  it('is what the list says it is: every name, every type, and nothing the list does not hold', () => {
    expect(differences(listed(readFileSync(join(root, SNAPSHOT), 'utf8')), surface.lines)).toEqual([])
  })

  it('names no place on the machine that read it, and follows the types it names', () => {
    expect(surface.lines.filter((line) => line.includes(root) || line.includes('import('))).toEqual([])
    expect(surface.lines.filter((line) => line.startsWith('~ ')).length).toBeGreaterThan(50)
    expect(Object.keys(surface.offered).length).toBeGreaterThan(20)
  })
})
