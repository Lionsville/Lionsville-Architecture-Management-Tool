import { describe, expect, it } from 'vitest'
import {
  groupProfileFor, isGroupProfile, isSafeGroupLinkUrl, normaliseGroupProfile,
} from './group'
import type { GroupProfile } from './group'

describe('isSafeGroupLinkUrl', () => {
  it('accepts the two protocols a browser can be sent to safely', () => {
    expect(isSafeGroupLinkUrl('https://example.test/wiki')).toBe(true)
    expect(isSafeGroupLinkUrl('http://intranet.example.test')).toBe(true)
    expect(isSafeGroupLinkUrl('  https://example.test  ')).toBe(true)
  })

  /**
   * A working file travels between people. A link somebody else typed is
   * somebody else's code the moment it is clicked, unless the protocol is
   * checked before it becomes an anchor.
   */
  it('refuses anything that would run instead of navigate', () => {
    expect(isSafeGroupLinkUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeGroupLinkUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeGroupLinkUrl('file:///etc/passwd')).toBe(false)
  })

  it('refuses what is not a URL at all', () => {
    expect(isSafeGroupLinkUrl('')).toBe(false)
    expect(isSafeGroupLinkUrl('example.test')).toBe(false)
  })
})

describe('normaliseGroupProfile', () => {
  const profile = (over: Partial<GroupProfile> = {}): GroupProfile =>
    ({ group: 'acme', name: 'Acme', ...over })

  it('trims and drops the fields nobody filled in', () => {
    expect(normaliseGroupProfile(profile({ name: '  Acme  ', description: '   ' })))
      .toEqual({ group: 'acme', name: 'Acme' })
  })

  it('keeps the links that can be rendered and drops the rest', () => {
    const out = normaliseGroupProfile(profile({
      links: [
        { label: ' Wiki ', url: ' https://example.test/wiki ' },
        { label: 'Bad', url: 'javascript:alert(1)' },
        { label: 'Empty', url: '' },
      ],
    }))
    expect(out.links).toEqual([{ label: 'Wiki', url: 'https://example.test/wiki' }])
  })

  it('labels an unlabelled link with its own URL', () => {
    const out = normaliseGroupProfile(profile({
      links: [{ label: '  ', url: 'https://example.test/wiki' }],
    }))
    expect(out.links).toEqual([
      { label: 'https://example.test/wiki', url: 'https://example.test/wiki' },
    ])
  })

  it('leaves out an empty link list rather than storing one', () => {
    expect('links' in normaliseGroupProfile(profile({ links: [] }))).toBe(false)
  })
})

describe('isGroupProfile', () => {
  it('accepts the shapes this app writes', () => {
    expect(isGroupProfile({ group: 'acme', name: 'Acme' })).toBe(true)
    expect(isGroupProfile({
      group: 'acme', name: 'Acme', description: 'Rail', links: [{ label: 'W', url: 'https://x.test' }],
    })).toBe(true)
  })

  it('refuses what could not be addressed or shown', () => {
    expect(isGroupProfile(null)).toBe(false)
    expect(isGroupProfile({ name: 'Acme' })).toBe(false)
    expect(isGroupProfile({ group: '', name: 'Acme' })).toBe(false)
    expect(isGroupProfile({ group: 'acme' })).toBe(false)
    expect(isGroupProfile({ group: 'acme', name: 'Acme', links: [{ label: 'W' }] })).toBe(false)
  })
})

describe('groupProfileFor', () => {
  const stored: GroupProfile[] = [{ group: 'acme', name: 'Acme Logistics', description: 'Rail' }]

  it('finds the record when there is one', () => {
    expect(groupProfileFor('acme', 'Acme', stored))
      .toEqual({ group: 'acme', name: 'Acme Logistics', description: 'Rail' })
  })

  /** Most groups have no record; the derived name is the normal answer. */
  it('falls back to the name derived from the projects', () => {
    expect(groupProfileFor('other', 'Other Dept', stored))
      .toEqual({ group: 'other', name: 'Other Dept' })
  })

  it('does not let a blank stored name produce a blank heading', () => {
    expect(groupProfileFor('acme', 'Acme', [{ group: 'acme', name: '  ' }]).name).toBe('Acme')
  })
})
