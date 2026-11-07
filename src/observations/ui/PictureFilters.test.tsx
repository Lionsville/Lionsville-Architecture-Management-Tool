// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The page's controls as a person meets them (ADR-0032 §2, §8): the scopes below
 * drawn in a boundary of their own, with what is hidden counted when they are off;
 * a filter narrows every stage, says what is on in words and how much is shown;
 * filters are saved under a name, recalled from the list, deleted, and cleared; the
 * two sizes, the zoom and a hover that traces a chain and shows the whole title.
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
import type { Cause, CauseAbove, Observation, ScopeAnalysis } from '../observation'
import { newSolution } from '../solution'
import { ObservationsPage } from './ObservationsPage'
import { DEFAULT_POLICY } from '../../people/policy'
import { personNames, PersonNamesProvider } from '../../people/ui/names'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import type { Person } from '../../people/person'

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
      open onClose={() => {}} model={model} groupName="Acme" below={below} path="acme/claims"
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
const shown = () => document.querySelector('.kit-filter__shown')?.textContent
/** Every filter stands in one panel that closes: open it to set one. */
const openFilter = () => fireEvent.click(screen.getByRole('button', { name: /^Filter/ }))
const setFilter = (field: string, value: string) => fireEvent.change(screen.getByTestId(`filter-${field}`), { target: { value } })
const closeFilter = async () => {
  fireEvent.keyDown(document.querySelector('.kit-filter__pop')!, { key: 'Escape' })
  await waitFor(() => expect(document.querySelector('.kit-filter__pop')).toBeNull())
}
const tick = (name: string) => fireEvent.click(screen.getByRole('checkbox', { name }))
const howToRead = () => fireEvent.click(screen.getByTestId('how-to-read'))
const toList = () => fireEvent.click(screen.getByRole('radio', { name: 'List' }))

describe('the scopes below', () => {
  it('draws the scope below in a boundary of its own, and counts what it hides when switched off', () => {
    mount()
    const local = () => screen.getByTestId('view-local')
    expect(local().getAttribute('aria-pressed')).toBe('true')
    expect(within(picture()).getByTestId('picture-boundary').getAttribute('data-scope')).toBe('acme/claims/intake')
    // The root cause here explains the cause below across the boundary, drawn apart.
    expect(picture().querySelectorAll('[data-testid="analysis-link"][data-crossing="true"]')).toHaveLength(1)
    expect(drawn()).toContain('acme/claims/intake#b1')

    fireEvent.click(local())
    expect(within(picture()).queryByTestId('picture-boundary')).toBeNull()
    expect(drawn()).not.toContain('acme/claims/intake#b1')
    expect(count()).toContain('2 local records hidden')
    // The cause whose link now leads out of the picture says so.
    expect(picture().querySelector('[data-key="r1"]')?.textContent).toContain('↙ 1 local')

    // The list holds the scope below only while it is on.
    fireEvent.click(screen.getByTestId('observation-tab-register'))
    expect(screen.queryByText(/Local to Intake/)).toBeNull()
    fireEvent.click(local())
    expect(screen.getByText('Local to Intake · 1')).toBeTruthy()
  })

  it('is off, and says why, where the scope has no scopes below', () => {
    renderShell(
      <ObservationsPage
        open onClose={() => {}} model={model} groupName="Acme" onChange={() => {}} s={translator('en')} language="en"
        makeId={(prefix) => prefix} today={() => '2026-09-20'} renderMarkdown={(md) => <MarkdownView markdown={md} />}
      />,
    )
    expect(screen.getByTestId('view-local').getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('view-local').getAttribute('aria-disabled')).toBe('true')
  })
})

describe('the filters', () => {
  it('narrow every stage, say themselves in words, and are saved, recalled and cleared', async () => {
    const { onSaved } = mount()
    expect(shown()).toBeUndefined()
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()

    // RC: the root cause, the chains that lead to it here and below, and nothing beside them.
    openFilter()
    setFilter('roots', 'owns')
    expect(drawn()).toEqual(['acme/claims/intake#b1', 'acme/claims/intake#in1', 'c1', 'o1', 'r1'])
    await closeFilter()
    expect(shown()).toBe('5 of 7')
    expect(screen.getByRole('button', { name: /^Filter/ }).textContent).toContain('1')
    expect(document.querySelector('.kit-filter__line')?.textContent).toContain('RC: owns')
    expect(picture().querySelector('[data-key="r1"] [data-testid="picture-match"]')).not.toBeNull()
    fireEvent.click(screen.getByTestId('observation-tab-register'))
    expect(screen.queryByTestId('observation-row-o2')).toBeNull()
    expect(screen.getByTestId('observation-row-o1')).toBeDefined()
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))

    // Saved under a name the person gives.
    openFilter()
    fireEvent.click(screen.getByTestId('filter-saved'))
    fireEvent.change(screen.getByLabelText('Save the filters that are on now'), { target: { value: 'Batch owner' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSaved).toHaveBeenLastCalledWith([{ name: 'Batch owner', filters: expect.objectContaining({ roots: 'owns', scopesOff: [] }) }])
    expect(within(screen.getByTestId('filter-saved-list')).getByText('Batch owner')).toBeDefined()
    fireEvent.keyDown(screen.getByTestId('filter-saved-list'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('filter-saved-list')).toBeNull())
    await closeFilter()

    // Clear lets go of every filter.
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(shown()).toBeUndefined()
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()

    // Recalled from the list, it is on again.
    openFilter()
    fireEvent.click(screen.getByTestId('filter-saved'))
    fireEvent.click(within(screen.getByTestId('filter-saved-list')).getByText('Batch owner'))
    expect((screen.getByTestId('filter-roots') as HTMLInputElement).value).toBe('owns')
    expect(shown()).toBe('5 of 7')
    await waitFor(() => expect(screen.queryByTestId('filter-saved-list')).toBeNull())

    // And deleted from it.
    fireEvent.click(screen.getByTestId('filter-saved'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete “Batch owner”' }))
    expect(onSaved).toHaveBeenLastCalledWith([])
  })

  it('searches every record from the bar, and takes one word off the line by its ×', async () => {
    mount()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search every record' }), { target: { value: 'policyholder' } })
    expect(drawn()).toEqual(['c2', 'o2'])
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search every record' }), { target: { value: '' } })
    openFilter()
    setFilter('observations', 'batch')
    await closeFilter()
    fireEvent.click(screen.getByRole('button', { name: /Stop filtering on Filter by text in observations/ }))
    expect(shown()).toBeUndefined()
  })

  it('narrow Solve too, and are kept while a record is read beside its map', async () => {
    const t = translator('en')
    const withSolutions: HostModel = {
      ...model,
      causes: [...model.causes!, cause('r2', 4, 'Policyholders have no key of their own', [{ id: 'c2', strength: 'normal' }], true)],
      solutions: [
        newSolution({ id: 's1', number: 1, title: 'Give the schedule an owner', date: '2026-09-10', t, addresses: [{ id: 'r1', strength: 'normal' }] }),
        newSolution({ id: 's2', number: 2, title: 'A policyholder key', date: '2026-09-10', t, addresses: [{ id: 'r2', strength: 'normal' }] }),
      ],
    }
    renderShell(
      <ObservationsPage
        open onClose={() => {}} model={withSolutions} groupName="Acme" below={below} path="acme/claims" initialTab="solutions-map" initialNonce={1}
        onChange={() => {}} s={t} language="en" makeId={(prefix) => prefix} today={() => '2026-09-20'}
        renderMarkdown={(md) => <MarkdownView markdown={md} />}
      />,
    )
    const solutionKeys = () => [...screen.getByTestId('solution-picture').querySelectorAll('[data-testid="solution-picture-solution"]')]
      .map((node) => node.getAttribute('data-key'))
    expect(solutionKeys().sort()).toEqual(['so:s1', 'so:s2'])
    openFilter()
    setFilter('roots', 'owns')
    expect(solutionKeys()).toEqual(['so:s1'])
    await closeFilter()
    fireEvent.click(screen.getByTestId('solution-picture').querySelector('[data-key="so:s1"]')!)
    expect(screen.getByTestId('solution-reader')).toBeDefined()
    expect(document.querySelector('.kit-filter__line')?.textContent).toContain('RC: owns')
  })

  it('switches a scope off from the list, which a field narrows', () => {
    mount()
    openFilter()
    fireEvent.click(screen.getByTestId('filter-scopes'))
    fireEvent.change(screen.getByLabelText('Find a scope'), { target: { value: 'intake' } })
    const list = screen.getByTestId('filter-scopes-list')
    expect(within(list).getAllByRole('checkbox')).toHaveLength(1)
    fireEvent.click(within(list).getByRole('checkbox'))
    expect(drawn().some((key) => key?.startsWith('acme/claims/intake#'))).toBe(false)
    expect(shown()).toBe('5 of 7')
  })
})

describe('the picture', () => {
  it('draws small or large, with the legend to match, and zooms from the dock', () => {
    mount()
    expect(picture().getAttribute('data-size')).toBe('large')
    fireEvent.click(screen.getByRole('radio', { name: 'Small' }))
    expect(picture().getAttribute('data-size')).toBe('small')
    howToRead()
    expect(screen.getByTestId('analysis-legend').getAttribute('data-size')).toBe('small')
    expect(screen.getByTestId('analysis-legend').textContent).toContain('Root cause: a double ring')
    fireEvent.click(within(screen.getByRole('dialog', { name: 'How to read this' })).getByRole('button', { name: 'Close' }))
    expect(screen.getByTestId('zoom-value').textContent).toBe('100%')
    fireEvent.click(screen.getByTestId('zoom-in'))
    expect(screen.getByTestId('zoom-value').textContent).toBe('110%')
    fireEvent.click(screen.getByTestId('zoom-home'))
    expect(screen.getByTestId('zoom-value').textContent).toBe('100%')
  })

  it('opens at 100%, and a filter moves no zoom', () => {
    mount()
    fireEvent.click(screen.getByTestId('zoom-out'))
    openFilter()
    setFilter('roots', 'owns')
    expect(document.querySelector('[data-testid="zoom-value"]')?.textContent).toBe('90%')
  })

  it('traces a chain on hover or focus, dims the rest, and shows the whole title', () => {
    mount()
    const node = picture().querySelector('[data-key="o1"]')!
    fireEvent.mouseEnter(node)
    expect(screen.getByTestId('analysis-hover').textContent).toContain('The nightly claims batch runs into office hours and nobody is told')
    expect(picture().querySelector('[data-key="o2"]')?.getAttribute('opacity')).toBe('0.25')
    expect(picture().querySelector('[data-key="r1"]')?.getAttribute('opacity')).toBe('1')
    fireEvent.mouseLeave(node)
    expect(screen.queryByTestId('analysis-hover')).toBeNull()
    fireEvent.focus(picture().querySelector('[data-key="c2"]')!)
    expect(screen.getByTestId('analysis-hover').textContent).toContain('Intake keys a policyholder by hand')
    // Enter selects it, as a click does.
    fireEvent.keyDown(picture().querySelector('[data-key="c2"]')!, { key: 'Enter' })
    expect(screen.getByRole('complementary', { name: 'Intake keys a policyholder by hand' })).toBeTruthy()
  })

  it('marks an open end and counts it', () => {
    mount()
    // c2 is no root cause and nothing explains it.
    expect(picture().querySelector('[data-key="c2"] [data-testid="picture-open-end"]')).not.toBeNull()
    expect(picture().querySelector('[data-key="c1"] [data-testid="picture-open-end"]')).toBeNull()
    howToRead()
    expect(screen.getByTestId('analysis-phases').textContent).toContain('1 open end')
  })

  it('is clean for axe with a filter on and in the small size', async () => {
    mount()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search every record' }), { target: { value: 'batch' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Small' }))
    expect(await axeFindings()).toEqual([])
  })
})

describe('the picture and the readers, joined', () => {
  /** A scope that may write the one below, and hears from the tree what the scopes above explain there. */
  function mountWritable(explainedAboveOf?: (path: string) => ReadonlyMap<string, readonly CauseAbove[]>, extra?: ScopeAnalysis['causes']) {
    const onChangeBelow = vi.fn(() => Promise.resolve({ ok: true as const }))
    const scopes = extra ? [{ ...below[0], causes: [...below[0].causes, ...extra] }] : below
    renderShell(
      <ObservationsPage
        open onClose={() => {}} model={model} groupName="Acme" below={scopes} path="acme/claims"
        scopeLabel={(path) => (path === 'acme/claims/intake' ? 'Intake' : path)}
        onChangeBelow={onChangeBelow} {...(explainedAboveOf ? { explainedAboveOf } : {})}
        onChange={() => {}} s={translator('en')} language="en" makeId={(prefix) => prefix} today={() => '2026-09-20'}
        renderMarkdown={(md) => <MarkdownView markdown={md} />}
      />,
    )
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))
    return { onChangeBelow }
  }

  it('reads a cause below that is clicked, with its actions, and offers the same on a right-click', () => {
    mountWritable()
    fireEvent.click(picture().querySelector('[data-key="acme/claims/intake#b1"]')!)
    expect(screen.getByRole('complementary', { name: 'Intake waits on the batch' })).toBeTruthy()
    expect(screen.getByTestId('cause-deeper')).toBeDefined()
    expect(screen.getByTestId('cause-root-toggle')).toBeDefined()

    fireEvent.contextMenu(picture().querySelector('[data-key="acme/claims/intake#b1"]')!)
    const menu = screen.getByTestId('picture-menu')
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Ask why…', 'This is the root cause…', 'Org cause…', 'Merge…',
    ])
  })

  it('offers what a reader of an observation below offers on its right-click', () => {
    mountWritable()
    fireEvent.contextMenu(picture().querySelector('[data-key="acme/claims/intake#in1"]')!)
    expect(within(screen.getByTestId('picture-menu')).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Seen again…', 'Ask why…', 'Merge…',
    ])
  })

  it('offers the scopes below in the new observation only while they are on', () => {
    mountWritable()
    const create = () => fireEvent.click(document.querySelector('[data-guide="observations.new"]')!)
    create()
    expect(screen.getByTestId('form-scope')).toBeDefined()
    fireEvent.keyDown(screen.getByRole('form', { name: 'New observation' }), { key: 'Escape' })
    fireEvent.click(screen.getByTestId('view-local'))
    create()
    expect(screen.queryByTestId('form-scope')).toBeNull()
  })

  it('reads a solution below, read only, with the scope it lives in', () => {
    const t = translator('en')
    const fix = newSolution({ id: 'sb1', number: 1, title: 'Intake starts after the batch', date: '2026-09-10', t, addresses: [{ id: 'b1', strength: 'normal' }] })
    const onOpenScope = vi.fn()
    renderShell(
      <ObservationsPage
        open onClose={() => {}} model={model} groupName="Acme" below={[{ ...below[0], solutions: [fix] }]} path="acme/claims"
        scopeLabel={(path) => (path === 'acme/claims/intake' ? 'Intake' : path)} onOpenScope={onOpenScope}
        onChange={() => {}} s={t} language="en" makeId={(prefix) => prefix} today={() => '2026-09-20'}
        renderMarkdown={(md) => <MarkdownView markdown={md} />}
      />,
    )
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))
    fireEvent.click(picture().querySelector('[data-key="acme/claims/intake#so:sb1"]')!)
    expect(screen.getByRole('complementary', { name: 'Intake starts after the batch' })).toBeTruthy()
    expect(screen.getByTestId('solution-from-below').textContent).toContain('Intake')
    expect(screen.queryByTestId('solution-gate')).toBeNull()
    expect(screen.queryByTestId('reader-edit')).toBeNull()
    fireEvent.contextMenu(picture().querySelector('[data-key="acme/claims/intake#so:sb1"]')!)
    expect(within(screen.getByTestId('picture-menu')).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Open Intake'])
  })

  it('takes a cause below that a scope above explains as no open end', () => {
    const lone = cause('b2', 2, 'Intake is staffed for mornings', [])
    mountWritable(undefined, [lone])
    expect(picture().querySelector('[data-key="acme/claims/intake#b2"] [data-testid="picture-open-end"]')).not.toBeNull()
    cleanup()
    const organisation = cause('g1', 1, 'Nobody plans staffing across the group', [], true)
    mountWritable((path) => new Map(path === 'acme/claims/intake' ? [['b2', [{ scope: '', cause: organisation, strength: 'normal' as const }]]] : []), [lone])
    const node = picture().querySelector('[data-key="acme/claims/intake#b2"]')!
    expect(node.querySelector('[data-testid="picture-open-end"]')).toBeNull()
    expect(node.textContent).toContain('↗ RC-0001')
  })
})

describe('what a look at the page found (ADR-0032 §2)', () => {
  /** The scope below with a solution and an experiment of its own, beside the cause it already has. */
  function mountBelow() {
    const t = translator('en')
    const fix = newSolution({ id: 'sb1', number: 1, title: 'Intake starts after the batch', date: '2026-09-10', t, addresses: [{ id: 'b1', strength: 'normal' }] })
    const trial = {
      id: 'eb1', number: 1, title: 'Start intake at ten for a week', hypothesis: 'Nothing waits', body: '', tests: ['sb1'],
      outcome: 'running' as const,
    }
    const scopes: ScopeAnalysis[] = [{ ...below[0], solutions: [fix], experiments: [trial] }]
    renderShell(
      <ObservationsPage
        open onClose={() => {}} model={model} groupName="Acme" below={scopes} path="acme/claims"
        scopeLabel={(path) => (path === 'acme/claims/intake' ? 'Intake' : path)}
        onChangeBelow={vi.fn(() => Promise.resolve({ ok: true as const }))} onOpenScope={() => {}}
        onChange={() => {}} s={t} language="en" makeId={(prefix) => prefix} today={() => '2026-09-20'}
        renderMarkdown={(md) => <MarkdownView markdown={md} />}
      />,
    )
  }

  it('says what an observation below was analysed into, and lists the causes, solutions and experiments below under their scope', () => {
    mountBelow()
    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Analysed into' }))
    const row = screen.getByTestId('observation-row-acme/claims/intake#in1')
    expect(row.textContent).toContain('CA-0001')
    expect(row.textContent).not.toContain('not yet')
    cleanup()

    mountBelow()
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))
    toList()
    expect(screen.getByText('Local to Intake · 1')).toBeTruthy()
    expect(screen.getByTestId('cause-row-acme/claims/intake#b1').textContent).toContain('Intake waits on the batch')
    fireEvent.click(screen.getByTestId('observation-tab-solutions'))
    expect(screen.getByText('Local to Intake · 2')).toBeTruthy()
    fireEvent.click(screen.getByTestId('solution-row-acme/claims/intake#so:sb1'))
    expect(screen.getByTestId('solution-from-below').textContent).toContain('Intake')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByTestId('experiment-row-acme/claims/intake#ex:eb1'))
    expect(screen.getByTestId('experiment-from-below').textContent).toContain('Intake')
    expect(screen.getByRole('dialog', { name: 'Start intake at ten for a week' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    // Off, the lists are this scope's alone.
    fireEvent.click(screen.getByTestId('view-local'))
    expect(screen.queryByText(/Local to Intake/)).toBeNull()
  })

  it('reads the links of a cause below in its own scope, and says where it lives above its way there', () => {
    mountBelow()
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))
    fireEvent.click(picture().querySelector('[data-key="acme/claims/intake#b1"]')!)
    const explains = screen.getByTestId('cause-explains')
    expect(explains.textContent).toContain('OB-0001 Intake closes before the batch starts')
    expect(explains.textContent).not.toContain('in1')
    expect(screen.getByTestId('cause-explained-by').textContent).toContain('RC-0003 Nobody owns the batch schedule')
    // A link opens the record where it lives.
    fireEvent.click(within(explains).getByText('OB-0001 Intake closes before the batch starts'))
    expect(screen.getByRole('complementary', { name: 'Intake closes before the batch starts' })).toBeTruthy()
    // The way to the scope stands under the sentence, not in a column beside it.
    const strip = screen.getByTestId('observation-from-below')
    const action = within(strip).getByRole('group')
    expect(action.parentElement?.parentElement).toBe(strip)
  })

  it('counts what the picture draws: the scope below while they are on, and what the filters left', async () => {
    mountBelow()
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))
    /** Asked for and let go of, since the page behind the dialog is what changes. */
    const phases = async () => {
      howToRead()
      const said = screen.getByTestId('analysis-phases').textContent
      fireEvent.click(within(screen.getByRole('dialog', { name: 'How to read this' })).getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(screen.queryByTestId('analysis-phases')).toBeNull())
      return said
    }
    // Two observations here and one below; all three analysed; three causes here and one below.
    const all = await phases()
    expect(all).toContain('3 observed')
    expect(all).toContain('3 analysed')
    expect(all).toContain('4 assumed')
    fireEvent.click(screen.getByTestId('view-local'))
    const own = await phases()
    expect(own).toContain('2 observed')
    expect(own).toContain('3 assumed')
    fireEvent.click(screen.getByTestId('view-local'))
    openFilter()
    setFilter('observations', 'policyholder')
    await closeFilter()
    const left = await phases()
    expect(left).toContain('1 observed')
    expect(left).toContain('1 analysed')
  })

  it('heads this scope’s four lanes even where they hold nothing', () => {
    renderShell(
      <ObservationsPage
        open onClose={() => {}} model={{ name: 'Claims', elements: [], relations: [], diagrams: [] }} groupName="Acme" below={below} path="acme/claims"
        scopeLabel={(path) => (path === 'acme/claims/intake' ? 'Intake' : path)}
        onChange={() => {}} s={translator('en')} language="en" makeId={(prefix) => prefix} today={() => '2026-09-20'}
        renderMarkdown={(md) => <MarkdownView markdown={md} />}
      />,
    )
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))
    const headings = [...screen.getByTestId('picture-headings').querySelectorAll('text')].map((one) => one.textContent)
    expect(headings.slice(0, 4)).toEqual(['Observations', 'Causes', 'Root causes', 'Solutions'])
  })
})

describe('mine (ADR-0038, amended §10)', () => {
  // o1 was recorded by the account using the app; o2 by somebody else; o3 by nobody said.
  const recorded: HostModel = {
    ...model,
    observations: model.observations!.map((one) => (one.id === 'o1'
      ? { ...one, recordedBy: { name: 'Ada', account: 'acc-1' } }
      : one.id === 'o2' ? { ...one, recordedBy: { name: 'Bo', account: 'acc-2' } } : one)),
  }
  const mountAs = (account: { id: string; name: string } | undefined, shown: HostModel = recorded, held: { people?: readonly Person[]; me?: string } = {}) => {
    // Only what the names read of a register: who the account is, and who the entries are.
    const register = { people: held.people ?? [], policy: DEFAULT_POLICY, me: held.me, readOnly: true, ...(account ? { account: () => account } : {}) } as unknown as PeopleRegisterAccess
    renderShell(
      <PersonNamesProvider names={personNames(register, translator('en'))}>
        <ObservationsPage
          open onClose={() => {}} model={shown} groupName="Acme" below={below} path="acme/claims"
          scopeLabel={(path) => path} onChange={() => {}} s={translator('en')} language="en" makeId={(prefix) => prefix}
          today={() => '2026-09-20'} renderMarkdown={(md) => <MarkdownView markdown={md} />}
        />
      </PersonNamesProvider>,
    )
  }

  it('keeps what my account recorded, with who recorded each in the register', () => {
    mountAs({ id: 'acc-1', name: 'Ada' })
    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Recorded by' }))
    expect(screen.getByTestId('observation-recorded-by-o1').textContent).toBe('Ada')
    fireEvent.keyDown(document.querySelector('.kit-filter__pop')!, { key: 'Escape' })
    openFilter()
    tick('Mine')
    expect(screen.getByTestId('observation-row-o1')).toBeTruthy()
    expect(screen.queryByTestId('observation-row-o2')).toBeNull()
    expect(screen.queryByTestId('filter-mine-nobody')).toBeNull()
  })

  it('says where to say who you are when nobody is said', () => {
    mountAs(undefined)
    openFilter()
    tick('Mine')
    expect(screen.getByTestId('filter-mine-nobody').textContent).toContain('This is me')
    expect(screen.queryByTestId('observation-row-o1')).toBeNull()
  })

  it('finds a name as typed, whichever way round, with no caption', () => {
    mountAs({ id: 'acc-9', name: 'De Vries, Anna' }, { ...recorded, observations: recorded.observations!.map((one) => (one.id === 'o2' ? { ...one, by: 'Anna de Vries (told at the stand-up)' } : one)) })
    openFilter()
    tick('Mine')
    expect(screen.getByTestId('observation-row-o2')).toBeTruthy()
    expect(screen.queryByTestId('observation-row-o1')).toBeNull()
    expect(screen.queryByTestId('filter-mine-noEntry')).toBeNull()
  })

  it('says what it counts where it finds nothing, for an account linked to no entry', () => {
    mountAs({ id: 'acc-9', name: 'Anna de Vries' })
    expect(screen.queryByTestId('filter-mine-noEntry')).toBeNull()
    openFilter()
    tick('Mine')
    expect(screen.getByTestId('filter-mine-noEntry').textContent).toBe(translator('en')('observation.mineNoEntry'))
    expect(screen.queryByTestId('filter-mine-nobody')).toBeNull()
    tick('Mine')
    expect(screen.queryByTestId('filter-mine-noEntry')).toBeNull()
  })

  it('says what it counts where it finds nothing, for a person with an entry', () => {
    const people = [{ id: 'pe-1', name: 'Anna de Vries', pseudonym: 'Person 4K7Q', kind: 'internal' as const, state: 'active' as const }]
    mountAs(undefined, recorded, { people, me: 'pe-1' })
    openFilter()
    tick('Mine')
    expect(screen.getByTestId('filter-mine-counts').textContent).toBe(translator('en')('observation.mineCounts'))
  })

  it('follows a merge in the register, from the screen', () => {
    const people = [
      { id: 'pe-1', name: 'Anna de Vries', pseudonym: 'Person 4K7Q', kind: 'internal' as const, state: 'active' as const },
      { id: 'pe-old', pseudonym: 'Person 9QX2', kind: 'internal' as const, state: 'active' as const, mergedInto: 'pe-1' },
    ]
    mountAs(undefined, { ...recorded, observations: recorded.observations!.map((one) => (one.id === 'o2' ? { ...one, by: { person: 'pe-old' } } : one)) }, { people, me: 'pe-1' })
    openFilter()
    tick('Mine')
    expect(screen.getByTestId('observation-row-o2')).toBeTruthy()
    expect(screen.queryByTestId('filter-mine-counts')).toBeNull()
  })
})

describe('a tone (ADR-0038 §6, amended §9)', () => {
  // o2 works rather than goes wrong, c2 is behind it alone; o1 is marked a problem, and o3 neutral.
  const toned: HostModel = {
    ...model,
    observations: model.observations!.map((one) => (one.id === 'o2' ? { ...one, tone: 'bright' as const } : one.id === 'o1' ? { ...one, tone: 'problem' as const } : one)),
  }
  const mountToned = () => {
    renderShell(
      <ObservationsPage
        open onClose={() => {}} model={toned} groupName="Acme" below={below} path="acme/claims"
        scopeLabel={(path) => (path === 'acme/claims/intake' ? 'Intake' : path)}
        onChange={() => {}} s={translator('en')} language="en" makeId={(prefix) => prefix} today={() => '2026-09-20'}
        renderMarkdown={(md) => <MarkdownView markdown={md} />}
      />,
    )
  }

  it('says a bright spot in words on its row, and counts bright spots apart', () => {
    mountToned()
    expect(screen.getByTestId('observation-row-o2').textContent).toContain('Bright spot')
    expect(screen.getByTestId('observation-row-o1').textContent).not.toContain('Bright spot')
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))
    howToRead()
    const phases = screen.getByTestId('analysis-phases').textContent
    expect(phases).toContain('1 bright spot')
    // The line from the bright spot to the cause behind it alone is drawn in the success colour.
    const bright = [...picture().querySelectorAll('[data-testid="analysis-link"][data-bright="true"]')]
    expect(bright).toHaveLength(1)
  })

  it('narrows to the tones ticked, on every stage, counted as what is on', async () => {
    mountToned()
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))
    openFilter()
    tick('Bright spot')
    expect(drawn()).toEqual(['c2', 'o2'])
    tick('Bright spot')
    tick('Problem')
    expect(drawn()).not.toContain('o2')
    expect(drawn()).not.toContain('c2')
    expect(drawn()).toContain('o1')
    await closeFilter()
    expect(screen.getByRole('button', { name: /^Filter/ }).textContent).toContain('1')
    fireEvent.click(screen.getByTestId('observation-tab-register'))
    expect(screen.queryByTestId('observation-row-o2')).toBeNull()
    expect(screen.getByTestId('observation-row-o1')).toBeTruthy()
  })
})
