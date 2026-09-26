// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One ELK engine in the build, not two.
 *
 * `elkjs/lib/elk.bundled.js` is the engine and its API in one file, run on the
 * calling thread; the app already ships the engine as a worker (`main.tsx`),
 * and anything that imported the bundle — the layout's fallback, mermaid's
 * ELK renderer — added the same 1.4 MB again. This answers that import with
 * `src/app/elkInWorker.ts`, the same API over the worker the app ships
 * anyway. `build/bundleBudget.ts` counts the engines in the output, so a
 * third way in is a failed build rather than a quiet megabyte.
 *
 * A plugin rather than an alias so the two configs (`vite.config.ts`,
 * `electron.vite.config.ts`) cannot disagree about it, and `pre` so it is
 * asked before Vite resolves the package itself. The dev server's
 * pre-bundling of mermaid does not go through it, and need not: a budget is
 * about what is shipped.
 */
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

export const ELK_BUNDLE = 'elkjs/lib/elk.bundled.js'

export function oneElk(root: string): Plugin {
  const engine = resolve(root, 'src/app/elkInWorker.ts')
  return {
    name: 'lv-one-elk',
    enforce: 'pre',
    resolveId(source, importer) {
      // The shim itself asks for the API and the worker, never the bundle; the
      // check is only there so a change to it cannot loop.
      if (source !== ELK_BUNDLE || importer === engine) return null
      return engine
    },
  }
}
