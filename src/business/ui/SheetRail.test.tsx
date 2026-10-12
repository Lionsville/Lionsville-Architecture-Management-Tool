// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The stakeholder rail's units, on screen (ADR-0036, amended 12 October
 * 2026): the parties, *Units on this sheet* with why each is there, *All
 * units* for the session under the view's key, and a stakeholder typed as a
 * unit that stays where it was with a note. Which rows go where is pinned in
 * `sheet.test.ts`; this is what a reader sees and what the session keeps.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { SheetPage } from './SheetPage'
import type { SheetActions } from './FunctionInspector'
import { renderShell } from '../../app/testing/renderShell'
import { axeFindings } from '../../app/testing/axe'
import { SessionFolds } from '../../app/sessionFolds'
import { SessionMemoryContext } from '../../widgets/sessionMemory'
import { actor, relation, shippingScope } from '../testFixtures'
import type { DesignDiagram, DesignElement, DesignModel } from '../../model'

afterEach(() => cleanup())

const SHEET: DesignDiagram = {
  id: 'sh-1', kind: 'sheet', name: 'Business architecture', journeyId: 'ship',
  lanes: ['key-account', 'partner'], areas: ['fulfilment', 'billing'], members: [], geometry: { nodes: [] },
}

function model(elements?: (all: DesignElement[]) => DesignElement[]): DesignModel {
  const scope = shippingScope()
  const units = [
    actor('billing-team', 'Billing team', { unitTypeId: 'team' }),
    actor('dispatch', 'Dispatch', { unitTypeId: 'team' }),
    actor('rates', 'Rates', { unitTypeId: 'team' }),
  ]
  const all = [...scope.elements, ...units]
  return {
    name: 'Acme Logistics', diagrams: [SHEET],
    elements: elements ? elements(all) : all,
    relations: [...scope.relations, relation('a3', 'assigned', 'billing-team', 'dunning')],
  }
}

const actions = (): SheetActions => ({
  updateElement: vi.fn(), moveElement: vi.fn(), updateSheet: vi.fn(), onOpenElement: vi.fn(),
  addElement: vi.fn(() => 'made'), addJourney: vi.fn(() => 'made'), addArea: vi.fn(() => 'made'),
  addLane: vi.fn(() => 'made'), removeElement: vi.fn(), setCoverage: vi.fn(),
})

function page(over: { model?: DesignModel; readOnly?: boolean; notify?: (message: string) => void } = {}): ReactElement {
  return (
    <SheetPage
      open model={over.model ?? model()} sheet={SHEET} readOnly={over.readOnly ?? false} actions={actions()}
      onClose={() => {}} remember="rail-key" {...(over.notify ? { notify: over.notify } : {})}
    />
  )
}

const inMemory = (memory: SessionFolds, node: ReactElement) => (
  <SessionMemoryContext.Provider value={memory}>{node}</SessionMemoryContext.Provider>
)

describe('the units on the stakeholder rail', () => {
  it('draws the parties, then the units the sheet uses with why, and says how many more there are', async () => {
    renderShell(page())
    const rail = screen.getByTestId('sheet-rail')
    expect(within(rail).getByText('Warehouse team')).toBeTruthy()
    const used = screen.getByTestId('sheet-rail-used')
    expect(within(used).getByText('Units on this sheet')).toBeTruthy()
    expect(within(used).getByText('Billing team')).toBeTruthy()
    expect(within(used).getByText('Responsible for Chase a late payment')).toBeTruthy()
    expect(within(rail).queryByText('Dispatch')).toBeNull()
    expect(screen.getByTestId('sheet-units-not-drawn').textContent).toBe('2 more units are filed here.')
    expect(await axeFindings()).toEqual([])
  })

  it('draws every unit with All units, and the session keeps it for the view', async () => {
    const memory = new SessionFolds()
    const { unmount } = renderShell(inMemory(memory, page()))
    fireEvent.click(within(screen.getByTestId('sheet-all-units')).getByRole('switch'))
    const other = screen.getByTestId('sheet-rail-other')
    expect(within(other).getByText('All other units')).toBeTruthy()
    expect(within(other).getByText('Dispatch')).toBeTruthy()
    expect(screen.queryByTestId('sheet-units-not-drawn')).toBeNull()
    expect(await axeFindings()).toEqual([])
    unmount()

    renderShell(inMemory(memory, page()))
    expect(within(screen.getByTestId('sheet-rail-other')).getByText('Rates')).toBeTruthy()
    fireEvent.click(within(screen.getByTestId('sheet-all-units')).getByRole('switch'))
    expect(screen.queryByTestId('sheet-rail-other')).toBeNull()
  })

  it('offers no switch where every unit is drawn already', () => {
    renderShell(page({ model: model((all) => all.filter((one) => one.id !== 'dispatch' && one.id !== 'rates')) }))
    expect(screen.queryByTestId('sheet-all-units')).toBeNull()
  })

  it('keeps a stakeholder typed as a unit where it was, for the session, and says where it went', () => {
    const memory = new SessionFolds()
    const notify = vi.fn()
    const typed = model((all) => all.map((one) => (one.id === 'warehouse-team' ? { ...one, unitTypeId: 'team' } : one)))
    const { rerender, unmount } = renderShell(inMemory(memory, page({ notify })))
    rerender(inMemory(memory, page({ notify, model: typed })))
    const button = screen.getByTestId('sheet-actor-warehouse-team')
    expect(button.getAttribute('data-rail-group')).toBe('parties')
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('Now a unit: it is on the organisation chart. Use ‘All units’ to keep it on this rail.')
    unmount()

    renderShell(inMemory(memory, page({ notify, model: typed })))
    expect(screen.getByTestId('sheet-actor-warehouse-team').getAttribute('data-rail-group')).toBe('parties')
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('keeps nothing on a page that is only read', () => {
    const notify = vi.fn()
    const typed = model((all) => all.map((one) => (one.id === 'warehouse-team' ? { ...one, unitTypeId: 'team' } : one)))
    const { rerender } = renderShell(page({ notify, readOnly: true }))
    rerender(page({ notify, readOnly: true, model: typed }))
    // Responsible for Packing, so it is drawn among the units the sheet uses.
    expect(screen.getByTestId('sheet-actor-warehouse-team').getAttribute('data-rail-group')).toBe('used')
    expect(notify).not.toHaveBeenCalled()
  })
})
