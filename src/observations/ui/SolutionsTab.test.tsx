// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The Solutions tab as a user meets it (ADR-0026): a solution proposed from
 * a root cause lands linked, the gate lists what is missing and the move
 * stays disabled until it is answered, an experiment is planned from the
 * reader and takes a shaped solution on to testing, a decision is asked of the host, and an implemented solution asks
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

  it('plans an experiment for a shaped solution, and moves the solution on to testing with it', () => {
    const shaped = solution({ state: 'shaped' })
    const { onChange } = mount({ ...base, solutions: [shaped] }, { initialId: 'so:s1' })
    fireEvent.click(within(screen.getByTestId('solution-gate')).getByText('Plan an experiment…'))
    fireEvent.change(screen.getByTestId('new-experiment-title'), { target: { value: 'One desk, two weeks' } })
    fireEvent.change(screen.getByTestId('new-experiment-hypothesis'), { target: { value: 'Calls halve' } })
    fireEvent.click(screen.getByTestId('new-experiment-create'))
    expect(lastChange(onChange).experiments[0]).toMatchObject({ tests: ['s1'], hypothesis: 'Calls halve', outcome: 'planned', from: '2026-09-24' })
    expect(lastChange(onChange).solutions[0]).toMatchObject({ state: 'testing', history: [expect.anything(), { date: '2026-09-24', kind: 'moved', to: 'testing' }] })
  })

  it('lets a shaped solution whose experiment is already confirmed move on', () => {
    const shaped = solution({ state: 'shaped' })
    mount({ ...base, solutions: [shaped], experiments: [experiment({ outcome: 'confirmed' })] }, { initialId: 'so:s1' })
    expect(screen.getByTestId('solution-gate-experimentPlanned').dataset.ok).toBe('true')
    expect((screen.getByTestId('solution-move') as HTMLButtonElement).disabled).toBe(false)
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
    // Its decision stands accepted, so the step back is not offered.
    expect(screen.queryByTestId('solution-back')).toBeNull()
  })

  it('draws the picture with the solution in its lane and flags a root nobody works on', () => {
    mount({ ...base, solutions: [solution({ addresses: [{ id: 'c1', strength: 'normal' }] })] })
    fireEvent.click(screen.getByTestId('observation-tab-solutions'))
    const picture = screen.getByTestId('solution-picture')
    expect(picture.querySelector('[data-key="so:s1"]')?.getAttribute('data-phase')).toBe('idea')
    expect(picture.querySelectorAll('[data-testid="picture-flag"]')).toHaveLength(1)
    expect(screen.getByTestId('solution-coverage').textContent).toBe('0 of 1 root causes have a live solution')
  })

  it('draws a proven solution after the direction it was and the experiment that confirmed it, and opens it from either box', () => {
    mount({ ...base, solutions: [solution({ state: 'proven' })], experiments: [experiment({ outcome: 'confirmed' })] })
    fireEvent.click(screen.getByTestId('observation-tab-solutions'))
    const picture = screen.getByTestId('solution-picture')
    expect(picture.querySelector('[data-key="so:s1"]')?.getAttribute('data-phase')).toBe('proven')
    const kinds = [...picture.querySelectorAll('[data-testid="solution-link"]')].map((line) => line.getAttribute('data-kind')).sort()
    expect(kinds).toEqual(['addresses', 'proves', 'tests'])
    // Confirmed, so the line into it is as solid as the one out of it.
    const into = picture.querySelector('[data-testid="solution-link"][data-kind="tests"]')!
    expect(into.getAttribute('stroke-dasharray')).toBeNull()
    fireEvent.click(picture.querySelector('[data-key="so:s1#direction"]')!)
    expect(screen.getByTestId('solution-phase').textContent).toBe('Proven')
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

describe('the solutions picture’s right-click', () => {
  const rightClick = (element: Element) => fireEvent.contextMenu(element, { clientX: 40, clientY: 60 })
  const items = () => within(screen.getByTestId('picture-menu')).getAllByRole('menuitem')

  it('offers a solution’s own actions, with the move enabled once its gate is clear', () => {
    const { onChange } = mount({ ...base, solutions: [solution({ state: 'shaped' })], experiments: [experiment({ outcome: 'confirmed' })] })
    fireEvent.click(screen.getByTestId('observation-tab-solutions'))
    rightClick(screen.getByTestId('solution-picture').querySelector('[data-key="so:s1"]')!)
    expect(items().map((item) => item.textContent)).toEqual([
      'Edit', 'Address a cause…', 'Plan an experiment…', 'Move to testing', 'Back to idea', 'Drop…', 'Delete',
    ])
    fireEvent.click(screen.getByTestId('picture-menu-move'))
    expect(lastChange(onChange).solutions[0].state).toBe('testing')
  })

  it('concludes an experiment from the picture', () => {
    const { onChange } = mount({ ...base, solutions: [solution({ state: 'testing' })], experiments: [experiment({})] })
    fireEvent.click(screen.getByTestId('observation-tab-solutions'))
    rightClick(screen.getByTestId('solution-picture').querySelector('[data-key="ex:e1"]')!)
    expect(screen.getByTestId('picture-menu-outcome-running').textContent).toContain('✓')
    fireEvent.click(screen.getByTestId('picture-menu-outcome-confirmed'))
    expect(lastChange(onChange).experiments[0].outcome).toBe('confirmed')
  })

  it('proposes solutions on root causes only, from the menu and from the reader', () => {
    mount({ ...base }, { initialId: 'c1' })
    expect(screen.queryByTestId('cause-propose')).toBeNull()
    expect(screen.getByTestId('cause-propose-at-root').textContent).toContain('root cause')
    fireEvent.click(screen.getByTestId('observation-tab-analysis'))
    rightClick(screen.getByTestId('analysis-picture').querySelector('[data-key="c1"]')!)
    expect(screen.queryByTestId('picture-menu-propose')).toBeNull()
    fireEvent.keyDown(screen.getByTestId('picture-menu'), { key: 'Escape' })
    rightClick(screen.getByTestId('analysis-picture').querySelector('[data-key="c2"]')!)
    expect(screen.getByTestId('picture-menu-propose')).toBeTruthy()
  })

  it('changes how firmly an experiment bears on a solution from either of its lines, and unlinks it', () => {
    const { onChange } = mount({ ...base, solutions: [solution({ state: 'proven' })], experiments: [experiment({ outcome: 'confirmed' })] })
    fireEvent.click(screen.getByTestId('observation-tab-solutions'))
    const line = (kind: string) => [...screen.getAllByTestId('solution-link-hit')].find((hit) => hit.getAttribute('data-kind') === kind)!
    rightClick(line('tests'))
    fireEvent.click(screen.getByTestId('picture-menu-strength-strong'))
    expect(lastChange(onChange).experiments[0].strength).toEqual({ s1: 'strong' })
    rightClick(line('proves'))
    fireEvent.click(screen.getByTestId('picture-menu-unlink'))
    expect(lastChange(onChange).experiments[0].tests).toEqual([])
  })

  it('changes how strongly a solution addresses a cause from its line, and the direction it was opens it', () => {
    const { onChange } = mount({ ...base, solutions: [solution({ state: 'proven' })], experiments: [experiment({ outcome: 'confirmed' })] })
    fireEvent.click(screen.getByTestId('observation-tab-solutions'))
    const line = [...screen.getAllByTestId('solution-link-hit')].find((hit) => hit.getAttribute('data-kind') === 'addresses')!
    rightClick(line)
    fireEvent.click(screen.getByTestId('picture-menu-strength-normal'))
    expect(lastChange(onChange).solutions[0].addresses).toEqual([{ id: 'c2', strength: 'normal' }])
    rightClick(screen.getByTestId('solution-picture').querySelector('[data-key="so:s1#direction"]')!)
    fireEvent.click(screen.getByTestId('picture-menu-edit'))
    expect(screen.queryByTestId('solution-picture')).toBeNull()
    expect(screen.getByTestId('solution-reader')).toBeTruthy()
  })
})

