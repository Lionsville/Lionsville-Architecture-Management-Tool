// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every JSON import node can reach from `platform/node/` says it is one
 * (`jsonImports.ts`): the tree as it stands, and the reading on a few lines.
 */
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { importsMade, jsonImportsFromNode } from './jsonImports'

const root = fileURLToPath(new URL('..', import.meta.url))

describe('JSON modules node can reach', { timeout: 60_000 }, () => {
  const found = jsonImportsFromNode(root)

  it('each say they are JSON', () => {
    expect(found.unsaid).toEqual([])
  })

  it('are read through the examples a server seeds from, so the walk reaches past the seam', () => {
    expect(found.reached).toContain('src/adapters/folder/format/shippedExamples.ts')
    expect(found.json).toContain('src/adapters/folder/format/shippedExamples.ts: ./examples/acme-logistics.json')
  })
})

describe('what a file imports, and what it says of it', () => {
  it('reads a static import, a re-export and a dynamic one, with and without the attribute', () => {
    const text = [
      "import a from './a.json' with { type: 'json' }",
      "import b from './b.json'",
      "export { c } from './c'",
      "const d = () => import('./d.json', { with: { type: 'json' } })",
      "const e = () => import('./e.json')",
    ].join('\n')
    expect(importsMade('x.ts', text)).toEqual([
      { specifier: './a.json', saysJson: true },
      { specifier: './b.json', saysJson: false },
      { specifier: './c', saysJson: false },
      { specifier: './d.json', saysJson: true },
      { specifier: './e.json', saysJson: false },
    ])
  })
})
