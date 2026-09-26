// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The registry, loaded by a process that has no browser.
 *
 * `i18n/strings.ts` composes every module's slice, so anything that reaches it
 * reaches `app/strings` and `editor/strings` too — and something does: a process
 * with no screen that wants one sentence in English, a commit message or a
 * diagram's name, gets the whole shell's vocabulary with it. The model stopped
 * reaching it for its own words (`model/words.ts`); a caller outside this tree
 * that wants the registry itself still does, and that is allowed, on one
 * condition — that what it reaches is tables. A slice that imported a helper,
 * or read `navigator` at module scope to name a shortcut, would be that process
 * failing at its first import, somewhere nobody was looking.
 *
 * `eslint.config.js` says it per file (`TRANSLATION_SLICES`); this says it about
 * the graph, and then does it: the walk is what the registry reaches, and the
 * load is the registry evaluated by node from source, every slice with it.
 */
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(import.meta.dirname, '..')
const ROOT = resolve(SRC, '..')
const REGISTRY = resolve(SRC, 'i18n', 'strings.ts')

describe('the string registry', () => {
  it('reaches its own files and the slices, and nothing else', async () => {
    const reached = await imported(REGISTRY)
    const paths = [...reached.keys()].map((file) => relative(SRC, file))

    const strange = paths
      .filter((path) => !/^[a-z0-9]+\/strings\/[a-z]{2}\.ts$/.test(path))
      .filter((path) => !/^i18n\/[A-Za-z.]+\.ts$/.test(path))
    expect(strange).toEqual([])
    expect([...reached.values()].flat()).toEqual([])

    // What it does reach, so an empty walk cannot pass.
    expect(paths).toContain('app/strings/en.ts')
    expect(paths).toContain('editor/strings/de.ts')
    expect(paths.length).toBeGreaterThan(40)
  })

  /**
   * The claim itself, made the way a caller makes it: a top-level `window` in
   * any slice passes the walk above and fails here.
   */
  it('loads from source in a plain node process, every slice with it', () => {
    const said = execFileSync(process.execPath, [
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      '--import', './scripts/tsSpecifiers.mjs',
      '--input-type=module',
      '-e', "const { t } = await import('./src/i18n/strings.ts'); console.log(t('de', 'common.cancel'))",
    ], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    expect(said.trim()).toBe('Abbrechen')
  }, 60_000)
})

/** Where a `from '…'` in this tree resolves to, if anywhere. */
async function fileFor(from: string, specifier: string): Promise<string | undefined> {
  if (!specifier.startsWith('.')) return undefined
  const at = resolve(dirname(from), specifier)
  for (const candidate of [at, `${at}.ts`, `${at}.tsx`, join(at, 'index.ts'), join(at, 'index.tsx')]) {
    if (await readFile(candidate, 'utf8').then(() => true, () => false)) return candidate
  }
  return undefined
}

/**
 * Every file a static import chain from `entry` reaches, and per file what it
 * names from outside this tree. `import type` struck out first, as the compiler
 * strikes it (`agent/pure.test.ts` walks its own graph the same way).
 */
async function imported(entry: string): Promise<Map<string, string[]>> {
  const found = new Map<string, string[]>()
  const queue = [entry]
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
