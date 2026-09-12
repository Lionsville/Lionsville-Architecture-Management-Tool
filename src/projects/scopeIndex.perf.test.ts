import { describe, expect, it } from 'vitest'
import { indexScopes } from './scopeIndex'
import type { ScopeModel } from './scope'
import { BUDGET, measure } from '../model/testing/measure'
import { syntheticModel } from '../model/testing/synthetic'

/**
 * What one identity across the organisation costs (ADR-0012 §2, ADR-0004).
 *
 * This is the first thing in the app that reads more than one folder, and it is
 * paid on every open and again whenever the watcher says the folder changed —
 * so it is the number that decides whether federation is affordable at all.
 *
 * Twenty scopes of the `large` fixture: forty thousand records and a hundred
 * thousand rows, which is a large organisation rather than a large landscape.
 * The generated model is shared between the scopes on purpose — nothing here
 * mutates one, and building twenty is itself several seconds of work that
 * measures the generator rather than the index.
 *
 * The shape being watched for is a pass that is quadratic in the TREE: an
 * ancestor walk per element, or a `find` over the entries to decide a master.
 * Neither would show on one scope, and both would make this row minutes.
 */
const SCOPES = 20

function tree(): ScopeModel[] {
  const model = syntheticModel('large')
  const paths = ['']
  for (let n = 1; n < SCOPES; n++) {
    // A real shape rather than twenty siblings: depth is what decides a master,
    // so an index over a flat tree would not exercise the rule it exists for.
    paths.push(n % 3 === 0 ? `domain-${n}/landscape-${n}` : `domain-${n}`)
  }
  return paths.map((path) => ({ path, model }))
}

describe('the cost of the index', () => {
  it('indexes twenty scopes of a few thousand elements each', () => {
    const models = tree()
    const ms = measure('index: twenty scopes, the whole tree', () => {
      indexScopes(models)
    })
    expect(ms).toBeLessThan(BUDGET.index)
  })

  /**
   * For the record, and because it is the call the id policy makes: the set is
   * built once with the index, so minting a key is a read rather than a walk.
   */
  it('answers one lookup and the taken set without walking again', () => {
    const index = indexScopes(tree())
    measure('index: one lookup', () => {
      index.lookup('billing')
    })
    measure('index: every id spoken for', () => {
      index.takenIds()
    })
  })
})
