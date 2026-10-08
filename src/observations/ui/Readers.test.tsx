// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The readers' actions (ADR-0032 §7) as a person meets them on the page:
 * every action a button with a name and a sentence that keyboard focus
 * reaches, a root cause offered a solution and never a deeper cause, the
 * refusals that name the records in the way, and a record of a scope below
 * added to in its own scope. Writes are handlers: the page proposes the
 * lists, and a change below is handed to the host as that scope's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
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
/** What a change handed below does to that scope's lists as read. */
const landedBelow = (onChangeBelow: ReturnType<typeof vi.fn<ChangeBelow>>) => {
  const [path, change] = onChangeBelow.mock.calls.at(-1)!
  const held = below.find((one) => one.scope === path)!
  return { path, next: change({ observations: [...held.observations], causes: [...held.causes], solutions: [], experiments: [] })! }
}

describe('the readers’ buttons', () => {
  it('names every action, says in full what it does, and says it on keyboard focus too', async () => {
    mount({ initialId: 'o1' })
    const actions = within(screen.getByRole('group', { name: 'Actions on OB-0001' }))
    expect(actions.getAllByRole('button').map((one) => one.textContent)).toEqual(['Seen again', 'Cause', 'Edit', 'Merge', 'Archive', 'Delete'])
    const seen = actions.getByRole('button', { name: 'Seen again' })
    expect(seen.getAttribute('title')).toBe('Record that this was seen again. It adds a sighting to this observation; nothing new is recorded.')
    fireEvent.keyDown(document.body, { key: 'Tab' })
    act(() => seen.focus())
    const tip = await screen.findByRole('tooltip')
    expect(tip.textContent).toContain('nothing new is recorded')
    expect(seen.getAttribute('aria-describedby')).toBe(tip.id)
    // A cause's say what they change it into.
    cleanup()
    mount({ initialId: 'c1' })
    const make = screen.getByRole('button', { name: 'Make root' })
    expect(make.getAttribute('title')).toContain('CA-0001 becomes RC-0001. Refused while a cause explains it.')
    expect(screen.getByRole('button', { name: 'Deeper cause' })).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })

  it('offers a root cause a solution and never a deeper cause', () => {
    mount({ initialId: 'c2' })
    const actions = within(screen.getByRole('group', { name: 'Actions on RC-0002' }))
    expect(actions.getAllByRole('button').map((one) => one.textContent)).toEqual(['Solution', 'Make cause', 'Local cause', 'Verify', 'Edit', 'Merge', 'Delete'])
  })

  it('adds a deeper cause to a cause below in its own scope, and says so before and after', async () => {
    const { onChange, onChangeBelow } = mount({ initialId: 'acme/claims/intake#bc1' })
    expect(screen.getByTestId('cause-from-below').textContent).toContain('Local to Intake. What you add to it here is made in Intake')
    fireEvent.click(screen.getByRole('button', { name: 'Deeper cause' }))
    expect(screen.getByTestId('link-made-as').textContent).toBe('Made in Intake as CA-0003.')
    fireEvent.change(screen.getByTestId('cause-draft-title'), { target: { value: 'Intake has no duplicate check' } })
    fireEvent.click(screen.getByTestId('link-create'))
    expect(onChange).not.toHaveBeenCalled()
    const { path, next } = landedBelow(onChangeBelow)
    expect(path).toBe('acme/claims/intake')
    expect(next.causes.at(-1)).toMatchObject({ number: 3, title: 'Intake has no duplicate check', explains: [{ id: 'bc1', strength: 'normal' }] })
    await waitFor(() => expect(screen.getByTestId('observation-notice').textContent).toContain('Made in Intake'))
  })

  it('says plainly when the person may read the scope below and not change it', async () => {
    const { onChangeBelow } = mount({ initialId: 'acme/claims/intake#bc1' })
    onChangeBelow.mockImplementation(() => Promise.resolve({ ok: false, reason: 'shell.scopeReadOnly' }))
    fireEvent.click(screen.getByRole('button', { name: 'Deeper cause' }))
    fireEvent.change(screen.getByTestId('cause-draft-title'), { target: { value: 'Intake has no duplicate check' } })
    fireEvent.click(screen.getByTestId('link-create'))
    await waitFor(() => expect(screen.getByTestId('observation-notice').textContent)
      .toBe('Nothing was made in Intake: you may read it, but not change it.'))
  })

  it('links a cause here to a cause below from either end, and keeps the link on the cause here', () => {
    const { onChange } = mount({ initialId: 'c1' })
    fireEvent.click(screen.getByRole('button', { name: 'Local cause' }))
    // Only a cause below that is not a root is offered: a root ends its chain.
    expect(screen.getAllByTestId('link-candidate').map((one) => one.textContent)).toEqual(['CA-0001 The intake form has no lookup (Intake)'])
    fireEvent.click(screen.getByRole('radio', { name: 'CA-0001 The intake form has no lookup (Intake)' }))
    fireEvent.click(screen.getByTestId('link-confirm'))
    expect(lastChange(onChange).causes[0].explains).toEqual([
      { id: 'o1', strength: 'strong' }, { id: 'bc1', scope: 'acme/claims/intake', strength: 'normal' },
    ])
    cleanup()
    // From below: a new cause here, a root as the mockup has it, explaining the one below.
    const again = mount({ initialId: 'acme/claims/intake#bc1' })
    fireEvent.click(screen.getByRole('button', { name: 'Org cause' }))
    fireEvent.change(screen.getByTestId('cause-draft-title'), { target: { value: 'Policyholder data has no owner' } })
    fireEvent.click(screen.getByTestId('link-create'))
    expect(again.onChangeBelow).not.toHaveBeenCalled()
    expect(lastChange(again.onChange).causes.at(-1)).toMatchObject({
      number: 3, root: true, explains: [{ id: 'bc1', scope: 'acme/claims/intake', strength: 'normal' }],
    })
  })

  it('refuses an Org cause on a root cause below, saying why and how to put it right', () => {
    const { onChange } = mount({ initialId: 'acme/claims/intake#bc2' })
    fireEvent.click(screen.getByRole('button', { name: 'Org cause' }))
    expect(screen.queryByRole('dialog', { name: /A cause of Claims/ })).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('is a root cause: nothing explains it. Make it a cause first')
    expect(onChange).not.toHaveBeenCalled()
  })
})
