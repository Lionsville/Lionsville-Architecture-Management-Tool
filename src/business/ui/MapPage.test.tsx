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
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { MapPage } from './MapPage'
import type { SheetActions } from './FunctionInspector'
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

describe('the grid', () => {
  it('has a row per function in tree order, and a column per system the rows name', () => {
    open()
    const grid = screen.getByTestId('map-grid')
    const rows = within(grid).getAllByTestId(/^map-row-/).map((row) => row.dataset.testid)
    expect(rows).toEqual([
      'map-row-fulfilment', 'map-row-warehousing', 'map-row-picking', 'map-row-packing',
      'map-row-billing', 'map-row-invoicing', 'map-row-invoice', 'map-row-dunning',
    ])
    expect(within(grid).getAllByTestId(/^map-column-/).map((th) => th.textContent))
      .toEqual(['Warehouse system', 'Handheld scanners', 'Finance system'])
  })

  it('marks the capability a system supports, and the section above it as rolled up', () => {
    open()
    expect(screen.getByTestId('map-cell-picking-wms').dataset.mark).toBe('supports')
    expect(screen.getByTestId('map-cell-warehousing-wms').dataset.mark).toBe('rolled-up')
    expect(screen.getByTestId('map-cell-fulfilment-wms').dataset.mark).toBe('rolled-up')
    expect(screen.getByTestId('map-cell-picking-erp').dataset.mark).toBeUndefined()
  })

  it('says the gap in words on a capability and as a count on the section', () => {
    open()
    expect(screen.getByTestId('map-coverage-dunning').textContent).toBe('uncovered')
    expect(screen.getByTestId('map-coverage-packing').textContent).toBe('people')
    expect(screen.getByTestId('map-coverage-invoice').textContent).toBe('')
    expect(screen.getByTestId('map-coverage-invoicing').textContent).toBe('1 gap')
    expect(screen.getByTestId('map-coverage-fulfilment').textContent).toBe('')
  })

  it('marks the people column where somebody is assigned', () => {
    open()
    expect(screen.getByTestId('map-people-packing').querySelector('span')).not.toBeNull()
    expect(screen.getByTestId('map-people-picking').querySelector('span')).toBeNull()
  })

  it('adds up the leaves in the top bar', () => {
    open()
    expect(screen.getByTestId('map-summary').textContent).toBe('2 covered · 1 by people · 1 uncovered')
  })

  it('names the owners across the top when the systems are somebody else’s', () => {
    open({
      describe: (id) => (id === 'erp' ? { name: 'Finance system', where: 'Finance' } : undefined),
    })
    expect(screen.getByTestId('map-owner-0').textContent).toBe('This scope')
    expect(screen.getByTestId('map-owner-1').textContent).toBe('Finance')
  })

  it('draws no owner band when every system is this scope’s own', () => {
    open()
    expect(screen.queryByTestId('map-owner-0')).toBeNull()
  })

  it('says so when there is nothing to map', () => {
    open({ model: model({ elements: [], relations: [] }) })
    expect(screen.getByText('No capabilities to map yet.')).toBeDefined()
    expect(screen.queryByTestId('map-grid')).toBeNull()
  })
})

describe('what a person can do from it', () => {
  it('opens a capability in the inspector', () => {
    open()
    fireEvent.click(within(screen.getByTestId('map-row-dunning')).getByRole('button'))
    const name = screen.getByLabelText('Name') as HTMLInputElement
    expect(name.value).toBe('Chase a late payment')
  })

  it('opens a system the scope holds from its heading, and not one it does not', () => {
    const { actions: acts } = open({
      describe: (id) => (id === 'ghost' ? { name: 'Ghost', where: 'Elsewhere' } : undefined),
      elsewhere: [{ id: 'x1', type: 'supports', sourceId: 'ghost', targetId: 'dunning' }],
    })
    fireEvent.click(within(screen.getByTestId('map-column-wms')).getByRole('button'))
    expect(acts.onOpenElement).toHaveBeenCalledWith('wms')
    expect(within(screen.getByTestId('map-column-ghost')).queryByRole('button')).toBeNull()
  })

  it('reads under readOnly', () => {
    open({ readOnly: true })
    fireEvent.click(within(screen.getByTestId('map-row-dunning')).getByRole('button'))
    expect((screen.getByLabelText('Name') as HTMLInputElement).disabled).toBe(true)
  })
})
