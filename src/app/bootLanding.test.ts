// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the first paint lands, and which dialog an address may open over it —
 * and a place the fragment carries (ADR-0033), which wins over both.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { laidOut } from '../model/testFixtures'
import type { Place } from '../agent/place'
import type { ScopeSnapshot } from '../projects/scope'
import {
  BOOT_READ_MS, bootDecidedBy, dialogAsked, initialPageFor, landedAt, landingOf, placeLanding, placeToRead,
  readPlaceScope, reopened, scopeToRead, withoutDialog,
} from './bootLanding'
import type { PlaceScope } from './bootLanding'
import { heldRepositories } from './testing/heldRepositories'

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


describe('a place in the address (ADR-0033)', () => {
  afterEach(() => { vi.useRealTimers() })

  const rail = scope('acme/rail', ['one', 'two'])
  const held = (snapshot: ScopeSnapshot, records: Partial<ScopeSnapshot['model']> = {}, above: string[] = []): PlaceScope => {
    const model = { ...snapshot.model, ...records }
    return {
      snapshot: { ...snapshot, model },
      model,
      ancestorDecisions: above.map((id, n) => ({ id, number: n + 1, title: id, status: 'accepted' as const, date: '2026-01-01', body: '', signers: [] })),
    }
  }

  it('wins over a source’s own landing and over the scope this machine had open last', () => {
    const place: Place = { scope: 'acme/rail', page: 'board', id: 'two' }
    expect(bootDecidedBy(place, { scope: 'acme', view: 'x' }, 'finance')).toEqual({ place })
    expect(bootDecidedBy(place, undefined, 'finance')).toEqual({ place })
    expect(bootDecidedBy(undefined, { scope: 'acme', view: 'x' }, 'finance')).toEqual({ read: 'acme' })
    expect(bootDecidedBy(undefined, undefined, 'finance')).toEqual({ read: 'finance' })
  })

  it('reads nothing first for a home, and the scope for anything else', () => {
    expect(placeToRead({ scope: 'acme', page: 'home' })).toBeUndefined()
    expect(placeToRead({ scope: 'acme', page: 'register' })).toBeUndefined()
    expect(placeToRead({ scope: 'acme', page: 'decisions' })).toBe('acme')
    expect(placeToRead({ scope: 'acme' })).toBe('acme')
  })

  it('lands a home on that home, and its page', () => {
    expect(placeLanding(undefined, { scope: 'acme', page: 'home' })).toEqual({ initialHome: 'acme' })
    expect(placeLanding(undefined, { scope: '', page: 'home' })).toEqual({})
    expect(placeLanding(undefined, { scope: '', page: 'technologyRegister' })).toEqual({ initialHomePage: 'technologyRegister' })
    expect(placeLanding(undefined, { scope: 'acme', page: 'register' })).toEqual({ initialHome: 'acme', initialHomePage: 'register' })
  })

  it('opens the view a place names, and the scope’s first view for one that was removed', () => {
    expect(placeLanding(held(rail), { scope: 'acme/rail', page: 'board', id: 'two' }).initialProject?.activeDiagramId).toBe('two')
    expect(placeLanding(held(rail), { scope: 'acme/rail', page: 'board', id: 'gone' }).initialProject?.activeDiagramId).toBe('one')
    expect(placeLanding(held(rail), { scope: 'acme/rail' }).initialProject?.activeDiagramId).toBe('one')
    // A scope that draws nothing has nothing to open on: its home.
    expect(placeLanding(held(scope('acme', [])), { scope: 'acme', page: 'board', id: 'gone' })).toEqual({ initialHome: 'acme' })
  })

  it('opens the page a place names over the scope, on its record, and without one that was removed', () => {
    const decided = held(rail, {
      decisions: [{ id: 'ADR-1', number: 1, title: 'One', status: 'proposed', date: '2026-01-01', body: '', signers: [] }],
    }, ['FROM-ABOVE'])
    expect(placeLanding(decided, { scope: 'acme/rail', page: 'decisions', id: 'ADR-1' }).initialPage).toEqual({ page: 'decisions', id: 'ADR-1' })
    expect(placeLanding(decided, { scope: 'acme/rail', page: 'decisions', id: 'FROM-ABOVE' }).initialPage)
      .toEqual({ page: 'decisions', id: 'FROM-ABOVE' })
    expect(placeLanding(decided, { scope: 'acme/rail', page: 'decisions', id: 'ADR-9' }).initialPage).toEqual({ page: 'decisions' })
    expect(placeLanding(decided, { scope: 'acme/rail', page: 'plan', id: 'TR-9' }).initialPage).toEqual({ page: 'roadmap' })
    expect(placeLanding(held(scope('acme', [])), { scope: 'acme', page: 'observations' }))
      .toMatchObject({ initialPage: { page: 'observations' } })
  })

  it('lands a scope that is not there, or that may not be read, on the organisation’s home', async () => {
    expect(placeLanding(undefined, { scope: 'gone', page: 'board', id: 'x' })).toEqual({})
    expect(await landedAt(Promise.resolve(undefined), { scope: 'gone', page: 'decisions' })).toEqual({})
  })

  it('lands on the scope’s home where the read keeps the first paint waiting', async () => {
    vi.useFakeTimers()
    const landing = landedAt(new Promise<never>(() => undefined), { scope: 'acme/rail', page: 'roadmap' })
    await vi.advanceTimersByTimeAsync(BOOT_READ_MS)
    expect(await landing).toEqual({ initialHome: 'acme/rail' })
  })

  it('reads the scope with the decisions it reads from above', async () => {
    const top = scope('', ['t'])
    const repositories = heldRepositories([
      { ...top, model: { ...top.model, decisions: [{ id: 'TOP-1', number: 1, title: 'Top', status: 'accepted', date: '2026-01-01', body: '', signers: [] }] } },
      scope('acme', ['a']),
      rail,
    ])
    const read = await readPlaceScope(repositories.scopes, 'acme/rail')
    expect(read?.snapshot.path).toBe('acme/rail')
    expect(read?.ancestorDecisions.map((one) => one.id)).toEqual(['TOP-1'])
    expect(await readPlaceScope(repositories.scopes, 'acme/gone')).toBeUndefined()
  })

  it('opens the page a destination names, the same words the agent uses', () => {
    expect(initialPageFor({ page: 'plan' })).toEqual({ page: 'roadmap' })
    expect(initialPageFor({ page: 'document' })).toEqual({ page: 'documentation' })
    expect(initialPageFor({ page: 'home' })).toBeUndefined()
  })
})
