// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A shortcut reads the platform's command key, ⌘ on a Mac and Ctrl elsewhere,
 * through the kit (`src/widgets/kit/keys.ts`). A check that takes either one,
 * `metaKey || ctrlKey`, is how Ctrl+K — kill to the end of the line in every
 * text field on a Mac — came to open the search. Where a handler means *any*
 * chord held, the kit says that too (`chordHeld`), so the check written out is
 * never needed anywhere else.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SOURCE = /\.(tsx?)$/
const NOT_SHIPPED = /\.(test|spec|contract)\.|\/testing\//
const THE_ONE_PLACE = 'src/widgets/kit/keys.ts'

function sources(under: string, out: string[] = []): string[] {
  for (const name of readdirSync(under)) {
    const path = join(under, name)
    if (statSync(path).isDirectory()) sources(path, out)
    else if (SOURCE.test(name) && !NOT_SHIPPED.test(path)) out.push(path)
  }
  return out
}

/** The lines that read both modifiers as one. */
export function eitherModifier(text: string): string[] {
  return text.split('\n').filter((line) => /metaKey\s*\|\|\s*[\w.?]*ctrlKey|ctrlKey\s*\|\|\s*[\w.?]*metaKey/.test(line)).map((line) => line.trim())
}

describe('a modifier check outside the kit', () => {
  const root = process.cwd()
  const found = ['src', 'electron']
    .flatMap((top) => sources(join(root, top)))
    .map((path) => ({ file: relative(root, path), lines: eitherModifier(readFileSync(path, 'utf8')) }))
    .filter(({ file, lines }) => lines.length > 0 && file !== THE_ONE_PLACE)

  it('is found by the rule', () => {
    expect(eitherModifier('if ((event.metaKey || event.ctrlKey) && key === "k")')).toHaveLength(1)
    expect(eitherModifier('if (event.ctrlKey || event.metaKey) return')).toHaveLength(1)
    expect(eitherModifier('const mod = e.metaKey||e.ctrlKey')).toHaveLength(1)
    expect(eitherModifier('if (commandKey(event)) return')).toEqual([])
    expect(eitherModifier('if (event.shiftKey || event.metaKey) return')).toEqual([])
  })

  it('is nowhere: every shortcut asks the kit', () => {
    expect(found.map(({ file, lines }) => `${file}: ${lines.join(' | ')}`)).toEqual([])
  })
})
