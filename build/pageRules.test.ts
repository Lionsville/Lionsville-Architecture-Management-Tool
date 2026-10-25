// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One way every page behaves (ADR-0044), read off the source: a rule a page
 * gets from the widgets it is made of only holds while every page is made of
 * them, and a page written next is the one that forgets. So every page —
 * every file that draws a `PageDialog` — opens under the host's bar and has
 * its × (§1, §2), and every page with a column beside another lets it be
 * dragged wider and keeps the width (§4).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = fileURLToPath(new URL('../src', import.meta.url))

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.') ? [path] : []
  })
}

const read = (file: string) => readFileSync(join(src, file), 'utf8')

/** Every page, by its file under `src`; the widgets that draw the frame itself are not pages. */
const PAGES = sources(src).map((file) => file.slice(src.length + 1))
  .filter((file) => !['widgets/PageDialog.tsx', 'widgets/Arriving.tsx'].includes(file))
  .filter((file) => read(file).includes('<PageDialog'))

/** Where a page's bar is drawn by a part of its own, in another file. */
const BAR_IN = { 'decisions/ui/AdrPage.tsx': 'decisions/ui/AdrPageParts.tsx' } as Record<string, string>

/** The pages with a column beside another (§4), and how many seams each has. */
const SEAMS: Record<string, number> = {
  'app/history/HistoryPage.tsx': 1,
  'decisions/ui/AdrPage.tsx': 2,
  'operating/ui/OperatingModelPage.tsx': 1,
  'roadmap/ui/RoadmapPage.tsx': 1,
  'people/ui/PeoplePage.tsx': 1,
  'principles/ui/PrinciplesPage.tsx': 1,
  'app/organisation/TopicsPage.tsx': 1,
  'observations/ui/ObservationsPage.tsx': 1,
  'documentation/ui/DocumentationPage.tsx': 1,
}

/** Where a page's column widths are kept for it, rather than by the page. */
const KEPT_IN = { 'documentation/ui/DocumentationPage.tsx': 'editor/useEditorRequests.ts' } as Record<string, string>

describe('every page (ADR-0044)', () => {
  it('is found: the scan sees the pages', () => {
    expect(PAGES).toContain('app/history/HistoryPage.tsx')
    expect(PAGES).toContain('blocks/ui/BlockPage.tsx')
    expect(PAGES.length).toBeGreaterThanOrEqual(17)
  })

  it('opens under the host’s bar', () => {
    expect(PAGES.filter((file) => !/<PageDialog[^>]*topInset=/s.test(read(file)))).toEqual([])
  })

  it('has its × at the end of its bar', () => {
    expect(PAGES.filter((file) => !read(BAR_IN[file] ?? file).includes('<PageClose'))).toEqual([])
  })

  it('lets every column beside another be dragged wider, and keeps its width', () => {
    for (const [file, seams] of Object.entries(SEAMS)) {
      const vertical = read(file).match(/<SeamResizer\s+orientation="vertical"/g) ?? []
      expect([file, vertical.length]).toEqual([file, seams])
      expect([file, /useSeamWidth(sOf)?[<(]/.test(read(KEPT_IN[file] ?? file))]).toEqual([file, true])
    }
  })

  it('has no column seam that is not listed here', () => {
    const unlisted = PAGES.filter((file) => /<SeamResizer\s+orientation="vertical"/.test(read(file)) && !(file in SEAMS))
    expect(unlisted).toEqual([])
  })
})
