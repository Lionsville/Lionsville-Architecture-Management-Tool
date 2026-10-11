// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every place that lists findings lists them in the one list of findings
 * (`widgets/FindingsList`, ADR-0036 amended 11 October 2026), where each
 * opens its explanation, and the explanation's actions are the ways to what
 * it is about.
 *
 * Said by holding the sentences to the files that say them, rather than by
 * visiting each screen: a finding's words come from one of two tables —
 * `CHECK_SENTENCE`, what a scope's dates disagree about, and
 * `findingSentence`, what the tree contradicts about itself — and naming
 * either anywhere else fails here. `FindingSentence` says the dates' — as a
 * link on the roadmap card at home, and as the words the roadmap's list says
 * (`RoadmapFindings`); `attention.ts` says the tree's for the organisation's
 * home (`NeedsAttention`); a unit's checks in its inspector (`UnitSection`),
 * a plan's *Still open* (`PlanStillOpen`) and the organisation chart's
 * summary (`ChartSummary`) say them for the units they are about. The
 * Conway map says its own in its own words (`ConwayPage.findingText`).
 *
 * And every screen that lists them draws the one list: a new place that
 * lists findings is a new line below, and draws them grouped, folded and
 * explained, because that is the list there is. The component tests of each
 * place check that the actions open what they name.
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

  it('are listed in the one list of findings wherever a screen lists them', () => {
    expect(naming(/<FindingsList\b/)).toEqual([
      'app/organisation/NeedsAttention.tsx', 'app/units/ChartSummary.tsx', 'app/units/ConwayPage.tsx', 'app/units/PlanStillOpen.tsx',
      'app/units/UnitSection.tsx', 'roadmap/ui/RoadmapFindings.tsx',
    ])
  })
})
