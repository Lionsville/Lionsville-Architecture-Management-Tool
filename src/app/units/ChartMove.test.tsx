// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A unit moved to another place in the organisation from the chart (3.7.1),
 * over a fictional organisation: a Board and Technology at the top, kept at
 * the organisation, and two lines of business kept in a Technology scope
 * under Technology, where they belong under the Board. *Move to…* on a unit's
 * box and in the outline opens the dialog; the parent is found anywhere in
 * the tree by its path, the units beside it may come along, what the move
 * does to who manages it is said first, and the move lands as one step in
 * the scope that keeps each unit.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useMemo, useState } from 'react'
import { renderShell } from '../testing/renderShell'
import { axeFindings } from '../testing/axe'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import type { Role, UnitType } from '../../model/operatingModel'
import type { DesignDiagram, DesignElement } from '../../model/types'
import { indexScopes } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { ChartPage } from './ChartPage'
import type { PeopleMoved } from './landPeopleMoves'
import { UNIT_MOVE_BARRIER } from './useMoveUnit'
import { unitViewsHere } from './unitViewsHere'

afterEach(() => cleanup())

const TODAY = '2026-10-17'

const board: UnitType = { id: 'ut-board', name: 'Board', top: true, within: [], slots: [{ role: 'ro-chair', min: 1, max: 1 }] }
const tech: UnitType = { id: 'ut-tech', name: 'Technology', top: true, within: ['ut-board'], slots: [{ role: 'ro-cio', min: 1, max: 1 }] }
const lob: UnitType = { id: 'ut-lob', name: 'Line of business', within: ['ut-board'], slots: [{ role: 'ro-lead', min: 0, max: 1 }] }
const team: UnitType = { id: 'ut-team', name: 'Team', within: ['ut-lob'], slots: [] }
const roles: Role[] = [
  { id: 'ro-chair', name: 'Chair', duties: [], manages: true },
  { id: 'ro-cio', name: 'Chief information officer', duties: [], manages: true },
  { id: 'ro-lead', name: 'Business lead', duties: [], manages: true },
]
const actor = (id: string, name: string, unitTypeId: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId, ...over,
})

const ROOT: HostModel = {
  name: 'Example Group', relations: [], diagrams: [], unitTypes: [board, tech, lob, team], roles,
  elements: [actor('board', 'Board', 'ut-board'), actor('tech', 'Technology', 'ut-tech')],
  assignments: [
    { id: 'as-chair', unitId: 'board', roleId: 'ro-chair', person: { person: 'pe-1' } },
    { id: 'as-cio', unitId: 'tech', roleId: 'ro-cio', person: { person: 'pe-2' } },
  ],
}
const TECHNOLOGY: HostModel = {
  name: 'Technology', relations: [], diagrams: [],
  elements: [
    actor('lob-a', 'Line of business A', 'ut-lob', { parentId: 'tech' }),
    actor('lob-b', 'Line of business B', 'ut-lob', { parentId: 'tech' }),
    actor('team-a1', 'Team A1', 'ut-team', { parentId: 'lob-a' }),
  ],
}

const view: DesignDiagram = { id: 'oc-1', kind: 'chart', name: 'Organisation', members: [] }

type Landed = { steps: ReadonlyMap<ScopePath, readonly Command[]>; barrier: string | undefined }

/** The organisation's chart, its moves landing as the test answers. */
function Harness({ landed, answer = ok, readOnly = false, moveAsked }: { landed: Landed[]; answer?: (changed: ScopePath[]) => PeopleMoved; readOnly?: boolean; moveAsked?: { unitId: string; nonce: number } }) {
  const index = useMemo(() => indexScopes([{ path: '', model: ROOT }, { path: 'technology', model: TECHNOLOGY }]), [])
  const here = useMemo(() => unitViewsHere(index, '', ROOT), [index])
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const reorder = (steps: ReadonlyMap<ScopePath, readonly Command[]>, barrier?: string) => {
    landed.push({ steps, barrier })
    return Promise.resolve(answer([...steps.keys()]))
  }
  return (
    <ChartPage
      diagram={view} here={here} today={TODAY} readOnly={readOnly} people={undefined}
      scopeLabel={(path) => (path === '' ? 'Example Group' : 'Technology')}
      {...(selected !== undefined ? { selectedId: selected } : {})} onSelect={setSelected} onOpenElsewhere={() => {}}
      scope="" reorder={reorder} {...(moveAsked ? { moveAsked } : {})}
    />
  )
}

const ok = (changed: ScopePath[]): PeopleMoved => ({ ok: true, changed, ended: 0, begun: 0 })
const boxOf = (id: string) => document.querySelector<HTMLElement>(`[data-testid="chart-unit"][data-element-id="${id}"]`)!
const dialog = () => within(screen.getByTestId('move-unit-dialog'))
/** A unit picked on the chart, and its Move to… pressed. */
const moveFromBox = (id: string, name: string) => {
  fireEvent.click(within(boxOf(id)).getByTestId('chart-unit-open'))
  fireEvent.click(within(boxOf(id)).getByRole('button', { name: `Move ${name} to…` }))
}
const refused = (button: HTMLElement) => button.getAttribute('aria-disabled') === 'true'

/** Opens the parent picker and picks the option named, by the keyboard and the pointer a person would use. */
function pickParent(query: string, option: string) {
  const input = dialog().getByTestId('move-unit-parent')
  fireEvent.change(input, { target: { value: query } })
  fireEvent.click(screen.getByRole('option', { name: new RegExp(`^${option}`) }))
}

describe('a unit moved from the chart', () => {
  it('opens Move to… from a unit\'s box, finds the parent anywhere in the tree, says who manages it after, and lands in the scope that keeps it', async () => {
    const landed: Landed[] = []
    renderShell(<Harness landed={landed} />)
    moveFromBox('lob-a', 'Line of business A')
    expect(dialog().getByTestId('move-unit-now').textContent).toBe('It sits under Technology now.')
    expect(refused(dialog().getByTestId('move-unit-move'))).toBe(true)
    // The chart stays in view beside it, with the places lit.
    expect(boxOf('board').getAttribute('data-drop')).toBe('ok')
    expect(boxOf('tech').getAttribute('data-drop')).toBe('current')
    pickParent('board', 'Board')
    expect(dialog().getByTestId('move-unit-managed-before').textContent).toContain('Chief information officer, Technology')
    expect(dialog().getByTestId('move-unit-managed-after').textContent).toContain('Chair, Board')
    expect(dialog().queryByTestId('move-unit-misfit')).toBeNull()
    expect(await axeFindings()).toEqual([])
    fireEvent.click(dialog().getByTestId('move-unit-move'))
    await waitFor(() => expect(screen.queryByTestId('move-unit-dialog')).toBeNull())
    expect(landed).toEqual([{
      steps: new Map([['technology', [{ type: 'element.update', id: 'lob-a', patch: { parentId: 'board', order: undefined } }]]]),
      barrier: UNIT_MOVE_BARRIER,
    }])
  })

  it('takes the units beside it along where they are ticked, and none by default', async () => {
    const landed: Landed[] = []
    renderShell(<Harness landed={landed} />)
    moveFromBox('lob-a', 'Line of business A')
    const along = dialog().getAllByTestId('move-unit-along-unit').map((one) => one.getAttribute('data-unit-id'))
    expect(along).toEqual(['lob-b'])
    expect((dialog().getByRole('checkbox', { name: 'Line of business B' }) as HTMLInputElement).checked).toBe(false)
    fireEvent.click(dialog().getByRole('checkbox', { name: 'Line of business B' }))
    pickParent('board', 'Board')
    expect(dialog().getAllByTestId('move-unit-managed-unit')).toHaveLength(2)
    fireEvent.click(dialog().getByTestId('move-unit-move'))
    await waitFor(() => expect(landed).toHaveLength(1))
    expect(landed[0].steps.get('technology')?.map((one) => ('id' in one ? one.id : ''))).toEqual(['lob-a', 'lob-b'])
  })

  it('offers the parents its type may sit under first, and the others below under their own heading in the one order for units, a move there said as a misfit', () => {
    renderShell(<Harness landed={[]} />)
    moveFromBox('lob-a', 'Line of business A')
    const rows = within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent)
    expect(rows).toEqual(['Board', 'At the top', 'Line of business Bin Technology', 'Technologywhere it sits now', 'Team A1inside it'])
    expect(screen.getByRole('listbox').textContent).toContain('Where its type may sit')
    expect(screen.getByRole('listbox').textContent).toContain('Where its type may not sit')
    // Its own place, and what it holds, are shown and not offered.
    expect(screen.getByRole('option', { name: /^Team A1/ }).getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(screen.getByRole('option', { name: /^At the top/ }))
    expect(dialog().getByTestId('move-unit-misfit').textContent).toContain('Line of business A is a Line of business, which may not sit there')
    expect(refused(dialog().getByTestId('move-unit-move'))).toBe(false)
  })

  it('opens Move to… for the unit picked in the outline, and says where nothing was written', async () => {
    renderShell(<Harness landed={[]} answer={() => ({ ok: false, reason: 'shell.scopeReadOnly' })} />)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Units' })).getByRole('button', { name: 'Line of business B' }))
    fireEvent.click(within(screen.getByTestId('chart-order')).getByRole('button', { name: 'Move to…' }))
    expect(dialog().getByTestId('move-unit-now').textContent).toBe('It sits under Technology now.')
    pickParent('board', 'Board')
    fireEvent.click(dialog().getByTestId('move-unit-move'))
    await waitFor(() => expect(dialog().getByTestId('move-unit-said').textContent).toBe('Nothing was written: a scope it writes may only be read here.'))
  })

  it('chooses a place by a press on the chart, and opens filled in from a drag, writing nothing until Move', () => {
    const landed: Landed[] = []
    renderShell(<Harness landed={landed} />)
    moveFromBox('lob-a', 'Line of business A')
    fireEvent.click(within(boxOf('board')).getByTestId('chart-unit-open'))
    expect(boxOf('board').getAttribute('data-target')).toBe('ok')
    expect(dialog().getByTestId('move-unit-managed-after').textContent).toContain('Chair, Board')
    expect(landed).toEqual([])
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByTestId('move-unit-dialog')).toBeNull()
    // Dragged onto a place: the same panel, filled in, and still nothing written.
    const data = new Map<string, string>()
    const dataTransfer = { setData: (key: string, value: string) => data.set(key, value), getData: (key: string) => data.get(key) ?? '', types: ['application/x-lvarch-unit'], effectAllowed: '' }
    fireEvent.dragStart(boxOf('lob-a'), { dataTransfer })
    fireEvent.drop(boxOf('board'), { dataTransfer })
    expect(dialog().getByTestId('move-unit-managed-after').textContent).toContain('Chair, Board')
    expect(landed).toEqual([])
  })

  it('moves the unit picked by M, and says it comes back from the keyboard', () => {
    renderShell(<Harness landed={[]} />)
    fireEvent.keyDown(within(boxOf('lob-a')).getByTestId('chart-unit-open'), { key: 'm' })
    expect(dialog().getByTestId('move-unit-now').textContent).toBe('It sits under Technology now.')
  })

  it('opens the same panel when the unit\'s inspector asks, with the chart in view', () => {
    const { rerender } = renderShell(<Harness landed={[]} />)
    expect(screen.queryByTestId('move-unit-dialog')).toBeNull()
    rerender(<Harness landed={[]} moveAsked={{ unitId: 'lob-b', nonce: 1 }} />)
    expect(dialog().getByTestId('move-unit-now').textContent).toBe('It sits under Technology now.')
    expect(screen.getByTestId('chart-units')).toBeTruthy()
  })

  it('offers no Move to… on a chart that is only read', () => {
    renderShell(<Harness landed={[]} readOnly />)
    expect(screen.queryByTestId('chart-move-to')).toBeNull()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Units' })).getByRole('button', { name: 'Line of business B' }))
    expect(screen.queryByTestId('chart-outline-move-to')).toBeNull()
    expect(screen.queryByTestId('chart-move-to')).toBeNull()
  })
})
