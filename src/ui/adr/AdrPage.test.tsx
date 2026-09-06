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
import { translator } from '@lionsville/solution-design'
import type { Adr } from '../../core/adr'
import type { HostModel } from '../../core/model/fromInterchange'
import { MarkdownView } from '../markdown/MarkdownView'
import { AdrPage } from './AdrPage'
import type { AdrPageProps } from './AdrPage'
import { renderShell } from '../testing/renderShell'

afterEach(() => cleanup())

const element = (id: string, name: string, kind = 'application') => ({
  id, name, kind, lifecycle: 'live', isManaged: true, aspects: {}, parameters: {},
}) as HostModel['elements'][number]

const adr = (over: Partial<Adr>): Adr => ({
  id: 'x', number: 1, title: 'T', status: 'proposed', date: '2026-09-01', body: '## Context\n\nWhy.', signers: [], ...over,
})

const model: HostModel = {
  name: 'Warehouse landscape', customerName: 'Acme Logistics',
  elements: [element('crm', 'Customer CRM'), element('wms', 'Warehouse system'), element('kafka', 'Kafka', 'component')],
  connections: [], diagrams: [],
  decisions: [
    adr({ id: 'l1', number: 1, title: 'Event-driven integration', status: 'proposed' }),
    adr({ id: 'l2', number: 2, title: 'One warehouse system', status: 'accepted' }),
    adr({ id: 'c1', number: 3, title: 'CRM stays system of record', applicationId: 'crm', status: 'reviewing' }),
  ],
}
const groupDecisions: Adr[] = [adr({ id: 'g1', number: 1, title: 'One identity provider', body: 'Every project logs in the same way.' })]

let ids = 0
function mount(over: Partial<AdrPageProps> = {}) {
  const onGroup = vi.fn()
  const onProject = vi.fn()
  const utils = renderShell(
    <AdrPage
      open
      onClose={() => {}}
      model={model}
      groupName="Acme Logistics"
      groupDecisions={groupDecisions}
      onGroupDecisionsChange={onGroup}
      onProjectDecisionsChange={onProject}
      s={translator('en')}
      language="en"
      makeId={(prefix) => `${prefix}-${++ids}`}
      today={() => '2026-09-05'}
      renderMarkdown={(md) => <MarkdownView markdown={md} />}
      {...over}
    />,
  )
  return { ...utils, onGroup, onProject }
}

describe('AdrPage', () => {
  it('shows the group, the landscape and each application in the tree, and opens on the landscape', () => {
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
    fireEvent.click(screen.getByTestId('adr-scope-app:crm'))
    fireEvent.click(screen.getByRole('button', { name: /New decision/ }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Retire the legacy sync' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(onProject).toHaveBeenCalledTimes(1)
    const next: Adr[] = onProject.mock.calls[0][0]
    expect(next).toHaveLength(4)
    expect(next[3]).toMatchObject({
      title: 'Retire the legacy sync', applicationId: 'crm', number: 4, status: 'proposed', date: '2026-09-05',
    })
    expect(next[3].body).toContain('## Decision Outcome')
  })

  it('sends a group record back through the group handler, numbered within the group', () => {
    const { onGroup, onProject } = mount()
    fireEvent.click(screen.getByTestId('adr-scope-group'))
    fireEvent.click(screen.getByRole('button', { name: /New decision/ }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'One ticket queue' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(onProject).not.toHaveBeenCalled()
    const next: Adr[] = onGroup.mock.calls[0][0]
    expect(next.map((a) => a.number)).toEqual([1, 2])
    expect(next[1].applicationId).toBeUndefined()
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
    mount({ initialAdrId: 'l2' })
    const reader = screen.getByTestId('adr-reader')
    expect(within(reader).queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(within(reader).queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(within(reader).getByText(/can no longer be changed/)).toBeTruthy()
    fireEvent.click(within(reader).getByRole('button', { name: 'Move to Superseded' }))
    const dialog = screen.getByRole('dialog', { name: /Mark as superseded/ })
    expect(within(dialog).getByLabelText('Successor')).toBeTruthy()
  })

  it('records the successor and shows the link from the superseded record', () => {
    const { onProject, rerender } = mount({ initialAdrId: 'l2' })
    fireEvent.click(screen.getByRole('button', { name: 'Move to Superseded' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: /Mark as superseded/ })).getByRole('button', { name: 'Superseded' }))
    const next: Adr[] = onProject.mock.calls[0][0]
    const l2 = next.find((a) => a.id === 'l2')!
    expect(l2.status).toBe('superseded')
    expect(l2.supersededBy).toBe('l1')
    rerender(
      <AdrPage
        open onClose={() => {}} model={{ ...model, decisions: next }} groupName="Acme Logistics"
        groupDecisions={groupDecisions} onGroupDecisionsChange={() => {}} onProjectDecisionsChange={() => {}}
        initialAdrId="l2" s={translator('en')} language="en" makeId={(p) => p} today={() => 'd'}
        renderMarkdown={(md) => <MarkdownView markdown={md} />}
      />,
    )
    expect(screen.getByText(/Superseded by ADR-0001 · Event-driven integration/)).toBeTruthy()
  })

  it('searches every list at once and says where each hit lives', () => {
    mount()
    fireEvent.change(screen.getByLabelText('Search decisions'), { target: { value: 'system' } })
    const list = screen.getByTestId('adr-list')
    expect(within(list).getByText('One warehouse system')).toBeTruthy()
    expect(within(list).getByText('CRM stays system of record')).toBeTruthy()
    expect(within(list).getByText(/Customer CRM · 2026-09-01/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search decisions'), { target: { value: 'logs in' } })
    expect(within(list).getByText('One identity provider')).toBeTruthy()
    expect(within(list).getByText(/Acme Logistics · 2026-09-01/)).toBeTruthy()
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
