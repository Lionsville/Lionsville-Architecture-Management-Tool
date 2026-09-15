// @vitest-environment jsdom
/**
 * A platform's page, on screen (ADR-0013).
 *
 * The arithmetic is pinned in `model/technologyDiagram.test.ts`; what is
 * pinned here is what the page promises a reader — the platform and its sort
 * at the top, the four lists, a name that opens the thing's page where this
 * scope holds it and is a plain word where it does not, and an honest line
 * for a view about a platform this scope lacks.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { TechnologyPage } from './TechnologyPage'
import type { TechnologyPageProps } from './TechnologyPage'
import { renderShell } from '../../app/testing/renderShell'
import { element } from '../../model/testFixtures'
import type { DesignDiagram, DesignModel, Relation } from '../../model'

afterEach(() => cleanup())

const VIEW: DesignDiagram = {
  id: 'tv-1', kind: 'technology', name: 'ESB · technology', platformId: 'esb', members: [], geometry: { nodes: [] },
}

function model(over: Partial<DesignModel> = {}): DesignModel {
  return {
    name: 'Landscape',
    diagrams: [VIEW],
    elements: [
      element('esb', { kind: 'platform', name: 'Enterprise bus', platformCategory: 'integration' }),
      element('kafka', { kind: 'platform', name: 'Kafka', platformCategory: 'messaging' }),
      element('cluster', { kind: 'platform', name: 'Cluster', platformCategory: 'runtime' }),
      element('orders', { name: 'Orders' }), element('billing', { name: 'Billing' }), element('wms', { name: 'WMS' }),
    ],
    relations: [
      { id: 'h1', type: 'hostedOn', sourceId: 'esb', targetId: 'cluster' } as Relation,
      { id: 'u1', type: 'uses', sourceId: 'wms', targetId: 'esb' } as Relation,
      { id: 'h2', type: 'hostedOn', sourceId: 'orders', targetId: 'esb' } as Relation,
    ],
    ...over,
  }
}

function open(over: Partial<TechnologyPageProps> = {}) {
  const onOpenDocumentation = vi.fn()
  const result = renderShell(
    <TechnologyPage open model={model()} view={VIEW} onClose={() => {}} onOpenDocumentation={onOpenDocumentation} {...over} />,
  )
  return { ...result, onOpenDocumentation }
}

describe('the page', () => {
  it('names the platform and its sort, and counts what the rows say', () => {
    open()
    expect(screen.getByTestId('technology-platform').textContent).toContain('Enterprise bus')
    expect(screen.getByText('Integration')).toBeTruthy()
    expect(screen.getByTestId('technology-summary').textContent).toContain('1 hosted · 1 using it')
  })

  it('lists what it stands on and what uses it, and says "nothing yet" where there is nothing', () => {
    open()
    expect(within(screen.getByTestId('technology-standsOn')).getByText('Cluster')).toBeTruthy()
    expect(within(screen.getByTestId('technology-users')).getByText('WMS')).toBeTruthy()
    expect(within(screen.getByTestId('technology-hosted')).getByText('Orders')).toBeTruthy()
    expect(within(screen.getByTestId('technology-children')).getByText('Nothing yet')).toBeTruthy()
  })

  it('opens a thing\'s page from its name where this scope holds it, and leaves a stranger a word', () => {
    const elsewhere: Relation[] = [{ id: 'x1', type: 'hostedOn', sourceId: 'crm', targetId: 'esb' } as Relation]
    const { onOpenDocumentation } = open({
      elsewhere,
      describe: (id) => (id === 'crm' ? { name: 'CRM', kind: 'application', where: 'sales' } : undefined),
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Open Orders' })[0])
    expect(onOpenDocumentation).toHaveBeenCalledWith('orders')
    const crm = within(screen.getByTestId('technology-hosted')).getByTestId('technology-name-crm')
    expect(crm.tagName).toBe('SPAN')
    expect(crm.textContent).toContain('CRM')
  })

  it('says so when the view is about a platform this scope does not hold', () => {
    open({ view: { ...VIEW, platformId: 'elsewhere' } })
    expect(screen.getByText('This view is about a platform this scope does not hold.')).toBeTruthy()
    expect(screen.queryByTestId('technology-summary')).toBeNull()
  })
})

describe('the handle', () => {
  it('hands over a capture handle for the view on screen, and takes it back on close', () => {
    const onHandle = vi.fn()
    const { rerender } = open({ onHandle })
    expect(onHandle).toHaveBeenLastCalledWith(expect.objectContaining({ diagramId: 'tv-1' }))
    rerender(<TechnologyPage open={false} model={model()} view={undefined} onClose={() => {}} onHandle={onHandle} />)
    expect(onHandle).toHaveBeenLastCalledWith(undefined)
  })
})
