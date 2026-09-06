import { describe, expect, it } from 'vitest'
import { bestMatches, groupDecisionIndex, matchesTokens, NO_MATCH, searchIndex } from './searchIndex'
import { searchAll } from './search'
import { searchElements, SEARCH_RESULT_LIMIT } from './elementSearch'
import { fold, matchesQuery, queryTokens } from '../model/textSearch'
import { syntheticModel } from '../model/testing/synthetic'
import type { DesignElement, DesignModel } from '../model/types'
import type { Adr } from '../decisions/adr'

/**
 * The index folds the haystack ahead of time, which is a change to WHEN the
 * work happens and must not be a change to what is found. So the two halves of
 * this file are: the token test still agrees with `matchesQuery`, and both
 * searches still return exactly what the filter-and-sort they replaced would
 * have — asserted against a plain reimplementation of it, over the generated
 * landscape rather than over three hand-written rows.
 */

const model = syntheticModel('small')

describe('matching against a folded haystack', () => {
  const cases: [string, (string | undefined)[]][] = [
    ['reis', ['Reisinformatie backend']],
    ['REIS', ['Reisinformatie backend']],
    ['réisinfo', ['Reisinformatie backend']],
    ['info backend', ['Reisinformatie backend']],
    ['backend info', ['Reisinformatie backend']],
    ['missing', ['Reisinformatie backend']],
    ['kafka', ['Order gateway', undefined, 'Kestrel', 'Kafka']],
    ['gateway kestrel', ['Order gateway', undefined, 'Kestrel', 'Kafka']],
    ['  ', ['anything']],
    ['x', []],
    ['x', [undefined, undefined]],
  ]

  it.each(cases)('agrees with matchesQuery for %j', (query, terms) => {
    const folded = matchesTokens(queryTokens(query), fold(terms.filter(Boolean).join(' ')))
    expect(folded).toBe(matchesQuery(query, terms))
  })
})

describe('the index', () => {
  it('is built once per model', () => {
    expect(searchIndex(model)).toBe(searchIndex(model))
  })

  it('keeps a row it has already folded when the model around it is replaced', () => {
    const before = searchIndex(model)
    const renamed: DesignModel = {
      ...model,
      elements: model.elements.map((e, n) => (n === 0 ? { ...e, name: 'Renamed' } : e)),
    }
    const after = searchIndex(renamed)
    expect(after).not.toBe(before)
    const held = before.elements.find((e) => e.element === model.elements[1])
    expect(after.elements.find((e) => e.element === model.elements[1])).toBe(held)
  })

  it('holds the elements in name order', () => {
    const names = searchIndex(model).elements.map((e) => e.element.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  it('says which diagram carries an element, and which one first', () => {
    const { places } = searchIndex(model)
    for (const diagram of model.diagrams) {
      expect(places.carries.get(diagram.id)?.size).toBe(diagram.placements.length)
    }
    const component = model.elements.find((e) => e.kind === 'component') as DesignElement
    expect(places.first.get(component.id)?.kind).toBe('container')
    expect(places.first.get(model.elements[0].id)?.id).toBe('landscape')
  })

  it('indexes a group\'s records apart from the project\'s', () => {
    const records: Adr[] = [{
      id: 'g1', number: 1, title: 'Use one identity provider', status: 'accepted',
      date: '2026-01-01', body: 'Context.', signers: [],
    }]
    const indexed = groupDecisionIndex(records)
    expect(indexed).toBe(groupDecisionIndex(records))
    expect(indexed[0].scope).toBe('group')
  })
})

describe('taking the best matches', () => {
  const rows = ['a', 'b', 'c', 'd', 'e']

  it('flattens the bands in order and cuts at the limit', () => {
    expect(bestMatches(rows, 3, 2, (row) => (row === 'a' || row === 'e' ? 1 : 0)))
      .toEqual(['b', 'c', 'd'])
  })

  it('drops what does not match', () => {
    expect(bestMatches(rows, 5, 1, (row) => (row === 'c' ? 0 : NO_MATCH))).toEqual(['c'])
  })

  it('stops scanning once the top band is full', () => {
    const seen: string[] = []
    bestMatches(rows, 2, 2, (row) => {
      seen.push(row)
      return 0
    })
    expect(seen).toEqual(['a', 'b'])
  })

  it('keeps scanning while only a lower band is filling', () => {
    const seen: string[] = []
    bestMatches(rows, 2, 2, (row) => {
      seen.push(row)
      return 1
    })
    expect(seen).toEqual(rows)
  })
})

// --- the same answers as the code this replaced --------------------------------

/** ⌘K's element list, exactly as it was written before the index. */
function naiveElements(query: string, limit: number): string[] {
  const folded = fold(query.trim())
  const startsWith = (name: string) => (fold(name).startsWith(folded) ? 0 : 1)
  return model.elements
    .filter((e) => matchesQuery(query, [e.name, e.category, e.vendor, e.technology]))
    .sort((a, b) => startsWith(a.name) - startsWith(b.name) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((e) => e.id)
}

/** ⌘F's list, likewise. */
function naiveFinder(query: string, activeDiagramId: string): string[] {
  const folded = fold(query.trim())
  const hits = model.elements
    .filter((e) => matchesQuery(query, [e.name, e.category, e.vendor, e.technology]))
    .map((element) => {
      const onActive = model.diagrams.some(
        (d) => d.id === activeDiagramId && d.placements.some((p) => p.elementId === element.id))
      const diagram = onActive
        ? model.diagrams.find((d) => d.id === activeDiagramId)
        : model.diagrams.find((d) => d.placements.some((p) => p.elementId === element.id))
      return { element, onActive, diagramId: diagram?.id }
    })
  const rank = (hit: (typeof hits)[number]) => {
    const prefix = fold(hit.element.name).startsWith(folded) ? 0 : 1
    if (hit.onActive) return prefix
    if (hit.diagramId) return 2 + prefix
    return 4
  }
  return hits
    .sort((a, b) => rank(a) - rank(b) || a.element.name.localeCompare(b.element.name))
    .slice(0, SEARCH_RESULT_LIMIT)
    .map((hit) => hit.element.id)
}

const QUERIES = ['bill', 'billing gateway', 'kestrel', 'go', 'z', 'order to cash', 'a', 'ledger 3']

describe('the same answers as the filter and sort it replaced', () => {
  it.each(QUERIES)('finds the same elements for %j', (query) => {
    const found = searchAll({ model, groupDecisions: [], query })
      .filter((hit) => hit.kind === 'element')
      .map((hit) => hit.elementId)
    expect(found).toEqual(naiveElements(query, 8))
  })

  it.each(QUERIES)('finds the same elements from the canvas for %j', (query) => {
    expect(searchElements(model, query, 'landscape').map((hit) => hit.id))
      .toEqual(naiveFinder(query, 'landscape'))
  })

  it.each(QUERIES)('finds the same documentation for %j', (query) => {
    const found = searchAll({ model, groupDecisions: [], query })
      .filter((hit) => hit.kind === 'documentation')
      .map((hit) => hit.elementId)
    const expected = model.elements
      .filter((e) => e.description && matchesQuery(query, [e.description]))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8)
      .map((e) => e.id)
    expect(found).toEqual(expected)
  })

  it.each(QUERIES)('finds the same decisions for %j', (query) => {
    const found = searchAll({ model, groupDecisions: [], query })
      .filter((hit) => hit.kind === 'adr')
      .map((hit) => hit.adrId)
    const expected = (model.decisions ?? [])
      .filter((adr) => matchesQuery(query, [adr.title, adr.body, ...adr.signers.map((s) => s.name)]))
      .slice(0, 8)
      .map((adr) => adr.id)
    expect(found).toEqual(expected)
  })

  it('ranks an element on the open diagram above one that is not', () => {
    const container = model.diagrams.find((d) => d.kind === 'container')
    const component = model.elements.find((e) => e.kind === 'component') as DesignElement
    const hits = searchElements(model, component.name.split(' ')[0], container?.id ?? '')
    expect(hits[0].onActiveDiagram).toBe(true)
  })
})
