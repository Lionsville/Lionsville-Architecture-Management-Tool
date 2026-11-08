// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The suite runs with style sheets emptied, `?raw` ones too: the bundled rules are read as the build reads them.
beforeEach(() => {
  vi.doMock('./kit/fonts/fonts.css?raw', () => ({ default: readFileSync('src/widgets/kit/fonts/fonts.css', 'utf8') }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('the faces a picture carries', () => {
  it('are the bundled rules with every file in them as data, read once', async () => {
    const fetched = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])))
    vi.stubGlobal('fetch', fetched)
    const { pictureFontCss } = await import('./pictureFonts')
    const css = await pictureFontCss()
    expect(css.match(/@font-face/g)).toHaveLength(4)
    expect(css).toContain('font-family: "Source Sans 3"')
    expect(css).not.toMatch(/url\(\.\//)
    expect(css.match(/url\(data:font\/woff2;base64,AQID\)/g)).toHaveLength(4)
    expect(css).not.toContain('SPDX')
    await pictureFontCss()
    expect(fetched).toHaveBeenCalledTimes(4)
  })

  it('are nothing where a file cannot be read, so the picture is still made', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })))
    const { pictureFontCss } = await import('./pictureFonts')
    expect(await pictureFontCss()).toBe('')
  })
})
