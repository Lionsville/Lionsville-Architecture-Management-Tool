// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { scopeSources, searchAll, treeSources } from './search'
import { searchElements } from './elementSearch'
import { searchIndex } from './searchIndex'
import { recordIndex } from './recordIndex'
import type { HostModel } from '../model/hostModel'
import type { Cause, Experiment, Observation, Solution } from '../model/observation'
import type { Transition } from '../model/transition'
import type { SearchableModel } from '../model/searchable'
import { BUDGET, heapGrowthMb, measure } from '../model/testing/measure'
import { syntheticModel } from '../model/testing/synthetic'

/**
 * What a keystroke in a search field costs, on a landscape of two thousand
 * documented elements — and, since every kind of record is searched
 * (ADR-0029), with a few hundred of each of the others beside them, and with
 * twenty such scopes in the tree around it.
 *
 * Three queries, because they exercise different halves of the index. A prefix
 * a handful of names begin with is the common case and stops early. A single
 * letter matches most of the landscape, fills the top band immediately and so
 * stops even earlier. A word that occurs only in the prose matches no name at
 * all, which is the case with no early exit anywhere: every element's folded
 * description is scanned, and that is the number the budget is really about —
 * before the index it was every element's description *folded*, per keystroke.
 */

const WORDS = ['gate', 'ledger', 'queue', 'berth', 'quay', 'invoice', 'booking', 'crane', 'billing', 'pallet']
const word = (n: number) => WORDS[n % WORDS.length]
const prose = (n: number) => `Seen at the ${word(n)} desk on shift ${n}; the ${word(n + 3)} log shows it twice.`

/** The `large` landscape, with the analysis and the plans a busy scope has written. */
function busy(): HostModel {
  const base = syntheticModel('large')
  const observations: Observation[] = Array.from({ length: 400 }, (_, n) => ({
    id: `ob-${n}`, number: n + 1, title: `${word(n)} stalls at ${word(n + 1)}`, date: '2026-09-01', impact: 'minor',
    seen: 1, body: prose(n), history: [],
  }))
  const causes: Cause[] = Array.from({ length: 200 }, (_, n) => ({
    id: `ca-${n}`, number: n + 1, title: `${word(n)} retried by hand`, state: 'assumed', body: prose(n), explains: [],
  }))
  const solutions: Solution[] = Array.from({ length: 150 }, (_, n) => ({
    id: `so-${n}`, number: n + 1, title: `Automate the ${word(n)}`, state: 'idea', addresses: [], validatedWith: [],
    attempts: [], body: prose(n), history: [],
  }))
  const experiments: Experiment[] = Array.from({ length: 100 }, (_, n) => ({
    id: `ex-${n}`, number: n + 1, title: `A week of ${word(n)}`, tests: [], hypothesis: 'It halves', outcome: 'planned', body: prose(n),
  }))
  const transitions: Transition[] = Array.from({ length: 100 }, (_, n) => ({
    id: `tr-${n}`, number: n + 1, title: `Replace the ${word(n)}`, status: 'draft', elements: [], decisions: [],
    milestones: [{ date: '2027-01-01', name: `${word(n)} pilot` }, { date: '2027-06-01', name: `${word(n)} live` }], body: prose(n),
  }))
  return { ...base, observations, causes, solutions, experiments, transitions }
}

const model = busy()
const here = scopeSources({ model })

/**
 * Twenty scopes of that size, as the tree's thin read has them: records, rows,
 * plans and observations, and no prose on an element — its page is a file of
 * its own, and the read the index is built from does not open it.
 */
function tree(): { path: string; model: SearchableModel }[] {
  return Array.from({ length: 20 }, (_, n) => ({
    path: `domain-${n}`,
    model: {
      elements: model.elements.map((element) => ({ ...element, id: `${element.id}-${n}`, description: undefined })),
      relations: model.relations.map((relation) => ({ ...relation, id: `${relation.id}-${n}` })),
      transitions: model.transitions,
      observations: model.observations,
    },
  }))
}

describe('the cost of a keystroke in a search field', () => {
  it('builds the index once, and says what that cost', () => {
    // Two one-off costs rather than one, because they are paid at different
    // moments. Folding every record happens once, when a scope is opened.
    // Re-indexing happens on every command, and costs almost nothing: the
    // reducer leaves the rows it did not touch alone, so their folds come
    // straight back out of the cache and only the ordering is redone.
    // Cloned outside the timer: what is being measured is the folding, not
    // `structuredClone` over six megabytes.
    let fresh = model
    measure('search: index a landscape never seen before, every kind', () => {
      searchIndex(fresh)
      recordIndex(fresh)
    }, { runs: 3, warmup: 0, prepare: () => { fresh = structuredClone(model) } })
    const step = measure('search: index a model the reducer just returned, every kind', () => {
      const next = { ...model, observations: model.observations?.map((one, at) => (at === 0 ? { ...one, title: 'Renamed' } : one)) }
      searchIndex(next)
      recordIndex(next)
    }, { runs: 5, warmup: 1 })
    // The step's own keystroke budget: a command that re-folded the scope
    // would be tens of milliseconds here.
    expect(step).toBeLessThan(BUDGET.search)
  })

  it('answers a prefix most names do not have', () => {
    const ms = measure('search: one keystroke, a name prefix', () => {
      searchAll({ sources: here, query: 'billing gate' })
    })
    expect(ms).toBeLessThan(BUDGET.search)
  })

  it('answers a letter half the landscape contains', () => {
    const ms = measure('search: one keystroke, a single letter', () => {
      searchAll({ sources: here, query: 'e' })
    })
    expect(ms).toBeLessThan(BUDGET.search)
  })

  it('answers a word that only the prose has', () => {
    const hits = searchAll({ sources: here, query: 'reconciles nightly' })
    expect(hits.some((hit) => hit.kind === 'documentation')).toBe(true)
    const ms = measure('search: one keystroke, prose only', () => {
      searchAll({ sources: here, query: 'reconciles nightly' })
    })
    expect(ms).toBeLessThan(BUDGET.search)
  })

  it('answers across twenty scopes, and says what folding them cost', () => {
    let held = tree()
    const sources = () => treeSources({ scope: '', model, above: [], tree: held, masterOf: () => undefined })
    // Paid on the first keystroke after the tree was read, and never again
    // until the watcher says the folder changed — the schedule the index
    // itself keeps (ADR-0012 §2).
    const fold = measure('search: fold twenty scopes the tree just read', () => {
      searchAll({ sources: sources(), query: 'zz' })
    }, { runs: 3, warmup: 0, prepare: () => { held = tree() } })
    expect(fold).toBeLessThan(BUDGET.index)
    const warm = sources()
    const hits = searchAll({ sources: warm, query: 'ledger stalls', kinds: ['observation'], limitPerKind: 1000 })
    expect(hits.some((hit) => hit.scope === 'domain-19')).toBe(true)
    const ms = measure('search: one keystroke across twenty scopes, a word no title starts with', () => {
      searchAll({ sources: warm, query: 'desk shift' })
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
        searchAll({ sources: scopeSources({ model: held }), query: 'renamed' })
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
