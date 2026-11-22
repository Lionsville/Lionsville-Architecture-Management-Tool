// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `quickjs.wasm`, published beside the app (ADR-0051).
 *
 * The interpreter an agent's script runs in is WebAssembly shipped inside
 * `node_modules/@jitl/quickjs-wasmfile-release-sync`, and the page loads it
 * by address when the first script arrives (`app/useAgentGateway.ts`). It
 * is published as `libavoid.wasm` is and for the reason that plugin gives:
 * put into `public/` by the build, a warning in `serve` where a fresh clone
 * should still start, and an error in `build`, where an app without it
 * would start, connect an agent and refuse every script.
 *
 * **And the package's own way of finding the file is taken out.** Its loader
 * for a page falls back on `new URL('emscripten-module.wasm',
 * import.meta.url)`, which a bundler reads as an asset to emit: the same
 * half megabyte a second time, under a hashed name, counted by the bundle's
 * budget and never fetched, since the app always says where the file is.
 * The reference is rewritten to the published address, so the file ships
 * once. A package that stops spelling it that way fails the build here,
 * rather than quietly shipping it twice.
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/** Where the page fetches the interpreter from. */
export const QUICKJS_WASM = 'quickjs.wasm'

const PACKAGE = '@jitl/quickjs-wasmfile-release-sync'
const SHIPPED = 'dist/emscripten-module.wasm'
/** The loader a page is given, and the reference in it a bundler would follow. */
const LOADER = /quickjs-wasmfile-release-sync[\\/]dist[\\/]emscripten-module\.browser\.mjs$/
const OWN_REFERENCE = 'new URL("emscripten-module.wasm",import.meta.url)'

/** The loader with its own reference to the file replaced by the published address; nothing where it holds none. */
export function withoutOwnWasm(code: string): string | undefined {
  if (!code.includes(OWN_REFERENCE)) return undefined
  return code.split(OWN_REFERENCE).join(`new URL("/${QUICKJS_WASM}",self.location.href)`)
}

export function quickjsWasm(root: string): Plugin {
  let failOnMissing = false
  return {
    name: 'lv-quickjs-wasm',
    enforce: 'pre',
    config(_config, { command }) {
      failOnMissing = command === 'build'
    },
    buildStart() {
      const source = resolve(root, 'node_modules', PACKAGE, SHIPPED)
      const target = resolve(root, 'public', QUICKJS_WASM)
      try {
        mkdirSync(resolve(root, 'public'), { recursive: true })
        copyFileSync(source, target)
      } catch (cause) {
        const message = `${QUICKJS_WASM} could not be published: ${source} -> ${target}`
        if (failOnMissing) throw new Error(`${message}. Run npm install.`, { cause })
        this.warn(`${message}. An agent's script will be refused.`)
      }
    },
    transform(code, id) {
      if (!LOADER.test(id.split('?')[0])) return undefined
      const rewritten = withoutOwnWasm(code)
      if (rewritten === undefined) {
        const message = `${PACKAGE}'s loader no longer names its file as ${OWN_REFERENCE}: ${QUICKJS_WASM} would ship twice`
        if (failOnMissing) this.error(message)
        this.warn(message)
        return undefined
      }
      return { code: rewritten, map: null }
    },
  }
}
