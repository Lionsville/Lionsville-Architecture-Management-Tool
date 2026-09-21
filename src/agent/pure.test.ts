/**
 * The agent module, loaded by node from source, with no screen anywhere under it.
 *
 * `electron/main/mcp.ts` imports `handle.ts`, `tools.ts` and `driving.ts` into
 * the main process, and a build composed from this one imports the same three
 * into a plain node process. Neither has a DOM, neither has a bundler, and
 * neither wants React: the agent is the module that exists for a client that is
 * not a person (ADR-0007), so the cost of it having quietly grown a canvas is a
 * process that fails at its first import rather than a page that looks wrong.
 *
 * Two things have to hold, and neither is visible in any one file:
 *
 *   - **Nothing it reaches draws.** The matrix in `eslint.config.js` stops
 *     `agent/` naming a `ui/` file, but a *barrel* is not a `ui/` file: one
 *     `from '../business'` is React, MUI and three dialogs, because the barrel
 *     re-exports `business/ui/SheetPage.tsx` for the screens that want it. That
 *     is how it got in. So the graph is walked here rather than reasoned about,
 *     the way `projects/commitMessage.test.ts` walks its own.
 *   - **Node can erase its types.** `--experimental-strip-types` blanks types
 *     out where they stand; it does not compile. So the three pieces of
 *     TypeScript that are more than a type — a parameter property, an `enum`, a
 *     `namespace` — are refused outright, and a `constructor(private x)` that
 *     nobody would look twice at in review is a module node will not load.
 *
 * And then the two together, which is the claim that matters: node, given these
 * four entries, loads them. `scripts/tsSpecifiers.mjs` is the one thing it needs
 * besides the flag, and says why.
 */
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(import.meta.dirname, '..')
const ROOT = resolve(SRC, '..')

/** What a process that wants the agent and nothing else imports. */
const ENTRIES = ['handle.ts', 'tools.ts', 'driving.ts', 'mcpProtocol.ts']

/** The packages a screen is made of. Any of them, anywhere in the chain, is the bug. */
const DRAWS = [/^react$/, /^react-dom/, /^@mui\//, /^@emotion\//, /^@xyflow\//, /^html-to-image$/]

describe('the agent in a node process', () => {
  it('reaches nothing that draws', async () => {
    const reached = await imported(ENTRIES.map((entry) => resolve(SRC, 'agent', entry)))
    const paths = [...reached.keys()].map((file) => relative(SRC, file))

    // A page is either in a `ui/` folder or is `.tsx`; in this tree it is both,
    // and both are asserted so a screen-shaped file put somewhere new is caught.
    expect(paths.filter((path) => path.split('/').includes('ui'))).toEqual([])
    expect(paths.filter((path) => path.endsWith('.tsx'))).toEqual([])

    // What it does reach, so the test fails loudly if the walk stops working
    // rather than passing on an empty graph.
    expect(paths).toContain('agent/commandFor.ts')
    expect(paths).toContain('business/grid.ts')
    expect(paths.length).toBeGreaterThan(50)

    const drawn = [...reached].flatMap(([file, specifiers]) => specifiers
      .filter((specifier) => DRAWS.some((package_) => package_.test(specifier)))
      .map((specifier) => `${relative(SRC, file)} → ${specifier}`))
    expect(drawn).toEqual([])
  })

  it('is TypeScript node can erase', async () => {
    const reached = await imported(ENTRIES.map((entry) => resolve(SRC, 'agent', entry)))
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
   * The whole claim, made the way the caller makes it. Slower than the two above
   * — it is a process, and it evaluates every module in the chain — which is
   * also the point: a top-level line that needs a `window` passes both of the
   * others and fails here.
   */
  it('loads from source in a plain node process', () => {
    const load = ENTRIES.map((entry) => `await import('./src/agent/${entry}')`).join(';')
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
 *
 * `import type` is struck out first, because the compiler strikes it out too: a
 * type crossing a boundary costs nothing at run time, which is the whole reason
 * a module with no screen may name a screen's shapes. The technique is
 * `projects/commitMessage.test.ts`'s, which walks its own graph for the same
 * reason — a promise about what a chain does not contain is not readable in any
 * one of the files that make it.
 */
async function imported(entries: readonly string[]): Promise<Map<string, string[]>> {
  const found = new Map<string, string[]>()
  const queue = [...entries]
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
