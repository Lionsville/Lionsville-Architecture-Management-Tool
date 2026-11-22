// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The kit's ratchet (ADR-0045): a screen composes the kit, and does not reach
 * past it to the component library or style itself inline.
 *
 * Two things are measured in every shipped source file outside the kit: how
 * many names it imports from `@mui/*` and `@emotion/*`, and how many `sx` props
 * it writes. The tree is parsed, so a string or a comment that says `sx=` is
 * not counted. A file not on the list must measure nothing; a file on it is held
 * to exactly its two numbers, as `GROWN` holds a unit's size
 * (`build/unitSize.test.ts`): over fails, because the file grew, and under fails
 * too, until its entry comes down, so nothing grows back into the room.
 *
 *   node build/kitRatchet.ts [--write] [list.ts]    from the root of the tree
 *
 * Without `--write` it prints the totals and what differs, and fails on a
 * difference. With it, it rewrites the list's `HELD` block downward only:
 * an entry is lowered or taken off, never raised or added, and what it refused
 * is printed and fails the run. The list is a module (`build/kitRatchetList.ts`
 * by default) so that a tree which builds on this one can run this file by path
 * over its own sources and its own list.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

/** What one file measures. */
export type Measure = { names: number; sx: number }

/** What a list module says: where to look, what the kit is, and the files held. */
export type RatchetList = {
  SOURCES: readonly string[]
  KIT: readonly string[]
  HELD: Readonly<Record<string, readonly [number, number]>>
}

/** The library a screen reaches past the kit to. */
const LIBRARY = /^@(?:mui|emotion)\//
/** Not shipped: tests, contracts and the harnesses a test calls. */
const NOT_SHIPPED = /\.(test|spec|contract)\.|\/testing\/|\.d\.ts$/
/** What a file must say somewhere to measure anything at all. */
const MAY_COUNT = /@(?:mui|emotion)\/|\bsx\b/

function fromLibrary(specifier: ts.Expression | undefined): boolean {
  return specifier !== undefined && ts.isStringLiteral(specifier) && LIBRARY.test(specifier.text)
}

/** A default, a namespace and each named binding is a name; an import for its effect alone counts as one. */
function namesIn(clause: ts.ImportClause | undefined): number {
  if (clause === undefined) return 1
  const bindings = clause.namedBindings
  const named = bindings === undefined ? 0 : ts.isNamespaceImport(bindings) ? 1 : bindings.elements.length
  return (clause.name === undefined ? 0 : 1) + named
}

/** Names imported from the library, and `sx` props written, in one file's text. */
export function measure(text: string, fileName = 'file.tsx'): Measure {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, false, kind)
  let names = 0
  let sx = 0
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && fromLibrary(node.moduleSpecifier)) names += namesIn(node.importClause)
    else if (ts.isExportDeclaration(node) && fromLibrary(node.moduleSpecifier)) {
      names += node.exportClause !== undefined && ts.isNamedExports(node.exportClause) ? node.exportClause.elements.length : 1
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && fromLibrary(node.arguments[0])) names += 1
    else if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'sx') sx += 1
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { names, sx }
}

function sources(root: string, dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) return sources(root, path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

/** Every shipped file outside the kit that measures more than nothing, by its path from the root. */
export function measureTree(root: string, list: Pick<RatchetList, 'SOURCES' | 'KIT'>): Record<string, Measure> {
  const measured: Record<string, Measure> = {}
  for (const file of list.SOURCES.flatMap((dir) => sources(root, dir)).sort()) {
    if (NOT_SHIPPED.test(file) || list.KIT.some((kit) => file.startsWith(kit))) continue
    const text = readFileSync(join(root, file), 'utf8')
    // A file that says neither cannot count either, and is not worth a parse:
    // most of the tree, and the difference between a test for every runner and
    // one for a fast machine only.
    if (!MAY_COUNT.test(text)) continue
    const found = measure(text, file)
    if (found.names > 0 || found.sx > 0) measured[file] = found
  }
  return measured
}

const said = (file: string, names: number, sx: number): string => `${file}: ${names} imported names, ${sx} sx props`

/** What differs between the list and the tree, one sentence a file, each naming the file and both numbers. */
export function differences(held: RatchetList['HELD'], measured: Readonly<Record<string, Measure>>): string[] {
  const wrong: string[] = []
  for (const file of [...new Set([...Object.keys(held), ...Object.keys(measured)])].sort()) {
    const [names, sx] = held[file] ?? [0, 0]
    const is = measured[file] ?? { names: 0, sx: 0 }
    if (is.names === names && is.sx === sx) continue
    if (is.names > names || is.sx > sx) {
      wrong.push(`${said(file, is.names, is.sx)}, held to ${names} and ${sx}. This file grew; compose the kit`)
    } else {
      wrong.push(`${said(file, is.names, is.sx)}, held to ${names} and ${sx}. This file shrank: lower its entry`)
    }
  }
  return wrong
}

/**
 * The list lowered to what the tree measures, and what was refused: an entry
 * comes down or off, and never goes up or on. A file that grew keeps its entry.
 */
export function lowered(
  held: RatchetList['HELD'], measured: Readonly<Record<string, Measure>>,
): { held: Record<string, readonly [number, number]>; refused: string[] } {
  const next: Record<string, readonly [number, number]> = {}
  const refused: string[] = []
  for (const file of [...new Set([...Object.keys(held), ...Object.keys(measured)])].sort()) {
    const was = held[file]
    const is = measured[file] ?? { names: 0, sx: 0 }
    if (was === undefined) {
      refused.push(`${said(file, is.names, is.sx)}, and not on the list: not added. Compose the kit`)
      continue
    }
    if (is.names > was[0] || is.sx > was[1]) {
      refused.push(`${said(file, is.names, is.sx)}, held to ${was[0]} and ${was[1]}: not raised. Compose the kit`)
      next[file] = was
      continue
    }
    if (is.names > 0 || is.sx > 0) next[file] = [is.names, is.sx]
  }
  return { held: next, refused }
}

const BEGIN = /^export const HELD\b.*\{\s*$/m
const END = /^\}\s*$/m

/** The list module's text with its `HELD` block written anew: sorted, one file a line. */
export function written(text: string, held: Readonly<Record<string, readonly [number, number]>>): string {
  const begin = BEGIN.exec(text)
  if (begin === null) throw new Error('No `export const HELD … = {` line in the list')
  const after = begin.index + begin[0].length
  const end = END.exec(text.slice(after))
  if (end === null) throw new Error('No closing `}` line after HELD in the list')
  const lines = Object.keys(held).sort().map((file) => `  '${file}': [${held[file][0]}, ${held[file][1]}],`)
  return `${text.slice(0, after)}\n${lines.join('\n')}${lines.length > 0 ? '\n' : ''}${text.slice(after + end.index)}`
}

/** Files, names and `sx` props, added up. */
export function totals(measured: Readonly<Record<string, Measure>>): { files: number; names: number; sx: number } {
  const all = Object.values(measured)
  return {
    files: all.length,
    names: all.reduce((sum, one) => sum + one.names, 0),
    sx: all.reduce((sum, one) => sum + one.sx, 0),
  }
}

export function totalsLine(measured: Readonly<Record<string, Measure>>): string {
  const { files, names, sx } = totals(measured)
  return `kit ratchet: ${files} files outside the kit, ${names} names imported from @mui and @emotion, ${sx} sx props`
}

async function main(args: readonly string[]): Promise<number> {
  const root = process.cwd()
  const write = args.includes('--write')
  const listPath = resolve(root, args.find((arg) => arg !== '--write') ?? 'build/kitRatchetList.ts')
  const list = await import(pathToFileURL(listPath).href) as RatchetList
  const measured = measureTree(root, list)
  console.log(totalsLine(measured))
  if (!write) {
    const wrong = differences(list.HELD, measured)
    for (const line of wrong) console.error(line)
    return wrong.length === 0 ? 0 : 1
  }
  const { held, refused } = lowered(list.HELD, measured)
  writeFileSync(listPath, written(readFileSync(listPath, 'utf8'), held))
  console.log(`${relative(root, listPath)}: ${Object.keys(held).length} files held`)
  for (const line of refused) console.error(line)
  return refused.length === 0 ? 0 : 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = await main(process.argv.slice(2))
