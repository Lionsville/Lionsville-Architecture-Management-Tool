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
import type { Cause, CauseAbove, Observation, ScopeAnalysis } from '../observation'
import { newSolution } from '../solution'
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
    // Its observations under a heading, and its cause under another.
    expect(screen.getAllByText('Local to Intake')).toHaveLength(2)
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

  it('narrow the Solutions tab too, and are kept while a record is read beside it', () => {
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
        open onClose={() => {}} model={withSolutions} groupName="Acme" below={below} path="acme/claims"
        onChange={() => {}} s={t} language="en" makeId={(prefix) => prefix} today={() => '2026-09-20'}
        renderMarkdown={(md) => <MarkdownView markdown={md} />}
      />,
    )
    fireEvent.click(screen.getByTestId('observation-tab-solutions'))
    const solutionKeys = () => [...screen.getByTestId('solution-picture').querySelectorAll('[data-testid="solution-picture-solution"]')]
      .map((node) => node.getAttribute('data-key'))
    expect(solutionKeys().sort()).toEqual(['so:s1', 'so:s2'])
    fireEvent.change(within(screen.getByTestId('filter-roots')).getByRole('textbox'), { target: { value: 'owns' } })
    expect(solutionKeys()).toEqual(['so:s1'])
    fireEvent.click(screen.getByTestId('solution-picture').querySelector('[data-key="so:s1"]')!)
    expect(screen.getByTestId('solution-reader')).toBeDefined()
    expect((within(screen.getByTestId('filter-roots')).getByRole('textbox') as HTMLInputElement).value).toBe('owns')
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
    const reader = screen.getByTestId('cause-reader')
    expect(reader.textContent).toContain('Intake waits on the batch')
    expect(within(reader).getByTestId('cause-deeper')).toBeDefined()
    expect(within(reader).getByTestId('cause-root-toggle')).toBeDefined()
    expect(within(reader).getByTestId('cause-org')).toBeDefined()

    fireEvent.contextMenu(picture().querySelector('[data-key="acme/claims/intake#b1"]')!)
    const menu = screen.getByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Link to a deeper cause…', 'Make root cause', 'Link to a cause of Claims…', 'Merge…',
    ])
  })

  it('offers what a reader of an observation below offers on its right-click', () => {
    mountWritable()
    fireEvent.contextMenu(picture().querySelector('[data-key="acme/claims/intake#in1"]')!)
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Seen again', 'Link to a cause…', 'Merge…',
    ])
  })

  it('offers the scopes below in the new observation only while View local is on', () => {
    mountWritable()
    const create = () => fireEvent.click(document.querySelector('[data-guide="observations.new"]')!)
    create()
    expect(screen.getByTestId('form-scope')).toBeDefined()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(screen.getByLabelText('View local'))
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
    expect(screen.getByTestId('solution-reader').textContent).toContain('Intake starts after the batch')
    expect(screen.getByTestId('solution-from-below').textContent).toContain('Intake')
    expect(screen.queryByTestId('solution-gate')).toBeNull()
    expect(screen.queryByTestId('reader-edit')).toBeNull()
    fireEvent.contextMenu(picture().querySelector('[data-key="acme/claims/intake#so:sb1"]')!)
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Open Intake'])
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
    const row = screen.getByTestId('observation-row-acme/claims/intake#in1')
    expect(row.textContent).toContain('CA-0001')
    expect(row.textContent).not.toContain('not yet')
    // Its cause is the scope below's, and the chip opens it there.
    fireEvent.click(within(row).getByText('CA-0001'))
    expect(screen.getByTestId('cause-reader').textContent).toContain('Intake waits on the batch')

    const heading = (list: string) => within(screen.getByTestId(list)).getByTestId('register-below-heading').textContent
    expect(heading('cause-list')).toBe('Local to Intake')
    expect(screen.getByTestId('cause-row-acme/claims/intake#b1').textContent).toContain('Intake waits on the batch')
    expect(heading('solution-list')).toBe('Local to Intake')
    fireEvent.click(screen.getByTestId('solution-row-acme/claims/intake#so:sb1'))
    expect(screen.getByTestId('solution-from-below').textContent).toContain('Intake')
    expect(heading('experiment-list')).toBe('Local to Intake')
    fireEvent.click(within(screen.getByTestId('experiment-list')).getByText('EX-0001 Start intake at ten for a week'))
    expect(screen.getByTestId('experiment-from-below').textContent).toContain('Intake')
    expect(screen.getByTestId('experiment-reader').textContent).toContain('Start intake at ten for a week')

    // Off, the register is this scope's alone.
    fireEvent.click(screen.getByLabelText('View local'))
    expect(screen.queryByTestId('register-below-heading')).toBeNull()
    expect(screen.queryByTestId('cause-row-acme/claims/intake#b1')).toBeNull()
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
    expect(screen.getByTestId('observation-reader').textContent).toContain('Intake closes before the batch starts')
    // The way to the scope stands under the sentence, not in a column beside it.
    const strip = screen.getByTestId('observation-from-below')
    const action = within(strip).getByRole('group')
    expect(action.parentElement?.parentElement).toBe(strip)
  })

  it('counts what the picture draws: the scope below while View local is on, and what the filters left', () => {
    mountBelow()
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))
    const phases = () => screen.getByTestId('analysis-phases').textContent
    // Two observations here and one below; all three analysed; three causes here and one below.
    expect(phases()).toContain('3observed')
    expect(phases()).toContain('3analysed')
    expect(phases()).toContain('4assumed')
    fireEvent.click(screen.getByLabelText('View local'))
    expect(phases()).toContain('2observed')
    expect(phases()).toContain('3assumed')
    fireEvent.click(screen.getByLabelText('View local'))
    fireEvent.change(within(screen.getByTestId('filter-observations')).getByRole('textbox'), { target: { value: 'policyholder' } })
    expect(phases()).toContain('1observed')
    expect(phases()).toContain('1analysed')
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
