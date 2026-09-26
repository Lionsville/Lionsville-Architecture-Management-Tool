// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The budget the web build fails over, and the one ELK it ships.
 *
 * The arithmetic is asserted on made-up bundles; what is asserted about the
 * real one is that both builds carry the two plugins, since a budget one
 * config forgot is no budget. The size itself is measured by `npm run build`,
 * which prints it and fails over it.
 */
import { describe, expect, it } from 'vitest'
import type { Plugin, PluginOption } from 'vite'
import { ELK_ENGINE_MARK, overBudget, summary, WEB_BUDGET, type Output } from './bundleBudget'
import { ELK_BUNDLE, oneElk } from './oneElk'

const out = (name: string, bytes: number, text = ''): Output => ({ name, bytes, text })

describe('the bundle budget', () => {
  it('passes a bundle within it', () => {
    expect(overBudget([out('index.js', 100), out('worker.js', 50, ELK_ENGINE_MARK)], { file: 100, total: 150 })).toEqual([])
  })

  it('names a file over the ceiling a file may be', () => {
    expect(overBudget([out('index.js', 101)], { file: 100, total: 1000 })).toEqual([
      expect.stringMatching(/^index\.js is .* over the .* a file may be\.$/),
    ])
  })

  it('fails a bundle over its whole even when every file is within its own', () => {
    expect(overBudget([out('a.js', 90), out('b.js', 90)], { file: 100, total: 150 }))
      .toEqual([expect.stringMatching(/^The bundle is/)])
  })

  /** The regression this exists for: the worker's engine and the bundled one, side by side. */
  it('fails a bundle with ELK\'s engine in it twice, and names both files', () => {
    const said = overBudget([
      out('elk-worker.min.js', 10, `…${ELK_ENGINE_MARK}…`),
      out('elk.bundled.js', 10, `…${ELK_ENGINE_MARK}…`),
      out('elk-api.js', 5, 'new Worker'),
    ], { file: 100, total: 100 })
    expect(said).toEqual([expect.stringContaining('elk-worker.min.js, elk.bundled.js')])
  })

  it('says the whole and the largest in one line', () => {
    expect(summary([out('a.js', 2_000), out('b.js', 500)], { file: 3_000, total: 9_000 }))
      .toBe('bundle: 3 kB in 2 files (budget 9 kB); largest a.js 2 kB (budget 3 kB)')
  })

  it('is a budget and not a formality: under ten megabytes, and no file over three', () => {
    expect(WEB_BUDGET.total).toBeLessThan(10_000_000)
    expect(WEB_BUDGET.file).toBeLessThan(3_000_000)
  })
})

describe('one ELK', () => {
  const plugin = oneElk('/repo')
  const resolveId = plugin.resolveId as (source: string, importer?: string) => string | null

  it('answers the self-contained bundle with the worker-backed engine', () => {
    expect(resolveId(ELK_BUNDLE, '/repo/node_modules/mermaid/dist/elk.mjs')).toBe('/repo/src/app/elkInWorker.ts')
    expect(resolveId(ELK_BUNDLE, '/repo/src/layout/elkLayout.ts')).toBe('/repo/src/app/elkInWorker.ts')
  })

  it('leaves the API, the worker and everything else to Vite', () => {
    expect(resolveId('elkjs/lib/elk-api.js')).toBeNull()
    expect(resolveId('elkjs/lib/elk-worker.min.js?worker')).toBeNull()
    expect(resolveId('mermaid')).toBeNull()
  })
})

describe('both builds', () => {
  const names = (plugins: PluginOption[] | undefined): string[] =>
    (plugins ?? []).flat(Infinity as 1).filter((one): one is Plugin => !!one && typeof one === 'object' && 'name' in one)
      .map((one) => one.name)

  it('carry the budget and the one engine, the web build and the desktop renderer alike', async () => {
    const web = (await import('../vite.config')).default as { plugins?: PluginOption[] }
    const desktop = (await import('../electron.vite.config')).default as { renderer?: { plugins?: PluginOption[] } }
    for (const plugins of [web.plugins, desktop.renderer?.plugins]) {
      expect(names(plugins)).toEqual(expect.arrayContaining(['lv-one-elk', 'lv-bundle-budget']))
    }
  })
})
