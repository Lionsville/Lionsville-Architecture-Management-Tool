#!/usr/bin/env node
/**
 * Put the licence on every source file, once.
 *
 *   node scripts/spdx.mjs          write the headers
 *   node scripts/spdx.mjs --check  say which files are missing one, change nothing
 *
 * A repository-wide LICENSE says what the tree is licensed under; a file that
 * has travelled — into a gist, a bug report, a fork, an answer — says nothing
 * at all unless it carries the line itself. Two comment lines per file is the
 * whole cost, and `eslint.config.js` has a rule that keeps them there, so this
 * script is a one-off for the files that were here before it.
 *
 * What it skips: a file that already has the identifier and a declaration file
 * (`.d.ts`, which declares rather than implements). The fixtures that are data
 * are JSON and were never in scope. A shebang stays the first line — it is the
 * one line that must be.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Where source lives. The rest of the tree is data, config or build output. */
const ROOTS = ['src', 'electron', 'scripts']
const EXTENSIONS = ['.ts', '.tsx', '.mjs', '.cjs']

/** Never source. The data in this tree is JSON and never matches an extension above. */
const SKIP_FOLDERS = new Set(['node_modules', 'dist'])
const skipFile = (path) => path.endsWith('.d.ts')

export const LICENCE = '// SPDX-License-Identifier: AGPL-3.0-only'
export const COPYRIGHT = '// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV'

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return SKIP_FOLDERS.has(entry) ? [] : walk(path)
    if (!EXTENSIONS.some((extension) => path.endsWith(extension))) return []
    return skipFile(path) ? [] : [path]
  })

/** The header as it would be written into this file — after a shebang, if it has one. */
const withHeader = (source) => {
  const lines = source.split('\n')
  const at = lines[0]?.startsWith('#!') ? 1 : 0
  const header = [LICENCE, COPYRIGHT]
  // One blank line between the header and what follows, unless there already is
  // one or the file is empty but for its shebang.
  if (lines[at] !== undefined && lines[at].trim() !== '') header.push('')
  return [...lines.slice(0, at), ...header, ...lines.slice(at)].join('\n')
}

const check = process.argv.includes('--check')
const missing = []

for (const name of ROOTS) {
  for (const path of walk(join(root, name))) {
    const source = readFileSync(path, 'utf8')
    if (source.includes('SPDX-License-Identifier:')) continue
    missing.push(relative(root, path))
    if (!check) writeFileSync(path, withHeader(source))
  }
}

if (missing.length === 0) {
  console.log('Every source file carries its licence.')
} else if (check) {
  console.error(`${missing.length} file(s) without an SPDX header:`)
  for (const path of missing) console.error(`  ${path}`)
  process.exitCode = 1
} else {
  console.log(`Wrote the header into ${missing.length} file(s).`)
}
