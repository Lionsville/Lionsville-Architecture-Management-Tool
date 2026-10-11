// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The operating model's first tab drawn as a structure (ADR-0036, amended 11
 * October 2026), over Acme Logistics' own model: each unit type once in its
 * lane, each card saying what the type is, a line from every place it may
 * sit — along the rail where it skips a lane — picking that lights and dims,
 * the order in a lane moved from the inspector, and the two trays.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import type { Command } from '../../model/commands'
import type { Model } from '../../model/normalised'
import type { UnitTypeId } from '../../model/operatingModel'
import { apply } from '../../model/reducer'
import { applyAll, empty, listsOf } from '../testing'
import { OperatingModelPage } from './OperatingModelPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const SCRUM = { library: 'scrum', entry: 'scrum-team', version: '1', language: 'en' }

function acme(): Model {
  return applyAll(empty(), [
    { type: 'role.add', role: { id: 'ro-owner', name: 'Domain owner', duties: [], manages: true } },
    { type: 'role.add', role: { id: 'ro-lead', name: 'Cluster lead', duties: [], manages: true } },
    { type: 'role.add', role: { id: 'ro-po', name: 'Product owner', duties: [] } },
    { type: 'role.add', role: { id: 'ro-dev', name: 'Developer', duties: [] } },
    { type: 'role.add', role: { id: 'ro-coach', name: 'Team coach', duties: [], until: '2026-12-31' } },
    { type: 'role.add', role: { id: 'ro-inc', name: 'Incident manager', duties: [] } },
    { type: 'unitType.add', unitType: { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [{ role: 'ro-owner', min: 1, max: 1 }] } },
    { type: 'unitType.add', unitType: { id: 'ut-platform', name: 'Platform', top: true, within: [], slots: [] } },
    {
      type: 'unitType.add',
      unitType: { id: 'ut-cluster', name: 'Cluster', top: true, within: ['ut-domain'], spans: true, slots: [{ role: 'ro-lead', min: 1, max: 1 }] },
    },
    {
      type: 'unitType.add',
      unitType: {
        id: 'ut-team', name: 'Team', within: ['ut-cluster'], limit: 3, until: '2027-06-30', basedOn: SCRUM,
        slots: [{ role: 'ro-po', min: 1, max: 1 }, { role: 'ro-dev', min: 3, max: 9 }, { role: 'ro-coach', min: 0, max: 1 }],
      },
    },
    { type: 'unitType.add', unitType: { id: 'ut-guild', name: 'Guild', within: [], slots: [{ role: 'ro-coach', min: 1, max: 1 }] } },
  ])
}

const COUNTS = new Map<UnitTypeId, number>([['ut-domain', 3], ['ut-cluster', 4], ['ut-team', 9], ['ut-platform', 1]])

function Harness({ start, sent, atOrganisation = true }: { start: Model; sent: Command[]; atOrganisation?: boolean }) {
  const [model, setModel] = useState(start)
  return (
    <OperatingModelPage
      open model={listsOf(model)} readOnly={false} atOrganisation={atOrganisation} makeId={(prefix) => `${prefix}-new`}
      dispatch={(command) => {
        sent.push(command)
        setModel((held) => {
          const result = apply(held, command)
          return result.ok ? result.model : held
        })
      }}
      unitCounts={COUNTS}
      onClose={() => {}}
    />
  )
}

function show(more: Partial<Parameters<typeof Harness>[0]> = {}) {
  const sent: Command[] = []
  renderShell(<Harness start={acme()} sent={sent} {...more} />)
  return sent
}

const lane = (n: number) => screen.getByTestId('structure-lanes').querySelector<HTMLElement>(`[data-lane="${n}"]`)!
const card = (id: string) => screen.getByTestId(`unit-type-${id}`)
const looks = (...ids: string[]) => ids.map((id) => card(id).dataset.look)
const pickType = (name: string) => fireEvent.click(within(screen.getByTestId('structure-lanes')).getByRole('button', { name }))

describe('the units and roles drawn as a structure', () => {
  it('draws each type once in its lane, a card saying what it is, and the two trays', async () => {
    show()
    expect(within(lane(0)).getByTestId('structure-organisation').textContent).toContain('The organisation')
    expect(within(lane(1)).getAllByTestId(/^unit-type-/).map((one) => one.dataset.testid)).toEqual(['unit-type-ut-domain', 'unit-type-ut-platform'])
    // The cluster may sit at the top or in a domain: once, in the deeper lane.
    expect(within(lane(2)).getAllByTestId(/^unit-type-/).map((one) => one.dataset.testid)).toEqual(['unit-type-ut-cluster'])
    expect(within(lane(3)).getByTestId('unit-type-ut-team')).toBeTruthy()
    expect(screen.getAllByTestId('unit-type-ut-cluster')).toHaveLength(1)

    const team = card('ut-team')
    expect(team.textContent).toContain('Scrum')
    expect(team.textContent).toContain('9 units today · owns at most 3 applications · until 2027-06-30')
    expect(within(team).getByTestId('role-ro-dev').textContent).toBe('Developer3–9')
    expect(within(team).getByTestId('role-ro-coach').textContent).toBe('Team coach0–1until 2026-12-31')
    // Read aloud, where the lines say it to the eye.
    expect(within(team).getByText('Sits in: Cluster')).toBeTruthy()
    expect(card('ut-domain').textContent).toContain('own')
    expect(within(card('ut-domain')).getByTestId('role-ro-owner').textContent).toBe('Domain ownermanages1')
    expect(card('ut-cluster').textContent).toContain('serves several domains')
    expect(card('ut-platform').textContent).toContain('1 unit today')
    expect(card('ut-platform').textContent).toContain('No roles yet')

    const nowhere = screen.getByTestId('tray-nowhere')
    expect(within(nowhere).getByTestId('unit-type-ut-guild').textContent).toContain('0 units today')
    expect(nowhere.textContent).toContain('No unit can be made of a type that sits nowhere')
    expect(within(screen.getByTestId('tray-loose')).getByRole('button', { name: 'Incident manager' })).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })

  it('lights where a picked type may sit, what may sit in it and its roles, dims the rest, and lets go on a second press', async () => {
    show()
    pickType('Cluster')
    expect(looks('ut-cluster', 'ut-domain', 'ut-team', 'ut-platform', 'ut-guild')).toEqual(['picked', 'lit', 'lit', 'dim', 'dim'])
    expect(screen.getByTestId('structure-organisation').dataset.look).toBe('lit')
    expect(within(card('ut-cluster')).getByTestId('role-ro-lead').dataset.look).toBe('lit')
    expect(within(card('ut-team')).getByTestId('role-ro-po').dataset.look).toBe('plain')
    expect(within(screen.getByTestId('operating-inspector')).getByDisplayValue('Cluster')).toBeTruthy()
    expect(await axeFindings()).toEqual([])
    pickType('Cluster')
    expect(looks('ut-cluster', 'ut-domain', 'ut-guild')).toEqual(['plain', 'plain', 'plain'])
    expect(screen.getByText('Pick a unit type, a role or a responsibility.')).toBeTruthy()
  })

  it('lights the types that hold a picked role, wherever it is drawn', () => {
    show()
    fireEvent.click(within(card('ut-guild')).getByTestId('role-ro-coach'))
    expect(looks('ut-team', 'ut-guild', 'ut-domain', 'ut-cluster')).toEqual(['lit', 'lit', 'dim', 'dim'])
    expect(screen.getByTestId('structure-organisation').dataset.look).toBe('dim')
    expect(screen.getAllByTestId('role-ro-coach').map((one) => one.dataset.look)).toEqual(['picked', 'picked'])
    expect(within(screen.getByTestId('operating-inspector')).getByDisplayValue('Team coach')).toBeTruthy()
    fireEvent.click(within(screen.getByTestId('tray-loose')).getByTestId('role-ro-inc'))
    expect(looks('ut-team', 'ut-guild')).toEqual(['dim', 'dim'])
  })

  it('moves a type along its lane from the inspector, as one step, and says a type that sits nowhere has no lane', () => {
    const sent = show()
    pickType('Platform')
    let inspector = screen.getByTestId('operating-inspector')
    expect(within(inspector).getByText('Lane 1: 2 of 2')).toBeTruthy()
    expect(within(inspector).getByRole<HTMLButtonElement>('button', { name: 'Move down' }).disabled).toBe(true)
    fireEvent.click(within(inspector).getByRole('button', { name: 'Move up' }))
    expect(sent).toEqual([{
      type: 'transaction',
      commands: [{ type: 'unitType.update', id: 'ut-platform', patch: { order: 1 } }, { type: 'unitType.update', id: 'ut-domain', patch: { order: 2 } }],
    }])
    expect(within(lane(1)).getAllByTestId(/^unit-type-/).map((one) => one.dataset.testid)).toEqual(['unit-type-ut-platform', 'unit-type-ut-domain'])
    inspector = screen.getByTestId('operating-inspector')
    expect(within(inspector).getByText('Lane 1: 1 of 2')).toBeTruthy()
    expect(within(inspector).getByText('Nothing may sit in it.')).toBeTruthy()

    pickType('Cluster')
    expect(within(screen.getByTestId('operating-type-place')).getByText('Team')).toBeTruthy()
    fireEvent.click(within(screen.getByTestId('tray-nowhere')).getByRole('button', { name: 'Guild' }))
    inspector = screen.getByTestId('operating-inspector')
    expect(within(inspector).getByText('It sits nowhere: give it a place first.')).toBeTruthy()
    expect(within(inspector).queryByRole('button', { name: 'Move up' })).toBeNull()
    // Given a place, it leaves the tray for its lane.
    fireEvent.click(within(inspector).getByLabelText('At the top, under the organisation itself'))
    expect(within(lane(1)).getByTestId('unit-type-ut-guild')).toBeTruthy()
    expect(screen.getByTestId('tray-nowhere').textContent).toContain('Every unit type has a place.')
  })

  it('draws a line from every place a type may sit, along the rail where it skips a lane, and lights the pick\'s', () => {
    // Cards where a layout would put them: lanes 300 apart, cards 100 apart.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const at = Number(this.closest<HTMLElement>('[data-lane]')?.dataset.lane ?? -1)
      const items = [...(this.closest('[data-lane]')?.querySelectorAll('[data-lane-card], [data-lane-root]') ?? [])]
      const index = items.indexOf(this)
      if (at < 0 || index < 0) return { left: 0, top: 0, right: 1200, bottom: 600, width: 1200, height: 600, x: 0, y: 0, toJSON: () => ({}) }
      const left = at * 300
      const top = 40 + index * 100
      return { left, top, right: left + 236, bottom: top + 80, width: 236, height: 80, x: left, y: top, toJSON: () => ({}) }
    })
    show()
    const stage = screen.getByTestId('structure-lanes')
    expect(stage.querySelectorAll('[data-testid="structure-line-rail"]')).toHaveLength(1)
    expect(stage.querySelectorAll('[data-testid="structure-line-next"]')).toHaveLength(4)
    expect(stage.querySelectorAll('[data-testid="structure-line-loop"]')).toHaveLength(0)
    pickType('Team')
    const lit = [...stage.querySelectorAll<SVGPathElement>('path')].map((one) => one.dataset.look)
    expect(lit.filter((one) => one === 'lit')).toHaveLength(1)
    expect(lit.filter((one) => one === 'dim')).toHaveLength(4)
  })

  it('offers no way to add or move where it only reads, and still picks', () => {
    show({ atOrganisation: false })
    expect(screen.queryByRole('button', { name: 'New unit type' })).toBeNull()
    pickType('Platform')
    expect(looks('ut-platform')).toEqual(['picked'])
    expect(within(screen.getByTestId('operating-inspector')).queryByRole('button', { name: 'Move up' })).toBeNull()
  })
})
