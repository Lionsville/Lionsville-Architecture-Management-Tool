// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The arithmetic `check`'s coverage gate stands on: which module a file is,
 * what a module measures, and that one below its floor is said.
 */
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FLOORS, componentOf, measure, relativise, table, type FileSummary } from './coverage'

const file = (lines: [number, number], branches: [number, number]): FileSummary => ({
  lines: { total: lines[0], covered: lines[1] },
  branches: { total: branches[0], covered: branches[1] },
})

describe('coverage per module', () => {
  it('puts a file in its module, and a file under platform/node in that row rather than in platform', () => {
    expect(componentOf('src/model/reducer.ts')).toBe('src/model')
    expect(componentOf('src/editor/canvas/useMenuActions.ts')).toBe('src/editor')
    expect(componentOf('src/platform/node/git.ts')).toBe('src/platform/node')
    expect(componentOf('src/platform/errors.ts')).toBe('src/platform')
    expect(componentOf('electron/main/files.ts')).toBe('electron/main')
  })

  it('leaves a file in a folder nobody has given a floor unowned, so the gate can refuse it', () => {
    expect(componentOf('src/stray/one.ts')).toBeUndefined()
    const { unowned } = measure({ 'src/stray/one.ts': file([10, 10], [2, 2]) })
    expect(unowned).toEqual(['src/stray/one.ts'])
  })

  it('sums a module over its files rather than averaging their percentages', () => {
    const floors = [['src/layout', { lines: 0, branches: 0 }]] as const
    const { rows } = measure({
      'src/layout/a.ts': file([100, 100], [10, 10]),
      'src/layout/b.ts': file([300, 150], [30, 0]),
    }, floors)
    expect(rows).toEqual([expect.objectContaining({ component: 'src/layout', lines: 62.5, branches: 25, below: false })])
  })

  it('marks a module below its floor on either measure, and says so in the table', () => {
    const floors = [
      ['src/model', { lines: 90, branches: 50 }],
      ['src/agent', { lines: 50, branches: 90 }],
    ] as const
    const { rows } = measure({
      'src/model/m.ts': file([100, 89], [10, 9]),
      'src/agent/a.ts': file([100, 100], [10, 8]),
    }, floors)
    expect(rows.map((r) => [r.component, r.below])).toEqual([['src/model', true], ['src/agent', true]])
    expect(table(rows)).toMatch(/src\/model.*BELOW THE FLOOR/)
  })

  it('reads a module with nothing to count, the ports, as whole rather than as nought', () => {
    const floors = [['src/ports', { lines: 100, branches: 100 }]] as const
    const { rows } = measure({ 'src/ports/ScopeStore.ts': file([0, 0], [0, 0]) }, floors)
    expect(rows).toEqual([expect.objectContaining({ lines: 100, branches: 100, below: false })])
  })

  it('reads the summary vitest writes: absolute paths, and a total that is not a file', () => {
    const files = relativise({
      total: file([1, 1], [1, 1]),
      '/repo/src/model/keys.ts': file([4, 4], [0, 0]),
    }, '/repo')
    expect(Object.keys(files)).toEqual(['src/model/keys.ts'])
  })

  /** The matrix is the list of modules; a folder under src/ with no floor would be measured as nobody's. */
  it('has a floor for every folder under src/ and electron/, most specific first', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const folders = (under: string) => readdirSync(`${root}/${under}`, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${under}/${entry.name}`)
    const named = FLOORS.map(([component]) => component)
    for (const folder of [...folders('src'), ...folders('electron'), 'src/platform/node']) {
      expect(named, folder).toContain(folder)
    }
    expect(named.indexOf('src/platform/node')).toBeLessThan(named.indexOf('src/platform'))
  })
})
