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
import { translator } from '../../i18n'
import type { Adr } from '../adr'
import type { HostModel } from '../../model/fromInterchange'
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
  name: 'Warehouse landscape', customerName: 'Acme Logistics',
  elements: [element('crm', 'Customer CRM'), element('wms', 'Warehouse system'), element('kafka', 'Kafka', 'component')],
  relations: [], diagrams: [],
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

  it('offers a project record\'s history, and never a group record\'s (ADR-0008)', () => {
    // A group's records are kept in the group's own file, outside any
    // project's folder, so no project history has them.
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
    await vi.waitFor(() => expect(area.value).toContain('![Screenshot](../images/screenshot-k1.png)'))
    fireEvent.blur(area)
    expect(onProject).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'l1', body: expect.stringContaining('screenshot-k1.png') }),
    ]))
  })
})
