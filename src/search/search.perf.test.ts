import { describe, expect, it } from 'vitest'
import { searchAll } from './search'
import { searchElements } from './elementSearch'
import { searchIndex } from './searchIndex'
import { BUDGET, heapGrowthMb, measure } from '../model/testing/measure'
import { syntheticModel } from '../model/testing/synthetic'

/**
 * What a keystroke in a search field costs, on a landscape of two thousand
 * documented elements.
 *
 * Three queries, because they exercise different halves of the index. A prefix
 * a handful of names begin with is the common case and stops early. A single
 * letter matches most of the landscape, fills the top band immediately and so
 * stops even earlier. A word that occurs only in the prose matches no name at
 * all, which is the case with no early exit anywhere: every element's folded
 * description is scanned, and that is the number the budget is really about —
 * before the index it was every element's description *folded*, per keystroke.
 */

const model = syntheticModel('large')

describe('the cost of a keystroke in a search field', () => {
  it('builds the index once, and says what that cost', () => {
    // Two one-off costs rather than one, because they are paid at different
    // moments. Folding every description happens once, when a project is
    // opened. Re-indexing happens on every command, and costs almost nothing:
    // the reducer leaves the rows it did not touch alone, so their folds come
    // straight back out of the cache and only the ordering is redone.
    // Cloned outside the timer: what is being measured is the folding, not
    // `structuredClone` over six megabytes.
    let fresh = model
    measure('search: index a landscape never seen before', () => {
      searchIndex(fresh)
    }, { runs: 3, warmup: 0, prepare: () => { fresh = structuredClone(model) } })
    measure('search: index a model the reducer just returned', () => {
      searchIndex({ ...model })
    }, { runs: 3, warmup: 1 })
  })

  it('answers a prefix most names do not have', () => {
    const ms = measure('search: one keystroke, a name prefix', () => {
      searchAll({ model, groupDecisions: [], query: 'billing gate' })
    })
    expect(ms).toBeLessThan(BUDGET.search)
  })

  it('answers a letter half the landscape contains', () => {
    const ms = measure('search: one keystroke, a single letter', () => {
      searchAll({ model, groupDecisions: [], query: 'e' })
    })
    expect(ms).toBeLessThan(BUDGET.search)
  })

  it('answers a word that only the prose has', () => {
    const hits = searchAll({ model, groupDecisions: [], query: 'reconciles nightly' })
    expect(hits.some((hit) => hit.kind === 'documentation')).toBe(true)
    const ms = measure('search: one keystroke, prose only', () => {
      searchAll({ model, groupDecisions: [], query: 'reconciles nightly' })
    })
    expect(ms).toBeLessThan(BUDGET.search)
  })

  it('does not grow with the number of models it has indexed', () => {
    // The index is cached on the model's identity and the folds on the rows',
    // both in WeakMaps, so a session that has edited a project two hundred
    // times holds one index and one set of folds — the collector takes the rest
    // as the models it belonged to are dropped. A cache keyed on anything else
    // would hold two hundred landscapes here.
    const grown = heapGrowthMb('search: 200 models indexed, heap growth', () => {
      let held = model
      for (let n = 0; n < 200; n++) {
        held = {
          ...held,
          elements: held.elements.map((e, at) => (at === n ? { ...e, name: `Renamed ${n}` } : e)),
        }
        searchAll({ model: held, groupDecisions: [], query: 'renamed' })
      }
    })
    expect(grown).toBeLessThan(BUDGET.cacheHeapMb)
  })

  it('finds an element from the canvas', () => {
    const ms = measure('search: one keystroke, the element finder', () => {
      searchElements(model, 'billing gate', 'landscape')
    })
    expect(ms).toBeLessThan(BUDGET.search)
  })
})
