// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Whether a built output is older than what it was built from.
 *
 * A smoke run that launches `out/` from an hour ago passes or fails a program
 * nobody is about to ship: the one before the change under test. `npm run
 * smoke` builds first and cannot hit that; `npm run smoke:run` on its own, or
 * anything that reuses a build to save a minute, can. So a run that is handed
 * a build asks this first, and refuses one that is stale rather than testing it.
 *
 * Stale means a source file changed after the output's oldest file was
 * written — the build's start, near enough, since a build empties its folder
 * and writes everything. Timestamps and not hashes: a checkout, a pull and an
 * edit all move a file's time, and a build is only fresh if it came after all
 * three.
 *
 *   node build/fresh.ts <output> <source>...    exit 1, naming the newest source, when stale
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** The oldest and newest modification time under a path, and the newest file. */
function span(path: string, skip: ReadonlySet<string>): { oldest: number; newest: number; newestFile?: string } {
  let oldest = Number.POSITIVE_INFINITY
  let newest = Number.NEGATIVE_INFINITY
  let newestFile: string | undefined
  const visit = (at: string) => {
    const stat = statSync(at, { throwIfNoEntry: false })
    if (!stat) return
    if (stat.isDirectory()) {
      for (const entry of readdirSync(at)) if (!skip.has(entry)) visit(join(at, entry))
      return
    }
    if (stat.mtimeMs < oldest) oldest = stat.mtimeMs
    if (stat.mtimeMs > newest) {
      newest = stat.mtimeMs
      newestFile = at
    }
  }
  visit(path)
  return { oldest, newest, newestFile }
}

const SKIP = new Set(['node_modules', '.git', 'dist', 'out', 'coverage'])

/**
 * Why `output` cannot be trusted as a build of `sources`, or `undefined` when it
 * can: it is missing, or a source is newer than it.
 */
export function staleness(output: string, sources: readonly string[]): string | undefined {
  const built = span(output, new Set())
  if (!Number.isFinite(built.oldest)) return `${output} is not built.`
  let newest = Number.NEGATIVE_INFINITY
  let newestFile: string | undefined
  for (const source of sources) {
    const one = span(source, SKIP)
    if (one.newest > newest) {
      newest = one.newest
      newestFile = one.newestFile
    }
  }
  if (newest > built.oldest) {
    const minutes = Math.max(1, Math.round((newest - built.oldest) / 60_000))
    return `${output} is older than ${newestFile} (by ${minutes} min); build it again.`
  }
  return undefined
}

// `node build/fresh.ts <output> <source>...`
if (process.argv[1]?.endsWith('fresh.ts')) {
  const [output, ...sources] = process.argv.slice(2)
  if (!output || sources.length === 0) {
    console.error('usage: node build/fresh.ts <output> <source>...')
    process.exit(2)
  }
  const stale = staleness(output, sources)
  if (stale) {
    console.error(`fresh: ${stale}`)
    process.exit(1)
  }
}
