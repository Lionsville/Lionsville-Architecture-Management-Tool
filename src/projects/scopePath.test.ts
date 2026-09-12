import { describe, expect, it } from 'vitest'
import {
  ancestorScopes, isReservedScopeName, isSafeScopePath, isWithinScope, joinScope, parentScope,
  RESERVED_SCOPE_NAMES, ROOT_SCOPE, scopePathFor, scopePathLabel, scopeSegments,
} from './scopePath'

describe('scopeSegments', () => {
  it('splits a path into its segments', () => {
    expect(scopeSegments('acme/rail/rolling-stock')).toEqual(['acme', 'rail', 'rolling-stock'])
  })

  it('gives the root no segments at all', () => {
    expect(scopeSegments(ROOT_SCOPE)).toEqual([])
  })
})

describe('parentScope', () => {
  it('drops the last segment', () => {
    expect(parentScope('acme/rail/rolling-stock')).toBe('acme/rail')
  })

  it('answers the root for a scope one level down', () => {
    expect(parentScope('acme')).toBe(ROOT_SCOPE)
  })

  /** The one scope that has none, which is what makes it the organisation. */
  it('answers undefined for the root itself', () => {
    expect(parentScope(ROOT_SCOPE)).toBeUndefined()
  })
})

describe('ancestorScopes', () => {
  it('walks up, nearest first, and ends at the root', () => {
    expect(ancestorScopes('acme/rail/rolling-stock')).toEqual(['acme/rail', 'acme', ROOT_SCOPE])
  })

  it('has nothing above the root', () => {
    expect(ancestorScopes(ROOT_SCOPE)).toEqual([])
  })
})

describe('joinScope', () => {
  it('files a name under its parent', () => {
    expect(joinScope('acme', 'rail')).toBe('acme/rail')
  })

  it('files a name under the root without a leading slash', () => {
    expect(joinScope(ROOT_SCOPE, 'acme')).toBe('acme')
  })
})

describe('isWithinScope', () => {
  it('counts a scope as within itself', () => {
    expect(isWithinScope('acme/rail', 'acme/rail')).toBe(true)
  })

  it('counts a scope filed beneath one', () => {
    expect(isWithinScope('acme/rail/rolling-stock', 'acme')).toBe(true)
  })

  it('does not count a sibling whose name merely starts the same', () => {
    expect(isWithinScope('acme-rail', 'acme')).toBe(false)
  })

  it('counts everything as within the root', () => {
    expect(isWithinScope('acme/rail', ROOT_SCOPE)).toBe(true)
    expect(isWithinScope(ROOT_SCOPE, ROOT_SCOPE)).toBe(true)
  })
})

describe('isSafeScopePath', () => {
  it('accepts the root, which is a scope like any other', () => {
    expect(isSafeScopePath(ROOT_SCOPE)).toBe(true)
  })

  it('accepts a nested path of slugs', () => {
    expect(isSafeScopePath('acme/rail/rolling-stock-2')).toBe(true)
  })

  /** A path reaches a store from a preferences blob and from an IPC message. */
  it('refuses a path that could walk out of its own folder', () => {
    expect(isSafeScopePath('../elsewhere')).toBe(false)
    expect(isSafeScopePath('acme/../../etc')).toBe(false)
    expect(isSafeScopePath('/absolute')).toBe(false)
    expect(isSafeScopePath('acme\\rail')).toBe(false)
  })

  it('refuses a path that is not a run of slugs', () => {
    expect(isSafeScopePath('Acme')).toBe(false)
    expect(isSafeScopePath('acme rail')).toBe(false)
    expect(isSafeScopePath('acme//rail')).toBe(false)
    expect(isSafeScopePath('acme/')).toBe(false)
    expect(isSafeScopePath(42)).toBe(false)
  })

  it('refuses a segment the scope folder already uses', () => {
    for (const reserved of RESERVED_SCOPE_NAMES) {
      expect(isSafeScopePath(reserved), reserved).toBe(false)
      expect(isSafeScopePath(`acme/${reserved}`), `acme/${reserved}`).toBe(false)
    }
  })

  it('allows a name that merely contains a reserved word', () => {
    expect(isSafeScopePath('decisions-board')).toBe(true)
  })
})

describe('isReservedScopeName', () => {
  it('knows the six folders a scope writes into', () => {
    expect(RESERVED_SCOPE_NAMES).toEqual(['diagrams', 'docs', 'decisions', 'transitions', 'images', 'logos'])
    expect(isReservedScopeName('images')).toBe(true)
    expect(isReservedScopeName('imagery')).toBe(false)
  })
})

describe('scopePathLabel', () => {
  it('is the segment the scope is filed under', () => {
    expect(scopePathLabel('acme/rail')).toBe('rail')
  })

  it('is empty for the root, which the store names from its folder', () => {
    expect(scopePathLabel(ROOT_SCOPE)).toBe('')
  })
})

describe('scopePathFor', () => {
  it('slugs a typed name under its parent', () => {
    expect(scopePathFor('acme', 'Rolling Stock')).toBe('acme/rolling-stock')
  })

  it('files a first scope directly under the root', () => {
    expect(scopePathFor(ROOT_SCOPE, 'Acme Logistics')).toBe('acme-logistics')
  })

  it('does not land on a name already taken under that parent', () => {
    expect(scopePathFor('acme', 'Rail', ['rail'])).toBe('acme/rail-2')
    expect(scopePathFor('acme', 'Rail', ['rail', 'rail-2'])).toBe('acme/rail-3')
  })

  /**
   * The refusal a person should see is about the name they typed and belongs in
   * the dialog; an address still has to be one the store will take.
   */
  it('suffixes a name that slugs to a reserved word', () => {
    expect(scopePathFor('acme', 'Decisions')).toBe('acme/decisions-2')
  })

  it('makes a path the seam will accept', () => {
    expect(isSafeScopePath(scopePathFor('acme', 'Rolling Stock!'))).toBe(true)
    expect(isSafeScopePath(scopePathFor(ROOT_SCOPE, 'Images'))).toBe(true)
  })
})
