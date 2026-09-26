// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the app is built from, held to a written policy before anything is
 * built: `npm run deps`, inside `npm run check`.
 *
 * Four questions, each a few milliseconds over files already on disk:
 *
 * - **One copy of what must be one.** React, React DOM, MUI and Emotion keep
 *   module-level state — a hook dispatcher, a theme context, a style cache — and
 *   a second copy in a bundle does not fail to build, it fails to draw, in the
 *   one component that happened to resolve the other copy. The lockfile says how
 *   many versions of each are installed; more than one is a failure here, before
 *   a bundle can carry both. A consumer that builds against this tree's install
 *   names it as `pinnedBy`, and its versions must then equal these.
 * - **What ships, on purpose.** Every package the shipped source imports (or, for
 *   a program that installs its `dependencies`, every one of those) is on a
 *   committed list with its licence and the reason it is there. A new one fails
 *   until somebody writes that line; a line nothing needs any more fails too.
 * - **Licences.** Everything that ships, transitively, carries a licence from the
 *   allowed set or a named exception with its reason. An unknown or undeclared
 *   one fails, with the package named.
 * - **The lockfile.** Every package comes from the public registry, over https,
 *   with an integrity hash, and no manifest names a git, file, link or http
 *   source: what `npm ci` installs on a runner is what was reviewed here.
 *
 *   node build/dependencies.ts [policy.ts]    from the root of the tree to check
 *
 * The policy is a module (`build/dependencyPolicy.ts` by default) so that a
 * tree which builds on this one can run this file by path over its own.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { licenseFromText, licenseOf, licenseTextIn, partClosure, type Manifest, type Part } from './thirdPartyNotices.ts'

export type { Part }

// --- the lockfile ----------------------------------------------------------------

export type LockEntry = {
  name?: string
  version?: string
  resolved?: string
  integrity?: string
  link?: boolean
  dev?: boolean
  devOptional?: boolean
  inBundle?: boolean
  license?: string
}

export type Lockfile = { lockfileVersion?: number; packages?: Record<string, LockEntry> }

export const REGISTRY = 'https://registry.npmjs.org/'

/** The package an entry installs: its alias target if it has one, else the last `node_modules/` segment. */
export function nameOf(path: string, entry: LockEntry): string {
  if (entry.name) return entry.name
  const at = path.lastIndexOf('node_modules/')
  return at === -1 ? path : path.slice(at + 'node_modules/'.length)
}

/**
 * A spec that installs from somewhere other than the registry: a git remote, a
 * folder, a link, a tarball URL, or GitHub's `owner/repo` shorthand. A semver
 * range, a dist-tag, `npm:` aliases and an override's `$name` are the registry.
 */
export function isForeignSpec(spec: string): boolean {
  if (/^(git|git\+[a-z]+|github|gitlab|bitbucket|gist|file|link|http|https):/i.test(spec)) return true
  if (/^npm:/.test(spec) || spec.startsWith('$')) return false
  return /^[^@\s/][^\s]*\/[^\s]+$/.test(spec)
}

interface Specs { [name: string]: string | Specs }

function specsIn(specs: Specs | undefined, where: string): [string, string][] {
  return Object.entries(specs ?? {}).flatMap(([name, spec]) =>
    typeof spec === 'string' ? [[`${where} ${name}`, spec] as [string, string]] : specsIn(spec, `${where} ${name} >`))
}

export type RootManifest = Manifest & {
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  overrides?: Specs
}

/** Everything wrong with a lockfile and the manifest beside it, one sentence each. */
export function lockfileProblems(lock: Lockfile, manifest: RootManifest): string[] {
  const said: string[] = []
  if (!lock.packages || (lock.lockfileVersion ?? 0) < 2) {
    return ['package-lock.json has no `packages` map (lockfileVersion 2 or later); run `npm install` with a current npm.']
  }
  const declared = [
    ...specsIn(manifest.dependencies, 'dependencies'),
    ...specsIn(manifest.devDependencies, 'devDependencies'),
    ...specsIn(manifest.optionalDependencies, 'optionalDependencies'),
    ...specsIn(manifest.overrides, 'overrides'),
  ]
  for (const [where, spec] of declared) {
    if (isForeignSpec(spec)) said.push(`package.json ${where} is "${spec}", which is not the registry.`)
  }
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === '') continue
    if (entry.link) {
      said.push(`${path} is a link, not a package from the registry.`)
      continue
    }
    // A bundled dependency travels inside its parent's tarball, whose own
    // `resolved` and `integrity` are what cover it.
    if (entry.inBundle) continue
    if (!entry.resolved?.startsWith(REGISTRY)) {
      said.push(`${path} resolves to ${entry.resolved ?? 'nothing'}, not to ${REGISTRY}.`)
    }
    if (!entry.integrity) said.push(`${path} has no integrity hash.`)
  }
  return said
}

// --- one copy --------------------------------------------------------------------

/** `react/jsx-runtime` is React; a pattern ending `/*` is a whole scope. */
export function packageOf(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

function matches(pattern: string, name: string): boolean {
  return pattern.endsWith('/*') ? name.startsWith(pattern.slice(0, -1)) : packageOf(pattern) === name
}

/** Every version installed of every package a pattern names. */
export function versionsOf(lock: Lockfile, patterns: readonly string[]): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>()
  for (const [path, entry] of Object.entries(lock.packages ?? {})) {
    if (path === '' || entry.link || !entry.version) continue
    const name = nameOf(path, entry)
    if (!patterns.some((pattern) => matches(pattern, name))) continue
    if (!found.has(name)) found.set(name, new Set())
    found.get(name)?.add(entry.version)
  }
  return found
}

/**
 * A package that must be one copy and is installed in more than one version —
 * and, where `pinned` is the lockfile of the tree this one builds against, one
 * whose version differs from that tree's, or that this tree installs and that
 * one does not.
 */
export function singletonProblems(lock: Lockfile, patterns: readonly string[], pinned?: Lockfile): string[] {
  const said: string[] = []
  const ours = versionsOf(lock, patterns)
  for (const pattern of patterns) {
    if (pattern.endsWith('/*')) continue
    if (!ours.has(packageOf(pattern)) && !pinned) said.push(`${pattern} must be one copy and is not installed at all.`)
  }
  const theirs = pinned ? versionsOf(pinned, patterns) : undefined
  for (const [name, versions] of ours) {
    if (versions.size > 1) said.push(`${name} must be one copy and is installed as ${[...versions].sort().join(', ')}.`)
    if (!theirs) continue
    const pinnedVersions = theirs.get(name)
    if (!pinnedVersions) {
      said.push(`${name} ${[...versions].join(', ')} is installed here and not in the tree it builds against.`)
    } else if ([...versions].some((version) => !pinnedVersions.has(version))) {
      said.push(`${name} is ${[...versions].join(', ')} here and ${[...pinnedVersions].join(', ')} in the tree it builds against.`)
    }
  }
  return said
}

// --- licences --------------------------------------------------------------------

/**
 * Whether an SPDX expression is satisfied by the allowed set: `OR` needs one
 * side, `AND` both, parentheses group, and `X WITH Y` is allowed only when
 * written into the set as it stands. Anything that does not parse — `BSD`,
 * `SEE LICENSE IN …`, `UNLICENSED` — is not allowed, which is the safe answer.
 */
export function licenceAllowed(expression: string, allowed: ReadonlySet<string>): boolean {
  const lower = new Set([...allowed].map((id) => id.toLowerCase()))
  const tokens = expression.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ').trim().split(/\s+/)
  let at = 0
  const peek = () => tokens[at]?.toUpperCase()
  const term = (): boolean => {
    if (tokens[at] === '(') {
      at++
      const inner = either()
      if (tokens[at++] !== ')') throw new Error('unbalanced')
      return inner
    }
    const id = tokens[at++]
    if (!id || id === ')' || ['AND', 'OR', 'WITH'].includes(id.toUpperCase())) throw new Error('expected a licence')
    if (peek() === 'WITH') {
      at++
      const exception = tokens[at++]
      if (!exception) throw new Error('expected an exception')
      return lower.has(`${id} WITH ${exception}`.toLowerCase())
    }
    return lower.has(id.toLowerCase())
  }
  const both = (): boolean => {
    let held = term()
    while (peek() === 'AND') {
      at++
      held = term() && held
    }
    return held
  }
  const either = (): boolean => {
    let held = both()
    while (peek() === 'OR') {
      at++
      held = both() || held
    }
    return held
  }
  try {
    const answer = either()
    return at === tokens.length && answer
  } catch {
    return false
  }
}

/** One package that ships, and the licence it says it is under. */
export type Shipped = { name: string; version: string; licence?: string }

export type Reasoned = { licence: string; why: string }

/** Every package whose licence is neither in the allowed set nor the exception written for it. */
export function licenceProblems(
  shipped: readonly Shipped[],
  allowed: readonly string[],
  exceptions: Readonly<Record<string, Reasoned>> = {},
): string[] {
  const set = new Set(allowed)
  const said: string[] = []
  for (const one of shipped) {
    const exception = exceptions[one.name]
    if (!one.licence) {
      said.push(`${one.name} ${one.version} declares no licence and ships no text this can read; it may not ship until one is known.`)
    } else if (exception) {
      if (exception.licence !== one.licence) {
        said.push(`${one.name} ${one.version} is ${one.licence}; its exception was written for ${exception.licence}.`)
      }
    } else if (!licenceAllowed(one.licence, set)) {
      said.push(`${one.name} ${one.version} is ${one.licence}, which is not in the allowed set and has no exception.`)
    }
  }
  for (const name of Object.keys(exceptions)) {
    if (!shipped.some((one) => one.name === name)) said.push(`The licence exception for ${name} names a package that no longer ships; remove it.`)
  }
  return said
}

// --- the list --------------------------------------------------------------------

/**
 * The runtime list against what is actually shipped: a package not on it, a
 * line whose licence no longer matches, a line with no reason, and a line for a
 * package nothing ships any more.
 */
export function runtimeListProblems(
  direct: readonly Shipped[],
  list: Readonly<Record<string, Reasoned>>,
  listFile: string,
): string[] {
  const said: string[] = []
  for (const one of direct) {
    const line = list[one.name]
    if (!line) {
      said.push(`${one.name} ships and is not on the runtime list in ${listFile}: add it with its licence (${one.licence ?? 'unknown'}) and why it is needed.`)
    } else if (line.licence !== one.licence) {
      said.push(`${one.name} is ${one.licence ?? 'undeclared'}; ${listFile} says ${line.licence}.`)
    } else if (!line.why.trim()) {
      said.push(`${one.name} is on the runtime list in ${listFile} without a reason.`)
    }
  }
  for (const name of Object.keys(list)) {
    if (!direct.some((one) => one.name === name)) said.push(`${name} is on the runtime list in ${listFile} and nothing ships it; remove the line.`)
  }
  return said
}

// --- the policy, and reading a tree ------------------------------------------------

export type Policy = {
  /** The SPDX identifiers any shipped package may carry. */
  allowed: readonly string[]
  /** A package that may ship under a licence outside that set, and why. */
  exceptions: Readonly<Record<string, Reasoned>>
  /** Every package the product imports or installs directly, its licence, and why. */
  runtime: Readonly<Record<string, Reasoned>>
  /** What must be installed as one copy: package names, a subpath of one, or `@scope/*`. */
  singletons: readonly string[]
  /** A tree this one builds against, whose versions of the singletons these must equal. */
  pinnedBy?: string
  /** What the product is built from. */
  parts: readonly Part[]
}

function readJson<T>(path: string): T | undefined {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return undefined
  }
}

/** The packages a part ships directly, and everything they depend on, with their licences. */
export function shippedBy(root: string, part: Part): { direct: Shipped[]; all: Shipped[] } {
  const { modules, read, direct, all } = partClosure(root, part)
  const describe = (name: string): Shipped => {
    const manifest = read(name)
    if (!manifest) return { name, version: 'not installed' }
    return { name, version: manifest.version ?? '', licence: licenseOf(manifest) ?? licenseFromText(licenseTextIn(join(modules, name))) }
  }
  return { direct: direct.map(describe), all: all.map(describe) }
}

function union(lists: Shipped[][]): Shipped[] {
  const seen = new Map<string, Shipped>()
  for (const one of lists.flat()) seen.set(`${one.name}@${one.version}`, one)
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
}

/** Every sentence the policy has to say about the tree at `root`; nothing, when it holds. */
export function policyProblems(root: string, policy: Policy, policyFile: string): string[] {
  const said: string[] = []
  const lock = readJson<Lockfile>(join(root, 'package-lock.json'))
  const manifest = readJson<RootManifest>(join(root, 'package.json'))
  if (!lock || !manifest) return [`${root} has no package.json and package-lock.json to read.`]

  said.push(...lockfileProblems(lock, manifest))

  const pinned = policy.pinnedBy ? readJson<Lockfile>(join(root, policy.pinnedBy, 'package-lock.json')) : undefined
  if (policy.pinnedBy && !pinned) said.push(`${policy.pinnedBy}/package-lock.json is not there to compare the singletons with.`)
  said.push(...singletonProblems(lock, policy.singletons, pinned))
  if (pinned) said.push(...singletonProblems(pinned, policy.singletons).map((one) => `${policy.pinnedBy}: ${one}`))

  const parts = policy.parts.map((part) => shippedBy(root, part))
  const direct = union(parts.map((part) => part.direct))
  for (const one of direct) {
    if (one.version === 'not installed') said.push(`${one.name} is imported by shipped source and is not installed.`)
  }
  said.push(...runtimeListProblems(direct.filter((one) => one.version !== 'not installed'), policy.runtime, policyFile))
  said.push(...licenceProblems(union(parts.map((part) => part.all)), policy.allowed, policy.exceptions))
  return said
}

// `node build/dependencies.ts [policy.ts]`, from the root of the tree it checks.
if (process.argv[1]?.endsWith('dependencies.ts')) {
  const policyFile = process.argv[2] ?? 'build/dependencyPolicy.ts'
  const loaded = await import(pathToFileURL(resolve(policyFile)).href) as { policy: Policy }
  const said = policyProblems(process.cwd(), loaded.policy, policyFile)
  if (said.length > 0) {
    for (const one of said) console.error(`deps: ${one}`)
    console.error(`deps: ${said.length} problem${said.length === 1 ? '' : 's'}; the policy is ${policyFile}.`)
    process.exit(1)
  }
  const shipped = union(loaded.policy.parts.map((part) => shippedBy(process.cwd(), part).all))
  console.log(`deps: ${shipped.length} packages ship, every licence allowed; one copy of each singleton; the lockfile is the registry's.`)
}
