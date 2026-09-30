// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The form that records an observation, and the readers' buttons (ADR-0032
 * §6, §7), as a person meets them on the page: the four facts refused until
 * they are said, the hints that never block, *Seen again* in place of a new
 * record, the causes made on Record as one change, a scope below chosen and
 * the links of the scope before taken off, and every action a button with a
 * name and a sentence. Writes are handlers: the page proposes the lists, and
 * a change below is handed to the host as that scope's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { translator } from '../../i18n'
import type { HostModel } from '../../model/hostModel'
import type { Cause, Observation, ScopeAnalysis } from '../observation'
import { MarkdownView } from '../../documentation/ui/MarkdownView'
import { ObservationsPage } from './ObservationsPage'
import type { ChangeBelow, ObservationWork, ObservationsPageProps } from './ObservationsPage'
import { renderShell } from '../../app/testing/renderShell'

afterEach(() => cleanup())

const observation = (over: Partial<Observation>): Observation => ({
  id: 'o1', number: 1, title: 'Nightly batch overruns', date: '2026-09-08', where: 'Claims run', by: 'Night shift', impact: 'major',
  seen: 4, body: '', history: [{ date: '2026-09-08', kind: 'recorded' }], ...over,
})
const cause = (over: Partial<Cause>): Cause => ({
  id: 'c1', number: 1, title: 'Window sized for 2019', state: 'assumed', body: '', explains: [], ...over,
})

const model: HostModel = {
  name: 'Claims', elements: [], relations: [], diagrams: [],
  observations: [observation({})],
  causes: [cause({ explains: [{ id: 'o1', strength: 'strong' }] }), cause({ id: 'c2', number: 2, title: 'Nobody owns the batch', root: true })],
}
const below: ScopeAnalysis[] = [{
  scope: 'acme/claims/intake',
  observations: [observation({ id: 'in1', number: 1, title: 'Two records for one policyholder', seen: 2 })],
  causes: [
    cause({ id: 'bc1', number: 1, title: 'The intake form has no lookup', explains: [{ id: 'in1', strength: 'strong' }] }),
    cause({ id: 'bc2', number: 2, title: 'Nobody merges duplicates', root: true }),
  ],
  solutions: [], experiments: [],
}]

let ids = 0
function mount(over: Partial<ObservationsPageProps> = {}) {
  const onChange = vi.fn()
  const onChangeBelow = vi.fn<ChangeBelow>(() => Promise.resolve({ ok: true }))
  const utils = renderShell(
    <ObservationsPage
      open onClose={() => {}} model={model} groupName="Acme" below={below}
      scopeLabel={(path) => (path === 'acme/claims/intake' ? 'Intake' : path)}
      onChange={onChange} onChangeBelow={onChangeBelow}
      s={translator('en')} language="en" makeId={(prefix) => `${prefix}-${++ids}`} today={() => '2026-09-20'}
      renderMarkdown={(md) => <MarkdownView markdown={md} />}
      {...over}
    />,
  )
  return { ...utils, onChange, onChangeBelow }
}

const lastChange = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.calls.at(-1)![0] as ObservationWork
const form = () => within(screen.getByRole('dialog', { name: 'New observation' }))
const openForm = () => fireEvent.click(screen.getByRole('button', { name: '+ New observation' }))
const fill = (title: string) => {
  fireEvent.change(screen.getByTestId('form-title'), { target: { value: title } })
  fireEvent.change(screen.getByTestId('form-where'), { target: { value: 'Pick station 3' } })
  fireEvent.change(screen.getByTestId('form-by'), { target: { value: 'Shift lead' } })
}
const newCause = (title: string) => {
  fireEvent.click(screen.getByTestId('form-new-cause'))
  fireEvent.change(screen.getByTestId('cause-draft-title'), { target: { value: title } })
  fireEvent.click(screen.getByTestId('form-cause-add'))
}
/** What a change handed below does to that scope's lists as read. */
const landedBelow = (onChangeBelow: ReturnType<typeof vi.fn<ChangeBelow>>) => {
  const [path, change] = onChangeBelow.mock.calls.at(-1)!
  const held = below.find((one) => one.scope === path)!
  return { path, next: change({ observations: [...held.observations], causes: [...held.causes], solutions: [], experiments: [] })! }
}

describe('the new observation form', () => {
  it('refuses a record without its four facts, putting what is missing where the example was', () => {
    const { onChange } = mount()
    openForm()
    expect(form().getByText(/e\.g\. The nightly claims batch runs into office hours/)).toBeTruthy()
    fireEvent.click(screen.getByTestId('form-record'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByTestId('form-problems').textContent).toBe('3 fields need filling in.')
    expect(form().getByText('Say what was seen, in one sentence.')).toBeTruthy()
    expect(form().getByText('Say where it was seen.')).toBeTruthy()
    expect(form().getByText('Say who saw it.')).toBeTruthy()
    expect(form().queryByText(/e\.g\. The nightly claims batch/)).toBeNull()
    // Written, a field's example comes back; a day after today is refused too.
    fill('Labels print twice')
    fireEvent.change(screen.getByTestId('form-date'), { target: { value: '2026-09-21' } })
    fireEvent.click(screen.getByTestId('form-record'))
    expect(onChange).not.toHaveBeenCalled()
    expect(form().getByText('The day can’t be in the future. It is the day it was first seen.')).toBeTruthy()
    expect(screen.getByTestId('form-problems').textContent).toBe('1 field needs filling in.')
    expect((screen.getByTestId('form-date') as HTMLInputElement).max).toBe('2026-09-20')
  })

  it('says a title reads like a cause, and records it anyway', () => {
    const { onChange } = mount()
    openForm()
    fill('Labels print twice because the WMS resends')
    expect(screen.getByTestId('form-wording-hint').textContent).toContain('“because” reads like a cause, a fix or blame.')
    fireEvent.click(screen.getByTestId('form-record'))
    expect(lastChange(onChange).observations.at(-1)!.title).toBe('Labels print twice because the WMS resends')
  })

  it('offers Seen again on one written before, which records a sighting and nothing new', () => {
    const { onChange } = mount()
    openForm()
    fireEvent.change(screen.getByTestId('form-title'), { target: { value: 'The nightly batch overruns again' } })
    const seenBefore = screen.getByTestId('form-seen-before')
    expect(seenBefore.textContent).toContain('OB-0001 Nightly batch overruns')
    fireEvent.click(within(seenBefore).getByRole('button', { name: 'Seen again' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = lastChange(onChange)
    expect(next.observations).toHaveLength(1)
    expect(next.observations[0]).toMatchObject({ id: 'o1', seen: 5 })
    expect(next.observations[0].history.at(-1)).toEqual({ date: '2026-09-20', kind: 'seen' })
    expect(next.causes).toEqual(model.causes)
  })

  it('records the observation, two new causes and a link as one change, and the button says what it will make', () => {
    const { onChange } = mount()
    openForm()
    fill('Labels print twice')
    newCause('The WMS re-sends a split list')
    newCause('Splits are not modelled')
    fireEvent.click(screen.getByTestId('form-existing-cause'))
    fireEvent.click(within(screen.getByTestId('cause-picker')).getByRole('button', { name: 'Add RC-0002 Nobody owns the batch' }))
    const rows = screen.getAllByTestId('form-link-row').map((row) => row.textContent)
    expect(rows).toEqual([
      expect.stringContaining('The WMS re-sends a split list'), expect.stringContaining('Splits are not modelled'),
      expect.stringContaining('RC-0002 Nobody owns the batch'),
    ])
    // Taken off again, and put back: nothing is made until the form is recorded.
    fireEvent.click(screen.getByRole('button', { name: 'Take Splits are not modelled off the list' }))
    newCause('Splits are not modelled')
    expect(onChange).not.toHaveBeenCalled()
    const record = screen.getByTestId('form-record')
    expect(record.textContent).toBe('Record observation with 2 new causes and 1 link')
    fireEvent.click(record)
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = lastChange(onChange)
    const made = next.observations.at(-1)!
    expect(made).toMatchObject({ number: 2, title: 'Labels print twice', where: 'Pick station 3', by: 'Shift lead', date: '2026-09-20' })
    expect(next.causes.slice(2).map((one) => [one.number, one.title, one.explains])).toEqual([
      [3, 'The WMS re-sends a split list', [{ id: made.id, strength: 'normal' }]],
      [4, 'Splits are not modelled', [{ id: made.id, strength: 'normal' }]],
    ])
    expect(next.causes[1].explains).toEqual([{ id: made.id, strength: 'normal' }])
  })

  it('takes off the links to the old scope’s causes when the scope changes, and records below as that scope’s step', async () => {
    const { onChange, onChangeBelow } = mount()
    openForm()
    fill('Duplicate policyholders at intake')
    newCause('Two teams enter policyholders')
    fireEvent.click(screen.getByTestId('form-existing-cause'))
    fireEvent.click(within(screen.getByTestId('cause-picker')).getByRole('button', { name: 'Add CA-0001 Window sized for 2019' }))
    expect(screen.getAllByTestId('form-link-row')).toHaveLength(2)
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Scope' }))
    fireEvent.click(screen.getByRole('option', { name: 'Intake (local)' }))
    expect(screen.getByTestId('form-scope-dropped').textContent).toContain('a cause is linked in its own scope')
    expect(screen.getAllByTestId('form-link-row').map((row) => row.textContent)).toEqual([expect.stringContaining('Two teams enter policyholders')])
    // The scope's own look-alikes and causes are offered now.
    fireEvent.click(screen.getByTestId('form-existing-cause'))
    expect(within(screen.getByTestId('cause-picker')).getByText('CA-0001 The intake form has no lookup')).toBeTruthy()
    fireEvent.click(screen.getByTestId('form-record'))
    expect(onChange).not.toHaveBeenCalled()
    const { path, next } = landedBelow(onChangeBelow)
    expect(path).toBe('acme/claims/intake')
    const made = next.observations.at(-1)!
    expect(made).toMatchObject({ number: 2, title: 'Duplicate policyholders at intake' })
    expect(next.causes.at(-1)).toMatchObject({ number: 3, title: 'Two teams enter policyholders', explains: [{ id: made.id, strength: 'normal' }] })
    expect(next.causes[0].explains).toEqual(below[0].causes[0].explains)
    expect(await screen.findByText('Made in Intake, as a step of that scope. Undo here does not reach it: to take it back, change it back.')).toBeTruthy()
  })

  it('is clean to axe with a cause being written', async () => {
    mount()
    openForm()
    fireEvent.click(screen.getByTestId('form-new-cause'))
    expect(await axeFindings()).toEqual([])
  })

  it('shows the description as it will read, in the same place', () => {
    mount()
    openForm()
    fireEvent.change(screen.getByTestId('form-description'), { target: { value: '## What we saw\n\nTwo labels.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByTestId('form-preview').textContent).toContain('Two labels.')
    expect(screen.queryByTestId('form-description')).toBeNull()
  })
})
