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
import { PlatformReportPage } from './PlatformReportPage'
import type { PlatformReportPageProps } from './PlatformReportPage'
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
  const result = renderShell(
    <PlatformReportPage
      open
      model={model()}
      platformId="esb"
      onClose={() => {}}
      onOpenDocumentation={onOpenDocumentation}
      {...over}
    />,
  )
  return { ...result, onOpenDocumentation }
}

describe('the report', () => {
  it('names the platform and what it is, and counts what the rows say', () => {
    open()
    expect(screen.getByTestId('technology-platform').textContent).toContain('Enterprise bus')
    // Unsaid is a service (ADR-0014).
    expect(screen.getByText('Service')).toBeTruthy()
    expect(screen.getByTestId('technology-summary').textContent)
      .toContain('1 hosted · 1 using it · 2 interfaces across it')
  })

  it('lists what it stands on and what uses it, and says "nothing yet" where there is nothing', () => {
    open()
    expect(within(screen.getByTestId('technology-standsOn')).getByText('Cluster')).toBeTruthy()
    expect(within(screen.getByTestId('technology-users')).getByText('WMS')).toBeTruthy()
    expect(within(screen.getByTestId('technology-children')).getByText('Nothing yet')).toBeTruthy()
  })

  it('names a container beside the application it belongs to, and the place under it that it sits on', () => {
    open()
    expect(screen.getByTestId('technology-hosted').textContent).toContain('Orders API · Order management')
    // The cluster's report gathers the bus filed under it (ADR-0014 §2.7).
    cleanup()
    open({ platformId: 'cluster' })
    expect(screen.getByTestId('technology-hosted').textContent).toContain('Orders API · Order management · on Enterprise bus')
    expect(screen.getByTestId('technology-summary').textContent).toContain('1 hosted · 1 using it · 2 interfaces across it')
  })

  it('draws a row per interface across it, with the interface it is part of', () => {
    open()
    const grid = screen.getByTestId('technology-grid')
    expect(within(grid).getAllByTestId(/^technology-landing-/).map((row) => row.dataset.testid))
      .toEqual(['technology-landing-r1', 'technology-landing-r2'])
    const landed = within(grid).getByTestId('technology-landing-r1')
    expect(landed.textContent).toContain('REST')
    expect(landed.textContent).toContain('invoices')
    // One that is part of nothing says so in words rather than by a blank.
    expect(within(grid).getByTestId('technology-landing-r2').textContent)
      .toContain('An interface of its own')
  })

  it('opens a thing\'s page from its name where this scope holds it, and leaves a stranger a word', () => {
    const elsewhere: Relation[] = [{ id: 'x1', type: 'hostedOn', sourceId: 'crm', targetId: 'esb' } as Relation]
    const { onOpenDocumentation } = open({
      elsewhere,
      describe: (id) => (id === 'crm' ? { name: 'CRM', kind: 'application', where: 'sales' } : undefined),
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Open WMS' })[0])
    expect(onOpenDocumentation).toHaveBeenCalledWith('wms')
    const crm = within(screen.getByTestId('technology-hosted')).getByTestId('technology-name-crm')
    expect(crm.tagName).toBe('SPAN')
    expect(crm.textContent).toContain('CRM')
  })

  it('says so when the platform is one this scope does not hold', () => {
    open({ platformId: 'elsewhere' })
    expect(screen.getByText('This scope does not hold that platform.')).toBeTruthy()
    expect(screen.queryByTestId('technology-summary')).toBeNull()
  })

  it('says so when nothing crosses it yet', () => {
    open({ model: model({ relations: [] }) })
    expect(screen.getByText('No container interface crosses it yet.')).toBeTruthy()
  })
})
