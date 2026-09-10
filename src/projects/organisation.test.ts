/**
 * The organisation record (ADR-0012).
 *
 * Mostly the same ground as `group.test.ts`, deliberately: the two records
 * share their shape and their link rules, and the tests are here to pin that
 * they still agree. What is its own is the fallback — an organisation with no
 * record is the ordinary case, because it is the folder you opened rather than
 * something anyone created.
 */
import { describe, expect, it } from 'vitest'
import {
  isOrganisation, normaliseOrganisation, organisationClient, organisationName,
} from './organisation'
import type { Organisation } from './organisation'

describe('normaliseOrganisation', () => {
  it('trims and drops the fields nobody filled in', () => {
    expect(normaliseOrganisation({ name: '  Acme  ', client: '  ', description: '   ' }))
      .toEqual({ name: 'Acme' })
  })

  it('keeps the client only when it says something the name does not', () => {
    expect(normaliseOrganisation({ name: 'Acme', client: 'Acme Logistics BV' }))
      .toEqual({ name: 'Acme', client: 'Acme Logistics BV' })
  })

  /**
   * A working file travels between people, and this record is committed. A
   * link somebody else typed is somebody else's code the moment it is clicked.
   */
  it('keeps the links that can be rendered and drops the rest', () => {
    expect(normaliseOrganisation({
      name: 'Acme',
      links: [
        { label: 'Wiki', url: ' https://wiki.example.test ' },
        { label: 'Bad', url: 'javascript:alert(1)' },
        { label: '', url: 'https://board.example.test' },
      ],
    })).toEqual({
      name: 'Acme',
      links: [
        { label: 'Wiki', url: 'https://wiki.example.test' },
        { label: 'https://board.example.test', url: 'https://board.example.test' },
      ],
    })
  })

  it('leaves out an empty link list rather than writing one', () => {
    expect(normaliseOrganisation({ name: 'Acme', links: [] })).toEqual({ name: 'Acme' })
  })
})

describe('isOrganisation', () => {
  const organisation = (over: Partial<Organisation> = {}): unknown => ({ name: 'Acme', ...over })

  it('accepts a record with only the name, and one with all of it', () => {
    expect(isOrganisation(organisation())).toBe(true)
    expect(isOrganisation(organisation({
      client: 'Acme BV', description: 'A haulier', links: [{ label: 'Wiki', url: 'https://x.test' }],
    }))).toBe(true)
  })

  /** Somebody cleared the field; that is a record, and the fallback answers. */
  it('accepts a blank name', () => {
    expect(isOrganisation(organisation({ name: '' }))).toBe(true)
  })

  it('refuses what another build wrote differently', () => {
    expect(isOrganisation(undefined)).toBe(false)
    expect(isOrganisation('Acme')).toBe(false)
    expect(isOrganisation([{ name: 'Acme' }])).toBe(false)
    expect(isOrganisation({})).toBe(false)
    expect(isOrganisation(organisation({ client: 7 as unknown as string }))).toBe(false)
    expect(isOrganisation({ name: 'Acme', links: [{ label: 'Wiki' }] })).toBe(false)
  })
})

describe('organisationName', () => {
  it('falls back to the folder name, which is what a person called it', () => {
    expect(organisationName(undefined, 'acme-logistics')).toBe('acme-logistics')
    expect(organisationName({ name: '   ' }, 'acme-logistics')).toBe('acme-logistics')
  })

  it('uses the record once there is one', () => {
    expect(organisationName({ name: 'Acme Logistics' }, 'acme')).toBe('Acme Logistics')
  })
})

describe('organisationClient', () => {
  it('makes the drawing out to the organisation when there is no other answer', () => {
    expect(organisationClient({ name: 'Acme' }, 'acme')).toBe('Acme')
    expect(organisationClient(undefined, 'acme')).toBe('acme')
  })

  it('prefers the client the record carries', () => {
    expect(organisationClient({ name: 'Acme', client: 'Acme Logistics BV' }, 'acme'))
      .toBe('Acme Logistics BV')
  })
})
