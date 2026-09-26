// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a built bundle must and must not hold, read off the bytes it emits.
 *
 * The configs say what a build should do; this says what it did. Every check
 * here is one that a config can pass while its output fails:
 *
 * - **One React.** A bundle with two copies of React draws every screen and
 *   passes every test that reads one, while a component that resolved the
 *   second copy throws on its first hook. Each copy is counted by a sentence
 *   only that package's production build carries, once per copy.
 * - **Nothing only Node has**, in a bundle a browser or a renderer loads:
 *   `node:*`, `fs`, `child_process`, `electron`, or Vite's empty stand-in for
 *   any of them. A renderer that imports one fails at its first import, in the
 *   one window nobody opened before the release.
 * - **No word from a list this tree may not publish.** When the checkout sits
 *   beside such a list (`scripts/hooks/pre-push` reads the same one), and in
 *   any list a build passes in; a hit names the output file and the list's
 *   line, and never the word.
 * - **No secret, and no build-time variable's value.** A private key, a token
 *   in one of the shapes the big issuers use, or the value of any `VITE_*`
 *   variable the build could see: `import.meta.env` inlined whole carries every
 *   one of them into a file anybody can download.
 * - **Every package in the bundle has its notice**, where the build is told
 *   which file holds them: the list in `THIRD-PARTY-NOTICES.md` is derived from
 *   the source, and this is the bundler's own answer to the same question.
 *
 * As a Vite plugin (`bundleChecks()`), the build fails; as a script over a
 * folder that is already built, it exits 1:
 *
 *   node build/bundleChecks.ts <folder> [--browser] [--words <list>]...
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import type { Plugin } from 'vite'

export type Output = { name: string; text: string; modules?: readonly string[] }

/** A sentence that package's production build carries once, and nothing else carries. */
export const ONE_OF_EACH: Readonly<Record<string, string>> = {
  react: 'React.Children.only expected to receive a single React element child.',
  'react-dom': 'Skipping view transition because document visibility state has become hidden.',
}

// --- one copy -------------------------------------------------------------------

export function copiesProblems(outputs: readonly Output[], marks: Readonly<Record<string, string>> = ONE_OF_EACH): string[] {
  const said: string[] = []
  for (const [name, sentence] of Object.entries(marks)) {
    const where = outputs.flatMap((output) => Array(output.text.split(sentence).length - 1).fill(output.name) as string[])
    if (where.length === 0) {
      said.push(`${name} is not in the bundle — or its production build no longer says the sentence it is counted by (build/bundleChecks.ts, ONE_OF_EACH).`)
    } else if (where.length > 1) {
      said.push(`${name} is in the bundle ${where.length} times (${[...new Set(where)].join(', ')}); it must be one copy.`)
    }
  }
  return said
}

// --- nothing only Node has --------------------------------------------------------

const NODE_ONLY = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["'`](node:[a-z_/]+|fs|fs\/promises|child_process|electron)["'`]/g

export function nodeOnlyProblems(outputs: readonly Output[]): string[] {
  const said: string[] = []
  for (const output of outputs) {
    if (!/\.(m?js|html)$/.test(output.name)) continue
    const named = new Set([...output.text.matchAll(NODE_ONLY)].map((match) => match[1]))
    if (named.size > 0) said.push(`${output.name} imports ${[...named].sort().join(', ')}, which a browser or a renderer does not have.`)
    if (output.text.includes('__vite-browser-external') || /__vite-browser-external/.test(output.name)) {
      said.push(`${output.name} holds Vite's empty stand-in for a Node module: something the page imports reaches for one.`)
    }
  }
  return [...new Set(said)]
}

// --- words ------------------------------------------------------------------------

export type Word = { line: number; length: number; pattern: RegExp }

/**
 * A list in the pre-push hook's format: one entry a line, `#` comments; three
 * characters or fewer, or `word:`, match whole words (a word does not run on
 * through `-` or `_`); `case:` matches as written; anything else is a
 * case-insensitive substring. The same rules as the script CI runs over trees.
 */
export function parseWords(text: string): Word[] {
  const words: Word[] = []
  text.split('\n').forEach((raw, index) => {
    let entry = raw.replace(/#.*/, '').trim()
    let whole = false
    let cased = false
    for (;;) {
      if (entry.startsWith('word:')) { entry = entry.slice(5); whole = true } else if (entry.startsWith('case:')) { entry = entry.slice(5); cased = true } else break
    }
    if (!entry) return
    if (entry.length <= 3) whole = true
    const quoted = entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const source = whole ? `(^|[^A-Za-z0-9_-])${quoted}([^A-Za-z0-9_-]|$)` : quoted
    words.push({ line: index + 1, length: entry.length, pattern: new RegExp(source, cased ? 'm' : 'im') })
  })
  return words
}

/** Which output holds which line of a list: the file and the line number, never the word. */
export function wordProblems(outputs: readonly Output[], list: { file: string; words: readonly Word[] }): string[] {
  const said: string[] = []
  for (const output of outputs) {
    for (const word of list.words) {
      if (word.pattern.test(output.text)) said.push(`${output.name} matches line ${word.line} of ${list.file}.`)
    }
  }
  return said
}

/**
 * The list of words this checkout may not publish, if it sits beside one:
 * `../docs/boundary/words.txt` from the checkout, or from the folder its git
 * data lives in — which is where a worktree or a nested submodule finds it.
 */
export function findWordList(root: string): string | undefined {
  const beside = resolve(root, '..', 'docs', 'boundary', 'words.txt')
  if (existsSync(beside)) return beside
  let common: string
  try {
    common = resolve(root, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim())
  } catch {
    return undefined
  }
  for (let at = common; dirname(at) !== at; at = dirname(at)) {
    const candidate = join(at, 'docs', 'boundary', 'words.txt')
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

// --- secrets ----------------------------------------------------------------------

/** Shapes a credential has, named for the message; the value is never printed. */
export const SECRET_SHAPES: Readonly<Record<string, RegExp>> = {
  'a private key': /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  'a GitHub token': /\b(?:gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,})\b/,
  'an AWS access key': /\bAKIA[0-9A-Z]{16}\b/,
  'an Azure storage key': /AccountKey=[A-Za-z0-9+/]{40,}/,
  'a Slack token': /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  'an API key of an AI provider': /\bsk-(?:ant|proj)-[A-Za-z0-9_-]{20,}/,
  'a Google API key': /\bAIza[0-9A-Za-z_-]{35}\b/,
  'an npm token': /\bnpm_[A-Za-z0-9]{36}\b/,
  'a live Stripe key': /\b[sr]k_live_[0-9a-zA-Z]{24,}/,
  'a signed token': /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
}

/**
 * A value short enough to occur by chance — `1`, `true`, a port — is not
 * looked for; a value that could be a secret is.
 */
const MEANINGFUL = 6

export function secretProblems(outputs: readonly Output[], environment: Readonly<Record<string, string | undefined>> = {}): string[] {
  const said: string[] = []
  const values = Object.entries(environment).filter(([, value]) => value !== undefined && value.length >= MEANINGFUL)
  for (const output of outputs) {
    for (const [what, shape] of Object.entries(SECRET_SHAPES)) {
      if (shape.test(output.text)) said.push(`${output.name} holds what looks like ${what}.`)
    }
    for (const [name, value] of values) {
      if (output.text.includes(value as string)) said.push(`${output.name} holds the value of ${name}, which the build could see and must not bake in.`)
    }
  }
  return said
}

/** The `VITE_*` variables (or another prefix) a build could see. */
export function buildVariables(env: Readonly<Record<string, string | undefined>>, prefixes: readonly string[] = ['VITE_']): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(env).filter(([name]) => prefixes.some((prefix) => name.startsWith(prefix))))
}

// --- notices ----------------------------------------------------------------------

/** The package a module id lives in, if it lives in one. */
export function packageOfModule(id: string): string | undefined {
  const at = id.replaceAll('\\', '/').lastIndexOf('/node_modules/')
  if (at === -1) return undefined
  const parts = id.replaceAll('\\', '/').slice(at + '/node_modules/'.length).split('/')
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
}

/** The package names a notices file lists, from its `- name version — licence` lines. */
export function noticedPackages(text: string): Set<string> {
  return new Set([...text.matchAll(/^- (\S+) \S+ — /gm)].map((match) => match[1]))
}

export function noticeProblems(outputs: readonly Output[], noticed: ReadonlySet<string>, file: string): string[] {
  const missing = new Set<string>()
  for (const output of outputs) {
    for (const id of output.modules ?? []) {
      const name = packageOfModule(id)
      if (name && !noticed.has(name)) missing.add(name)
    }
  }
  return [...missing].sort().map((name) => `${name} is in the bundle and not in ${file}; regenerate it (build/thirdPartyNotices.ts).`)
}

// --- together ---------------------------------------------------------------------

export type Rules = {
  /** A bundle a browser or a renderer loads: one React, nothing only Node has. */
  browser?: boolean
  /** Lists of words the output may not hold. */
  words?: readonly { file: string; words: readonly Word[] }[]
  /** The variables the build could see, whose values it may not hold. */
  environment?: Readonly<Record<string, string | undefined>>
  /** The notices file every bundled package must be named in. */
  notices?: { file: string; names: ReadonlySet<string> }
}

export function bundleProblems(outputs: readonly Output[], rules: Rules): string[] {
  const text = outputs.filter((output) => !/\.(wasm|png|jpe?g|gif|ico|icns|woff2?|ttf)$/.test(output.name))
  return [
    ...(rules.browser ? copiesProblems(text) : []),
    ...(rules.browser ? nodeOnlyProblems(text) : []),
    ...(rules.words ?? []).flatMap((list) => wordProblems(text, list)),
    ...secretProblems(text, rules.environment),
    ...(rules.notices ? noticeProblems(outputs, rules.notices.names, rules.notices.file) : []),
  ]
}

/**
 * An entry of three characters or fewer is not looked for in a bundle: in
 * minified output every two- and three-letter name is somebody's mangled
 * variable, so it would fail every build and mean nothing. Those entries are
 * held where they mean something — in the source, by the pre-push hook and the
 * check that reads the same list over the whole tree.
 */
export const SHORTEST_IN_A_BUNDLE = 4

function readList(file: string) {
  return { file, words: parseWords(readFileSync(file, 'utf8')).filter((word) => word.length >= SHORTEST_IN_A_BUNDLE) }
}

export type Options = {
  /** The checkout the build belongs to: where a word list is looked for beside it. */
  root: string
  browser?: boolean
  /** More lists, in the same format, that this build's output may not hold. */
  wordLists?: readonly string[]
  /** The notices file every bundled package must be named in. */
  notices?: string
}

/** The checks as a Vite plugin: the build fails, with one sentence per problem. */
export function bundleChecks(options: Options): Plugin {
  let variables: Record<string, string | undefined> = {}
  return {
    name: 'lv-bundle-checks',
    apply: 'build',
    configResolved(config) {
      const prefixes = ([] as string[]).concat(config.envPrefix ?? 'VITE_')
      variables = { ...buildVariables(process.env, prefixes), ...buildVariables(config.env as Record<string, string>, prefixes) }
    },
    generateBundle(_options, bundle) {
      const found = findWordList(options.root)
      const lists = [...(found ? [found] : []), ...(options.wordLists ?? [])].map(readList)
      const outputs = Object.values(bundle).map((output): Output => ({
        name: output.fileName,
        text: output.type === 'chunk'
          ? output.code
          : typeof output.source === 'string' ? output.source : new TextDecoder().decode(output.source),
        modules: output.type === 'chunk' ? output.moduleIds : undefined,
      }))
      const notices = options.notices
        ? { file: relative(options.root, options.notices), names: noticedPackages(readFileSync(options.notices, 'utf8')) }
        : undefined
      const said = bundleProblems(outputs, { browser: options.browser, words: lists, environment: variables, notices })
      if (said.length > 0) this.error(said.join('\n'))
      this.info(`checked ${outputs.length} files: ${[
        options.browser ? 'one React, nothing only Node has' : undefined,
        lists.length ? `${lists.length} word list${lists.length === 1 ? '' : 's'}` : 'no word list beside this checkout',
        'no secret',
        notices ? 'every package noticed' : undefined,
      ].filter(Boolean).join(', ')}`)
    },
  }
}

// --- over a folder ------------------------------------------------------------------

/** Every file under a folder, named relative to it. */
export function outputsIn(folder: string): Output[] {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
  return walk(folder).map((path) => ({ name: relative(folder, path), text: readFileSync(path, 'utf8') }))
}

// `node build/bundleChecks.ts <folder> [--browser] [--words <list>]...`
if (process.argv[1]?.endsWith('bundleChecks.ts')) {
  const args = process.argv.slice(2)
  const folder = args.find((arg, at) => !arg.startsWith('--') && args[at - 1] !== '--words')
  if (!folder) {
    console.error('usage: node build/bundleChecks.ts <folder> [--browser] [--words <list>]...')
    process.exit(2)
  }
  const lists = args.flatMap((arg, at) => (arg === '--words' && args[at + 1] ? [args[at + 1]] : []))
  const found = findWordList(process.cwd())
  const said = bundleProblems(outputsIn(folder), {
    browser: args.includes('--browser'),
    words: [...(found ? [found] : []), ...lists].map(readList),
    environment: buildVariables(process.env),
  })
  if (said.length > 0) {
    for (const one of said) console.error(`bundle: ${one}`)
    process.exit(1)
  }
  console.log(`bundle: ${folder} holds what it should${found || lists.length ? `, and no word from ${[found, ...lists].filter(Boolean).length} list(s)` : ''}.`)
}
