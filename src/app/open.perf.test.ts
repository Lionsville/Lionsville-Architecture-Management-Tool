import { describe, expect, it } from 'vitest'
import { fromArrays } from '../model'
import { BUDGET, measure } from '../model/testing/measure'
import { syntheticModel } from '../model/testing/synthetic'
import { buildEdges, buildNodes } from '../editor/graph'
import { projectFiles, projectFromFolder } from '../projects/folderFormat'
import type { ProjectRef } from '../projects/projectRef'
import type { ProjectSnapshot } from '../projects/project'

/**
 * What opening a project costs, end to end, on a landscape of two thousand
 * elements — the one number a user experiences as a whole rather than as a
 * step: the folder read off disk, parsed, indexed, and the first board derived.
 *
 * It lives in `app/` because it is the only place allowed to know all four
 * halves of it. Everything measured here is synchronous work on the main
 * thread, so the budget is also the answer to "how long is the window blank".
 * The disk itself is not in it: what a store costs to read is the store's
 * business and varies by adapter, and a budget that included it would fail on a
 * cold cache rather than on a regression.
 */

const ref: ProjectRef = { group: 'northwind', project: 'landscape' }
const project: ProjectSnapshot = {
  ref,
  model: syntheticModel('large'),
  activeDiagramId: 'landscape',
  logoLibrary: [],
}
/** The text a store would hand back, produced once and outside every timer. */
const files = projectFiles(project)

describe('opening a project', () => {
  it('parses the folder, indexes it and derives the landscape', () => {
    const ms = measure('open: parse, index and derive the landscape', () => {
      const opened = projectFromFolder(files, ref)
      if (!opened) throw new Error('the folder did not read back as a project')
      fromArrays(opened.model)
      const diagram = opened.model.diagrams[0]
      const nodes = buildNodes({ model: opened.model, diagram, readOnly: false, edgeColor: '#888' })
      const edges = buildEdges({ model: opened.model, diagram, readOnly: false, edgeColor: '#888' })
      // Asserted inside the timer, because a budget met by an open that quietly
      // read nothing back would be the one failure this test cannot see.
      if (opened.model.elements.length !== project.model.elements.length) {
        throw new Error('the folder read back a different landscape')
      }
      if (nodes.length !== diagram.placements.length || edges.length === 0) {
        throw new Error('the derive produced nothing to draw')
      }
    }, { runs: 5, warmup: 1 })
    expect(ms).toBeLessThan(BUDGET.open)
  })
})
