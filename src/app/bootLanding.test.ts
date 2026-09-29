// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the first paint lands, and which dialog an address may open over it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { laidOut } from '../model/testFixtures'
import type { ScopeSnapshot } from '../projects/scope'
import { BOOT_READ_MS, dialogAsked, landingOf, reopened, scopeToRead, withoutDialog } from './bootLanding'

const board = (id: string) => laidOut({ id, kind: 'layer7' as const, name: id, placements: [] })

function scope(path: string, boards: readonly string[]): ScopeSnapshot {
  return {
    path,
    model: { name: path, elements: [], relations: [], diagrams: boards.map(board) },
    activeDiagramId: boards[0] ?? '',
    logoLibrary: [],
  }
}

describe('where the first paint lands', () => {
  const retail = scope('retail', ['one', 'two'])

  it('reopens the scope this machine last had open, as it was, where no address named a place', () => {
    expect(landingOf(retail, undefined)).toEqual({ initialProject: retail })
    // A domain draws nothing: its home, which is the organisation's here.
    expect(landingOf(scope('domain', []), undefined)).toEqual({})
    expect(landingOf(undefined, undefined)).toEqual({})
  })

  it('lands an address that named a scope and no view on that scope’s home, not on a board', () => {
    expect(landingOf(undefined, { scope: 'retail' })).toEqual({ initialHome: 'retail' })
    expect(landingOf(scope('domain', []), { scope: 'domain', view: 'x' })).toEqual({ initialHome: 'domain' })
  })

  it('lands a fresh start a source sent to the root on the organisation’s home', () => {
    expect(landingOf(undefined, { scope: '' })).toEqual({})
  })

  it('opens the view an address named', () => {
    expect(landingOf(retail, { scope: 'retail', view: 'two' }).initialProject?.activeDiagramId).toBe('two')
  })

  it('falls back to the organisation’s home for a board of a scope that is not there', () => {
    expect(landingOf(undefined, { scope: 'gone', view: 'x' })).toEqual({})
  })

  /** A home reads its own document once it is up: the first paint does not wait a round trip for it. */
  it('reads nothing before the first paint for a home, and the scope for a board or a reopening', () => {
    expect(scopeToRead({ scope: '' }, 'retail')).toBeUndefined()
    expect(scopeToRead({ scope: 'retail' }, 'finance')).toBeUndefined()
    expect(scopeToRead({ scope: 'retail', view: 'two' }, 'finance')).toBe('retail')
    expect(scopeToRead(undefined, 'finance')).toBe('finance')
  })
})

describe('a dialog an address asks for', () => {
  it('opens the preferences, and nothing this list does not hold', () => {
    expect(dialogAsked('?open=preferences')).toBe('preferences')
    expect(dialogAsked('?scope=a&open=preferences&view=b')).toBe('preferences')
    expect(dialogAsked('?open=export')).toBeUndefined()
    expect(dialogAsked('')).toBeUndefined()
  })

  it('is taken out of the address, and the rest of it kept', () => {
    expect(withoutDialog('https://example.test/?scope=a&open=preferences&view=b#x')).toBe('/?scope=a&view=b#x')
    expect(withoutDialog('https://example.test/?open=preferences')).toBe('/')
    expect(withoutDialog('https://example.test/?scope=a')).toBeUndefined()
  })
})

describe('the scope the boot reopens', () => {
  afterEach(() => { vi.useRealTimers() })

  it('opens as it was where it is read in time', async () => {
    const held = scope('acme/rail', ['d1'])
    expect(await reopened(Promise.resolve(held), 'acme/rail', undefined)).toEqual({ initialProject: held })
  })

  it('lands on its home where the read keeps the first paint waiting, which picks it up once it answers', async () => {
    vi.useFakeTimers()
    const landing = reopened(new Promise<never>(() => undefined), 'acme/rail', undefined)
    await vi.advanceTimersByTimeAsync(BOOT_READ_MS)
    expect(await landing).toEqual({ initialHome: 'acme/rail' })
  })

  it('lands on the organisation where the organisation was what was waited on', async () => {
    vi.useFakeTimers()
    const landing = reopened(new Promise<never>(() => undefined), '', undefined)
    await vi.advanceTimersByTimeAsync(BOOT_READ_MS)
    expect(await landing).toEqual({})
  })

  it('fails the boot where the read fails in time, as it always did', async () => {
    await expect(reopened(Promise.reject(new Error('torn')), 'acme/rail', undefined)).rejects.toThrow('torn')
  })
})

