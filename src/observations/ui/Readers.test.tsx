// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The readers' actions (ADR-0032 §7) as a person meets them on the page:
 * every action a button with a name and a sentence that keyboard focus
 * reaches, a root cause offered a solution and never a deeper cause, and
 * the refusals that name the records in the way. Writes are handlers: the
 * page proposes the lists.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { translator } from '../../i18n'
import type { HostModel } from '../../model/hostModel'
import type { Cause, Observation, ScopeAnalysis } from '../observation'
import { MarkdownView } from '../../documentation/ui/MarkdownView'
import { ObservationsPage } from './ObservationsPage'
import type { ChangeBelow, ObservationsPageProps } from './ObservationsPage'
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
    expect(actions.getAllByRole('button').map((one) => one.textContent)).toEqual(['Solution', 'Make cause', 'Verify', 'Edit', 'Delete'])
  })
})
