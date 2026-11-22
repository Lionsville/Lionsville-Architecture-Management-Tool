// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface a build composed from this one imports, read from the tree and
 * held to a list (ADR-0022, amended).
 *
 * `src/composed/` is four folders of entries, one per kind of process that
 * loads them, and an entry is a list of names re-exported from the files that
 * hold them. A build composed from this one imports those entries and nothing
 * else of `src/`, so a file behind them moves without that build knowing. What
 * it does know is every name an entry offers and the type of each, and a change
 * to either is a change to somebody else's program: a **breaking change**,
 * said in the release notes as a control's name is (`platform/controlNames`).
 *
 * So the names and their types are written down, in `src/composed/SURFACE.txt`,
 * and `build/composedSurface.test.ts` holds the tree to that file exactly:
 *
 *   node build/composedSurface.ts            what differs, and fails on a difference
 *   node build/composedSurface.ts --write    rewrites the file (`npm run composed:write`)
 *
 * **What a line says.** `entry · name · kind · type`, sorted, one name to a
 * line. A function and a constant say their type as the compiler resolves it.
 * A type says what it is declared as, its members one level deep: a member's
 * own type is said by name where it has one. A union's members are sorted, so
 * the order the compiler happened to meet them in is not part of the file.
 *
 * **The closure.** A type of this tree named in a line is itself on the
 * surface: a build that reads `element.kind` depends on what an element is,
 * whether or not it ever names the type. So every such type is followed, from
 * line to line until nothing new is named, and those no entry offers are
 * listed after the entries under `~`, by name alone. By name and not by file,
 * so that a file behind the surface still moves freely; two types of one name
 * are two lines.
 *
 * **What is cut, and why.** Two things, both so that a change is one line
 * that can be read. A union of many members that has a name the compiler does
 * not keep — `keyof typeof EN`, every key of the string table, or `(typeof
 * TOOL_NAMES)[number]` — is said by that name wherever it is met
 * ({@link MANY}), where the compiler would write its members out in every
 * signature that takes one. And a line still wider than {@link WIDEST} says
 * what the type is written as where that is short, so a word added to the
 * string table is no change here, and a digest of its width where it is not.
 *
 * **What an entry must be**, beyond what the lint asks of it
 * (`SURFACE_ENTRIES` in `eslint.config.js`): each name comes from the file
 * that declares it and not through one that passes it on, under its own name,
 * and a declaration is offered by one entry only — so a name has one place on
 * the surface, and a tool that moves an import onto it has one answer.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

/** The surface's folder and the list it is held to, from the root of the tree. */
export const SURFACE = 'src/composed'
export const SNAPSHOT = `${SURFACE}/SURFACE.txt`

/** The kinds of process an entry is for: the folders under {@link SURFACE}. */
export const KINDS = ['process', 'node', 'renderer', 'testing'] as const

/** The widest a line's type may be said in full. */
export const WIDEST = 8000

/** From how many members a union is said by the name it was declared under. */
export const MANY = 20

/** What stands for a type no entry offers, in a line of the closure. */
const CLOSURE = '~'

const SEPARATOR = ' · '

const HEADER = [
  '# The surface a build composed from this one imports: every name an entry of',
  '# src/composed/ offers and its type, and after them (~) every type of this tree',
  '# those name. A name gone or a type changed is a breaking change, said in the',
  '# release notes. Written by `npm run composed:write`, held by',
  '# build/composedSurface.test.ts; build/composedSurface.ts says how to read it.',
]

/** Every entry under `root`, as `process/model`, sorted. */
export function entriesOf(root: string): string[] {
  return KINDS.flatMap((kind) => {
    const folder = join(root, SURFACE, kind)
    if (!existsSync(folder)) return []
    return readdirSync(folder)
      .filter((name) => name.endsWith('.ts') && !/\.(test|d)\.ts$/.test(name))
      .map((name) => `${kind}/${name.slice(0, -'.ts'.length)}`)
  }).sort(byCodePoint)
}

/** What the tree offers: the lines of the list, what each entry offers, and what an entry does that it may not. */
export type Surface = {
  lines: string[]
  /** Per entry, each name it offers with the file and the name it is declared under. */
  offered: Record<string, { name: string; file: string; declared: string }[]>
  faults: string[]
}

const byCodePoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

const FLAGS = ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.UseAliasDefinedOutsideCurrentScope | ts.NodeBuilderFlags.IgnoreErrors

const TYPE = ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface | ts.SymbolFlags.Class

/** A compiler over the entries, as the tree's own configuration compiles them. */
function programOver(root: string, entries: readonly string[]): ts.Program {
  const config = join(root, 'tsconfig.json')
  const options = existsSync(config)
    ? ts.getParsedCommandLineOfConfigFile(config, {}, {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: (problem) => { throw new Error(ts.flattenDiagnosticMessageText(problem.messageText, '\n')) },
      })!.options
    : { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, noEmit: true }
  return ts.createProgram(entries.map((entry) => join(root, SURFACE, `${entry}.ts`)), options)
}

/** The reader of one tree: says a type, and remembers which of the tree's types saying it named. */
function reader(root: string, program: ts.Program) {
  const checker = program.getTypeChecker()
  const printer = ts.createPrinter({ removeComments: true, omitTrailingSemicolon: true })
  const blank = ts.createSourceFile('said.ts', '', ts.ScriptTarget.Latest)
  const source = `${resolve(root, 'src')}${sep}`
  const named = new Set<ts.Symbol>()

  /** A node the compiler made is printed over nothing; one of the tree's, over its own file, where its words are. */
  const print = (node: ts.Node, file = blank): string => printer.printNode(ts.EmitHint.Unspecified, node, file).replace(/\s+/g, ' ')

  const memberText = (node: ts.TypeNode): string => (
    ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal) ? JSON.stringify(node.literal.text) : print(node))

  /** Whether a symbol is a type this tree declares. */
  const ofThisTree = (symbol: ts.Symbol): boolean => (symbol.flags & TYPE) !== 0
    && (symbol.declarations ?? []).some((declaration) => resolve(declaration.getSourceFile().fileName).startsWith(source))

  /**
   * The unions of many members whose name the compiler does not keep: an
   * alias written as a query (`keyof typeof EN`) resolves to a union that no
   * longer says where it came from, and is written out wherever it is met.
   */
  const many: { symbol: ts.Symbol; members: Set<string> }[] = []
  for (const file of program.getSourceFiles()) {
    if (!resolve(file.fileName).startsWith(source)) continue
    for (const statement of file.statements) {
      if (!ts.isTypeAliasDeclaration(statement) || statement.typeParameters || ts.isUnionTypeNode(statement.type)) continue
      // An exported one only: a file's own shorthand for a union is not a name anybody else reads.
      if ((ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export) === 0) continue
      const symbol = checker.getSymbolAtLocation(statement.name)
      const type = symbol && checker.getDeclaredTypeOfSymbol(symbol)
      if (!symbol || !type || !type.isUnion() || type.aliasSymbol || type.types.length < MANY) continue
      const members = type.types.map((member) => checker.typeToTypeNode(member, undefined, FLAGS)).filter((node) => node !== undefined)
      many.push({ symbol, members: new Set(members.map(memberText)) })
    }
  }
  many.sort((a, b) => b.members.size - a.members.size || byCodePoint(a.symbol.name, b.symbol.name))

  /** A union's members, with every run of them that is one of {@link many} said by its name, but for `self`. */
  const byName = (members: readonly ts.TypeNode[], self: ts.Symbol | undefined): ts.TypeNode[] => {
    if (members.length < MANY) return [...members]
    let left = members.map((node) => ({ node, text: memberText(node) }))
    const names: ts.TypeNode[] = []
    for (const one of many) {
      if (one.symbol === self || one.members.size > left.length) continue
      const texts = new Set(left.map((member) => member.text))
      if (![...one.members].every((text) => texts.has(text))) continue
      left = left.filter((member) => !one.members.has(member.text))
      names.push(ts.factory.createTypeReferenceNode(one.symbol.name))
      named.add(one.symbol)
    }
    return [...left.map((member) => member.node), ...names]
  }

  /** A union in the order of what its members say, not of when the compiler met them. */
  const sorted = <T extends ts.Node>(node: T, self?: ts.Symbol): T => {
    const result = ts.transform(node, [(context) => (rootNode) => {
      const visit = (at: ts.Node): ts.Node => {
        const inside = ts.visitEachChild(at, visit, context)
        if (!ts.isUnionTypeNode(inside)) return inside
        const members = byName(inside.types, self).sort((a, b) => byCodePoint(print(a), print(b)))
        return members.length === 1 ? members[0] : ts.factory.updateUnionTypeNode(inside, ts.factory.createNodeArray(members))
      }
      return ts.visitNode(rootNode, visit) as T
    }])
    const [out] = result.transformed
    result.dispose()
    return out
  }

  /** Every type of this tree a said node names: the compiler leaves each name's symbol on it. */
  const remember = (node: ts.Node): void => {
    const visit = (at: ts.Node): void => {
      if (ts.isIdentifier(at)) {
        const symbol = (at as ts.Identifier & { symbol?: ts.Symbol }).symbol
        const real = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
        if (real && ofThisTree(real)) named.add(real)
      }
      ts.forEachChild(at, visit)
    }
    visit(node)
  }

  const say = (type: ts.Type, flags = FLAGS, self?: ts.Symbol): string => {
    const node = checker.typeToTypeNode(type, undefined, flags)
    if (!node) return 'unknown'
    remember(node)
    return print(sorted(node, self))
  }

  const signature = (one: ts.Signature, kind: ts.SyntaxKind.CallSignature | ts.SyntaxKind.ConstructSignature): string => {
    const node = checker.signatureToSignatureDeclaration(one, kind, undefined, FLAGS)
    if (!node) return 'unknown'
    remember(node)
    return print(sorted(node))
  }

  const hidden = (member: ts.Symbol): boolean => member.name.startsWith('__#') || (member.declarations ?? [])
    .some((declaration) => (ts.getCombinedModifierFlags(declaration) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) !== 0)

  const readonly = (member: ts.Symbol): boolean => (member.declarations ?? [])
    .some((declaration) => (ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Readonly) !== 0)

  /** An object's members one level deep: each member's own type by name where it has one. */
  const members = (type: ts.Type): string => {
    const parts = [
      ...checker.getSignaturesOfType(type, ts.SignatureKind.Call).map((one) => signature(one, ts.SyntaxKind.CallSignature)),
      ...checker.getIndexInfosOfType(type).map((index) => `[key: ${say(index.keyType)}]: ${say(index.type)}`),
      ...checker.getPropertiesOfType(type).filter((member) => !hidden(member)).map((member) => {
        const name = /^[A-Za-z_$][\w$]*$/.test(member.name) ? member.name : JSON.stringify(member.name)
        const optional = member.flags & ts.SymbolFlags.Optional ? '?' : ''
        return `${readonly(member) ? 'readonly ' : ''}${name}${optional}: ${say(checker.getTypeOfSymbol(member))}`
      }),
    ]
    return parts.length > 0 ? `{ ${parts.join('; ')} }` : '{}'
  }

  /** The parameters a generic type is declared with, as written. */
  const parameters = (symbol: ts.Symbol): string => {
    const declared = (symbol.declarations ?? []).find((declaration) => ts.isTypeAliasDeclaration(declaration)
      || ts.isInterfaceDeclaration(declaration) || ts.isClassDeclaration(declaration)) as ts.DeclarationWithTypeParameterChildren | undefined
    const list = declared?.typeParameters
    return list && list.length > 0 ? `<${list.map((one) => one.getText().replace(/\s+/g, ' ')).join(', ')}> ` : ''
  }

  /** What a type alias is written as, for a line its resolved form is too wide for. */
  const written = (symbol: ts.Symbol): string | undefined => {
    const alias = (symbol.declarations ?? []).find(ts.isTypeAliasDeclaration)
    return alias ? print(alias.type, alias.getSourceFile()) : undefined
  }

  /** What a symbol is, and its type: a value as resolved, a type as declared. */
  const describe = (symbol: ts.Symbol): { kind: string; text: string; written?: string } => {
    const flags = symbol.flags
    if (flags & ts.SymbolFlags.Class) {
      const construct = checker.getSignaturesOfType(checker.getTypeOfSymbol(symbol), ts.SignatureKind.Construct)
        .map((one) => signature(one, ts.SyntaxKind.ConstructSignature))
      return { kind: 'class', text: `${parameters(symbol)}${construct.join('; ')} ${members(checker.getDeclaredTypeOfSymbol(symbol))}` }
    }
    const kinds: string[] = []
    const texts: string[] = []
    if (flags & ts.SymbolFlags.Function) { kinds.push('function'); texts.push(say(checker.getTypeOfSymbol(symbol))) }
    else if (flags & ts.SymbolFlags.Variable) { kinds.push('const'); texts.push(say(checker.getTypeOfSymbol(symbol))) }
    if (flags & ts.SymbolFlags.Interface) {
      kinds.push('interface'); texts.push(`${parameters(symbol)}${members(checker.getDeclaredTypeOfSymbol(symbol))}`)
    } else if (flags & ts.SymbolFlags.TypeAlias) {
      kinds.push('type')
      texts.push(`${parameters(symbol)}${say(checker.getDeclaredTypeOfSymbol(symbol), FLAGS | ts.NodeBuilderFlags.InTypeAlias, symbol)}`)
    }
    if (kinds.length === 0) return { kind: 'other', text: say(checker.getTypeOfSymbol(symbol)) }
    return { kind: kinds.join('+'), text: texts.join(SEPARATOR), written: kinds.length === 1 ? written(symbol) : undefined }
  }

  return { describe, named }
}

const digest = (text: string): string => createHash('sha256').update(text).digest('hex').slice(0, 16)

/** A type as a line may carry it: in full, as written where that is short, or as a digest of its width. */
function fitted(said: { text: string; written?: string }, widest: number): string {
  if (said.text.length <= widest) return said.text
  if (said.written !== undefined && said.written.length <= widest) return `as written: ${said.written}`
  return `${said.text.length} characters, sha256 ${digest(said.text)}`
}

/** The file a symbol is declared in, from `src/`, without its extension. */
function fileOf(root: string, symbol: ts.Symbol): string {
  const file = symbol.declarations?.[0]?.getSourceFile().fileName ?? ''
  return relative(resolve(root, 'src'), file).split(sep).join('/').replace(/\.tsx?$/, '')
}

/** One entry's exports, each with the declaration it resolves to and the specifier it came through. */
function exportsOf(checker: ts.TypeChecker, file: ts.SourceFile) {
  const module = checker.getSymbolAtLocation(file)
  return (module ? checker.getExportsOfModule(module) : []).map((exported) => {
    const real = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
    const specifier = (exported.declarations ?? []).find(ts.isExportSpecifier)
    const from = specifier?.parent.parent.moduleSpecifier
    const through = from ? checker.getSymbolAtLocation(from)?.valueDeclaration?.getSourceFile().fileName : undefined
    return { name: exported.name, real, through, renamed: specifier?.propertyName !== undefined && specifier.propertyName.text !== exported.name }
  })
}

/** The surface of the tree at `root`: the list's lines, and what an entry does that it may not. */
export function readSurface(root: string, widest = WIDEST): Surface {
  const entries = entriesOf(root)
  const program = programOver(root, entries)
  const checker = program.getTypeChecker()
  const { describe, named } = reader(root, program)
  const lines: string[] = []
  const faults: string[] = []
  const offered: Surface['offered'] = {}
  const offeredBy = new Map<ts.Symbol, string>()

  for (const entry of entries) {
    const file = program.getSourceFile(join(root, SURFACE, `${entry}.ts`))!
    offered[entry] = []
    const effects = file.statements.filter((statement) => ts.isImportDeclaration(statement) && !statement.importClause).length
    if (effects > 0) lines.push([entry, '(effect)', 'import', String(effects)].join(SEPARATOR))
    for (const { name, real, through, renamed } of exportsOf(checker, file)) {
      const holder = real.declarations?.[0]?.getSourceFile().fileName
      if (renamed) faults.push(`${entry} offers ${name} under another name than it is declared with: an entry re-exports by name`)
      if (holder && through && resolve(holder) !== resolve(through)) {
        faults.push(`${entry} takes ${name} from a file that passes it on: it is declared in ${fileOf(root, real)}, and an entry names the file that holds the name`)
      }
      const other = offeredBy.get(real)
      if (other) faults.push(`${other} and ${entry} both offer ${name}: a declaration is offered by one entry`)
      offeredBy.set(real, entry)
      offered[entry].push({ name, file: fileOf(root, real), declared: real.name })
      const said = describe(real)
      lines.push([entry, name, said.kind, fitted(said, widest)].join(SEPARATOR))
    }
  }

  // The closure: every type of the tree a line named, and every one those name, that no entry offers.
  const followed = new Set<ts.Symbol>()
  for (let waiting = [...named]; waiting.length > 0; waiting = [...named].filter((symbol) => !followed.has(symbol))) {
    for (const symbol of waiting) {
      followed.add(symbol)
      if (offeredBy.has(symbol)) continue
      const said = describe(symbol)
      lines.push([CLOSURE, symbol.name, said.kind, fitted(said, widest)].join(SEPARATOR))
    }
  }

  return { lines: lines.sort(byCodePoint), offered, faults: faults.sort(byCodePoint) }
}

/** The list as its file holds it. */
export function listed(text: string): string[] {
  return text.split('\n').filter((line) => line !== '' && !line.startsWith('#'))
}

/** The file a list is written as. */
export function written(lines: readonly string[]): string {
  return `${[...HEADER, ...lines].join('\n')}\n`
}

/** A line's key: where the name is offered, and the name. Two types of one name in the closure share one. */
const keyOf = (line: string): string => line.split(SEPARATOR, 2).join(SEPARATOR)

function byKey(lines: readonly string[]): Map<string, string[]> {
  const found = new Map<string, string[]>()
  for (const line of lines) found.set(keyOf(line), [...(found.get(keyOf(line)) ?? []), line])
  return found
}

/**
 * What differs between the list and the tree, as the three sentences there
 * are: a name gone, a type changed, a name the list does not hold.
 */
export function differences(list: readonly string[], tree: readonly string[]): string[] {
  const was = byKey(list)
  const is = byKey(tree)
  const said: string[] = []
  const where = (key: string): string => {
    const [entry, name] = key.split(SEPARATOR)
    return entry === CLOSURE ? `the type ${name}, which the surface names,` : `${name} on ${entry}`
  }
  for (const key of new Set([...was.keys(), ...is.keys()])) {
    const before = was.get(key)
    const now = is.get(key)
    if (!now) said.push(`${where(key)} is gone: a breaking change for a build composed from this one, said in the release notes. If it is meant, npm run composed:write`)
    else if (!before) said.push(`${where(key)} is not on the list: npm run composed:write, in the same commit`)
    else if (before.join('\n') !== now.join('\n')) {
      said.push(`${where(key)} changed its type: a breaking change for a build composed from this one, said in the release notes. If it is meant, npm run composed:write`)
    }
  }
  return said.sort(byCodePoint)
}

function main(args: readonly string[]): number {
  const root = resolve(import.meta.dirname, '..')
  const { lines, faults, offered } = readSurface(root)
  for (const fault of faults) console.error(fault)
  if (faults.length > 0) return 1
  const names = Object.values(offered).reduce((sum, entry) => sum + entry.length, 0)
  const file = join(root, SNAPSHOT)
  if (args.includes('--write')) {
    writeFileSync(file, written(lines))
    console.log(`${SNAPSHOT}: ${names} names on ${Object.keys(offered).length} entries, ${lines.length} lines`)
    return 0
  }
  const differs = differences(existsSync(file) ? listed(readFileSync(file, 'utf8')) : [], lines)
  for (const one of differs) console.error(one)
  console.log(`${names} names on ${Object.keys(offered).length} entries, ${lines.length} lines, ${differs.length} differing from ${SNAPSHOT}`)
  return differs.length > 0 ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = main(process.argv.slice(2))
