// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The move screen as a person meets it (ADR-0038 §5): full window, three
 * parts, Move saying what it does or why not — read by axe, reached by the
 * keyboard, and clear of the window's own controls. Driven through the hook
 * it is drawn from, over a small fictional quay.
 */
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { translator } from '../../i18n'
import type { WindowChrome } from '../../platform/windowChrome'
import type { Cause, Observation, ScopeAnalysis, Solution } from '../../model/observation'
import type { RecordAt } from '../merge'
import { MovePage } from './MovePage'
import { useMove } from './useMove'
import type { MoveDeps } from './useMove'
import type { ChangeAcross, ObservationWork } from './ObservationsPage'

afterEach(() => cleanup())

const t = translator('en')
const DAY = '2026-10-16'
const observation = (id: string, number: number, over: Partial<Observation> = {}): Observation => ({
  id, number, title: `Crane ${id} idle`, date: '2026-09-10', impact: 'minor', seen: 1, body: `Seen at ${id}.`,
  history: [{ date: '2026-09-10', kind: 'recorded' }], ...over,
})
const cause = (id: string, number: number, over: Partial<Cause> = {}): Cause => ({
  id, number, title: `Why ${id}`, state: 'assumed', body: '', explains: [], ...over,
})
const solution: Solution = {
  id: 'so1', number: 1, title: 'Night shift roster', state: 'idea', addresses: [{ id: 'c2', strength: 'normal' }],
  validatedWith: [], attempts: [], body: '', history: [],
}
const north: ScopeAnalysis = {
  scope: 'north',
  observations: [observation('n1', 1, { seen: 3 }), observation('n2', 2, { archived: true })],
  causes: [cause('c1', 1, { explains: [{ id: 'n1', strength: 'strong' }] }), cause('c2', 2, { root: true, explains: [{ id: 'c1', strength: 'normal' }] })],
  solutions: [solution], experiments: [],
  comments: [{ id: 'cm-1', about: { kind: 'observation', id: 'n1' }, by: { person: 'pe-1' }, at: `${DAY}T09:00:00Z`, body: 'At night too' }],
}
const south: ScopeAnalysis = { scope: 'south', observations: [observation('s1', 1), observation('s4', 4)], causes: [], solutions: [], experiments: [], comments: [] }
const NAMES: Record<string, string> = { '': 'Port', north: 'North quay', south: 'South quay', 'south/east': 'East berth', west: 'West quay' }

function Harness({ id, deps }: { id: string; deps: MoveDeps }) {
  const move = useMove(deps)
  const { open } = move
  const record = deps.scopes.find((one) => one.scope === deps.here)!.observations.find((one) => one.id === id)!
  useEffect(() => open(record), [open, record])
  return <MovePage state={move.state} note={move.note} onNoteClose={move.clearNote} s={t} />
}

function mount(id = 'n1', over: Partial<MoveDeps> = {}) {
  const onMoved = vi.fn<(to: RecordAt) => void>()
  const deps: MoveDeps = {
    here: 'north', scopes: [north, south], paths: ['', 'north', 'south', 'south/east', 'west'], readOnly: false, today: () => DAY, t,
    scopeLabel: (path) => NAMES[path] ?? path, scopeTrail: (path) => (path === 'south/east' ? 'South quay › East berth' : NAMES[path] ?? path),
    onMoved, ...over,
  }
  renderShell(<Harness id={id} deps={deps} />)
  return { onMoved, page: () => within(screen.getByRole('dialog', { name: 'Move an observation to another scope' })) }
}

/** A host that writes several scopes: what each scope became. */
function host(held: Map<string, ObservationWork>) {
  const written = new Map<string, ObservationWork>()
  const changeAcross = vi.fn<ChangeAcross>((paths, change) => {
    const next = change(new Map(paths.flatMap((path) => (held.has(path) ? [[path, held.get(path)!] as const] : []))))
    if (next === undefined) return Promise.resolve({ ok: false, reason: 'unchanged' })
    if ('refused' in next) return Promise.resolve({ ok: false, reason: 'refused', refused: next.refused })
    for (const [path, lists] of next) written.set(path, lists)
    return Promise.resolve({ ok: true, changed: [...next.keys()] })
  })
  return { written, changeAcross }
}
const work = ({ scope: _scope, ...lists }: ScopeAnalysis): ObservationWork => ({
  observations: [...lists.observations], causes: [...lists.causes], solutions: [...lists.solutions], experiments: [...lists.experiments],
  comments: [...lists.comments ?? []],
})
const empty = (scope: string): ScopeAnalysis => ({ scope, observations: [], causes: [], solutions: [], experiments: [], comments: [] })

describe('the move screen, as axe and the keyboard read it', () => {
  it('finds nothing, with a scope picked and a link cut', async () => {
    const { changeAcross } = host(new Map())
    const { page } = mount('n1', { onChangeAcross: changeAcross })
    fireEvent.click(within(page().getByTestId('move-target-south')).getByRole('radio'))
    expect(page().getAllByTestId('move-cut')).toHaveLength(1)
    expect(await axeFindings()).toEqual([])
  })

  it('reaches every control from the keyboard', () => {
    const { changeAcross } = host(new Map())
    const { page } = mount('n1', { onChangeAcross: changeAcross })
    fireEvent.click(within(page().getByTestId('move-target-south')).getByRole('radio'))
    const dialog = screen.getByRole('dialog', { name: 'Move an observation to another scope' })
    for (const name of ['move.search', 'move.confirm']) {
      const control = dialog.querySelector<HTMLElement>(`[data-guide="${name}"]`)!
      expect(['INPUT', 'BUTTON']).toContain(control.tagName)
      expect([name, control.tabIndex >= 0]).toEqual([name, true])
    }
  })
})

describe('the move screen', () => {
  it('offers every other scope by its path, nearest first, finds one by what it is called, and says why Move waits', () => {
    const { page } = mount('n1', { writable: (path) => path !== 'west' })
    const rows = page().getAllByTestId(/^move-target-/).map((one) => one.getAttribute('data-testid'))
    expect(rows).toEqual(['move-target-', 'move-target-south', 'move-target-west', 'move-target-south/east'])
    expect(page().getByTestId('move-target-south/east').textContent).toBe('South quay › East berth')
    // One the person may read and not change is listed and cannot be picked.
    expect(within(page().getByTestId('move-target-west')).getByRole('radio')).toHaveProperty('disabled', true)
    expect(page().getByTestId('move-target-west').textContent).toContain('You may read West quay, not change it.')
    expect(page().getByTestId('move-blocked').textContent).toBe(t('observation.movePick'))
    fireEvent.change(page().getByTestId('move-search'), { target: { value: 'east' } })
    expect(page().getAllByTestId(/^move-target-/).map((one) => one.getAttribute('data-testid'))).toEqual(['move-target-south/east'])
  })

  it('says what moves, what it becomes, the links it cuts and the solutions they reach, before anything is written', () => {
    const { changeAcross } = host(new Map())
    const { page } = mount('n1', { onChangeAcross: changeAcross })
    expect(page().getByTestId('move-record').textContent).toBe('OB-0001 Crane n1 idle')
    expect(page().getByText('Seen 3 times · 1 comment goes with it, saying where it was written')).toBeTruthy()
    fireEvent.click(within(page().getByTestId('move-target-south')).getByRole('radio'))
    expect(page().getByTestId('move-becomes').textContent).toBe('It will be OB-0005 in South quay.')
    expect(page().getAllByTestId('move-cut').map((one) => one.textContent)).toEqual([
      'CA-0001 Why c1 explains itIt leads to a root cause that SO-0001 Night shift roster addresses',
    ])
    expect(page().getByTestId('move-confirm').textContent).toBe('Move OB-0001 to South quay')
    expect(changeAcross).not.toHaveBeenCalled()
  })

  it('moves as one change across both scopes, and closes on the record where it went', async () => {
    const { written, changeAcross } = host(new Map([['', work(empty(''))], ['north', work(north)], ['south', work(south)]]))
    const { page, onMoved } = mount('n1', { onChangeAcross: changeAcross })
    fireEvent.click(within(page().getByTestId('move-target-south')).getByRole('radio'))
    await act(async () => { fireEvent.click(page().getByTestId('move-confirm')) })
    await waitFor(() => expect(onMoved).toHaveBeenCalledWith({ scope: 'south', id: 'n1' }))
    expect(changeAcross.mock.calls[0]![0]).toEqual(['', 'north', 'south'])
    expect(written.get('south')!.observations.at(-1)).toMatchObject({ id: 'n1', number: 5, seen: 3 })
    expect(written.get('north')!.observations[0]!.history.at(-1)).toEqual({ date: DAY, kind: 'moved', id: 'n1', scope: 'south', number: 5 })
    expect(written.get('south')!.comments!.map((one) => one.id)).toEqual(['cm-1'])
    // Closed: what it showed is gone (the dialog itself fades out).
    expect(screen.queryByTestId('move-confirm')).toBeNull()
    expect((await screen.findByTestId('move-note')).textContent).toContain('Moved to OB-0005 in South quay.')
  })

  it('says one sighting and one comment in the singular, and more in the plural, in every language', () => {
    const { changeAcross } = host(new Map())
    const once = { ...north, observations: [observation('n1', 1, { seen: 1 })] }
    const { page } = mount('n1', { onChangeAcross: changeAcross, scopes: [once, south] })
    expect(page().getByText('Seen once · 1 comment goes with it, saying where it was written')).toBeTruthy()
    for (const language of ['en', 'nl', 'de'] as const) {
      const s = translator(language)
      expect(s('observation.moveSeenOne', { count: '1' })).not.toBe(s('observation.moveSeenOther', { count: '1' }))
      expect(s('observation.moveCommentsOther', { count: '2' })).toContain('2')
      expect(s('observation.mergeCommentsOne', { count: '1' })).not.toBe(s('observation.mergeCommentsOther', { count: '1' }))
    }
  })

  it('never says the move it just made is refused while it lands, and closes once it went', async () => {
    // The write reaches the scopes before the host answers, as it does in the app.
    let answer: (() => void) | undefined
    const said: string[] = []
    const onMoved = vi.fn<(to: RecordAt) => void>()
    function Live() {
      const [scopes, setScopes] = useState<ScopeAnalysis[]>([north, south])
      const changeAcross: ChangeAcross = (paths, change) => {
        const held = new Map(scopes.filter((one) => paths.includes(one.scope)).map((one) => [one.scope, work(one)] as const))
        const next = change(held)
        if (next === undefined || 'refused' in next) return Promise.resolve({ ok: false, reason: 'unchanged' })
        setScopes((was) => was.map((one) => (next.has(one.scope) ? { scope: one.scope, ...next.get(one.scope)! } : one)))
        return new Promise((resolve) => { answer = () => resolve({ ok: true, changed: [...next.keys()] }) })
      }
      const move = useMove({
        here: 'north', scopes, paths: ['north', 'south'], readOnly: false, today: () => DAY, t,
        scopeLabel: (path) => NAMES[path] ?? path, onMoved, onChangeAcross: changeAcross,
      })
      const { open } = move
      useEffect(() => open(north.observations[0]!), [open])
      said.push(move.state?.confirm.blocked ?? '')
      return <MovePage state={move.state} note={move.note} onNoteClose={move.clearNote} s={t} />
    }
    renderShell(<Live />)
    const page = within(screen.getByRole('dialog', { name: 'Move an observation to another scope' }))
    fireEvent.click(within(page.getByTestId('move-target-south')).getByRole('radio'))
    await act(async () => { fireEvent.click(page.getByTestId('move-confirm')) })
    // Written, not answered yet: the record is history here, and the screen is gone rather than refusing.
    expect(answer).toBeDefined()
    expect(screen.queryByTestId('move-confirm')).toBeNull()
    await act(async () => { answer!() })
    await waitFor(() => expect(onMoved).toHaveBeenCalledWith({ scope: 'south', id: 'n1' }))
    expect(screen.queryByTestId('move-confirm')).toBeNull()
    expect(said).not.toContain(t('observation.moveMoved'))
    expect(document.body.textContent).not.toContain(t('observation.moveMoved'))
  })

  it('moves into a scope that holds nothing yet', () => {
    const { changeAcross } = host(new Map())
    const { page } = mount('n1', { onChangeAcross: changeAcross })
    fireEvent.click(within(page().getByTestId('move-target-south/east')).getByRole('radio'))
    expect(page().getByTestId('move-becomes').textContent).toBe('It will be OB-0001 in South quay › East berth.')
  })

  it('stays up and says why nothing moved where the scopes changed meanwhile', async () => {
    const { changeAcross } = host(new Map([['', work(empty(''))], ['north', work(north)], ['south', { ...work(south), observations: [observation('n1', 9)] }]]))
    const { page, onMoved } = mount('n1', { onChangeAcross: changeAcross })
    fireEvent.click(within(page().getByTestId('move-target-south')).getByRole('radio'))
    await act(async () => { fireEvent.click(page().getByTestId('move-confirm')) })
    expect((await screen.findByTestId('move-note')).textContent).toBe(`Nothing was moved: ${t('observation.moveTaken')}`)
    expect(onMoved).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Move an observation to another scope' })).toBeTruthy()
  })

  it('cannot be pressed where only this scope may be written from here, or the observation is archived', () => {
    const { page } = mount('n1')
    fireEvent.click(within(page().getByTestId('move-target-south')).getByRole('radio'))
    expect(page().getByTestId('move-blocked').textContent).toBe(t('observation.moveNotFromHere'))
    expect(page().getByTestId('move-confirm')).toHaveProperty('disabled', true)
    cleanup()
    const { changeAcross } = host(new Map())
    const archived = mount('n2', { onChangeAcross: changeAcross })
    fireEvent.click(within(archived.page().getByTestId('move-target-south')).getByRole('radio'))
    expect(archived.page().getByTestId('move-blocked').textContent).toBe(t('observation.moveArchived'))
  })

  it('keeps its top bar clear of the window controls and draggable', () => {
    const chrome = { controlsInset: 78, draggable: true } as WindowChrome
    const { changeAcross } = host(new Map())
    function Chromed() {
      const move = useMove({
        here: 'north', scopes: [north, south], paths: ['north', 'south'], readOnly: false, today: () => DAY, t,
        scopeLabel: (path) => path, onMoved: () => {}, onChangeAcross: changeAcross,
      })
      const { open } = move
      useEffect(() => open(north.observations[0]!), [open])
      return <MovePage state={move.state} s={t} windowChrome={chrome} onNoteClose={() => {}} />
    }
    renderShell(<Chromed />)
    expect(getComputedStyle(screen.getByTestId('move-topbar')).paddingLeft).toBe('90px')
  })
})
