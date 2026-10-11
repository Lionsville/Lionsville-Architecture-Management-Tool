// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every place that lists findings lists each one as a link to what it is
 * about.
 *
 * Said by holding the sentences to the components that draw them as links,
 * rather than by visiting each screen: a finding's words come from one of two
 * tables — `CHECK_SENTENCE`, what a scope's dates disagree about, and
 * `findingSentence`, what the tree contradicts about itself — and each has one
 * place that turns them into a link. `FindingSentence` is the roadmap's and
 * the roadmap card's; `attention.ts` hands the tree's to `NeedsAttention`,
 * which draws every row as a button to the record. A new screen that wants to
 * list findings has to go through one of those, because naming either table
 * anywhere else fails here. The component tests of each place check the links
 * open what they name.
 *
 * One more place says the tree's, and draws them as lines and not links: a
 * unit's own section in its inspector (`UnitSection`, ADR-0036 §3), which
 * lists only the findings about that unit and the people holding its roles —
 * what it is about is what the person is looking at, so a link would lead to
 * where they already are.
 *
 * And a plan's page says what is still open on the plan's day in the units
 * it reorganises (`PlanStillOpen`, ADR-0036 §6): each finding about a unit
 * a link to that unit, and one about a person a line — the people are in the
 * list above it.
 *
 * And the organisation chart's summary, in the inspector beside it while
 * nothing is picked (`ChartSummary`, ADR-0036 §7; under the chart until
 * 3.6.1), which lists the findings about the units it draws and the people in
 * them, each a link to the unit on the chart it is about: chosen there,
 * brought on screen and ringed.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = fileURLToPath(new URL('../src', import.meta.url))

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

/** Which files name a table, other than a test. */
function naming(pattern: RegExp): string[] {
  return sources(src).filter((file) => pattern.test(readFileSync(file, 'utf8'))).map((file) => relative(src, file)).sort()
}

describe('findings', () => {
  it('are said only by the components that say them as links', () => {
    expect(naming(/\bCHECK_SENTENCE\b/)).toEqual(['roadmap/labels.ts', 'roadmap/ui/FindingSentence.tsx'])
    expect(naming(/\bfindingSentence\b/)).toEqual([
      'app/organisation/attention.ts', 'app/units/ChartSummary.tsx', 'app/units/PlanStillOpen.tsx', 'app/units/UnitSection.tsx',
      'projects/checks.ts',
    ])
  })
})
