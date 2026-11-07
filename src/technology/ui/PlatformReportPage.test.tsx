// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A platform's report, on screen (ADR-0013, redone).
 *
 * The arithmetic is pinned in `model/platformReport.test.ts`; what is pinned
 * here is what the page promises a reader — the platform and its sort at the
 * top, the four lists with a container named beside its application, the table
 * of what crosses it with the interface each line is part of, a name that
 * opens the thing's page where this scope holds it, and an honest line for a
 * platform this scope lacks.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { PlatformReportPage } from './ReportPage'
import type { PlatformReportPageProps } from './ReportPage'
import { renderShell } from '../../app/testing/renderShell'
import { element } from '../../model/testFixtures'
import type { DesignModel, Relation } from '../../model'

afterEach(() => cleanup())

function model(over: Partial<DesignModel> = {}): DesignModel {
  return {
    name: 'Landscape',
    diagrams: [],
    elements: [
      element('esb', { kind: 'platform', name: 'Enterprise bus', parentId: 'cluster' }),
      element('cluster', { kind: 'platform', name: 'Cluster', platformArchetype: 'place' }),
      element('orders', { name: 'Order management' }), element('billing', { name: 'Billing' }),
      element('wms', { name: 'WMS' }),
      element('orders-api', { kind: 'component', parentId: 'orders', name: 'Orders API' }),
      element('billing-ledger', { kind: 'component', parentId: 'billing', name: 'Ledger' }),
    ],
    relations: [
      { id: 'u1', type: 'uses', sourceId: 'wms', targetId: 'esb' },
      { id: 'h2', type: 'hostedOn', sourceId: 'orders-api', targetId: 'esb' },
      { id: 'c16', type: 'flow', sourceId: 'billing', targetId: 'orders', label: 'invoices' },
      { id: 'r1', type: 'flow', sourceId: 'billing-ledger', targetId: 'orders-api', refines: 'c16', protocol: 'REST' },
      { id: 'r2', type: 'flow', sourceId: 'wms', targetId: 'orders-api', protocol: 'AMQP' },
    ] as Relation[],
    ...over,
  }
}

function open(over: Partial<PlatformReportPageProps> = {}) {
  const onOpenDocumentation = vi.fn()
  renderShell(<PlatformReportPage open model={model()} platformId="esb" onClose={() => {}} onOpenDocumentation={onOpenDocumentation} {...over} />)
  return { onOpenDocumentation }
}
const rowOf = (name: string) => [...document.querySelectorAll<HTMLElement>('[data-kit-row]')].find((one) => one.textContent?.startsWith(name))!

describe('a platform report', () => {
  it('opens with the sentence a person came for', () => {
    open()
    expect(screen.getByTestId('technology-platform').textContent).toBe('If Enterprise bus went')
    expect(screen.getByTestId('technology-summary').textContent).toBe('2 applications would lose it: 1 run here, 1 use it directly. Cluster would stay.')
  })
  it('gives each thing a row, a container named with its application', () => {
    open()
    const standing = within(screen.getByTestId('technology-standing'))
    expect(standing.getByText('Orders API')).toBeDefined()
    expect(rowOf('Orders API').textContent).toContain('container of Order management')
    expect(rowOf('WMS').textContent).toContain('uses it directly')
  })
  it('says the platform reached through a service stands to lose those too: never Nothing yet beside a row that counts them', () => {
    const held = model()
    open({
      platformId: 'broker',
      model: {
        ...held,
        elements: [...held.elements, element('broker', { kind: 'platform', name: 'Broker' }), element('brokering', { kind: 'platformService', name: 'Brokering' })],
        relations: [...held.relations, { id: 'x1', type: 'realises', sourceId: 'broker', targetId: 'brokering' }, { id: 'x2', type: 'uses', sourceId: 'wms', targetId: 'brokering' }] as Relation[],
      },
    })
    expect(screen.getByTestId('technology-summary').textContent).toContain('1 application would lose it')
    expect(rowOf('WMS').textContent).toContain('Brokering')
  })
  it('lists the interfaces across it, each with the one it is part of', () => {
    open()
    const landings = screen.getByTestId('technology-landings').textContent
    expect(landings).toContain('Ledger → Orders API')
    expect(landings).toContain('invoices')
    expect(landings).toContain('An interface of its own')
  })
  it('opens what this scope holds', () => {
    const { onOpenDocumentation } = open()
    fireEvent.click(rowOf('WMS'))
    expect(onOpenDocumentation).toHaveBeenCalledWith('wms')
  })
  it('says so for a platform this scope lacks', () => {
    open({ platformId: 'nope' })
    expect(screen.getByText('This scope does not hold that platform.')).toBeDefined()
  })
  it('keeps the long list behind a press', () => {
    const held = model()
    const many = Array.from({ length: 30 }, (_, at) => element(`app${at}`, { name: `App ${at}` }))
    open({ model: { ...held, elements: [...held.elements, ...many], relations: [...held.relations, ...many.map((one) => ({ id: `h${one.id}`, type: 'hostedOn', sourceId: one.id, targetId: 'esb' }))] as Relation[] } })
    expect(screen.getByTestId('technology-standing-more').textContent).toMatch(/Show the other \d+/)
    fireEvent.click(screen.getByTestId('technology-standing-more'))
    expect(screen.queryByTestId('technology-standing-more')).toBeNull()
  })
  it('finds nothing wrong, as axe reads it', async () => {
    open()
    expect(await axeFindings()).toEqual([])
  })
})
