// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { ScopeSummary } from '../../projects/scope'
import { scopeLines, startsWords, viewLines } from './paletteFind'

const summary = (path: string, name: string, children: ScopeSummary[] = []): ScopeSummary => ({ path, name, diagrams: 0, children })
const TREE = summary('', 'Org', [summary('a', 'Shared platforms', [summary('a/b', 'Platform landscape')]), summary('c', 'Retail')])

describe('what ⌘K finds by name', () => {
  it('a scope, with the scopes above it as its hint, opening its home', () => {
    const opened: unknown[] = []
    const lines = scopeLines(TREE, 'landscape', 'Scopes', (to) => opened.push(to))
    expect(lines.map((line) => [line.label, line.hint, line.lead])).toEqual([['Platform landscape', 'Org › Shared platforms', true]])
    lines[0].run()
    expect(opened).toEqual([{ scope: 'a/b', page: 'home' }])
    expect(scopeLines(TREE, '  ', 'Scopes', () => {})).toEqual([])
  })

  it('a view of any scope, with its scope as the hint, opening where it is drawn', () => {
    const opened: unknown[] = []
    const lines = viewLines([{ scope: 'c', id: 'v1', name: 'Landscape in 2027', kind: 'layer7' }], TREE, 'landsc', 'Views', (to) => opened.push(to))
    expect(lines.map((line) => [line.id, line.hint])).toEqual([['view:v1', 'Retail']])
    lines[0].run()
    expect(opened).toEqual([{ scope: 'c', page: 'board', id: 'v1' }])
  })

  it('leads with a name that starts with the words, not one that only holds them', () => {
    expect(startsWords('light', 'Theme: Light')).toBe(true)
    expect(startsWords('ight', 'Theme: Light')).toBe(false)
    expect(startsWords('th li', 'Theme: Light')).toBe(true)
    expect(startsWords('', 'Theme: Light')).toBe(false)
  })
})
