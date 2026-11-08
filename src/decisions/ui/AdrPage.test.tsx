// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The decisions page as a user meets it: one list by whether a record is in
 * force, what it is about as a filter, a record read large with one verb, written
 * in a full window, the status moves the machine allows and nothing else, a locked
 * record with no way to write it, and the search across every list at once. Writes
 * are handlers: the page proposes a list, the caller keeps it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { translator } from '../../i18n'
import type { Adr } from '../adr'
import type { HostModel } from '../../model/hostModel'
import { MarkdownView } from '../../documentation/ui/MarkdownView'
import { AdrPage } from './AdrPage'
import type { AdrPageProps } from './AdrPage'
import { madrTemplate } from '../adr'
import { renderShell } from '../../app/testing/renderShell'
import { chooseValue } from '../../widgets/kit/testing/select'

afterEach(() => cleanup())

const element = (id: string, name: string, kind = 'application') => ({
  id, name, kind, lifecycle: 'live', isManaged: true, aspects: {},
}) as HostModel['elements'][number]

const adr = (over: Partial<Adr>): Adr => ({
  id: 'x', number: 1, title: 'T', status: 'proposed', date: '2026-09-01', body: '## Context\n\nWhy.', signers: [], ...over,
})

const model: HostModel = {
  name: 'Warehouse landscape', 
  elements: [element('crm', 'Customer CRM'), element('wms', 'Warehouse system'), element('kafka', 'Kafka', 'component')],
  relations: [], diagrams: [],
  decisions: [
    adr({ id: 'l1', number: 1, title: 'Event-driven integration', status: 'proposed' }),
    adr({ id: 'l2', number: 2, title: 'One warehouse system', status: 'accepted' }),
    adr({ id: 'c1', number: 3, title: 'CRM stays system of record', subjectId: 'crm', status: 'reviewing' }),
  ],
}
/** One scope above this one, as the page is handed it (ADR-0012 §7). */
const ancestors = [{
  path: 'acme',
  name: 'Acme Logistics',
  decisions: [adr({ id: 'g1', number: 1, title: 'One identity provider', body: 'Every project logs in the same way.' })],
}]

let ids = 0
const page = (over: Partial<AdrPageProps> = {}) => (
  <AdrPage
    open
    onClose={() => {}}
    model={model}
    groupName="Acme Logistics"
    ancestors={ancestors}
    onProjectDecisionsChange={() => {}}
    s={translator('en')}
    language="en"
    makeId={(prefix) => `${prefix}-${++ids}`}
    today={() => '2026-09-05'}
    renderMarkdown={(md) => <MarkdownView markdown={md} />}
    {...over}
  />
)
function mount(over: Partial<AdrPageProps> = {}) {
  const onProject = vi.fn()
  const onOpenScope = vi.fn()
  const utils = renderShell(page({ onOpenScope, onProjectDecisionsChange: onProject, ...over }))
  return { ...utils, onProject, onOpenScope }
}

const record = () => screen.getByRole('dialog', { name: /./, hidden: false })
const list = () => screen.getByTestId('adr-list')
const titled = () => record().querySelector('h2')?.textContent
const row = (text: string) => within(list()).getByText(text)
const groupOf = (text: string) => {
  // Each row sits after its group's head; the nearest head above it is its group.
  const rows = [...list().querySelectorAll<HTMLElement>('[data-kit-row]')]
  const at = rows.findIndex((one) => one.textContent?.includes(text))
  return rows.slice(0, at).reverse().find((one) => one.dataset.kitRow?.startsWith('head:'))?.textContent
}
const more = async (name: string) => {
  fireEvent.click(within(record()).getByRole('button', { name: 'More' }))
  fireEvent.click(await screen.findByRole('menuitem', { name }))
}

describe('AdrPage, as axe reads it', () => {
  it('finds nothing on the list and the record, nor read-only', async () => {
    mount()
    expect(await axeFindings()).toEqual([])
    cleanup()
    mount({ initialAdrId: 'c1', initialNonce: 1 })
    expect(await axeFindings()).toEqual([])
    cleanup()
    mount({ readOnly: true })
    expect(await axeFindings()).toEqual([])
  })
})

describe('the list', () => {
  it('groups by whether a record is in force, says each status once, and opens on the list', () => {
    mount()
    expect(groupOf('Event-driven integration')).toContain('Still open')
    expect(groupOf('CRM stays system of record')).toContain('Still open')
    expect(groupOf('One warehouse system')).toContain('In force')
    expect(within(list()).getByText(/Ended · 0/)).toBeTruthy()
    // A row is the number and the title: the status is said by the group.
    expect(within(list()).queryByText('Accepted')).toBeNull()
    expect(document.querySelector('[data-guide="decision.record"]')).toBeNull()
  })

  it('keeps every application in the About filter, and narrows to one', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    const panel = await screen.findByRole('dialog', { name: 'Filter' })
    expect(within(panel).getByText('This scope as a whole')).toBeTruthy()
    expect(within(panel).getByText('With decisions')).toBeTruthy()
    expect(within(panel).getByText('With none yet')).toBeTruthy()
    expect(within(panel).getByText('Warehouse system')).toBeTruthy()
    // Components are not a level: only an application, or what holds a record.
    expect(within(panel).queryByText('Kafka')).toBeNull()
    fireEvent.click(within(panel).getByLabelText(/Customer CRM/))
    expect(within(list()).getByText('CRM stays system of record')).toBeTruthy()
    expect(within(list()).queryByText('One warehouse system')).toBeNull()
    expect(screen.getByText('About: Customer CRM')).toBeTruthy()
  })

  it('keeps what left the model in the filter, under its own heading', async () => {
    const decisions = [...model.decisions!, adr({ id: 'o1', number: 9, title: 'About the old batch', subjectId: 'old-batch' })]
    mount({ model: { ...model, decisions } })
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    const panel = await screen.findByRole('dialog', { name: 'Filter' })
    expect(within(panel).getByText('Removed applications')).toBeTruthy()
    expect(within(panel).getByText('old-batch')).toBeTruthy()
  })

  /** A fold per ancestor at the foot, and none for a scope that holds nothing. */
  it('keeps the scopes above folded at the foot', () => {
    mount({ ancestors: [...ancestors, { path: '', name: 'Globex', decisions: [] }] })
    expect(within(list()).getByText(/From Acme Logistics · 1/)).toBeTruthy()
    expect(within(list()).queryByText(/From Globex/)).toBeNull()
    expect(within(list()).queryByText('One identity provider')).toBeNull()
    fireEvent.click(within(list()).getByText(/From Acme Logistics/))
    expect(within(list()).getByText('One identity provider')).toBeTruthy()
  })

  it('searches every list at once, and a hit from above says where it lives', () => {
    mount()
    const find = screen.getByLabelText('Find a decision')
    fireEvent.change(find, { target: { value: 'system' } })
    expect(within(list()).getByText('One warehouse system')).toBeTruthy()
    expect(within(list()).getByText('CRM stays system of record')).toBeTruthy()
    fireEvent.change(find, { target: { value: 'logs in' } })
    expect(within(list()).getByText('One identity provider')).toBeTruthy()
    expect(within(list()).getByText('Acme Logistics')).toBeTruthy()
    fireEvent.change(find, { target: { value: 'zzz' } })
    expect(within(list()).getByText(/No decision matches/)).toBeTruthy()
  })

  it('says what a record is where there are none, and offers the first', () => {
    mount({ ancestors: [], model: { ...model, decisions: [] } })
    expect(screen.getByText('No decisions in Warehouse landscape yet')).toBeTruthy()
    expect(screen.getByText(/what was chosen, what else was considered/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New decision' })).toBeTruthy()
    cleanup()
    mount({ ancestors: [], model: { ...model, decisions: [] }, readOnly: true })
    expect(screen.queryByRole('button', { name: 'New decision' })).toBeNull()
  })
})

describe('a new decision', () => {
  it('files it where the dialog says, with the next number, and opens ready to write', async () => {
    const { onProject, rerender } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'New decision' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Retire the legacy sync' } })
    chooseValue(screen.getByLabelText('About'), 'crm')
    fireEvent.click(screen.getByRole('button', { name: 'Create and write' }))
    const next: Adr[] = onProject.mock.calls[0][0]
    expect(next).toHaveLength(4)
    expect(next[3]).toMatchObject({ title: 'Retire the legacy sync', subjectId: 'crm', number: 4, status: 'proposed', date: '2026-09-05' })
    expect(next[3].body).toContain('## Decision Outcome')
    rerender(page({ model: { ...model, decisions: next } }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    expect((screen.getByLabelText('Context and Problem Statement') as HTMLTextAreaElement).value).toBe('')
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Context and Problem Statement')))
  })

  it('lands about the scope itself unless somebody said otherwise', () => {
    const { onProject } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'New decision' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'One way to log in' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create and write' }))
    expect(onProject.mock.calls[0][0][3].subjectId).toBeUndefined()
  })
})

describe('a record, read', () => {
  it('says where it stands once, and a stepper with the step it is on', () => {
    mount({ initialAdrId: 'c1', initialNonce: 1 })
    expect(screen.getByTestId('adr-status').textContent).toContain('Under review since 1 Sept 2026.')
    expect(screen.getByTestId('adr-status').textContent).toContain('About Customer CRM.')
    const steps = within(record()).getByRole('list', { name: 'Where it stands' })
    expect(within(steps).getByText('Under review').closest('li')?.getAttribute('aria-current')).toBe('step')
  })

  it('reads an open record as what was written, not the template', () => {
    const decisions = model.decisions!.map((one) => (one.id === 'l1' ? { ...one, body: madrTemplate(translator('en')) } : one))
    mount({ model: { ...model, decisions }, initialAdrId: 'l1', initialNonce: 1 })
    expect(within(record()).queryByText(/A force, a concern/)).toBeNull()
  })

  /**
   * A record is edited where it lives (ADR-0012 §7): an ancestor's is readable
   * here, locked here, and one press from the scope that holds it.
   */
  it('shows an ancestor’s records read-only, and offers to open that scope', () => {
    const { onProject, onOpenScope } = mount({ initialAdrId: 'g1' })
    expect(screen.getByTestId('adr-from-ancestor').textContent).toContain('Acme Logistics')
    expect(within(record()).getByText('ADR-0001 of Acme Logistics')).toBeTruthy()
    expect(within(record()).queryByRole('button', { name: 'Edit text' })).toBeNull()
    expect(within(record()).queryByRole('button', { name: 'Send for review' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open Acme Logistics' }))
    expect(onOpenScope).toHaveBeenCalledExactlyOnceWith('acme', 'g1')
    expect(onProject).not.toHaveBeenCalled()
  })

  it('offers this scope\'s record a history, and never an ancestor\'s (ADR-0008)', () => {
    // An ancestor's records are files in another scope's folder, which this
    // scope's history does not cover.
    const onOpenHistory = vi.fn()
    mount({ initialAdrId: 'l1', onOpenHistory })
    fireEvent.click(within(record()).getByRole('button', { name: 'History…' }))
    expect(onOpenHistory).toHaveBeenCalledExactlyOnceWith('l1')
    cleanup()
    mount({ initialAdrId: 'g1', onOpenHistory })
    expect(within(record()).queryByRole('button', { name: 'History…' })).toBeNull()
    cleanup()
    mount({ initialAdrId: 'l1' })
    expect(within(record()).queryByRole('button', { name: 'History…' })).toBeNull()
  })

  it('names the one thing next, moves only as the machine allows, and applies it', () => {
    const { onProject } = mount({ initialAdrId: 'l1' })
    expect(within(record()).queryByRole('button', { name: /Accept/ })).toBeNull()
    const verb = within(record()).getByRole('button', { name: 'Send for review' })
    expect(verb.getAttribute('data-guide')).toBe('decision.move')
    fireEvent.click(verb)
    const next: Adr[] = onProject.mock.calls[0][0]
    expect(next.find((a) => a.id === 'l1')).toMatchObject({ status: 'reviewing', date: '2026-09-05' })
  })

  it('sends a record under review back from under More', async () => {
    const { onProject } = mount({ initialAdrId: 'c1' })
    await more('Send back to proposed')
    expect(onProject.mock.calls[0][0].find((a: Adr) => a.id === 'c1').status).toBe('proposed')
  })

  it('locks an accepted record: nothing to write, no Delete, Mark as superseded under More', async () => {
    // An accepted record to point at: a proposal is never offered as a successor (ADR-0008).
    const withSuccessor = {
      ...model,
      decisions: [...model.decisions!, adr({ id: 'l3', number: 4, title: 'Event-driven integration, decided', status: 'accepted' })],
    }
    mount({ model: withSuccessor, initialAdrId: 'l2' })
    expect(within(record()).queryByRole('button', { name: 'Edit text' })).toBeNull()
    expect(screen.getByTestId('adr-status').textContent).toContain('Locked: to change it, write a decision that replaces it.')
    await more('Mark as superseded…')
    const dialog = screen.getByRole('dialog', { name: /Mark as superseded/ })
    expect(within(dialog).getByLabelText('Successor')).toBeTruthy()
  })

  it('records the successor with a verb, and shows the link from the superseded record', async () => {
    // Only an accepted record can replace one in force (ADR-0008): the
    // proposal l1 is not offered, the accepted l3 is.
    const withSuccessor = {
      ...model,
      decisions: [...model.decisions!, adr({ id: 'l3', number: 4, title: 'Event-driven integration, decided', status: 'accepted' })],
    }
    const { onProject, rerender } = mount({ model: withSuccessor, initialAdrId: 'l2' })
    await more('Mark as superseded…')
    fireEvent.click(within(screen.getByRole('dialog', { name: /Mark as superseded/ })).getByRole('button', { name: 'Mark as superseded' }))
    const next: Adr[] = onProject.mock.calls[0][0]
    const l2 = next.find((a) => a.id === 'l2')!
    expect(l2.status).toBe('superseded')
    expect(l2.supersededBy).toBe('l3')
    rerender(page({ model: { ...model, decisions: next }, initialAdrId: 'l2' }))
    expect(within(screen.getByTestId('adr-superseded-by')).getByRole('button', { name: 'ADR-0004 Event-driven integration, decided', hidden: true })).toBeTruthy()
  })

  it('offers no proposal as a successor, and says how to supersede instead', async () => {
    const { onProject } = mount({ initialAdrId: 'l2' })
    await more('Mark as superseded…')
    const dialog = screen.getByRole('dialog', { name: /Mark as superseded/ })
    expect(within(dialog).queryByLabelText('Successor')).toBeNull()
    expect(within(dialog).getByText(/no accepted decision/)).toBeTruthy()
    expect(onProject).not.toHaveBeenCalled()
  })

  it('shows what acceptance still needs from the first draft, and the verb says how much', () => {
    const { onProject } = mount({ initialAdrId: 'c1' })
    const gate = within(record()).getByTestId('adr-gate')
    expect(gate.querySelector('[data-gate-item="approved"]')?.getAttribute('data-ok')).toBe('false')
    expect(gate.querySelector('[data-gate-item="context"]')?.getAttribute('data-ok')).toBe('true')
    const verb = within(record()).getByTestId('adr-move-accepted')
    expect(verb.textContent).toMatch(/Accept: \d still open/)
    expect(verb.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(verb)
    expect(onProject).not.toHaveBeenCalled()
    cleanup()
    mount({ initialAdrId: 'l1' })
    expect(within(record()).getByTestId('adr-gate')).toBeTruthy()
    cleanup()
    mount({ initialAdrId: 'l2' })
    expect(within(record()).queryByTestId('adr-gate')).toBeNull()
  })

  it('writes out what a line of the gate looks for, and which option names the outcome may use', () => {
    const body = '## Considered Options\n\n* Tender: buy it\n* Build in-house (on AKS)\n\n## Decision Outcome\n\nBuild it.'
    const decisions = model.decisions!.map((one) => (one.id === 'c1' ? { ...one, body } : one))
    mount({ model: { ...model, decisions }, initialAdrId: 'c1' })
    const outcome = screen.getByTestId('adr-gate').querySelector('[data-gate-item="outcome"]')!
    expect(outcome.getAttribute('data-ok')).toBe('false')
    expect(outcome.textContent).toContain('up to the first colon')
    expect(outcome.textContent).toContain('The names it looks for: “Tender”, “Build in-house”.')
  })

  it('goes from a line of the gate to where it is answered', () => {
    mount({ initialAdrId: 'c1' })
    const outcome = screen.getByTestId('adr-gate').querySelector('[data-gate-item="outcome"]')!
    fireEvent.click(within(outcome as HTMLElement).getByRole('button'))
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })

  it('confirms before it accepts, and supersedes what the record names in the same step', () => {
    const decided = [
      '## Context', '', 'Two systems.', '', '## Considered Options', '', '* One system', '* Two systems', '',
      '## Decision Outcome', '', 'Chosen option: One system, because it is simpler.', '',
      '### Consequences', '', '* Good, because stock is in one place.',
    ].join('\n')
    const ready = adr({
      id: 'l4', number: 4, title: 'One warehouse system, properly', status: 'reviewing', body: decided,
      supersedes: ['l2'], signers: [{ name: 'Kim', verdict: 'approved', signedAt: '2026-09-02' }],
    })
    const { onProject } = mount({ model: { ...model, decisions: [...model.decisions!, ready] }, initialAdrId: 'l4' })
    fireEvent.click(within(record()).getByRole('button', { name: 'Accept…' }))
    const dialog = screen.getByRole('dialog', { name: /Accept ADR-0004/ })
    expect(within(dialog).getByText(/also marks ADR-0002 as superseded/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Accept' }))
    const next: Adr[] = onProject.mock.calls[0][0]
    // The successor first, so a writer that checks each move sees it accepted.
    expect(next[0]).toMatchObject({ id: 'l4', status: 'accepted', date: '2026-09-05' })
    expect(next.find((a) => a.id === 'l2')).toMatchObject({ status: 'superseded', supersededBy: 'l4' })
  })

  it('withdraws a proposal only with a reason, keeps its number, and says the reason after', async () => {
    const { onProject, rerender } = mount({ initialAdrId: 'l1' })
    await more('Withdraw…')
    const dialog = screen.getByRole('dialog', { name: /Withdraw ADR-0001/ })
    const confirm = within(dialog).getByRole('button', { name: 'Withdraw' })
    expect(confirm.hasAttribute('disabled')).toBe(true)
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Overtaken by the merger.' } })
    fireEvent.click(confirm)
    const next: Adr[] = onProject.mock.calls[0][0]
    expect(next.find((a) => a.id === 'l1')).toMatchObject({ status: 'rejected', number: 1, reason: 'Overtaken by the merger.' })
    rerender(page({ model: { ...model, decisions: next }, initialAdrId: 'l1' }))
    expect(screen.getByTestId('adr-reason').textContent).toContain('Overtaken by the merger.')
  })

  it('deletes an open record from under More, and asks first', async () => {
    const { onProject } = mount({ initialAdrId: 'l1' })
    await more('Delete…')
    fireEvent.click(within(screen.getByRole('dialog', { name: /Delete ADR-0001/ })).getByRole('button', { name: 'Delete' }))
    expect(onProject.mock.calls[0][0].some((a: Adr) => a.id === 'l1')).toBe(false)
  })

  it('says when a record is superseded by one that is not accepted', () => {
    const broken = {
      ...model,
      decisions: model.decisions!.map((one) => (one.id === 'l2' ? { ...one, status: 'superseded' as const, supersededBy: 'l1' } : one)),
    }
    mount({ model: broken, initialAdrId: 'l2' })
    expect(screen.getByTestId('adr-broken-successor')).toBeTruthy()
  })

  it('names the solution a record was decided for, and opens it through the host', () => {
    const onOpenSolution = vi.fn()
    const solution = {
      id: 'so-1', number: 1, title: 'One owner for stock', state: 'proven' as const, addresses: [], validatedWith: [],
      attempts: [], history: [], body: '', decision: 'l2',
    }
    mount({ model: { ...model, solutions: [solution] as unknown as HostModel['solutions'] }, initialAdrId: 'l2', onOpenSolution })
    fireEvent.click(within(screen.getByTestId('adr-decided-for')).getByRole('button', { name: 'SO-0001 One owner for stock' }))
    expect(onOpenSolution).toHaveBeenCalledWith('so-1')
  })

  it('opens on the record the search asked for', () => {
    mount({ initialAdrId: 'g1' })
    expect(within(record()).getByRole('heading', { name: 'One identity provider' })).toBeTruthy()
    expect(screen.getByTestId('adr-status').textContent).toContain('Proposed 1 Sept 2026.')
  })

  it('selects by pressing a row, walks with the arrows and lets go with Escape, back on the row', async () => {
    const onShown = vi.fn()
    mount({ onShown })
    fireEvent.click(row('Event-driven integration'))
    expect(onShown).toHaveBeenLastCalledWith('l1', undefined)
    fireEvent.keyDown(record(), { key: 'ArrowDown' })
    expect(onShown).toHaveBeenLastCalledWith(expect.not.stringMatching('l1'), undefined)
    fireEvent.click(within(record()).getByRole('button', { name: 'Close' }))
    expect(onShown).toHaveBeenLastCalledWith(undefined, undefined)
    expect(document.querySelector('[data-guide="decision.record"]')).toBeNull()
  })

  /**
   * The record it was opened on is where it starts, not where it stays: every
   * save hands the page a new list, and taking the person back to that record
   * on each one closed what they had moved to.
   */
  it('stays on the record chosen after opening when the list comes back changed', () => {
    const { rerender } = mount({ initialAdrId: 'l2' })
    fireEvent.keyDown(record(), { key: 'ArrowUp' })
    const title = titled()
    expect(title).not.toBe('One warehouse system')
    const saved = model.decisions!.map((one) => ({ ...one, body: `${one.body}\n\nMore.` }))
    rerender(page({ model: { ...model, decisions: saved }, initialAdrId: 'l2' }))
    expect(titled()).toBe(title)
  })

  /**
   * Once per opening was once per record: asked for a record, moved to
   * another, and asked for the first again — from the search, or by an
   * agent's app.open — the page stayed where it was. Each request carries a
   * number of its own now, and the page says which record it shows.
   */
  it('goes back to a record asked for again after another was chosen, and says which it shows', () => {
    const onShown = vi.fn()
    const asked = (nonce: number) => page({ initialAdrId: 'l2', initialNonce: nonce, onShown })
    const { rerender } = renderShell(asked(1))
    const title = titled
    expect(title()).toBe('One warehouse system')
    expect(onShown).toHaveBeenLastCalledWith('l2', 1)
    fireEvent.keyDown(record(), { key: 'ArrowDown' })
    const moved = title()
    expect(moved).not.toBe('One warehouse system')
    rerender(asked(1))
    expect(title()).toBe(moved)
    rerender(asked(2))
    expect(title()).toBe('One warehouse system')
    expect(onShown).toHaveBeenLastCalledWith('l2', 2)
  })
})

describe('a record, written', () => {
  const writing = (over: Partial<AdrPageProps> = {}) => {
    const utils = mount({ initialAdrId: 'l1', ...over })
    fireEvent.click(within(record()).getByRole('button', { name: 'Edit text' }))
    return utils
  }

  it('is a window of its own with a box a section, saved as one step', () => {
    const { onProject } = writing()
    const context = screen.getByLabelText('Context') as HTMLTextAreaElement
    expect(context.value).toBe('Why.')
    fireEvent.change(context, { target: { value: 'Why, written better.' } })
    expect(onProject).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onProject).toHaveBeenCalledTimes(1)
    expect(onProject.mock.calls[0][0].find((a: Adr) => a.id === 'l1').body).toBe('## Context\n\nWhy, written better.\n')
  })

  it('has the whole source one press away, and a heading is changed there', () => {
    const { onProject } = writing()
    fireEvent.click(screen.getByRole('radio', { name: 'Source' }))
    const source = screen.getByLabelText('Decision source (markdown)') as HTMLTextAreaElement
    expect(source.value).toBe('## Context\n\nWhy.')
    fireEvent.change(source, { target: { value: '## Background\n\nWhy.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onProject.mock.calls[0][0].find((a: Adr) => a.id === 'l1').body).toBe('## Background\n\nWhy.')
  })

  it('asks before Cancel drops what was typed, and not otherwise', async () => {
    const { onProject } = writing()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    fireEvent.click(within(record()).getByRole('button', { name: 'Edit text' }))
    fireEvent.change(screen.getByLabelText('Context'), { target: { value: 'Changed.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Leave and drop changes' }))
    expect(onProject).not.toHaveBeenCalled()
  })

  it('keeps the reviewers, who proposed it and what it supersedes beside the text, by section and in the source', () => {
    writing()
    const beside = () => document.querySelector<HTMLElement>('.kit-focused__aside') as HTMLElement
    const held = () => {
      for (const id of ['adr-gate', 'adr-signers', 'adr-proposed-by', 'adr-supersedes']) expect(within(beside()).getByTestId(id)).toBeTruthy()
      expect(document.querySelector('.adr-write [data-testid="adr-signers"]')).toBeNull()
    }
    held()
    fireEvent.click(screen.getByRole('radio', { name: 'Source' }))
    held()
    expect(document.querySelector('.adr-write[data-mode="source"]')).not.toBeNull()
  })

  it('names the proposer on screen, and a reviewer\'s fields one by one', () => {
    writing()
    const proposer = within(screen.getByTestId('adr-proposed-by'))
    expect(proposer.getByText('Proposed by').tagName).toBe('LABEL')
    expect(proposer.getByLabelText('Proposed by').tagName).toBe('INPUT')
    fireEvent.click(screen.getByRole('button', { name: 'Add a reviewer' }))
    const signers = within(within(document.querySelector<HTMLElement>('.kit-focused__aside') as HTMLElement).getByTestId('adr-signers'))
    for (const word of ['Name', 'Role', 'Verdict']) expect(signers.getByLabelText(word)).toBeTruthy()
    expect(signers.queryByRole('table')).toBeNull()
  })

  it('holds the title, who proposed it, what it supersedes, and the reviewers', () => {
    const { onProject } = writing()
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Events, decided' } })
    fireEvent.click(within(screen.getByTestId('adr-supersedes')).getByLabelText(/One warehouse system/))
    fireEvent.click(screen.getByRole('button', { name: 'Add a reviewer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onProject.mock.calls[0][0].find((a: Adr) => a.id === 'l1')).toMatchObject({
      title: 'Events, decided', supersedes: ['l2'], signers: [{ name: '' }],
    })
  })

  it('dates a verdict today', () => {
    const decisions = model.decisions!.map((one) => (one.id === 'c1' ? { ...one, signers: [{ name: 'Kim' }] } : one))
    const { onProject } = writing({ model: { ...model, decisions }, initialAdrId: 'c1' })
    chooseValue(screen.getByLabelText('Verdict'), 'approved')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onProject.mock.calls[0][0].find((a: Adr) => a.id === 'c1').signers[0]).toMatchObject({ verdict: 'approved', signedAt: '2026-09-05' })
  })

  it('refuses to be Done with no title, and says why', () => {
    const { onProject } = writing()
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: ' ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onProject).not.toHaveBeenCalled()
  })

  it('leaves the gate beside the writing, following the text', () => {
    writing()
    const line = () => screen.getAllByTestId('adr-gate').at(-1)?.querySelector('[data-gate-item="context"]')
    expect(line()?.getAttribute('data-ok')).toBe('true')
    fireEvent.change(screen.getByLabelText('Context'), { target: { value: '' } })
    expect(line()?.getAttribute('data-ok')).toBe('false')
  })

  it('takes a pasted picture through the shared editor', async () => {
    const onAddImage = vi.fn(async () => 'screenshot-k1.png')
    const { onProject } = writing({ onAddImage })
    const area = screen.getByLabelText('Context') as HTMLTextAreaElement
    const file = new File([new Uint8Array([1, 2])], 'Screenshot.png', { type: 'image/png' })
    fireEvent.paste(area, { clipboardData: { files: [file], items: [], types: ['Files'], getData: () => '' } })
    await vi.waitFor(() => expect(area.value).toContain('![Screenshot](image:screenshot-k1.png)'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onProject).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'l1', body: expect.stringContaining('screenshot-k1.png') }),
    ]))
  })
})

describe('the plans that rest on a record (ADR-0010)', () => {
  const plan = {
    id: 'tr-1', number: 1, title: 'Replace the warehouse system', status: 'agreed' as const,
    elements: [], decisions: ['l2'], milestones: [], body: '',
  }

  it('links back to each plan, and opens it through the host', () => {
    const onOpenPlan = vi.fn()
    const onClose = vi.fn()
    mount({ model: { ...model, transitions: [plan] }, initialAdrId: 'l2', onOpenPlan, onClose })
    const line = screen.getByTestId('adr-plans')
    fireEvent.click(within(line).getByRole('button', { name: 'TR-0001 Replace the warehouse system' }))
    expect(onOpenPlan).toHaveBeenCalledWith('tr-1')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows no line when nothing rests on it, or the host cannot open a plan', () => {
    mount({ model: { ...model, transitions: [plan] }, initialAdrId: 'l2' })
    expect(screen.queryByTestId('adr-plans')).toBeNull()
  })
})

/** ADR-0033, amended 11 October 2026: a link to one record, and the record a link opens on. */
describe('AdrPage, and a link to a record', () => {
  it('offers Copy link under More, read-only too, and only where the host makes links', async () => {
    const onCopyLink = vi.fn()
    mount({ readOnly: true, onCopyLink, initialAdrId: 'c1', initialNonce: 1 })
    await more('Copy link')
    expect(onCopyLink).toHaveBeenCalledWith('c1')
    cleanup()
    mount({ readOnly: true, initialAdrId: 'c1', initialNonce: 1 })
    expect(within(record()).queryByRole('button', { name: 'More' })).toBeNull()
  })

  it('opens on the record asked for, its row selected', () => {
    mount({ initialAdrId: 'c1', initialNonce: 1 })
    const held = document.querySelector('[data-kit-row="row:c1"]')
    expect(held?.getAttribute('aria-selected')).toBe('true')
  })
})
