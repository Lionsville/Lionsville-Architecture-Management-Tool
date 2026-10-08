// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The merge screen's wiring (ADR-0035): what is picked and which survives,
 * what it says, which links move, and where the merge lands — this scope's
 * own step where it writes only this scope, the page's change across where it
 * writes any other. Over a small fictional tree: a harbour, its north quay
 * and its south quay, with the north quay open.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { translator } from '../../i18n'
import type { Cause, Observation, ScopeAnalysis, Solution } from '../../model/observation'
import type { ChangeAcross, ChangedAcross, ObservationWork } from './ObservationsPage'
import { MERGE_HIT_LIMIT, useMerge } from './useMerge'
import type { MergeDeps } from './useMerge'

afterEach(() => cleanup())

const t = translator('en')
const observation = (id: string, number: number, over: Partial<Observation> = {}): Observation => ({
  id, number, title: `Crane ${id} idle`, date: '2026-09-10', impact: 'minor', seen: 1, body: `Seen at ${id}.`,
  history: [{ date: '2026-09-10', kind: 'recorded' }], ...over,
})
const cause = (id: string, number: number, over: Partial<Cause> = {}): Cause => ({
  id, number, title: `Why ${id}`, state: 'assumed', body: '', explains: [], ...over,
})
const solution = (id: string, causeId: string): Solution => ({
  id, number: 1, title: 'Second shift', state: 'idea', addresses: [{ id: causeId, strength: 'strong' }],
  validatedWith: [], attempts: [], body: '', history: [],
})
const scope = (path: string, over: Partial<ScopeAnalysis> = {}): ScopeAnalysis => ({
  scope: path, observations: [], causes: [], solutions: [], experiments: [], ...over,
})

const north = scope('north', {
  observations: [
    observation('n1', 1, { where: 'Quay four', by: 'Ines' }),
    observation('n2', 2, { date: '2026-09-02', impact: 'major', seen: 3, by: 'Tom' }),
  ],
  causes: [
    cause('c1', 1, { explains: [{ id: 'n2', strength: 'weak' }] }),
    cause('c2', 2, { explains: [{ id: 'n1', strength: 'normal' }, { id: 'n2', strength: 'strong' }] }),
    cause('c3', 3, { root: true, explains: [{ id: 'c1', strength: 'normal' }] }),
  ],
})
const south = scope('south', { observations: [observation('s1', 1, { seen: 2 })] })
const harbour = scope('', { observations: [observation('h1', 1)] })
const label = (path: string) => (path === '' ? 'Harbour' : path === 'north' ? 'North quay' : 'South quay')

function mount(over: Partial<MergeDeps> = {}) {
  const commit = vi.fn<(next: Partial<ObservationWork>) => void>()
  const select = vi.fn<(key: string) => void>()
  const deps: MergeDeps = {
    here: 'north', scopes: [north, south, harbour], readOnly: false, commit, today: () => '2026-10-08', t,
    scopeLabel: label, day: (date) => `on ${date}`, select, ...over,
  }
  const hook = renderHook((props: MergeDeps) => useMerge(props), { initialProps: deps })
  const state = () => hook.result.current.state!
  return { ...hook, state, commit, select, deps }
}

describe('useMerge, inside the open scope', () => {
  it('opens on the record it was asked for, which survives, and says nothing can be merged yet', () => {
    const { result, state } = mount()
    expect(result.current.state).toBeUndefined()
    act(() => result.current.open('observation', { scope: 'north', id: 'n1' }))
    expect(state().picked.map((one) => [one.label, one.survivor])).toEqual([['OB-0001', true]])
    expect(state().hits.map((one) => [one.label, one.picked])).toEqual([['OB-0002', false], ['OB-0001', true]])
    expect(state().confirm.blocked).toBe(t('observation.mergeNothing'))
  })

  it('picks another, chooses the survivor, keeps the earliest day, sums the sightings and lands as one step here', () => {
    const { result, state, commit, select } = mount()
    act(() => result.current.open('observation', { scope: 'north', id: 'n1' }))
    act(() => state().toggle({ scope: 'north', id: 'n2' }))
    expect(state().confirm).toMatchObject({ label: 'Merge 1 observation into OB-0001', busy: false })
    expect(state().confirm.blocked).toBeUndefined()
    expect(state().seen).toBe(4)
    const date = state().fields.find((one) => one.key === 'date')!
    expect(date.value).toBe('2026-09-02')
    expect(date.options.map((one) => one.said)).toEqual(['on 2026-09-10', 'on 2026-09-02'])
    // A value only one record has is offered once; none where nobody wrote one.
    expect(state().fields.find((one) => one.key === 'where')!.options.map((one) => one.label)).toEqual(['OB-0001'])
    expect(state().fields.find((one) => one.key === 'impact')!.options.map((one) => one.said)).toEqual(['Minor', 'Major'])

    act(() => state().setField('title', 'Cranes idle on the night shift'))
    act(() => state().setField('impact', 'major'))
    act(() => state().setField('impact', 'nonsense'))
    act(() => state().setField('by', 'Tom'))
    act(() => state().addOthers!())
    expect(state().addOthers).toBeUndefined()
    expect(state().body).toBe('Seen at n1.\n\n## Merged from OB-0002\n\nSeen at n2.\n')

    // What both had links to, offered once at the stronger; a link may be left behind.
    const both = state().links.find((one) => one.key === 'explains:north#c2>north#n2')!
    expect(both).toMatchObject({ both: true, offered: 'strong', moves: true })
    act(() => state().setLink('explains:north#c1>north#n2', { move: false }))
    expect(state().links.find((one) => one.key === 'explains:north#c1>north#n2')!.moves).toBe(false)

    act(() => state().confirm.run())
    const next = commit.mock.calls[0]![0]
    const survivor = next.observations!.find((one) => one.id === 'n1')!
    expect(survivor).toMatchObject({ title: 'Cranes idle on the night shift', impact: 'major', by: 'Tom', date: '2026-09-02', seen: 4 })
    expect(next.causes!.find((one) => one.id === 'c1')!.explains).toEqual([{ id: 'n2', strength: 'weak' }])
    expect(next.causes!.find((one) => one.id === 'c2')!.explains).toEqual([{ id: 'n1', strength: 'strong' }])
    expect(select).toHaveBeenCalledWith('n1')
    expect(result.current.state).toBeUndefined()
  })

  it('moves the survivor to the next one picked when it is taken out, and keeps at least one', () => {
    const { result, state } = mount()
    act(() => result.current.open('observation', { scope: 'north', id: 'n1' }))
    act(() => state().toggle({ scope: 'north', id: 'n1' }))
    expect(state().picked).toHaveLength(1)
    act(() => state().toggle({ scope: 'north', id: 'n2' }))
    act(() => state().choose({ scope: 'north', id: 'n2' }))
    act(() => state().choose({ scope: 'south', id: 's1' }))
    expect(state().picked.find((one) => one.survivor)!.label).toBe('OB-0002')
    act(() => state().toggle({ scope: 'north', id: 'n2' }))
    expect(state().picked.map((one) => [one.at.id, one.survivor])).toEqual([['n1', true]])
  })

  it('searches across scopes on asking, nearest first, each hit naming its scope', () => {
    const { result, state } = mount()
    act(() => result.current.open('observation', { scope: 'north', id: 'n1' }))
    act(() => state().setAcross(true))
    expect(state().hits.map((one) => `${one.label} ${one.scopeName ?? ''}`.trim())).toEqual([
      'OB-0002', 'OB-0001', 'OB-0001 Harbour', 'OB-0001 South quay',
    ])
    act(() => state().setQuery('n2'))
    expect(state().hits.map((one) => one.at.id)).toEqual(['n2'])
  })

  it('lists no more than its limit, and says how many more there are', () => {
    const many = scope('north', { observations: Array.from({ length: MERGE_HIT_LIMIT + 3 }, (_, at) => observation(`m${at}`, at + 1)) })
    const { result, state } = mount({ scopes: [many] })
    act(() => result.current.open('observation', { scope: 'north', id: 'm0' }))
    expect(state().hits).toHaveLength(MERGE_HIT_LIMIT)
    expect(state().more).toBe(3)
  })

  it('merges causes: the root step’s refusal, a link that cannot move, and a verified cause that says why', () => {
    const roots = scope('north', {
      causes: [
        cause('c1', 1, { root: true }),
        cause('c2', 2),
        cause('c4', 4, { explains: [{ id: 'c2', strength: 'normal' }] }),
      ],
      solutions: [solution('so1', 'c1')],
    })
    const { result, state } = mount({ scopes: [roots] })
    act(() => result.current.open('cause', { scope: 'north', id: 'c2' }))
    act(() => state().toggle({ scope: 'north', id: 'c1' }))
    expect(state().fields.map((one) => one.key)).toEqual(['title', 'state', 'root'])
    expect(state().fields.find((one) => one.key === 'root')!.options.map((one) => one.said)).toEqual(['Not a root cause', 'Root cause'])
    expect(state().seen).toBeUndefined()
    const addressed = state().links.find((one) => one.kind === 'addresses')!
    expect(addressed.refusal).toBe('notRoot')
    act(() => state().setField('root', 'true'))
    expect(state().confirm.blocked).toBe(t('command.rootExplained'))
    act(() => state().setField('root', 'false'))
    act(() => state().setField('state', 'verified'))
    expect(state().confirm.blocked).toBe(t('observation.mergeUnverified'))
    act(() => state().setField('state', 'maybe'))
    expect(state().confirm.label).toBe('Merge 1 cause into CA-0002')
  })
})

describe('useMerge, across scopes', () => {
  it('hands a merge that writes another scope to the change across, planned again over what it reads, and says where it went', async () => {
    const onChangeAcross = vi.fn<ChangeAcross>(async () => ({ ok: true, changed: ['south', 'north'] }))
    const { result, state, commit, select } = mount({ onChangeAcross })
    act(() => result.current.open('observation', { scope: 'south', id: 's1' }))
    act(() => state().toggle({ scope: 'north', id: 'n1' }))
    expect(state().confirm.blocked).toBeUndefined()
    act(() => state().confirm.run())
    await waitFor(() => expect(result.current.note).toContain('It changed South quay and North quay'))
    expect(commit).not.toHaveBeenCalled()
    expect(select).not.toHaveBeenCalled()
    const [paths, change] = onChangeAcross.mock.calls[0]!
    expect(paths).toEqual(['', 'north', 'south'])
    const work = (one: ScopeAnalysis): ObservationWork => ({
      observations: [...one.observations], causes: [...one.causes], solutions: [...one.solutions], experiments: [],
    })
    const held = new Map([['', work(harbour)], ['north', work(north)], ['south', work(south)]])
    const written = change(held) as ReadonlyMap<string, ObservationWork>
    expect([...written.keys()]).toEqual(['south', 'north'])
    expect(written.get('north')!.observations[0]!.history.at(-1)).toEqual({ date: '2026-10-08', kind: 'merged', id: 's1', scope: 'south' })
    // Over a scope that moved so the merge no longer holds, it is refused rather than made.
    held.set('north', { ...work(north), observations: [] })
    expect(change(held)).toEqual({ refused: 'missing' })
    act(() => result.current.clearNote())
    expect(result.current.note).toBeUndefined()
  })

  it('selects a survivor below once it lands, and keeps the screen up where nothing was merged', async () => {
    let answer: ChangedAcross = { ok: false, reason: 'shell.scopeMoved' }
    const onChangeAcross = vi.fn<ChangeAcross>(async () => answer)
    const { result, state, select } = mount({ here: '', onChangeAcross })
    act(() => result.current.open('observation', { scope: 'north', id: 'n1' }))
    act(() => state().toggle({ scope: '', id: 'h1' }))
    act(() => state().confirm.run())
    await waitFor(() => expect(result.current.note).toContain('Try again'))
    expect(result.current.state).toBeDefined()
    answer = { ok: true, changed: ['north', ''] }
    act(() => state().confirm.run())
    await waitFor(() => expect(select).toHaveBeenCalledWith('north#n1'))
    expect(result.current.state).toBeUndefined()
  })

  it('says nothing was merged where the change across fails outright', async () => {
    const onChangeAcross = vi.fn<ChangeAcross>(async () => { throw new Error('offline') })
    const { result, state } = mount({ onChangeAcross })
    act(() => result.current.open('observation', { scope: 'north', id: 'n1' }))
    act(() => state().toggle({ scope: 'south', id: 's1' }))
    act(() => state().confirm.run())
    await waitFor(() => expect(result.current.note).toBe('Nothing was merged.'))
    expect(state().confirm.busy).toBe(false)
  })

  it('lists a record of a scope that may only be read, cannot merge it, and says why', () => {
    const { result, state } = mount({ writable: (path) => path !== 'south', onChangeAcross: vi.fn<ChangeAcross>() })
    act(() => result.current.open('observation', { scope: 'north', id: 'n1' }))
    act(() => state().setAcross(true))
    expect(state().hits.find((one) => one.at.scope === 'south')!.closed).toBe('You may read South quay, not change it.')
    act(() => state().toggle({ scope: 'south', id: 's1' }))
    expect(state().confirm.blocked).toContain('You may read South quay, but not change it')
  })

  it('does nothing on Merge where it is blocked, or writes elsewhere with no way to', () => {
    const { result, state, commit } = mount()
    act(() => result.current.open('observation', { scope: 'north', id: 'n1' }))
    act(() => state().confirm.run())
    act(() => state().toggle({ scope: 'south', id: 's1' }))
    expect(state().confirm.blocked).toBe(t('observation.mergeNotFromHere'))
    act(() => state().confirm.run())
    expect(commit).not.toHaveBeenCalled()
    act(() => state().close())
    expect(result.current.state).toBeUndefined()
  })
})
