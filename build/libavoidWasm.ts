/**
 * `libavoid.wasm`, published beside the app.
 *
 * The edge router is WebAssembly shipped inside `node_modules/libavoid-js`, and
 * the app loads it by URL at runtime. `public/` is gitignored, so the file has
 * to be put there by the build — it used to happen as a side effect at config
 * load time, wrapped in an empty `catch`. That is survivable on a dev server
 * (you notice immediately) and quietly wrong in a packaged desktop app: without
 * the wasm the router falls back to straight lines, so the build succeeds, the
 * app starts, and only the drawings are wrong.
 *
 * Hence a real plugin with two moods. In `serve` a missing wasm is a warning —
 * the fallback route is a working editor and a fresh clone should not fail to
 * start over it. In `build` it throws: an installer is made once and copied
 * everywhere, and nobody re-checks the routing of a shipped app.
 *
 * The name stays unhashed on purpose. `libavoid-js` is LGPL-2.1, which asks that
 * the library be replaceable; a self-built `libavoid.wasm` dropped in this spot
 * is picked up by the app as it stands.
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

export function libavoidWasm(root: string): Plugin {
  let failOnMissing = false
  return {
    name: 'ns-libavoid-wasm',
    // `apply` cannot express "both, but differently", so the mode is read here.
    config(_config, { command }) {
      failOnMissing = command === 'build'
    },
    buildStart() {
      const source = resolve(root, 'node_modules/libavoid-js/dist/libavoid.wasm')
      const target = resolve(root, 'public/libavoid.wasm')
      try {
        mkdirSync(resolve(root, 'public'), { recursive: true })
        copyFileSync(source, target)
      } catch (cause) {
        const message = `libavoid.wasm could not be published: ${source} -> ${target}`
        if (failOnMissing) throw new Error(`${message}. Run npm install.`, { cause })
        this.warn(`${message}. Routing falls back to straight lines.`)
      }
    },
  }
}
