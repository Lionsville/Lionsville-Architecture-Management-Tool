import { describe, expect, it } from 'vitest'
import { diagramFiles, projectFiles } from './folderFormat'
import type { ProjectSnapshot } from './project'
import { BUDGET, measure } from '../model/testing/measure'
import { syntheticModel } from '../model/testing/synthetic'

/**
 * What a save costs, on a landscape of two thousand elements.
 *
 * ADR-0003 split the folder one document per thing that changes independently,
 * and the reason was this number: a drag has to rewrite one placements file
 * rather than serialise the project. The whole-project figure is measured too,
 * without a budget on it — it is what a first save or a "save as" costs, it is
 * allowed to be a second, and having it in the report is how anyone can tell
 * whether the per-diagram saving is worth the machinery.
 */

const project: ProjectSnapshot = {
  ref: { group: 'northwind', project: 'landscape' },
  model: syntheticModel('large'),
  activeDiagramId: 'landscape',
  logoLibrary: [],
}

describe('the cost of a save', () => {
  it('writes one diagram', () => {
    const diagram = project.model.diagrams[0]
    const ms = measure('folder: serialise one diagram file', () => {
      diagramFiles(diagram)
    })
    expect(ms).toBeLessThan(BUDGET.serialiseDiagram)
  })

  it('writes the whole project, for the record', () => {
    measure('folder: serialise the whole project', () => {
      projectFiles(project)
    }, { runs: 3, warmup: 1 })
  })
})
