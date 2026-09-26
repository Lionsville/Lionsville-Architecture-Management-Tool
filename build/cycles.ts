// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The import graph, as the running program sees it, and the cycles in it.
 *
 * The matrix in `eslint.config.js` says who may import whom one edge at a
 * time, which is the wrong shape for a cycle: every edge of one can be
 * allowed and the loop still be there — two files of the same module that
 * each need the other, or three modules whose rows each allow the next. A
 * cycle is where a module stops being loadable on its own: the order the two
 * files initialise in decides whether a name is `undefined` at the moment it
 * is read, and nothing in either file says so.
 *
 * So the graph is built here from the source — every `import` and `export …
 * from` that survives compilation, which is to say not the type-only ones,
 * and not an `import()`, which is loaded later by design — and
 * `cycles.test.ts` holds it to none, at the level of files and at the level
 * of the modules in the matrix.
 *
 * Type-only imports are counted once more, at the level of modules only,
 * because a loop there is a matrix whose two rows each allow the other — a
 * shape a reader has to hold even when nothing runs in a circle. There is one,
 * `ports` and `projects`: a port names the scope it carries, and
 * `projects/filledStore.ts` takes a `ScopeStore` to fill. It is listed in the
 * test as the one there is, so a second is a decision rather than a drift.
 *
 * One exemption, and it is the matrix's own: the four files that compose the
 * string table import every module's slice (`COMPOSES_THE_TABLE` in
 * `eslint.config.js`), and every module reads its words back through the
 * registry. That is a loop between modules by construction and none between
 * files, because a slice imports nothing it would have to evaluate.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import ts from 'typescript'

/** Test code, and code there only for tests: not the program that runs. */
const NOT_THE_PROGRAM = /\.(test|spec|perf\.test)\.tsx?$|\.contract\.ts$|\.d\.ts$|(^|\/)testing\//

/** The files that compose the string table, as `eslint.config.js` names them. */
export const COMPOSES_THE_TABLE = [
  'src/i18n/strings.en.ts', 'src/i18n/strings.nl.ts', 'src/i18n/strings.fy.ts', 'src/i18n/strings.de.ts',
]

/** Every file of the program under `folder`, relative to `root`. */
export function programFiles(root: string, folder: string): string[] {
  const found: string[] = []
  const walk = (at: string) => {
    for (const entry of readdirSync(join(root, at), { withFileTypes: true })) {
      const path = `${at}/${entry.name}`
      if (entry.isDirectory()) walk(path)
      else if (/\.tsx?$/.test(entry.name) && !NOT_THE_PROGRAM.test(path)) found.push(path)
    }
  }
  walk(folder)
  return found.sort()
}

/**
 * What one file imports at run time: the specifiers of every import and
 * re-export that the compiler keeps. An import is erased when it says `type`,
 * or when every name it brings says `type`; one with no names at all is kept,
 * because it is imported for what it does.
 */
export function runtimeImports(path: string, text: string, withTypes = false): string[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX)
  const found: string[] = []
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause
      if (clause?.isTypeOnly && !withTypes) continue
      const named = clause?.namedBindings
      const onlyTypes = clause !== undefined && clause.name === undefined && named !== undefined
        && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every((one) => one.isTypeOnly)
      if (onlyTypes && !withTypes) continue
      found.push((statement.moduleSpecifier as ts.StringLiteral).text)
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      const clause = statement.exportClause
      const onlyTypes = statement.isTypeOnly || (clause !== undefined && ts.isNamedExports(clause)
        && clause.elements.length > 0 && clause.elements.every((one) => one.isTypeOnly))
      if (onlyTypes && !withTypes) continue
      found.push((statement.moduleSpecifier as ts.StringLiteral).text)
    }
  }
  return found
}

/** A relative specifier as the file it names, or `undefined` for a package or a file outside `files`. */
function resolveSpecifier(from: string, specifier: string, files: ReadonlySet<string>): string | undefined {
  if (!specifier.startsWith('.')) return undefined
  const bare = join(dirname(from), specifier.replace(/\?.*$/, '')).replace(/\.(js|ts|tsx)$/, '')
  return [`${bare}.ts`, `${bare}.tsx`, `${bare}/index.ts`, `${bare}/index.tsx`].find((path) => files.has(path))
}

export type Graph = ReadonlyMap<string, readonly string[]>

/**
 * The file graph over `folders` under `root`: what runs, or — `withTypes` —
 * everything a file names, which is the graph a reader has to hold.
 */
export function importGraph(root: string, folders: readonly string[], withTypes = false): Graph {
  const files = folders.flatMap((folder) => programFiles(root, folder))
  const known = new Set(files)
  const graph = new Map<string, string[]>()
  for (const file of files) {
    const text = readFileSync(resolve(root, file), 'utf8')
    const targets = runtimeImports(file, text, withTypes)
      .map((specifier) => resolveSpecifier(file, specifier, known))
      .filter((target): target is string => target !== undefined && target !== file)
    graph.set(file, [...new Set(targets)])
  }
  return graph
}

/** The module a file of `src/` belongs to, as the matrix names it: `platform/node` is a row of its own. */
export function moduleOf(file: string): string {
  const [top, first, second] = file.split('/')
  if (top !== 'src') return top === 'electron' ? `electron/${first}` : top
  return first === 'platform' && second === 'node' ? 'platform/node' : first
}

/** The module graph: an edge wherever a file of one imports a file of another. */
export function moduleGraph(files: Graph, exempt: readonly string[] = COMPOSES_THE_TABLE): Graph {
  const graph = new Map<string, Set<string>>()
  for (const [file, targets] of files) {
    const from = moduleOf(file)
    const edges = graph.get(from) ?? new Set<string>()
    graph.set(from, edges)
    if (exempt.includes(file)) continue
    for (const target of targets) if (moduleOf(target) !== from) edges.add(moduleOf(target))
  }
  return new Map([...graph].map(([node, edges]) => [node, [...edges].sort()]))
}

/** The strongly connected components with more than one member (Tarjan), each sorted, largest first. */
export function cycles(graph: Graph): string[][] {
  let next = 0
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const found: string[][] = []
  const visit = (node: string) => {
    index.set(node, next)
    low.set(node, next)
    next += 1
    stack.push(node)
    onStack.add(node)
    for (const target of graph.get(node) ?? []) {
      if (!index.has(target)) {
        visit(target)
        low.set(node, Math.min(low.get(node)!, low.get(target)!))
      } else if (onStack.has(target)) {
        low.set(node, Math.min(low.get(node)!, index.get(target)!))
      }
    }
    if (low.get(node) !== index.get(node)) return
    const component: string[] = []
    let member: string
    do {
      member = stack.pop()!
      onStack.delete(member)
      component.push(member)
    } while (member !== node)
    if (component.length > 1) found.push(component.sort())
  }
  for (const node of graph.keys()) if (!index.has(node)) visit(node)
  return found.sort((a, b) => b.length - a.length)
}

