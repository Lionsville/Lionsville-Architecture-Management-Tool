// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every JSON module node can reach says it is one.
 *
 * A bundler reads `import x from './x.json'` whatever it says; node refuses
 * it (`ERR_IMPORT_ATTRIBUTE_MISSING`) unless it carries
 * `with { type: 'json' }`. `platform/node/` is what a process with no screen
 * imports, and nothing but node reads it there — a server seeding an
 * organisation from a shipped example is the path this was found on. So
 * every file that folder reaches, through static and dynamic imports alike,
 * is read, and a JSON import in any of them without its attribute is named.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import ts from 'typescript'
import { programFiles } from './cycles'

/** Where node's reach begins: the one folder of `src/` a process with no screen imports. */
export const NODE_SEAM = 'src/platform/node'

/** One import a file makes, static or dynamic, and whether it says its module is JSON. */
export type ImportMade = { specifier: string; saysJson: boolean }

/** Whether an attributes clause says `type: 'json'`. */
function saysJson(attributes: ts.ImportAttributes | undefined): boolean {
  return attributes?.elements.some((one) => one.name.text === 'type' && ts.isStringLiteral(one.value) && one.value.text === 'json') ?? false
}

/** Whether a dynamic import's options say `{ with: { type: 'json' } }`. */
function optionsSayJson(options: ts.Expression | undefined): boolean {
  if (!options || !ts.isObjectLiteralExpression(options)) return false
  const within = options.properties.find((one): one is ts.PropertyAssignment =>
    ts.isPropertyAssignment(one) && ts.isIdentifier(one.name) && one.name.text === 'with')
  if (!within || !ts.isObjectLiteralExpression(within.initializer)) return false
  return within.initializer.properties.some((one) => ts.isPropertyAssignment(one) && ts.isIdentifier(one.name)
    && one.name.text === 'type' && ts.isStringLiteral(one.initializer) && one.initializer.text === 'json')
}

/** Every import a file makes — declarations, re-exports and `import()` with a literal — and what each says. */
export function importsMade(path: string, text: string): ImportMade[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: ImportMade[] = []
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push({ specifier: node.moduleSpecifier.text, saysJson: saysJson(node.attributes) })
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [what, options] = node.arguments
      if (what && ts.isStringLiteralLike(what)) found.push({ specifier: what.text, saysJson: optionsSayJson(options) })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/** A relative specifier as the file of the program it names, or `undefined`. */
function fileOf(from: string, specifier: string, files: ReadonlySet<string>): string | undefined {
  if (!specifier.startsWith('.')) return undefined
  const bare = join(dirname(from), specifier).replace(/\.(js|ts|tsx)$/, '')
  return [`${bare}.ts`, `${bare}.tsx`, `${bare}/index.ts`, `${bare}/index.tsx`].find((path) => files.has(path))
}

/**
 * Every file of the program node reaches from {@link NODE_SEAM}, and every
 * JSON import among them that does not say it is one, as `file: specifier`.
 */
export function jsonImportsFromNode(root: string): { reached: string[]; json: string[]; unsaid: string[] } {
  const files = new Set(programFiles(root, 'src'))
  const reached = new Set<string>()
  const json: string[] = []
  const unsaid: string[] = []
  const queue = [...files].filter((file) => file.startsWith(`${NODE_SEAM}/`))
  while (queue.length) {
    const file = queue.pop()!
    if (reached.has(file)) continue
    reached.add(file)
    for (const { specifier, saysJson: said } of importsMade(file, readFileSync(resolve(root, file), 'utf8'))) {
      if (specifier.endsWith('.json')) {
        json.push(`${file}: ${specifier}`)
        if (!said) unsaid.push(`${file}: ${specifier}`)
        continue
      }
      const next = fileOf(file, specifier, files)
      if (next && !reached.has(next)) queue.push(next)
    }
  }
  return { reached: [...reached].sort(), json: json.sort(), unsaid: unsaid.sort() }
}
