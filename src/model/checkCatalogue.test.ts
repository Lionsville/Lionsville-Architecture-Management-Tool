// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The catalogue of checks (ADR-0036, amended 11 October 2026: findings you
 * can act on).
 *
 * The type already refuses a kind without an entry and an entry with another
 * kind's words; what is held here is what a type cannot see: that the lists
 * every place findings are worked out from are in it and nothing twice, that
 * every word it names is there in every language, that the wording follows
 * the weight, and the order a list of findings reads in.
 */
import { describe, expect, it } from 'vitest'
import {
  CHECK_ACTIONS, CHECK_ACTION_LABEL, CHECK_CATALOGUE, CHECK_CATEGORIES, CHECK_CATEGORY_LABEL, CHECK_KEYS, CHECK_LIST_WORDS, CHECK_WEIGHTS,
  CHECK_WEIGHT_LABEL, CONWAY_CHECK, CONWAY_CHECK_KEYS, DATE_CHECK, DATE_CHECK_KEYS, TECHNOLOGY_CHECK_KEYS, TREE_CHECK_KEYS,
  checkEntry, countByWeight, groupByCheck, isCheckKey,
} from './checkCatalogue'
import type { CheckKey } from './checkCatalogue'
import { EN } from './strings/en'
import { NL } from './strings/nl'
import { DE } from './strings/de'

const TABLES: Record<string, Readonly<Record<string, string>>> = { en: EN, nl: NL, de: DE }

describe('the catalogue', () => {
  it('has every kind once, and an entry for each and for nothing else', () => {
    expect(new Set(CHECK_KEYS).size).toBe(CHECK_KEYS.length)
    expect(Object.keys(CHECK_CATALOGUE).sort()).toEqual([...CHECK_KEYS].sort())
  })

  it('holds every key each place that finds them uses: the tree, the dates, the map and the technology rows', () => {
    const used: string[] = [
      ...TREE_CHECK_KEYS, ...DATE_CHECK_KEYS, ...CONWAY_CHECK_KEYS, ...TECHNOLOGY_CHECK_KEYS,
      ...Object.values(DATE_CHECK), ...Object.values(CONWAY_CHECK),
    ]
    for (const key of used) expect(isCheckKey(key), key).toBe(true)
    // The dates' kinds are their keys' last word, as the roadmap's sentences are keyed.
    for (const [kind, key] of Object.entries(DATE_CHECK)) expect(key).toBe(`check.${kind}`)
    expect(Object.values(DATE_CHECK).sort()).toEqual([...DATE_CHECK_KEYS].sort())
    // The map's over-limit is the organisation's own kind, not one of its own.
    expect(CONWAY_CHECK.overLimit).toBe('check.unitOverLimit')
    expect(TREE_CHECK_KEYS).toContain('check.unitOverLimit')
  })

  it('names, explains and says how to fix every kind, in every language', () => {
    for (const key of CHECK_KEYS) {
      const { name, why, how, actions } = CHECK_CATALOGUE[key]
      for (const [language, table] of Object.entries(TABLES)) {
        for (const word of [name, why, how]) expect(table[word]?.trim(), `${language} ${word}`).toBeTruthy()
      }
      expect(actions.length, key).toBeGreaterThan(0)
      for (const action of actions) expect(CHECK_ACTIONS, key).toContain(action)
    }
  })

  it('has words for every weight, category and action, in every language', () => {
    const keys = [
      ...CHECK_WEIGHTS.flatMap((weight) => [CHECK_WEIGHT_LABEL[weight].name, CHECK_WEIGHT_LABEL[weight].about]),
      ...CHECK_CATEGORIES.map((category) => CHECK_CATEGORY_LABEL[category]),
      ...CHECK_ACTIONS.map((action) => CHECK_ACTION_LABEL[action]),
    ]
    for (const [language, table] of Object.entries(TABLES)) {
      for (const key of keys) expect(table[key]?.trim(), `${language} ${key}`).toBeTruthy()
    }
  })

  it('hands a list of findings every word it says besides the findings, in every language', () => {
    const { weight, category, action, notes, ...own } = CHECK_LIST_WORDS
    expect(weight).toBe(CHECK_WEIGHT_LABEL)
    expect(category).toBe(CHECK_CATEGORY_LABEL)
    expect(action).toBe(CHECK_ACTION_LABEL)
    for (const [language, table] of Object.entries(TABLES)) {
      for (const key of [...Object.values(own), notes.one, notes.other]) expect(table[key]?.trim(), `${language} ${key}`).toBeTruthy()
      // How many: the count is said, and Show notes says how many it shows.
      for (const key of [own.toLookAt, own.showNotes, notes.one, notes.other]) expect(table[key], `${language} ${key}`).toContain('{count}')
    }
  })

  /** The Conway map's unused interaction is settled three ways: taken away, modelled, or looked at where the two units are. */
  it('settles an unused interaction by removing it, modelling the interface, or opening the two units', () => {
    expect(CHECK_CATALOGUE['check.interactionUnused'].actions).toEqual(['removeInteraction', 'modelInterface', 'openUnits'])
  })

  /** A fix states the contradiction, a review asks, a note states a fact: a question is a review's alone. */
  it('words each kind as its weight: a review\'s fix is asked, a fix\'s and a note\'s are said', () => {
    for (const key of CHECK_KEYS) {
      const { how, weight } = CHECK_CATALOGUE[key]
      for (const [language, table] of Object.entries(TABLES)) {
        expect(table[how]!.includes('?'), `${language} ${key}`).toBe(weight === 'review')
      }
    }
  })

  /** The weights the amendment's table says, so a change to one is a change to the record too. */
  it('weighs the kinds as ADR-0036\'s amendment says', () => {
    const of = (weight: string) => CHECK_KEYS.filter((key) => CHECK_CATALOGUE[key].weight === weight).map((key) => key.slice('check.'.length)).sort()
    expect(of('fix')).toEqual([
      'assignmentEnded', 'assignmentOrphaned', 'conflict', 'dangling', 'danglingEnd', 'drawingLinkMissing', 'kindClash', 'lineOutlivesEnd', 'platformRetiresFirst',
      'reportingAmbiguous', 'reportingDangling', 'reportingLoop', 'scopeTypeGone', 'servedScopeGone', 'successorTooLate', 'unitMisplaced', 'unitTypeEnded', 'unitTypeNowhere',
      // A citation of a principle that is not there (ADR-0041 §10).
      'citationGone',
    ].sort())
    expect(of('note')).toEqual(['interactionUnused', 'notDrawn', 'principleUnused', 'proposal', 'scopeTypeUnserved'])
    expect(of('review')).toHaveLength(CHECK_KEYS.length - 24)
  })

  it('reads a key it does not know as nothing', () => {
    expect(isCheckKey('check.conflict')).toBe(true)
    expect(isCheckKey('techRegister.unrealised')).toBe(false)
    expect(checkEntry('check.interactionUnused')).toMatchObject({ weight: 'note', category: 'teams' })
    expect(checkEntry('check.nothing')).toBeUndefined()
  })
})

describe('groupByCheck', () => {
  const finding = (key: CheckKey, id: string) => ({ key, id })

  it('groups by check, fix before review before note, each weight in the order its first finding came', () => {
    const groups = groupByCheck([
      finding('check.interactionUnused', 'i-1'),
      finding('check.interfaceUndeclared', 'f-1'),
      finding('check.unitOverLimit', 'web'),
      finding('check.interactionUnused', 'i-2'),
      finding('check.unitMisplaced', 'cl'),
      finding('check.interfaceUndeclared', 'f-2'),
      finding('check.notDrawn', 'x'),
    ])
    expect(groups.map((group) => [group.key, group.weight, group.count])).toEqual([
      ['check.unitMisplaced', 'fix', 1],
      ['check.interfaceUndeclared', 'review', 2],
      ['check.unitOverLimit', 'review', 1],
      ['check.interactionUnused', 'note', 2],
      ['check.notDrawn', 'note', 1],
    ])
    expect(groups[1]!.findings.map((one) => one.id)).toEqual(['f-1', 'f-2'])
    expect(groups[1]).toMatchObject({ category: 'teams', entry: CHECK_CATALOGUE['check.interfaceUndeclared'] })
    expect(countByWeight(groups)).toEqual({ fix: 1, review: 3, note: 3 })
  })

  it('groups findings keyed by a kind through the table that keys them', () => {
    const map = [{ kind: 'unused' as const }, { kind: 'overLimit' as const }, { kind: 'unused' as const }]
    const groups = groupByCheck(map, (one) => CONWAY_CHECK[one.kind])
    expect(groups.map((group) => [group.key, group.count])).toEqual([['check.unitOverLimit', 1], ['check.interactionUnused', 2]])
  })

  it('says nothing of nothing', () => {
    expect(groupByCheck([])).toEqual([])
    expect(countByWeight([])).toEqual({ fix: 0, review: 0, note: 0 })
  })
})
