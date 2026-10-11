// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The four libraries as they ship (ADR-0036 §5): whole in three languages,
 * every reference inside one resolving, and each responsibility one role's A
 * where the library has roles at all — so what is brought in starts out with
 * nothing to flag.
 */
import { describe, expect, it } from 'vitest'
import { accountabilityGaps } from '../../model/operatingModel'
import { bringIn } from '../bringIn'
import { entriesOf } from '../library'
import type { Library, Words } from '../library'
import { LIBRARIES, libraryById } from '.'
import { applyAll, empty, listsOf } from '../testing'

const LANGUAGES = ['en', 'nl', 'de'] as const

function wordsOf(library: Library): Words[] {
  return [
    library.note,
    ...library.unitTypes.flatMap((one) => [one.name, one.purpose]),
    ...library.roles.flatMap((one) => [one.name, one.purpose]),
    ...library.responsibilities.flatMap((one) => [one.name, one.description, one.group]),
  ]
}

describe.each(LIBRARIES.map((library) => [library.id, library] as const))('the %s library', (_id, library) => {
  it('says everything in English, Dutch and German', () => {
    for (const words of wordsOf(library)) {
      for (const language of LANGUAGES) expect(words[language].trim(), JSON.stringify(words)).not.toBe('')
    }
  })

  it('names each entry once, and every entry it refers to is in it', () => {
    const ids = entriesOf(library).map((entry) => entry.item.entry)
    expect(new Set(ids).size).toBe(ids.length)
    const roles = new Set(library.roles.map((one) => one.entry))
    const types = new Set(library.unitTypes.map((one) => one.entry))
    const responsibilities = new Set(library.responsibilities.map((one) => one.entry))
    for (const type of library.unitTypes) {
      for (const slot of type.slots) expect(roles.has(slot.role), `${type.entry} → ${slot.role}`).toBe(true)
      for (const within of type.within) expect(types.has(within), `${type.entry} in ${within}`).toBe(true)
      expect(type.top || type.within.length > 0, `${type.entry} sits somewhere`).toBe(true)
    }
    for (const role of library.roles) {
      for (const duty of role.duties) expect(responsibilities.has(duty.responsibility), `${role.entry} → ${duty.responsibility}`).toBe(true)
    }
  })

  it('brings in whole, in one step, with one role accountable for each responsibility', () => {
    const step = bringIn({ lists: listsOf(empty()), library, entries: entriesOf(library).map((entry) => entry.item.entry), language: 'en', makeId: counter() })
    expect(step).toBeDefined()
    const model = applyAll(empty(), [step!])
    const lists = listsOf(model)
    expect(lists.unitTypes).toHaveLength(library.unitTypes.length)
    expect(lists.roles).toHaveLength(library.roles.length)
    expect(lists.responsibilities).toHaveLength(library.responsibilities.length)
    if (library.roles.length) expect(accountabilityGaps(lists.responsibilities, lists.roles)).toEqual([])
  })
})

describe('the libraries that ship', () => {
  it('are Scrum, SAFe, the IT4IT value streams and Team Topologies, each at a version', () => {
    expect(LIBRARIES.map((library) => library.name)).toEqual(['Scrum', 'SAFe', 'IT4IT', 'Team Topologies'])
    for (const library of LIBRARIES) expect(library.version).toMatch(/^\d+$/)
    expect(libraryById('safe')?.name).toBe('SAFe')
    expect(libraryById('nonsense')).toBeUndefined()
  })

  it('group the IT4IT responsibilities by the seven value streams of its 3.0 edition', () => {
    const groups = [...new Set(libraryById('it4it')!.responsibilities.map((one) => one.group.en))]
    expect(groups).toEqual(['Evaluate', 'Explore', 'Integrate', 'Deploy', 'Release', 'Consume', 'Operate'])
  })
})

function counter(): (prefix: string) => string {
  let n = 0
  return (prefix) => `${prefix}-${++n}`
}
