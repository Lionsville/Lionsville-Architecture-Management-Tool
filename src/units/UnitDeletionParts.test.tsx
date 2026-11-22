// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * What a delete's confirmation says about units (3.6.2), on its own: several
 * units are ended, not one, so nothing offers a day; the units inside are
 * named three and then counted; another unit of the type is picked from a
 * list; and a delete that takes nothing else says nothing more.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { translator } from '../../i18n'
import type { UnitDeletion, UnitsChoice } from '../../model/unitDeletion'
import { axeFindings } from '../testing/axe'
import { renderShell } from '../testing/renderShell'
import { UnitDeletionParts } from './UnitDeletionParts'

afterEach(() => cleanup())

const kept = (id: string, name: string, unitTypeId = 'ut-team') => ({ id, name, kind: 'actor' as const, unitTypeId, scope: '' })

function plan(over: Partial<UnitDeletion> = {}): UnitDeletion {
  return {
    units: [kept('north', 'North', 'ut-division')], inside: [], up: { fits: true }, into: [], initial: 'up', choice: 'up', below: [],
    roles: [], earlierAssignments: 0, applications: [], serves: [], responsibleFor: 0, steps: new Map(), ...over,
  }
}

const names = { unit: (id: string) => id, role: (id: string) => id, type: (id: string) => (id === 'ut-division' ? 'Division' : id), scope: (path: string) => path }

function Held({ held, onChoice }: { held: UnitDeletion; onChoice: (choice: UnitsChoice) => void }) {
  const [choice, setChoice] = useState<UnitsChoice>(held.initial)
  return (
    <UnitDeletionParts plan={held} choice={choice} names={names} today="2026-10-12" s={translator('en')}
      onChoice={(next) => { setChoice(next); onChoice(next) }} />
  )
}

describe('UnitDeletionParts', () => {
  it('offers no day for several units, and says nothing more where nothing else goes', async () => {
    renderShell(<Held held={plan({ units: [kept('north', 'North'), kept('south', 'South')] })} onChoice={vi.fn()} />)
    expect(screen.getByTestId('unit-delete-end-first').textContent).toContain('Ending them is usually what is meant')
    expect(screen.queryByTestId('unit-delete-end')).toBeNull()
    expect(screen.queryByTestId('roles-ended')).toBeNull()
    expect(screen.queryByTestId('unit-delete-inside')).toBeNull()
    expect(screen.queryByTestId('unit-delete-also')).toBeNull()
    expect(await axeFindings()).toEqual([])
  })

  it('names three units inside and counts the rest, and picks another unit of the type from a list', async () => {
    const onChoice = vi.fn()
    const inside = ['a', 'b', 'c', 'd', 'e'].map((id) => kept(id, id.toUpperCase()))
    renderShell(<Held held={plan({
      inside, up: { fits: false }, into: [kept('south', 'South', 'ut-division'), kept('west', 'West', 'ut-division')], initial: 'into:south', choice: 'into:south',
      applications: [{ scope: '', id: 'tms', name: 'TMS' }, { scope: '', id: 'wms', name: 'WMS' }], serves: ['shipping', 'warehouse'], responsibleFor: 3,
    })} onChoice={onChoice} />)
    const part = screen.getByTestId('unit-delete-inside')
    expect(part.textContent).toContain('Inside it: A, B, C and 2 more')
    // The default is first, and every choice is shown where the units may not move up.
    expect(within(part).getAllByRole('radio').length).toBe(3)
    fireEvent.mouseDown(within(screen.getByTestId('unit-delete-into-pick')).getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: 'West' }))
    expect(onChoice).toHaveBeenLastCalledWith('into:west')
    expect(screen.getByTestId('unit-delete-also').textContent).toBe([
      '2 applications name it as their team: that is cleared, and they show as owned by nobody.',
      'It serves shipping, warehouse: that link goes with it.',
      'It is responsible for 3 capabilities: those links go with it.',
    ].join(''))
    fireEvent.click(within(part).getByTestId('unit-delete-too').querySelector('input')!)
    expect(onChoice).toHaveBeenLastCalledWith('delete')
    expect(await axeFindings()).toEqual([])
  })
})
