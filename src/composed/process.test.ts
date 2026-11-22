// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface's entries for a process with no screen, loaded by node from
 * source, with no screen anywhere under them.
 *
 * `agent/pure.test.ts` asks this of the agent's four files, which were what a
 * build composed from this one loaded into a plain node process. That build
 * loads the entries under `composed/process/` and `composed/node/` now
 * (ADR-0022, amended), and an entry is a list of names from many files: one
 * name added from a file that draws, or from a barrel that carries a page, and
 * every importer of the entry fails at its first import, far from the line
 * that did it. The matrix refuses the first at the entry; nothing in any one
 * file shows the second. So each entry is walked here, and then loaded.
 *
 * The same three claims, of every entry: nothing it reaches draws, every file
 * it reaches is TypeScript node can erase, and node, given the entry, loads
 * it. The renderer's entries are the page's and the testing entries a suite's;
 * neither is asked.
 */
import { execFileSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(import.meta.dirname, '..')
const ROOT = resolve(SRC, '..')

/** The folders of entries a process with no screen loads. */
const FOLDERS = ['process', 'node']

/** The packages a screen is made of. Any of them, anywhere in a chain, is the bug. */
const DRAWS = [/^react$/, /^react-dom/, /^@mui\//, /^@emotion\//, /^@xyflow\//, /^html-to-image$/]

/** Every entry of those folders, from `src/`. */
async function entries(): Promise<string[]> {
  const found: string[] = []
  for (const folder of FOLDERS) {
    for (const name of await readdir(resolve(SRC, 'composed', folder))) {
      if (name.endsWith('.ts') && !name.endsWith('.test.ts')) found.push(`composed/${folder}/${name}`)
    }
  }
  return found.sort()
}

describe('the surface for a process with no screen', () => {
  it('reaches nothing that draws, from any entry', async () => {
    const all = await entries()
    expect(all).toContain('composed/process/model.ts')
    expect(all).toContain('composed/node/workingFile.ts')

    const wrong: string[] = []
    for (const entry of all) {
      const reached = await imported([resolve(SRC, entry)])
      const paths = [...reached.keys()].map((file) => relative(SRC, file))
      // A page is either in a `ui/` folder or is `.tsx`; in this tree it is both.
      for (const path of paths) {
        if (path.split('/').includes('ui') || path.endsWith('.tsx')) wrong.push(`${entry} reaches ${path}`)
        // The shell and the canvas, even a file of theirs that draws nothing.
        if (path.startsWith('app/') && !path.startsWith('app/strings/')) wrong.push(`${entry} reaches ${path}`)
        if (path.startsWith('editor/') && !path.startsWith('editor/strings/')) wrong.push(`${entry} reaches ${path}`)
      }
      for (const [file, specifiers] of reached) {
        for (const specifier of specifiers) {
          if (DRAWS.some((package_) => package_.test(specifier))) wrong.push(`${entry}: ${relative(SRC, file)} → ${specifier}`)
        }
      }
    }
    expect(wrong).toEqual([])
  })

  it('walks a graph large enough to be what the entries reach', async () => {
    const reached = await imported((await entries()).map((entry) => resolve(SRC, entry)))
    const paths = [...reached.keys()].map((file) => relative(SRC, file))
    expect(paths).toContain('model/reducer.ts')
    expect(paths).toContain('adapters/folder/format/folderFormat.ts')
    expect(paths).toContain('platform/node/workingFile.ts')
    expect(paths.length).toBeGreaterThan(200)
  })

  it('is TypeScript node can erase', async () => {
    const reached = await imported((await entries()).map((entry) => resolve(SRC, entry)))
    const refused: string[] = []
    for (const file of reached.keys()) {
      try {
        stripTypeScriptTypes(await readFile(file, 'utf8'), { mode: 'strip' })
      } catch (error) {
        refused.push(`${relative(SRC, file)}: ${(error as Error).message}`)
      }
    }
    expect(refused).toEqual([])
  })

  /**
   * The whole claim, made the way the caller makes it: a process, and it
   * evaluates every module in every chain. A name re-exported without `type`
   * that is only a type passes the two above and fails here, as does a
   * top-level line that needs a `window`.
   */
  it('loads from source in a plain node process, every entry', async () => {
    const load = (await entries()).map((entry) => `await import('./src/${entry}')`).join(';')
    expect(() => execFileSync(process.execPath, [
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      '--import', './scripts/tsSpecifiers.mjs',
      '--input-type=module',
      '-e', `${load};console.log('loaded')`,
    ], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).not.toThrow()
  }, 60_000)
})

/** Where a `from '…'` in this tree resolves to, if anywhere. */
async function fileFor(from: string, specifier: string): Promise<string | undefined> {
  if (!specifier.startsWith('.')) return undefined
  const at = resolve(dirname(from), specifier)
  for (const candidate of [at, `${at}.ts`, `${at}.tsx`, join(at, 'index.ts'), join(at, 'index.tsx')]) {
    if (await readFile(candidate, 'utf8').then(() => true, () => false)) return candidate
  }
  // A path-looking string that is not a module: a docblock naming a file.
  return undefined
}

/**
 * Every file in this tree a static import chain from `entries` reaches, and per
 * file the specifiers it names that are somebody else's — a package, or `node:`.
 * `import type` and `export type` are struck out first, because the compiler
 * strikes them out too. The walk is `agent/pure.test.ts`'s, which says why a
 * promise about what a chain does not contain is walked rather than read.
 */
async function imported(from: readonly string[]): Promise<Map<string, string[]>> {
  const found = new Map<string, string[]>()
  const queue = [...from]
  while (queue.length > 0) {
    const file = queue.shift()!
    if (found.has(file)) continue
    const outside: string[] = []
    found.set(file, outside)
    const source = (await readFile(file, 'utf8')).replace(/\b(?:import|export)\s+type\b[\s\S]*?from\s+'[^']*'/g, '')
    for (const match of source.matchAll(/from\s+'([^']+)'|^\s*import\s+'([^']+)'/gm)) {
      const specifier = match[1] ?? match[2]
      const next = await fileFor(file, specifier)
      if (next) queue.push(next)
      else if (!specifier.startsWith('.')) outside.push(specifier)
    }
  }
  return found
}
