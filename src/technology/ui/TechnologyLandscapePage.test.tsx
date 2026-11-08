// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The technology landscape, on screen (ADR-0015; 4.0.0).
 *
 * The arithmetic is pinned in `model/technologyLandscape.test.ts`; what is
 * pinned here is what the page promises a reader: three columns of one-line
 * rows, no lines until a row is chosen and nothing moving when one is, one
 * reader that writes, the ticks, the matrix, Day and Colour.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { TechnologyLandscapePage } from './TechnologyLandscapePage'
import type { TechnologyLandscapePageProps } from './TechnologyLandscapePage'
import { renderShell } from '../../app/testing/renderShell'
import { element } from '../../model/testFixtures'
import { FOLD_ABOVE } from '../../model'
import type { DesignDiagram, DesignModel, PlatformDescribe, Relation } from '../../model'

afterEach(() => cleanup())

const VIEW: DesignDiagram = { id: 'tl-1', kind: 'technology', name: 'Technology landscape', members: [], geometry: { nodes: [] } }
const row = (id: string, type: Relation['type'], sourceId: string, targetId: string): Relation => ({ id, type, sourceId, targetId })

function model(): DesignModel {
  return {
    name: 'Platforms',
    diagrams: [VIEW],
    elements: [
      element('containers', { kind: 'platformService', name: 'Container platform', description: 'A namespace on a managed cluster.', shared: true }),
      element('brokering', { kind: 'platformService', name: 'Message brokering' }),
      element('landing-zone', { kind: 'platform', name: 'Landing zone', platformArchetype: 'place', outside: true }),
      element('openshift', { kind: 'platform', name: 'OpenShift', platformArchetype: 'place', parentId: 'landing-zone' }),
      element('kafka', { kind: 'platform', name: 'Event broker' }),
    ],
    relations: [
      row('r1', 'realises', 'openshift', 'containers'),
      row('r2', 'realises', 'kafka', 'brokering'),
    ],
  }
}
const elsewhere: Relation[] = [
  row('l1', 'uses', 'wms', 'containers'),
  row('l2', 'uses', 'wms', 'brokering'),
  row('l3', 'hostedOn', 'wms-api', 'openshift'),
  row('l4', 'uses', 'portal', 'containers'),
  row('l5', 'uses', 'rater', 'kafka'),
  row('l6', 'uses', 'rater', 'containers'),
]
const describe_: PlatformDescribe = (id) => ({
  wms: { name: 'Warehouse Management', kind: 'application' as const, where: 'logistics' },
  'wms-api': { name: 'WMS API', kind: 'component' as const, parentId: 'wms', where: 'logistics' },
  portal: { name: 'Customer portal', kind: 'application' as const, where: 'channels' },
  rater: { name: 'Rating (legacy)', kind: 'application' as const, where: 'logistics' },
}[id])

function open(over: Partial<TechnologyLandscapePageProps> = {}) {
  return renderShell(
    <TechnologyLandscapePage open model={model()} diagram={VIEW} readOnly={false} onClose={() => {}} elsewhere={elsewhere} describe={describe_} {...over} />,
  )
}

const rowOf = (name: string) => [...document.querySelectorAll<HTMLElement>('[data-kit-row]')].find((one) => (one.querySelector('.kit-list__text')?.textContent ?? one.textContent)?.startsWith(name))!
const namesIn = (testId: string) => [...screen.getByTestId(testId).querySelectorAll('.kit-list__text')].map((one) => one.textContent)
const more = () => fireEvent.click(within(screen.getByTestId('landscape-inspector')).getByRole('button', { name: 'More' }))
const noteOf = (name: string) => rowOf(name).querySelector('.kit-list__note')?.textContent

describe('the three columns', () => {
  it('asks its question and says what it read', () => {
    open()
    expect(screen.getByText('What stands on what')).toBeDefined()
    expect(screen.getByTestId('landscape-summary').textContent).toBe('3 applications · 2 services · 3 platforms · read from the records')
  })
  it('draws one line a row, the groups heading the applications and the platforms nested', () => {
    open()
    expect(namesIn('landscape-applications')).toEqual(['Customer portal', 'Rating (legacy)', 'Warehouse Management'])
    expect(namesIn('landscape-band-services')).toEqual(['Container platform', 'Message brokering'])
    expect(namesIn('landscape-band-platforms')).toEqual(['Landing zone', 'OpenShift', 'Event broker'])
    expect(rowOf('OpenShift').getAttribute('aria-level')).toBe('2')
  })
  it('says a number for what stands on a row, the word place, and outside by word and dash', () => {
    open()
    expect(noteOf('Rating (legacy)')).toBe('2')
    expect(noteOf('Message brokering')).toBe('1')
    expect(noteOf('OpenShift')).toBe('place · 3')
    expect(noteOf('Landing zone')).toBe('outside · place · 3')
    expect(rowOf('Landing zone').dataset.state).toContain('outside')
  })
  it('says no platform on a service nothing delivers, in words', () => {
    const held = model()
    open({ model: { ...held, relations: held.relations.filter((one) => one.id !== 'r2') } })
    expect(noteOf('Message brokering')).toBe('no platform · 1')
    expect(rowOf('Message brokering').dataset.state).toContain('attention')
    expect(screen.getByTestId('landscape-rest').textContent).toContain('Message brokering has nothing delivering it.')
  })
  it('explains itself and offers both first steps where there is nothing', () => {
    const onAdd = vi.fn()
    open({ model: { name: 'Empty', diagrams: [VIEW], elements: [], relations: [] }, elsewhere: [], onAdd })
    expect(screen.getByText('Nothing to show yet')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Add a service' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add a platform' }))
    expect(onAdd.mock.calls.map(([seed]) => seed.kind)).toEqual(['platformService', 'platform'])
  })
  it('says how to read it when nothing is chosen, with no palette and no canvas words', () => {
    open()
    expect(screen.getByTestId('landscape-rest').textContent).toContain('Left stands on right')
    expect(document.body.textContent).not.toMatch(/canvas/i)
  })
  it('finds nothing wrong, as axe reads it', async () => {
    open()
    fireEvent.click(rowOf('Warehouse Management'))
    expect(await axeFindings()).toEqual([])
  })
})

describe('what a row says beside its name', () => {
  it('says assumed in a word where nobody has checked the record', () => {
    const held = model()
    open({ model: { ...held, elements: held.elements.map((one) => (one.id === 'kafka' ? { ...one, certainty: 'assumed' as const } : one)) } })
    expect(noteOf('Event broker')).toContain('assumed')
  })
})

describe('Export', () => {
  it('is offered only where a picture can be kept', () => {
    open()
    expect(screen.queryByTestId('landscape-export')).toBeNull()
    cleanup()
    open({ onExport: vi.fn() })
    expect(screen.getByTestId('landscape-export').textContent).toBe('Export…')
  })
})

describe('choosing a row', () => {
  it('reaches every row by the keyboard', () => {
    open()
    const row = rowOf('Rating (legacy)')
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(screen.getByTestId('landscape-inspector').textContent).toContain('Rating (legacy)')
  })
  it('chooses on a press and lets go on the second, the others readable and in their place', () => {
    open()
    const order = namesIn('landscape-band-services')
    fireEvent.click(rowOf('Warehouse Management'))
    expect(screen.getByTestId('landscape-inspector')).toBeDefined()
    expect(rowOf('Customer portal').dataset.state).toContain('dim')
    expect(rowOf('Message brokering').dataset.state).toContain('strong')
    expect(namesIn('landscape-band-services')).toEqual(order)
    fireEvent.click(rowOf('Warehouse Management'))
    expect(screen.queryByTestId('landscape-inspector')).toBeNull()
  })
  it('hides what the choice does not touch, from the Show menu', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Hide what the choice does not touch' }))
    fireEvent.click(rowOf('Customer portal'))
    expect(namesIn('landscape-applications')).toEqual(['Customer portal'])
  })
  it('tells the host what this scope holds, and nothing it does not', () => {
    const onSelect = vi.fn()
    open({ onSelect })
    fireEvent.click(rowOf('OpenShift'))
    expect(onSelect).toHaveBeenLastCalledWith('openshift')
    fireEvent.click(rowOf('Warehouse Management'))
    expect(onSelect).toHaveBeenLastCalledWith(undefined)
  })
  it('lands on the row a door led to, once', () => {
    open({ focus: 'application:wms' })
    expect(screen.getByTestId('landscape-inspector').textContent).toContain('Warehouse Management')
    fireEvent.click(rowOf('Warehouse Management'))
    expect(screen.queryByTestId('landscape-inspector')).toBeNull()
  })
})

describe('the Show menu', () => {
  const show = (name: string) => {
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name }))
  }
  it('takes the services away and the column goes', () => {
    open()
    show('Services')
    expect(screen.queryByTestId('landscape-band-services')).toBeNull()
  })
  it('hides one scope, a line per scope', () => {
    open()
    show('channels')
    expect(namesIn('landscape-applications')).toEqual(['Rating (legacy)', 'Warehouse Management'])
  })
  it('groups by category where the record says one', () => {
    const describing: PlatformDescribe = (id) => { const told = describe_(id); return told && id === 'wms' ? { ...told, category: 'Warehouse' } : told }
    open({ describe: describing })
    show('Category')
    expect(document.querySelector('[data-kit-row="head:group:Warehouse"]')).not.toBeNull()
  })
  it('hides the shared row from there too', () => {
    open({ sharedElsewhere: [{ id: 'idp', name: 'Identity', where: 'security', realisedBy: [] }] })
    expect(screen.getByTestId('landscape-shared-row')).toBeDefined()
    show('Shared in the organisation')
    expect(screen.queryByTestId('landscape-shared-row')).toBeNull()
  })
})

describe('above the threshold', () => {
  const many = () => {
    const rows: Relation[] = []
    const told = new Map<string, { name: string; kind: 'application'; where: string }>()
    for (let at = 0; at <= FOLD_ABOVE; at += 1) {
      rows.push(row(`u${at}`, 'uses', `a${at}`, 'containers'))
      told.set(`a${at}`, { name: `App ${at}`, kind: 'application', where: at % 2 ? 'one' : 'two' })
    }
    return { rows, told: ((id: string) => told.get(id)) as PlatformDescribe }
  }
  it('starts folded, opens a group by its caret, and a filter under it opens the matches', async () => {
    const { rows, told } = many()
    open({ elsewhere: rows, describe: told })
    expect(namesIn('landscape-applications')).toEqual([])
    fireEvent.click(document.querySelector('[data-kit-row="head:group:one"] .kit-list__caret')!)
    expect(namesIn('landscape-applications').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByTestId('landscape-filter'), { target: { value: 'App 40' } })
    await waitFor(() => expect(namesIn('landscape-applications')).toEqual(['App 40']))
  })
  it('reads a group when its head is chosen', () => {
    const { rows, told } = many()
    open({ elsewhere: rows, describe: told })
    fireEvent.click(document.querySelector('[data-kit-row="head:group:one"] .kit-list__headCell span:last-child')!)
    expect(screen.getByTestId('landscape-inspector').textContent).toContain('Group of applications')
  })
})

describe('filtering by name', () => {
  it('narrows the column that holds the word, and leaves the others whole', () => {
    open()
    fireEvent.change(screen.getByTestId('landscape-filter'), { target: { value: 'broker' } })
    expect(namesIn('landscape-band-services')).toEqual(['Message brokering'])
    expect(namesIn('landscape-band-platforms')).toEqual(['Event broker'])
    expect(namesIn('landscape-applications')).toHaveLength(3)
  })
})

describe('the reader', () => {
  const writing = () => ({ onSetUse: vi.fn(), onSetHost: vi.fn() })
  it('says where an application runs, what it uses, and so what it stands on', () => {
    open()
    fireEvent.click(rowOf('Warehouse Management'))
    const reader = screen.getByTestId('landscape-inspector').textContent
    expect(reader).toContain('Kept in logistics')
    expect(reader).toContain('OpenShift')
    expect(reader).toContain('Event broker')
    expect(reader).toContain('Landing zone')
  })
  it('takes a use away as near as it adds one, and offers it back', async () => {
    const held = model()
    const writes = writing()
    open({ ...writes, model: { ...held, relations: [...held.relations, row('o1', 'uses', 'wms', 'brokering')] } })
    fireEvent.click(rowOf('Warehouse Management'))
    fireEvent.click(screen.getByTestId('landscape-unuse-brokering'))
    expect(writes.onSetUse).toHaveBeenCalledWith('wms', 'brokering', false)
    await waitFor(() => expect(screen.getByTestId('landscape-inspector').textContent).toContain('no longer uses'))
    await act(async () => { fireEvent.click(within(screen.getByTestId('landscape-inspector')).getByRole('button', { name: 'Undo' })) })
    expect(writes.onSetUse).toHaveBeenLastCalledWith('wms', 'brokering', true)
  })
  it('says where a change goes, and nothing about changing to a reader', () => {
    open({ ...writing() })
    fireEvent.click(rowOf('Rating (legacy)'))
    expect(screen.getByTestId('landscape-inspector').textContent).toContain('saved in logistics')
    cleanup()
    open({ ...writing(), readOnly: true })
    fireEvent.click(rowOf('Rating (legacy)'))
    expect(screen.queryByTestId('landscape-edit-uses')).toBeNull()
    expect(screen.queryByTestId('landscape-add-use')).toBeNull()
    expect(screen.queryByTestId('landscape-add-service')).toBeNull()
  })
  it('opens the report from If it went, and on a double press', () => {
    const onOpenPlatformReport = vi.fn()
    const onOpenServiceReport = vi.fn()
    open({ onOpenPlatformReport, onOpenServiceReport })
    fireEvent.click(rowOf('Event broker'))
    more()
    fireEvent.click(screen.getByTestId('landscape-report'))
    expect(onOpenPlatformReport).toHaveBeenCalledWith('kafka')
    fireEvent.doubleClick(rowOf('Message brokering'))
    expect(onOpenServiceReport).toHaveBeenCalledWith('brokering')
  })
  it('opens the record in its own column and comes back', () => {
    open({ record: <div>the inspector</div> })
    fireEvent.click(rowOf('Event broker'))
    fireEvent.click(screen.getByTestId('landscape-edit-record'))
    expect(screen.getByTestId('landscape-record').textContent).toContain('the inspector')
    expect(screen.queryByTestId('landscape-inspector')).toBeNull()
    fireEvent.click(screen.getByTestId('landscape-back-to-reader'))
    expect(screen.getByTestId('landscape-inspector')).toBeDefined()
  })
  it('goes to a record another scope keeps, and into an application', () => {
    const onOpenElsewhere = vi.fn()
    const onOpenContainers = vi.fn(() => true)
    open({ onOpenElsewhere, onOpenContainers, hasContainers: () => true })
    fireEvent.click(rowOf('Warehouse Management'))
    fireEvent.click(screen.getByTestId('landscape-open-record'))
    expect(onOpenElsewhere).toHaveBeenCalledWith('wms')
    more()
    fireEvent.click(screen.getByTestId('landscape-containers'))
    expect(onOpenContainers).toHaveBeenCalledWith('wms')
  })
})

describe('the reader’s head, as a board’s panel', () => {
  it('folds rather than closes, and keeps the delete last in ⋯ for a record this scope keeps', () => {
    const onDelete = vi.fn()
    open({ onDelete, onSetUse: vi.fn(), onSetHost: vi.fn() })
    fireEvent.click(rowOf('Event broker'))
    const panel = within(screen.getByTestId('landscape-inspector'))
    expect(panel.queryByRole('button', { name: 'Close' })).toBeNull()
    more()
    const items = screen.getAllByRole('menuitem').map((one) => one.textContent)
    expect(items.at(-1)?.trim()).toBe('Delete from model…')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete from model…' }))
    expect(onDelete).toHaveBeenCalledWith('kafka')
    fireEvent.click(panel.getByRole('button', { name: 'Fold the panel away' }))
    expect(screen.getByTestId('landscape-inspector').getAttribute('data-collapsed')).toBe('true')
  })
  it('offers no delete to a reader, nor for a record another scope keeps', () => {
    open({ onDelete: vi.fn(), readOnly: true })
    fireEvent.click(rowOf('Event broker'))
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
  })
})

describe('the one tick', () => {
  const writing = () => ({ onSetUse: vi.fn(), onSetHost: vi.fn() })
  it('puts a mark on every row that says what is so, and a press writes', () => {
    const writes = writing()
    open({ ...writes })
    fireEvent.click(rowOf('Rating (legacy)'))
    more()
    fireEvent.click(screen.getByTestId('landscape-edit-uses'))
    expect(rowOf('Container platform').querySelector('.tl-tick')!.getAttribute('data-tick')).toBe('use')
    expect(rowOf('Message brokering').querySelector('.tl-tick')!.getAttribute('data-tick')).toBe('none')
    fireEvent.click(rowOf('Message brokering'))
    expect(writes.onSetUse).toHaveBeenCalledWith('rater', 'brokering', true)
    fireEvent.click(rowOf('OpenShift'))
    expect(writes.onSetHost).toHaveBeenCalledWith('rater', 'openshift')
  })
  it('stops when Done is pressed', () => {
    open({ ...writing() })
    fireEvent.click(rowOf('Rating (legacy)'))
    more()
    fireEvent.click(screen.getByTestId('landscape-edit-uses'))
    // While the ticks are up, Done stands in the panel's head.
    fireEvent.click(screen.getByTestId('landscape-edit-uses'))
    expect(document.querySelector('.tl-tick')).toBeNull()
  })
})

describe('dragging an application', () => {
  const dataTransfer = { setData: () => {} }
  it('says the verb before the drop, and writes by what it landed on', () => {
    const onSetUse = vi.fn()
    open({ onSetUse, onSetHost: vi.fn() })
    fireEvent.dragStart(rowOf('Customer portal'), { dataTransfer })
    // The row in hand is marked, and the sentence stands beside the row it would land on.
    expect(rowOf('Customer portal').getAttribute('data-state')).toContain('dragged')
    fireEvent.dragOver(rowOf('Message brokering'), { dataTransfer })
    expect(rowOf('Message brokering').textContent).toContain('Customer portal will use Message brokering')
    expect(screen.getByTestId('landscape-verb').textContent).toBe('Customer portal will use Message brokering')
    fireEvent.drop(rowOf('Message brokering'), { dataTransfer })
    expect(onSetUse).toHaveBeenCalledWith('portal', 'brokering', true)
    expect(rowOf('Customer portal').getAttribute('data-state') ?? '').not.toContain('dragged')
  })
  it('lets the mark go when the drag ends on nothing', () => {
    open({ onSetUse: vi.fn(), onSetHost: vi.fn() })
    fireEvent.dragStart(rowOf('Customer portal'), { dataTransfer })
    fireEvent.dragEnd(rowOf('Customer portal'), { dataTransfer })
    expect(rowOf('Customer portal').getAttribute('data-state') ?? '').not.toContain('dragged')
  })
  it('tells rather than writes what is already said', () => {
    const notify = vi.fn()
    const onSetUse = vi.fn()
    const held = model()
    open({ onSetUse, onSetHost: vi.fn(), notify, model: { ...held, relations: [...held.relations, row('o2', 'uses', 'portal', 'brokering')] } })
    fireEvent.dragStart(rowOf('Customer portal'), { dataTransfer })
    fireEvent.drop(rowOf('Message brokering'), { dataTransfer })
    expect(onSetUse).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('Customer portal already uses Message brokering.')
  })
  it('does not lift for a reader', () => {
    open({ onSetUse: vi.fn(), onSetHost: vi.fn(), readOnly: true })
    expect(rowOf('Customer portal').draggable).toBe(false)
  })
})

describe('the + on a column', () => {
  it('asks a name, or picks from elsewhere in the organisation', () => {
    const onAdd = vi.fn()
    const onBring = vi.fn()
    open({ onAdd, onBring, technologyElsewhere: [{ id: 'hub', name: 'Telemetry hub', kind: 'platform', where: 'fleet' }] })
    fireEvent.click(screen.getByTestId('landscape-add-platform'))
    const field = screen.getByRole('combobox')
    fireEvent.change(field, { target: { value: 'Vault' } })
    fireEvent.click(screen.getByText('Add “Vault” here'))
    expect(onAdd).toHaveBeenCalledWith({ kind: 'platform', name: 'Vault' })
    fireEvent.click(screen.getByTestId('landscape-add-platform'))
    fireEvent.click(screen.getByText('Telemetry hub'))
    expect(onBring).toHaveBeenCalledWith('hub')
  })
  it('adds under a row from the selected row', () => {
    const onAdd = vi.fn()
    open({ onAdd })
    fireEvent.click(rowOf('OpenShift'))
    fireEvent.click(screen.getByTestId('landscape-add-under-openshift'))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Namespace' } })
    fireEvent.click(screen.getByText('Add “Namespace” here'))
    expect(onAdd).toHaveBeenCalledWith({ kind: 'platform', name: 'Namespace', parentId: 'openshift' })
  })
})

describe('the matrix', () => {
  const matrix = () => {
    fireEvent.click(screen.getByRole('radio', { name: 'Matrix' }))
    return screen.getByTestId('landscape-matrix')
  }
  it('is one press away, the same rows, with what each runs on pinned beside them', () => {
    open()
    expect(matrix().textContent).toContain('Warehouse Management')
    expect(screen.getByTestId('landscape-matrix').textContent).toContain('OpenShift')
    expect(screen.queryByTestId('landscape-legend')).toBeNull()
  })
  it('a press selects and writes nothing; Space writes', () => {
    const onSetUse = vi.fn()
    open({ onSetUse, onSetHost: vi.fn() })
    matrix()
    const cell = document.querySelector<HTMLElement>('[data-kit-cell="0:1"]')!
    fireEvent.click(cell)
    expect(onSetUse).not.toHaveBeenCalled()
    expect(screen.getByTestId('landscape-inspector').textContent).toContain('Customer portal')
    fireEvent.keyDown(cell, { key: ' ' })
    expect(onSetUse).toHaveBeenCalledWith('portal', 'brokering', true)
  })
  it('a heading says who stands on it', () => {
    open()
    matrix()
    fireEvent.click(document.querySelector('[data-kit-cell="-1:1"]')!)
    expect(screen.getByTestId('landscape-inspector').textContent).toContain('Message brokering')
  })
  it('writes nothing for a reader', () => {
    const onSetUse = vi.fn()
    open({ onSetUse, onSetHost: vi.fn(), readOnly: true })
    matrix()
    fireEvent.keyDown(document.querySelector('[data-kit-cell="0:1"]')!, { key: ' ' })
    expect(onSetUse).not.toHaveBeenCalled()
  })
})

describe('Day and Colour', () => {
  const dated = (): DesignModel => {
    const held = model()
    return {
      ...held,
      elements: held.elements.map((one) => (one.id === 'kafka' ? { ...one, lifecycleDates: { retiring: '2027-01-01', retired: '2027-06-01' } } : one)),
    }
  }
  it('reads the rows on the day looked at: what has gone is not drawn', () => {
    open({ model: dated(), diagram: { ...VIEW, asOf: '2027-07-01' }, onDay: vi.fn() })
    expect(namesIn('landscape-band-platforms')).not.toContain('Event broker')
    expect(screen.getByRole('button', { name: /^Day: / })).toBeDefined()
  })
  it('asks for another day through the host, offering the days the board offers: a plan’s milestones and when things go', () => {
    const onDay = vi.fn()
    // The model the workspace hands in is the scope's, plans and all.
    const planned = { ...dated(), transitions: [{ id: 'p1', number: 1, title: 'Move the broker', milestones: [{ id: 'm1', date: '2027-03-01', name: 'Cut over' }] }] } as DesignModel
    open({ model: planned, today: '2026-11-08', onDay })
    fireEvent.click(screen.getByRole('button', { name: 'Day' }))
    expect(screen.getByRole('menuitemcheckbox', { name: /Move the broker: Cut over/ })).toBeDefined()
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Event broker is gone/ }))
    expect(onDay).toHaveBeenCalledWith('2027-06-01')
  })
  it('colours by one question, with a key made of what is drawn, and writes nothing until kept', () => {
    const onKeepColour = vi.fn()
    open({ model: dated(), today: '2027-02-01', onKeepColour })
    fireEvent.click(screen.getByRole('button', { name: 'Colour' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'What it stands on' }))
    expect(screen.getByRole('button', { name: /^Colour: / })).toBeDefined()
    expect(rowOf('Event broker').querySelector('.tl-swatch')).not.toBeNull()
    // Colour is not the only signal: the row carries its value's number, and the key says it beside the same colour.
    const code = rowOf('Event broker').querySelector('.tl-swatch')?.textContent
    expect(code).toMatch(/^\d+$/)
    expect([...screen.getByRole('group', { name: 'Key' }).querySelectorAll('.tl-swatch')].map((one) => one.textContent)).toContain(code)
    const key = screen.getByRole('group', { name: 'Key' })
    expect(within(key).getByRole('button', { name: /retiring/ })).toBeDefined()
    expect(onKeepColour).not.toHaveBeenCalled()
    fireEvent.click(within(key).getByRole('button', { name: 'Keep with the view' }))
    expect(onKeepColour).toHaveBeenCalledWith('technologyLifecycle')
  })
  it('a value pressed on the key quiets the rest', () => {
    open({ model: dated(), today: '2027-02-01' })
    fireEvent.click(screen.getByRole('button', { name: 'Colour' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Lifecycle' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Key' })).getByRole('button', { name: /retiring/ }))
    expect(rowOf('OpenShift').dataset.state).toContain('dim')
    expect(rowOf('Event broker').dataset.state ?? '').not.toContain('dim')
  })
})
