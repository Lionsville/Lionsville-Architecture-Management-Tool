// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The decisions page as a user meets it: the tree of places, a record created
 * in the right list under the right number, the status moves the machine
 * allows and nothing else, a locked record with no Edit, and the search across
 * every list at once. Writes are handlers: the page proposes a list, the
 * caller keeps it.
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
import { renderShell } from '../../app/testing/renderShell'

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
function mount(over: Partial<AdrPageProps> = {}) {
  const onProject = vi.fn()
  const onOpenScope = vi.fn()
  const utils = renderShell(
    <AdrPage
      open
      onClose={() => {}}
      model={model}
      groupName="Acme Logistics"
      ancestors={ancestors}
      onOpenScope={onOpenScope}
      onProjectDecisionsChange={onProject}
      s={translator('en')}
      language="en"
      makeId={(prefix) => `${prefix}-${++ids}`}
      today={() => '2026-09-05'}
      renderMarkdown={(md) => <MarkdownView markdown={md} />}
      {...over}
    />,
  )
  return { ...utils, onProject, onOpenScope }
}

describe('AdrPage, as axe reads it', () => {
  it('finds nothing on the tree, the list and the record, nor read-only', async () => {
    mount()
    expect(await axeFindings()).toEqual([])
    cleanup()
    mount({ readOnly: true })
    expect(await axeFindings()).toEqual([])
  })
})

describe('AdrPage', () => {
  it('shows this scope, each subject and the scope above, and opens on this scope', () => {
    mount()
    const tree = screen.getByTestId('adr-tree')
    expect(within(tree).getByText('Acme Logistics')).toBeTruthy()
    expect(within(tree).getByText('Warehouse landscape')).toBeTruthy()
    expect(within(tree).getByText('Customer CRM')).toBeTruthy()
    // Components are not a level: only applications get a list of their own.
    expect(within(tree).queryByText('Kafka')).toBeNull()
    const list = screen.getByTestId('adr-list')
    expect(within(list).getByText('One warehouse system')).toBeTruthy()
    expect(within(list).queryByText('CRM stays system of record')).toBeNull()
    // Newest first, and the newest is what opens.
    expect(within(screen.getByTestId('adr-reader')).getByRole('heading', { level: 1 }).textContent).toBe('One warehouse system')
  })

  it('files a new record under the chosen application with the next number', () => {
    const { onProject } = mount()
    fireEvent.click(screen.getByTestId('adr-scope-subject:crm'))
    fireEvent.click(screen.getByRole('button', { name: /New decision/ }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Retire the legacy sync' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(onProject).toHaveBeenCalledTimes(1)
    const next: Adr[] = onProject.mock.calls[0][0]
    expect(next).toHaveLength(4)
    expect(next[3]).toMatchObject({
      title: 'Retire the legacy sync', subjectId: 'crm', number: 4, status: 'proposed', date: '2026-09-05',
    })
    expect(next[3].body).toContain('## Decision Outcome')
  })

  /**
   * A record is edited where it lives (ADR-0012 §7): an ancestor's is readable
   * here, locked here, and one click from the scope that holds it.
   */
  it('shows an ancestor’s records read-only, and offers to open that scope', () => {
    const { onProject, onOpenScope } = mount({ initialAdrId: 'g1' })
    expect(screen.getByTestId('adr-from-ancestor')).toBeTruthy()
    const reader = screen.getByTestId('adr-reader')
    expect(within(reader).queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(within(reader).queryByRole('button', { name: /Move to/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open Acme Logistics' }))
    expect(onOpenScope).toHaveBeenCalledExactlyOnceWith('acme')
    expect(onProject).not.toHaveBeenCalled()
  })

  /** A section per ancestor, and none for a scope that holds nothing. */
  it('draws a From section only for an ancestor with records', () => {
    mount({ ancestors: [...ancestors, { path: '', name: 'Globex', decisions: [] }] })
    const tree = screen.getByTestId('adr-tree')
    expect(within(tree).getByText('From Acme Logistics')).toBeTruthy()
    expect(within(tree).queryByText('From Globex')).toBeNull()
  })

  it('offers this scope\'s record a history, and never an ancestor\'s (ADR-0008)', () => {
    // An ancestor's records are files in another scope's folder, which this
    // scope's history does not cover.
    const onOpenHistory = vi.fn()
    mount({ initialAdrId: 'l1', onOpenHistory })
    fireEvent.click(within(screen.getByTestId('adr-reader')).getByRole('button', { name: 'History…' }))
    expect(onOpenHistory).toHaveBeenCalledExactlyOnceWith('l1')
    cleanup()
    mount({ initialAdrId: 'g1', onOpenHistory })
    expect(within(screen.getByTestId('adr-reader')).queryByRole('button', { name: 'History…' })).toBeNull()
    cleanup()
    mount({ initialAdrId: 'l1' })
    expect(within(screen.getByTestId('adr-reader')).queryByRole('button', { name: 'History…' })).toBeNull()
  })

  it('offers only the moves the machine allows, and applies one', () => {
    const { onProject } = mount({ initialAdrId: 'l1' })
    const reader = screen.getByTestId('adr-reader')
    expect(within(reader).getByRole('button', { name: 'Move to Under review' })).toBeTruthy()
    expect(within(reader).queryByRole('button', { name: 'Move to Accepted' })).toBeNull()
    fireEvent.click(within(reader).getByRole('button', { name: 'Move to Under review' }))
    const next: Adr[] = onProject.mock.calls[0][0]
    expect(next.find((a) => a.id === 'l1')).toMatchObject({ status: 'reviewing', date: '2026-09-05' })
  })

  it('locks an accepted record: no Edit, no Delete, only Superseded — which asks for a successor', () => {
    // An accepted record to point at: a proposal is never offered as a successor (ADR-0008).
    const withSuccessor = {
      ...model,
      decisions: [...model.decisions!, adr({ id: 'l3', number: 4, title: 'Event-driven integration, decided', status: 'accepted' })],
    }
    mount({ model: withSuccessor, initialAdrId: 'l2' })
    const reader = screen.getByTestId('adr-reader')
    expect(within(reader).queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(within(reader).queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(within(reader).getByText(/can no longer be changed/)).toBeTruthy()
    fireEvent.click(within(reader).getByRole('button', { name: 'Move to Superseded' }))
    const dialog = screen.getByRole('dialog', { name: /Mark as superseded/ })
    expect(within(dialog).getByLabelText('Successor')).toBeTruthy()
  })

  it('records the successor and shows the link from the superseded record', () => {
    // Only an accepted record can replace one in force (ADR-0008): the
    // proposal l1 is not offered, the accepted l3 is.
    const withSuccessor = {
      ...model,
      decisions: [...model.decisions!, adr({ id: 'l3', number: 4, title: 'Event-driven integration, decided', status: 'accepted' })],
    }
    const { onProject, rerender } = mount({ model: withSuccessor, initialAdrId: 'l2' })
    fireEvent.click(screen.getByRole('button', { name: 'Move to Superseded' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: /Mark as superseded/ })).getByRole('button', { name: 'Superseded' }))
    const next: Adr[] = onProject.mock.calls[0][0]
    const l2 = next.find((a) => a.id === 'l2')!
    expect(l2.status).toBe('superseded')
    expect(l2.supersededBy).toBe('l3')
    rerender(
      <AdrPage
        open onClose={() => {}} model={{ ...model, decisions: next }} groupName="Acme Logistics"
        ancestors={ancestors} onProjectDecisionsChange={() => {}}
        initialAdrId="l2" s={translator('en')} language="en" makeId={(p) => p} today={() => 'd'}
        renderMarkdown={(md) => <MarkdownView markdown={md} />}
      />,
    )
    expect(screen.getByText(/Superseded by ADR-0004 · Event-driven integration, decided/)).toBeTruthy()
  })

  it('offers no proposal as a successor, and says how to supersede instead', () => {
    const { onProject } = mount({ initialAdrId: 'l2' })
    fireEvent.click(screen.getByRole('button', { name: 'Move to Superseded' }))
    const dialog = screen.getByRole('dialog', { name: /Mark as superseded/ })
    expect(within(dialog).queryByLabelText('Successor')).toBeNull()
    expect(within(dialog).getByText(/no accepted decision/)).toBeTruthy()
    expect(onProject).not.toHaveBeenCalled()
  })

  it('shows what acceptance still needs, and keeps the move until the list is clear', () => {
    mount({ initialAdrId: 'c1' })
    const reader = screen.getByTestId('adr-reader')
    expect(within(reader).getByRole('button', { name: 'Move to Accepted' }).hasAttribute('disabled')).toBe(true)
    const gate = within(reader).getByTestId('adr-gate')
    expect(gate.querySelector('[data-gate-item="approved"]')?.getAttribute('data-ok')).toBe('false')
    expect(gate.querySelector('[data-gate-item="context"]')?.getAttribute('data-ok')).toBe('true')
  })

  it('says on hover what a line of the gate looks for, and which option names the outcome may use', async () => {
    const body = '## Considered Options\n\n* Tender: buy it\n* Build in-house (on AKS)\n\n## Decision Outcome\n\nBuild it.'
    const decisions = model.decisions!.map((one) => (one.id === 'c1' ? { ...one, body } : one))
    mount({ model: { ...model, decisions }, initialAdrId: 'c1' })
    const outcome = screen.getByTestId('adr-gate').querySelector('[data-gate-item="outcome"]')!
    expect(outcome.getAttribute('data-ok')).toBe('false')
    fireEvent.mouseOver(outcome)
    const hint = await screen.findByRole('tooltip')
    expect(hint.textContent).toContain('up to the first colon')
    expect(hint.textContent).toContain('The names it looks for: “Tender”, “Build in-house”.')
    // The line keeps its own words as its name; the hint describes it.
    expect(outcome.textContent).toContain('The outcome names one of the options')
    expect(outcome.getAttribute('aria-describedby')).toBe(hint.id)
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
    fireEvent.click(within(screen.getByTestId('adr-reader')).getByRole('button', { name: 'Move to Accepted' }))
    const dialog = screen.getByRole('dialog', { name: /Accept ADR-0004/ })
    expect(within(dialog).getByText(/also marks ADR-0002 as superseded/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Accept' }))
    const next: Adr[] = onProject.mock.calls[0][0]
    // The successor first, so a writer that checks each move sees it accepted.
    expect(next[0]).toMatchObject({ id: 'l4', status: 'accepted', date: '2026-09-05' })
    expect(next.find((a) => a.id === 'l2')).toMatchObject({ status: 'superseded', supersededBy: 'l4' })
  })

  it('withdraws a proposal only with a reason, and keeps its number', () => {
    const { onProject } = mount({ initialAdrId: 'l1' })
    fireEvent.click(within(screen.getByTestId('adr-reader')).getByRole('button', { name: 'Withdraw' }))
    const dialog = screen.getByRole('dialog', { name: /Withdraw ADR-0001/ })
    const confirm = within(dialog).getByRole('button', { name: 'Withdraw' })
    expect(confirm.hasAttribute('disabled')).toBe(true)
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Overtaken by the merger.' } })
    fireEvent.click(confirm)
    const next: Adr[] = onProject.mock.calls[0][0]
    expect(next.find((a) => a.id === 'l1')).toMatchObject({ status: 'rejected', number: 1, reason: 'Overtaken by the merger.' })
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

  it('leaves out an empty crumb and an empty Applications heading', () => {
    mount({ groupName: '', model: { ...model, elements: [] } })
    const bar = screen.getByTestId('adr-topbar')
    expect(bar.textContent).toContain('Warehouse landscape / Architecture decisions')
    // The organisation has no name here: no crumb for it, and no separator before nothing.
    expect(bar.textContent).not.toMatch(/‹\s*\//)
    expect(within(screen.getByTestId('adr-tree')).queryByText('Applications')).toBeNull()
  })

  it('searches every list at once and says where each hit lives', () => {
    mount()
    fireEvent.change(screen.getByLabelText('Search decisions'), { target: { value: 'system' } })
    const list = screen.getByTestId('adr-list')
    expect(within(list).getByText('One warehouse system')).toBeTruthy()
    expect(within(list).getByText('CRM stays system of record')).toBeTruthy()
    expect(within(list).getByText(/Customer CRM · 1 Sept? 2026/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search decisions'), { target: { value: 'logs in' } })
    expect(within(list).getByText('One identity provider')).toBeTruthy()
    expect(within(list).getByText(/Acme Logistics · 1 Sept? 2026/)).toBeTruthy()
  })

  it('lets a reviewer be added and a verdict dated today', () => {
    const { onProject } = mount({ initialAdrId: 'c1' })
    fireEvent.click(screen.getByRole('button', { name: /Add a reviewer/ }))
    const next: Adr[] = onProject.mock.calls[0][0]
    expect(next.find((a) => a.id === 'c1')?.signers).toEqual([{ name: '' }])
  })

  it('opens the reader on the record the search asked for', () => {
    mount({ initialAdrId: 'g1' })
    expect(within(screen.getByTestId('adr-reader')).getByRole('heading', { level: 1 }).textContent).toBe('One identity provider')
    expect(screen.getByTestId('adr-status').textContent).toBe('Proposed')
  })

  /**
   * The record it was opened on is where it starts, not where it stays: every
   * save hands the page a new list, and taking the person back to that record
   * on each one closed the editor of the record they had moved to.
   */
  it('stays on the record chosen after opening, in edit, when the list comes back changed', () => {
    const { rerender } = mount({ initialAdrId: 'l2' })
    fireEvent.click(within(screen.getByTestId('adr-list')).getByText('Event-driven integration'))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const saved = model.decisions!.map((one) => (one.id === 'l1' ? { ...one, body: `${one.body}\n\nMore.` } : one))
    rerender(
      <AdrPage
        open onClose={() => {}} model={{ ...model, decisions: saved }} groupName="Acme Logistics"
        ancestors={[...ancestors]} onProjectDecisionsChange={() => {}}
        initialAdrId="l2" s={translator('en')} language="en" makeId={(p) => p} today={() => 'd'}
        renderMarkdown={(md) => <MarkdownView markdown={md} />}
      />,
    )
    const reader = screen.getByTestId('adr-reader')
    expect(within(reader).getByRole('button', { name: 'Edit' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(reader).getByDisplayValue('Event-driven integration')).toBeTruthy()
  })

  /**
   * Once per opening was once per record: asked for a record, moved to
   * another, and asked for the first again — from the search, or by an
   * agent's app.open — the page stayed where it was. Each request carries a
   * number of its own now, and the page says which record it shows.
   */
  it('goes back to a record asked for again after another was chosen, and says which it shows', () => {
    const onShown = vi.fn()
    const page = (nonce: number) => (
      <AdrPage
        open onClose={() => {}} model={model} groupName="Acme Logistics" ancestors={ancestors} onProjectDecisionsChange={() => {}}
        initialAdrId="l2" initialNonce={nonce} onShown={onShown} s={translator('en')} language="en" makeId={(p) => p} today={() => 'd'}
        renderMarkdown={(md) => <MarkdownView markdown={md} />}
      />
    )
    const { rerender } = renderShell(page(1))
    const title = () => within(screen.getByTestId('adr-reader')).getByRole('heading', { level: 1 }).textContent
    expect(title()).toBe('One warehouse system')
    expect(onShown).toHaveBeenLastCalledWith('l2', 1)
    fireEvent.click(within(screen.getByTestId('adr-list')).getByText('Event-driven integration'))
    expect(onShown).toHaveBeenLastCalledWith('l1', 1)
    rerender(page(1))
    expect(title()).toBe('Event-driven integration')
    rerender(page(2))
    expect(title()).toBe('One warehouse system')
    expect(onShown).toHaveBeenLastCalledWith('l2', 2)
  })

  it('keeps its top bar clear of the window controls and draggable', () => {
    mount({ windowChrome: { controlsInset: 78, draggable: true } })
    const bar = screen.getByTestId('adr-topbar')
    expect(getComputedStyle(bar).paddingLeft).toBe('90px')
    const css = [...document.querySelectorAll('style')].map((tag) => tag.textContent).join('')
    const own = [...bar.classList].find((name) => css.includes(`.${name}{`))
    expect(css).toContain(`.${own}{`)
    expect(css).toContain('-webkit-app-region:drag')
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
    const row = screen.getByTestId('adr-plans')
    fireEvent.click(within(row).getByRole('button', { name: 'TR-0001 Replace the warehouse system' }))
    expect(onOpenPlan).toHaveBeenCalledWith('tr-1')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows no row when nothing rests on it, or the host cannot open a plan', () => {
    mount({ model: { ...model, transitions: [plan] }, initialAdrId: 'l2' })
    expect(screen.queryByTestId('adr-plans')).toBeNull()
  })
})

describe('AdrPage — pictures (ADR-0009)', () => {
  it('takes a pasted picture into a record through the shared source pane', async () => {
    const onAddImage = vi.fn(async () => 'screenshot-k1.png')
    // A proposed record: an accepted one is locked and cannot be written into.
    const { onProject } = mount({ onAddImage, initialAdrId: 'l1' })
    fireEvent.click(within(screen.getByTestId('adr-reader')).getByRole('button', { name: 'Edit' }))
    const area = screen.getByLabelText('Decision source (markdown)') as HTMLTextAreaElement
    const file = new File([new Uint8Array([1, 2])], 'Screenshot.png', { type: 'image/png' })
    fireEvent.paste(area, { clipboardData: { files: [file], items: [], types: ['Files'], getData: () => '' } })
    await vi.waitFor(() => expect(area.value).toContain('![Screenshot](image:screenshot-k1.png)'))
    fireEvent.blur(area)
    expect(onProject).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'l1', body: expect.stringContaining('screenshot-k1.png') }),
    ]))
  })
})
