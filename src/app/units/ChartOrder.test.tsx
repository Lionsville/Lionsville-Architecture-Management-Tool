// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A unit moved among its siblings from the chart's outline (ADR-0036, amended
 * 11 October 2026), over fictional Acme Logistics with a shipping domain: the
 * units of its type under the same parent, one place up or down, written as a
 * step in each scope that keeps one of them — the open scope's through its
 * session — and said as such; nothing offered where the scope is only read or
 * a unit has no sibling of its type.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useMemo, useState } from 'react'
import { renderShell } from '../testing/renderShell'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import { fromArrays, toArrays } from '../../model/normalised'
import type { Role, UnitType } from '../../model/operatingModel'
import { apply } from '../../model/reducer'
import type { DesignDiagram, DesignElement } from '../../model/types'
import { indexScopes } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { axeFindings } from '../testing/axe'
import { ChartPage } from './ChartPage'
import type { PeopleMoved } from './landPeopleMoves'
import { ORDER_BARRIER } from './useSiblingOrder'
import { unitViewsHere } from './unitViewsHere'

afterEach(() => cleanup())

const TODAY = '2026-10-11'

const domain: UnitType = { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [] }
const cluster: UnitType = { id: 'ut-cluster', name: 'Cluster', top: true, within: ['ut-domain'], slots: [] }
const team: UnitType = { id: 'ut-team', name: 'Team', within: ['ut-cluster'], slots: [] }
const roles: Role[] = []
const actor = (id: string, name: string, unitTypeId: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId, ...over,
})

const ROOT: HostModel = {
  name: 'Acme Logistics', elements: [actor('data', 'Data & Integration', 'ut-cluster', { scopes: ['shipping'] })],
  relations: [], diagrams: [], unitTypes: [domain, cluster, team], roles,
}
const SHIPPING: HostModel = {
  name: 'Shipping',
  elements: [
    actor('shipping', 'Shipping', 'ut-domain'),
    actor('ops', 'Operations', 'ut-cluster'),
    actor('pf', 'Parcel & Freight', 'ut-cluster', { parentId: 'shipping' }),
    actor('tt', 'Track & Trace', 'ut-team', { parentId: 'pf' }),
    actor('rp', 'Route Planning', 'ut-team', { parentId: 'pf' }),
    actor('lm', 'Line Maintenance', 'ut-team', { parentId: 'pf' }),
  ],
  relations: [], diagrams: [],
}

const view: DesignDiagram = { id: 'oc-1', kind: 'chart', name: 'Organisation', members: [] }

type Landed = { steps: ReadonlyMap<ScopePath, readonly Command[]>; barrier: string | undefined }

/**
 * The chart in the shipping scope. A move lands as the workspace's would for
 * the test's answer: the open scope's part applied to its model, the answer
 * the one given.
 */
function Harness({ landed, answer, readOnly = false }: { landed: Landed[]; answer: (changed: ScopePath[]) => PeopleMoved; readOnly?: boolean }) {
  const [model, setModel] = useState(SHIPPING)
  const index = useMemo(() => indexScopes([{ path: '', model: ROOT }, { path: 'shipping', model: SHIPPING }]), [])
  const here = useMemo(() => unitViewsHere(index, 'shipping', model), [index, model])
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const reorder = (steps: ReadonlyMap<ScopePath, readonly Command[]>, barrier?: string) => {
    landed.push({ steps, barrier })
    const own = steps.get('shipping')
    if (own) {
      const result = apply(fromArrays(model), { type: 'transaction', commands: [...own] })
      if (result.ok) setModel(toArrays(result.model))
    }
    return Promise.resolve(answer([...steps.keys()]))
  }
  return (
    <ChartPage
      diagram={view} here={here} today={TODAY} readOnly={readOnly} people={undefined} scopeLabel={(path) => path || 'Acme Logistics'}
      {...(selected !== undefined ? { selectedId: selected } : {})} onSelect={setSelected} onOpenElsewhere={() => {}}
      scope="shipping" reorder={reorder}
    />
  )
}

const outline = () => screen.getByRole('navigation', { name: 'Units' })
const outlined = () => within(outline()).getAllByTestId('chart-outline-unit').map((row) => row.getAttribute('data-unit-id'))
const pick = (name: string) => fireEvent.click(within(outline()).getByRole('button', { name }))
const ok = (changed: ScopePath[]): PeopleMoved => ({ ok: true, changed, ended: 0, begun: 0 })

describe('a unit moved among its siblings', () => {
  it('moves a team up among the teams of its cluster as one step in the open scope, and every list follows', async () => {
    const landed: Landed[] = []
    renderShell(<Harness landed={landed} answer={ok} />)
    expect(outlined()).toEqual(['shipping', 'pf', 'lm', 'rp', 'tt', 'data', 'ops'])
    pick('Team Track & Trace')
    const panel = within(screen.getByTestId('chart-order'))
    expect(panel.getByTestId('chart-order-of').textContent).toBe('The Team units in Parcel & Freight')
    expect((panel.getByRole('button', { name: 'Move down' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(panel.getByRole('button', { name: 'Move up' }))
    await waitFor(() => expect(screen.getByTestId('chart-order-said').textContent).toBe('One step. Undo takes it back.'))
    expect(landed).toEqual([{
      steps: new Map([['shipping', [
        { type: 'element.update', id: 'lm', patch: { order: 1 } },
        { type: 'element.update', id: 'tt', patch: { order: 2 } },
        { type: 'element.update', id: 'rp', patch: { order: 3 } },
      ]]]),
      barrier: ORDER_BARRIER,
    }])
    expect(outlined()).toEqual(['shipping', 'pf', 'lm', 'tt', 'rp', 'data', 'ops'])
    const teams = screen.getAllByTestId('chart-unit').map((box) => box.getAttribute('data-element-id')).filter((id) => ['lm', 'rp', 'tt'].includes(id!))
    expect(teams).toEqual(['lm', 'tt', 'rp'])
    expect(await axeFindings()).toEqual([])
  })

  it('moves a unit among siblings filed in two scopes as a step in each, and says so', async () => {
    const landed: Landed[] = []
    renderShell(<Harness landed={landed} answer={ok} />)
    pick('Cluster Operations')
    expect(screen.getByTestId('chart-order-of').textContent).toBe('The Cluster units at the top')
    fireEvent.click(screen.getByRole('button', { name: 'Move up' }))
    await waitFor(() => expect(screen.getByTestId('chart-order-said').textContent)
      .toBe('One step in each of 2 scopes that keep these units. It is undone in each scope it changed.'))
    expect(landed[0].steps).toEqual(new Map([
      ['shipping', [{ type: 'element.update', id: 'ops', patch: { order: 1 } }]],
      ['', [{ type: 'element.update', id: 'data', patch: { order: 2 } }]],
    ]))
  })

  it('says why nothing was written where a scope it writes may only be read', async () => {
    renderShell(<Harness landed={[]} answer={() => ({ ok: false, reason: 'shell.scopeReadOnly' })} />)
    pick('Cluster Operations')
    fireEvent.click(screen.getByRole('button', { name: 'Move up' }))
    await waitFor(() => expect(screen.getByTestId('chart-order-said').textContent).toBe('Nothing was written: a scope it writes may only be read here.'))
  })

  it('offers no move for a unit with no sibling of its type, nor where the scope is only read', () => {
    const answer = vi.fn(ok)
    renderShell(<Harness landed={[]} answer={answer} />)
    pick('Cluster Parcel & Freight')
    expect(screen.queryByTestId('chart-order')).toBeNull()
    cleanup()
    renderShell(<Harness landed={[]} answer={answer} readOnly />)
    pick('Team Track & Trace')
    expect(screen.queryByTestId('chart-order')).toBeNull()
    expect(answer).not.toHaveBeenCalled()
  })
})
