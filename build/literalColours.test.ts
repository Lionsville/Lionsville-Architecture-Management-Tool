// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A colour is written in one place, `src/widgets/kit/tokens.ts` (ADR-0045).
 *
 * The files below held a literal when the tokens arrived, each at the count it
 * had. A new file holds none, and an old one may only come down: a ceiling, not a
 * tally, so a screen that drops a literal does not have to come here to say so.
 * Taking an entry off is the point; raising one is a decision said in the commit.
 *
 * What stays here is not all debt. A colour somebody picks has a default written
 * as data (the agent's tools, `ColorField`), a picture's title block is drawn on
 * a canvas with no theme (`exportPng`), and a window's ground is set before any
 * page exists (`electron/main/index.ts`), in either theme.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const CEILING: Record<string, number> = {
  'electron/main/index.ts': 2,
  'src/agent/tools.ts': 3,
  'src/agent/write/canvas.ts': 1,
  'src/agent/write/connections.ts': 1,
  'src/agent/write/elements.ts': 1,
  'src/documentation/ui/Pictures.tsx': 1,
  'src/editor/ColorField.tsx': 1,
  'src/editor/export/ExportDialog.tsx': 2,
  'src/editor/export/exportPng.ts': 7,
  'src/editor/props.ts': 1,
  'src/editor/theme/categoryColors.ts': 4,
  'src/editor/theme/overlayColors.ts': 8,
  'src/widgets/icons.tsx': 2,
}

const SOURCE = /\.(tsx?|css)$/
const NOT_SHIPPED = /\.(test|spec|contract)\.|\/testing\//
const THE_ONE_PLACE = 'src/widgets/kit/tokens.ts'

/** A hex colour in any of its lengths, or a colour function. A `#` after a word, `/` or `&` is an address or an entity. */
const LITERAL = /(?<![\w&/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?|oklch)\(/g

const root = join(__dirname, '..')

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return SOURCE.test(name) ? [relative(root, path)] : []
  })
}

function literals(): Record<string, number> {
  const files = [...sources(join(root, 'src')), ...sources(join(root, 'electron'))]
    .filter((path) => !NOT_SHIPPED.test(path) && path !== THE_ONE_PLACE)
  return Object.fromEntries(files
    .map((path) => [path, readFileSync(join(root, path), 'utf8').match(LITERAL)?.length ?? 0] as const)
    .filter(([, count]) => count > 0))
}

describe('literal colours', () => {
  it('holds every file to the ceiling it had, and a new file to none', () => {
    const over = Object.entries(literals())
      .filter(([path, count]) => count > (CEILING[path] ?? 0))
      .map(([path, count]) => `${path}: ${count}, at most ${CEILING[path] ?? 0}. A colour is a token (src/widgets/kit/tokens.ts)`)
    expect(over).toEqual([])
  })

  it('reads a colour, and not an address or an entity', () => {
    const found = (text: string) => text.match(LITERAL)?.length ?? 0
    expect(found("color: '#015d74'")).toBe(1)
    expect(found("'#fff'")).toBe(1)
    expect(found('rgb(0 0 0 / .5)')).toBe(1)
    expect(found('oklch(0.5 0.1 200)')).toBe(1)
    expect(found("'#/-/home'")).toBe(0)
    expect(found('https://example.org/page#add')).toBe(0)
    expect(found('&#123;')).toBe(0)
  })
})
