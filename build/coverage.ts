// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Coverage per module, printed and held to a floor.
 *
 * One number for the whole tree says nothing a reader can act on: 85% overall
 * is compatible with a module of pure arithmetic nobody tests, because the
 * pages are large and well covered. So the tree is cut the way the import
 * matrix cuts it (`MODULES` in `eslint.config.js`) — the model, the layout,
 * the ports, the adapters, the shell and the rest — with the desktop's main
 * process and preload beside them, and each has a floor of its own.
 *
 * **A floor is the measured value, rounded down**, for lines and for branches,
 * the day it was set: the lowest of three runs, rounded down to the whole
 * point, so that a floor fails on a test that went missing and not on a slow
 * machine. It is not a target: it is the level the tree is at, written down so
 * that it can only go up. The floors were set on 26 September 2026, from three
 * runs of Vitest 5, whose v8 coverage maps what ran back onto the source's
 * syntax tree rather than onto lines — a file of strings is one line, not a
 * hundred.
 *
 * `src/ports` is interfaces and nothing else, so it has no lines to count and
 * reads as whole; a port that grew code would be measured like any module.
 * `electron/preload` and `electron/main` are low and that is the honest
 * number: most of what they do is wire Electron's own objects together, and
 * that is asserted by `npm run smoke`, which drives the built app and measures
 * nothing here. Raise a floor when a module's tests grow; lowering one is a
 * decision to say in the commit that does it.
 *
 * A file that belongs to no component fails too, so a new module arrives with
 * a floor rather than without one — the same promise `layering/known-module`
 * makes about its row in the matrix.
 *
 * `npm run check` runs this after the tests, which write the summary it reads
 * (`vitest.config.ts`, `coverage`).
 */
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

export type Metric = { total: number; covered: number }
export type FileSummary = { lines: Metric; branches: Metric }
export type Floor = { lines: number; branches: number }

/**
 * The components and their floors, most specific first: a file belongs to the
 * first whose folder it is under. `platform/node` is a row of the matrix of its
 * own, and so a component of its own, ahead of `platform`.
 */
export const FLOORS: ReadonlyArray<readonly [component: string, floor: Floor]> = [
  ['src/platform/node', { lines: 95, branches: 82 }],
  ['src/model', { lines: 95, branches: 91 }],
  ['src/layout', { lines: 93, branches: 86 }],
  ['src/i18n', { lines: 100, branches: 94 }],
  ['src/platform', { lines: 96, branches: 88 }],
  ['src/widgets', { lines: 95, branches: 91 }],
  ['src/documentation', { lines: 93, branches: 80 }],
  ['src/decisions', { lines: 86, branches: 75 }],
  ['src/observations', { lines: 88, branches: 79 }],
  ['src/roadmap', { lines: 92, branches: 85 }],
  ['src/business', { lines: 93, branches: 88 }],
  ['src/technology', { lines: 90, branches: 82 }],
  ['src/search', { lines: 98, branches: 93 }],
  ['src/projects', { lines: 98, branches: 89 }],
  ['src/editor', { lines: 88, branches: 79 }],
  ['src/agent', { lines: 94, branches: 80 }],
  ['src/ports', { lines: 100, branches: 100 }],
  ['src/adapters', { lines: 88, branches: 81 }],
  ['src/app', { lines: 84, branches: 76 }],
  ['electron/main', { lines: 24, branches: 20 }],
  ['electron/preload', { lines: 14, branches: 100 }],
]

/** Which component a path (relative to the repository root) belongs to. */
export function componentOf(path: string, floors = FLOORS): string | undefined {
  for (const [component] of floors) {
    if (path.startsWith(`${component}/`)) return component
  }
  return undefined
}

const pct = (m: Metric): number => (m.total === 0 ? 100 : (100 * m.covered) / m.total)

export type Row = { component: string; lines: number; branches: number; floor: Floor; below: boolean }

/**
 * The summary, per component, against the floors: the rows, and the files that
 * belong to none. Percentages are to one decimal, and a component is below its
 * floor when either measure is.
 */
export function measure(
  files: Record<string, FileSummary>,
  floors = FLOORS,
): { rows: Row[]; unowned: string[] } {
  const sums = new Map<string, { lines: Metric; branches: Metric }>()
  const unowned: string[] = []
  for (const [path, summary] of Object.entries(files)) {
    const component = componentOf(path, floors)
    if (!component) { unowned.push(path); continue }
    const sum = sums.get(component) ?? { lines: { total: 0, covered: 0 }, branches: { total: 0, covered: 0 } }
    sum.lines.total += summary.lines.total
    sum.lines.covered += summary.lines.covered
    sum.branches.total += summary.branches.total
    sum.branches.covered += summary.branches.covered
    sums.set(component, sum)
  }
  const rows = floors.flatMap(([component, floor]): Row[] => {
    const sum = sums.get(component)
    if (!sum) return []
    const lines = Math.floor(pct(sum.lines) * 10) / 10
    const branches = Math.floor(pct(sum.branches) * 10) / 10
    return [{ component, lines, branches, floor, below: lines < floor.lines || branches < floor.branches }]
  })
  return { rows, unowned }
}

export function table(rows: Row[]): string {
  const cell = (measured: number, floor: number) => `${measured.toFixed(1).padStart(5)}% (≥${String(floor).padStart(3)})`
  const out = [`${'component'.padEnd(20)} ${'lines'.padEnd(13)} ${'branches'.padEnd(13)}`]
  for (const r of rows) {
    out.push(`${r.component.padEnd(20)} ${cell(r.lines, r.floor.lines)} ${cell(r.branches, r.floor.branches)}${r.below ? '  BELOW THE FLOOR' : ''}`)
  }
  return out.join('\n')
}

/** Repository-relative keys, from the absolute ones the summary carries. */
export function relativise(summary: Record<string, FileSummary>, root: string): Record<string, FileSummary> {
  const files: Record<string, FileSummary> = {}
  for (const [path, value] of Object.entries(summary)) {
    if (path === 'total') continue
    files[relative(root, path)] = value
  }
  return files
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = resolve(import.meta.dirname, '..')
  const summaryPath = resolve(root, 'tmp/coverage/coverage-summary.json')
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8')) as Record<string, FileSummary>
  const { rows, unowned } = measure(relativise(summary, root))
  console.log(`\ncoverage, per component (floor in brackets)\n${table(rows)}`)
  let failed = false
  for (const path of unowned) {
    console.error(`${path} belongs to no component: add it to FLOORS in build/coverage.ts, with its measured floor.`)
    failed = true
  }
  for (const r of rows.filter((row) => row.below)) {
    console.error(`${r.component} is below its coverage floor: lines ${r.lines}% (floor ${r.floor.lines}), branches ${r.branches}% (floor ${r.floor.branches}).`)
    failed = true
  }
  if (failed) process.exit(1)
}
