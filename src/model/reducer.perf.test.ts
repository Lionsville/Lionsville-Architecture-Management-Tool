import { describe, expect, it } from 'vitest'
import { apply } from './reducer'
import { fromArrays } from './normalised'
import type { Model } from './normalised'
import type { Command } from './commands'
import { fieldEdit } from './commands'
import { BUDGET, heapGrowthMb, measure } from './testing/measure'
import { syntheticModel } from './testing/synthetic'

/**
 * What a change costs, on a landscape of two thousand elements.
 *
 * This is the measurement ADR-0002 was written to make possible: before it, a
 * keystroke merged the whole model three or four times and pushed a full
 * snapshot onto the undo stack, so the cost of typing a name grew with the
 * number of diagrams in the project. A command names a path, the reducer
 * touches it and copies nothing else, and the inverse is a command rather than
 * a copy of everything. These budgets are what says that is still true.
 *
 * The heap budget is the one that catches the old shape returning. Five hundred
 * steps of a full-model snapshot each is hundreds of megabytes on this fixture;
 * five hundred pairs of commands is a rounding error.
 */

const model = fromArrays(syntheticModel('large'))
const LANDSCAPE = 'landscape'

/** Ten cards picked off the landscape, moved a grid square down and right. */
function dragTen(from: Model): Command {
  const moved = from.diagrams[LANDSCAPE].order.placements.slice(100, 110)
  return {
    type: 'placement.set',
    diagramId: LANDSCAPE,
    placements: moved.map((id) => {
      const held = from.diagrams[LANDSCAPE].placements[id]
      return { ...held, x: held.x + 40, y: held.y + 40 }
    }),
    coalesce: 'drag',
  }
}

function ok(result: ReturnType<typeof apply>): { model: Model; inverse: Command } {
  if (!result.ok) throw new Error(`the reducer refused: ${result.reason}`)
  return result
}

describe('the cost of a change', () => {
  it('applies one keystroke in an inspector field', () => {
    let n = 0
    const ms = measure('reducer: one inspector keystroke', () => {
      ok(apply(model, {
        type: 'element.update',
        id: 'app-0001',
        patch: { name: `Billing gateway ${n++}` },
        coalesce: fieldEdit('app-0001', 'name'),
      }))
    })
    expect(ms).toBeLessThan(BUDGET.keystroke)
  })

  it('commits a drag of ten nodes', () => {
    const command = dragTen(model)
    const ms = measure('reducer: drag-stop of 10 nodes', () => {
      ok(apply(model, command))
    })
    expect(ms).toBeLessThan(BUDGET.dragStop)
  })

  it('leaves every diagram it did not touch alone', () => {
    // The property the budgets above depend on, asserted rather than assumed:
    // if a command copied the neighbouring diagrams, everything memoised on a
    // diagram's identity would re-derive and the numbers would still be green.
    const after = ok(apply(model, dragTen(model))).model
    expect(after.diagrams[LANDSCAPE]).not.toBe(model.diagrams[LANDSCAPE])
    for (const id of model.order.diagrams) {
      if (id !== LANDSCAPE) expect(after.diagrams[id]).toBe(model.diagrams[id])
    }
    expect(after.elements).toBe(model.elements)
    expect(after.connections).toBe(model.connections)
  })

  it('undoes and redoes one step', () => {
    const done = ok(apply(model, dragTen(model)))
    const undo = measure('reducer: undo one step', () => {
      ok(apply(done.model, done.inverse))
    })
    expect(undo).toBeLessThan(BUDGET.undo)

    const back = ok(apply(done.model, done.inverse))
    const redo = measure('reducer: redo one step', () => {
      ok(apply(back.model, back.inverse))
    })
    expect(redo).toBeLessThan(BUDGET.undo)
  })

  it('keeps five hundred steps of history without keeping five hundred models', () => {
    const grown = heapGrowthMb('reducer: 500 undo steps, heap growth', () => {
      // The session's own shape: the model as it now stands, and a stack of
      // command pairs. Nothing here holds a model from a previous step.
      let held = model
      const history: { command: Command; inverse: Command }[] = []
      for (let n = 0; n < 500; n++) {
        const command: Command = {
          type: 'element.update',
          id: `app-${String((n % 900) + 1).padStart(4, '0')}`,
          patch: { technology: `Go ${n}` },
        }
        const result = ok(apply(held, command))
        held = result.model
        history.push({ command, inverse: result.inverse })
      }
      expect(history).toHaveLength(500)
    })
    expect(grown).toBeLessThan(BUDGET.undoHeapMb)
  })
})
