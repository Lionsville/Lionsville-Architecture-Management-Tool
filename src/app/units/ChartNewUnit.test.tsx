// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Units made on the organisation chart (ADR-0036, as built 3.6.2), over the
 * fictional Acme Logistics: *+ Unit at the top* on the bar, in the outline's
 * header and on an empty chart, and a unit's own *+*; the dialog offering only
 * the types that may sit there, asking which domains a unit serves only at the
 * top or for a type that spans, and filing it with its parent or the one
 * domain it serves; the unit made as one step — the session's where it is
 * filed here, another scope's through its own write — and then picked, the
 * way to it unfolded; and, where nothing may sit, why, with the way on.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useMemo, useState } from 'react'
import { renderShell } from '../testing/renderShell'
import { leftUnfolded } from '../testing/chartFolds'
import type { Command } from '../../model/commands'
import type { ScopeCommand } from '../../projects/scopeState'
import type { HostModel } from '../../model/hostModel'
import { fromArrays, toArrays } from '../../model/normalised'
import type { Role, UnitType } from '../../model/operatingModel'
import { apply } from '../../model/reducer'
import type { DesignDiagram, DesignElement } from '../../model/types'
import { indexScopes } from '../../projects/scopeIndex'
import type { ScopeSnapshot } from '../../projects/scope'
import { axeFindings } from '../testing/axe'
import { ChartPage } from './ChartPage'
import type { UnitMaking } from './useNewUnit'
import { unitViewsHere } from './unitViewsHere'
import type { WriteIn, WrittenIn } from './writeIn'

afterEach(() => cleanup())

const TODAY = '2026-10-12'

const domain: UnitType = { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [{ role: 'ro-owner', min: 1, max: 1 }] }
const cluster: UnitType = { id: 'ut-cluster', name: 'Cluster', top: true, within: ['ut-domain'], spans: true, slots: [{ role: 'ro-lead', min: 1, max: 1 }] }
const team: UnitType = { id: 'ut-team', name: 'Team', within: ['ut-cluster'], slots: [{ role: 'ro-po', min: 1, max: 1 }] }
const roles: Role[] = [
  { id: 'ro-owner', name: 'Domain owner', duties: [] },
  { id: 'ro-lead', name: 'Cluster lead', duties: [] },
  { id: 'ro-po', name: 'Product owner', duties: [] },
]
const actor = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})

const ROOT: HostModel = { name: 'Acme Logistics', elements: [], relations: [], diagrams: [], unitTypes: [domain, cluster, team], roles }
const SHIPPING: HostModel = {
  name: 'Shipping', relations: [], diagrams: [],
  elements: [
    actor('shipping', 'Shipping', { unitTypeId: 'ut-domain' }),
    actor('pf', 'Parcel & Freight', { unitTypeId: 'ut-cluster', parentId: 'shipping' }),
    actor('tt', 'Track & Trace', { unitTypeId: 'ut-team', parentId: 'pf' }),
  ],
}
const LABELS: Record<string, string> = { '': 'the organisation', shipping: 'Shipping', warehouse: 'Warehouse' }
const view: DesignDiagram = { id: 'oc-1', kind: 'chart', name: 'Organisation', members: [] }

type Written = { path: string; commands: readonly ScopeCommand[] }

function Harness({ scope = 'shipping', root = ROOT, shipping = SHIPPING, commands, written = [], refuse, readOnly = false, onSelect = () => {}, onOpenOperating = () => {}, writable = () => true }: {
  scope?: string; root?: HostModel; shipping?: HostModel; commands: Command[]; written?: Written[]; refuse?: WrittenIn
  readOnly?: boolean; onSelect?: (id: string | undefined) => void; onOpenOperating?: () => void; writable?: (path: string) => boolean
}) {
  const [models, setModels] = useState<Record<string, HostModel>>({ '': root, shipping, warehouse: { name: 'Warehouse', elements: [], relations: [], diagrams: [] } })
  const [selected, setSelected] = useState<string | undefined>(undefined)
  // Opened as left unfolded, so the units made inside a unit on the third level are seen as they land (a first open folds it, 3.7.3).
  const [folds] = useState(() => leftUnfolded(scope, 'oc-1'))
  const index = useMemo(() => indexScopes(Object.entries(models).map(([path, model]) => ({ path, model }))), [models])
  const model = models[scope]
  const here = useMemo(() => unitViewsHere(index, scope, model), [index, scope, model])
  const land = (path: string, command: Command) => {
    const result = apply(fromArrays(models[path]), command)
    if (!result.ok) return undefined
    const next = toArrays(result.model)
    setModels((was) => ({ ...was, [path]: next }))
    return next
  }
  const writeIn: WriteIn = (path, change) => {
    if (refuse) return Promise.resolve(refuse)
    const made = change({ path, model: models[path] } as ScopeSnapshot) ?? []
    written.push({ path, commands: made })
    // A scope's header is no model command: the harness keeps no header, so it is written down and not landed.
    for (const command of made) if (command.type !== 'scope.describe') land(path, command as Command)
    return Promise.resolve({ ok: true })
  }
  const make: UnitMaking = {
    scopes: ['', 'shipping', 'warehouse'], writable, writeIn, onOpenOperating,
    dispatch: (command) => { commands.push(command); return land(scope, command) },
    newId: (name) => `u-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`,
  }
  const select = (id: string | undefined) => { setSelected(id); onSelect(id) }
  return (
    <ChartPage
      diagram={view} here={here} today={TODAY} readOnly={readOnly} people={undefined} scopeLabel={(path) => LABELS[path] ?? path}
      {...(selected !== undefined ? { selectedId: selected } : {})} onSelect={select} onOpenElsewhere={() => {}} scope={scope} make={make} folds={folds}
    />
  )
}

const unitBox = (id: string) => screen.getAllByTestId('chart-unit').find((box) => box.getAttribute('data-element-id') === id)!
const addInside = (id: string) => within(unitBox(id)).getAllByTestId('chart-add-inside')[0]
const dialog = () => screen.getByTestId('new-unit-dialog')
const typesOffered = async () => {
  fireEvent.mouseDown(within(dialog()).getAllByRole('combobox')[0])
  const names = (await screen.findAllByRole('option')).map((one) => one.textContent)
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
  return names
}
const name = (text: string) => fireEvent.change(within(dialog()).getByTestId('new-unit-name'), { target: { value: text } })

describe('a unit made inside another on the chart', () => {
  it('offers only the types that may sit there, files it with its parent, and picks it once it is drawn', async () => {
    const commands: Command[] = []
    const onSelect = vi.fn()
    renderShell(<Harness commands={commands} onSelect={onSelect} />)
    fireEvent.click(addInside('shipping'))
    expect(within(dialog()).getByRole('heading').textContent).toBe('New unit inside Shipping')
    expect(await typesOffered()).toEqual(['Cluster'])
    expect(within(dialog()).getByText('Only the types that may sit in a Domain.')).toBeTruthy()
    // A cluster spans, so it is asked which domains it serves even inside a unit.
    expect(within(dialog()).getByTestId('new-unit-serves')).toBeTruthy()
    // Filed with its parent, which keeps the subtree under the same rights.
    expect(within(dialog()).getAllByRole('combobox')[1].textContent).toBe('Shipping (default)')
    name('Fulfilment')
    fireEvent.click(within(dialog()).getByTestId('new-unit-create'))
    await waitFor(() => expect(screen.queryByTestId('new-unit-dialog')).toBeNull())
    expect(commands).toEqual([{
      type: 'element.create',
      element: { id: 'u-fulfilment', kind: 'actor', name: 'Fulfilment', lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId: 'ut-cluster', parentId: 'shipping' },
    }])
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('u-fulfilment'))
    // Its type's required role is a vacancy at once: assigning follows on.
    expect(within(unitBox('u-fulfilment')).getAllByTestId('chart-vacant')).toHaveLength(1)
  })

  it('says a unit inside serves through it where its type does not span, and unfolds a folded parent to the new unit', async () => {
    const commands: Command[] = []
    renderShell(<Harness commands={commands} />)
    fireEvent.click(within(unitBox('pf')).getAllByTestId('chart-fold')[0])
    expect(unitBox('pf').getAttribute('data-folded')).toBe('true')
    fireEvent.click(addInside('pf'))
    expect(await typesOffered()).toEqual(['Team'])
    expect(within(dialog()).getByTestId('new-unit-through').textContent).toBe('Serves through Parcel & Freight, the unit it sits in.')
    expect(within(dialog()).queryByTestId('new-unit-serves')).toBeNull()
    name('Returns')
    fireEvent.keyDown(within(dialog()).getByTestId('new-unit-name'), { key: 'Enter' })
    await waitFor(() => expect(unitBox('pf').getAttribute('data-folded')).toBeNull())
    expect(unitBox('u-returns')).toBeTruthy()
    expect(commands[0]).toMatchObject({ type: 'element.create', element: { parentId: 'pf', unitTypeId: 'ut-team' } })
  })

  it('where no type may sit, says why and leads to the operating model', async () => {
    const onOpenOperating = vi.fn()
    renderShell(<Harness commands={[]} onOpenOperating={onOpenOperating} />)
    const plus = addInside('tt')
    expect(plus.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(plus)
    expect(within(dialog()).getByTestId('new-unit-none').textContent).toBe('No unit type may sit in a Team.')
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Operating model' }))
    expect(onOpenOperating).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByTestId('new-unit-dialog')).toBeNull())
  })
})

describe('a unit made at the top', () => {
  it('offers the types that may sit at the top, asks which domain it serves, and files it in that domain as that scope’s step', async () => {
    const commands: Command[] = []
    const written: Written[] = []
    renderShell(<Harness scope="" commands={commands} written={written} />)
    // Shipping's units serve the organisation from below: the chart draws them, and the bar and the outline offer the top.
    expect(screen.getByTestId('chart-outline-add').textContent).toBe('+ Unit at the top')
    fireEvent.click(screen.getByTestId('chart-add-top'))
    expect(within(dialog()).getByRole('heading').textContent).toBe('New unit at the top')
    expect(await typesOffered()).toEqual(['Domain', 'Cluster'])
    name('Warehouse')
    fireEvent.click(within(dialog()).getByTestId('new-unit-serves-add'))
    fireEvent.click(await screen.findByRole('option', { name: 'Warehouse' }))
    expect(within(dialog()).getAllByTestId('new-unit-serves-chip').map((one) => one.textContent)).toEqual(['Warehouse'])
    // One domain, a type that does not span: filed in that domain.
    expect((within(dialog()).getByTestId('new-unit-filed') as HTMLInputElement).value).toBe('warehouse')
    expect(within(dialog()).queryByText(/One step in/)).toBeNull()
    expect(await axeFindings(dialog())).toEqual([])
    fireEvent.click(within(dialog()).getByTestId('new-unit-create'))
    await waitFor(() => expect(written).toHaveLength(2))
    expect(commands).toEqual([])
    expect(written[0]).toEqual({
      path: 'warehouse',
      commands: [{ type: 'element.create', element: expect.objectContaining({ id: 'u-warehouse', unitTypeId: 'ut-domain', scopes: ['warehouse'] }) }],
    })
    // The domain served takes the unit's type, in its own header (ADR-0036, amended 17 October 2026).
    expect(written[1]).toEqual({ path: 'warehouse', commands: [{ type: 'scope.describe', patch: { unitTypeId: 'ut-domain', kind: null } }] })
    await waitFor(() => expect(screen.queryByTestId('new-unit-dialog')).toBeNull())
  })

  it('says why another scope did not take it, and keeps what was typed', async () => {
    renderShell(<Harness scope="" commands={[]} refuse={{ ok: false, reason: 'shell.scopeReadOnly' }} />)
    fireEvent.click(screen.getByTestId('chart-add-top'))
    name('Warehouse')
    fireEvent.click(within(dialog()).getByTestId('new-unit-serves-add'))
    fireEvent.click(await screen.findByRole('option', { name: 'Warehouse' }))
    fireEvent.click(within(dialog()).getByTestId('new-unit-create'))
    expect((await within(dialog()).findByTestId('new-unit-said')).textContent).not.toBe('')
    expect((within(dialog()).getByTestId('new-unit-name') as HTMLInputElement).value).toBe('Warehouse')
  })

  it('files it only where the person may write', async () => {
    renderShell(<Harness scope="" commands={[]} writable={(path) => path === ''} />)
    fireEvent.click(screen.getByTestId('chart-add-top'))
    fireEvent.click(within(dialog()).getByTestId('new-unit-serves-add'))
    fireEvent.click(await screen.findByRole('option', { name: 'Shipping' }))
    // Shipping would be the default, and is not the person's to change: the chart's own scope instead.
    expect(within(dialog()).getAllByRole('combobox')[1].textContent).toBe('the organisation')
    fireEvent.mouseDown(within(dialog()).getAllByRole('combobox')[1])
    expect((await screen.findAllByRole('option')).map((one) => one.textContent)).toEqual(['the organisation'])
  })

  it('is the first thing an empty chart offers, and with no unit types leads to a library', async () => {
    const onOpenOperating = vi.fn()
    const bare: HostModel = { name: 'Acme Logistics', elements: [], relations: [], diagrams: [] }
    renderShell(<Harness scope="" root={bare} shipping={{ name: 'Shipping', elements: [], relations: [], diagrams: [] }} commands={[]} onOpenOperating={onOpenOperating} />)
    const first = screen.getByTestId('chart-add-first')
    expect((first as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('chart-add-first-reason').textContent).toBe('There are no unit types yet.')
    fireEvent.click(screen.getByTestId('chart-add-first-link'))
    expect(screen.getByTestId('chart-add-first-link').textContent).toBe('Start from a library')
    expect(onOpenOperating).toHaveBeenCalledTimes(1)
    expect(await axeFindings(screen.getByTestId('chart-page'))).toEqual([])
  })

  it('is nowhere on a chart that is only read', () => {
    renderShell(<Harness commands={[]} readOnly />)
    expect(screen.queryByTestId('chart-add-top')).toBeNull()
    expect(screen.queryByTestId('chart-outline-add')).toBeNull()
    expect(screen.queryAllByTestId('chart-add-inside')).toEqual([])
  })
})
