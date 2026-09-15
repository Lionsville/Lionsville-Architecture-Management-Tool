// @vitest-environment jsdom
/**
 * A service's report, on screen (ADR-0014 §2.8).
 *
 * The arithmetic is pinned in `model/serviceReport.test.ts`; what is pinned
 * here is what the page promises a reader — the service and whether it is
 * shared, who maintains it and what realises it with an honest word where
 * there is nothing, the table of who leans on it with the container and the
 * scope beside each, and which of them would be stranded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { ServiceReportPage } from './ServiceReportPage'
import type { ServiceReportPageProps } from './ServiceReportPage'
import { renderShell } from '../../app/testing/renderShell'
import { element } from '../../model/testFixtures'
import type { DesignModel, Relation } from '../../model'

afterEach(() => cleanup())

function model(over: Partial<DesignModel> = {}): DesignModel {
  return {
    name: 'Platforms',
    diagrams: [],
    elements: [
      element('containers', { kind: 'platformService', name: 'Container platform', shared: true }),
      element('brokering', { kind: 'platformService', name: 'Message brokering', lifecycleDates: { retired: '2027-06-30' } }),
      element('platform-team', { kind: 'actor', name: 'Platform team' }),
      element('openshift', { kind: 'platform', name: 'OpenShift' }),
      element('wms', { name: 'WMS' }), element('portal', { name: 'Portal' }),
      element('wms-api', { kind: 'component', parentId: 'wms', name: 'WMS API' }),
    ],
    relations: [
      { id: 'a1', type: 'assigned', sourceId: 'platform-team', targetId: 'containers' },
      { id: 'r1', type: 'realises', sourceId: 'openshift', targetId: 'containers' },
      { id: 'u1', type: 'uses', sourceId: 'wms-api', targetId: 'containers' },
      { id: 'u2', type: 'uses', sourceId: 'wms', targetId: 'brokering' },
      { id: 'u3', type: 'uses', sourceId: 'portal', targetId: 'brokering', validUntil: '2027-03-31' },
    ] as Relation[],
    ...over,
  }
}

function open(over: Partial<ServiceReportPageProps> = {}) {
  const onOpenDocumentation = vi.fn()
  const result = renderShell(
    <ServiceReportPage
      open
      model={model()}
      serviceId="containers"
      onClose={() => {}}
      onOpenDocumentation={onOpenDocumentation}
      {...over}
    />,
  )
  return { ...result, onOpenDocumentation }
}

describe('the report', () => {
  it('names the service, whether it is shared, and counts who leans on it', () => {
    open()
    expect(screen.getByTestId('service-name').textContent).toBe('Container platform')
    expect(screen.getByText('Shared')).toBeTruthy()
    expect(screen.getByTestId('service-summary').textContent).toContain('1 consuming it · 0 scopes · 1 stranded if it goes')
  })

  it('lists who maintains it and what realises it, with a word where there is nothing', () => {
    open()
    expect(within(screen.getByTestId('service-maintainers')).getByText('Platform team')).toBeTruthy()
    expect(within(screen.getByTestId('service-realisedBy')).getByText('OpenShift')).toBeTruthy()
    cleanup()
    open({ serviceId: 'brokering' })
    expect(screen.getByText('Own team')).toBeTruthy()
    expect(screen.getByText('Withdrawn on 2027-06-30')).toBeTruthy()
    expect(within(screen.getByTestId('service-maintainers')).getByText('Nobody named')).toBeTruthy()
    expect(within(screen.getByTestId('service-realisedBy')).getByText('Nothing realises it yet')).toBeTruthy()
  })

  it('draws a row per consumer with the container, the scope and whether it would be stranded', () => {
    const elsewhere: Relation[] = [{ id: 'x1', type: 'uses', sourceId: 'crm', targetId: 'containers' } as Relation]
    open({ elsewhere, describe: (id) => (id === 'crm' ? { name: 'CRM', kind: 'application', where: 'sales' } : undefined) })
    const grid = screen.getByTestId('service-grid')
    expect(within(grid).getByTestId('service-consumer-wms').textContent).toContain('WMS API')
    expect(within(grid).getByTestId('service-consumer-wms').textContent).toContain('This scope')
    expect(within(grid).getByTestId('service-consumer-crm').textContent).toContain('sales')
    expect(within(grid).getByTestId('service-consumer-crm').textContent).toContain('Stranded')
    cleanup()
    open({ serviceId: 'brokering' })
    // The portal's row closes before the day it goes; the WMS is stranded.
    expect(within(screen.getByTestId('service-grid')).getByTestId('service-consumer-portal').textContent).toContain('Off it in time')
    expect(within(screen.getByTestId('service-grid')).getByTestId('service-consumer-wms').textContent).toContain('Stranded')
  })

  it('opens a thing\'s page from its name where this scope holds it', () => {
    const { onOpenDocumentation } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Open OpenShift' }))
    expect(onOpenDocumentation).toHaveBeenCalledWith('openshift')
  })

  it('says so when the service is one this scope does not hold, and when nothing uses it', () => {
    open({ serviceId: 'elsewhere' })
    expect(screen.getByText('This scope does not hold that service.')).toBeTruthy()
    cleanup()
    open({ model: model({ relations: [] }) })
    expect(screen.getByText('Nothing uses it yet.')).toBeTruthy()
  })
})
