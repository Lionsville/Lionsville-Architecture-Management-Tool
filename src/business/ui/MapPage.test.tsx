// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The map, on screen (ADR-0012 §6, §9).
 *
 * The arithmetic is pinned in `map.test.ts`; what is pinned here is what the
 * page promises a reader — a row per function with a mark under the system
 * that supports it, the roll-up on the section above, the gap said in words
 * on a capability and as a count on a section, the owners across the top
 * when the systems are somebody else's, and that a row opens the inspector.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MapPage, coverageFileName } from './MapPage'
import type { SheetActions } from './FunctionInspector'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { shippingScope } from '../testFixtures'
import type { DesignDiagram, DesignModel } from '../../model'
import type { MapPageProps } from './MapPage'

afterEach(() => cleanup())

const MAP: DesignDiagram = {
  id: 'mp-1', kind: 'map', name: 'Enterprise map', members: [], geometry: { nodes: [] },
}

function model(over: Partial<DesignModel> = {}): DesignModel {
  const { elements, relations } = shippingScope()
  return { name: 'Acme Logistics', diagrams: [MAP], elements, relations, ...over }
}

function actions(): SheetActions {
  return {
    updateElement: vi.fn(), moveElement: vi.fn(), updateSheet: vi.fn(), onOpenElement: vi.fn(),
    addElement: vi.fn(() => 'made'), addJourney: vi.fn(() => 'made'), addArea: vi.fn(() => 'made'),
    addLane: vi.fn(() => 'made'), removeElement: vi.fn(), setCoverage: vi.fn(),
  }
}

function open(over: Partial<MapPageProps> = {}) {
  const acts = actions()
  const result = renderShell(
    <MapPage
      open
      model={model()}
      map={MAP}
      readOnly={false}
      actions={acts}
      onClose={() => {}}
      {...over}
    />,
  )
  return { ...result, actions: acts }
}

/** Everything open: a map opens at two levels. */
const allLevels = () => fireEvent.click(screen.getByRole('radio', { name: '3' }))
const rowNames = () => screen.getAllByRole('rowheader').map((row) => row.textContent)
const cell = (row: string, column: string) => screen.getByRole('gridcell', { name: new RegExp(`^${row}, ${column}`) })

describe('the matrix', () => {
  it('opens at two levels, and offers the rest, a row per function in tree order', () => {
    open()
    expect(rowNames()).toEqual(['Fulfilment', 'Warehousing', 'Billing', 'Invoicing'])
    allLevels()
    expect(rowNames()).toEqual(['Fulfilment', 'Warehousing', 'Picking', 'Packing', 'Billing', 'Invoicing', 'Raise an invoice', 'Chase a late payment'])
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(
      expect.arrayContaining(['Warehouse system', 'Handheld scanners', 'Finance system']),
    )
  })

  it('says what its depth control is, in the words the chart uses, and what a number in a cell is', () => {
    open()
    expect(screen.getByTestId('map-levels').textContent).toBe('Levels123')
    expect(screen.getByTestId('map-legend').textContent).toContain('how many of its functions it supports')
  })

  it('marks the capability a system supports, and says how many on a section above it', () => {
    open()
    allLevels()
    expect(cell('Picking', 'Warehouse system').getAttribute('aria-label')).toContain('Warehouse system supports Picking')
    expect(cell('Warehousing', 'Warehouse system').textContent).toBe('1')
    expect(cell('Picking', 'Finance system').getAttribute('aria-label')).toContain(': nothing')
  })

  it('pins the answer beside the name, in words, with a count on a section', () => {
    open()
    allLevels()
    const answer = (name: string) => screen.getByRole('rowheader', { name: new RegExp(`^${name}`) }).parentElement?.querySelector('.kit-matrix__answer')?.textContent
    expect(answer('Chase a late payment')).toBe('nothing')
    expect(answer('Packing')).toBe('by people')
    expect(answer('Raise an invoice')).toBe('1 system')
    expect(answer('Picking')).toBe('2 systems')
    expect(answer('Invoicing')).toBe('1 of 2')
  })

  it('says it in one sentence with the total, and keeps the legend on the page', () => {
    open()
    expect(screen.getByTestId('map-summary').textContent).toBe('3 of 4 capabilities covered: 2 by a system, 1 by people. 1 have nothing.')
    expect(screen.getByTestId('map-legend').textContent).toContain('supports')
  })

  it('names the owners across the top when the systems are somebody else’s, and folds one from there', () => {
    open({ describe: (id) => (id === 'erp' ? { name: 'Finance system', where: 'Finance' } : undefined) })
    expect(screen.getByRole('columnheader', { name: 'Finance' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'This scope' })).toBeTruthy()
  })

  it('keeps each owner’s columns together, and a column where it was when a link moves what comes first', () => {
    const { rerender } = open({ describe: (id) => (id === 'wms' ? { name: 'Warehouse system', where: 'Stores' } : undefined) })
    const heads = () => screen.getAllByRole('columnheader').map((th) => th.textContent).filter((word) => word === 'Warehouse system' || word === 'Finance system' || word === 'Handheld scanners')
    const before = heads()
    expect(before).toHaveLength(3)
    const row = model().relations.filter((one) => one.targetId !== 'picking')
    rerender(<MapPage open model={model({ relations: [{ id: 'first', type: 'supports', sourceId: 'erp', targetId: 'picking' }, ...row] })} map={MAP} readOnly={false} actions={actions()} onClose={() => {}} />)
    expect(heads().filter((word) => before.includes(word))).toEqual(before.filter((word) => heads().includes(word)))
  })

  it('draws no owner band when every system is this scope’s own', () => {
    open()
    expect(screen.queryByRole('columnheader', { name: 'This scope' })).toBeNull()
  })

  it('finds nothing wrong for axe', async () => {
    open()
    expect(await axeFindings()).toEqual([])
  })
})

describe('the states it can be in', () => {
  it('says so when there is nothing to map, with the way there', () => {
    const onSheet = vi.fn()
    open({ model: model({ elements: [], relations: [] }), onSheet })
    expect(screen.getByText('No capabilities to map yet.')).toBeDefined()
    expect(screen.queryByTestId('map-grid')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open the business sheet' }))
    expect(onSheet).toHaveBeenCalled()
  })

  it('states a tree with no links once, and offers a start, rather than drawing a page of gaps', () => {
    open({ model: model({ relations: [] }) })
    expect(screen.queryByTestId('map-grid')).toBeNull()
    expect(screen.getByText(/4 capabilities, and nothing linked/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start linking' }))
    expect(screen.getByTestId('sheet-inspector')).toBeTruthy()
  })

  it('offers no start where the map is only read', () => {
    open({ model: model({ relations: [] }), readOnly: true })
    expect(screen.queryByRole('button', { name: 'Start linking' })).toBeNull()
  })
})

describe('the filters', () => {
  it('lists the gaps and the overlaps as plain rows, with their counts on the bar', () => {
    open()
    fireEvent.click(screen.getByRole('radio', { name: 'Gaps 1' }))
    expect(screen.queryByTestId('map-grid')).toBeNull()
    // A gap says where it sits, not the word the filter already said.
    expect(screen.getByRole('row', { name: /Chase a late payment/ }).textContent).toContain('Billing › Invoicing')
    fireEvent.click(screen.getByRole('radio', { name: 'Overlaps 1' }))
    expect(screen.getByRole('row', { name: /Picking/ })).toBeTruthy()
  })

  it('finds a capability by name', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Find' }))
    fireEvent.change(screen.getByLabelText('Find on the page'), { target: { value: 'chase' } })
    expect(screen.getByRole('row', { name: /Chase a late payment/ })).toBeTruthy()
    expect(screen.queryByRole('row', { name: /Picking/ })).toBeNull()
  })
})

describe('what a person can do from it', () => {
  it('opens a capability in the panel, a press only selecting', () => {
    const { actions: acts } = open()
    allLevels()
    fireEvent.click(screen.getByRole('rowheader', { name: 'Chase a late payment' }))
    expect(within(screen.getByTestId('sheet-inspector')).getByRole('heading', { level: 2 }).textContent).toBe('Chase a late payment')
    fireEvent.click(cell('Picking', 'Finance system'))
    expect(acts.setCoverage).not.toHaveBeenCalled()
  })

  it('links with Space, one step with its Undo, and says where a row is kept that it cannot take off', () => {
    const onUndo = vi.fn()
    const { actions: acts } = open({ onUndo, elsewhere: [{ id: 'x1', type: 'supports', sourceId: 'ghost', targetId: 'dunning' }], describe: (id) => (id === 'ghost' ? { name: 'Ghost', where: 'Elsewhere' } : undefined) })
    allLevels()
    fireEvent.keyDown(cell('Picking', 'Finance system'), { key: ' ' })
    // The walk starts at the top left, so it is focused first by the press.
    fireEvent.click(cell('Picking', 'Finance system'))
    fireEvent.keyDown(cell('Picking', 'Finance system'), { key: ' ' })
    expect(acts.setCoverage).toHaveBeenCalledWith({ type: 'supports', sourceId: 'erp', functionId: 'picking', on: true })
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    expect(onUndo).toHaveBeenCalled()
    fireEvent.click(cell('Chase a late payment', 'Ghost'))
    fireEvent.keyDown(cell('Chase a late payment', 'Ghost'), { key: ' ' })
    expect(screen.getByText(/kept in another scope/)).toBeTruthy()
  })

  it('takes every heading to a panel of what the system supports, kept here or not', () => {
    const onOpenApplication = vi.fn()
    open({ onOpenApplication })
    fireEvent.click(screen.getByRole('columnheader', { name: 'Finance system' }))
    const panel = screen.getByTestId('map-column-panel')
    expect(within(panel).getAllByText('Raise an invoice').length).toBeGreaterThan(0)
    fireEvent.click(within(panel).getByRole('button', { name: 'Open Finance system' }))
    expect(onOpenApplication).toHaveBeenCalledWith('erp')
  })

  it('writes nothing under readOnly, and still reads', () => {
    const { actions: acts } = open({ readOnly: true })
    allLevels()
    fireEvent.click(cell('Picking', 'Finance system'))
    fireEvent.keyDown(cell('Picking', 'Finance system'), { key: ' ' })
    expect(acts.setCoverage).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('rowheader', { name: 'Chase a late payment' }))
    expect(screen.queryByRole('button', { name: /Rename/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'More for this sheet' })).toBeNull()
  })

  it('makes a second map, renames this one and takes it away, since the tab it shares offers none of that', () => {
    const onCreateMap = vi.fn()
    const onRename = vi.fn()
    const onDelete = vi.fn()
    open({ onCreateMap, onRename, onDelete })
    fireEvent.click(screen.getByRole('button', { name: 'More for this sheet' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'New map in this scope' }))
    expect(onCreateMap).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'More for this sheet' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete this map' }))
    expect(onDelete).toHaveBeenCalled()
  })

  it('changes between the maps a scope keeps, under the reading', () => {
    const onOpenMap = vi.fn()
    open({ maps: [{ id: 'mp-1', name: 'Enterprise map', here: true }, { id: 'mp-2', name: 'Second', here: false }], onOpenMap })
    fireEvent.click(screen.getByRole('button', { name: 'Enterprise map' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Second' }))
    expect(onOpenMap).toHaveBeenCalledWith('mp-2')
  })

  it('goes back to the sheet by the same switch', () => {
    const onSheet = vi.fn()
    open({ onSheet })
    fireEvent.click(screen.getByRole('radio', { name: 'Names' }))
    expect(onSheet).toHaveBeenCalled()
  })

  it('offers Export only where the host can take a picture', () => {
    open()
    expect(screen.queryByRole('button', { name: 'Export…' })).toBeNull()
    cleanup()
    open({ onSave: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: 'Export…' }))
    expect(screen.getByRole('dialog', { name: /^Export / })).toBeTruthy()
  })
})

describe('the picture\'s file', () => {
  it('is proposed as a board\'s is: the organisation and the page, in a slug', () => {
    expect(coverageFileName('Acme Logistics', 'Coverage')).toBe('acme-logistics-coverage.png')
    expect(coverageFileName('Bäckerei Müller', 'Abdeckung')).toBe('backerei-muller-abdeckung.png')
    expect(coverageFileName('', '')).toBe('coverage.png')
  })
})

describe('the day', () => {
  it('counts the rows on the day looked at, and writes nothing while it lasts', () => {
    const relations = shippingScope().relations.map((row) => (row.type === 'supports' && row.targetId === 'invoice' ? { ...row, validUntil: '2027-01-01' } : row))
    open({ model: model({ relations }), today: '2026-11-07' })
    expect(screen.getByTestId('map-summary').textContent).toContain('2 by a system')
    fireEvent.click(screen.getByRole('button', { name: 'Day' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Choose/ }))
    fireEvent.change(screen.getByLabelText('The day to look at'), { target: { value: '2028-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show this day' }))
    expect(screen.getByTestId('map-summary').textContent).toContain('1 by a system')
    expect(screen.getByText(/Looking at/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to today' }))
    expect(screen.getByTestId('map-summary').textContent).toContain('2 by a system')
  })
})

/** A row selected from outside: a place opened with something selected on it (ADR-0019, amended). */
describe('a selection asked for', () => {
  it('opens the panel on a row the map draws, folded or not, and on nothing it does not', () => {
    open({ select: { id: 'dunning', nonce: 1 }, onOpenDocumentation: vi.fn() })
    expect(screen.getByTestId('sheet-open-page').getAttribute('aria-label')).toContain('Chase a late payment')
    expect(rowNames()).toContain('Chase a late payment')
    cleanup()
    // A system is a column, not a row: nothing is selected for it.
    open({ select: { id: 'wms', nonce: 1 }, onOpenDocumentation: vi.fn() })
    expect(screen.queryByTestId('sheet-open-page')).toBeNull()
  })
})

/** ADR-0033, amended 11 October 2026: a link's selection, located on the map; and what the map says it has selected. */
describe('a link to a row', () => {
  it('rings the row it selects and brings it on screen', async () => {
    const scrolled = vi.fn()
    Element.prototype.scrollIntoView = scrolled
    open({ select: { id: 'dunning', nonce: 1 }, onOpenDocumentation: vi.fn() })
    await waitFor(() => expect(scrolled).toHaveBeenCalled())
    const rules = Array.from(document.querySelectorAll('style')).map((style) => style.textContent ?? '').join('\n')
    expect(rules).toContain('[data-kit-row="dunning"]')
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  })

  it('says in its handle what is selected on it, for a link to select again', () => {
    const onHandle = vi.fn()
    open({ onHandle })
    allLevels()
    expect(onHandle.mock.calls.at(-1)?.[0]?.selectedId).toBeUndefined()
    fireEvent.click(screen.getByRole('rowheader', { name: 'Chase a late payment' }))
    expect(onHandle.mock.calls.at(-1)?.[0]?.selectedId).toBe('dunning')
  })
})
