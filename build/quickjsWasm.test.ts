// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The interpreter's file ships once: the installed package's loader still
 * names its own copy the way the plugin takes out, and the file the plugin
 * publishes is there to publish.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { QUICKJS_WASM, withoutOwnWasm } from './quickjsWasm'

const PACKAGE = resolve(import.meta.dirname, '../node_modules/@jitl/quickjs-wasmfile-release-sync')

describe('quickjs.wasm, published beside the app', () => {
  it('is in the installed package, and is WebAssembly', () => {
    const file = resolve(PACKAGE, 'dist/emscripten-module.wasm')
    expect(existsSync(file)).toBe(true)
    expect([...readFileSync(file).subarray(0, 4)]).toEqual([0x00, 0x61, 0x73, 0x6d])
  })

  it('takes the package\'s own reference to the file out of the loader a page is given', () => {
    const loader = readFileSync(resolve(PACKAGE, 'dist/emscripten-module.browser.mjs'), 'utf8')
    const rewritten = withoutOwnWasm(loader)
    expect(rewritten).toBeDefined()
    expect(rewritten).not.toContain('emscripten-module.wasm",import.meta.url')
    expect(rewritten).toContain(`new URL("/${QUICKJS_WASM}",self.location.href)`)
    // A loader that names it another way is said, not passed.
    expect(withoutOwnWasm('export default 1')).toBeUndefined()
  })
})
