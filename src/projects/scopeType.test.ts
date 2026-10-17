// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's type from the operating model (ADR-0036, amended 17 October
 * 2026): the one rule, as the picker, the link and the checks read it.
 */
import { describe, expect, it } from 'vitest'
import { typeChoiceOf, typeChosen, typedByKind, typedByUnitType, typeLinkOf, typeToFollow } from './scopeType'

const known = (id: string) => ['ut-domain', 'ut-team'].includes(id)

describe('how a scope\'s type stands to the units that serve it', () => {
  it('agrees where a serving unit is of its type, disagrees where none is, and says unserved, gone or unsaid otherwise', () => {
    expect(typeLinkOf({ unitTypeId: 'ut-team' }, ['ut-domain', 'ut-team'], known)).toBe('agrees')
    expect(typeLinkOf({ unitTypeId: 'ut-team' }, ['ut-domain'], known)).toBe('disagrees')
    expect(typeLinkOf({ unitTypeId: 'ut-team' }, [], known)).toBe('unserved')
    expect(typeLinkOf({ unitTypeId: 'ut-gone' }, ['ut-team'], known)).toBe('gone')
    expect(typeLinkOf({ kind: 'domain' }, ['ut-team'], known)).toBe('unsaid')
    expect(typeLinkOf({}, [], known)).toBe('unsaid')
  })
})

describe('the type a scope follows when a unit is linked to it', () => {
  it('takes the unit\'s type where the scope says none, or one no serving unit is of', () => {
    expect(typeToFollow({}, 'ut-team', ['ut-team'])).toBe('ut-team')
    expect(typeToFollow({ kind: 'domain' }, 'ut-team', ['ut-team'])).toBe('ut-team')
    expect(typeToFollow({ unitTypeId: 'ut-domain' }, 'ut-team', ['ut-team'])).toBe('ut-team')
  })

  it('leaves a type that still agrees with a unit serving it, one that is the unit\'s already, and follows a unit with no type nowhere', () => {
    expect(typeToFollow({ unitTypeId: 'ut-domain' }, 'ut-team', ['ut-domain', 'ut-team'])).toBeUndefined()
    expect(typeToFollow({ unitTypeId: 'ut-team' }, 'ut-team', ['ut-team'])).toBeUndefined()
    expect(typeToFollow({}, undefined, [])).toBeUndefined()
    expect(typeToFollow({}, '', [])).toBeUndefined()
  })
})

describe('the picker\'s one value', () => {
  it('holds the unit type first, else the kind, else nothing, and reads back as a patch that sets one and clears the other', () => {
    expect(typeChoiceOf({ unitTypeId: 'ut-team', kind: 'domain' })).toBe('unit:ut-team')
    expect(typeChoiceOf({ kind: 'domain' })).toBe('kind:domain')
    expect(typeChoiceOf({})).toBe('')
    expect(typeChosen('unit:ut-team')).toEqual({ unitTypeId: 'ut-team', kind: undefined })
    expect(typeChosen('kind:programme')).toEqual({ kind: 'programme', unitTypeId: undefined })
    expect(typeChosen('')).toEqual({ kind: undefined, unitTypeId: undefined })
    expect(typeChosen('unit:')).toEqual({ kind: undefined, unitTypeId: undefined })
    expect(typedByUnitType('ut-team')).toEqual(typeChosen('unit:ut-team'))
    expect(typedByKind('team')).toEqual(typeChosen('kind:team'))
  })
})
