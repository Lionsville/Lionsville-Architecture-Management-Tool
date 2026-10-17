// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The organisation chart made easier to read (3.7.3), over a small fictional
 * organisation four levels deep: a first open shows two levels however few
 * units there are; the outline's width is dragged on its seam or set from the
 * keyboard, within its limits, and kept where the workspace keeps it; and a
 * unit type's long words are cut on the boxes and in the outline, the whole
 * name on hover and in each one's accessible name.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { useMemo, useState } from 'react'
import { OUTLINE_LIMITS } from '../../editor/panels'
import type { HostModel } from '../../model/hostModel'
import type { UnitType } from '../../model/operatingModel'
import type { DesignDiagram, DesignElement } from '../../model/types'
import { indexScopes } from '../../projects/scopeIndex'
import { axeFindings } from '../testing/axe'
import { renderShell } from '../testing/renderShell'
import { ChartPage } from './ChartPage'
import { unitViewsHere } from './unitViewsHere'

afterEach(() => cleanup())

const TODAY = '2026-10-17'

const division: UnitType = { id: 'ut-division', name: 'Region', top: true, within: [], slots: [] }
const department: UnitType = { id: 'ut-department', name: 'Organisational department', within: ['ut-division'], slots: [] }
const team: UnitType = { id: 'ut-team', name: 'Team', within: ['ut-department', 'ut-team'], slots: [] }

const actor = (id: string, name: string, unitTypeId: string, parentId?: string): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId, ...(parentId ? { parentId } : {}),
})

/** One region, two departments, a team in each and a squad inside one team: seven units, four levels. */
const MODEL: HostModel = {
  name: 'Acme Logistics',
  elements: [
    actor('ops', 'Operations', 'ut-division'),
    actor('hub', 'Hub', 'ut-department', 'ops'),
    actor('yard', 'Yard', 'ut-department', 'ops'),
    actor('sort', 'Sorting', 'ut-team', 'hub'),
    actor('gate', 'Gate', 'ut-team', 'yard'),
    actor('night', 'Night shift', 'ut-team', 'sort'),
  ],
  relations: [], diagrams: [], unitTypes: [division, department, team], roles: [], assignments: [],
}

const view: DesignDiagram = { id: 'oc-1', kind: 'chart', name: 'Organisation', members: [] }

function Harness({ outline, onSelect = () => {} }: { outline?: { width: number; onWidth(next: number): void }; onSelect?: (id: string | undefined) => void }) {
  const index = useMemo(() => indexScopes([{ path: '', model: MODEL }]), [])
  const here = useMemo(() => unitViewsHere(index, '', MODEL), [index])
  return (
    <ChartPage
      diagram={view} here={here} today={TODAY} readOnly={false} people={undefined} scopeLabel={(path) => path || 'Acme Logistics'}
      onSelect={onSelect} onOpenElsewhere={() => {}} scope="" {...(outline ? { outline } : {})}
    />
  )
}

/** The workspace's side of the width: held, as the editor's preferences hold the palette's. */
function Kept({ onWidth }: { onWidth: (next: number) => void }) {
  const [width, setWidth] = useState(300)
  return <Harness outline={{ width, onWidth: (next) => { setWidth(next); onWidth(next) } }} />
}

const drawn = () => screen.getAllByTestId('chart-unit').map((box) => box.getAttribute('data-element-id'))
const outline = () => screen.getByRole('navigation', { name: 'Units' })
const seam = () => screen.getByRole('separator', { name: 'Resize the outline' })
// jsdom has no PointerEvent: a MouseEvent under the pointer's name carries the button and the coordinates the seam reads.
const pointer = (type: string, init: MouseEventInit) => new MouseEvent(type, { button: 0, bubbles: true, cancelable: true, ...init })

describe('a first open of a small chart', () => {
  it('shows the top units and the units under them, folds the rest, and says so', () => {
    renderShell(<Harness />)
    // Seven units, so no size rule folds them: the departments fold because they are on the second level.
    expect(drawn()).toEqual(['ops', 'hub', 'yard'])
    expect(screen.getByTestId('chart-folded-note').textContent).toMatch(/^Opened two levels deep/)
    expect(within(outline()).getAllByTestId('chart-outline-unit').map((row) => row.getAttribute('data-unit-id'))).toEqual(['ops', 'hub', 'yard'])
  })

  it('opens a unit deeper down, and the way to it, when the outline picks it', () => {
    const onSelect = vi.fn()
    renderShell(<Harness onSelect={onSelect} />)
    fireEvent.click(within(outline()).getByRole('button', { name: 'Unfold Hub' }))
    expect(drawn()).toEqual(expect.arrayContaining(['sort']))
    // The team itself is folded on neither: it was never on the second level.
    fireEvent.click(within(outline()).getByRole('button', { name: 'Team Sorting' }))
    expect(drawn()).toEqual(expect.arrayContaining(['sort', 'night']))
    expect(onSelect).toHaveBeenLastCalledWith('sort')
  })
})

describe('the outline\'s width', () => {
  it('is a separator with its value and limits, moved by the arrow keys and put back by Home', async () => {
    renderShell(<Harness />)
    const handle = seam()
    expect(handle.getAttribute('aria-orientation')).toBe('vertical')
    expect(handle.getAttribute('aria-valuenow')).toBe(String(OUTLINE_LIMITS.default))
    expect(handle.getAttribute('aria-valuemin')).toBe(String(OUTLINE_LIMITS.min))
    expect(handle.getAttribute('aria-valuemax')).toBe(String(OUTLINE_LIMITS.max))
    expect(handle.tabIndex).toBe(0)
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(handle.getAttribute('aria-valuenow')).toBe(String(OUTLINE_LIMITS.default + 8))
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true })
    expect(handle.getAttribute('aria-valuenow')).toBe(String(OUTLINE_LIMITS.default - 24))
    for (let at = 0; at < 20; at += 1) fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true })
    expect(handle.getAttribute('aria-valuenow')).toBe(String(OUTLINE_LIMITS.min))
    fireEvent.keyDown(handle, { key: 'Home' })
    expect(handle.getAttribute('aria-valuenow')).toBe(String(OUTLINE_LIMITS.default))
    expect(await axeFindings()).toEqual([])
  })

  it('follows the pointer off where the drag started, no wider than its maximum, and is kept where the workspace keeps it', () => {
    const onWidth = vi.fn()
    renderShell(<Kept onWidth={onWidth} />)
    const handle = seam()
    expect(handle.getAttribute('aria-valuenow')).toBe('300')
    let captured = false
    handle.setPointerCapture = () => { captured = true }
    handle.hasPointerCapture = () => captured
    fireEvent(handle, pointer('pointerdown', { clientX: 300 }))
    fireEvent(handle, pointer('pointermove', { clientX: 360 }))
    expect(onWidth).toHaveBeenLastCalledWith(360)
    expect(seam().getAttribute('aria-valuenow')).toBe('360')
    fireEvent(handle, pointer('pointermove', { clientX: 2000 }))
    expect(onWidth).toHaveBeenLastCalledWith(OUTLINE_LIMITS.max)
  })
})

describe('a unit type\'s name on the chart', () => {
  it('cuts each long word on the box and in the outline, with the whole name on hover and in the accessible name', async () => {
    renderShell(<Harness />)
    const hub = screen.getAllByTestId('chart-unit').find((box) => box.getAttribute('data-element-id') === 'hub')!
    const label = within(hub).getAllByTestId('chart-type-label')[0]!
    expect(label.getAttribute('title')).toBe('Organisational department')
    expect(label.querySelector('[aria-hidden="true"]')?.textContent).toBe('Organi. depart.')
    // The box's button and the outline's row are named by the whole type.
    expect(within(hub).getByRole('button', { name: 'Organisational department Hub' })).toBeTruthy()
    const row = within(outline()).getByRole('button', { name: 'Organisational department Hub' })
    expect(within(row).getByTestId('chart-type-label').getAttribute('title')).toBe('Organisational department')
    // A short name is drawn as it is, with no hover of its own.
    const ops = screen.getAllByTestId('chart-unit').find((box) => box.getAttribute('data-element-id') === 'ops')!
    const opsName = within(ops).getAllByTestId('chart-unit-open')[0]!
    expect(opsName.textContent).toBe('RegionOperations')
    expect(within(opsName).queryByTestId('chart-type-label')).toBeNull()
    expect(await axeFindings()).toEqual([])
  })
})
