// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The picture's controls as a person meets them (ADR-0032 §2, §8): View
 * local draws the scope below in a boundary of its own and counts what it
 * hides when switched off; a filter narrows all three tabs, says how many
 * are on and how much is shown; filters are saved under a name, recalled
 * from the list, deleted, and cleared with the ×; the two sizes, the zoom
 * and a hover that traces a chain and shows the whole title.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { MarkdownView } from '../../documentation/ui/MarkdownView'
import { translator } from '../../i18n'
import type { HostModel } from '../../model/hostModel'
import type { SavedFilter } from '../filter'
import type { Cause, Observation, ScopeAnalysis } from '../observation'
import { ObservationsPage } from './ObservationsPage'

afterEach(() => cleanup())

const observation = (id: string, number: number, title: string): Observation => ({
  id, number, title, date: '2026-09-08', impact: 'major', seen: 2, body: '', history: [{ date: '2026-09-08', kind: 'recorded' }],
})
const cause = (id: string, number: number, title: string, explains: Cause['explains'], root?: true): Cause => ({
  id, number, title, state: 'assumed', body: '', explains, ...(root ? { root } : {}),
})

const model: HostModel = {
  name: 'Claims', elements: [], relations: [], diagrams: [],
  observations: [
    observation('o1', 1, 'The nightly claims batch runs into office hours and nobody is told'),
    observation('o2', 2, 'Two records for one policyholder'),
  ],
  causes: [
    cause('c1', 1, 'The batch window was sized for older volumes', [{ id: 'o1', strength: 'strong' }]),
    cause('c2', 2, 'Intake keys a policyholder by hand', [{ id: 'o2', strength: 'normal' }]),
    cause('r1', 3, 'Nobody owns the batch schedule', [
      { id: 'c1', strength: 'normal' }, { id: 'b1', scope: 'acme/claims/intake', strength: 'weak' },
    ], true),
  ],
}
const below: ScopeAnalysis[] = [{
  scope: 'acme/claims/intake',
  observations: [observation('in1', 1, 'Intake closes before the batch starts')],
  causes: [cause('b1', 1, 'Intake waits on the batch', [{ id: 'in1', strength: 'normal' }])],
  solutions: [], experiments: [],
}]

/** The page with its saved filters kept the way the shell keeps them: in state, handed back on every change. */
function Page({ onSaved }: { onSaved: (next: SavedFilter[]) => void }) {
  const [list, setList] = useState<SavedFilter[]>([])
  return (
    <ObservationsPage
      open onClose={() => {}} model={model} groupName="Acme" below={below} scope="acme/claims"
      scopeLabel={(path) => (path === 'acme/claims/intake' ? 'Intake' : path)}
      savedFilters={{ list, onChange: (next) => { setList(next); onSaved(next) } }}
      onChange={() => {}} s={translator('en')} language="en" makeId={(prefix) => prefix} today={() => '2026-09-20'}
      renderMarkdown={(md) => <MarkdownView markdown={md} />}
    />
  )
}

function mount() {
  const onSaved = vi.fn()
  renderShell(<Page onSaved={onSaved} />)
  fireEvent.click(screen.getByTestId('observation-tab-analysis'))
  return { onSaved }
}

const picture = () => screen.getByTestId('analysis-picture')
const drawn = () => [...picture().querySelectorAll('[data-key]')].map((node) => node.getAttribute('data-key')).sort()
const count = () => screen.getByTestId('picture-count').textContent

describe('View local', () => {
  it('draws the scope below in a boundary of its own, and counts what it hides when switched off', () => {
    mount()
    const local = screen.getByLabelText('View local') as HTMLInputElement
    expect(local.checked).toBe(true)
    expect(within(picture()).getByTestId('picture-boundary').getAttribute('data-scope')).toBe('acme/claims/intake')
    // The root cause here explains the cause below across the boundary, drawn apart.
    expect(picture().querySelectorAll('[data-testid="analysis-link"][data-crossing="true"]')).toHaveLength(1)
    expect(drawn()).toContain('acme/claims/intake#b1')

    fireEvent.click(local)
    expect(within(picture()).queryByTestId('picture-boundary')).toBeNull()
    expect(drawn()).not.toContain('acme/claims/intake#b1')
    expect(count()).toContain('2 local records hidden')
    // The cause whose link now leads out of the picture says so.
    expect(picture().querySelector('[data-key="r1"]')?.textContent).toContain('↙ 1 local')

    // The register lists the scope below only while it is on.
    fireEvent.click(screen.getByTestId('observation-tab-register'))
    expect(screen.queryByText('Local to Intake')).toBeNull()
    fireEvent.click(screen.getByLabelText('View local'))
    expect(screen.getByText('Local to Intake')).toBeDefined()
  })

  it('is off, and says why, where the scope has no scopes below', () => {
    renderShell(
      <ObservationsPage
        open onClose={() => {}} model={model} groupName="Acme" onChange={() => {}} s={translator('en')} language="en"
        makeId={(prefix) => prefix} today={() => '2026-09-20'} renderMarkdown={(md) => <MarkdownView markdown={md} />}
      />,
    )
    const local = screen.getByLabelText('View local') as HTMLInputElement
    expect(local.checked).toBe(false)
    expect(local.disabled).toBe(true)
  })
})

describe('the filters', () => {
  it('narrow every tab, count themselves, and are saved, recalled and cleared', async () => {
    const { onSaved } = mount()
    expect(count()).toBe('7 records')
    expect(screen.queryByTestId('filters-clear')).toBeNull()

    // RC: the root cause, the chains that lead to it here and below, and nothing beside them.
    fireEvent.change(within(screen.getByTestId('filter-roots')).getByRole('textbox'), { target: { value: 'owns' } })
    expect(drawn()).toEqual(['acme/claims/intake#b1', 'acme/claims/intake#in1', 'c1', 'o1', 'r1'])
    expect(count()).toBe('5 of 7 shown')
    expect(screen.getByTestId('filters-toggle').textContent).toContain('1')
    expect(picture().querySelector('[data-key="r1"] [data-testid="picture-match"]')).not.toBeNull()
    fireEvent.click(screen.getByTestId('observation-tab-register'))
    expect(screen.queryByTestId('observation-row-o2')).toBeNull()
    expect(screen.getByTestId('observation-row-o1')).toBeDefined()
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))

    // Saved under a name the person gives.
    fireEvent.click(screen.getByTestId('filter-saved'))
    fireEvent.change(screen.getByLabelText('Save the filters that are on now'), { target: { value: 'Batch owner' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSaved).toHaveBeenLastCalledWith([{ name: 'Batch owner', filters: expect.objectContaining({ roots: 'owns', scopesOff: [] }) }])
    expect(within(screen.getByTestId('filter-saved-list')).getByText('Batch owner')).toBeDefined()
    fireEvent.keyDown(screen.getByTestId('filter-saved-list'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('filter-saved-list')).toBeNull())

    // The × clears every filter.
    fireEvent.click(screen.getByTestId('filters-clear'))
    expect(count()).toBe('7 records')
    expect(screen.queryByTestId('filters-clear')).toBeNull()

    // Recalled from the list, it is on again.
    fireEvent.click(screen.getByTestId('filter-saved'))
    fireEvent.click(within(screen.getByTestId('filter-saved-list')).getByText('Batch owner'))
    expect((within(screen.getByTestId('filter-roots')).getByRole('textbox') as HTMLInputElement).value).toBe('owns')
    expect(count()).toBe('5 of 7 shown')
    await waitFor(() => expect(screen.queryByTestId('filter-saved-list')).toBeNull())

    // And deleted from it.
    fireEvent.click(screen.getByTestId('filter-saved'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete “Batch owner”' }))
    expect(onSaved).toHaveBeenLastCalledWith([])
  })

  it('switches a scope off from the list, which a field narrows', () => {
    mount()
    fireEvent.click(screen.getByTestId('filter-scopes'))
    fireEvent.change(screen.getByLabelText('Find a scope'), { target: { value: 'intake' } })
    const list = screen.getByTestId('filter-scopes-list')
    expect(within(list).getAllByRole('checkbox')).toHaveLength(1)
    fireEvent.click(within(list).getByRole('checkbox'))
    expect(drawn().some((key) => key?.startsWith('acme/claims/intake#'))).toBe(false)
    expect(count()).toBe('5 of 7 shown')
  })

  it('hides the row and brings it back from Filters', () => {
    mount()
    expect(screen.getByTestId('filter-row')).toBeDefined()
    fireEvent.click(screen.getByTestId('filters-toggle'))
    expect(screen.queryByTestId('filter-row')).toBeNull()
    fireEvent.click(screen.getByTestId('filters-toggle'))
    expect(screen.getByTestId('filter-row')).toBeDefined()
  })
})

describe('the picture', () => {
  it('draws small or large, with the legend to match, and zooms from its buttons', () => {
    mount()
    expect(picture().getAttribute('data-size')).toBe('large')
    fireEvent.click(screen.getByTestId('picture-size-small'))
    expect(picture().getAttribute('data-size')).toBe('small')
    expect(screen.getByTestId('analysis-legend').getAttribute('data-size')).toBe('small')
    expect(screen.getByTestId('analysis-legend').textContent).toContain('Root cause: a double ring')
    expect(screen.getByTestId('picture-zoom').textContent).toBe('100%')
    fireEvent.click(screen.getByTestId('picture-zoom-in'))
    expect(screen.getByTestId('picture-zoom').textContent).toBe('110%')
    expect(screen.getByTestId('picture-fit').getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByTestId('picture-fit'))
    expect(screen.getByTestId('picture-fit').getAttribute('aria-pressed')).toBe('true')
  })

  it('traces a chain on hover or focus, dims the rest, and shows the whole title', () => {
    mount()
    const node = picture().querySelector('[data-key="o1"]')!
    fireEvent.mouseEnter(node)
    expect(screen.getByTestId('analysis-hover').textContent).toContain('The nightly claims batch runs into office hours and nobody is told')
    expect(picture().querySelector('[data-key="o2"]')?.getAttribute('opacity')).toBe('0.16')
    expect(picture().querySelector('[data-key="r1"]')?.getAttribute('opacity')).toBe('1')
    fireEvent.mouseLeave(node)
    expect(screen.queryByTestId('analysis-hover')).toBeNull()
    fireEvent.focus(picture().querySelector('[data-key="c2"]')!)
    expect(screen.getByTestId('analysis-hover').textContent).toContain('Intake keys a policyholder by hand')
    // Enter selects it, as a click does.
    fireEvent.keyDown(picture().querySelector('[data-key="c2"]')!, { key: 'Enter' })
    expect(screen.getByTestId('cause-reader').textContent).toContain('Intake keys a policyholder by hand')
  })

  it('marks an open end and counts it', () => {
    mount()
    // c2 is no root cause and nothing explains it.
    expect(picture().querySelector('[data-key="c2"] [data-testid="picture-open-end"]')).not.toBeNull()
    expect(picture().querySelector('[data-key="c1"] [data-testid="picture-open-end"]')).toBeNull()
    expect(screen.getByTestId('analysis-phases').textContent).toContain('1open ends')
  })

  it('is clean for axe with a filter on and in the small size', async () => {
    mount()
    fireEvent.change(within(screen.getByTestId('filter-search')).getByRole('textbox'), { target: { value: 'batch' } })
    fireEvent.click(screen.getByTestId('picture-size-small'))
    expect(await axeFindings()).toEqual([])
  })
})
