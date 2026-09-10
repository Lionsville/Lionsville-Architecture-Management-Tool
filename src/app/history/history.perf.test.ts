import { describe, expect, it } from 'vitest'
import { placedNodes } from '../../model/placement';
import { apply, fromArrays, restoreCommand } from '../../model'
import { diffModels } from '../../model/diff'
import type { HostModel } from '../../model/fromInterchange'
import { BUDGET, measure } from '../../model/testing/measure'
import { syntheticModel } from '../../model/testing/synthetic'
import { projectFiles, projectFromFolder } from '../../projects/folderFormat'
import type { ProjectRef } from '../../projects/projectRef'
import type { ProjectSnapshot } from '../../projects/project'
import { changesFor } from './changesFor'

/**
 * What the history page costs per snapshot looked at, and what a restore
 * costs, on the large landscape (ADR-0008, step 7).
 *
 * Per-thing history is deliberately one whole-project read per snapshot rather
 * than one per thing — the page caches the chosen snapshot — so the number
 * that matters is "click on a snapshot": the folder parsed back into a
 * project, the two models compared, and the rows filtered to the subject. The
 * process spawns that fetch the text are the adapter's and are not in it, for
 * the reason `open.perf.test.ts` gives about the disk.
 *
 * A restore is that comparison again, as commands, through the reducer.
 */

const ref: ProjectRef = { group: 'northwind', project: 'landscape' }
const then: HostModel = syntheticModel('large')

/** Where the project has got to since: names, geometry, a page and a record. */
const now: HostModel = {
  ...then,
  elements: then.elements.map((element, i) => (i % 40 === 0
    ? { ...element, name: `${element.name} (renamed)`, description: `${element.description ?? ''}\n\nRewritten.` }
    : element)),
  diagrams: then.diagrams.map((diagram, i) => (i === 0
    ? { ...diagram, name: 'A mess', placements: placedNodes(diagram).map((p) => ({ ...p, x: p.x + 10, y: p.y + 10 })) }
    : diagram)),
  decisions: (then.decisions ?? []).map((adr, i) => (i === 0 ? { ...adr, title: `${adr.title}, retitled` } : adr)),
}

const files = projectFiles({ ref, model: then, activeDiagramId: then.diagrams[0].id, logoLibrary: [] } as ProjectSnapshot)
const nowIndexed = fromArrays(now)
const landscape = then.diagrams[0].id

describe('the history page, per snapshot looked at', () => {
  it('reads the snapshot back, compares it with now, and keeps the rows about one diagram', () => {
    const ms = measure('history: look at one snapshot, for one diagram', () => {
      const opened = projectFromFolder(files, ref)
      if (!opened) throw new Error('the folder did not read back as a project')
      const rows = changesFor(diffModels(opened.model, now), { what: 'diagram', id: landscape })
      if (rows.length === 0) throw new Error('the comparison saw nothing')
    }, { runs: 5, warmup: 1 })
    expect(ms).toBeLessThan(BUDGET.historyLook)
  })
})

describe('a restore', () => {
  it('brings one diagram back through the reducer', () => {
    const thenIndexed = fromArrays(then)
    const ms = measure('history: restore one diagram', () => {
      const result = restoreCommand(thenIndexed, nowIndexed, { what: 'diagram', id: landscape }, '2026-09-03')
      if (!result.ok) throw new Error(result.reason)
      const applied = apply(nowIndexed, result.command)
      if (!applied.ok) throw new Error(applied.reason)
    })
    expect(ms).toBeLessThan(BUDGET.restoreDiagram)
  })

  it('brings the whole project back through the reducer', () => {
    const thenIndexed = fromArrays(then)
    const ms = measure('history: restore the whole project', () => {
      const result = restoreCommand(thenIndexed, nowIndexed, undefined, '2026-09-03')
      if (!result.ok) throw new Error(result.reason)
      const applied = apply(nowIndexed, result.command)
      if (!applied.ok) throw new Error(applied.reason)
    }, { runs: 5, warmup: 1 })
    expect(ms).toBeLessThan(BUDGET.restoreProject)
  })
})
