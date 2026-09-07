import { describe, expect, it } from 'vitest'
import { fromArrays } from '../model/normalised'
import { BUDGET, measure } from '../model/testing/measure'
import { syntheticModel } from '../model/testing/synthetic'
import { inspect } from './inspect'

/**
 * What the layout report costs on the generated landscape.
 *
 * The loop an agent runs is inspect, move, inspect again, so the report is
 * paid for on every turn of it. The landscape diagram of the `large` fixture
 * draws well over a thousand boxes and several thousand lines, and every line
 * is graded against every box its span could touch: this is the number that
 * says the sweep is a sweep and not every pair.
 */

const model = fromArrays(syntheticModel('large'))
const landscape = model.diagrams['landscape']

describe('the cost of a layout report', () => {
  it('reports on the generated landscape', () => {
    const ms = measure('agent: inspect the large landscape', () => {
      inspect(model, landscape)
    })
    expect(ms).toBeLessThan(BUDGET.inspect)
  })

  it('finds what the generator planted, so the budget measures real work', () => {
    const report = inspect(model, landscape)
    // The generator draws a grid, so nothing overlaps; the lines are straight
    // between centres, so plenty of them cross a card in between.
    expect(report.drawn.elements).toBeGreaterThan(1000)
    expect(report.crossings.total).toBeGreaterThan(0)
    expect(report.crossings.some.length).toBeLessThanOrEqual(40)
  })
})
