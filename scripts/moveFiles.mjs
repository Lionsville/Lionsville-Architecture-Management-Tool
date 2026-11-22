// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Files moved to another folder, with everything that names them by path
 * moved along: one commit that is `git mv` and the rewrites a move forces, and
 * nothing else, so a branch in flight can be rebased onto the commit before it
 * and the same command run again.
 *
 *   node scripts/moveFiles.mjs [--dry] [--sort=<list file>]… <from>=<to>…
 *
 * A rule is a tracked file or a folder, from the root of the repository; the
 * first rule a file matches is the one it follows, so a file that stays behind
 * when its folder goes is said first, as itself (`src/a/keep.ts=src/a/keep.ts`)
 * or with where it goes instead.
 *
 * Three things are rewritten, and no line that needs none of them is touched:
 *
 * - **Relative specifiers.** Every quoted string in a script that resolves,
 *   from the file it is in, to a tracked file — an import, a dynamic import, a
 *   mock, a `new URL` — is worked out again from where both ends are now. Said
 *   by resolution rather than by syntax, so no spelling of an import is missed;
 *   a string that only looks like a path resolves to nothing and is left.
 * - **Paths in the held lists.** A moved file's path from the root, quoted, in
 *   any script; and under `build/`, the same path from `src/`, which is how
 *   the scans there name a file.
 * - **The order of a sorted list**, for each `--sort`: a run of one-entry
 *   lines that a rewrite changed is put back in order.
 *
 * What it does not do is prose. A comment that names a moved file by path is
 * listed at the end, to be read and put right by hand in a commit of its own.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const sorted = args.filter((arg) => arg.startsWith('--sort=')).map((arg) => arg.slice('--sort='.length))
const rules = args.filter((arg) => !arg.startsWith('--')).map((arg) => {
  const [from, to] = arg.split('=')
  if (!from || !to) throw new Error(`Not a rule: ${arg}. Say <from>=<to>.`)
  return { from: from.replace(/\/$/, ''), to: to.replace(/\/$/, '') }
})
if (rules.length === 0) throw new Error('Nothing to move: say <from>=<to>.')

const tracked = git('ls-files').split('\n').filter(Boolean)
const before = new Set(tracked)

/** Where a file goes: by the first rule that names it or a folder it is in. */
function destination(file) {
  for (const { from, to } of rules) {
    if (file === from) return to
    if (file.startsWith(`${from}/`)) return `${to}${file.slice(from.length)}`
  }
  return file
}

const moved = new Map(tracked.map((file) => [file, destination(file)]).filter(([from, to]) => from !== to))
if (moved.size === 0) throw new Error('No tracked file matches a rule.')
const after = new Set(tracked.map((file) => moved.get(file) ?? file))
if (after.size !== tracked.length) throw new Error('Two files would land on one path.')
for (const to of moved.values()) if (before.has(to) && !moved.has(to)) throw new Error(`${to} is already there.`)

const SCRIPT = /\.(?:[cm]?[jt]s|tsx)$/
const SKIPPED = /^(?:build\/drawio\/|public\/|node_modules\/)/
const scripts = tracked.filter((file) => SCRIPT.test(file) && !SKIPPED.test(file))

/** The endings a bundler tries, in its order: what a specifier leaves unsaid. */
const ENDINGS = ['', '.ts', '.tsx', '.d.ts', '/index.ts', '/index.tsx']

/** The tracked file a specifier written in `file` meant before the move, and the ending it left unsaid. */
function resolved(file, specifier) {
  const [path, query = ''] = specifier.split(/(?=\?)/)
  const base = posix.normalize(posix.join(posix.dirname(file), path))
  for (const ending of ENDINGS) {
    if (before.has(`${base}${ending}`)) return { target: `${base}${ending}`, ending, query }
  }
  return undefined
}

/** `to` as `from` would write it: relative, with a leading dot, without the ending it never said. */
function specifierTo(from, to, ending) {
  const bare = ending && to.endsWith(ending) ? to.slice(0, -ending.length) : to
  const path = posix.relative(posix.dirname(from), bare) || '.'
  return path.startsWith('.') ? path : `./${path}`
}

const QUOTED_RELATIVE = /(['"])(\.{1,2}(?:\/[^'"\n\\]*)?)\1/g

function withSpecifiers(file, text, said) {
  const here = moved.get(file) ?? file
  return text.replace(QUOTED_RELATIVE, (whole, quote, specifier) => {
    const found = resolved(file, specifier)
    if (!found) return whole
    const target = moved.get(found.target) ?? found.target
    if (here === file && target === found.target) return whole
    const next = `${specifierTo(here, target, found.ending)}${found.query}`
    if (next === specifier) return whole
    said.specifiers += 1
    return `${quote}${next}${quote}`
  })
}

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A moved file's path, quoted, wherever a script holds it in a list; under `build/` from `src/` too. */
function withPaths(file, text, said) {
  let next = text
  for (const [from, to] of moved) {
    const forms = [[from, to]]
    if (file.startsWith('build/') && from.startsWith('src/') && to.startsWith('src/')) forms.push([from.slice(4), to.slice(4)])
    for (const [was, is] of forms) {
      if (!next.includes(was)) continue
      next = next.replace(new RegExp(`(['"\`])${escaped(was)}\\1`, 'g'), (_, quote) => {
        said.paths += 1
        return `${quote}${is}${quote}`
      })
    }
  }
  return next
}

const ENTRY = /^\s*(['"])([^'"]+)\1\s*[:,]/

/** Each run of one-entry lines that changed, back in the order `sort()` gives its keys. */
function inOrder(was, text) {
  const old = new Set(was.split('\n'))
  const lines = text.split('\n')
  for (let start = 0; start < lines.length; start += 1) {
    if (!ENTRY.test(lines[start])) continue
    let end = start
    while (end + 1 < lines.length && ENTRY.test(lines[end + 1])) end += 1
    const run = lines.slice(start, end + 1)
    if (run.some((line) => !old.has(line))) {
      const key = (line) => ENTRY.exec(line)[2]
      run.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
      lines.splice(start, run.length, ...run)
    }
    start = end
  }
  return lines.join('\n')
}

const said = { specifiers: 0, paths: 0, files: 0 }
const rewritten = new Map()
for (const file of scripts) {
  const text = readFileSync(join(root, file), 'utf8')
  let next = withPaths(file, withSpecifiers(file, text, said), said)
  if (sorted.includes(file)) next = inOrder(text, next)
  if (next !== text) rewritten.set(file, next)
}
said.files = rewritten.size

if (!dry) {
  for (const [from, to] of moved) {
    mkdirSync(join(root, dirname(to)), { recursive: true })
    git('mv', from, to)
  }
  for (const [file, text] of rewritten) writeFileSync(join(root, moved.get(file) ?? file), text)
}

/** What still names a moved file by its old path, in words: a comment, a document. */
const mentions = []
const TEXT = /\.(?:[cm]?[jt]s|tsx|md|json|ya?ml|html|css)$/
for (const file of tracked.filter((one) => TEXT.test(one) && !SKIPPED.test(one))) {
  const text = rewritten.get(file) ?? readFileSync(join(root, dry ? file : moved.get(file) ?? file), 'utf8')
  const lines = text.split('\n')
  for (const from of moved.keys()) {
    const bare = from.replace(/^src\//, '').replace(/(?:\.d)?\.[a-z]+$/, '')
    if (!text.includes(bare)) continue
    const word = new RegExp(`(^|[^\\w/.-])(?:src/)?${escaped(bare)}(?![\\w/-])`)
    lines.forEach((line, at) => { if (word.test(line)) mentions.push(`${moved.get(file) ?? file}:${at + 1}: ${bare}`) })
  }
}

console.log(`${dry ? 'Would move' : 'Moved'} ${moved.size} files; ${said.specifiers} specifiers and ${said.paths} listed paths rewritten in ${said.files} files.`)
if (dry) for (const [from, to] of moved) console.log(`  ${from} -> ${to}`)
if (mentions.length > 0) {
  console.log(`\nStill named by the old path, in words (${mentions.length}); read each and put it right by hand:`)
  for (const mention of [...new Set(mentions)].sort()) console.log(`  ${mention}`)
}
