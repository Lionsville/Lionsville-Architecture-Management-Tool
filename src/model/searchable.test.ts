// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every list the model holds says what its records are to a search
 * (ADR-0029). The table is typed over `ModelOrder`, so a list added without a
 * line does not compile; this says the same at run time, over the lists a
 * model actually has, so a key added to the order by a cast or a spread is
 * caught too.
 */
import { describe, expect, it } from 'vitest'
import { fromArrays } from './normalised'
import { SEARCH_KINDS, SEARCHABLE } from './searchable'
import { syntheticModel } from './testing/synthetic'

describe('what each kind of record says to a search', () => {
  it('is declared for every list a model holds, and for nothing else', () => {
    const lists = Object.keys(fromArrays({ name: 'Empty', elements: [], relations: [], diagrams: [] }).order)
    const declared = Object.keys(SEARCHABLE)
    const missing = lists.filter((list) => !declared.includes(list))
    expect(missing, `record lists with no search declaration: ${missing.join(', ')}`).toEqual([])
    expect(declared.filter((list) => !lists.includes(list))).toEqual([])
  })

  it('makes every kind of hit somewhere, and each kind in one list only', () => {
    const made = Object.values(SEARCHABLE).flat().map((one) => one.kind)
    expect([...made].sort()).toEqual([...SEARCH_KINDS].sort())
  })

  it('gives every record of the generated landscape an id, a title and a place to open', () => {
    const model = syntheticModel('small')
    for (const [list, declarations] of Object.entries(SEARCHABLE)) {
      const records = (model as unknown as Record<string, readonly object[] | undefined>)[list] ?? []
      for (const declaration of declarations) {
        for (const record of records) {
          const said = (declaration.describe as (held: object) => unknown)(record)
          for (const one of (Array.isArray(said) ? said : said === undefined ? [] : [said]) as { id: string; title: string; opens: { id: string } }[]) {
            expect(one.id).not.toBe('')
            expect(typeof one.title).toBe('string')
            expect(one.opens.id).not.toBe('')
          }
        }
      }
    }
  })
})
