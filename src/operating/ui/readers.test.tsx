// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * What is read beside the structure and on the Exceptions tab, each by itself:
 * every way of saying otherwise than the model and what each offers, a role's
 * places and letters, and a responsibility's parties and order. And nothing
 * offered to change where the page only reads.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import type { Role } from '../../model/operatingModel'
import type { OperatingModel } from '../edit'
import type { OrganisationFacts, OutsideTheModel } from '../organisationFacts'
import { ExceptionsTab } from './ExceptionsTab'
import { ResponsibilityReader } from './ResponsibilityReader'
import { RoleReader } from './RoleReader'
import type { ReaderParts } from './ReaderParts'

afterEach(() => cleanup())

const MODEL = {
  unitTypes: [{ id: 'team', name: 'Team', within: [], slots: [{ role: 'dev', reportsTo: 'lead' }] }],
  roles: [
    { id: 'lead', name: 'Lead', duties: [{ responsibility: 'plan', raci: 'A' }] },
    { id: 'dev', name: 'Developer', reportsTo: 'lead', duties: [{ responsibility: 'plan', raci: 'R' }, { responsibility: 'run', raci: 'C' }, { responsibility: 'lost', raci: 'I' }] },
    { id: 'ops', name: 'Operator', duties: [] },
  ],
  responsibilities: [
    { id: 'plan', name: 'Plan the work', group: 'Delivery' },
    { id: 'run', name: 'Run the work', group: 'Delivery' },
    { id: 'loose', name: 'Loose ends' },
  ],
} as unknown as OperatingModel

const ROW = { kind: 'solid', units: 2, scope: 'acme' } as const
const EXCEPTIONS: readonly OutsideTheModel[] = [
  { ...ROW, on: 'type', key: 'by-type', roleId: 'dev', saysRole: 'ops', typeId: 'team', slotIndex: 0, departsFrom: 'lead' },
  { ...ROW, on: 'unit', key: 'by-unit', roleId: 'dev', saysRole: 'ops', saysUnit: 'Yard', unitId: 'u1', unitName: 'Quay' },
  { ...ROW, on: 'holder', key: 'by-holder', roleId: 'ops', unitId: 'u2', unitName: 'Dock', holder: 'Ada', departsFrom: 'lead' },
  { ...ROW, on: 'outside', key: 'outside', roleId: 'ops', unitId: 'u3', unitName: 'Pier', holder: 'Grace' },
  { ...ROW, kind: 'dotted', on: 'unit', key: 'dotted', roleId: 'lead', saysRole: 'ops', unitName: 'Quay' },
] as unknown as readonly OutsideTheModel[]

function exceptions(more: { readOnly?: boolean; onBackBelow?: (one: OutsideTheModel) => void; onOpenUnit?: (unit: { id: string; scope: string }) => void; start?: string; list?: readonly OutsideTheModel[] } = {}) {
  const calls = { dispatch: vi.fn(), openRole: vi.fn(), openType: vi.fn(), backBelow: more.onBackBelow }
  function Held() {
    const [selected, setSelected] = useState(more.start)
    return (
      <ExceptionsTab
        model={MODEL} exceptions={more.list ?? EXCEPTIONS} readOnly={more.readOnly ?? false} dispatch={calls.dispatch}
        onBackBelow={more.onBackBelow} onOpenRole={calls.openRole} onOpenType={calls.openType} onOpenUnit={more.onOpenUnit}
        selected={selected} onSelect={setSelected}
      />
    )
  }
  renderShell(<Held />)
  return calls
}

describe('the Exceptions tab', () => {
  it('says who says otherwise, what it says and what it departs from, solid lines first', () => {
    exceptions()
    const said = document.querySelector('[data-guide="operating.exceptions"]')!.textContent
    expect(said).toContain('Team')
    expect(said).toContain('Operator, Yard')
    expect(said).toContain('Ada')
    expect(said).toContain('Grace')
    expect(document.querySelectorAll('[data-guide="operating.exceptions"] [data-key="dotted"]')).toHaveLength(0)
    // What solid-first leaves out is a press away.
    fireEvent.click(within(screen.getByTestId('operating-ex-more')).getByRole('button', { name: /^Show all/ }))
    expect(document.querySelectorAll('[data-guide="operating.exceptions"] [data-key="dotted"]')).toHaveLength(1)
    expect(screen.queryByTestId('operating-ex-more')).toBeNull()
  })

  it('titles an exception with the role and where it is said otherwise', () => {
    exceptions({ start: 'dotted' })
    expect(screen.getByRole('dialog').getAttribute('aria-labelledby') && document.getElementById(screen.getByRole('dialog').getAttribute('aria-labelledby')!)?.textContent).toContain('in Quay')
  })

  it('puts a type’s own line back, and opens the type and the role it is about', () => {
    const { dispatch, openType, openRole } = exceptions({ start: 'by-type' })
    fireEvent.click(screen.getByRole('button', { name: 'Open the unit type' }))
    expect(openType).toHaveBeenCalledWith('team')
    fireEvent.click(screen.getByRole('button', { name: 'Open the role' }))
    expect(openRole).toHaveBeenCalledWith('dev')
    fireEvent.click(screen.getByTestId('operating-back-to-default'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('operating-back-to-default')).toBeNull()
  })

  it('hands a unit’s or a holder’s line back to where it is kept, and goes to the unit', () => {
    const onBackBelow = vi.fn()
    const onOpenUnit = vi.fn()
    const { dispatch } = exceptions({ start: 'by-unit', onBackBelow, onOpenUnit })
    fireEvent.click(screen.getByRole('button', { name: /organisation/ }))
    expect(onOpenUnit).toHaveBeenCalledWith({ id: 'u1', scope: 'acme' })
    fireEvent.click(screen.getByTestId('operating-back-to-default'))
    expect(onBackBelow).toHaveBeenCalledWith(EXCEPTIONS[1])
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('offers no way back with nowhere to put it, for one placed outside, or where the page only reads', () => {
    exceptions({ start: 'by-holder' })
    expect(screen.queryByTestId('operating-back-to-default')).toBeNull()
    cleanup()
    exceptions({ start: 'outside', onBackBelow: vi.fn() })
    expect(screen.queryByTestId('operating-back-to-default')).toBeNull()
    cleanup()
    exceptions({ start: 'by-type', readOnly: true })
    expect(screen.queryByTestId('operating-back-to-default')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open the role' })).toBeTruthy()
  })

  it('asks before changing a role that many say otherwise than, and writes it as one step', () => {
    const many = ['t1', 't2', 't3'].map((typeId, slotIndex) => ({ ...ROW, on: 'type', key: typeId, roleId: 'dev', saysRole: 'ops', typeId, slotIndex })) as unknown as readonly OutsideTheModel[]
    const { dispatch } = exceptions({ list: many })
    fireEvent.click(within(screen.getByTestId('operating-many-say')).getByRole('button'))
    const asked = screen.getByRole('dialog')
    fireEvent.click(within(asked).getByRole('button', { name: 'Cancel' }))
    expect(dispatch).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByTestId('operating-many-say')).getByRole('button', { hidden: true }))
    fireEvent.click(screen.getByTestId('operating-change-role-confirm'))
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('finds by its words, and offers no suggestion where the page only reads', () => {
    const many = ['t1', 't2', 't3'].map((typeId, slotIndex) => ({ ...ROW, on: 'type', key: typeId, roleId: 'dev', saysRole: 'ops', typeId, slotIndex })) as unknown as readonly OutsideTheModel[]
    exceptions({ list: many, readOnly: true })
    expect(screen.queryByTestId('operating-many-say')).toBeNull()
  })
})

function parts(more: Partial<ReaderParts> = {}): ReaderParts {
  return {
    model: MODEL, readOnly: false, dispatch: vi.fn(), onSelect: vi.fn(), onRemove: vi.fn(), facts: undefined, refuseLine: undefined,
    renderMarkdown: undefined, aside: null, onOpenHistory: undefined, onOpenUnit: undefined, onOpenChart: undefined, ...more,
  }
}

const roleOf = (id: string) => MODEL.roles.find((one) => one.id === id) as Role

const place = (n: number, holders: { name: string; acting?: boolean }[] = []) => ({ unit: { id: `u${n}`, name: `Unit ${n}`, scope: 'acme' }, holders, vacant: holders.length ? 0 : 1 })

describe('a role read', () => {
  it('says its letters in the part looked at, then all of them, and goes to a responsibility', () => {
    const held = parts()
    renderShell(<RoleReader role={roleOf('dev')} parts={held} partName="Delivery" partDuties={['plan']} />)
    expect(screen.getByRole('button', { name: 'Plan the work' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Run the work' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'All 3' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run the work' }))
    expect(held.onSelect).toHaveBeenCalledWith('run')
    // A letter on a responsibility that is gone still reads, by its id.
    expect(screen.getByRole('button', { name: 'lost' })).toBeTruthy()
  })

  it('says where it is held, by whom, what is vacant, and goes to each place and the chart', () => {
    const onOpenUnit = vi.fn()
    const onOpenChart = vi.fn()
    const places = [place(1, [{ name: 'Ada' }, { name: 'Grace', acting: true }]), place(2), place(3), place(4), place(5), place(6), place(7)]
    const facts = { placesOf: () => places } as unknown as OrganisationFacts
    renderShell(<RoleReader role={roleOf('dev')} parts={parts({ facts, onOpenUnit, onOpenChart })} />)
    expect(screen.getByTestId('operating-held-in').textContent).toContain('Team')
    expect(screen.getByTestId('operating-holders').textContent).toContain('2')
    expect(screen.getAllByTestId('operating-role-place')).toHaveLength(5)
    expect(screen.getAllByTestId('operating-role-place')[0].textContent).toContain('Ada')
    fireEvent.click(screen.getByRole('button', { name: 'Unit 1' }))
    expect(onOpenUnit).toHaveBeenCalledWith(places[0].unit)
    fireEvent.click(screen.getByRole('button', { name: '2 more' }))
    expect(screen.getAllByTestId('operating-role-place')).toHaveLength(7)
    fireEvent.click(screen.getByTestId('operating-open-chart'))
    expect(onOpenChart).toHaveBeenCalled()
  })

  it('calls a place vacant only where the count above does, and an optional one nobody holds quietly', () => {
    const facts = { placesOf: () => [place(1), { ...place(2), vacant: 0 }] } as unknown as OrganisationFacts
    renderShell(<RoleReader role={roleOf('dev')} parts={parts({ facts })} />)
    expect(screen.getByTestId('operating-holders').textContent).toBe('Holders: 0 · vacant: 1')
    const [needed, optional] = screen.getAllByTestId('operating-role-place')
    expect(needed.textContent).toContain('Vacant')
    expect(optional.textContent).toContain('Nobody yet')
  })

  it('names its purpose with the words it shows, so the press is found by what is read', () => {
    const role = { ...roleOf('dev'), purpose: 'Builds the work' }
    renderShell(<RoleReader role={role} parts={parts()} />)
    expect(screen.getByRole('button', { name: /^Write Purpose.*Builds the work$/ })).toBeTruthy()
  })

  it('names a place it cannot go to, and says a role held in no type', () => {
    const facts = { placesOf: () => [place(1)] } as unknown as OrganisationFacts
    renderShell(<RoleReader role={roleOf('ops')} parts={parts({ facts })} />)
    expect(screen.queryByRole('button', { name: 'Unit 1' })).toBeNull()
    expect(screen.getByTestId('operating-role-place').textContent).toContain('Unit 1')
    expect(screen.getByTestId('operating-held-in').textContent).not.toContain('Team')
  })

  it('changes a line unless it is refused, and offers no change where the page only reads', () => {
    const dispatch = vi.fn()
    const refuseLine = vi.fn(() => 'It would close a loop.')
    renderShell(<RoleReader role={roleOf('dev')} parts={parts({ dispatch, refuseLine })} />)
    fireEvent.click(screen.getByTestId('operating-role-change-solid'))
    expect(screen.getByTestId('operating-role-lines')).toBeTruthy()
    fireEvent.click(screen.getByTestId('operating-role-change-solid'))
    expect(screen.queryByTestId('operating-role-lines')).toBeNull()
    cleanup()
    renderShell(<RoleReader role={roleOf('dev')} parts={parts({ readOnly: true })} />)
    expect(screen.queryByTestId('operating-role-change-solid')).toBeNull()
  })

  it('moves along the columns from its More, as far as there is room', () => {
    const dispatch = vi.fn()
    renderShell(<RoleReader role={roleOf('dev')} parts={parts({ dispatch })} />)
    fireEvent.click(screen.getByTestId('operating-more'))
    fireEvent.click(screen.getByRole('button', { name: 'Move left' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move right' }))
    expect(dispatch).toHaveBeenCalledTimes(2)
  })
})

describe('a responsibility read', () => {
  const of = (id: string) => MODEL.responsibilities.find((one) => one.id === id)!

  it('says who has a part and goes to the role', () => {
    const held = parts()
    renderShell(<ResponsibilityReader responsibility={of('plan')} parts={held} />)
    fireEvent.click(screen.getByRole('button', { name: 'Lead' }))
    expect(held.onSelect).toHaveBeenCalledWith('lead')
  })

  it('says nobody has a part, and where it stands with no group', () => {
    renderShell(<ResponsibilityReader responsibility={of('loose')} parts={parts()} />)
    expect(screen.getByTestId('operating-responsibility-reader').textContent).toContain('1')
    expect(screen.queryByRole('button', { name: 'Lead' })).toBeNull()
  })

  it('ends in the page’s one foot, its removal alone at the far end, as the exception’s way back is', () => {
    renderShell(<ResponsibilityReader responsibility={of('plan')} parts={parts({ onOpenHistory: vi.fn() })} />)
    const foot = screen.getByTestId('operating-reader-foot')
    expect(foot.querySelector('.op-foot__away')?.textContent).toBe('Delete')
    expect(foot.firstElementChild?.textContent).toBe('History')
    cleanup()
    exceptions({ start: 'by-type' })
    expect(screen.getByTestId('operating-reader-foot').querySelector('.op-foot__away [data-testid="operating-back-to-default"]')).not.toBeNull()
  })

  it('moves within its group, and not past either end', () => {
    const dispatch = vi.fn()
    renderShell(<ResponsibilityReader responsibility={of('plan')} parts={parts({ dispatch })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Move down' }))
    expect(dispatch).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Move up' }))
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('puts its group back on Escape, and the key goes no further: the page around it stays', () => {
    const dispatch = vi.fn()
    const outside = vi.fn()
    window.addEventListener('keydown', outside)
    try {
      renderShell(<ResponsibilityReader responsibility={of('plan')} parts={parts({ dispatch })} />)
      fireEvent.click(screen.getByRole('button', { name: /Group, such as a value stream/ }))
      const field = screen.getByRole('combobox', { name: /Group, such as a value stream/ })
      fireEvent.change(field, { target: { value: 'Half typed' } })
      fireEvent.keyDown(field, { key: 'Escape' })
      expect(outside).not.toHaveBeenCalled()
      expect(dispatch).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', outside)
    }
  })

  it('offers no order where the page only reads', () => {
    renderShell(<ResponsibilityReader responsibility={of('plan')} parts={parts({ readOnly: true })} />)
    expect(document.querySelector('[data-guide="operating.responsibilityOrder"]')).toBeNull()
  })
})
