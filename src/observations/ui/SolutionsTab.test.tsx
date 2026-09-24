// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The Solutions tab as a user meets it (ADR-0026): a solution proposed from
 * a root cause lands linked, the gate lists what is missing and the move
 * stays disabled until it is answered, an experiment is planned from the
 * reader, a decision is asked of the host, and an implemented solution asks
 * whether it worked. Writes are handlers: the page proposes the lists, the
 * caller keeps them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { translator } from '../../i18n'
import type { HostModel } from '../../model/hostModel'
import type { Cause, Observation } from '../observation'
import type { Experiment, Solution } from '../solution'
import { MarkdownView } from '../../documentation/ui/MarkdownView'
import { ObservationsPage } from './ObservationsPage'
import type { ObservationWork, ObservationsPageProps } from './ObservationsPage'
import { renderShell } from '../../app/testing/renderShell'

afterEach(() => cleanup())

const observation = (over: Partial<Observation>): Observation => ({
  id: 'o1', number: 1, title: 'Estimate differs per channel', date: '2026-06-01', impact: 'major', seen: 3, body: '',
  history: [{ date: '2026-06-01', kind: 'recorded' }], ...over,
})
const cause = (over: Partial<Cause>): Cause => ({
  id: 'c1', number: 1, title: 'Two systems compute it', state: 'verified', body: '', explains: [], ...over,
})
const solution = (over: Partial<Solution>): Solution => ({
  id: 's1', number: 1, title: 'One estimate service', state: 'idea', addresses: [{ id: 'c2', strength: 'strong' }],
  validatedWith: [], attempts: [], body: '', history: [{ date: '2026-07-01', kind: 'proposed' }], ...over,
})
const experiment = (over: Partial<Experiment>): Experiment => ({
  id: 'e1', number: 1, title: 'Two weeks at one desk', tests: ['s1'], hypothesis: 'Calls halve', outcome: 'running', body: '', ...over,
})

const base: HostModel = {
  name: 'Delivery', elements: [], relations: [], diagrams: [],
  observations: [observation({ history: [{ date: '2026-06-01', kind: 'recorded' }, { date: '2026-09-10', kind: 'seen' }] })],
  causes: [
    cause({ explains: [{ id: 'o1', strength: 'strong' }] }),
    cause({ id: 'c2', number: 2, title: 'Nobody owns the data', explains: [{ id: 'c1', strength: 'strong' }] }),
  ],
}

let ids = 0
function mount(model: HostModel, over: Partial<ObservationsPageProps> = {}) {
  const onChange = vi.fn()
  const utils = renderShell(
    <ObservationsPage
      open
      onClose={() => {}}
      model={model}
      groupName="Acme"
      canShare
      onChange={onChange}
      s={translator('en')}
      language="en"
      makeId={(prefix) => `${prefix}-${++ids}`}
      today={() => '2026-09-24'}
      renderMarkdown={(md) => <MarkdownView markdown={md} />}
      {...over}
    />,
  )
  return { ...utils, onChange }
}

const lastChange = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.calls.at(-1)![0] as ObservationWork

describe('the Solutions tab', () => {
  it('proposes a solution from a root cause, linked to it, and opens it', () => {
    const { onChange } = mount(base, { initialId: 'c2' })
    fireEvent.click(screen.getByTestId('cause-propose'))
    fireEvent.change(screen.getByTestId('new-solution-title'), { target: { value: 'Appoint a data owner' } })
    fireEvent.click(screen.getByTestId('new-solution-create'))
    const next = lastChange(onChange)
    expect(next.solutions).toHaveLength(1)
    expect(next.solutions[0]).toMatchObject({ title: 'Appoint a data owner', state: 'idea', number: 1, addresses: [{ id: 'c2', strength: 'strong' }] })
    expect(next.observations).toEqual(base.observations)
  })

  it('lists what the gate is missing, and keeps the move disabled until it is answered', () => {
    mount({ ...base, solutions: [solution({})] }, { initialId: 'so:s1' })
    const gate = screen.getByTestId('solution-gate')
    expect(within(gate).getByTestId('solution-gate-addresses').dataset.ok).toBe('true')
    expect(within(gate).getByTestId('solution-gate-benefit').dataset.ok).toBe('false')
    expect((screen.getByTestId('solution-move') as HTMLButtonElement).disabled).toBe(true)
    expect(gate.textContent).toContain('4 to go')
  })

  it('moves a vetted idea on to shaped, as a dated event', () => {
    const vetted = solution({ benefit: 'large', cost: 'small', validatedWith: ['Operations'], noneKnown: true })
    const { onChange } = mount({ ...base, solutions: [vetted] }, { initialId: 'so:s1' })
    fireEvent.click(screen.getByTestId('solution-move'))
    const moved = lastChange(onChange).solutions[0]
    expect(moved.state).toBe('shaped')
    expect(moved.history.at(-1)).toEqual({ date: '2026-09-24', kind: 'moved', to: 'shaped' })
  })

  it('answers the gate from the reader: a name checked with, and none known', () => {
    const { onChange } = mount({ ...base, solutions: [solution({})] }, { initialId: 'so:s1' })
    fireEvent.change(screen.getByTestId('solution-validated-field'), { target: { value: 'Operations' } })
    fireEvent.click(screen.getByTestId('solution-validated-add'))
    expect(lastChange(onChange).solutions[0].validatedWith).toEqual(['Operations'])
    fireEvent.click(screen.getByTestId('solution-none-known').querySelector('input')!)
    expect(lastChange(onChange).solutions[0].noneKnown).toBe(true)
  })

  it('plans an experiment for a shaped solution, testing it', () => {
    const shaped = solution({ state: 'shaped' })
    const { onChange } = mount({ ...base, solutions: [shaped] }, { initialId: 'so:s1' })
    fireEvent.click(within(screen.getByTestId('solution-gate')).getByText('Plan an experiment…'))
    fireEvent.change(screen.getByTestId('new-experiment-title'), { target: { value: 'One desk, two weeks' } })
    fireEvent.change(screen.getByTestId('new-experiment-hypothesis'), { target: { value: 'Calls halve' } })
    fireEvent.click(screen.getByTestId('new-experiment-create'))
    expect(lastChange(onChange).experiments[0]).toMatchObject({ tests: ['s1'], hypothesis: 'Calls halve', outcome: 'planned', from: '2026-09-24' })
  })

  it('asks the host for the decision record when that is what the gate waits on', () => {
    const onDecide = vi.fn()
    mount({ ...base, solutions: [solution({ state: 'proven' })] }, { initialId: 'so:s1', onDecide })
    fireEvent.click(screen.getByTestId('solution-decide'))
    expect(onDecide).toHaveBeenCalledWith('s1')
  })

  it('concludes an experiment from its reader', () => {
    const { onChange } = mount({ ...base, solutions: [solution({ state: 'testing' })], experiments: [experiment({})] }, { initialId: 'ex:e1' })
    fireEvent.click(screen.getByTestId('experiment-outcome-confirmed'))
    expect(lastChange(onChange).experiments[0].outcome).toBe('confirmed')
  })

  it('asks whether an implemented solution worked, and names what was seen since', () => {
    const adopted = solution({ state: 'adopted', decision: 'adr1', plan: 'tr1', benefit: 'large' })
    mount({
      ...base,
      solutions: [adopted],
      decisions: [{ id: 'adr1', number: 1, title: 'Own the data', status: 'accepted', date: '2026-08-01', body: '', signers: [] }],
      transitions: [{ id: 'tr1', number: 1, title: 'Owner', status: 'done', to: '2026-09-01', elements: [], decisions: ['adr1'], milestones: [], body: '' }],
    }, { initialId: 'so:s1' })
    expect(screen.getByTestId('solution-phase').textContent).toBe('Implemented')
    expect(screen.getByTestId('solution-did-it-work').textContent).toContain('Seen again on 2026-09-10')
    expect(screen.getByTestId('solution-seen-again').textContent).toContain('OB-0001')
  })

  it('draws the picture with the solution in its lane and flags a root nobody works on', () => {
    mount({ ...base, solutions: [solution({ addresses: [{ id: 'c1', strength: 'normal' }] })] })
    fireEvent.click(screen.getByTestId('observation-tab-solutions'))
    const picture = screen.getByTestId('solution-picture')
    expect(picture.querySelector('[data-key="so:s1"]')?.getAttribute('data-phase')).toBe('idea')
    expect(picture.querySelectorAll('[data-testid="picture-flag"]')).toHaveLength(1)
    expect(screen.getByTestId('solution-coverage').textContent).toBe('0 of 1 root causes have a live solution')
  })

  it('removing a cause takes it out of every solution that addressed it', () => {
    const { onChange } = mount({ ...base, solutions: [solution({})] }, { initialId: 'c2' })
    fireEvent.click(within(screen.getByTestId('cause-reader')).getByText('Delete'))
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Delete'))
    const next = lastChange(onChange)
    expect(next.causes.map((one) => one.id)).toEqual(['c1'])
    expect(next.solutions[0].addresses).toEqual([])
  })
})
