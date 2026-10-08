// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The merge screen as a person meets it (ADR-0035 §1): full window, three
 * parts, Merge saying what it makes or why not — read by axe, reached by the
 * keyboard, and clear of the window's own controls. Driven through the hook
 * it is drawn from, over a small fictional quay.
 */
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { translator } from '../../i18n'
import type { WindowChrome } from '../../platform/windowChrome'
import type { Cause, Observation, ScopeAnalysis } from '../observation'
import type { MergeKind } from '../merge'
import { MergePage } from './MergePage'
import { useMerge } from './useMerge'
import type { MergeDeps } from './useMerge'
import type { ObservationWork } from './ObservationsPage'

afterEach(() => cleanup())

const t = translator('en')
const observation = (id: string, number: number, over: Partial<Observation> = {}): Observation => ({
  id, number, title: `Crane ${id} idle`, date: '2026-09-10', impact: 'minor', seen: 1, body: `Seen at ${id}.`,
  history: [{ date: '2026-09-10', kind: 'recorded' }], ...over,
})
const cause = (id: string, number: number, over: Partial<Cause> = {}): Cause => ({
  id, number, title: `Why ${id}`, state: 'assumed', body: '', explains: [], ...over,
})
const north: ScopeAnalysis = {
  scope: 'north',
  observations: [observation('n1', 1, { where: 'Quay four' }), observation('n2', 2, { where: 'Quay five', impact: 'major' })],
  causes: [
    cause('c1', 1, { explains: [{ id: 'n1', strength: 'weak' }, { id: 'n2', strength: 'normal' }] }),
    cause('c2', 2, { root: true, explains: [{ id: 'c3', strength: 'normal' }] }),
    cause('c3', 3),
  ],
  solutions: [], experiments: [],
}
const south: ScopeAnalysis = { scope: 'south', observations: [observation('s1', 1)], causes: [], solutions: [], experiments: [] }

function Harness({ opening, deps, chrome }: { opening: { kind: MergeKind; id: string }; deps: MergeDeps; chrome?: WindowChrome }) {
  const merge = useMerge(deps)
  const { open } = merge
  useEffect(() => open(opening.kind, { scope: 'north', id: opening.id }), [open, opening.kind, opening.id])
  return (
    <MergePage
      state={merge.state} note={merge.note} onNoteClose={merge.clearNote} s={t} renderMarkdown={(md) => <div>{md}</div>}
      {...(chrome ? { windowChrome: chrome } : {})}
    />
  )
}

function mount(opening: { kind: MergeKind; id: string } = { kind: 'observation', id: 'n1' }, over: Partial<MergeDeps> = {}, chrome?: WindowChrome) {
  const commit = vi.fn<(next: Partial<ObservationWork>) => void>()
  const deps: MergeDeps = {
    here: 'north', scopes: [north, south], readOnly: false, commit, today: () => '2026-10-08', t,
    scopeLabel: (path) => (path === 'north' ? 'North quay' : 'South quay'), day: (date) => date, select: () => {}, ...over,
  }
  renderShell(<Harness opening={opening} deps={deps} {...(chrome ? { chrome } : {})} />)
  return { commit, page: () => screen.getByRole('dialog', { name: 'Merge observations' }) }
}

describe('the merge screen, as axe and the keyboard read it', () => {
  it('finds nothing, with a record picked and a link that cannot move', async () => {
    mount({ kind: 'cause', id: 'c3' })
    const page = screen.getByRole('dialog', { name: 'Merge causes' })
    fireEvent.click(within(within(page).getByTestId('merge-hit-north#c2')).getByRole('checkbox'))
    expect(within(page).getAllByTestId('merge-link').length).toBeGreaterThan(0)
    expect(await axeFindings()).toEqual([])
  })

  it('reaches every control from the keyboard: each is a native control, none taken out of the tab order', () => {
    const { page } = mount()
    // Merge is pressed once there is something to merge; until then it says why not, and is out of reach.
    fireEvent.click(within(within(page()).getByTestId('merge-hit-north#n2')).getByRole('checkbox'))
    for (const name of ['merge.search', 'merge.across', 'merge.survivor', 'merge.confirm']) {
      const control = page().querySelector<HTMLElement>(`[data-guide="${name}"]`)!
      expect(['INPUT', 'BUTTON']).toContain(control.tagName)
      expect([name, control.tabIndex >= 0]).toEqual([name, true])
    }
    const search = within(page()).getByTestId('merge-search')
    search.focus()
    expect(document.activeElement).toBe(search)
  })

  it('keeps its top bar clear of the window controls and draggable', () => {
    mount(undefined, {}, { controlsInset: 78, draggable: true })
    const bar = screen.getByTestId('merge-topbar')
    expect(getComputedStyle(bar).paddingLeft).toBe('90px')
    const css = [...document.querySelectorAll('style')].map((tag) => tag.textContent).join('')
    expect(css).toContain('-webkit-app-region:drag')
  })
})

describe('the merge screen', () => {
  it('picks, chooses a value, adds the others’ descriptions, chooses a strength and merges as one step', () => {
    const { page, commit } = mount()
    const merge = within(page())
    expect(merge.getByTestId('merge-blocked').textContent).toBe(t('observation.mergeNothing'))
    expect(merge.getByTestId('merge-confirm')).toHaveProperty('disabled', true)
    fireEvent.click(within(merge.getByTestId('merge-hit-north#n2')).getByRole('checkbox'))
    expect(merge.getByTestId('merge-seen').textContent).toBe('Seen 2 times, all of them together')

    // Each record's value is offered beside the field; the one in it is pressed.
    const quay = merge.getByRole('button', { name: 'OB-0002: Quay five' })
    expect(quay.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(quay)
    expect(merge.getByTestId('merge-field-where')).toHaveProperty('value', 'Quay five')
    fireEvent.change(merge.getByTestId('merge-field-title'), { target: { value: 'Cranes idle at night' } })

    fireEvent.click(merge.getByTestId('merge-add-others'))
    expect(merge.getByTestId('merge-add-others')).toHaveProperty('disabled', true)
    expect((merge.getByTestId('form-description') as HTMLTextAreaElement).value).toContain('## Merged from OB-0002')

    // Both had a link from CA-0001: one row each, the strength chosen where they meet.
    const links = merge.getAllByTestId('merge-link')
    expect(links.map((one) => one.textContent)).toEqual([
      expect.stringContaining('CA-0001 Why c1 explains OB-0002 Crane n2 idle'),
    ])
    expect(within(links[0]!).getByRole('combobox', { name: 'Strength' })).toBeTruthy()

    const confirm = merge.getByTestId('merge-confirm')
    expect(confirm.textContent).toBe('Merge 1 observation into OB-0001')
    fireEvent.click(confirm)
    const next = commit.mock.calls[0]![0]
    expect(next.observations!.find((one) => one.id === 'n1')).toMatchObject({ title: 'Cranes idle at night', where: 'Quay five', seen: 2 })
  })

  it('takes a record out again, and lets a link be left behind', () => {
    const { page } = mount()
    const merge = within(page())
    fireEvent.click(within(merge.getByTestId('merge-hit-north#n2')).getByRole('checkbox'))
    const move = merge.getByRole('checkbox', { name: /^Move: CA-0001/ })
    fireEvent.click(move)
    expect(move).toHaveProperty('checked', false)
    fireEvent.click(merge.getByRole('button', { name: 'Take OB-0002 out of the merge' }))
    expect(within(merge.getByTestId('merge-picked')).getAllByRole('radio')).toHaveLength(1)
    expect(merge.getByText(t('observation.mergeNoLinks'))).toBeTruthy()
  })

  it('searches across scopes, and lists a record of a scope that may only be read without letting it be picked', () => {
    const { page } = mount(undefined, { writable: (path) => path !== 'south' })
    const merge = within(page())
    expect(merge.queryByTestId('merge-hit-south#s1')).toBeNull()
    fireEvent.click(merge.getByRole('checkbox', { name: 'Across scopes' }))
    const closed = merge.getByTestId('merge-hit-south#s1')
    expect(closed.textContent).toContain('You may read South quay, not change it.')
    expect(within(closed).getByRole('checkbox')).toHaveProperty('disabled', true)
    fireEvent.change(merge.getByTestId('merge-search'), { target: { value: 'nothing like it' } })
    expect(merge.getByText('Nothing found.')).toBeTruthy()
  })

  it('says why a cause link cannot move, and offers the cause’s own values', () => {
    mount({ kind: 'cause', id: 'c3' })
    const merge = within(screen.getByRole('dialog', { name: 'Merge causes' }))
    fireEvent.click(within(merge.getByTestId('merge-hit-north#c2')).getByRole('checkbox'))
    fireEvent.click(merge.getByRole('radio', { name: /RC-0002/ }))
    const looped = merge.getAllByTestId('merge-link').find((one) => one.textContent?.includes(t('observation.mergeLinkSelf')))!
    expect(within(looped).getByRole('checkbox')).toHaveProperty('disabled', true)
    expect(merge.getByRole('checkbox', { name: 'Root cause' })).toHaveProperty('checked', true)
    fireEvent.click(merge.getByRole('checkbox', { name: 'Root cause' }))
    expect(merge.getByTestId('merge-confirm').textContent).toBe('Merge 1 cause into RC-0002')
  })

  it('closes with Escape, and says after a merge across where it went', async () => {
    const onChangeAcross = vi.fn(async () => ({ ok: true as const, changed: ['south', 'north'] }))
    const { page } = mount(undefined, { onChangeAcross })
    const merge = within(page())
    fireEvent.click(merge.getByRole('checkbox', { name: 'Across scopes' }))
    fireEvent.click(within(merge.getByTestId('merge-hit-south#s1')).getByRole('checkbox'))
    fireEvent.click(merge.getByTestId('merge-confirm'))
    expect((await screen.findByTestId('merge-note')).textContent).toContain('It changed South quay and North quay')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Merge observations' })).toBeNull())

    cleanup()
    const again = mount()
    fireEvent.keyDown(again.page(), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Merge observations' })).toBeNull())
  })
})
