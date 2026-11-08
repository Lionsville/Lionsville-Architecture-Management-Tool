// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The app draws in two faces, `--font-ui` and `--font-mono`, and they are named
 * in one place (`src/widgets/kit/tokens.ts`, with `fonts/fonts.css` beside it
 * for the files). A family written anywhere else outlives the tokens: one on
 * `#root` in `index.html` drew most of the app in the system's face while the
 * dialogs drew in the tokens', and nobody saw it until the two sat side by side.
 *
 * So a declaration says a token, `inherit`, or a name that holds the token
 * (`SCALE['font-ui']`, the theme's `typography.fontFamily`), and no family's
 * name is written out at all, in a stylesheet, an `sx`, an SVG attribute, a
 * canvas's `font` or a page of HTML.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SOURCE = /\.(tsx?|css|html)$/
const NOT_SHIPPED = /\.(test|spec|contract)\.|\/testing\//
const THE_PLACES = new Set(['src/widgets/kit/tokens.ts', 'src/widgets/kit/fonts/fonts.css'])
const PAGES = ['index.html', 'help/index.html']

/** A family by name: the generic ones and every face this app has ever been drawn in. */
const FAMILY = /(?<![\w-])(system-ui|-apple-system|sans-serif|serif|monospace|ui-monospace|SFMono-Regular|Menlo|Consolas|Monaco|Courier|Georgia|Times|Arial|Helvetica|Roboto|Segoe UI|Source Sans|Source Code)(?![\w-])/g
/** A declaration of a family, in CSS (`font-family:`) or in React (`fontFamily:` / `fontFamily=`). */
const DECLARED = /(?:font-family:\s*|fontFamily(?::\s*|=\{?\s*))([^;,}\n]+)/g
const ALLOWED = /^(['"`]?)(var\(--font-(ui|mono)\)|inherit)\1$|^\$\{FACE$|^\{?(CODE_FONT|FACE|SCALE\[['"]font-(ui|mono)['"]\]|theme\.typography\.fontFamily)(?!\w)/

function sources(under: string, out: string[] = []): string[] {
  for (const name of readdirSync(under)) {
    const path = join(under, name)
    if (statSync(path).isDirectory()) sources(path, out)
    else if (SOURCE.test(name) && !NOT_SHIPPED.test(path)) out.push(path)
  }
  return out
}

/** Comments say why, and may name a face while doing it. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
}

/** Every family named, and every declaration that is not a token, in one file's text. */
export function literalFamilies(text: string): string[] {
  const body = code(text)
  const found = [...body.matchAll(FAMILY)].map((held) => held[1] ?? '')
  for (const held of body.matchAll(DECLARED)) {
    const said = (held[1] ?? '').trim()
    if (!ALLOWED.test(said)) found.push(said)
  }
  return found
}

describe('a font family outside the tokens', () => {
  const root = process.cwd()
  const files = [...sources(join(root, 'src')), ...sources(join(root, 'electron')), ...PAGES.map((page) => join(root, page))]
  const found = files
    .map((path) => ({ file: relative(root, path), families: literalFamilies(readFileSync(path, 'utf8')) }))
    .filter(({ file, families }) => families.length > 0 && !THE_PLACES.has(file))

  it('is found by the rule', () => {
    expect(literalFamilies('html, #root { font-family: system-ui, sans-serif }')).toEqual(['system-ui', 'sans-serif', 'system-ui'])
    expect(literalFamilies("sx={{ fontFamily: 'ui-monospace, Menlo, monospace' }}")).toEqual(['ui-monospace', 'Menlo', 'monospace', "'ui-monospace"])
    expect(literalFamilies('<text fontFamily="Georgia">')).toEqual(['Georgia', '"Georgia">'])
    expect(literalFamilies('ctx.font = `600 ${10 * scale}px sans-serif`')).toEqual(['sans-serif'])
    expect(literalFamilies('.a { font-family: var(--font-ui); } .b { font: 700 12px/18px var(--font-mono); }')).toEqual([])
    expect(literalFamilies("sx={{ fontFamily: 'var(--font-mono)' }} <text fontFamily={SCALE['font-mono']}>")).toEqual([])
    expect(literalFamilies('style={{ fontFamily: theme.typography.fontFamily }} fontFamily="inherit"')).toEqual([])
    expect(literalFamilies('/* the system-ui face */ // and sans-serif\n.a { font: inherit }')).toEqual([])
  })

  it('is nowhere: every face comes from the tokens', () => {
    expect(found.map(({ file, families }) => `${file}: ${families.join(', ')}`)).toEqual([])
  })
})
