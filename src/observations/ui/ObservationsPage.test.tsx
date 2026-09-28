// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The observations page as a user meets it (ADR-0021): the register with this
 * scope's own and the shared ones from below, a record made in the right
 * list under the right number, seen again and shared from the reader, linked
 * to a new cause, merged into another, and the picture drawn from the same
 * lists. Writes are handlers: the page proposes both lists, the caller keeps
 * them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { translator } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import type { HostModel } from '../../model/hostModel'
import type { Cause, Observation } from '../observation'
import { MarkdownView } from '../../documentation/ui/MarkdownView'
import { ObservationsPage } from './ObservationsPage'
import type { ObservationsPageProps } from './ObservationsPage'
import { renderShell } from '../../app/testing/renderShell'

afterEach(() => cleanup())

const observation = (over: Partial<Observation>): Observation => ({
  id: 'o1', number: 1, title: 'Nightly batch overruns', date: '2026-09-08', where: 'Claims run', impact: 'major', seen: 4,
  body: '## What we saw\n\nStill running at 08:40.', history: [{ date: '2026-09-08', kind: 'recorded' }], ...over,
})
const cause = (over: Partial<Cause>): Cause => ({
  id: 'c1', number: 1, title: 'Window sized for 2019', state: 'assumed', body: '## Why\n\nVolumes doubled.', explains: [], ...over,
})

const model: HostModel = {
  name: 'Claims', elements: [], relations: [], diagrams: [],
  observations: [
    observation({}),
    observation({ id: 'o2', number: 2, title: 'Same change released twice', impact: 'minor', seen: 1, where: undefined }),
  ],
  causes: [cause({ explains: [{ id: 'o1', strength: 'strong' }] })],
}
const shared = [{
  scope: 'acme/claims/intake',
  observation: observation({ id: 'in1', number: 1, title: 'Two records for one policyholder', shared: true, seen: 2 }),
}]

let ids = 0
function mount(over: Partial<ObservationsPageProps> = {}) {
  const onChange = vi.fn()
  const onOpenScope = vi.fn()
  const utils = renderShell(
    <ObservationsPage
      open
      onClose={() => {}}
      model={model}
      groupName="Acme"
      shared={shared}
      scopeLabel={(path) => (path === 'acme/claims/intake' ? 'Intake' : path)}
      canShare
      onOpenScope={onOpenScope}
      onChange={onChange}
      s={translator('en')}
      language="en"
      makeId={(prefix) => `${prefix}-${++ids}`}
      today={() => '2026-09-20'}
      renderMarkdown={(md) => <MarkdownView markdown={md} />}
      {...over}
    />,
  )
  return { ...utils, onChange, onOpenScope }
}

const lastChange = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.calls.at(-1)![0] as { observations: Observation[]; causes: Cause[] }

describe('ObservationsPage, as axe reads it', () => {
  it.each(['register', 'analysis', 'solutions'])('finds nothing on the %s tab', async (tab) => {
    mount({ model: { ...model, causes: [cause({ explains: [{ id: 'o1', strength: 'strong' }] })] } })
    fireEvent.click(screen.getByTestId(`observation-tab-${tab}`))
    expect(await axeFindings()).toEqual([])
  })
})

describe('ObservationsPage', () => {
  it('lists this scope’s own, then the shared ones from below under their scope, then the causes', () => {
    mount()
    const register = screen.getByTestId('observation-register')
    expect(within(register).getByTestId('observation-row-o1').textContent).toContain('OB-0001')
    expect(within(register).getByTestId('observation-row-o1').textContent).toContain('CA-0001')
    expect(within(register).getByTestId('observation-row-o2').textContent).toContain('not yet')
    expect(within(register).getByText('Shared from Intake')).toBeDefined()
    expect(within(register).getByTestId('observation-row-acme/claims/intake#in1').textContent).toContain('Two records')
    expect(within(screen.getByTestId('cause-list')).getByText('CA-0001 Window sized for 2019')).toBeDefined()
  })

  it('goes back to a record asked for again after another was chosen, and says which it shows', () => {
    const onShown = vi.fn()
    const { rerender } = mount({ initialId: 'o1', initialNonce: 1, onShown })
    const reader = () => screen.getByTestId('observation-reader').textContent
    expect(reader()).toContain('OB-0001')
    expect(onShown).toHaveBeenLastCalledWith('o1', 1)
    fireEvent.click(screen.getByTestId('observation-row-o2'))
    expect(onShown).toHaveBeenLastCalledWith('o2', 1)
    const again = (nonce: number) => (
      <ObservationsPage
        open onClose={() => {}} model={model} groupName="Acme" shared={shared} canShare onChange={() => {}}
        initialId="o1" initialNonce={nonce} onShown={onShown} s={translator('en')} language="en"
        makeId={(prefix) => prefix} today={() => '2026-09-20'} renderMarkdown={(md) => <MarkdownView markdown={md} />}
      />
    )
    rerender(again(1))
    expect(reader()).toContain('OB-0002')
    rerender(again(2))
    expect(reader()).toContain('OB-0001')
    expect(onShown).toHaveBeenLastCalledWith('o1', 2)
  })

  it('opens on the newest standing observation, with its fields, its causes and its history', () => {
    mount()
    const reader = screen.getByTestId('observation-reader')
    expect(reader.textContent).toContain('OB-0002')
    fireEvent.click(screen.getByTestId('observation-row-o1'))
    expect(screen.getByTestId('observation-seen').textContent).toBe('4×')
    expect(screen.getByTestId('observation-explained-by').textContent).toContain('CA-0001 Window sized for 2019')
    expect(screen.getByTestId('observation-history').textContent).toContain(formatDay('2026-09-08', 'en'))
    expect(screen.getByTestId('observation-history').textContent).toContain('Recorded')
  })

  it('records a new observation under the next number, shared when asked', () => {
    const { onChange } = mount()
    fireEvent.click(screen.getByRole('button', { name: '+ New observation' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Duplicate customers' } })
    fireEvent.change(screen.getByLabelText('Where it was seen'), { target: { value: 'CRM' } })
    fireEvent.change(screen.getByLabelText('Observed by'), { target: { value: 'W.S.' } })
    fireEvent.click(screen.getByLabelText('Share with the scopes above'))
    fireEvent.click(screen.getByRole('button', { name: 'Record' }))
    const next = lastChange(onChange)
    expect(next.observations).toHaveLength(3)
    expect(next.observations[2]).toMatchObject({ number: 3, title: 'Duplicate customers', where: 'CRM', by: 'W.S.', seen: 1, shared: true, date: '2026-09-20' })
    expect(next.observations[2].history.map((one) => one.kind)).toEqual(['recorded', 'shared'])
    expect(next.causes).toEqual(model.causes)
  })

  it('seen again and share are dated operations on the record', () => {
    const { onChange } = mount()
    fireEvent.click(screen.getByTestId('observation-row-o2'))
    fireEvent.click(screen.getByTestId('observation-seen-again'))
    fireEvent.click(screen.getByTestId('seen-confirm'))
    expect(lastChange(onChange).observations[1]).toMatchObject({ seen: 2 })
    expect(lastChange(onChange).observations[1].history.at(-1)).toEqual({ date: '2026-09-20', kind: 'seen' })
    fireEvent.click(screen.getByTestId('observation-share'))
    expect(lastChange(onChange).observations[1]).toMatchObject({ shared: true })
  })

  it('archives an observation with a note, hides it until asked, and restores it', async () => {
    const { onChange } = mount()
    fireEvent.click(screen.getByTestId('observation-row-o2'))
    fireEvent.click(screen.getByTestId('observation-archive'))
    fireEvent.change(screen.getByLabelText('Why (optional)'), { target: { value: 'Release checklist fixed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    const closed = lastChange(onChange).observations[1]
    expect(closed.archived).toBe(true)
    expect(closed.history.at(-1)).toEqual({ date: '2026-09-20', kind: 'archived', note: 'Release checklist fixed' })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Archive', hidden: true })).toBeNull())

    // The page is handed the closed record back, as the workspace would.
    cleanup()
    const reopened = mount({ model: { ...model, observations: [model.observations![0], closed] } })
    const register = screen.getByTestId('observation-register')
    expect(within(register).queryByTestId('observation-row-o2')).toBeNull()
    fireEvent.click(screen.getByLabelText('Show archived'))
    expect(within(register).getByTestId('observation-row-o2').textContent).toContain('Archived')
    fireEvent.click(within(register).getByTestId('observation-row-o2'))
    expect(screen.getByTestId('observation-archived-note').textContent).toBe(`Archived on ${formatDay('2026-09-20', 'en')}`)
    expect(screen.queryByTestId('observation-seen-again')).toBeNull()
    fireEvent.click(screen.getByTestId('observation-restore'))
    const back = lastChange(reopened.onChange).observations[1]
    expect(back.archived).toBeUndefined()
    expect(back.history.map((one) => one.kind)).toEqual(['recorded', 'archived', 'restored'])
    // Closed, it is out of the analysis: the picture and the queue no longer count it.
    cleanup()
    mount({ model: { ...model, observations: [model.observations![0], closed] } })
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))
    expect(within(screen.getByTestId('analysis-queue')).queryByText(/OB-0002/)).toBeNull()
    // Two circles: this scope's OB-0001 and the shared one from below; the archived one is not drawn.
    expect(within(screen.getByTestId('analysis-picture')).getAllByTestId('analysis-observation')).toHaveLength(2)
  })

  it('links an observation to a new cause with a strength, and lands on the cause', () => {
    const { onChange } = mount()
    fireEvent.click(screen.getByTestId('observation-row-o2'))
    fireEvent.click(screen.getByRole('button', { name: 'Link to a cause…' }))
    fireEvent.change(screen.getByLabelText('Name the cause'), { target: { value: 'Two teams own one rule' } })
    fireEvent.click(screen.getByRole('button', { name: 'Link' }))
    const next = lastChange(onChange)
    expect(next.causes).toHaveLength(2)
    expect(next.causes[1]).toMatchObject({ number: 2, title: 'Two teams own one rule', state: 'assumed', explains: [{ id: 'o2', strength: 'normal' }] })
  })

  it('merges one observation into another, and the page says where it went', () => {
    const { onChange, rerender } = mount()
    fireEvent.click(screen.getByTestId('observation-row-o2'))
    fireEvent.click(screen.getByRole('button', { name: 'Merge into…' }))
    fireEvent.mouseDown(screen.getByLabelText('The observation it is the same as'))
    fireEvent.click(screen.getByRole('option', { name: /OB-0001/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }))
    const next = lastChange(onChange)
    const survivor = next.observations.find((one) => one.id === 'o1')!
    expect(survivor.seen).toBe(5)
    expect(survivor.history.at(-1)).toEqual({ date: '2026-09-20', kind: 'absorbed', id: 'o2', seen: 1 })
    expect(next.observations.find((one) => one.id === 'o2')!.history.at(-1)).toEqual({ date: '2026-09-20', kind: 'merged', id: 'o1' })
    // Shown again with the merged one: it is history, read but not analysed.
    rerender(<ObservationsPage
      open onClose={() => {}} model={{ ...model, observations: next.observations, causes: next.causes }} groupName="Acme" canShare
      onChange={onChange} s={translator('en')} language="en" makeId={(p) => p} today={() => '2026-09-20'} renderMarkdown={(md) => <MarkdownView markdown={md} />}
    />)
    expect(screen.queryByTestId('observation-row-o2')).toBeNull()
    fireEvent.click(screen.getByLabelText('Show merged'))
    expect(screen.getByTestId('observation-row-o2').textContent).toContain('Merged into OB-0001')
    // Where it went is a link to it, on the row and in the reader.
    fireEvent.click(screen.getByTestId('observation-row-o2'))
    // By test id: the merge dialog, still closing, hides the page from role queries.
    const link = within(screen.getByTestId('observation-merged')).getByTestId('observation-merged-link')
    expect(link.tagName).toBe('BUTTON')
    fireEvent.click(link)
    expect(screen.getByTestId('observation-row-o1').className).toContain('Mui-selected')
  })

  it('reads a shared observation from below, links it here, folds it in here, and opens its scope', async () => {
    // A closing dialog hides the page from role queries until its transition ends.
    const dialogGone = (confirm: string) => waitFor(() => expect(screen.queryByRole('button', { name: confirm, hidden: true })).toBeNull())
    const { onChange, onOpenScope } = mount()
    fireEvent.click(screen.getByTestId('observation-row-acme/claims/intake#in1'))
    expect(screen.getByTestId('observation-from-below').textContent).toContain('belongs to Intake')
    expect(screen.queryByTestId('observation-seen-again')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Link to a cause…' }))
    fireEvent.mouseDown(screen.getByLabelText('Cause'))
    fireEvent.click(screen.getByRole('option', { name: /CA-0001/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Link' }))
    expect(lastChange(onChange).causes[0].explains).toContainEqual({ id: 'in1', scope: 'acme/claims/intake', strength: 'normal' })
    await dialogGone('Link')

    fireEvent.click(screen.getByTestId('observation-row-acme/claims/intake#in1'))
    fireEvent.click(screen.getByRole('button', { name: 'Merge into…' }))
    fireEvent.mouseDown(screen.getByLabelText('The observation it is the same as'))
    fireEvent.click(screen.getByRole('option', { name: /OB-0001/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }))
    const next = lastChange(onChange)
    expect(next.observations).toHaveLength(2)
    expect(next.observations[0].history.at(-1)).toEqual({ date: '2026-09-20', kind: 'absorbed', id: 'in1', scope: 'acme/claims/intake', seen: 2 })
    await dialogGone('Merge')

    fireEvent.click(screen.getByTestId('observation-row-acme/claims/intake#in1'))
    fireEvent.click(screen.getByRole('button', { name: 'Open Intake' }))
    expect(onOpenScope).toHaveBeenCalledWith('acme/claims/intake')
  })

  it('draws the analysis: circles for observations, boxes for causes, a root, and the lines between', () => {
    mount({ model: { ...model, causes: [
      cause({ explains: [{ id: 'o1', strength: 'strong' }, { id: 'in1', scope: 'acme/claims/intake', strength: 'weak' }] }),
      cause({ id: 'c2', number: 2, title: 'Nobody owns the batch', state: 'verified', explains: [{ id: 'c1', strength: 'normal' }] }),
    ] } })
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))
    const picture = screen.getByTestId('analysis-picture')
    expect(within(picture).getAllByTestId('analysis-observation')).toHaveLength(3)
    const causes = within(picture).getAllByTestId('analysis-cause')
    expect(causes).toHaveLength(2)
    expect(causes.find((node) => node.getAttribute('data-key') === 'c2')?.getAttribute('data-root')).toBe('true')
    expect(within(picture).getAllByTestId('analysis-link').map((line) => line.getAttribute('data-strength')).sort()).toEqual(['normal', 'strong', 'weak'])
    expect(screen.getByTestId('analysis-phases').textContent).toContain('1root causes')
    // The queue names what has no cause yet.
    expect(screen.getByTestId('analysis-queue').textContent).toContain('OB-0002')
    fireEvent.click(causes.find((node) => node.getAttribute('data-key') === 'c2')!)
    expect(screen.getByTestId('cause-reader').textContent).toContain('Nobody owns the batch')
    expect(screen.getByTestId('cause-root')).toBeDefined()
  })

  it('a cause can be verified, and a root stops being one when a deeper cause is linked', async () => {
    const { onChange } = mount()
    fireEvent.click(within(screen.getByTestId('cause-list')).getByText('CA-0001 Window sized for 2019'))
    expect(screen.getByTestId('cause-root')).toBeDefined()
    // Its body says why, but not how it was verified: the page asks what confirmed it.
    fireEvent.click(screen.getByTestId('cause-verify'))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(screen.getByTestId('verify-answer'), { target: { value: 'The June run log' } })
    fireEvent.click(screen.getByTestId('verify-confirm'))
    expect(lastChange(onChange).causes[0].state).toBe('verified')
    expect(lastChange(onChange).causes[0].body).toContain('2026-09-20: The June run log')
    // The dialog fades out; until it is gone the page behind it is hidden from role queries.
    await waitForElementToBeRemoved(() => screen.queryByTestId('verify-answer'))
    fireEvent.click(screen.getByRole('button', { name: 'Link to a deeper cause…' }))
    fireEvent.change(screen.getByLabelText('Name the cause'), { target: { value: 'No capacity planning' } })
    fireEvent.click(screen.getByRole('button', { name: 'Link' }))
    const next = lastChange(onChange)
    expect(next.causes[1]).toMatchObject({ title: 'No capacity planning', explains: [{ id: 'c1', strength: 'normal' }] })
  })

  it('asks on which day it was seen again, with a note, and never a day in the future', () => {
    const { onChange } = mount()
    fireEvent.click(screen.getByTestId('observation-row-o1'))
    fireEvent.click(screen.getByTestId('observation-seen-again'))
    expect((screen.getByTestId('seen-date') as HTMLInputElement).value).toBe('2026-09-20')
    fireEvent.change(screen.getByTestId('seen-date'), { target: { value: '2026-09-21' } })
    expect((screen.getByTestId('seen-confirm') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('seen-date'), { target: { value: '2026-09-01' } })
    expect((screen.getByTestId('seen-confirm') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('seen-date'), { target: { value: '2026-09-15' } })
    fireEvent.change(screen.getByTestId('seen-note'), { target: { value: 'Monday run' } })
    fireEvent.click(screen.getByTestId('seen-confirm'))
    expect(lastChange(onChange).observations[0].history.at(-1)).toEqual({ date: '2026-09-15', kind: 'seen', note: 'Monday run' })
  })

  it('says how many are archived when none is open, and shows them from there', () => {
    const archived = (one: Observation): Observation => ({ ...one, archived: true, history: [...one.history, { date: '2026-09-19', kind: 'archived' }] })
    mount({ model: { ...model, observations: model.observations!.map(archived) } })
    const empty = screen.getByTestId('observation-register-empty')
    expect(empty.textContent).toContain('No open observations here · 2 archived')
    fireEvent.click(screen.getByTestId('observation-show-archived'))
    expect(within(screen.getByTestId('observation-register')).getByTestId('observation-row-o1')).toBeTruthy()
  })

  it('marks every row for the guide, and starts the crumbs with a name, never an empty one', () => {
    mount({ groupName: '' })
    expect(screen.getByTestId('observation-row-o1').getAttribute('data-guide')).toBe('observations.row')
    expect(screen.getByTestId('observation-crumbs').textContent!.trim().startsWith('Claims')).toBe(true)
    cleanup()
    mount({ crumbs: [{ path: '', name: 'Acme' }, { path: 'claims-domain', name: 'Claims domain' }] })
    expect(screen.getByTestId('observation-crumbs').textContent).toMatch(/^Acme\s+\/\s+Claims domain\s+\/\s+Claims\s+\/\s+Observations$/)
  })

  it('has a seam the reading pane is resized at, with the keyboard too', () => {
    mount()
    const seam = screen.getByRole('separator', { name: 'Resize the reading pane' })
    expect(seam.getAttribute('aria-valuenow')).toBe('640')
    fireEvent.keyDown(seam, { key: 'ArrowLeft' })
    expect(seam.getAttribute('aria-valuenow')).toBe('648')
    fireEvent.doubleClick(seam)
    expect(seam.getAttribute('aria-valuenow')).toBe('640')
    // Each tab keeps a width of its own.
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))
    expect(screen.getByRole('separator', { name: 'Resize the reading pane' }).getAttribute('aria-valuenow')).toBe('420')
  })

  it('is read-only where told: no record, no verbs', () => {
    mount({ readOnly: true })
    expect(screen.queryByRole('button', { name: '+ New observation' })).toBeNull()
    expect(screen.queryByTestId('observation-seen-again')).toBeNull()
  })
})

describe('the analysis picture’s right-click, and editing across the whole width', () => {
  const rightClick = (element: Element) => fireEvent.contextMenu(element, { clientX: 40, clientY: 60 })

  it('offers a cause’s own actions, and Edit opens it with the picture stepped aside', () => {
    mount()
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))
    rightClick(screen.getByTestId('analysis-picture').querySelector('[data-key="c1"]')!)
    const menu = screen.getByTestId('picture-menu')
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Edit', 'Mark verified', 'Link to a deeper cause…', 'Propose a solution…', 'Delete',
    ])
    fireEvent.click(screen.getByTestId('picture-menu-edit'))
    expect(screen.getByTestId('observation-body').dataset.editing).toBe('true')
    expect(screen.queryByTestId('analysis-picture')).toBeNull()
    expect(screen.getByTestId('cause-reader')).toBeTruthy()
    fireEvent.click(within(screen.getByTestId('cause-reader')).getByRole('button', { name: 'Read' }))
    expect(screen.getByTestId('observation-body').dataset.editing).toBeUndefined()
    expect(screen.getByTestId('analysis-picture')).toBeTruthy()
  })

  it('keeps what was typed when the edit is left', () => {
    const { onChange } = mount()
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))
    rightClick(screen.getByTestId('analysis-picture').querySelector('[data-key="c1"]')!)
    fireEvent.click(screen.getByTestId('picture-menu-edit'))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Window sized for 2019 volumes' } })
    fireEvent.click(screen.getByTestId('observation-tab-register'))
    expect(lastChange(onChange).causes[0].title).toBe('Window sized for 2019 volumes')
    expect(screen.getByTestId('observation-body').dataset.editing).toBeUndefined()
  })

  it('makes a link stronger or weaker, or takes it away, from the line', () => {
    const { onChange } = mount()
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))
    rightClick(screen.getAllByTestId('analysis-link-hit')[0])
    expect(screen.getByTestId('picture-menu-strength-strong').textContent).toContain('✓')
    fireEvent.click(screen.getByTestId('picture-menu-strength-weak'))
    expect(lastChange(onChange).causes[0].explains).toEqual([{ id: 'o1', strength: 'weak' }])
    rightClick(screen.getAllByTestId('analysis-link-hit')[0])
    fireEvent.click(screen.getByTestId('picture-menu-unlink'))
    expect(lastChange(onChange).causes[0].explains).toEqual([])
  })

  it('offers nothing where the scope is read-only', () => {
    mount({ readOnly: true })
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))
    rightClick(screen.getByTestId('analysis-picture').querySelector('[data-key="c1"]')!)
    expect(screen.queryByTestId('picture-menu')).toBeNull()
  })
})

