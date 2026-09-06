/**
 * Addressing. Small, and worth its own suite because a ref is the one piece of
 * this app that travels: into a storage key, out of stored preferences, and —
 * once there is a desktop build — across an IPC boundary and onto a filesystem.
 */
import { describe, expect, it } from 'vitest'
import { groupSegments, isGroupPath, isProjectRef, refFor, refPath, sameRef } from './projectRef'

describe('groupSegments', () => {
  it('reads a single group as one segment', () => {
    expect(groupSegments('acme')).toEqual(['acme'])
  })

  it('reads a nested group as its parts — this is why group is a path', () => {
    expect(groupSegments('acme/rail/planning')).toEqual(['acme', 'rail', 'planning'])
  })

  it('drops empty segments so a stray slash cannot make a nameless level', () => {
    expect(groupSegments('/acme//rail/')).toEqual(['acme', 'rail'])
  })

  it('reads an empty group as no segments at all', () => {
    expect(groupSegments('')).toEqual([])
  })
})

describe('refPath', () => {
  it('joins group and project the way a folder would', () => {
    expect(refPath({ group: 'acme', project: 'landscape' })).toBe('acme/landscape')
  })

  it('keeps a nested group nested', () => {
    expect(refPath({ group: 'acme/rail', project: 'landscape' })).toBe('acme/rail/landscape')
  })
})

describe('sameRef', () => {
  it('matches on both halves', () => {
    expect(sameRef({ group: 'a', project: 'b' }, { group: 'a', project: 'b' })).toBe(true)
    expect(sameRef({ group: 'a', project: 'b' }, { group: 'a', project: 'c' })).toBe(false)
    expect(sameRef({ group: 'a', project: 'b' }, { group: 'x', project: 'b' })).toBe(false)
  })
})

describe('isProjectRef', () => {
  it('accepts a plain ref', () => {
    expect(isProjectRef({ group: 'acme', project: 'landscape' })).toBe(true)
  })

  it('accepts a nested group', () => {
    expect(isProjectRef({ group: 'acme/rail', project: 'landscape' })).toBe(true)
  })

  it.each([
    ['no group', { group: '', project: 'landscape' }],
    ['no project', { group: 'acme', project: '' }],
    ['a group of only slashes', { group: '//', project: 'landscape' }],
    ['an uppercase segment', { group: 'Acme', project: 'landscape' }],
    ['a space', { group: 'acme corp', project: 'landscape' }],
    ['a dot segment', { group: '.', project: 'landscape' }],
    ['a traversal', { group: 'acme', project: '..' }],
    ['a slash in the project key', { group: 'acme', project: 'a/b' }],
    ['a non-string half', { group: 'acme', project: 3 }],
    ['nothing', undefined],
    ['a string', 'acme/landscape'],
  ])('refuses %s', (_name, value) => {
    expect(isProjectRef(value)).toBe(false)
  })

  it('refuses a traversal, which is the point of checking at all', () => {
    // A store that keeps projects in folders would otherwise be asked to write
    // outside its own directory. Refusing here means no adapter has to sanitise.
    expect(isProjectRef({ group: '../..', project: 'passwd' })).toBe(false)
  })
})

describe('refFor', () => {
  it('slugs both halves', () => {
    expect(refFor('Acme Logistics', 'Application Landscape'))
      .toEqual({ group: 'acme-logistics', project: 'application-landscape' })
  })

  it('produces something isProjectRef accepts', () => {
    expect(isProjectRef(refFor('Acme Corp.', 'Landschap Één'))).toBe(true)
  })

  it('keeps a nested group name nested', () => {
    expect(refFor('Acme/Rail Division', 'Landscape').group).toBe('acme/rail-division')
  })

  it('shifts a project key that is already taken in that group', () => {
    expect(refFor('Acme', 'Landscape', ['landscape']).project).toBe('landscape-2')
    expect(refFor('Acme', 'Landscape', ['landscape', 'landscape-2']).project).toBe('landscape-3')
  })

  it('leaves a free key alone', () => {
    expect(refFor('Acme', 'Landscape', ['something-else']).project).toBe('landscape')
  })

  it('still yields a usable ref for a name that slugs away to nothing', () => {
    const ref = refFor('!!!', '???')
    expect(isProjectRef(ref)).toBe(true)
  })
})

describe('isGroupPath', () => {
  it('accepts what a group may be addressed by', () => {
    expect(isGroupPath('acme')).toBe(true)
    expect(isGroupPath('acme/rail')).toBe(true)
  })

  it('refuses what could escape its own folder, or address nothing', () => {
    expect(isGroupPath('')).toBe(false)
    expect(isGroupPath('/')).toBe(false)
    expect(isGroupPath('../secrets')).toBe(false)
    expect(isGroupPath('acme rail')).toBe(false)
    expect(isGroupPath(42)).toBe(false)
  })
})
